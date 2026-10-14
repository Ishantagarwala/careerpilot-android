import test from 'node:test';
import assert from 'node:assert/strict';

/*
 * End-to-end contract test: one realistic assistant reply containing every
 * structured block lib/aiHub.ts asks the model to emit, pushed through the real
 * parser and asserted against what the renderers consume.
 *
 * This is the regression guard for the bug in docs/ai-hub-audit.md — the reply
 * used to reach the UI as raw JSON.
 */
import { parseReplyBlocks } from '../src/api/replyParsers.ts';

/** A reply shaped exactly like the system prompt asks for. */
const REPLY = `Here is how normalization builds up, plus the salary picture and the study guide you asked for.

## From your notes

- **2NF** — remove partial dependencies on the primary key.
- **3NF** — remove transitive dependencies between non-key columns.

\`\`\`mermaid
flowchart TD
  A[1NF] --> B[2NF]
  B --> C[3NF]
\`\`\`

Backend salary bands, roughly:

\`\`\`chart
{"type":"bar","title":"Backend salary bands (LPA)","data":[{"label":"2024","value":6},{"label":"2025","value":9},{"label":"2026","value":12}]}
\`\`\`

\`\`\`python
def is_3nf(table):
    return not table.transitive_dependencies
\`\`\`

~~~file
{"filename":"dbms-normalization-guide","format":"pdf","title":"DBMS Normalization","markdown":"# DBMS Normalization\\n\\n## 2NF\\n\\nEvery non-key column depends on the whole key.\\n\\n| Form | Removes |\\n| --- | --- |\\n| 2NF | partial dependencies |\\n| 3NF | transitive dependencies |\\n"}
~~~

That covers the whole progression.`;
test('one reply yields every structured block type', () => {
  const blocks = parseReplyBlocks(REPLY);
  const kinds = blocks.map((b) => b.kind);

  assert.deepEqual(
    kinds,
    ['paragraph', 'heading', 'bullets', 'mermaid', 'paragraph', 'chart', 'code', 'file', 'paragraph'],
    'blocks must appear in order and nothing may be swallowed'
  );

  // ---- mermaid ----
  const diagram = blocks.find((b) => b.kind === 'mermaid');
  assert.match(diagram.text, /^flowchart TD/);
  assert.ok(!diagram.text.includes('```'), 'fences must be stripped');

  // ---- chart ----
  const chart = blocks.find((b) => b.kind === 'chart');
  assert.ok(chart.spec, 'chart spec must parse');
  assert.equal(chart.spec.type, 'bar');
  assert.equal(chart.spec.title, 'Backend salary bands (LPA)');
  assert.deepEqual(
    chart.spec.data.map((d) => d.value),
    [6, 9, 12]
  );
  // The renderer divides by the peak; a non-numeric value would produce NaN.
  assert.ok(chart.spec.data.every((d) => Number.isFinite(d.value)));

  // ---- code stays code ----
  const code = blocks.find((b) => b.kind === 'code');
  assert.equal(code.language, 'python');
  assert.match(code.text, /is_3nf/);

  // ---- file ----
  const file = blocks.find((b) => b.kind === 'file');
  assert.ok(file.spec, 'file spec must parse');
  assert.equal(file.spec.filename, 'dbms-normalization-guide');
  assert.equal(file.spec.format, 'pdf');
  assert.equal(file.spec.title, 'DBMS Normalization');
  assert.deepEqual(file.spec.markdown.slice(0, 3), '# D');

  // The renderer must send real markdown to the PDF builder — a table in a
  // generated document is the case most likely to be mangled.
  assert.match(file.spec.markdown, /\| Form \| Removes \|/);
});

test('no structured payload ever reaches the UI as prose', () => {
  const blocks = parseReplyBlocks(REPLY);

  const prose = blocks
    .filter((b) => b.kind === 'paragraph' || b.kind === 'heading')
    .map((b) => b.text)
    .join(' ');

  // The original bug, in one assertion.
  for (const leak of ['"filename"', '"markdown"', 'flowchart TD', '"type":"bar"', '~~~']) {
    assert.ok(!prose.includes(leak), `"${leak}" leaked into prose`);
  }

  // Bullets are prose too and must not carry a payload.
  const bullets = blocks.filter((b) => b.kind === 'bullets').flatMap((b) => b.items);
  assert.ok(bullets.every((i) => !i.includes('"value"')));
});
