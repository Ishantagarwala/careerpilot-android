/**
 * The voice contract, with no runtime dependencies.
 *
 * Kept separate from `src/api/voice.ts` so it can be imported by a plain Node
 * test. The network module imports React Native's `fetch` plumbing, which does
 * not exist under Node — and the values here are the ones worth asserting
 * against, because getting them wrong fails silently in production:
 *
 *   - a MIME type carrying a `;codecs=` parameter is rejected outright;
 *   - a language code the route does not accept returns an opaque 400;
 *   - a voice outside the provider's list fails every request that uses it.
 */

/**
 * Languages the server accepts for speech-to-text.
 *
 * Kept in sync with `app/api/voice/transcribe/route.ts`. It validates the code
 * before forwarding to the provider — which matters because an unknown code
 * comes back as an opaque 400 that used to be flattened into the words
 * "Bad Request".
 */
export const ASR_LANGUAGES = [
  'en-IN',
  'hi-IN',
  'bn-IN',
  'ta-IN',
  'te-IN',
  'mr-IN',
  'gu-IN',
  'kn-IN',
  'ml-IN',
  'pa-IN',
  'od-IN',
] as const;

export type AsrLanguage = (typeof ASR_LANGUAGES)[number];

export interface VoiceLanguage {
  code: AsrLanguage;
  name: string;
  nativeName: string;
  /** bulbul:v3 voice id. Every one of these is on the server's allowlist. */
  speaker: string;
}

/**
 * Voices, each verified to accept the language it is paired with.
 *
 * The server holds an allowlist of 37 bulbul:v3 voices and rejects anything
 * else, so these must stay within it — `npm run check:voice` in the web repo
 * asserts that every pair here is accepted. `meera` is deliberately absent: it
 * is not a v3 voice, and shipping it as a default broke every speakerless
 * request.
 */
export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'en-IN', name: 'English', nativeName: 'English', speaker: 'ritu' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', speaker: 'shubh' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', speaker: 'ritu' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', speaker: 'ritu' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', speaker: 'ritu' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', speaker: 'shubh' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', speaker: 'ritu' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speaker: 'shubh' },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', speaker: 'ritu' },
  { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speaker: 'shubh' },
  { code: 'od-IN', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speaker: 'ritu' },
];

export const DEFAULT_VOICE_LANGUAGE = VOICE_LANGUAGES[0];

/**
 * MIME types the transcriber accepts, taken from the provider's own rejection
 * message. Used to guarantee an upload is never refused for its type.
 *
 * Android records `.m4a` (AAC in an MP4 container) via expo-audio, which maps to
 * `audio/mp4` and IS accepted. The codec parameter must never be included:
 * `audio/mp4;codecs=mp4a.40.2` is a different string and is rejected, which is
 * exactly the bug that broke transcription on the web.
 */
export const ASR_ACCEPTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/aiff',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/amr',
  'audio/webm',
  /*
   * The provider lists this for payloads whose container it cannot name, which
   * is exactly what `normalizeAudioMimeType` falls back to. Omitting it made
   * that fallback claim a type the checker itself rejected — caught by the test
   * asserting every normalised value is accepted.
   */
  'application/octet-stream',
] as const;

/**
 * Normalises a recorder MIME type into one the server accepts.
 *
 * Strips `;codecs=...` and any other parameter, then maps the container onto the
 * accepted set. An unrecognised container becomes `application/octet-stream`,
 * which is on the list precisely for that case, rather than claiming a type that
 * cannot be confirmed.
 */
export function normalizeAudioMimeType(mimeType: string | undefined): string {
  const raw = (mimeType || '').trim().toLowerCase();
  if (!raw) return 'audio/mp4';

  const bare = raw.split(';')[0].trim();
  // A video container is never right for an audio-only payload.
  const asAudio = bare === 'video/mp4' ? 'audio/mp4' : bare === 'video/webm' ? 'audio/webm' : bare;

  if ((ASR_ACCEPTED_MIME_TYPES as readonly string[]).includes(asAudio)) return asAudio;

  if (asAudio.includes('mp4') || asAudio.includes('m4a') || asAudio.includes('aac')) return 'audio/mp4';
  if (asAudio.includes('webm')) return 'audio/webm';
  if (asAudio.includes('ogg')) return asAudio.includes('opus') ? 'audio/opus' : 'audio/ogg';
  if (asAudio.includes('wav') || asAudio.includes('wave')) return 'audio/wav';
  if (asAudio.includes('mpeg') || asAudio.includes('mp3')) return 'audio/mpeg';
  if (asAudio.includes('flac')) return 'audio/flac';
  if (asAudio.includes('aiff')) return 'audio/aiff';
  if (asAudio.includes('amr')) return 'audio/amr';
  return 'application/octet-stream';
}

/** A file extension matching a normalised MIME type. */
export function audioFileExtension(mimeType: string): string {
  const bare = normalizeAudioMimeType(mimeType);
  if (bare === 'audio/mp4' || bare === 'audio/x-m4a') return 'm4a';
  if (bare === 'audio/webm') return 'webm';
  if (bare === 'audio/ogg' || bare === 'audio/opus') return 'ogg';
  if (bare === 'audio/wav' || bare === 'audio/x-wav' || bare === 'audio/wave') return 'wav';
  if (bare === 'audio/mpeg' || bare === 'audio/mp3') return 'mp3';
  if (bare === 'audio/aac') return 'aac';
  if (bare === 'audio/flac') return 'flac';
  if (bare === 'audio/amr') return 'amr';
  return 'bin';
}
