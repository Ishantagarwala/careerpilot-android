/**
 * Pure helpers for the voice feature.
 *
 * Shared by design with the web implementation (`lib/voice/transcript.ts`),
 * because the failures they prevent are not platform-specific:
 *
 *   - text sent to the model must not repeat itself once per interim result;
 *   - a reply longer than the TTS limit must be split, not refused;
 *   - markdown must not be read aloud as punctuation.
 *
 * They live outside the hook so they can be unit-tested in plain Node. The hook
 * itself touches native audio modules, which do not exist in a test runner.
 */

/**
 * The minimum shape of a Web Speech `SpeechRecognitionResult`.
 *
 * NOTE: Android's speech-to-text is a whole-utterance upload to the server, not
 * a streaming recogniser, so `aggregateSpeechResults` is NOT used on the mobile
 * path — there are no interim results to aggregate. It is kept here because both
 * platforms share this module, and it is what the shared tests exercise.
 */
export interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly 0: { readonly transcript: string };
}

/** The minimum shape of a Web Speech `SpeechRecognitionEvent`. */
export interface SpeechEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechResultLike;
  };
}

export interface AggregatedTranscript {
  /** Everything recognised so far, interim included. Safe to display. */
  full: string;
  /** The provider's finalised portion, which replaces rather than appends. */
  finalText: string;
  /** True once at least one finalised segment exists. */
  hasFinal: boolean;
  /** The trailing, still-changing portion. */
  interim: string;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Rebuilds the whole transcript from a recognition event.
 *
 * The bug this replaces: interim text was APPENDED to a running transcript that
 * already contained the previous interim —
 *
 *   const display = `${transcriptRef.current} ${interimTranscript}`
 *
 * — but `transcriptRef` is kept in sync with the displayed value, and Chrome's
 * `event.results[i][0].transcript` for an interim result is already CUMULATIVE
 * for that index. So saying "hello world" produced:
 *
 *   interim "hello"        -> "hello"
 *   interim "hello world"  -> "hello hello world"
 *   final   "hello world"  -> "hello hello world hello world"
 *
 * and that last string is what reached the LLM. Every voice turn was corrupted,
 * and longer sentences compounded it.
 *
 * Rebuilding from `event.results` on every event is both simpler and correct:
 * results below `resultIndex` are immutable and finalised, the segment at a
 * non-final index is the live one, and nothing is carried over that the event
 * does not itself contain.
 */
export function aggregateSpeechResults(event: SpeechEventLike): AggregatedTranscript {
  const finals: string[] = [];
  const interims: string[] = [];

  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (!result) continue;
    const text = result[0]?.transcript ?? "";
    if (!text) continue;
    if (result.isFinal) finals.push(text);
    else interims.push(text);
  }

  const finalText = collapse(finals.join(" "));
  const interim = collapse(interims.join(" "));
  const full = collapse([finalText, interim].filter(Boolean).join(" "));

  return { full, finalText, hasFinal: finals.length > 0, interim };
}

/**
 * Splits text into speakable chunks at or below `maxChars`.
 *
 * bulbul:v3 rejects a request over 2 500 characters, so a long reply has to be
 * split rather than refused. Splitting on sentence boundaries keeps each chunk
 * sounding like speech instead of a cut-off fragment; a single sentence longer
 * than the limit is broken on whitespace as a last resort.
 */
export function chunkForSpeech(text: string, maxChars = 2500): string[] {
  const clean = collapse(text);
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  // Keep the terminator with its sentence.
  const sentences = clean.match(/[^.!?]+[.!?]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      // A single enormous "sentence" — break it on whitespace.
      push();
      let rest = sentence.trim();
      while (rest.length > maxChars) {
        let cut = rest.lastIndexOf(" ", maxChars);
        if (cut <= 0) cut = maxChars;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) chunks.push(rest);
      continue;
    }

    if ((current + sentence).length > maxChars) push();
    current += sentence;
  }
  push();

  return chunks;
}

/**
 * Strips markdown so the spoken form matches the written one.
 *
 * Without this the browser-speech fallback reads fenced code, link URLs and
 * asterisks aloud. The tutor path had a `forSpeech()` equivalent; the Hub did
 * not, so the same reply was spoken two different ways depending on the screen.
 */
export function normalizeForSpeech(text: string, maxChars = 2500): string {
  const withoutCode = text
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code keeps its text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images drop entirely
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links keep their label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading markers
    .replace(/^\s{0,3}>\s?/gm, "") // blockquote markers
    .replace(/^\s*[-*+]\s+/gm, "") // bullet markers
    .replace(/^\s*\d+[.)]\s+/gm, "") // ordered-list markers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2") // italic
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^\s*\|.*\|\s*$/gm, " ") // table rows read poorly aloud
    .replace(/\|/g, " ")
    .replace(/^\s*[-*_]{3,}\s*$/gm, " ") // horizontal rules
    .replace(/\s+/g, " ")
    .trim();

  return withoutCode.slice(0, maxChars).trim();
}
