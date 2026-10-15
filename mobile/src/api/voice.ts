import { apiClient, ApiError } from './client';
import {
  ASR_LANGUAGES,
  DEFAULT_VOICE_LANGUAGE,
  VOICE_LANGUAGES,
  audioFileExtension,
  normalizeAudioMimeType,
} from '../voice/contract';

// Re-exported so callers have one import site for the voice API.
export * from '../voice/contract';

/**
 * Voice endpoints.
 *
 * Both routes are the same ones the web app uses (`/api/voice/transcribe` and
 * `/api/voice/speak`), so the audio contract is already fixed by the server and
 * this module only has to match it.
 */

export interface TranscribeParams {
  /** Local file URI from the recorder. */
  uri: string;
  /** The recorder's reported MIME type; normalised before upload. */
  mimeType?: string;
  languageCode?: string;
  signal?: AbortSignal;
}

/**
 * Uploads a recording and returns the transcript.
 *
 * An empty transcript is a legitimate result — silence, or background noise —
 * and is returned as an empty string rather than thrown, so the caller can say
 * "didn't catch that" instead of showing an error.
 */
export async function transcribeAudio(params: TranscribeParams): Promise<string> {
  const mimeType = normalizeAudioMimeType(params.mimeType);
  const languageCode = params.languageCode || DEFAULT_VOICE_LANGUAGE.code;

  if (!(ASR_LANGUAGES as readonly string[]).includes(languageCode)) {
    // Fail here with a useful message rather than letting the server return an
    // opaque provider error.
    throw new ApiError(`Unsupported language "${languageCode}".`, 400);
  }

  const formData = new FormData();
  // React Native's FormData takes a { uri, name, type } object for a file part.
  formData.append('file', {
    uri: params.uri,
    name: `audio.${audioFileExtension(mimeType)}`,
    type: mimeType,
  } as any);
  formData.append('language_code', languageCode);

  const data = await apiClient<{ text?: string; language?: string }>('/api/voice/transcribe', {
    method: 'POST',
    body: formData,
    // Upload plus provider round trip; the default 15s is tight for a long clip.
    timeoutMs: 45000,
    signal: params.signal,
  });

  return (data?.text || '').trim();
}

export interface SpeakParams {
  text: string;
  languageCode?: string;
  speaker?: string;
  signal?: AbortSignal;
}

/**
 * Synthesises speech and returns base64 audio.
 *
 * The server caps a request at 2,500 characters (bulbul:v3's real limit) and
 * rejects anything longer with a clear message. Callers should chunk first —
 * `chunkForSpeech` in `src/voice/transcript.ts` does that at sentence
 * boundaries.
 */
export async function synthesizeSpeech(params: SpeakParams): Promise<{ audio: string; mime: string }> {
  const text = params.text.trim();
  if (!text) throw new ApiError('No text to speak.', 400);

  const language =
    VOICE_LANGUAGES.find((l) => l.code === params.languageCode) || DEFAULT_VOICE_LANGUAGE;

  const data = await apiClient<{ audio?: string }>('/api/voice/speak', {
    method: 'POST',
    // `RequestOptions` extends `RequestInit`, so the body is typed `BodyInit` —
    // an object literal is not assignable and must be serialised, matching the
    // convention in the other API modules.
    body: JSON.stringify({
      text,
      languageCode: language.code,
      speaker: params.speaker || language.speaker,
    }),
    timeoutMs: 30000,
    signal: params.signal,
  });

  if (!data?.audio) {
    // A 200 with no audio used to look like success and then played nothing.
    throw new ApiError('Speech synthesis returned no audio.', 502);
  }

  return { audio: data.audio, mime: 'audio/wav' };
}
