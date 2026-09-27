/**
 * Human labels for cached-data age.
 *
 * Split out of `offline/cache.ts` because that module imports AsyncStorage,
 * which cannot load under `node --test`. The label logic is the part with edge
 * cases worth testing (boundaries, clock skew, an unset timestamp); the storage
 * wrapper around it is not.
 */

/** Label for how old a cached value is, or '' when there is no timestamp. */
export function freshness(at: number | null, now: number = Date.now()): string {
  if (!at) return '';

  const minutes = Math.floor((now - at) / 60_000);

  // A timestamp in the future means the device clock moved, or the server and
  // device disagree. "just now" is the honest answer; "-3m ago" is not.
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
