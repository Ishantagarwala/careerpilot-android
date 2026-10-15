import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { File, Paths } from 'expo-file-system';

import {
  DEFAULT_VOICE_LANGUAGE,
  normalizeAudioMimeType,
  synthesizeSpeech,
  transcribeAudio,
  type VoiceLanguage,
} from '../api/voice';
import { chunkForSpeech, normalizeForSpeech } from '../voice/transcript';
import {
  initialVoiceState,
  isBusy,
  isMicrophoneActive,
  phaseLabel,
  voiceReducer,
  type VoicePhase,
} from '../voice/voiceMachine';

/**
 * The microphone ceiling, enforced by the recorder itself.
 *
 * The web recorder had no maximum duration, so a user who never spoke left the
 * microphone open indefinitely — its voice-activity detector only counted
 * silence *after* it had heard speech. `recordForDuration` is enforced natively,
 * which is more reliable than a JavaScript timer that a suspended app can miss.
 */
const MAX_RECORDING_SECONDS = 30;

export interface UseVoiceOptions {
  /** Fired with the final transcript when a turn should be sent. */
  onUtterance?: (text: string) => void;
  language?: VoiceLanguage;
}

export interface UseVoiceResult {
  phase: VoicePhase;
  label: string;
  error: string | null;
  transcript: string;
  setTranscript: (text: string) => void;
  busy: boolean;
  micActive: boolean;
  language: VoiceLanguage;
  setLanguage: (language: VoiceLanguage) => void;
  /** Start recording, or stop it if already recording. */
  toggleRecording: () => Promise<void>;
  /** Speak a reply, preferring the server voice and falling back to the device. */
  speak: (text: string) => Promise<void>;
  /** Stop audio and invalidate any in-flight work. */
  cancel: () => void;
  /** Submit the current transcript. */
  submit: () => void;
}

/**
 * Voice input and output for the mobile app.
 *
 * WHERE THIS DELIBERATELY DIFFERS FROM THE WEB
 *
 *   - There is no streaming `SpeechRecognition` on Android. A clip is recorded
 *     and uploaded, so the transcript arrives complete: there are no interim
 *     results to aggregate, and the web's worst defect in this area (interim
 *     text appended onto text that already contained it, corrupting every turn)
 *     cannot occur here.
 *   - Base64 audio is written to a cache file before playback, because React
 *     Native cannot play a `data:` URL the way a browser can.
 *   - Text-to-speech falls back to the device voice, so a provider failure
 *     sounds different rather than going silent.
 *
 * All guard state lives in the reducer in `src/voice/voiceMachine.ts`, which is
 * covered by tests asserting the exact malformed sequences that broke the web
 * implementation — a second START while recording, a permission grant arriving
 * after a cancel, and a turn settling after the user left.
 */
export function useVoice(options: UseVoiceOptions = {}): UseVoiceResult {
  const { onUtterance, language: languageOption } = options;

  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const [language, setLanguage] = useState<VoiceLanguage>(languageOption || DEFAULT_VOICE_LANGUAGE);

  // Created by hooks so their lifecycle is handled for us: both release
  // automatically on unmount, which is what stops the microphone being left
  // open by a navigation.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();

  const abortRef = useRef<AbortController | null>(null);
  /**
   * Set once the hook is torn down. Every continuation past an `await` checks it
   * before touching state, so a slow transcription cannot persist a message to a
   * screen the user has left.
   *
   * NOTE: cleared at the START of the effect, not only set on cleanup. React
   * StrictMode runs mount → cleanup → mount in development, and the web version
   * of this file set the flag true without ever resetting it — leaving the hook
   * permanently "dead" so that tapping record did nothing at all, with no error.
   */
  const unmountedRef = useRef(false);
  const onUtteranceRef = useRef(onUtterance);
  const languageRef = useRef(language);
  /** True only while this hook believes it is capturing. */
  const capturingRef = useRef(false);

  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      capturingRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      void Speech.stop();
    };
  }, []);

  /** Plays base64 audio by writing it to a cache file. */
  const playBase64 = useCallback(
    async (base64: string, mime: string): Promise<void> => {
      const extension = mime.includes('mpeg') || mime.includes('mp3') ? 'mp3' : 'wav';
      const file = new File(Paths.cache, `careerpilot-reply.${extension}`);

      if (file.exists) file.delete();
      file.create();
      file.write(base64, { encoding: 'base64' });

      player.replace({ uri: file.uri });
      player.play();

      /*
       * Resolve when playback stops. `playing` is also false before playback
       * begins, hence the elapsed-time guard — without it this would resolve
       * immediately and the caller would resume listening over its own reply.
       */
      await new Promise<void>((resolve) => {
        const startedAt = Date.now();
        const poll = setInterval(() => {
          if (unmountedRef.current) {
            clearInterval(poll);
            resolve();
            return;
          }
          if (!player.playing && Date.now() - startedAt > 400) {
            clearInterval(poll);
            resolve();
          }
        }, 120);
      });
    },
    [player]
  );

  /** The device voice, used when the server voice is unavailable. */
  const speakWithDevice = useCallback(async (text: string, code: string): Promise<void> => {
    await Speech.stop();
    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: code,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const speakable = normalizeForSpeech(text);
      if (!speakable) return;

      dispatch({ type: 'SPEAK_START' });
      // Chunked at the server's real limit (2,500 characters), so a long reply
      // is spoken rather than refused.
      const chunks = chunkForSpeech(speakable, 2500);

      try {
        for (const chunk of chunks) {
          if (unmountedRef.current) return;
          const { audio, mime } = await synthesizeSpeech({
            text: chunk,
            languageCode: languageRef.current.code,
            speaker: languageRef.current.speaker,
          });
          if (unmountedRef.current) return;
          await playBase64(audio, mime);
        }
      } catch (error) {
        // Degrade to the device voice. The point of the fallback is that a
        // provider failure sounds different, not silent.
        console.warn('Server speech failed; using the device voice:', error);
        if (!unmountedRef.current) {
          await speakWithDevice(speakable, languageRef.current.code).catch((e) =>
            console.warn('Device speech also failed:', e)
          );
        }
      } finally {
        if (!unmountedRef.current) dispatch({ type: 'SETTLED' });
      }
    },
    [playBase64, speakWithDevice]
  );

  const stopRecording = useCallback(async () => {
    if (!capturingRef.current) return;
    capturingRef.current = false;
    dispatch({ type: 'STOP' });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch (error) {
      console.warn('Stopping the recorder failed:', error);
    }

    if (!uri) {
      dispatch({ type: 'HEARD_NOTHING' });
      return;
    }

    try {
      const text = await transcribeAudio({
        uri,
        /*
         * expo-audio records `.m4a` (AAC in MP4) on Android, which the server
         * accepts as `audio/mp4`. Normalisation strips any `;codecs=` parameter:
         * forwarding one is what broke transcription on the web, because the
         * provider validates the container and rejects the longer string.
         */
        mimeType: normalizeAudioMimeType('audio/mp4'),
        languageCode: languageRef.current.code,
        signal: controller.signal,
      });

      if (unmountedRef.current) return;

      dispatch({ type: 'TRANSCRIBE_DONE', text });
      if (text) {
        onUtteranceRef.current?.(text);
      } else {
        // Silence is a normal outcome, not a failure.
        dispatch({ type: 'HEARD_NOTHING' });
      }
    } catch (error: any) {
      if (unmountedRef.current) return;
      if (error?.name === 'AbortError') {
        dispatch({ type: 'HEARD_NOTHING' });
        return;
      }
      dispatch({
        type: 'FAILED',
        message: error?.message || 'Could not transcribe that. Try again.',
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [recorder]);

  const startRecording = useCallback(async () => {
    /*
     * The reducer ignores a START while capture is owned — the guard whose
     * absence let a second recorder open a second microphone stream while the
     * first was never stopped. `capturingRef` mirrors it for these async paths.
     */
    if (capturingRef.current) return;
    capturingRef.current = true;
    dispatch({ type: 'START' });

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        capturingRef.current = false;
        dispatch({
          type: 'FAILED',
          message: 'Microphone blocked. Allow access in Settings to use voice.',
        });
        return;
      }

      // The user may have cancelled while the permission dialog was open.
      if (unmountedRef.current || !capturingRef.current) return;
      dispatch({ type: 'PERMISSION_GRANTED' });

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (unmountedRef.current || !capturingRef.current) return;

      // A native ceiling, so a silent user cannot hold the microphone open.
      recorder.recordForDuration(MAX_RECORDING_SECONDS);
      dispatch({ type: 'RECORDING_STARTED' });
    } catch (error: any) {
      capturingRef.current = false;
      dispatch({
        type: 'FAILED',
        message: error?.message || 'Could not start recording.',
      });
    }
  }, [recorder]);

  const toggleRecording = useCallback(async () => {
    if (state.phase === 'recording') {
      await stopRecording();
      return;
    }
    if (isBusy(state)) return;
    await startRecording();
  }, [startRecording, state, stopRecording]);

  const cancel = useCallback(() => {
    capturingRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    void Speech.stop();
    try {
      if (recorder.isRecording) void recorder.stop();
    } catch {
      /* ignore */
    }
    dispatch({ type: 'CANCEL' });
  }, [recorder]);

  const submit = useCallback(() => {
    const text = state.transcript.trim();
    if (!text) return;
    onUtteranceRef.current?.(text);
  }, [state.transcript]);

  const setTranscript = useCallback((text: string) => {
    dispatch({ type: 'SET_TRANSCRIPT', text });
  }, []);

  const label = useMemo(() => phaseLabel(state), [state]);

  return {
    phase: state.phase,
    label,
    error: state.error,
    transcript: state.transcript,
    setTranscript,
    busy: isBusy(state),
    micActive: isMicrophoneActive(state),
    language,
    setLanguage,
    toggleRecording,
    speak,
    cancel,
    submit,
  };
}
