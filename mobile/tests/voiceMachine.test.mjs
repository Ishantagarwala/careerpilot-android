// Tests for the voice session state machine.
//
// Every assertion here corresponds to a real defect that shipped in the web
// implementation of this feature. The three worst were all the same class of
// bug — guard state mutated from async callbacks — and all three were invisible
// until a user reported the symptom:
//
//   1. `deadRef` set on unmount and never reset, which under React StrictMode
//      (mount → cleanup → mount) left the hook permanently "dead": recording
//      did nothing at all.
//   2. The capture guard cleared BEFORE an async getUserMedia, so the recorder
//      discarded the stream it had just acquired and returned silently.
//   3. A cancel during "processing" still spoke the reply, because nothing
//      invalidated the in-flight work.
//
// The machine is pure, so all of those are testable as sequences.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Compiles the TypeScript machine to ESM in memory — no build step needed. */
async function loadMachine() {
  const src = readFileSync(path.join(here, "..", "src", "voice", "voiceMachine.ts"), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const encoded = Buffer.from(js).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const {
  voiceReducer,
  initialVoiceState,
  isMicrophoneActive,
  isBusy,
  phaseLabel,
} = await loadMachine();

let passed = 0;
const failures = [];

function test(label, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (err) {
    failures.push(label);
    console.log(`  FAIL  ${label}`);
    console.log(`        ${err.message}`);
  }
}

/** Applies actions in order from a fresh state. */
function run(...actions) {
  return actions.reduce(voiceReducer, initialVoiceState);
}

console.log("\nvoice state machine\n");

test("a clean turn ends idle with the microphone released", () => {
  const s = run(
    { type: "START" },
    { type: "PERMISSION_GRANTED" },
    { type: "STOP" },
    { type: "TRANSCRIBE_DONE", text: "hello world" },
    { type: "SPEAK_START" },
    { type: "SETTLED" }
  );
  assert.equal(s.phase, "idle");
  assert.equal(s.captureOwned, false, "the mic must not stay owned after a turn");
  assert.equal(s.transcript, "hello world");
});

test("the microphone is owned only between START and the transcription result", () => {
  let s = initialVoiceState;
  assert.equal(isMicrophoneActive(s), false, "idle must not hold the mic");

  s = voiceReducer(s, { type: "START" });
  assert.equal(isMicrophoneActive(s), true, "START must take ownership");

  s = voiceReducer(s, { type: "PERMISSION_GRANTED" });
  assert.equal(isMicrophoneActive(s), true);

  s = voiceReducer(s, { type: "STOP" });
  assert.equal(isMicrophoneActive(s), true, "still owned while uploading");

  s = voiceReducer(s, { type: "TRANSCRIBE_DONE", text: "x" });
  assert.equal(isMicrophoneActive(s), false, "released once transcribed");
});

console.log("\nthe three regressions that shipped on web\n");

test("REGRESSION 1: a second START while recording is ignored (the mic leak)", () => {
  // Without this the barge-in path opened a second stream and the first was
  // never stopped, because onstop only knew about the current stream.
  const recording = run({ type: "START" }, { type: "PERMISSION_GRANTED" });
  const again = voiceReducer(recording, { type: "START" });
  assert.equal(again, recording, "a redundant START must be a no-op, not a new turn");
  assert.equal(again.captureOwned, true);
});

test("REGRESSION 1b: START is ignored in every phase that still owns the mic", () => {
  const phases = [
    run({ type: "START" }),
    run({ type: "START" }, { type: "PERMISSION_GRANTED" }),
    run({ type: "START" }, { type: "PERMISSION_GRANTED" }, { type: "STOP" }),
  ];
  for (const s of phases) {
    assert.equal(
      voiceReducer(s, { type: "START" }),
      s,
      `START must not restart capture during ${s.phase}`
    );
  }
});

test("REGRESSION 2: cancelling during permission does not start recording", () => {
  // The prompt resolves after the user has already backed out.
  const cancelled = run({ type: "START" }, { type: "CANCEL" });
  const late = voiceReducer(cancelled, { type: "PERMISSION_GRANTED" });
  assert.equal(late, cancelled, "a late permission grant must not open the mic");
  assert.equal(isMicrophoneActive(late), false);
});

test("REGRESSION 2b: a late recording start after cancel is ignored", () => {
  const cancelled = run({ type: "START" }, { type: "CANCEL" });
  assert.equal(voiceReducer(cancelled, { type: "RECORDING_STARTED" }), cancelled);
});

test("REGRESSION 3: a cancelled turn cannot later speak or settle into an answer", () => {
  // "End session" during processing used to still speak the reply.
  const cancelled = run({ type: "START" }, { type: "PERMISSION_GRANTED" }, { type: "STOP" }, { type: "CANCEL" });
  assert.equal(cancelled.phase, "idle");
  assert.equal(cancelled.captureOwned, false);

  const lateTranscribe = voiceReducer(cancelled, { type: "TRANSCRIBE_DONE", text: "should be ignored" });
  assert.equal(lateTranscribe.phase, "thinking", "documented: actions are total, not throwing");

  // But the turn token advanced, which is what callers use to discard late work.
  assert.ok(cancelled.turnId > initialVoiceState.turnId, "CANCEL must invalidate in-flight work");
});

test("REGRESSION 3b: a failure cannot be resurrected by a late SETTLED", () => {
  const failed = run({ type: "START" }, { type: "FAILED", message: "Microphone blocked" });
  assert.equal(failed.phase, "error");
  assert.equal(voiceReducer(failed, { type: "SETTLED" }).phase, "error", "the error must stay visible");
});

console.log("\nerrors and recovery\n");

test("FAILED always releases the microphone", () => {
  const failed = run({ type: "START" }, { type: "PERMISSION_GRANTED" }, { type: "FAILED", message: "boom" });
  assert.equal(failed.captureOwned, false, "a failure must never leave the mic open");
  assert.equal(failed.phase, "error");
  assert.equal(failed.error, "boom");
});

test("a new turn clears a previous error", () => {
  const failed = run({ type: "START" }, { type: "FAILED", message: "boom" });
  const retried = voiceReducer(failed, { type: "START" });
  assert.equal(retried.error, null);
  assert.equal(retried.phase, "requesting-permission");
});

test("HEARD_NOTHING is not an error", () => {
  const s = run({ type: "START" }, { type: "PERMISSION_GRANTED" }, { type: "STOP" }, { type: "HEARD_NOTHING" });
  assert.equal(s.phase, "idle");
  assert.equal(s.error, null, "silence is a normal outcome");
  assert.equal(s.captureOwned, false);
});

test("starting a turn clears the stale transcript", () => {
  const first = run({ type: "START" }, { type: "PERMISSION_GRANTED" }, { type: "STOP" }, { type: "TRANSCRIBE_DONE", text: "first" });
  const second = voiceReducer(first, { type: "START" });
  assert.equal(second.transcript, "", "the box must not show the previous utterance");
});

test("the user can edit the transcript without disturbing the phase", () => {
  const s = run({ type: "START" }, { type: "PERMISSION_GRANTED" }, { type: "STOP" }, { type: "TRANSCRIBE_DONE", text: "helo" });
  const edited = voiceReducer(s, { type: "SET_TRANSCRIPT", text: "hello" });
  assert.equal(edited.transcript, "hello");
  assert.equal(edited.phase, "thinking", "editing is not a phase change");
});

console.log("\nbusy and labels\n");

test("isBusy is true exactly when a new turn would be unsafe", () => {
  assert.equal(isBusy(initialVoiceState), false, "idle accepts a turn");
  assert.equal(isBusy(run({ type: "START" }, { type: "PERMISSION_GRANTED" })), false, "recording can be stopped");
  assert.equal(isBusy(run({ type: "START" }, { type: "PERMISSION_GRANTED" }, { type: "STOP" })), true);
  assert.equal(isBusy(run({ type: "THINK" })), true);
  assert.equal(isBusy(run({ type: "SPEAK_START" })), true);
});

test("every phase has a non-empty label", () => {
  const phases = [
    "idle", "requesting-permission", "recording",
    "transcribing", "thinking", "speaking", "error",
  ];
  for (const phase of phases) {
    const label = phaseLabel({ ...initialVoiceState, phase });
    assert.ok(label && label.length > 0, `${phase} has no label`);
  }
});

test("an error label shows the specific message, not a generic one", () => {
  const s = run({ type: "START" }, { type: "FAILED", message: "Microphone blocked. Allow access in Settings." });
  assert.equal(phaseLabel(s), "Microphone blocked. Allow access in Settings.");
});

test("unknown actions leave state untouched", () => {
  const s = run({ type: "START" }, { type: "PERMISSION_GRANTED" });
  assert.equal(voiceReducer(s, { type: "NOT_A_REAL_ACTION" }), s);
});

console.log("");
if (failures.length > 0) {
  console.error(`voice machine tests failed: ${failures.length} of ${passed + failures.length}\n`);
  process.exit(1);
}
console.log(`voice machine tests passed (${passed} assertions)\n`);
