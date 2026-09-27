import assert from 'node:assert/strict';
import { test } from 'node:test';

import { errorMessage } from './errorMessage.ts';

/**
 * The regression these guard is real and shipped.
 *
 * The original implementation read only `body.error`. Every route on the server
 * answers `{ message }`, so every failed request in the app showed
 * "Request failed (400)" instead of the reason — including "Please complete the
 * captcha.", which told the user nothing they could act on.
 */

test('reads `message`, the server contract', () => {
  assert.equal(errorMessage({ message: 'Please complete the captcha.' }, 400), 'Please complete the captcha.');
});

test('falls back to `error` for older shapes', () => {
  assert.equal(errorMessage({ error: 'Legacy field' }, 400), 'Legacy field');
});

test('prefers `message` when BOTH are present', () => {
  // `message` is the current contract; a response carrying both should not
  // resolve to the deprecated one.
  assert.equal(errorMessage({ message: 'Current', error: 'Old' }, 400), 'Current');
});

test('falls back to a status code when there is no usable field', () => {
  assert.equal(errorMessage({}, 500), 'Request failed (500)');
  assert.equal(errorMessage(null, 503), 'Request failed (503)');
  assert.equal(errorMessage(undefined, 404), 'Request failed (404)');
});

test('ignores non-string and blank fields rather than printing them', () => {
  // A nested object rendered into the UI would read as "[object Object]".
  assert.equal(errorMessage({ message: { nested: true } }, 400), 'Request failed (400)');
  assert.equal(errorMessage({ message: '   ' }, 400), 'Request failed (400)');
  assert.equal(errorMessage({ message: 42 }, 400), 'Request failed (400)');
  assert.equal(errorMessage({ error: null }, 400), 'Request failed (400)');
});

test('passes through a plain-text body', () => {
  assert.equal(errorMessage('Bad request.', 400), 'Bad request.');
});

test('truncates a long body instead of dumping it into the UI', () => {
  // A raw HTML error page in a toast is worse than a short message.
  const html = '<!DOCTYPE html>' + 'x'.repeat(5000);
  const result = errorMessage(html, 500);
  assert.ok(result.length <= 201, `expected truncated, got ${result.length} chars`);
  assert.ok(result.endsWith('…'));
});

test('ignores an empty or whitespace body', () => {
  assert.equal(errorMessage('', 400), 'Request failed (400)');
  assert.equal(errorMessage('   ', 400), 'Request failed (400)');
});

test('handles an array body without crashing', () => {
  assert.equal(errorMessage([1, 2, 3], 400), 'Request failed (400)');
});
