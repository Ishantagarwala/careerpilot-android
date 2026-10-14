/**
 * Reply parsers — the pure functions that turn a model reply into blocks the UI
 * can render.
 *
 * Kept OUT of study.ts on purpose: study.ts imports `expo/fetch` and
 * AsyncStorage, so nothing in it can run outside a device bundler. These
 * functions are the whole of the reply-rendering contract, so they live in a
 * dependency-free module and are covered by tests/replyParsers.test.mjs.
 *
 * The shapes they must handle are not invented — they are the ones
 * lib/aiHub.ts tells the model to emit:
 *
 *   ```mermaid   a diagram      (aiHub.ts "Diagrams")
 *   ```chart     JSON to plot   (aiHub.ts "Charts")
 *   ~~~file      JSON document  (aiHub.ts "Files (PDF / Word)")
 *   markdown     headings, lists, tables, code
 */

export type ReplyBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'code'; text: string; language?: string }
  /** A fenced ```mermaid block. Rendering is the caller's problem. */
  | { kind: 'mermaid'; text: string }
  /** A fenced ```chart block holding the JSON shape aiHub.ts specifies. */
  | { kind: 'chart'; spec: ChartSpec | null; raw: string }
  /** A ~~~file block — a document the model generated for download. */
  | { kind: 'file'; spec: GeneratedFileSpec | null; raw: string };

/** The chart payload from lib/aiHub.ts "Charts". */
export interface ChartSpec {
  type: 'bar' | 'line' | 'area' | 'pie';
  title?: string;
  data: Array<{ label: string; value: number }>;
}

/** The document payload from lib/aiHub.ts "Files (PDF / Word)". */
export interface GeneratedFileSpec {
  filename: string;
  format: 'pdf' | 'docx' | 'md';
  title?: string;
  markdown: string;
}

/**
 * An inline run inside a paragraph, bullet or heading.
 *
 * android-shared.css styles these inside a reply: `.reply code` is mono 13.5 on
 * --hub-soft, and the mockup sets key terms in bold (`<b>2NF</b>`,
 * `<em>whole</em>`). Without this the model's `**2NF**` renders as literal
 * asterisks.
 */
export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/**
 * Matches one emphasis / code span.
 *
 * The `(?=\S)` lookahead and `(?<=\S)` lookbehind on each marker are load
 * bearing. Without them the single-`*` and single-`_` alternatives match a
 * LONE marker and swallow everything up to the next one, which silently DELETES
 * text from the middle of a reply:
 *
 *   'Multiplication 2 * 3 = 6'  →  'Multiplication 2 3 = 6'
 *   'a * b * c'                 →  'a  b  c'
 *   'snake_case_name stays'     →  'snakecasename stays'
 *
 * Requiring a non-space immediately inside both markers also gives underscore
 * intraword protection, so identifiers survive verbatim — the same rule
 * remark-gfm applies on the web client.
 */
const INLINE_PATTERN =
  /(`[^`]+`)|(\*\*(?=\S)[\s\S]*?(?<=\S)\*\*)|(__(?=\S)[\s\S]*?(?<=\S)__)|(\*(?=\S)[^*\n]*?(?<=\S)\*)|(_(?=\S)[^_\n]*?(?<=\S)_)/g;

export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  // Fresh lastIndex per call — the pattern is module-level and stateful.
  INLINE_PATTERN.lastIndex = 0;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index) });
    }
    const token = match[0];
    if (match[1]) {
      runs.push({ text: token.slice(1, -1), code: true });
    } else if (match[2] || match[3]) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else {
      runs.push({ text: token.slice(1, -1), italic: true });
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor) });
  return runs.length ? runs : [{ text }];
}

/** Parses a ```chart payload, returning null rather than throwing on bad JSON. */
export function parseChartSpec(raw: string): ChartSpec | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    const type = String(parsed.type || '').toLowerCase();
    if (!['bar', 'line', 'area', 'pie'].includes(type)) return null;
    const data = parsed.data
      .map((d: any) => ({ label: String(d?.label ?? ''), value: Number(d?.value) }))
      .filter((d: any) => d.label && Number.isFinite(d.value));
    if (!data.length) return null;
    return {
      type: type as ChartSpec['type'],
      title: parsed.title ? String(parsed.title) : undefined,
      data,
    };
  } catch {
    return null;
  }
}

/** Parses a ~~~file payload, returning null rather than throwing on bad JSON. */
export function parseGeneratedFileSpec(raw: string): GeneratedFileSpec | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.markdown !== 'string') return null;
    const format = String(parsed.format || '').toLowerCase();
    if (!['pdf', 'docx', 'md'].includes(format)) return null;
    return {
      filename: String(parsed.filename || 'careerpilot-document'),
      format: format as GeneratedFileSpec['format'],
      title: parsed.title ? String(parsed.title) : undefined,
      markdown: parsed.markdown,
    };
  } catch {
    return null;
  }
}

export function parseMarkdownCodeBlocks(content: string): {
  mainText: string;
  codeBlocks: string[];
} {
  const codeRegex = /```[\w]*\n([\s\S]*?)```/g;
  const codeBlocks: string[] = [];
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    codeBlocks.push(match[1].trim());
  }

  const mainText = content.replace(codeRegex, '').trim();
  return { mainText, codeBlocks };
}

/**
 * Splits a reply into renderable blocks.
 *
 * Fences are handled before prose so a fence can never be mistaken for text.
 * Both fence styles are recognised: triple backticks (code, mermaid, chart) and
 * triple tildes (file) — aiHub.ts requires tildes for a document precisely
 * because the document's own markdown may contain backtick fences.
 *
 * Deliberately small and predictable: headings, bullets, fenced blocks and
 * paragraphs. Anything unrecognised stays prose rather than being dropped.
 *
 * KNOWN GAP (see docs/ai-hub-audit.md): GFM tables are not parsed — a table
 * currently renders as pipe-delimited text. Table support is a P1 item.
 */
export function parseReplyBlocks(content: string): ReplyBlock[] {
  if (!content.trim()) return [];

  const blocks: ReplyBlock[] = [];
  // Backtick fences, then tilde fences, in one pass so whichever appears first
  // in the reply wins. Groups: 1=backtick lang, 2=backtick body,
  // 3=tilde lang, 4=tilde body.
  const fence = /```([\w+-]*)\r?\n([\s\S]*?)```|~~~([\w+-]*)\r?\n([\s\S]*?)~~~/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushProse = (chunk: string) => {
    const lines = chunk.split('\n');
    let paragraph: string[] = [];
    let bullets: string[] = [];

    const flushParagraph = () => {
      const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ kind: 'paragraph', text });
      paragraph = [];
    };
    const flushBullets = () => {
      if (bullets.length) blocks.push({ kind: 'bullets', items: bullets });
      bullets = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushBullets();
        continue;
      }
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      if (heading) {
        flushParagraph();
        flushBullets();
        blocks.push({ kind: 'heading', text: heading[1].trim() });
        continue;
      }
      const bullet = /^[-*•]\s+(.*)$/.exec(line) || /^\d+[.)]\s+(.*)$/.exec(line);
      if (bullet) {
        flushParagraph();
        bullets.push(bullet[1].trim());
        continue;
      }
      flushBullets();
      paragraph.push(line);
    }
    flushParagraph();
    flushBullets();
  };

  while ((match = fence.exec(content)) !== null) {
    pushProse(content.slice(cursor, match.index));

    const isTilde = match[3] !== undefined;
    const lang = (isTilde ? match[3] : match[1] || '').toLowerCase();
    const body = (isTilde ? match[4] : match[2] || '').replace(/\n$/, '');

    if (lang === 'file') {
      blocks.push({ kind: 'file', spec: parseGeneratedFileSpec(body), raw: body });
    } else if (lang === 'mermaid') {
      blocks.push({ kind: 'mermaid', text: body });
    } else if (lang === 'chart') {
      blocks.push({ kind: 'chart', spec: parseChartSpec(body), raw: body });
    } else {
      blocks.push({ kind: 'code', text: body, language: lang || undefined });
    }

    cursor = match.index + match[0].length;
  }
  pushProse(content.slice(cursor));

  return blocks;
}
