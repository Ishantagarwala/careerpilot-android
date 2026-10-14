import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, FileText, Upload, ChevronDown, Check, X, AlertCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { radii, spacing, typography, targetSizes } from '../src/theme/tokens';
import {
  ResumeItem,
  fetchResumes,
  analyzeAts,
  getAtsDraft,
  saveAtsDraft,
  AtsAnalyzeParams,
} from '../src/api/resume';

type AtsInputMode = 'saved' | 'upload' | 'text';

export default function AtsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [mode, setMode] = useState<AtsInputMode>('saved');
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState(
    'We are looking for a frontend developer with React, JavaScript, CSS and Git experience. You should be comfortable building accessible interfaces.'
  );

  const [loadingResumes, setLoadingResumes] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resumePickerVisible, setResumePickerVisible] = useState(false);

  // Restore draft and fetch resumes
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoadingResumes(true);
      try {
        const list = await fetchResumes();
        if (isMounted) {
          setResumes(list);
          if (list.length > 0 && !selectedResumeId) {
            setSelectedResumeId(list[0]._id);
          }
        }
      } catch (err) {
        console.warn('Could not fetch resumes for ATS picker:', err);
      } finally {
        if (isMounted) setLoadingResumes(false);
      }

      // Check draft
      if (user?.id) {
        const draft = await getAtsDraft(user.id);
        if (draft && isMounted) {
          setMode(draft.mode);
          if (draft.jobDescription) setJobDescription(draft.jobDescription);
          if (draft.resumeId) setSelectedResumeId(draft.resumeId);
          if (draft.resumeText) setResumeText(draft.resumeText);
          if (draft.fileName && draft.fileUri) {
            setSelectedFile({
              name: draft.fileName,
              uri: draft.fileUri,
            });
          }
        }
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Persist draft on changes
  useEffect(() => {
    if (!user?.id) return;
    saveAtsDraft(user.id, {
      mode,
      resumeId: mode === 'saved' ? selectedResumeId || undefined : undefined,
      resumeText: mode === 'text' ? resumeText : undefined,
      jobDescription,
      fileName: mode === 'upload' ? selectedFile?.name : undefined,
      fileUri: mode === 'upload' ? selectedFile?.uri : undefined,
    });
  }, [mode, selectedResumeId, resumeText, selectedFile, jobDescription, user?.id]);

  // Pick PDF file
  const handlePickDocument = async () => {
    setErrorMessage(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const asset = res.assets[0];
      const sizeBytes = asset.size || 0;
      if (sizeBytes > 10 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 10 MB limit. Please select a smaller PDF.');
        return;
      }

      setSelectedFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType || 'application/pdf',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select PDF file.');
    }
  };

  // Validation — the rubric endpoint scores the resume itself, so a job
  // description is optional context rather than a requirement.
  let isSourceValid = false;
  if (mode === 'saved') {
    isSourceValid = Boolean(selectedResumeId);
  } else if (mode === 'upload') {
    isSourceValid = Boolean(selectedFile?.uri);
  } else if (mode === 'text') {
    isSourceValid = resumeText.trim().length >= 20;
  }

  const canAnalyze = isSourceValid && !analyzing;

  // Run ATS analysis
  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setErrorMessage(null);

    const params: AtsAnalyzeParams = {
      jobDescription: jobDescription.trim(),
    };

    // Strictly validate and pass ONLY the active mode to prevent sending stale values
    if (mode === 'saved') {
      if (!selectedResumeId) {
        setErrorMessage('Please select a saved resume.');
        setAnalyzing(false);
        return;
      }
      params.resumeId = selectedResumeId;
    } else if (mode === 'upload') {
      if (!selectedFile) {
        setErrorMessage('Please upload a resume PDF.');
        setAnalyzing(false);
        return;
      }
      params.file = {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || 'application/pdf',
      };
    } else if (mode === 'text') {
      if (!resumeText.trim() || resumeText.trim().length < 20) {
        setErrorMessage('Please paste at least 20 characters of resume content.');
        setAnalyzing(false);
        return;
      }
      params.resumeText = resumeText.trim();
    }

    try {
      const result = await analyzeAts(params);
      const selectedResume = resumes.find((r) => r._id === selectedResumeId);

      router.push({
        pathname: '/ats-result',
        params: {
          resultData: JSON.stringify(result),
          sourceMode: mode,
          resumeId: mode === 'saved' ? selectedResumeId || '' : '',
          resumeTitle: mode === 'saved' ? selectedResume?.title || 'Saved Resume' : selectedFile?.name || 'Pasted Resume',
        },
      });
    } catch (err: any) {
      const msg = err.message || 'ATS analysis failed. Check your network connection.';
      setErrorMessage(msg);
      Alert.alert('Analysis Failed', msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedResume = resumes.find((r) => r._id === selectedResumeId);

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="ATS analyzer" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          ATS RESUME ANALYZER
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Make every{'\n'}word count.
        </Text>

        <Text style={[styles.subtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
          Score your resume against the career rubric.
        </Text>

        {/* Mode Segmented Controls */}
        <View style={[styles.segmentedContainer, { backgroundColor: hub.surface, borderColor: hub.line }]}>
          {(['saved', 'upload', 'text'] as AtsInputMode[]).map((tab) => {
            const isActive = mode === tab;
            return (
              <Pressable
                key={tab}
                style={[
                  styles.segmentBtn,
                  isActive && { backgroundColor: hub.text },
                ]}
                onPress={() => {
                  setMode(tab);
                  setErrorMessage(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isActive ? hub.bg : hub.muted,
                      fontFamily: isActive ? typography.fontBodyBold : typography.fontBody,
                    },
                  ]}
                >
                  {tab === 'saved' ? 'Saved' : tab === 'upload' ? 'Upload' : 'Text'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <AlertCircle size={16} color={hub.danger} />
            <Text style={[styles.errorBannerText, { color: hub.text, fontFamily: typography.fontBody }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* MODE: Saved Resume */}
        {mode === 'saved' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
              Choose resume
            </Text>
            {loadingResumes ? (
              <View style={[styles.pickerLoading, { backgroundColor: hub.surface, borderColor: hub.line }]}>
                <ActivityIndicator size="small" color={hub.muted} />
                <Text style={[styles.pickerLoadingText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  Loading resumes…
                </Text>
              </View>
            ) : resumes.length === 0 ? (
              <Card style={styles.noResumesCard}>
                <Text style={[styles.noResumesText, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  No saved resumes found. Create a resume or switch to Upload/Text.
                </Text>
                <Button
                  label="Create resume"
                  onPress={() => router.push('/editor' as any)}
                  variant="secondary"
                  style={{ marginTop: spacing.sm }}
                />
              </Card>
            ) : (
              <Pressable
                style={[styles.resumeSelect, { backgroundColor: hub.surface, borderColor: hub.line }]}
                onPress={() => setResumePickerVisible(true)}
                accessibilityRole="combobox"
                accessibilityLabel="Choose resume for ATS analysis"
              >
                <Text style={[styles.resumeSelectText, { color: hub.text, fontFamily: typography.fontBody }]}>
                  {selectedResume?.title || 'Select a resume'}
                </Text>
                <ChevronDown size={20} color={hub.muted} />
              </Pressable>
            )}
          </View>
        )}

        {/* MODE: Upload Resume PDF */}
        {mode === 'upload' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
              Upload resume PDF
            </Text>
            {selectedFile ? (
              <Card style={styles.fileCard}>
                <View style={styles.fileRow}>
                  <FileText size={24} color={hub.muted} />
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                      {selectedFile.name}
                    </Text>
                    {selectedFile.size && (
                      <Text style={[styles.fileMeta, { color: hub.muted, fontFamily: typography.fontBody }]}>
                        {Math.round(selectedFile.size / 1024)} KB
                      </Text>
                    )}
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setSelectedFile(null)}
                    style={styles.fileRemoveBtn}
                  >
                    <X size={18} color={hub.muted} />
                  </Pressable>
                </View>
              </Card>
            ) : (
              <Pressable
                style={[styles.uploadBox, { backgroundColor: hub.surface, borderColor: hub.line }]}
                onPress={handlePickDocument}
                accessibilityRole="button"
                accessibilityLabel="Upload resume PDF"
              >
                <Upload size={28} color={hub.muted} />
                <Text style={[styles.uploadPrompt, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                  Select PDF from device
                </Text>
                <Text style={[styles.uploadSub, { color: hub.muted, fontFamily: typography.fontBody }]}>
                  Standard PDF up to 10 MB
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* MODE: Text */}
        {mode === 'text' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
              Paste resume content
            </Text>
            <TextInput
              value={resumeText}
              onChangeText={setResumeText}
              placeholder="Paste your resume text here (summary, skills, education, experience)..."
              placeholderTextColor={hub.muted}
              multiline
              numberOfLines={6}
              style={[
                styles.textArea,
                {
                  backgroundColor: hub.surface,
                  borderColor: hub.line,
                  color: hub.text,
                  fontFamily: typography.fontBody,
                },
              ]}
            />
          </View>
        )}

        {/* Job Description Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
            Target job description (optional)
          </Text>
          <TextInput
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder="Paste the job description or role requirements here..."
            placeholderTextColor={hub.muted}
            multiline
            numberOfLines={6}
            style={[
              styles.textArea,
              {
                backgroundColor: hub.surface,
                borderColor: hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
              },
            ]}
          />
        </View>

        {/* Action Button */}
        <Button
          label={analyzing ? 'Scoring resume…' : 'Score my resume'}
          onPress={handleAnalyze}
          variant="primary"
          icon={
            analyzing ? (
              <ActivityIndicator size="small" color={hub.bg} />
            ) : (
              <Sparkles size={18} color={hub.bg} />
            )
          }
          iconPosition="right"
          loading={analyzing}
          disabled={!canAnalyze}
          style={styles.analyzeButton}
        />

        <Text style={[styles.advisoryText, { color: hub.muted, fontFamily: typography.fontBody }]}>
          Scored against your career rubric, not job-description keywords. AI feedback is a
          guide, not a guarantee of ATS acceptance or employer interviews.
        </Text>
      </ScrollView>

      {/* Resume Selection Modal */}
      <Modal
        visible={resumePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResumePickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setResumePickerVisible(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: hub.surface }]}>
            <Text style={[styles.modalTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              Choose Resume
            </Text>

            {resumes.map((item) => {
              const isSelected = item._id === selectedResumeId;
              return (
                <Pressable
                  key={item._id}
                  style={[
                    styles.modalOption,
                    isSelected && { backgroundColor: hub.soft },
                  ]}
                  onPress={() => {
                    setSelectedResumeId(item._id);
                    setResumePickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      {
                        color: hub.text,
                        fontFamily: isSelected ? typography.fontBodyBold : typography.fontBody,
                      },
                    ]}
                  >
                    {item.title || 'Untitled Resume'}
                  </Text>
                  {isSelected && <Check size={18} color={hub.text} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.xl,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: targetSizes.minTouch,
  },
  segmentText: {
    fontSize: typography.sizes.body,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  errorBannerText: {
    fontSize: typography.sizes.fine,
    flex: 1,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.xs,
  },
  resumeSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    minHeight: targetSizes.minTouch,
  },
  resumeSelectText: {
    fontSize: typography.sizes.body,
  },
  pickerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  pickerLoadingText: {
    fontSize: typography.sizes.body,
  },
  noResumesCard: {
    padding: spacing.base,
  },
  noResumesText: {
    fontSize: typography.sizes.body,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.sm,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  uploadPrompt: {
    fontSize: typography.sizes.body,
    marginTop: spacing.xs,
  },
  uploadSub: {
    fontSize: typography.sizes.xs,
  },
  fileCard: {
    padding: spacing.base,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: typography.sizes.body,
  },
  fileMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  fileRemoveBtn: {
    padding: spacing.xs,
  },
  textArea: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: typography.sizes.body,
    lineHeight: 22,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  analyzeButton: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  advisoryText: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    padding: spacing.base,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.sizes.heading,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    minHeight: targetSizes.minTouch,
  },
  modalOptionText: {
    fontSize: typography.sizes.body,
  },
});
