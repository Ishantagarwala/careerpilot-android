/**
 * Turning a failed response body into something worth showing a user.
 *
 * WHY THIS IS ITS OWN MODULE WITH ITS OWN TESTS
 *
 * This is where a single wrong assumption silently degraded every error message
 * in the app. The original implementation read only `body.error` — but every
 * route on the server answers `{ message }` (111 occurrences of `message`
 * against zero response-level `error` fields). So a specific, actionable server
 * message like "Please complete the captcha." was discarded and replaced with
 * "Request failed (400)".
 *
 * It is pure, so it is tested directly rather than through a screen — a
 * component test cannot cover the shapes this has to tolerate.
 */

/**
 * Best-effort human message from a failed response.
 *
 * Order matters: `message` first because that is the serverside contract, then
 * `error` for anything that predates it, then a plain-text body, then a status
 * code as the last resort.
 */
export function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;

    // The contract used by every api route.
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }

    // Tolerated for any endpoint that still returns the older shape.
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }

  // Some routes answer with bare text rather than JSON.
  if (typeof body === 'string' && body.trim()) {
    // Long HTML error pages make useless toasts; cap what reaches the UI.
    return body.length > 200 ? `${body.slice(0, 200)}…` : body;
  }

  return `Request failed (${status})`;
}
