// Tests for the voice API contract.
//
// These guard a class of bug that has already shipped twice in this project,
// both times breaking transcription completely:
//
//   1. The web recorder forwarded `MediaRecorder.mimeType` verbatim, which is
//      `audio/webm;codecs=opus`. The provider validates the CONTAINER and
//      rejects that exact string: "Invalid file type: audio/webm;codecs=opus".
//   2. The web's own UI guard then compounded it by comparing the same
//      parameterised string against a bare-type allowlist.
//
// Android records `.m4a`, so the failure looked different but the trap is
// identical: never send a MIME type carrying parameters, and never send one the
// provider does not list. `ASR_ACCEPTED_MIME_TYPES` here is transcribed from the
// provider's own rejection message, so the assertions below are a real contract
// check rather than a restatement of the implementation.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASR_ACCEPTED_MIME_TYPES,
  ASR_LANGUAGES,
  VOICE_LANGUAGES,
  audioFileExtension,
  normalizeAudioMimeType,
} from '../src/voice/contract.ts';

test('a codec parameter is stripped from the MIME type', () => {
  // The exact string that broke web transcription.
  assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeAudioMimeType('audio/mp4;codecs=mp4a.40.2'), 'audio/mp4');
});

test('no normalised value can contain a parameter', () => {
  // The general form: a `;` anywhere means the provider will refuse it.
  const inputs = [
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/ogg;codecs=opus',
    'audio/mp4; codecs=mp4a.40.2',
    'audio/wav;rate=48000',
  ];
  for (const input of inputs) {
    const out = normalizeAudioMimeType(input);
    assert.ok(!out.includes(';'), `${input} -> ${out} still carries a parameter`);
  }
});

test('every normalised value is one the provider accepts', () => {
  // The only assertion that actually guarantees the upload is not rejected.
  const inputs = [
    'audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/x-m4a', 'audio/aac',
    'audio/webm;codecs=opus', 'audio/webm', 'video/webm',
    'audio/ogg;codecs=opus', 'audio/ogg', 'audio/opus',
    'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3',
    'audio/flac', 'audio/aiff', 'audio/amr',
    'video/mp4',
    '', undefined, 'AUDIO/MP4;CODECS=MP4A.40.2', '  audio/mp4 ; codecs=x  ',
    'application/x-unknown-container',
  ];
  for (const input of inputs) {
    const out = normalizeAudioMimeType(input);
    assert.ok(
      ASR_ACCEPTED_MIME_TYPES.includes(out),
      `${JSON.stringify(input)} -> ${out} is NOT on the provider's allowed list`
    );
  }
});

test("Android's recorder format maps to an accepted container", () => {
  // expo-audio records m4a (AAC in MP4) on Android.
  assert.equal(normalizeAudioMimeType('audio/mp4'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType(undefined), 'audio/mp4', 'the default must be the real format');
});

test('a video container is never sent for an audio payload', () => {
  assert.equal(normalizeAudioMimeType('video/mp4'), 'audio/mp4');
  assert.equal(normalizeAudioMimeType('video/webm'), 'audio/webm');
});

test('an unknown container degrades to octet-stream rather than a guess', () => {
  // Claiming a container we cannot confirm would be rejected for the wrong
  // reason; this value is on the provider's list precisely for unknown payloads.
  assert.equal(normalizeAudioMimeType('application/x-unknown-container'), 'application/octet-stream');
});

test('the file extension matches the normalised type', () => {
  // A mismatch here mislabels the upload even when the MIME type is correct.
  const cases = [
    ['audio/mp4', 'm4a'],
    ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/ogg', 'ogg'],
    ['audio/wav', 'wav'],
    ['audio/mpeg', 'mp3'],
    ['audio/aac', 'aac'],
    ['audio/flac', 'flac'],
    ['audio/amr', 'amr'],
  ];
  for (const [mime, expected] of cases) {
    assert.equal(audioFileExtension(mime), expected, `${mime} should be .${expected}`);
  }
});

test('every offered language is one the server accepts', () => {
  // An option the transcribe route rejects would fail only once the user tried
  // it, in their own language, with an opaque provider error.
  for (const language of VOICE_LANGUAGES) {
    assert.ok(
      ASR_LANGUAGES.includes(language.code),
      `${language.code} is offered but not accepted by the server`
    );
  }
});

test('every offered language has a voice and a native name', () => {
  for (const language of VOICE_LANGUAGES) {
    assert.ok(language.speaker, `${language.code} has no voice`);
    assert.ok(language.nativeName, `${language.code} has no native name`);
    assert.ok(language.name, `${language.code} has no English name`);
  }
});

test('no dead voice is offered', () => {
  // `meera` is not a bulbul:v3 voice; it shipped as a default and made every
  // speakerless request fail with an opaque 400.
  const dead = ['meera', 'arjun', 'ananya'];
  for (const language of VOICE_LANGUAGES) {
    assert.ok(!dead.includes(language.speaker), `${language.speaker} is not a bulbul:v3 voice`);
  }
});

test('language codes are unique', () => {
  const seen = new Set();
  for (const language of VOICE_LANGUAGES) {
    assert.ok(!seen.has(language.code), `${language.code} is listed twice`);
    seen.add(language.code);
  }
});
