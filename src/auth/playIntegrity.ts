/**
 * Play Integrity attestation for the Android client.
 *
 * WHY THIS IS NOT A CAPTCHA
 *
 * Every sign-in path on the server runs bot verification and hard-fails when it
 * cannot verify. hCaptcha is a web widget that cannot run in a native app, so
 * without this **no Android client can ever sign in**. Play Integrity is
 * strictly stronger: it attests that the request came from a genuine,
 * unmodified build of this app on a device passing Google's integrity checks.
 * See design/API_CONTRACT.md §1.2.
 *
 * STATUS
 *
 * The native module is NOT yet installed. `obtainIntegrityToken` therefore
 * returns null and sign-in fails with an explanation rather than a cryptic
 * server rejection.
 *
 * To finish this, add the module and prepare the request with the Cloud project
 * number:
 *
 *   npx expo install expo-play-integrity
 *
 * then implement `prepare()` below. Server-side configuration is required too
 * (PLAY_INTEGRITY_* in the web deployment's .env.production) — installing the
 * client module alone will not make sign-in work.
 */

/** Cloud project number from Google Cloud; required by the Integrity API. */
const CLOUD_PROJECT_NUMBER = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER ?? '';

export interface IntegrityAvailability {
  available: boolean;
  /** why not, in words the sign-in screen can show the user */
  reason?: string;
}

/**
 * Whether this build can produce an attestation token.
 *
 * Checked before attempting sign-in so the user gets one clear explanation
 * instead of a round trip that ends in the server's refusal.
 */
export function integrityStatus(): IntegrityAvailability {
  if (!CLOUD_PROJECT_NUMBER) {
    return {
      available: false,
      reason:
        'This build has no Play Integrity project configured, so CareerPilot cannot verify it.',
    };
  }
  return { available: false, reason: NOT_INSTALLED };
}

const NOT_INSTALLED =
  'Device attestation is not wired up in this build yet, so sign-in is unavailable.';

/**
 * Obtain a Play Integrity token, or null when unavailable.
 *
 * Never throws: a failure here is a normal outcome that must surface as an
 * explanation, not an unhandled rejection.
 *
 * A `nonce` bound to the request would harden this further by making a captured
 * token unusable for a replay. The server currently does not issue or verify
 * one, so it is not passed — adding a nonce on the client alone would be
 * security theatre.
 */
export async function obtainIntegrityToken(): Promise<string | null> {
  return null;
}
