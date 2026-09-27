/**
 * Server-sent-event frame parsing.
 *
 * Extracted from the transport so it can be tested without a device or network.
 * The subtle parts are all here rather than in the fetch call, which is exactly
 * why they are worth isolating:
 *
 *  - A multi-byte character split across two network chunks corrupts unless the
 *    decoder is told to stream. Releasing a decoder against half a character
 *    yields U+FFFD, which silently mangles non-ASCII replies.
 *  - A frame split across chunks must not be parsed until it is complete.
 *  - One chunk commonly contains several frames, or a partial trailing frame.
 *  - A malformed frame must be skipped, never fatal — one bad byte should not
 *    discard a reply that is otherwise fine.
 *
 * The wire format from app/api/ai-hub/chat/route.ts is `data: {json}\n\n`.
 */

export interface SseDataFrame {
  /** the raw payload after `data: `, whitespace-trimmed */
  data: string;
}

/** Incremental parser. Feed it chunks; it yields complete data payloads. */
export class SseFrameParser {
  private buffer = '';
  // `fatal: false` (the default) replaces undecodable bytes rather than
  // throwing; `stream: true` on each call is what prevents splitting a
  // character across chunk boundaries from corrupting it.
  private decoder = new TextDecoder();

  /** Feed one chunk. Returns every frame completed by this chunk. */
  push(chunk: Uint8Array): SseDataFrame[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    return this.drain(false);
  }

  /** Flush a trailing frame that arrived without its terminating blank line. */
  flush(): SseDataFrame[] {
    this.buffer += this.decoder.decode();
    const frames = this.drain(true);
    this.buffer = '';
    return frames;
  }

  private drain(includeTrailing: boolean): SseDataFrame[] {
    const frames: SseDataFrame[] = [];

    for (;;) {
      let boundary = this.buffer.indexOf('\n\n');
      if (boundary === -1) break;
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const frame = parseFrame(raw);
      if (frame) frames.push(frame);
    }

    if (includeTrailing && this.buffer.trim()) {
      const frame = parseFrame(this.buffer);
      if (frame) frames.push(frame);
    }

    return frames;
  }
}

/**
 * Pull the `data:` payload out of one raw frame.
 *
 * A frame may carry several field lines (event:, id:, retry:); we only read
 * `data:`, and multiple data lines are concatenated with newlines per the SSE
 * spec. `[DONE]` is a terminator, not a payload, so it is dropped.
 */
export function parseFrame(raw: string): SseDataFrame | null {
  const dataLines: string[] = [];

  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    // A single leading space after the colon is part of the framing, not data.
    const value = line.slice(5).replace(/^ /, '');
    dataLines.push(value);
  }

  if (!dataLines.length) return null;

  const data = dataLines.join('\n').trim();
  if (!data || data === '[DONE]') return null;

  return { data };
}

/** Parse a frame payload as JSON, returning null instead of throwing. */
export function parseJsonFrame<T>(frame: SseDataFrame): T | null {
  try {
    return JSON.parse(frame.data) as T;
  } catch {
    return null;
  }
}
