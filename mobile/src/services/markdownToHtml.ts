/**
 * Markdown → standalone HTML, for turning a generated document into a PDF via
 * `expo-print`.
 *
 * The web client does this by rendering the reply to the DOM and screenshotting
 * it (html2canvas). React Native has no DOM, so `expo-print` is handed a
 * self-contained HTML string instead: it renders it in a headless WebView and
 * writes a real PDF. That means the styling has to live in this file.
 *
 * Deliberately small — it covers the markdown lib/aiHub.ts tells the model to
 * write into a `~~~file` block ("real headings, paragraphs, lists, tables and
 * code"). It is not a general markdown implementation; anything it does not
 * recognise is escaped and passed through as a paragraph, so nothing is ever
 * silently dropped from a document the student asked for.
 */

/** Escapes the five characters that would otherwise break out of text. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Inline spans: code, bold, italic, links. Applied to already-escaped text.
 *
 * The `(?=\S)` lookahead and `(?<=\S)` lookbehind are load bearing — see the
 * note on INLINE_PATTERN in `api/replyParsers.ts`. Without them a LONE `*` or
 * `_` opens an emphasis span that runs to the next marker, and because the
 * markers are consumed rather than emitted, the enclosed text is DELETED from
 * the PDF:
 *
 *   'Multiplication 2 * 3 = 6'  →  'Multiplication 2 3 = 6'
 *   'a * b * c'                 →  'a  b  c'
 *   'snake_case_name stays'     →  'snakecasename stays'
 *
 * This matters more here than in the chat: a printable document silently
 * dropping words is worse than an ugly one.
 */
const INLINE_BOLD = /\*\*(?=\S)[\s\S]*?(?<=\S)\*\*/g;
/**
 * Italic. `(?<!\*)` / `(?!\*)` stop a single-`*` pair from matching the TAILS of
 * a `**` run. Without them, `**unclosed bold and another * stray` pairs the
 * second `*` of the opener with the stray one and emits `<em></em>` — an empty
 * element where the text between them should be.
 */
const INLINE_EM_STAR = /(?<!\*)\*(?!\*)(?=\S)[^*\n]*?(?<=\S)\*(?!\*)/g;
const INLINE_EM_UNDER =
  /(?<![\w_])_(?!_)(?=\S)[^_\n]*?(?<=\S)_(?!_)(?![\w_])/g;

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(INLINE_BOLD, (m) => `<strong>${m.slice(2, -2)}</strong>`);
  out = out.replace(INLINE_EM_STAR, (m) => `<em>${m.slice(1, -1)}</em>`);
  out = out.replace(INLINE_EM_UNDER, (m) => `<em>${m.slice(1, -1)}</em>`);
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

/** True when the line is a GFM table separator (| --- | --- |). */
function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(line) && line.includes('-');
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function markdownToHtml(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const body: string[] = [];

  let i = 0;
  let inCode = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  /** 'ul' | 'ol' | null — a numbered list must not render as bullets. */
  let listTag: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listTag) {
      body.push(`</${listTag}>`);
      listTag = null;
    }
  };

  const flushCode = () => {
    if (inCode) {
      body.push(
        `<pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(
          codeBuffer.join('\n')
        )}</code></pre>`
      );
      inCode = false;
      codeBuffer = [];
      codeLang = '';
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // ---- fenced code ----
    const fence = /^```([\w+-]*)\s*$/.exec(line.trim());
    if (fence) {
      if (inCode) {
        flushCode();
      } else {
        closeList();
        inCode = true;
        codeLang = fence[1] || '';
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuffer.push(raw);
      i++;
      continue;
    }

    // ---- table ----
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableDivider(lines[i + 1])
    ) {
      closeList();
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      body.push('<table><thead><tr>');
      for (const cell of header) body.push(`<th>${inline(cell)}</th>`);
      body.push('</tr></thead><tbody>');
      for (const row of rows) {
        body.push('<tr>');
        for (const cell of row) body.push(`<td>${inline(cell)}</td>`);
        body.push('</tr>');
      }
      body.push('</tbody></table>');
      continue;
    }

    // ---- heading ----
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      closeList();
      const level = heading[1].length;
      body.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // ---- horizontal rule ----
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      closeList();
      body.push('<hr />');
      i++;
      continue;
    }

    // ---- blockquote ----
    if (/^\s*>\s?/.test(line)) {
      closeList();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      body.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // ---- list ----
    const unordered = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (unordered || ordered) {
      const wanted: 'ul' | 'ol' = ordered ? 'ol' : 'ul';
      // Switching marker style ends the previous list, so "1. 2. -" does not
      // become one list with the numbering thrown away.
      if (listTag && listTag !== wanted) closeList();
      if (!listTag) {
        body.push(`<${wanted}>`);
        listTag = wanted;
      }
      body.push(`<li>${inline((unordered || ordered)![1])}</li>`);
      i++;
      continue;
    }

    // ---- blank ----
    if (!line.trim()) {
      closeList();
      i++;
      continue;
    }

    // ---- paragraph (consecutive non-blank lines join) ----
    closeList();
    const para: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      // A real table's header is the line immediately above a divider; a pipe
      // inside a sentence must not end the paragraph.
      !(lines[i].includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) &&
      !isTableDivider(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^```/.test(lines[i].trim()) &&
      !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    body.push(`<p>${inline(para.join(' '))}</p>`);
  }

  flushCode();
  closeList();

  /*
   * Styling is inline because expo-print renders this string in isolation: there
   * is no stylesheet to link and no fonts to inherit. Serif body, sans headings,
   * generous margins — the document should look like something a student can
   * hand in, not like a chat transcript.
   */
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 20mm 18mm; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.5pt;
    line-height: 1.62;
    color: #15171b;
    margin: 0;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: Helvetica, Arial, sans-serif;
    line-height: 1.25;
    margin: 1.4em 0 0.5em;
  }
  h1 { font-size: 22pt; margin-top: 0; }
  h2 { font-size: 16pt; }
  h3 { font-size: 13pt; }
  h4, h5, h6 { font-size: 11.5pt; }
  p { margin: 0 0 0.85em; }
  ul { margin: 0 0 0.9em; padding-left: 1.2em; }
  li { margin-bottom: 0.3em; }
  code {
    font-family: "Courier New", monospace;
    font-size: 10pt;
    background: #eceef2;
    padding: 1px 4px;
    border-radius: 3px;
  }
  pre {
    background: #15171b;
    color: #e6e8ee;
    padding: 10pt 12pt;
    border-radius: 6px;
    page-break-inside: avoid;
    /*
     * Print has no scrollbars, so overflow-x:auto would simply CLIP a long
     * code line at the page edge and lose the end of it. Wrap instead: a study
     * document that loses the end of a line is worse than one with a wrapped
     * line.
     */
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  pre code { background: none; color: inherit; padding: 0; white-space: inherit; }
  blockquote {
    margin: 0 0 0.9em;
    padding-left: 12pt;
    border-left: 3px solid #baf600;
    color: #434933;
  }
  table {
    width: 100%;
    max-width: 100%;
    /* Fixed layout + wrapping keeps a wide cell from pushing the table past
       the page margin, which would clip its right-hand columns. */
    table-layout: fixed;
    border-collapse: collapse;
    margin: 0 0 1em;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #d8dae2;
    padding: 5pt 7pt;
    text-align: left;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  th { background: #f4f6e8; font-weight: 700; }
  hr { border: none; border-top: 1px solid #d8dae2; margin: 1.4em 0; }
  a { color: #0043eb; }
  strong { font-weight: 700; }
</style></head>
<body>${body.join('\n')}</body></html>`;
}
