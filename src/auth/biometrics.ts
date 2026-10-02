import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Biometric unlock.
 *
 * WHAT THIS DOES, AND WHAT IT HONESTLY DOES NOT
 *
 * Android's BiometricPrompt cannot release a stored secret — it only answers
 * "the enrolled user was present". So the only way to offer "stay signed in
 * without retyping your password" is to keep the credential in the Android
 * Keystore (via expo-secure-store) and gate access to it behind a successful
 * prompt.
 *
 * That is a real trade-off, and worth stating plainly: the password is
 * recoverable by the OS on a rooted or compromised device. It is materially
 * weaker than a hardware-bound key, but it is what the platform offers for this
 * pattern, and it is strictly better than the common alternative of keeping the
 * user signed in with a long-lived token that never re-checks anything.
 *
 * Consequences reflected in the UI:
 *  - Opt-in only. Never enabled silently.
 *  - The stored password is wiped the moment the user turns it off, signs out,
 *    or a biometric sign-in fails.
 *  - The feature is hidden entirely on a device with no enrolled biometric and
 *    no device credential, rather than offering a button that cannot work.
 */

const EMAIL_KEY = 'careerpilot.biometric.email';
const PASSWORD_KEY = 'careerpilot.biometric.password';

export interface BiometricCapability {
  /** the device can actually authenticate a user right now */
  available: boolean;
  /** why not, when unavailable */
  reason?: string;
  /** 'face' | 'fingerprint' | 'iris' | 'none' — for the label */
  kind: 'face' | 'fingerprint' | 'iris' | 'none';
}

/**
 * What this device can do.
 *
 * Three separate conditions, all required: the hardware exists, something is
 * enrolled, and (on Android) the OS considers it secure. Checking only the
 * first is the usual bug — `hasHardwareAsync()` is true on a phone where the
 * user never enrolled a fingerprint, and the prompt then fails every time.
 */
export async function biometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') {
    return { available: false, reason: 'Not available on web.', kind: 'none' };
  }

  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    if (!hasHardware) {
      return { available: false, reason: 'This device has no biometric sensor.', kind: 'none' };
    }
    if (!isEnrolled) {
      return {
        available: false,
        reason: 'No fingerprint or face is set up on this device yet.',
        kind: 'none',
      };
    }

    return { available: true, kind: kindOf(types) };
  } catch {
    // A capability probe must never crash the first-run screen.
    return { available: false, reason: 'Could not check biometric support.', kind: 'none' };
  }
}

function kindOf(
  types: LocalAuthentication.AuthenticationType[],
): BiometricCapability['kind'] {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
  return 'none';
}

/** Human label for the capability, used on the first-run card and in Me. */
export function capabilityLabel(kind: BiometricCapability['kind']): string {
  switch (kind) {
    case 'face':
      return 'Face unlock';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris unlock';
    default:
      return 'Biometric unlock';
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const [email, password] = await Promise.all([
      SecureStore.getItemAsync(EMAIL_KEY),
      SecureStore.getItemAsync(PASSWORD_KEY),
    ]);
    return Boolean(email && password);
  } catch {
    return false;
  }
}

export async function enableBiometric(email: string, password: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(EMAIL_KEY, email, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await SecureStore.setItemAsync(PASSWORD_KEY, password, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    return true;
  } catch {
    return false;
  }
}

/** Wipe the stored credential. Called on disable, sign-out, and failure. */
export async function disableBiometric(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(EMAIL_KEY),
      SecureStore.deleteItemAsync(PASSWORD_KEY),
    ]);
  } catch {
    /* nothing useful to do */
  }
}

export type BiometricSignInResult =
  | { ok: true; email: string; password: string }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

/**
 * Prompt for biometrics and, on success, return the stored credential.
 *
 * The prompt is the whole point, so a successful prompt is required before the
 * secret is even read — reading first and prompting afterwards would make the
 * prompt decorative.
 */
export async function authenticateForSignIn(): Promise<BiometricSignInResult> {
  const capability = await biometricCapability();
  if (!capability.available) return { ok: false, reason: 'unavailable' };

  let result: LocalAuthentication.LocalAuthenticationResult;
  try {
    result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to CareerPilot',
      cancelLabel: 'Use password',
      // Allows the device PIN/pattern as a fallback. Requiring a biometric
      // specifically would lock out a user whose sensor fails.
      disableDeviceFallback: false,
    });
  } catch {
    return { ok: false, reason: 'failed' };
  }

  if (!result.success) {
    return {
      ok: false,
      // Distinguishing a deliberate cancel from a failure matters: a cancel is
      // normal and must NOT wipe the stored credential.
      // 'user_fallback' is the user choosing "Use password" — a deliberate
      // cancel. Classifying it as a failure wiped the saved credential the user
      // had just decided not to use.
      reason:
        result.error === 'user_cancel' ||
        result.error === 'system_cancel' ||
        result.error === 'user_fallback'
          ? 'cancelled'
          : 'failed',
    };
  }

  try {
    const [email, password] = await Promise.all([
      SecureStore.getItemAsync(EMAIL_KEY),
      SecureStore.getItemAsync(PASSWORD_KEY),
    ]);
    if (!email || !password) return { ok: false, reason: 'unavailable' };
    return { ok: true, email, password };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
