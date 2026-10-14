import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { FileUp, FileText, X, Sparkles, AlertCircle, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { radii, spacing, targetSizes, typography } from '../src/theme/tokens';
import { uploadStudyDocument } from '../src/api/study';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface PickedPdf {
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
  formattedSize: string;
}

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();

  const [selectedFile, setSelectedFile] = useState<PickedPdf | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || isNaN(bytes)) return 'Ready to analyze';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB · Ready to analyze`;
    }
    return `${Math.round(bytes / 1024)} KB · Ready to analyze`;
  };

  const handlePickFile = async () => {
    setErrorMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      // Cancellation is neutral: do not show an error or fake selected file
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      // Validate PDF MIME / extension
      const isPdf =
        asset.name.toLowerCase().endsWith('.pdf') ||
        asset.mimeType === 'application/pdf';

      if (!isPdf) {
        setErrorMessage('Please select a valid PDF file (.pdf).');
        return;
      }

      // Validate 10 MB size limit
      if (asset.size && asset.size > MAX_BYTES) {
        setErrorMessage('File exceeds the 10 MB maximum limit. Please choose a smaller document.');
        return;
      }

      setSelectedFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size || 0,
        mimeType: asset.mimeType || 'application/pdf',
        formattedSize: formatFileSize(asset.size),
      });
    } catch (err: any) {
      console.warn('Document pick error:', err);
      setErrorMessage('Could not open the file picker. Please try again.');
    }
  };

  const handleRemoveFile = () => {
    if (uploadStatus === 'uploading' || uploadStatus === 'analyzing') return;
    setSelectedFile(null);
    setErrorMessage(null);
    setUploadStatus('idle');
  };

  const handleAnalyze = async () => {
    if (!selectedFile || uploadStatus === 'uploading' || uploadStatus === 'analyzing') return;

    setErrorMessage(null);
    setUploadStatus('uploading');

    const formData = new FormData();
    formData.append('file', {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.mimeType || 'application/pdf',
    } as any);

    try {
      // Switch to analyzing state to indicate server-side AI processing
      setTimeout(() => {
        setUploadStatus('analyzing');
      }, 1200);

      const res = await uploadStudyDocument(formData);

      if (res && res.docId) {
        // Successfully analyzed: transition to document summary
        router.replace({
          pathname: '/document',
          params: { docId: res.docId },
        } as any);
      } else {
        throw new Error('Upload finished but no study document was returned.');
      }
    } catch (err: any) {
      console.error('Upload analysis failed:', err);
      setUploadStatus('error');
      setErrorMessage(
        err?.message ||
          'Failed to upload and analyze document. Please check your network or try another file.'
      );
    }
  };

  const isBusy = uploadStatus === 'uploading' || uploadStatus === 'analyzing';

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Upload PDF" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          ADD STUDY MATERIAL
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Bring your{'\n'}notes along.
        </Text>

        <Text style={[styles.subtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
          Choose a PDF of your notes, slides or a textbook chapter.
        </Text>

        {/* Error banner */}
        {errorMessage && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: hub.soft, borderColor: hub.danger },
            ]}
          >
            <AlertCircle size={16} color={hub.danger} />
            <Text style={[styles.errorText, { color: hub.text, fontFamily: typography.fontBody }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {!selectedFile ? (
          /* Dropzone */
          <Pressable
            onPress={handlePickFile}
            style={[styles.dropzone, { backgroundColor: hub.surface, borderColor: hub.line }]}
            accessibilityRole="button"
            accessibilityLabel="Choose a PDF file from device"
          >
            <FileUp size={32} color={hub.text} />
            <Text style={[styles.dropzoneTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
              Choose a PDF
            </Text>
            <Text style={[styles.dropzoneSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
              From files on your device
            </Text>
            <View style={[styles.limitBadge, { backgroundColor: hub.soft }]}>
              <Text style={[styles.limitText, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
                PDF · up to 10 MB
              </Text>
            </View>
          </Pressable>
        ) : (
          /* Selected File View */
          <View style={styles.selectedContainer}>
            <View style={[styles.fileRow, { backgroundColor: hub.surface, borderColor: hub.line }]}>
              <FileText size={24} color={hub.text} />
              <View style={styles.fileInfo}>
                <Text
                  style={[styles.fileName, { color: hub.text, fontFamily: typography.fontBodyBold }]}
                  numberOfLines={1}
                >
                  {selectedFile.name}
                </Text>
                <Text style={[styles.fileSize, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  {selectedFile.formattedSize}
                </Text>
              </View>
              <Pressable
                onPress={handleRemoveFile}
                disabled={isBusy}
                style={styles.removeButton}
                accessibilityRole="button"
                accessibilityLabel="Remove selected file"
              >
                <X size={18} color={isBusy ? hub.muted : hub.text} />
              </Pressable>
            </View>

            {/* Progress indicators */}
            {uploadStatus === 'uploading' && (
              <View style={styles.statusBox}>
                <ActivityIndicator size="small" color={hub.muted} />
                <Text style={[styles.statusText, { color: hub.text, fontFamily: typography.fontBody }]}>
                  Uploading document…
                </Text>
              </View>
            )}

            {uploadStatus === 'analyzing' && (
              <View style={styles.statusBox}>
                <ActivityIndicator size="small" color={hub.muted} />
                <Text style={[styles.statusText, { color: hub.text, fontFamily: typography.fontBody }]}>
                  Analyzing notes with AI…
                </Text>
              </View>
            )}

            <Button
              label={isBusy ? (uploadStatus === 'uploading' ? 'Uploading…' : 'Analyzing…') : 'Analyze document'}
              onPress={handleAnalyze}
              disabled={isBusy}
              variant="primary"
              icon={
                isBusy ? (
                  <ActivityIndicator size="small" color={hub.bg} />
                ) : (
                  <Sparkles size={18} color={hub.bg} />
                )
              }
              iconPosition="right"
              style={styles.analyzeButton}
            />

            {uploadStatus === 'error' && (
              <Button
                label="Retry analysis"
                onPress={handleAnalyze}
                variant="secondary"
                icon={<RotateCcw size={16} color={hub.text} />}
                iconPosition="left"
              />
            )}
          </View>
        )}

        <Text style={[styles.finePrint, { color: hub.muted, fontFamily: typography.fontBody }]}>
          After analysis, your summary and practice questions will be available in your study library.
        </Text>
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
    marginBottom: spacing.xl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.base,
    gap: spacing.xs,
  },
  dropzoneTitle: {
    fontSize: typography.sizes.md,
    marginTop: spacing.xs,
  },
  dropzoneSubtitle: {
    fontSize: typography.sizes.sm,
  },
  limitBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.chip,
  },
  limitText: {
    fontSize: typography.sizes.fine,
  },
  selectedContainer: {
    gap: spacing.base,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: typography.sizes.body,
  },
  fileSize: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  removeButton: {
    width: targetSizes.iconTouch,
    height: targetSizes.iconTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontSize: typography.sizes.body,
  },
  analyzeButton: {
    marginTop: spacing.xs,
  },
  finePrint: {
    fontSize: typography.sizes.xs,
    lineHeight: 18,
    marginTop: spacing.xl,
  },
});
