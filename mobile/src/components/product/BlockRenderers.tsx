import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect, Polyline, Circle, Path, Line } from 'react-native-svg';
import { Download, FileText, Check, AlertCircle, Copy, Type } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radii, spacing, typography } from '../../theme/tokens';
import type { ChartSpec, GeneratedFileSpec } from '../../api/replyParsers';

/**
 * Renderers for the two structured blocks the AI Hub system prompt asks the
 * model to emit: ` ```chart ` and `~~~file` (lib/aiHub.ts "Charts" and
 * "Files (PDF / Word)").
 *
 * Why these are native rather than a WebView. The web client renders charts
 * with Recharts and documents with html2canvas/jsPDF; neither exists in React
 * Native. But `react-native-svg` is already a dependency and the chart payload
 * is flat JSON, so a native renderer is small, offline-safe and needs no new
 * native module. A WebView would add megabytes per renderer and a rebuild.
 *
 * Dependency note: writing a .md file would need `expo-file-system`, which this
 * project does not install. Rather than add a dependency, Markdown is offered
 * as copy-to-clipboard via `expo-clipboard` (already installed), and PDF goes
 * through `expo-print`, which writes the file itself and returns a URI — so no
 * filesystem access is required at all.
 */

/* ------------------------------------------------------------------ chart -- */

const CHART_HEIGHT = 168;
const PAD_TOP = 8;
const PAD_BOTTOM = 26;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;

const PALETTE = ['#baf600', '#7dd3fc', '#c792ea', '#fbbf24', '#fb7185', '#34d399'];

/** Short axis labels only — the mockups never show long ones. */
function shortLabel(label: string, max = 7): string {
  return label.length > max ? label.slice(0, max - 1) + '…' : label;
}

export const ChartCard: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const { hub } = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const { max, points } = useMemo(() => {
    // A zero-only series would divide by zero; fall back to 1.
    const peak = Math.max(...spec.data.map((d) => d.value), 0);
    const nice = peak <= 0 ? 1 : peak;
    const slot = plotW / Math.max(spec.data.length, 1);
    const step = spec.data.length > 1 ? plotW / (spec.data.length - 1) : 0;
    return {
      max: nice,
      points: spec.data.map((d, i) => ({
        ...d,
        x: spec.type === 'bar' ? slot * i + slot / 2 : step * i,
        y: PAD_TOP + plotH - (Math.max(d.value, 0) / nice) * plotH,
        slot,
      })),
    };
  }, [spec, plotW, plotH]);

  if (spec.type === 'pie') {
    const total = spec.data.reduce((sum, d) => sum + Math.max(d.value, 0), 0) || 1;
    const size = Math.max(Math.min(plotW * 0.45, CHART_HEIGHT - PAD_TOP), 80);
    const r = size / 2 - 2;
    const cx = size / 2;
    const cy = size / 2;
    let angle = -Math.PI / 2;

    return (
      <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.raised }]}>
        {!!spec.title && <Text style={[styles.title, { color: hub.text }]}>{spec.title}</Text>}
        <View style={styles.pieRow}>
          <Svg width={size} height={size}>
            {spec.data.map((d, i) => {
              const sweep = (Math.max(d.value, 0) / total) * Math.PI * 2;
              const x1 = cx + r * Math.cos(angle);
              const y1 = cy + r * Math.sin(angle);
              angle += sweep;
              const x2 = cx + r * Math.cos(angle);
              const y2 = cy + r * Math.sin(angle);
              const large = sweep > Math.PI ? 1 : 0;
              // A full circle cannot be drawn as one arc; nudge the end point.
              const path =
                sweep >= Math.PI * 2 - 0.001
                  ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
                  : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
              return <Path key={i} d={path} fill={PALETTE[i % PALETTE.length]} />;
            })}
          </Svg>
          <View style={styles.legend}>
            {spec.data.map((d, i) => (
              <View key={i} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                <Text numberOfLines={1} style={[styles.legendLabel, { color: hub.muted }]}>
                  {d.label}
                </Text>
                <Text style={[styles.legendValue, { color: hub.text }]}>{d.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const areaPath =
    points.length > 0
      ? `M ${points[0].x} ${PAD_TOP + plotH} ` +
        points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x} ${PAD_TOP + plotH} Z`
      : '';

  return (
    <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.raised }]}>
      {!!spec.title && <Text style={[styles.title, { color: hub.text }]}>{spec.title}</Text>}
      <View onLayout={onLayout} style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Line
              x1={PAD_LEFT}
              y1={PAD_TOP}
              x2={width - PAD_RIGHT}
              y2={PAD_TOP}
              stroke={hub.line}
              strokeWidth={1}
            />
            <Line
              x1={PAD_LEFT}
              y1={PAD_TOP + plotH}
              x2={width - PAD_RIGHT}
              y2={PAD_TOP + plotH}
              stroke={hub.line}
              strokeWidth={1}
            />

            {spec.type === 'area' && areaPath ? (
              <Path d={areaPath} fill={hub.primary} fillOpacity={0.18} />
            ) : null}

            {spec.type === 'bar'
              ? points.map((p, i) => {
                  const barW = Math.min(p.slot * 0.62, 34);
                  return (
                    <Rect
                      key={i}
                      x={p.x - barW / 2}
                      y={p.y}
                      width={barW}
                      height={Math.max(PAD_TOP + plotH - p.y, 1)}
                      rx={3}
                      fill={PALETTE[0]}
                    />
                  );
                })
              : null}

            {(spec.type === 'line' || spec.type === 'area') && points.length > 0 ? (
              <>
                <Polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={hub.primary}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={hub.primary} />
                ))}
              </>
            ) : null}
          </Svg>
        )}

        {/* Axis labels are RN Text, not SVG text, so they honour font scaling. */}
        <View style={[styles.axisRow, { top: CHART_HEIGHT - PAD_BOTTOM + 4 }]}>
          {points.map((p, i) => (
            <Text
              key={i}
              numberOfLines={1}
              style={[styles.axisLabel, { color: hub.muted, width: Math.max(p.slot, 28) }]}
            >
              {shortLabel(p.label)}
            </Text>
          ))}
        </View>
      </View>
      <Text style={[styles.scaleHint, { color: hub.muted }]}>peak {max}</Text>
    </View>
  );
};

/* -------------------------------------------------------- generated file -- */

const FORMAT_LABEL: Record<GeneratedFileSpec['format'], string> = {
  pdf: 'PDF',
  docx: 'Word',
  md: 'Markdown',
};

/**
 * A ~~~file block: the document the model wrote, offered for download.
 *
 * PDF is the primary action. There is no React Native equivalent of the web's
 * `buildDocxBlob`, so a Word file is not offered — a button that silently
 * produced something other than a real .docx would be worse than no button.
 * Markdown is available as copy-to-clipboard.
 */
export const GeneratedFileCard: React.FC<{
  spec: GeneratedFileSpec | null;
  raw: string;
}> = ({ spec, raw }) => {
  const { hub } = useTheme();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'pdf' | 'md' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!spec) {
    // Unparseable payload: show the source rather than swallowing it, so the
    // document can still be recovered by hand.
    return (
      <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.raised }]}>
        <View style={styles.fileHead}>
          <AlertCircle size={16} color={hub.muted} />
          <Text style={[styles.fileName, { color: hub.text, flex: 1 }]}>
            A document was generated but could not be read
          </Text>
        </View>
        <Text selectable style={[styles.rawText, { color: hub.muted }]}>
          {raw.slice(0, 600)}
        </Text>
      </View>
    );
  }

  const buildPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const Print = await import('expo-print');
      const Sharing = await import('expo-sharing');
      const { markdownToHtml } = await import('../../services/markdownToHtml');
      const html = markdownToHtml(spec.markdown, spec.title || spec.filename);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: spec.title || spec.filename,
          UTI: 'com.adobe.pdf',
        });
      }
      setDone('pdf');
    } catch (err: any) {
      setError(err?.message || 'Could not build the PDF.');
    } finally {
      setBusy(false);
      setTimeout(() => setDone(null), 2500);
    }
  };

  const copyMarkdown = async () => {
    setError(null);
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(spec.markdown);
      setDone('md');
    } catch (err: any) {
      setError(err?.message || 'Could not copy the document.');
    } finally {
      setTimeout(() => setDone(null), 2500);
    }
  };

  return (
    <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.raised }]}>
      <View style={styles.fileHead}>
        <View style={[styles.fileIcon, { borderColor: hub.line, backgroundColor: hub.surface }]}>
          <FileText size={16} color={hub.text} />
        </View>
        <View style={styles.fileMeta}>
          <Text numberOfLines={1} style={[styles.fileName, { color: hub.text }]}>
            {spec.filename}.{spec.format}
          </Text>
          <Text style={[styles.fileSub, { color: hub.muted }]}>
            {FORMAT_LABEL[spec.format]} · {spec.markdown.length.toLocaleString()} characters
          </Text>
        </View>
      </View>

      {!!error && <Text style={[styles.fileError, { color: hub.danger }]}>{error}</Text>}

      <View style={styles.fileActions}>
        <Pressable
          onPress={buildPdf}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Download ${spec.filename} as PDF`}
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: hub.strong, opacity: pressed || busy ? 0.85 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={hub.surface} />
          ) : done === 'pdf' ? (
            <>
              <Check size={15} color={hub.surface} />
              <Text style={[styles.primaryBtnText, { color: hub.surface }]}>Saved</Text>
            </>
          ) : (
            <>
              <Download size={15} color={hub.surface} />
              <Text style={[styles.primaryBtnText, { color: hub.surface }]}>Download PDF</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={copyMarkdown}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${spec.filename} as Markdown`}
          style={({ pressed }) => [
            styles.ghostBtn,
            { borderColor: hub.line, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {done === 'md' ? (
            <>
              <Check size={15} color={hub.text} />
              <Text style={[styles.ghostBtnText, { color: hub.text }]}>Copied</Text>
            </>
          ) : (
            <>
              <Copy size={15} color={hub.text} />
              <Text style={[styles.ghostBtnText, { color: hub.text }]}>Copy</Text>
            </>
          )}
        </Pressable>
      </View>

      {spec.format === 'docx' && (
        <Text style={[styles.fileNote, { color: hub.muted }]}>
          Word output is not available yet — the PDF keeps the same content and formatting.
        </Text>
      )}
    </View>
  );
};

/* --------------------------------------------------------------- diagram -- */

/**
 * A ```mermaid block.
 *
 * There is no Mermaid renderer for React Native, so this is the degraded path
 * from docs/ai-hub-audit.md (option c): the diagram's source is shown in a
 * collapsible block, labelled honestly, rather than pretending to draw it. A
 * real renderer needs either a server SVG route or a WebView — both larger
 * pieces of work, tracked in the audit.
 */
export const DiagramCard: React.FC<{ source: string }> = ({ source }) => {
  const { hub } = useTheme();
  const [open, setOpen] = useState(false);
  const lineCount = source.split('\n').filter((l) => l.trim()).length;

  return (
    <View style={[styles.card, { borderColor: hub.line, backgroundColor: hub.raised }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide the diagram source' : 'Show the diagram source'}
        accessibilityState={{ expanded: open }}
        style={styles.diagramHead}
      >
        <View style={[styles.fileIcon, { borderColor: hub.line, backgroundColor: hub.surface }]}>
          <Type size={16} color={hub.text} />
        </View>
        <View style={styles.fileMeta}>
          <Text style={[styles.fileName, { color: hub.text }]}>Diagram</Text>
          <Text style={[styles.fileSub, { color: hub.muted }]}>
            {lineCount} lines · {open ? 'tap to hide' : 'tap to view source'}
          </Text>
        </View>
      </Pressable>

      {open && (
        <View style={[styles.diagramSource, { borderColor: hub.line, backgroundColor: hub.soft }]}>
          <Text selectable style={[styles.diagramText, { color: hub.text }]}>
            {source}
          </Text>
        </View>
      )}

      <Text style={[styles.fileNote, { color: hub.muted }]}>
        Diagrams render as images on the web. Open this thread there to see it drawn.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: spacing.md,
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fontHeading,
    fontSize: typography.sizes.subheading,
    lineHeight: typography.sizes.subheading * typography.lineHeights.section,
  },
  axisRow: {
    position: 'absolute',
    left: PAD_LEFT,
    right: PAD_RIGHT,
    flexDirection: 'row',
  },
  axisLabel: {
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.fine,
    textAlign: 'center',
  },
  scaleHint: {
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.fine,
    textAlign: 'right',
  },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  legend: { flex: 1, minWidth: 0, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.xs,
  },
  legendValue: { fontFamily: typography.fontBodyBold, fontSize: typography.sizes.xs },
  fileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  diagramHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fileIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.chip,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: { flex: 1, minWidth: 0 },
  fileName: { fontFamily: typography.fontBodyBold, fontSize: typography.sizes.body },
  fileSub: {
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.fine,
    marginTop: 2,
  },
  fileError: { fontFamily: typography.fontBody, fontSize: typography.sizes.xs },
  fileNote: {
    fontFamily: typography.fontBody,
    fontSize: typography.sizes.xs,
    lineHeight: typography.sizes.xs * typography.lineHeights.meta,
  },
  fileActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.base,
    borderRadius: radii.chip,
    flexGrow: 1,
  },
  primaryBtnText: { fontFamily: typography.fontBodyBold, fontSize: typography.sizes.body },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.base,
    borderWidth: 1.5,
    borderRadius: radii.chip,
  },
  ghostBtnText: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizes.body },
  diagramSource: {
    borderWidth: 1.5,
    borderRadius: radii.chip,
    padding: spacing.md,
  },
  diagramText: {
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.xs,
    lineHeight: typography.sizes.xs * 1.6,
  },
  rawText: {
    fontFamily: typography.fontMonoMedium,
    fontSize: typography.sizes.xs,
    lineHeight: typography.sizes.xs * typography.lineHeights.meta,
  },
});
