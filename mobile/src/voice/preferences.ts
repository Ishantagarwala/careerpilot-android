import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether assistant replies should be read aloud.
 *
 * The Me screen has always written this preference (`@careerpilot_voice_replies`)
 * and shown a switch for it, but nothing ever read it back — so the toggle
 * appeared to work and changed nothing. This is the single definition of the
 * key and the reader, so the writer and the reader cannot drift apart again.
 */
export const VOICE_REPLIES_KEY = '@careerpilot_voice_replies';

/** Default on: someone who opens a voice session probably wants to hear it. */
export const VOICE_REPLIES_DEFAULT = true;

export async function getVoiceRepliesEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(VOICE_REPLIES_KEY);
    if (stored === null) return VOICE_REPLIES_DEFAULT;
    return stored === 'on';
  } catch {
    // Storage unavailable — fall back rather than disabling the feature.
    return VOICE_REPLIES_DEFAULT;
  }
}

export async function setVoiceRepliesEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VOICE_REPLIES_KEY, enabled ? 'on' : 'off');
  } catch {
    // The switch still reflects the tap for this session.
  }
}
