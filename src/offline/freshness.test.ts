import assert from 'node:assert/strict';
import { test } from 'node:test';

import { freshness } from './freshness.ts';

/**
 * Cache-age labels.
 *
 * The boundaries are the point: an off-by-one here shows a user "60m ago"
 * instead of "1h ago", or worse "-1m ago" when their clock and the server
 * disagree. `now` is injected so these are deterministic rather than flaky.
 */

const NOW = 1_700_000_000_000; // fixed instant
const MIN = 60_000;
const HOUR = 60 * MIN;

test('no timestamp yields no label', () => {
  // A value cached before timestamps existed, or a write that failed.
  assert.equal(freshness(null, NOW), '');
});

test('zero is treated as absent, not as 1970', () => {
  // `if (!at)` rather than `if (at === null)`: 0 would otherwise render as
  // "33600000m ago".
  assert.equal(freshness(0, NOW), '');
});

test('under a minute is "just now"', () => {
  assert.equal(freshness(NOW, NOW), 'just now');
  assert.equal(freshness(NOW - 59_000, NOW), 'just now');
});

test('exactly one minute becomes "1m ago"', () => {
  assert.equal(freshness(NOW - MIN, NOW), '1m ago');
});

test('minutes roll over to hours at exactly 60', () => {
  assert.equal(freshness(NOW - 59 * MIN, NOW), '59m ago');
  assert.equal(freshness(NOW - 60 * MIN, NOW), '1h ago');
});

test('hours roll over to days at exactly 24', () => {
  assert.equal(freshness(NOW - 23 * HOUR - 59 * MIN, NOW), '23h ago');
  assert.equal(freshness(NOW - 24 * HOUR, NOW), '1d ago');
});

test('a future timestamp is clamped to "just now"', () => {
  // Device clock skew, or a server slightly ahead. "-2m ago" would be nonsense.
  assert.equal(freshness(NOW + 5 * MIN, NOW), 'just now');
  assert.equal(freshness(NOW + 3 * HOUR, NOW), 'just now');
});

test('large ages are reported in days, not weeks or months', () => {
  // Coarse on purpose: past a day, precision adds noise rather than clarity.
  assert.equal(freshness(NOW - 30 * 24 * HOUR, NOW), '30d ago');
  assert.equal(freshness(NOW - 365 * 24 * HOUR, NOW), '365d ago');
});

test('the default clock is the real one', () => {
  // Two calls with no injected `now` must not disagree about the recent past.
  assert.equal(freshness(Date.now() - 5 * MIN), '5m ago');
});
