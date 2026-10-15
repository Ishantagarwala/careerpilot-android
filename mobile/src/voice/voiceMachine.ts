/**
 * Voice session state machine.
 *
 * WHY THIS IS A REDUCER AND NOT MORE REFS
 *
 * The web implementation of this feature kept its guard state in refs scattered
 * across a ~1,100-line hook. Three separate regressions shipped from it in one
 * session, all of the same kind — a flag set in one place and never cleared, or
 * cleared at the wrong moment:
 *
 *   1. a `deadRef` set on unmount but never reset, which (under React
 *      StrictMode's mount → cleanup → mount) left the hook believing it was
 *      dead for its entire life;
 *   2. a recording guard cleared *before* the async `getUserMedia`, so the
 *      recorder discarded the microphone stream it had just acquired and
 *      returned silently — "tap to record" did nothing, with no error;
 *   3. a MIME type forwarded with a codec parameter the server rejects.
 *
 * None of those were hard to fix; they were hard to SEE, because the state lived
 * in a dozen refs mutated from async callbacks and could only be reasoned about
 * by reading. As a pure reducer the same transitions are enumerable, and every
 * one of them is asserted in `tests/voiceMachine.test.mjs` — including the exact
 * malformed sequences above.
 *
 * The invariant that matters most: **the microphone is only ever open in
 * `recording`**, so a stuck state is visible in one value rather than inferred
 * from four booleans.
 */

export type VoicePhase =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export interface VoiceState {
  phase: VoicePhase;
  /** True from the moment capture is requested until the mic is released. */
  captureOwned: boolean;
  /** Bumped on every cancel/teardown; stale async work compares and bails. */
  turnId: number;
  /** The user-visible failure, or null. */
  error: string | null;
  /** The transcript shown in the editable box. */
  transcript: string;
}

export const initialVoiceState: VoiceState = {
  phase: "idle",
  captureOwned: false,
  turnId: 0,
  error: null,
  transcript: "",
};

export type VoiceAction =
  /** The user asked to start recording. */
  | { type: "START" }
  /** Permission granted and the recorder is about to begin. */
  | { type: "PERMISSION_GRANTED" }
  /** The recorder is genuinely capturing. */
  | { type: "RECORDING_STARTED" }
  /** The user (or the silence/ceiling timer) stopped capture. */
  | { type: "STOP" }
  /** Audio is uploaded for transcription. */
  | { type: "TRANSCRIBE_START" }
  | { type: "TRANSCRIBE_DONE"; text: string }
  /** A reply is being awaited, or about to be spoken. */
  | { type: "THINK" }
  | { type: "SPEAK_START" }
  /** Anything finished and the session is back to waiting for the user. */
  | { type: "SETTLED" }
  /** The user cancelled, the screen closed, or the screen unmounted. */
  | { type: "CANCEL" }
  | { type: "FAILED"; message: string }
  /** The transcript box was edited by the user. */
  | { type: "SET_TRANSCRIPT"; text: string }
  /** A `no-speech` style outcome: not an error, just nothing heard. */
  | { type: "HEARD_NOTHING" };

/**
 * Applies an action.
 *
 * Deliberately total: an action that does not apply to the current phase is
 * ignored rather than throwing, because the actions arrive from async callbacks
 * that may resolve after the user has already moved on. Silently ignoring a
 * stale event is correct; acting on it is how a cancelled turn spoke a reply.
 */
export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    /*
     * START is idempotent while capture is already owned. This is the guard
     * whose absence let a second recorder open a second microphone stream — the
     * original leak: the first stream was never stopped because `onstop` only
     * knew about whichever stream was current when it fired.
     */
    case "START":
      if (state.captureOwned) return state;
      return {
        ...state,
        phase: "requesting-permission",
        captureOwned: true,
        error: null,
        transcript: "",
        turnId: state.turnId + 1,
      };

    case "PERMISSION_GRANTED":
      if (!state.captureOwned) return state; // cancelled while the prompt was open
      return { ...state, phase: "recording" };

    case "RECORDING_STARTED":
      // Only meaningful if this turn still owns capture.
      if (!state.captureOwned) return state;
      return { ...state, phase: "recording" };

    case "STOP":
      if (!state.captureOwned) return state;
      return { ...state, phase: "transcribing" };

    case "TRANSCRIBE_START":
      if (!state.captureOwned) return state;
      return { ...state, phase: "transcribing" };

    /*
     * Capture ends here. Releasing ownership on the RESULT (not on STOP) is
     * what stops a slow transcription from blocking the next attempt while
     * still ensuring the mic is not held open during the request.
     */
    case "TRANSCRIBE_DONE":
      return {
        ...state,
        phase: "thinking",
        captureOwned: false,
        transcript: action.text,
        error: null,
      };

    case "HEARD_NOTHING":
      return { ...state, phase: "idle", captureOwned: false, error: null };

    case "THINK":
      return { ...state, phase: "thinking" };

    case "SPEAK_START":
      return { ...state, phase: "speaking" };

    case "SETTLED":
      // Must not resurrect a cancelled session.
      if (state.phase === "error") return state;
      return { ...state, phase: "idle", captureOwned: false };

    case "CANCEL":
      return {
        ...state,
        phase: "idle",
        captureOwned: false,
        error: null,
        // Invalidate in-flight work so a late response cannot act.
        turnId: state.turnId + 1,
      };

    case "FAILED":
      return {
        ...state,
        phase: "error",
        captureOwned: false,
        error: action.message,
        turnId: state.turnId + 1,
      };

    case "SET_TRANSCRIPT":
      return { ...state, transcript: action.text };

    default:
      return state;
  }
}

/** True while the microphone is (or is about to be) open. */
export function isMicrophoneActive(state: VoiceState): boolean {
  return state.captureOwned;
}

/** True while the assistant should not accept a new turn. */
export function isBusy(state: VoiceState): boolean {
  return (
    state.phase === "transcribing" ||
    state.phase === "thinking" ||
    state.phase === "speaking" ||
    state.phase === "requesting-permission"
  );
}

/** The label the UI shows for a phase. Kept here so it is testable too. */
export function phaseLabel(state: VoiceState): string {
  switch (state.phase) {
    case "idle":
      return "Tap to speak";
    case "requesting-permission":
      return "Waiting for microphone permission…";
    case "recording":
      return "Listening… tap to stop";
    case "transcribing":
      return "Transcribing…";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Speaking… tap to interrupt";
    case "error":
      return state.error || "Something went wrong";
    default:
      return "";
  }
}
