import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, RotateCcw, CloudOff } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  DocumentSummaryResponse,
  fetchDocumentSummary,
  fetchDocuments,
  getCachedDocSummary,
  setCachedDocSummary,
  setStoredSelectedDocs,
} from '../src/api/study';

export default function DocumentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const params = useLocalSearchParams<{ docId?: string }>();

  const [docSummary, setDocSummary] = useState<DocumentSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    let targetDocId = params.docId;

    // If no docId passed, attempt to find first document from library
    if (!targetDocId) {
      try {
        const docs = await fetchDocuments();
        if (docs && docs.length > 0) {
          targetDocId = docs[0]._id;
        }
      } catch {
        // Ignored, will handle missing id below
      }
    }

    if (!targetDocId) {
      setLoading(false);
      setError('No document selected. Please select a document from your library.');
      return;
    }

    // Try reading offline cache first
    const cached = await getCachedDocSummary(targetDocId);
    if (cached) {
      setDocSummary(cached);
      setIsCached(true);
      setLoading(false);
    }

    try {
      const live = await fetchDocumentSummary(targetDocId);
      setDocSummary(live);
      setIsCached(false);
      await setCachedDocSummary(targetDocId, live);
    } catch (err: any) {
      console.warn('Failed to load live summary:', err);
      if (!cached) {
        setError(err?.message || 'Failed to load document summary. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
  }, [params.docId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const docId = docSummary?.id || params.docId;
  const filename = docSummary?.filename || 'Document';

  // Extract key concept tags from summary or fallback
  const extractTags = (text?: string): string[] => {
    if (!text) return ['Notes', 'Summary'];
    const words = text.match(/\b[A-Z][a-zA-Z0-9-]{2,}\b/g) || [];
    const unique = Array.from(new Set(words))
      .filter((w) => !['The', 'This', 'These', 'What', 'How', 'With', 'From', 'When', 'Here', 'Instead'].includes(w))
      .slice(0, 4);
    return unique.length > 0 ? unique : ['Key ideas', 'Concepts'];
  };

  // Parse markdown summary into sections
  const parseSections = (markdown?: string) => {
    if (!markdown) {
      return {
        keyIdeas: 'Organize notes into concepts, retrieve insights, and practice questions with your AI tutor.',
        sections: [],
      };
    }

    const lines = markdown.split('\n');
    let keyIdeas = '';
    const sections: Array<{ heading: string; body: string }> = [];

    let currentHeading = '';
    let currentBodyLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
        if (currentHeading) {
          sections.push({
            heading: currentHeading,
            body: currentBodyLines.join(' ').replace(/\s+/g, ' ').trim(),
          });
          currentBodyLines = [];
        } else if (!keyIdeas && currentBodyLines.length > 0) {
          keyIdeas = currentBodyLines.join(' ').replace(/\s+/g, ' ').trim();
          currentBodyLines = [];
        }
        currentHeading = line.replace(/^#+\s*/, '');
      } else if (line) {
        currentBodyLines.push(line.replace(/[*_`]/g, ''));
      }
    }

    if (currentHeading && currentBodyLines.length > 0) {
      sections.push({
        heading: currentHeading,
        body: currentBodyLines.join(' ').replace(/\s+/g, ' ').trim(),
      });
    } else if (!keyIdeas && currentBodyLines.length > 0) {
      keyIdeas = currentBodyLines.join(' ').replace(/\s+/g, ' ').trim();
    }

    if (!keyIdeas && sections.length > 0) {
      keyIdeas = sections[0].body;
    }

    return { keyIdeas: keyIdeas || markdown.slice(0, 160) + '…', sections };
  };

  const { keyIdeas, sections } = parseSections(docSummary?.summary);
  const tags = extractTags(docSummary?.summary);

  const handleAskTutor = async () => {
    if (docId) {
      await setStoredSelectedDocs([{ id: docId, filename }]);
      router.push({
        pathname: '/(tabs)/study',
        params: {
          docId,
          docName: filename,
        },
      } as any);
    } else {
      router.push('/(tabs)/study' as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Document summary" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          DOCUMENT SUMMARY
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          {filename}
        </Text>

        {/* Offline Cache indicator */}
        {isCached && (
          <View style={[styles.cachedBadge, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <CloudOff size={14} color={hub.muted} />
            <Text style={[styles.cachedText, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
              OFFLINE CACHED SUMMARY
            </Text>
          </View>
        )}

        {/* Segments: Summary / Quiz / Cards */}
        <View style={[styles.segmentsContainer, { backgroundColor: hub.soft }]}>
          <Pressable
            style={[styles.segmentItem, { backgroundColor: hub.surface }]}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
          >
            <Text style={[styles.segmentText, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
              Summary
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (docId) {
                router.push({ pathname: '/quiz', params: { docId } } as any);
              }
            }}
            style={styles.segmentItem}
            accessibilityRole="button"
            accessibilityLabel="Open practice quiz"
          >
            <Text style={[styles.segmentText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Quiz
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (docId) {
                router.push({ pathname: '/flashcards', params: { docId } } as any);
              }
            }}
            style={styles.segmentItem}
            accessibilityRole="button"
            accessibilityLabel="Open flashcards"
          >
            <Text style={[styles.segmentText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Cards
            </Text>
          </Pressable>
        </View>

        {/* Loading */}
        {loading && !docSummary && (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={hub.muted} />
            <Text style={[styles.stateText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Loading summary…
            </Text>
          </View>
        )}

        {/* Error */}
        {error && !docSummary && (
          <View style={[styles.errorCard, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <Text style={[styles.errorTitle, { color: hub.danger, fontFamily: typography.fontBodyBold }]}>
              Could not load document
            </Text>
            <Text style={[styles.errorSubtitle, { color: hub.text, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={loadSummary}
              variant="secondary"
              icon={<RotateCcw size={16} color={hub.text} />}
              style={styles.retryBtn}
            />
          </View>
        )}

        {/* Summary Content */}
        {docSummary && (
          <>
            {/* Key ideas Card */}
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                Key ideas
              </Text>
              <Text style={[styles.bodyText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                {keyIdeas}
              </Text>
              <View style={styles.tagsRow}>
                {tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: hub.soft }]}>
                    <Text style={[styles.tagText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Detailed Sections Card */}
            {sections.length > 0 && (
              <Card style={styles.card}>
                {sections.map((sec, idx) => (
                  <View key={idx} style={idx > 0 ? styles.sectionSpacing : undefined}>
                    <Text style={[styles.subHeading, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                      {sec.heading}
                    </Text>
                    <Text style={[styles.bodyText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                      {sec.body}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            <Button
              label="Ask your tutor"
              onPress={handleAskTutor}
              variant="primary"
              icon={<ArrowRight size={18} color={hub.bg} />}
              iconPosition="right"
              style={styles.actionButton}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  eyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
    marginBottom: spacing.xxs,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.base,
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  cachedText: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1,
  },
  segmentsContainer: {
    flexDirection: 'row',
    borderRadius: radii.chip,
    padding: 2,
    marginBottom: spacing.base,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: radii.sm,
  },
  segmentText: {
    fontSize: typography.sizes.sm,
  },
  card: {
    marginBottom: spacing.base,
    padding: spacing.base,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    marginBottom: spacing.xs,
  },
  subHeading: {
    fontSize: typography.sizes.body,
    marginBottom: 4,
  },
  sectionSpacing: {
    marginTop: spacing.md,
  },
  bodyText: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.chip,
  },
  tagText: {
    fontSize: typography.sizes.fine,
  },
  actionButton: {
    marginTop: spacing.xs,
  },
  centerState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    fontSize: typography.sizes.body,
  },
  errorCard: {
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  errorTitle: {
    fontSize: typography.sizes.sm,
  },
  errorSubtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
});
