import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseFrame, parseJsonFrame, SseFrameParser, type SseDataFrame } from './sse.ts';

/**
 * These tests cover the parts of the SSE transport that a device would
 * otherwise be the first to exercise: chunk boundaries landing mid-character or
 * mid-frame, several frames in one chunk, and malformed input.
 *
 * The wire contract is app/api/ai-hub/chat/route.ts — `data: {json}\n\n`.
 */

const enc = (s: string) => new TextEncoder().encode(s);

test('parses a single complete frame', () => {
  const p = new SseFrameParser();
  const frames = p.push(enc('data: {"type":"token","content":"Hi"}\n\n'));
  assert.equal(frames.length, 1);
  assert.deepEqual(parseJsonFrame(frames[0]!), { type: 'token', content: 'Hi' });
});

test('parses several frames from one chunk', () => {
  const p = new SseFrameParser();
  const frames = p.push(
    enc(
      'data: {"type":"token","content":"a"}\n\n' +
        'data: {"type":"token","content":"b"}\n\n' +
        'data: {"type":"done","reply":"ab"}\n\n',
    ),
  );
  assert.equal(frames.length, 3);
  assert.equal((parseJsonFrame<{ content: string }>(frames[1]!) ?? {}).content, 'b');
});

test('holds a partial frame until its terminator arrives', () => {
  const p = new SseFrameParser();
  assert.equal(p.push(enc('data: {"type":"tok')).length, 0);
  assert.equal(p.push(enc('en","content":"split"}')).length, 0);

  const frames = p.push(enc('\n\n'));
  assert.equal(frames.length, 1);
  assert.deepEqual(parseJsonFrame(frames[0]!), { type: 'token', content: 'split' });
});

test('a frame split mid-JSON across many chunks still parses', () => {
  const p = new SseFrameParser();
  const payload = 'data: {"type":"done","reply":"hello world","reasoning":""}\n\n';
  // Typed as frames, not strings: parseJsonFrame takes a frame object, and
  // accumulating `.data` here would silently hand it a string (which JSON.parse
  // rejects) rather than failing to compile.
  const frames: SseDataFrame[] = [];
  // Byte-at-a-time is the worst case a network stack can produce.
  for (const byte of enc(payload)) {
    for (const f of p.push(new Uint8Array([byte]))) frames.push(f);
  }
  assert.equal(frames.length, 1);
  assert.deepEqual(parseJsonFrame(frames[0]!), {
    type: 'done',
    reply: 'hello world',
    reasoning: '',
  });
});

test('decodes multi-byte characters split across chunk boundaries', () => {
  // The bug this guards: without `{ stream: true }` the decoder emits U+FFFD
  // for each half of a split character, mangling non-ASCII replies.
  const p = new SseFrameParser();
  // ₹ is E2 82 B9 (3 bytes); ✨ is 4 bytes. Both straddle the cut below.
  const payload = 'data: {"type":"token","content":"₹1,200 ✨"}\n\n';
  const bytes = enc(payload);
  const cut = bytes.indexOf(0xe2) + 1; // land mid-₹

  const first = p.push(bytes.slice(0, cut));
  const second = p.push(bytes.slice(cut));
  assert.equal(first.length, 0);

  const frames = [...second];
  assert.equal(frames.length, 1);
  const parsed = parseJsonFrame<{ content: string }>(frames[0]!);
  assert.equal(parsed?.content, '₹1,200 ✨');
  assert.ok(!parsed?.content.includes('\uFFFD'), 'must not contain replacement chars');
});

test('skips a malformed frame but keeps the good ones', () => {
  const p = new SseFrameParser();
  const frames = p.push(
    enc(
      'data: {"type":"token","content":"ok"}\n\n' +
        'data: {not json]\n\n' +
        'data: {"type":"token","content":"still ok"}\n\n',
    ),
  );
  assert.equal(frames.length, 3);
  assert.equal(parseJsonFrame(frames[1]!), null);
  assert.deepEqual(parseJsonFrame(frames[2]!), { type: 'token', content: 'still ok' });
});

test('flush recovers a frame with no trailing blank line', () => {
  const p = new SseFrameParser();
  assert.equal(p.push(enc('data: {"type":"done","reply":"tail"}')).length, 0);
  const frames = p.flush();
  assert.equal(frames.length, 1);
  assert.deepEqual(parseJsonFrame(frames[0]!), { type: 'done', reply: 'tail' });
});

test('flush is not confused by a newline-terminated but unblanked frame', () => {
  const p = new SseFrameParser();
  p.push(enc('data: {"type":"title","title":"Normalization"}\n'));
  const frames = p.flush();
  assert.equal(frames.length, 1);
  assert.deepEqual(parseJsonFrame(frames[0]!), { type: 'title', title: 'Normalization' });
});

test('ignores non-data fields and [DONE] terminators', () => {
  const p = new SseFrameParser();
  const frames = p.push(enc(': keep-alive comment\n\nevent: ping\n\n'));
  assert.equal(frames.length, 0);
  assert.equal(p.push(enc('data: [DONE]\n\n')).length, 0);
});

test('joins multiple data lines in one frame with a newline', () => {
  // The SSE spec concatenates repeated data fields; a JSON payload could be
  // pretty-printed across them.
  const frame = parseFrame('data: {"a":1,\ndata: "b":2}');
  assert.equal(frame?.data, '{"a":1,\n"b":2}');
});

test('frames several CRLF-delimited events while streaming', () => {
  // The regression this guards: the boundary search only knew "\n\n", so CRLF
  // frames emitted nothing during the stream and collapsed into one blob at
  // flush — an empty reply with no error to explain it.
  const p = new SseFrameParser();
  const frames = p.push(
    enc(
      'data: {"type":"token","content":"a"}\r\n\r\n' +
        'data: {"type":"token","content":"b"}\r\n\r\n' +
        'data: {"type":"done","reply":"ab"}\r\n\r\n',
    ),
  );
  assert.equal(frames.length, 3);
  assert.equal((parseJsonFrame<{ content: string }>(frames[1]!) ?? {}).content, 'b');
  assert.deepEqual(parseJsonFrame(frames[2]!), { type: 'done', reply: 'ab' });
});

test('a CRLF split across two chunks is not mistaken for a line ending', () => {
  // The CR arrives alone; it must be held rather than treated as a terminator.
  const p = new SseFrameParser();
  assert.equal(p.push(enc('data: {"type":"token","content":"x"}\r')).length, 0);
  const frames = p.push(enc('\n\r\n'));
  assert.equal(frames.length, 1);
  assert.equal((parseJsonFrame<{ content: string }>(frames[0]!) ?? {}).content, 'x');
});

test('tolerates CRLF line endings', () => {
  // Proxies rewrite line endings; the frame separator then becomes \r\n\r\n,
  // which contains \n\n only if the \r is trimmed. Assert current behaviour so
  // a regression is visible rather than silent.
  const p = new SseFrameParser();
  const frames = p.push(enc('data: {"type":"token","content":"crlf"}\r\n\r\n'));
  const recovered = frames.length ? frames : p.flush();
  assert.equal(recovered.length, 1);
  const parsed = parseJsonFrame<{ content: string }>(recovered[0]!);
  assert.equal(parsed?.content, 'crlf');
});

test('an empty payload is ignored rather than treated as a frame', () => {
  assert.equal(parseFrame('data: '), null);
  assert.equal(parseFrame('data:\n'), null);
  assert.equal(parseFrame(''), null);
});
