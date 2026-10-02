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
 * WHICH MODULE
 *
 * `@expo/app-integrity` (Expo SDK 57), which wraps Play Integrity's STANDARD
 * request flow. It is still flagged alpha upstream, so expect breaking changes
 * between SDK releases.
 *
 * The plan this file originally carried said to install `expo-play-integrity`.
 * That package does not exist on npm — the line is gone rather than left to
 * 404 for whoever tries it next.
 *
 * THREE THINGS ARE REQUIRED, AND NONE OF THEM IS SUFFICIENT ALONE
 *
 *   1. `EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER` set to the Cloud project
 *      NUMBER (not the project id). Not a secret; it ships in the binary.
 *   2. The Cloud project linked to the Play app — Play Console → Test and
 *      release → App integrity → Play Integrity API → Link Cloud project.
 *   3. Standard requests enabled for that link.
 *
 * The server needs PLAY_INTEGRITY_* configured as well (design/API_CONTRACT.md
 * §1.2). Until it is, the server stays fail-closed and refuses mobile sign-in
 * no matter how healthy this module is.
 */

/** Cloud project number from Google Cloud; required by the Integrity API. */
const CLOUD_PROJECT_NUMBER = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER ?? '';

/**
 * Escape hatch: skip attestation entirely and use the captcha gate instead.
 *
 * Play Integrity only returns PLAY_RECOGNIZED for builds INSTALLED FROM GOOGLE
 * PLAY, and it needs a Play Console listing to link the Cloud project to. This
 * app is distributed as a sideloaded APK, so the verdict can never be positive.
 * Without this switch the client would send an integrity token, the server
 * prefers that over a captcha, and the refusal would be unanswerable.
 *
 * Set EXPO_PUBLIC_PLAY_INTEGRITY_DISABLED=1 to send no token and let the server
 * fall through to hCaptcha. Remove it once the app ships through Play.
 */
const DISABLED = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_DISABLED === '1';

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
  if (DISABLED) {
    return {
      available: false,
      reason:
        'This build confirms you are a person with a quick captcha instead of a Play Integrity check.',
    };
  }
  if (!CLOUD_PROJECT_NUMBER) {
    return {
      available: false,
      reason:
        'This build has no Play Integrity project configured, so CareerPilot cannot verify it.',
    };
  }
  return { available: true };
}

/**
 * The `requestHash` sent with the standard request.
 *
 * Play Integrity requires one and echoes it back inside the verdict, so the
 * caller can confirm the token was minted for the request it is answering.
 *
 * Fixed on purpose: the server neither issues nor checks a nonce today
 * (design/API_CONTRACT.md §1.2). A random client-chosen value that nobody
 * verifies would look like replay protection without being any. When the server
 * starts issuing nonces, pass one in — that is what makes a captured token
 * unusable a second time.
 */
export const DEFAULT_REQUEST_HASH = 'Y2FyZWVycGlsb3Qtc2lnbmluLXYx';

/**
 * The prepared token provider, memoised for the process.
 *
 * Google expects `prepareIntegrityTokenProviderAsync` to run once — at launch
 * or ahead of the first check — not per request. A failed preparation is cleared
 * so one transient error does not disable sign-in until the app restarts.
 */
let providerReady: Promise<void> | null = null;

function prepareProvider(): Promise<void> {
  if (providerReady) return providerReady;

  const attempt = (async () => {
    const AppIntegrity = await import('@expo/app-integrity');
    await AppIntegrity.prepareIntegrityTokenProviderAsync(CLOUD_PROJECT_NUMBER);
  })();

  providerReady = attempt;
  void attempt.catch(() => {
    if (providerReady === attempt) providerReady = null;
  });
  return attempt;
}

/**
 * Obtain a Play Integrity token, or null when unavailable.
 *
 * Never throws: a failure here is a normal outcome that must surface as an
 * explanation, not an unhandled rejection. Null makes the sign-in path report
 * that the device could not be attested, which is the same shape the server's
 * own refusal takes.
 *
 * The native module is imported lazily so it is only pulled in when a sign-in is
 * actually attempted — the same reason `expo/fetch` is imported lazily in
 * api/chat.ts. It also keeps the Jest environment, which has no native module,
 * from loading it at all.
 */
export async function obtainIntegrityToken(
  requestHash: string = DEFAULT_REQUEST_HASH,
): Promise<string | null> {
  // Returning null is what routes the sign-in to the captcha path.
  if (DISABLED || !CLOUD_PROJECT_NUMBER) return null;

  try {
    await prepareProvider();
    const AppIntegrity = await import('@expo/app-integrity');
    const token = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
    return token || null;
  } catch {
    // An unlinked Cloud project, standard requests not enabled, a device that
    // cannot attest, a Google outage — indistinguishable here, and all of them
    // mean "no token". The caller turns that into one clear sentence.
    return null;
  }
}
