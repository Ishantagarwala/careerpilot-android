import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share2, FileCode, AlertCircle, Edit3 } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { useTheme } from '../src/theme/ThemeContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { LoadingStateView } from '../src/components/primitives/StateView';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  ResumeDetail,
  DEFAULT_RESUME_CONTENT,
  fetchResume,
  fetchResumes,
  getResumeDraft,
  generateResumeHtml,
} from '../src/api/resume';
import { getApiBaseUrl, getStoredToken } from '../src/api/client';

export default function ResumePreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();

  const [resumeId, setResumeId] = useState<string | null>(params.id || null);
  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [isDraftPreview, setIsDraftPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadResume = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let targetId = params.id;
      if (!targetId) {
        const list = await fetchResumes();
        if (list.length > 0) {
          targetId = list[0]._id;
        } else {
          throw new Error('No resumes found. Create a resume first.');
        }
      }

      setResumeId(targetId);
      const serverDetail = await fetchResume(targetId);

      // Check if draft exists
      const draft = await getResumeDraft(targetId);
      if (draft && draft.content) {
        const draftTime = draft.savedAt || 0;
        const serverTime = serverDetail.updatedAt ? new Date(serverDetail.updatedAt).getTime() : 0;
        if (draftTime > serverTime) {
          setIsDraftPreview(true);
          setResume({
            ...serverDetail,
            title: draft.title || serverDetail.title,
            content: {
              ...DEFAULT_RESUME_CONTENT,
              ...draft.content,
              personalInfo: {
                ...DEFAULT_RESUME_CONTENT.personalInfo,
                ...(draft.content.personalInfo || {}),
              },
              skills: {
                ...DEFAULT_RESUME_CONTENT.skills,
                ...(draft.content.skills || {}),
              },
            },
          });
          return;
        }
      }

      setIsDraftPreview(false);
      setResume(serverDetail);
    } catch (err: any) {
      setError(err.message || 'Failed to load resume preview.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const handleExportPdf = async () => {
    if (!resume || exporting) return;
    setExporting(true);
    try {
      const html = generateResumeHtml(resume);

      // Real PDF generation on device using expo-print
      const { uri } = await Print.printToFileAsync({
        html,
        margins: {
          left: 20,
          top: 20,
          right: 20,
          bottom: 20,
        },
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${resume.title || 'Resume'}.pdf`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'PDF Generated',
          `Your resume PDF has been created successfully at:\n${uri}`
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Export Failed',
        err.message || 'Could not export or share PDF. Please try again.'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadLatex = async () => {
    if (!resumeId) return;
    try {
      const token = await getStoredToken();
      const url = `${getApiBaseUrl()}/api/resume/${resumeId}/latex`;
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert(
        'Download LaTeX Failed',
        err.message || 'Could not open LaTeX source download.'
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Resume preview" isRoot={false} />
        <LoadingStateView message="Preparing document preview…" />
      </View>
    );
  }

  if (error || !resume) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Resume preview" isRoot={false} />
        <View style={styles.errorContainer}>
          <AlertCircle size={40} color={hub.danger} />
          <Text style={[styles.errorTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
            Unable to load preview
          </Text>
          <Text style={[styles.errorSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
            {error || 'No resume data available.'}
          </Text>
          <Button
            label="Back to resumes"
            onPress={() => router.replace('/resumes' as any)}
            variant="secondary"
            style={{ marginTop: spacing.base }}
          />
        </View>
      </View>
    );
  }

  const content = resume.content || DEFAULT_RESUME_CONTENT;
  const personal = content.personalInfo || {};
  const skills = content.skills || { technical: [], frameworks: [], tools: [], soft: [] };

  const contactPieces = [
    personal.location,
    personal.email,
    personal.phone,
    personal.linkedin,
    personal.github,
    personal.portfolio,
  ].filter(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Resume preview" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          RESUME PREVIEW
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Ready for{'\n'}a closer look.
        </Text>

        {isDraftPreview && (
          <View style={[styles.draftBanner, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <Edit3 size={14} color={hub.muted} />
            <Text style={[styles.draftBannerText, { color: hub.text, fontFamily: typography.fontBody }]}>
              Showing latest unsaved edits from your editor draft.
            </Text>
          </View>
        )}

        {/* Paper Surface Document View */}
        <View style={styles.paperDocument}>
          {/* Header */}
          <Text style={styles.docFullName}>
            {personal.fullName || 'Your Name'}
          </Text>

          {contactPieces.length > 0 && (
            <Text style={styles.docContactText}>
              {contactPieces.join('  ·  ')}
            </Text>
          )}

          <View style={styles.docDivider} />

          {/* Summary */}
          {Boolean(personal.summary) && (
            <View style={styles.docSection}>
              <Text style={styles.docSectionTitle}>SUMMARY</Text>
              <Text style={styles.docBodyText}>{personal.summary}</Text>
            </View>
          )}

          {/* Education */}
          {(content.education || []).length > 0 && (
            <View style={styles.docSection}>
              <Text style={styles.docSectionTitle}>EDUCATION</Text>
              {content.education.map((edu, idx) => (
                <View key={idx} style={styles.docEntry}>
                  <View style={styles.docRow}>
                    <Text style={styles.docEntryHeading}>{edu.institution}</Text>
                    <Text style={styles.docEntryMeta}>
                      {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                    </Text>
                  </View>
                  <Text style={styles.docEntrySub}>
                    {[edu.degree, edu.field].filter(Boolean).join(' in ')}
                    {edu.gpa ? ` | CGPA: ${edu.gpa}` : ''}
                  </Text>
                  {(edu.achievements || []).filter(Boolean).map((ach, aIdx) => (
                    <Text key={aIdx} style={styles.docBullet}>
                      • {ach}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Experience */}
          {(content.experience || []).length > 0 && (
            <View style={styles.docSection}>
              <Text style={styles.docSectionTitle}>EXPERIENCE</Text>
              {content.experience.map((exp, idx) => (
                <View key={idx} style={styles.docEntry}>
                  <View style={styles.docRow}>
                    <Text style={styles.docEntryHeading}>
                      {exp.company} – {exp.title}
                    </Text>
                    <Text style={styles.docEntryMeta}>
                      {[exp.startDate, exp.current ? 'Present' : exp.endDate]
                        .filter(Boolean)
                        .join(' – ')}
                    </Text>
                  </View>
                  {Boolean(exp.location) && (
                    <Text style={styles.docEntrySub}>{exp.location}</Text>
                  )}
                  {(exp.bullets || []).filter(Boolean).map((bullet, bIdx) => (
                    <Text key={bIdx} style={styles.docBullet}>
                      • {bullet}
                    </Text>
                  ))}
                  {Boolean(exp.technologies && exp.technologies.length > 0) && (
                    <Text style={styles.docTechStack}>
                      Technologies: {exp.technologies?.join(', ')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Projects */}
          {(content.projects || []).length > 0 && (
            <View style={styles.docSection}>
              <Text style={styles.docSectionTitle}>PROJECTS</Text>
              {content.projects.map((proj, idx) => (
                <View key={idx} style={styles.docEntry}>
                  <View style={styles.docRow}>
                    <Text style={styles.docEntryHeading}>
                      {proj.name}
                      {proj.technologies?.length ? ` | ${proj.technologies.join(', ')}` : ''}
                    </Text>
                    <Text style={styles.docEntryMeta}>{proj.year || ''}</Text>
                  </View>
                  {Boolean(proj.github || proj.url) && (
                    <Text style={styles.docEntrySub}>{proj.github || proj.url}</Text>
                  )}
                  {Boolean(proj.description) && (
                    <Text style={styles.docBodyText}>{proj.description}</Text>
                  )}
                  {(proj.bullets || []).filter(Boolean).map((bullet, bIdx) => (
                    <Text key={bIdx} style={styles.docBullet}>
                      • {bullet}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Technical Skills */}
          {((skills.technical?.length || 0) > 0 ||
            (skills.frameworks?.length || 0) > 0 ||
            (skills.tools?.length || 0) > 0 ||
            (skills.soft?.length || 0) > 0) && (
            <View style={styles.docSection}>
              <Text style={styles.docSectionTitle}>TECHNICAL SKILLS</Text>
              {skills.technical?.length > 0 && (
                <Text style={styles.docSkillLine}>
                  <Text style={styles.boldText}>Languages: </Text>
                  {skills.technical.join(', ')}
                </Text>
              )}
              {skills.frameworks?.length > 0 && (
                <Text style={styles.docSkillLine}>
                  <Text style={styles.boldText}>AI/ML & Frameworks: </Text>
                  {skills.frameworks.join(', ')}
                </Text>
              )}
              {skills.tools?.length > 0 && (
                <Text style={styles.docSkillLine}>
                  <Text style={styles.boldText}>Developer Tools: </Text>
                  {skills.tools.join(', ')}
                </Text>
              )}
              {skills.soft?.length > 0 && (
                <Text style={styles.docSkillLine}>
                  <Text style={styles.boldText}>Interpersonal: </Text>
                  {skills.soft.join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Certifications */}
          {(content.certifications || []).length > 0 && (
            <View style={styles.docSection}>
              <Text style={styles.docSectionTitle}>CERTIFICATIONS</Text>
              {content.certifications.map((cert, idx) => (
                <View key={idx} style={styles.docEntry}>
                  <View style={styles.docRow}>
                    <Text style={styles.docEntryHeading}>{cert.name}</Text>
                    <Text style={styles.docEntryMeta}>{cert.date || ''}</Text>
                  </View>
                  {Boolean(cert.issuer) && (
                    <Text style={styles.docEntrySub}>
                      {cert.issuer}
                      {cert.url ? ` | ${cert.url}` : ''}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Custom Sections */}
          {(content.customSections || []).map((sec, sIdx) =>
            sec.title && sec.items?.length > 0 ? (
              <View key={sIdx} style={styles.docSection}>
                <Text style={styles.docSectionTitle}>{sec.title.toUpperCase()}</Text>
                {sec.items.map((item, iIdx) => (
                  <View key={iIdx} style={styles.docEntry}>
                    <View style={styles.docRow}>
                      <Text style={styles.docEntryHeading}>{item.heading}</Text>
                      <Text style={styles.docEntryMeta}>{item.date || ''}</Text>
                    </View>
                    {Boolean(item.subheading) && (
                      <Text style={styles.docEntrySub}>{item.subheading}</Text>
                    )}
                    {(item.bullets || []).filter(Boolean).map((bullet, bIdx) => (
                      <Text key={bIdx} style={styles.docBullet}>
                        • {bullet}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : null
          )}
        </View>

        {/* Action Buttons matching mockup */}
        <View style={styles.actionsContainer}>
          <Button
            label={exporting ? 'Generating PDF…' : 'Export / share PDF'}
            onPress={handleExportPdf}
            variant="primary"
            icon={
              exporting ? (
                <ActivityIndicator size="small" color={hub.bg} />
              ) : (
                <Share2 size={18} color={hub.bg} />
              )
            }
            iconPosition="right"
            loading={exporting}
            style={styles.exportBtn}
          />

          <Button
            label="Keep editing"
            onPress={() => {
              if (resumeId) {
                router.push({
                  pathname: '/editor',
                  params: { id: resumeId },
                });
              } else {
                router.back();
              }
            }}
            variant="secondary"
            style={styles.keepEditingBtn}
          />

          {/* Discreet LaTeX source option per P26 requirements */}
          <Pressable
            hitSlop={8}
            onPress={handleDownloadLatex}
            style={styles.latexLink}
            accessibilityRole="link"
            accessibilityLabel="Download LaTeX source code"
          >
            <FileCode size={14} color={hub.muted} />
            <Text style={[styles.latexLinkText, { color: hub.muted, fontFamily: typography.fontBody }]}>
              Download LaTeX (.tex) source
            </Text>
          </Pressable>
        </View>
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
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  draftBannerText: {
    fontSize: typography.sizes.xs,
    flex: 1,
  },
  paperDocument: {
    backgroundColor: '#ffffff',
    borderRadius: radii.sm,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  docFullName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  docContactText: {
    fontSize: 11,
    color: '#555555',
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  docDivider: {
    height: 1.5,
    backgroundColor: '#111111',
    marginVertical: spacing.md,
  },
  docSection: {
    marginBottom: spacing.md,
  },
  docSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    paddingBottom: 2,
    marginBottom: 6,
  },
  docBodyText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#222222',
  },
  docEntry: {
    marginBottom: 8,
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  docEntryHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
    flex: 1,
    paddingRight: spacing.xs,
  },
  docEntryMeta: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#555555',
  },
  docEntrySub: {
    fontSize: 11,
    color: '#444444',
    fontStyle: 'italic',
    marginTop: 1,
  },
  docBullet: {
    fontSize: 11,
    lineHeight: 16,
    color: '#222222',
    marginLeft: 4,
    marginTop: 2,
  },
  docTechStack: {
    fontSize: 10.5,
    color: '#555555',
    marginTop: 2,
  },
  docSkillLine: {
    fontSize: 11,
    lineHeight: 17,
    color: '#222222',
    marginBottom: 2,
  },
  boldText: {
    fontWeight: '700',
    color: '#111111',
  },
  actionsContainer: {
    gap: spacing.sm,
  },
  exportBtn: {
    marginBottom: spacing.xxs,
  },
  keepEditingBtn: {
    marginBottom: spacing.sm,
  },
  latexLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  latexLinkText: {
    fontSize: typography.sizes.xs,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.sizes.heading,
  },
  errorSubtitle: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
  },
});
