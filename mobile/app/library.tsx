import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  FileText,
  ChevronRight,
  Check,
  ArrowRight,
  RotateCcw,
  BookOpen,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  StudyDocument,
  SelectedDocContext,
  fetchDocuments,
  getCachedDocuments,
  setCachedDocuments,
  getStoredSelectedDocs,
  setStoredSelectedDocs,
} from '../src/api/study';

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<SelectedDocContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Load active selection from storage
    const stored = await getStoredSelectedDocs();
    setSelectedDocs(stored);

    // Try reading cached documents
    if (user?.id) {
      const cached = await getCachedDocuments(user.id);
      if (cached && cached.length > 0) {
        setDocuments(cached);
        setLoading(false);
      }
    }

    try {
      const liveDocs = await fetchDocuments();
      const list = Array.isArray(liveDocs) ? liveDocs : [];
      setDocuments(list);
      if (user?.id) {
        await setCachedDocuments(user.id, list);
      }
    } catch (err: any) {
      console.warn('Failed to fetch documents:', err);
      if (documents.length === 0) {
        setError(err?.message || 'Could not load study library. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isDocSelected = (docId: string) => {
    return selectedDocs.some((d) => d.id === docId);
  };

  const toggleSelect = async (doc: StudyDocument) => {
    const docId = doc._id;
    if (isDocSelected(docId)) {
      const next = selectedDocs.filter((d) => d.id !== docId);
      setSelectedDocs(next);
      await setStoredSelectedDocs(next);
    } else {
      if (selectedDocs.length >= 3) {
        Alert.alert(
          'Selection Limit',
          'You can select up to 3 PDFs for your study session. Please deselect another document before adding this one.'
        );
        return;
      }
      const next = [...selectedDocs, { id: docId, filename: doc.filename }];
      setSelectedDocs(next);
      await setStoredSelectedDocs(next);
    }
  };

  const handleOpenDoc = (docId: string) => {
    router.push({
      pathname: '/document',
      params: { docId },
    } as any);
  };

  const handleUseSelected = async () => {
    await setStoredSelectedDocs(selectedDocs);
    router.push('/(tabs)/study' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Study materials" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          YOUR STUDY LIBRARY
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Turn your notes{'\n'}into understanding.
        </Text>

        <Text style={[styles.subtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
          Select up to 3 PDFs for your conversation.
        </Text>

        <Button
          label="Upload a PDF"
          onPress={() => router.push('/upload' as any)}
          variant="primary"
          icon={<Plus size={18} color={hub.bg} />}
          iconPosition="left"
          style={styles.uploadButton}
        />

        {/* Loading */}
        {loading && documents.length === 0 && (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="small" color={hub.muted} />
            <Text style={[styles.stateText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Loading library…
            </Text>
          </View>
        )}

        {/* Error */}
        {error && documents.length === 0 && (
          <View style={[styles.errorCard, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <Text style={[styles.errorTitle, { color: hub.danger, fontFamily: typography.fontBodyBold }]}>
              Could not load library
            </Text>
            <Text style={[styles.errorSubtitle, { color: hub.text, fontFamily: typography.fontBody }]}>
              {error}
            </Text>
            <Button
              label="Retry"
              onPress={loadData}
              variant="secondary"
              icon={<RotateCcw size={16} color={hub.text} />}
              style={styles.retryBtn}
            />
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && documents.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: hub.soft }]}>
              <BookOpen size={28} color={hub.text} />
            </View>
            <Text style={[styles.emptyTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              No study materials yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Upload lecture notes, slides, or chapters to generate summaries and practice questions.
            </Text>
          </View>
        )}

        {/* Materials List */}
        {documents.length > 0 && (
          <View style={styles.materialsList}>
            {documents.map((item) => {
              const isSelected = isDocSelected(item._id);
              const summarySnippet = item.summary
                ? item.summary.replace(/[#*`\n]/g, ' ').trim().slice(0, 70) + '…'
                : 'Ready for study and questions';

              return (
                <View
                  key={item._id}
                  style={[styles.materialRow, { backgroundColor: hub.surface, borderColor: hub.line }]}
                >
                  <Pressable
                    onPress={() => toggleSelect(item)}
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isSelected ? hub.primary : hub.line,
                        backgroundColor: isSelected ? hub.primary : 'transparent',
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`Select ${item.filename} for study session`}
                  >
                    {isSelected && <Check size={14} color={hub.primaryForeground} />}
                  </Pressable>

                  <Pressable
                    onPress={() => handleOpenDoc(item._id)}
                    style={styles.materialContent}
                    accessibilityRole="button"
                    accessibilityLabel={`Open summary for ${item.filename}`}
                  >
                    <FileText size={20} color={hub.text} />
                    <View style={styles.materialText}>
                      <Text
                        style={[styles.materialTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}
                        numberOfLines={1}
                      >
                        {item.filename}
                      </Text>
                      <Text
                        style={[styles.materialSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}
                        numberOfLines={1}
                      >
                        {summarySnippet}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={hub.muted} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {documents.length > 0 && (
          <Button
            label="Use selected materials"
            onPress={handleUseSelected}
            variant="secondary"
            icon={<ArrowRight size={18} color={hub.text} />}
            iconPosition="right"
            style={styles.useButton}
          />
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
    marginBottom: spacing.xxs,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.lg,
  },
  uploadButton: {
    marginBottom: spacing.xl,
  },
  materialsList: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  materialContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  materialText: {
    flex: 1,
  },
  materialTitle: {
    fontSize: typography.sizes.body,
  },
  materialSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  useButton: {
    marginTop: spacing.xs,
  },
  stateCenter: {
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
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.sizes.subheading,
  },
  emptySubtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
});
