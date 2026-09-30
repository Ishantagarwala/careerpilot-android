import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, space } from '@/theme/tokens';

/**
 * Markdown renderer for AI replies.
 *
 * Hand-rolled rather than pulling in a markdown library: replies are prose with
 * headings, bullets and fenced code, and a general parser would add a native
 * dependency plus layout surprises for no gain.
 *
 * Deliberately NOT in scope, because React Native has no renderer for them:
 * Mermaid diagrams, KaTeX math and charts. The web hub renders those; here they
 * fall through as fenced code. That gap is recorded in
 * design/ANDROID_APP_PLAN.md §4 — v1 shows the source rather than a broken box.
 */

interface Block {
  kind: 'heading' | 'bullet' | 'code' | 'paragraph' | 'ordered';
  text: string;
  /** for ordered lists */
  marker?: string;
  lang?: string;
}

export function MarkdownContent({ children }: { children: string }) {
  const blocks = React.useMemo(() => parseBlocks(children), [children]);

  return (
    <View>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </View>
  );
}

function Block({ block }: { block: Block }) {
  const hub = useTheme('hub');

  if (block.kind === 'code') {
    return (
      <View style={styles.codeBlock}>
        {block.lang ? <Text style={styles.codeLang}>{block.lang}</Text> : null}
        <Text style={styles.code} selectable>
          {block.text}
        </Text>
      </View>
    );
  }

  if (block.kind === 'heading') {
    return (
      <Text style={[styles.heading, { color: hub.text }]} selectable>
        {block.text}
      </Text>
    );
  }

  if (block.kind === 'bullet' || block.kind === 'ordered') {
    return (
      <View style={styles.listRow}>
        {block.kind === 'bullet' ? (
          // Lime dot — one of the few places lime is allowed (DESIGN_SPEC.md §2)
          <View style={[styles.bullet, { backgroundColor: hub.primary }]} />
        ) : (
          <Text style={[styles.orderedMarker, { color: hub.muted }]}>{block.marker}</Text>
        )}
        <Text style={[styles.body, { color: hub.text, flex: 1 }]} selectable>
          {renderInline(block.text, hub.soft, hub.text)}
        </Text>
      </View>
    );
  }

  return (
    <Text style={[styles.body, { color: hub.text }]} selectable>
      {renderInline(block.text, hub.soft, hub.text)}
    </Text>
  );
}

/**
 * Split markdown into block-level pieces.
 *
 * Fences are handled first so a `#` or `-` inside a code block is never read as
 * a heading or a bullet — the classic way a naive renderer mangles code.
 */
function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // fenced code
    const fence = line.match(/^\s*```(\w+)?\s*$/);
    if (fence) {
      flushParagraph();
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i] ?? '')) {
        body.push(lines[i] ?? '');
        i++;
      }
      blocks.push({ kind: 'code', text: body.join('\n'), lang });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'heading', text: (heading[2] ?? '').trim() });
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: 'bullet', text: (bullet[1] ?? '').trim() });
      continue;
    }

    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      blocks.push({ kind: 'ordered', marker: `${ordered[1]}.`, text: (ordered[2] ?? '').trim() });
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}

/**
 * Inline formatting: `code`, **bold**, *italic*.
 *
 * Returns an array of Text nodes so it nests inside a parent Text without
 * introducing a View (which would break wrapping mid-paragraph).
 */
function renderInline(
  text: string,
  codeBg: string,
  textColor: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;

  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <Text key={key++} style={[styles.inlineCode, { backgroundColor: codeBg, color: textColor }]}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <Text key={key++} style={styles.bold}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else {
      nodes.push(
        <Text key={key++} style={styles.italic}>
          {token.slice(1, -1)}
        </Text>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 15.5,
    // generous line-height: PRODUCT.md makes the reply the content
    lineHeight: 26,
    marginBottom: 11,
  },
  heading: {
    fontFamily: fontFamily.heading,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.2,
    marginTop: space.s4,
    marginBottom: 8,
  },
  listRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 10,
  },
  orderedMarker: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 13.5,
    lineHeight: 26,
    minWidth: 18,
  },
  inlineCode: {
    fontFamily: fontFamily.mono,
    fontSize: 13.5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: 'hidden',
  },
  bold: { fontFamily: fontFamily.sansBold },
  italic: { fontStyle: 'italic' },
  codeBlock: {
    backgroundColor: '#15171b',
    borderRadius: radius.chip,
    padding: space.s4,
    marginVertical: space.s3,
  },
  codeLang: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 8,
  },
  code: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : fontFamily.mono,
    fontSize: 12.5,
    lineHeight: 21,
    color: '#e6e8ee',
  },
});
