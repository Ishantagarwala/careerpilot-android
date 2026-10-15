import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Mic, Square, X, Play, AlertCircle, Send } from 'lucide-react-native';

import { Sheet } from './primitives/Sheet';
import { usePalette } from '../theme/ThemeContext';
import { VOICE_LANGUAGES, type VoiceLanguage } from '../api/voice';
import type { VoicePhase } from '../voice/voiceMachine';

export interface VoiceHUDProps {
  visible: boolean;
  /**
   * Whether replies are read aloud, from the Me screen's preference.
   *
   * Shown so the setting is visible where it applies. It was previously
   * persisted and never read, so the switch changed nothing.
   */
  speakReplies?: boolean;
  phase: VoicePhase;
  label: string;
  error?: string | null;
  transcript: string;
  busy: boolean;
  language: VoiceLanguage;
  onLanguageChange: (language: VoiceLanguage) => void;
  onToggleRecording: () => void;
  onTranscriptChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * The voice session sheet.
 *
 * Deliberate differences from the web HUD, each for a reason found while
 * building this:
 *
 *  - `error` is rendered as text. On the web the error state replaced the
 *    microphone button with an inert coloured circle and showed no message, so
 *    a failure removed the control and explained nothing.
 *  - The microphone button is present in EVERY phase, including `error`, so a
 *    failure is always recoverable by tapping again.
 *  - The status line is a single `accessibilityLiveRegion` element, so a screen
 *    reader announces listening/transcribing/error transitions. The web app had
 *    no live regions at all.
 *  - Only the languages the transcribe route accepts are offered, so an option
 *    can never be selected that the server would reject.
 */
export function VoiceHUD({
  visible,
  speakReplies = true,
  phase,
  label,
  error,
  transcript,
  busy,
  language,
  onLanguageChange,
  onToggleRecording,
  onTranscriptChange,
  onSubmit,
  onCancel,
}: VoiceHUDProps) {
  const palette = usePalette('hub');
  const styles = makeStyles(palette);

  const isRecording = phase === 'recording';
  const isSpeaking = phase === 'speaking';
  const isError = phase === 'error';
  const showSpinner = phase === 'transcribing' || phase === 'thinking' || phase === 'requesting-permission';
  const canSend = transcript.trim().length > 0 && !busy;

  return (
    <Sheet visible={visible} onClose={onCancel} title="Voice">
      <View style={styles.body}>
        {/* Language. Restricted to what the server accepts. */}
        <View style={styles.langRow}>
          {VOICE_LANGUAGES.map((option) => {
            const active = option.code === language.code;
            return (
              <Pressable
                key={option.code}
                onPress={() => onLanguageChange(option)}
                disabled={isRecording}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.name}${active ? ', selected' : ''}`}
                style={[styles.langChip, active && styles.langChipActive]}
              >
                <Text style={[styles.langText, active && styles.langTextActive]}>
                  {option.nativeName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Status. `accessibilityLiveRegion` announces every phase change. */}
        <View style={styles.statusRow}>
          {showSpinner ? (
            <ActivityIndicator size="small" color={palette.muted} />
          ) : (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: isError
                    ? palette.danger
                    : isRecording
                      ? palette.danger
                      : isSpeaking
                        ? palette.primary
                        : palette.muted,
                },
              ]}
            />
          )}
          <Text
            style={[styles.status, isError && { color: palette.danger }]}
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
          >
            {error || label}
          </Text>
        </View>

        {/* The transcript, editable before sending. */}
        <Text style={styles.fieldLabel}>You said</Text>
        <TextInput
          value={transcript}
          onChangeText={onTranscriptChange}
          placeholder="Speak, or type here — you can edit before sending."
          placeholderTextColor={palette.muted}
          multiline
          accessibilityLabel="Your spoken words, editable"
          style={styles.input}
        />

        {/* Controls. The mic is always available, in every phase. */}
        <View style={styles.controls}>
          <Pressable
            onPress={onToggleRecording}
            disabled={busy && !isRecording && !isError}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? 'Stop recording' : isError ? 'Try recording again' : 'Start recording'
            }
            style={[
              styles.micButton,
              isRecording && { backgroundColor: palette.danger },
              busy && !isRecording && !isError && styles.disabled,
            ]}
          >
            {isError ? (
              <AlertCircle size={22} color={palette.primaryForeground} strokeWidth={2} />
            ) : isRecording ? (
              <Square size={20} color={palette.primaryForeground} strokeWidth={2} fill={palette.primaryForeground} />
            ) : (
              <Mic size={22} color={palette.primaryForeground} strokeWidth={2} />
            )}
          </Pressable>

          <Pressable
            onPress={onSubmit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send spoken message"
            accessibilityState={{ disabled: !canSend }}
            style={[styles.sendButton, !canSend && styles.disabled]}
          >
            <Send size={17} color={palette.primaryForeground} strokeWidth={2} />
            <Text style={styles.sendText}>Send</Text>
          </Pressable>

          {isSpeaking && (
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Stop speaking"
              style={styles.secondaryButton}
            >
              <Play size={15} color={palette.text} strokeWidth={2} />
              <Text style={styles.secondaryText}>Stop</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Close voice session"
            style={styles.secondaryButton}
          >
            <X size={15} color={palette.text} strokeWidth={2} />
            <Text style={styles.secondaryText}>Close</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {isRecording
            ? 'Recording — tap the square to finish, or just stop talking.'
            : speakReplies
              ? 'The assistant replies out loud. Turn that off in Me → Voice replies.'
              : 'Voice replies are off, so answers stay silent. Turn them on in Me.'}
        </Text>
      </View>
    </Sheet>
  );
}

type Palette = ReturnType<typeof usePalette>;

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    body: { paddingTop: 4, gap: 14 },
    langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    langChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      backgroundColor: palette.surface,
    },
    langChipActive: { backgroundColor: palette.strong, borderColor: palette.strong },
    langText: { fontSize: 12, color: palette.muted },
    langTextActive: { color: palette.primaryForeground, fontWeight: '600' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    status: { fontSize: 13.5, color: palette.text, flexShrink: 1 },
    fieldLabel: {
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: palette.muted,
      fontWeight: '700',
    },
    input: {
      minHeight: 84,
      maxHeight: 160,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      backgroundColor: palette.surface,
      padding: 12,
      fontSize: 15,
      color: palette.text,
      textAlignVertical: 'top',
    },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    micButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
    },
    sendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 18,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.primary,
    },
    sendText: { color: palette.primaryForeground, fontWeight: '700', fontSize: 14.5 },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.line,
      backgroundColor: palette.surface,
    },
    secondaryText: { color: palette.text, fontWeight: '600', fontSize: 14 },
    disabled: { opacity: 0.45 },
    hint: { fontSize: 12, color: palette.muted, lineHeight: 17 },
  });
}
