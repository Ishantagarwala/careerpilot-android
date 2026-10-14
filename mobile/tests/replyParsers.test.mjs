import test from 'node:test';
import assert from 'node:assert/strict';

/*
 * These import the REAL parser, not a copy of it.
 *
 * The existing phase tests in this repo re-implement the logic they check, so
 * they cannot fail when the implementation changes. That is exactly the failure
 * mode that let the AI Hub ship without handling the `~~~file`, ```mermaid and
 * ```chart blocks its own system prompt asks the model to emit
 * (see docs/ai-hub-audit.md). replyParsers.ts is deliberately dependency-free
 * so it can be imported here under Node's type stripping.
 */
import {
  parseReplyBlocks,
  parseInline,
  parseChartSpec,
  parseGeneratedFileSpec,
} from '../src/api/replyParsers.ts';

const kinds = (blocks) => blocks.map((b) => b.kind);

/* ------------------------------------------------------------- ~~~file -- */

test('parses a ~~~file block into a document, not prose', () => {
  const reply = [
    'Here is your study guide.',
    '',
    '~~~file',
    '{"filename":"dbms-guide","format":"pdf","title":"DBMS Guide","markdown":"# DBMS\\n\\nNormalization basics."}',
    '~~~',
  ].join('\n');

  const blocks = parseReplyBlocks(reply);

  assert.deepEqual(kinds(blocks), ['paragraph', 'file']);
  const file = blocks[1];
  assert.equal(file.spec.filename, 'dbms-guide');
  assert.equal(file.spec.format, 'pdf');
  assert.equal(file.spec.title, 'DBMS Guide');
  assert.match(file.spec.markdown, /Normalization basics/);

  // The original bug: the raw JSON leaked into the chat as a paragraph.
  assert.ok(
    !blocks.some((b) => b.kind === 'paragraph' && b.text.includes('"filename"')),
    'raw file JSON must never surface as prose'
  );
});

test('a ~~~file payload containing ``` fences is not cut short', () => {
  // aiHub.ts requires tildes precisely because the document may hold fences.
  const reply = [
    '~~~file',
    JSON.stringify({
      filename: 'walkthrough',
      format: 'md',
      markdown: '# Steps\n\n```js\nconst a = 1;\n```\n\nDone.',
    }),
    '~~~',
  ].join('\n');

  const blocks = parseReplyBlocks(reply);
  assert.deepEqual(kinds(blocks), ['file']);
  assert.match(blocks[0].spec.markdown, /const a = 1;/);
});

test('accepts all three declared formats and rejects an undeclared one', () => {
  for (const format of ['pdf', 'docx', 'md']) {
    const spec = parseGeneratedFileSpec(
      JSON.stringify({ filename: 'f', format, markdown: 'body' })
    );
    assert.equal(spec.format, format);
  }
  // lib/aiHub.ts lists only pdf/docx/md — anything else is not a document.
  assert.equal(
    parseGeneratedFileSpec(JSON.stringify({ filename: 'f', format: 'exe', markdown: 'x' })),
    null
  );
});

test('a malformed ~~~file payload yields spec null but keeps the raw text', () => {
  const blocks = parseReplyBlocks('~~~file\n{not json}\n~~~');
  assert.deepEqual(kinds(blocks), ['file']);
  assert.equal(blocks[0].spec, null);
  assert.equal(blocks[0].raw, '{not json}');
});

/* ------------------------------------------------------------- mermaid -- */

test('parses a ```mermaid block as a diagram, not code', () => {
  const blocks = parseReplyBlocks('Flow:\n\n```mermaid\nflowchart TD\n  A --> B\n```');
  assert.deepEqual(kinds(blocks), ['paragraph', 'mermaid']);
  assert.equal(blocks[1].text, 'flowchart TD\n  A --> B');
});

/* --------------------------------------------------------------- chart -- */

test('parses a ```chart block into a usable spec', () => {
  const blocks = parseReplyBlocks(
    '```chart\n{"type":"bar","title":"Bands","data":[{"label":"2024","value":12},{"label":"2025","value":18}]}\n```'
  );
  assert.deepEqual(kinds(blocks), ['chart']);
  const { spec } = blocks[0];
  assert.equal(spec.type, 'bar');
  assert.equal(spec.title, 'Bands');
  assert.equal(spec.data.length, 2);
  assert.deepEqual(spec.data[0], { label: '2024', value: 12 });
});

test('chart spec rejects unknown types and non-numeric points', () => {
  assert.equal(parseChartSpec('{"type":"scatter","data":[{"label":"a","value":1}]}'), null);
  assert.equal(parseChartSpec('{"type":"bar","data":[]}'), null);
  // Values must be plain numbers per aiHub.ts; a string is not plottable.
  const dropped = parseChartSpec('{"type":"bar","data":[{"label":"a","value":"n/a"}]}');
  assert.equal(dropped, null);
});

test('a chart with mixed valid and invalid points keeps only the valid ones', () => {
  const spec = parseChartSpec(
    '{"type":"line","data":[{"label":"a","value":1},{"label":"b","value":"x"},{"label":"c","value":3}]}'
  );
  assert.equal(spec.data.length, 2);
  assert.deepEqual(spec.data.map((d) => d.label), ['a', 'c']);
});

/* ---------------------------------------------------------------- code -- */

test('a plain fence stays code and keeps its language', () => {
  const blocks = parseReplyBlocks('```python\nprint(1)\n```');
  assert.deepEqual(kinds(blocks), ['code']);
  assert.equal(blocks[0].language, 'python');
  assert.equal(blocks[0].text, 'print(1)');
});

test('an unlabelled fence is code, not a diagram', () => {
  const blocks = parseReplyBlocks('```\njust text\n```');
  assert.deepEqual(kinds(blocks), ['code']);
});

/* --------------------------------------------------------------- prose -- */

test('headings, bullets and paragraphs split as the mockups require', () => {
  const blocks = parseReplyBlocks(
    'Both remove redundancy.\n\n## From your notes\n\n- **2NF** — split it out.\n- **3NF** — move it.\n\nDone.'
  );
  assert.deepEqual(kinds(blocks), ['paragraph', 'heading', 'bullets', 'paragraph']);
  assert.equal(blocks[1].text, 'From your notes');
  assert.equal(blocks[2].items.length, 2);
});

test('numbered lists are bullets', () => {
  const blocks = parseReplyBlocks('1. First\n2. Second');
  assert.deepEqual(kinds(blocks), ['bullets']);
  assert.deepEqual(blocks[0].items, ['First', 'Second']);
});

test('empty input yields no blocks', () => {
  assert.deepEqual(parseReplyBlocks(''), []);
  assert.deepEqual(parseReplyBlocks('   \n  '), []);
});

test('text after a closed fence is not swallowed', () => {
  const blocks = parseReplyBlocks('```\ncode\n```\n\nTrailing prose.');
  assert.deepEqual(kinds(blocks), ['code', 'paragraph']);
  assert.equal(blocks[1].text, 'Trailing prose.');
});

/* ---------------------------------------------------- inline formatting -- */

test('inline runs mark bold, italic and code', () => {
  const runs = parseInline('The **whole** key and `3NF` and *emphasis*.');
  assert.deepEqual(
    runs.filter((r) => r.bold).map((r) => r.text),
    ['whole']
  );
  assert.deepEqual(
    runs.filter((r) => r.code).map((r) => r.text),
    ['3NF']
  );
  assert.deepEqual(
    runs.filter((r) => r.italic).map((r) => r.text),
    ['emphasis']
  );
});

test('bold is not misread as two italics', () => {
  const runs = parseInline('**2NF**');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].bold, true);
  assert.equal(runs[0].text, '2NF');
});

test('plain text passes through untouched', () => {
  const runs = parseInline('no formatting here');
  assert.deepEqual(runs, [{ text: 'no formatting here' }]);
});

test('an unmatched marker is left as literal text', () => {
  const runs = parseInline('2 * 3 = 6');
  assert.equal(runs.map((r) => r.text).join(''), '2 * 3 = 6');
});
