import test from 'node:test';
import assert from 'node:assert/strict';

/*
 * Guards for the generated-document (PDF) path.
 *
 * These exercise the REAL markdownToHtml, not a copy. The defect they were
 * written for: a lone `*` or `_` opened an emphasis span that ran to the next
 * marker, and because the markers were consumed rather than emitted, the text
 * between them was DELETED from the document —
 *
 *   'Salary grows about 2 * 3 = 6 percent'  ->  '... 2 3 = 6 percent'
 *   'the field snake_case_name is preserved' ->  'snakecasename'
 *
 * A printable document silently dropping words is worse than an ugly one, so
 * every case here asserts on TEXT PRESERVATION first.
 */
import { markdownToHtml } from '../src/services/markdownToHtml.ts';

/** The visible text of the <body>, tags stripped — what a reader would see. */
function visibleText(html) {
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  return body
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const render = (md) => markdownToHtml(md, 'Test document');

/* --------------------------------------------------- text preservation -- */

test('a multiplication asterisk is not treated as emphasis', () => {
  const text = visibleText(render('Salary grows about 2 * 3 = 6 percent year on year.'));
  assert.match(text, /2 \* 3 = 6/, 'the asterisks and both operands must survive');
});

test('a percentage calculation with asterisks survives', () => {
  const text = visibleText(render('Maths like 5% * 1.2 = 6% must survive printing.'));
  assert.match(text, /5% \* 1\.2 = 6%/);
});

test('snake_case identifiers are not italicised or stripped', () => {
  const text = visibleText(render('The field snake_case_name is preserved verbatim.'));
  assert.match(text, /snake_case_name/, 'underscores inside a word must not be markup');
  assert.ok(!text.includes('snakecasename'), 'underscores must not be consumed');
});

test('a lone asterisk at the end of a line is kept', () => {
  const text = visibleText(render('A footnote marker * sits here.'));
  assert.match(text, /marker \* sits here/);
});

test('an unclosed bold run degrades to literal text, not an empty tag', () => {
  const html = render('A line with **unclosed bold and another * stray.');
  // The old bug paired the tail of the `**` with the stray `*` and emitted an
  // empty <em></em>, losing the text between them.
  assert.ok(!/<em><\/em>/.test(html), 'must not emit an empty emphasis element');
  const text = visibleText(html);
  assert.match(text, /unclosed bold and another/);
});

/* ------------------------------------------------------ genuine markup -- */

test('real emphasis still works', () => {
  const html = render('Every non-key column depends on the **whole** key.');
  assert.match(html, /<strong>whole<\/strong>/);
});

test('real italics still work', () => {
  const html = render('This is *emphasised* text.');
  assert.match(html, /<em>emphasised<\/em>/);
});

test('bold is not mangled into italics', () => {
  const html = render('**2NF** removes partial dependencies.');
  assert.match(html, /<strong>2NF<\/strong>/);
  assert.ok(!html.includes('<em>'), 'a bold run must not also emit italics');
});

test('inline code is not processed for emphasis', () => {
  const html = render('Use `a * b` in the formula.');
  assert.match(html, /<code>a \* b<\/code>/);
});

/* ---------------------------------------------------------- structure -- */

test('a numbered list renders as an ordered list', () => {
  const html = render('1. Put the table in 1NF\n2. Remove partial dependencies');
  assert.match(html, /<ol>/);
  assert.match(html, /<\/ol>/);
  assert.ok(!/<ul>/.test(html), 'a numbered list must not render as bullets');
});

test('a bulleted list still renders as an unordered list', () => {
  const html = render('- first\n- second');
  assert.match(html, /<ul>/);
  assert.ok(!/<ol>/.test(html));
});

test('switching marker style closes the previous list', () => {
  const html = render('1. numbered\n\n- bulleted');
  assert.match(html, /<\/ol>/);
  assert.match(html, /<ul>/);
});

test('a paragraph containing a pipe is not mistaken for a table', () => {
  const html = render('A paragraph with a pipe | inside it, not a table.');
  assert.ok(!/<table>/.test(html), 'a lone pipe must not open a table');
  assert.match(html, /pipe \| inside/);
});

test('a real pipe table is still recognised', () => {
  const html = render('| Form | Removes |\n| --- | --- |\n| 2NF | partial deps |');
  assert.match(html, /<table>/);
  assert.match(html, /<th>Form<\/th>/);
  assert.match(html, /<td>2NF<\/td>/);
});

test('a horizontal rule is not confused with a list', () => {
  const html = render('Above\n\n---\n\nBelow');
  assert.match(html, /<hr \/>/);
});

test('html in the document is escaped, not executed', () => {
  const html = render('Text with a <script>alert(1)</script> tag.');
  assert.ok(!/<script>/.test(html), 'raw script must never reach the document');
  assert.match(html, /&lt;script&gt;/);
});

test('fenced code is not emphasis-processed', () => {
  const html = render('```python\ndef f(a, b):\n    return a * b\n```');
  assert.match(html, /a \* b/);
  assert.match(html, /<pre><code/);
});

/* ------------------------------------------------------ print integrity -- */

test('code blocks wrap instead of being clipped at the page edge', () => {
  const html = render('```\nx\n```');
  // Strip CSS comments first: the sheet explains in a comment why overflow-x
  // was removed, and that prose is not a declaration.
  const css = html.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/overflow-x\s*:\s*auto/.test(css), 'overflow-x must not be relied on in print');
  assert.match(css, /white-space\s*:\s*pre-wrap/);
});

test('tables cannot push past the page margin', () => {
  const html = render('| a | b |\n| --- | --- |\n| 1 | 2 |');
  assert.match(html, /table-layout\s*:\s*fixed/);
  assert.match(html, /max-width\s*:\s*100%/);
});

test('the document declares page margins and a title', () => {
  const html = markdownToHtml('# Hello', 'My Study Guide');
  assert.match(html, /@page\s*\{\s*margin/);
  assert.match(html, /<title>My Study Guide<\/title>/);
});

/* ----------------------------------------------------- end-to-end case -- */

test('a realistic document keeps every word', () => {
  const md = [
    '# DBMS Normalization',
    '',
    'Salary grows about 2 * 3 = 6 percent and the field `snake_case_name` survives.',
    '',
    '## Steps',
    '',
    '1. Put the table in 1NF',
    '2. Remove partial dependencies',
    '',
    '| Form | Removes |',
    '| --- | --- |',
    '| 2NF | partial deps |',
    '',
    '> Quoted from the PDF.',
    '',
    'A pipe | in prose is fine.',
  ].join('\n');

  const html = render(md);
  const text = visibleText(html);

  // Everything a reader must still see. List numbering is a CSS list-marker
  // rather than text, so the ordered list is asserted structurally below.
  for (const phrase of [
    'DBMS Normalization',
    '2 * 3 = 6 percent',
    'snake_case_name',
    'Put the table in 1NF',
    'partial deps',
    'Quoted from the PDF.',
    'pipe | in prose is fine',
  ]) {
    assert.ok(text.includes(phrase), `lost from the document: ${phrase}`);
  }

  // And the structure that carries the meaning must be intact.
  assert.match(html, /<ol>[\s\S]*<li>Put the table in 1NF<\/li>/, 'steps must stay an ordered list');
  assert.match(html, /<table>/, 'the comparison must stay a table');
  assert.match(html, /<blockquote>/, 'the quote must stay a quote');
  assert.ok(!/\*\*/.test(text), 'no leftover bold markers in the rendered text');
});
