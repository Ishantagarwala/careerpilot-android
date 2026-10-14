import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Eye,
  AlertCircle,
  Save,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Field } from '../src/components/primitives/Field';
import { Button } from '../src/components/primitives/Button';
import { Card } from '../src/components/primitives/Card';
import { LoadingStateView } from '../src/components/primitives/StateView';
import { radii, spacing, typography, targetSizes } from '../src/theme/tokens';
import {
  ResumeContent,
  ResumeDetail,
  DEFAULT_RESUME_CONTENT,
  fetchResume,
  updateResume,
  getResumeDraft,
  saveResumeDraft,
  clearResumeDraft,
  fetchResumes,
  createResume,
} from '../src/api/resume';

type SectionKey =
  | 'personal'
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'custom';

const SECTION_OPTIONS: { key: SectionKey; label: string }[] = [
  { key: 'personal', label: 'Personal information' },
  { key: 'education', label: 'Education' },
  { key: 'experience', label: 'Experience' },
  { key: 'projects', label: 'Projects' },
  { key: 'skills', label: 'Skills' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'custom', label: 'Custom sections' },
];

export default function ResumeEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [resumeId, setResumeId] = useState<string | null>(params.id || null);
  const [title, setTitle] = useState('My Resume');
  const [content, setContent] = useState<ResumeContent>(DEFAULT_RESUME_CONTENT);
  const [activeSection, setActiveSection] = useState<SectionKey>('personal');
  const [sectionModalVisible, setSectionModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initialServerSnapshotRef = useRef<string>('');
  const isDirtyRef = useRef(false);

  // Check dirty state
  const currentSnapshot = JSON.stringify({ title, content });
  const isDirty = initialServerSnapshotRef.current !== '' && currentSnapshot !== initialServerSnapshotRef.current;
  isDirtyRef.current = isDirty;

  // Load resume & draft
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoading(true);
      setErrorMessage(null);
      let targetId = params.id;

      try {
        if (!targetId) {
          // If no ID passed, try fetching existing or create a new one
          const list = await fetchResumes();
          if (list.length > 0) {
            targetId = list[0]._id;
          } else {
            const created = await createResume('My Resume');
            targetId = created._id;
          }
          if (isMounted) setResumeId(targetId);
        }

        if (!targetId) throw new Error('Resume ID not found');

        const detail = await fetchResume(targetId);
        if (!isMounted) return;

        let loadedTitle = detail.title || 'My Resume';
        let loadedContent: ResumeContent = {
          ...DEFAULT_RESUME_CONTENT,
          ...(detail.content || {}),
          personalInfo: {
            ...DEFAULT_RESUME_CONTENT.personalInfo,
            ...(detail.content?.personalInfo || {}),
          },
          skills: {
            ...DEFAULT_RESUME_CONTENT.skills,
            ...(detail.content?.skills || {}),
          },
        };

        initialServerSnapshotRef.current = JSON.stringify({
          title: loadedTitle,
          content: loadedContent,
        });

        // Check local draft
        const draft = await getResumeDraft(targetId);
        if (draft && draft.content) {
          const draftTime = draft.savedAt || 0;
          const serverTime = detail.updatedAt ? new Date(detail.updatedAt).getTime() : 0;
          if (draftTime > serverTime) {
            loadedTitle = draft.title || loadedTitle;
            loadedContent = {
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
            };
          }
        }

        setTitle(loadedTitle);
        setContent(loadedContent);
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load resume details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [params.id]);

  // Debounced draft saving
  useEffect(() => {
    if (!resumeId || loading) return;
    if (isDirty) {
      saveResumeDraft(resumeId, { title, content });
    }
  }, [resumeId, title, content, isDirty, loading]);

  // Explicit Save
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!resumeId || saving) return false;
    setSaving(true);
    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const updated = await updateResume(resumeId, {
        title,
        content,
      });

      initialServerSnapshotRef.current = JSON.stringify({
        title: updated.title,
        content: updated.content,
      });

      await clearResumeDraft(resumeId);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return true;
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Failed to save resume changes.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [resumeId, title, content, saving]);

  // Back Navigation Guard (Hardware Back & Header Back)
  const handleBackPress = useCallback(() => {
    if (isDirtyRef.current && !saving) {
      Alert.alert(
        'Unsaved changes',
        'You have unsaved changes to this resume. Would you like to save them before leaving?',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              if (resumeId) {
                await clearResumeDraft(resumeId);
              }
              router.back();
            },
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              const success = await handleSave();
              if (success) {
                router.back();
              }
            },
          },
        ]
      );
      return true;
    }
    router.back();
    return true;
  }, [handleSave, resumeId, router, saving]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);

  // Helpers for updating content sections
  const updatePersonalInfo = (key: keyof ResumeContent['personalInfo'], val: string) => {
    setContent((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [key]: val,
      },
    }));
  };

  const updateSkillsCategory = (cat: keyof ResumeContent['skills'], commaSeparated: string) => {
    const arr = commaSeparated
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setContent((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        [cat]: arr,
      },
    }));
  };

  // Education Helpers
  const addEducation = () => {
    setContent((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          institution: '',
          degree: '',
          field: '',
          startDate: '',
          endDate: '',
          gpa: '',
          achievements: [],
        },
      ],
    }));
  };

  const removeEducation = (index: number) => {
    const target = content.education[index];
    if (target?.institution || target?.degree) {
      Alert.alert('Remove Education', 'Remove this education entry?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setContent((prev) => ({
              ...prev,
              education: prev.education.filter((_, i) => i !== index),
            }));
          },
        },
      ]);
      return;
    }
    setContent((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  // Experience Helpers
  const addExperience = () => {
    setContent((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          company: '',
          title: '',
          location: '',
          startDate: '',
          endDate: '',
          current: false,
          bullets: [],
          technologies: [],
        },
      ],
    }));
  };

  const removeExperience = (index: number) => {
    const target = content.experience[index];
    if (target?.company || target?.title) {
      Alert.alert('Remove Experience', 'Remove this experience entry?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setContent((prev) => ({
              ...prev,
              experience: prev.experience.filter((_, i) => i !== index),
            }));
          },
        },
      ]);
      return;
    }
    setContent((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }));
  };

  // Project Helpers
  const addProject = () => {
    setContent((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          name: '',
          description: '',
          technologies: [],
          url: '',
          github: '',
          bullets: [],
        },
      ],
    }));
  };

  const removeProject = (index: number) => {
    const target = content.projects[index];
    if (target?.name) {
      Alert.alert('Remove Project', 'Remove this project entry?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setContent((prev) => ({
              ...prev,
              projects: prev.projects.filter((_, i) => i !== index),
            }));
          },
        },
      ]);
      return;
    }
    setContent((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  };

  // Certification Helpers
  const addCertification = () => {
    setContent((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        { name: '', issuer: '', date: '', url: '' },
      ],
    }));
  };

  const removeCertification = (index: number) => {
    setContent((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  };

  // Custom Section Helpers
  const addCustomSection = () => {
    setContent((prev) => ({
      ...prev,
      customSections: [
        ...prev.customSections,
        {
          title: 'Additional Section',
          items: [{ heading: '', subheading: '', date: '', link: '', bullets: [] }],
        },
      ],
    }));
  };

  const removeCustomSection = (index: number) => {
    setContent((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: hub.bg }]}>
        <AppHeader title="Edit resume" isRoot={false} onBackPress={handleBackPress} />
        <LoadingStateView message="Loading resume…" />
      </View>
    );
  }

  const activeOption = SECTION_OPTIONS.find((s) => s.key === activeSection) || SECTION_OPTIONS[0];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: hub.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader
        title="Edit resume"
        isRoot={false}
        onBackPress={handleBackPress}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header matching mockup */}
        <View style={styles.topMetaRow}>
          <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
            {(title || 'SOFTWARE ENGINEERING').toUpperCase()}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => handleSave()}
            disabled={saving}
            style={styles.headerSaveBtn}
          >
            <Text
              style={[
                styles.headerSaveText,
                {
                  color: isDirty ? hub.text : hub.muted,
                  fontFamily: typography.fontBodyBold,
                },
              ]}
            >
              {saving ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          Your resume,{'\n'}one section at a time.
        </Text>

        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <AlertCircle size={16} color={hub.danger} />
            <Text style={[styles.errorBannerText, { color: hub.text, fontFamily: typography.fontBody }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Section Picker Control */}
        <View style={styles.sectionControlGroup}>
          <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
            Section
          </Text>
          <Pressable
            style={[
              styles.sectionPicker,
              { backgroundColor: hub.surface, borderColor: hub.line },
            ]}
            onPress={() => setSectionModalVisible(true)}
            accessibilityRole="combobox"
            accessibilityLabel="Select resume section"
          >
            <Text style={[styles.sectionPickerText, { color: hub.text, fontFamily: typography.fontBody }]}>
              {activeOption.label}
            </Text>
            <ChevronDown size={20} color={hub.muted} />
          </Pressable>
        </View>

        {/* SECTION 1: Personal Information */}
        {activeSection === 'personal' && (
          <View style={styles.formSection}>
            <Field
              label="Resume title"
              placeholder="e.g. Software Engineering Resume"
              value={title}
              onChangeText={setTitle}
            />

            <Field
              label="Full name"
              placeholder="e.g. Aritra"
              value={content.personalInfo.fullName || ''}
              onChangeText={(val) => updatePersonalInfo('fullName', val)}
            />

            <Field
              label="Email"
              placeholder="e.g. student@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={content.personalInfo.email || ''}
              onChangeText={(val) => updatePersonalInfo('email', val)}
            />

            <Field
              label="Phone number"
              placeholder="e.g. +1 555-0199"
              keyboardType="phone-pad"
              value={content.personalInfo.phone || ''}
              onChangeText={(val) => updatePersonalInfo('phone', val)}
            />

            <Field
              label="Location"
              placeholder="e.g. Kolkata, India"
              value={content.personalInfo.location || ''}
              onChangeText={(val) => updatePersonalInfo('location', val)}
            />

            <Field
              label="LinkedIn URL"
              placeholder="e.g. linkedin.com/in/aritra"
              autoCapitalize="none"
              value={content.personalInfo.linkedin || ''}
              onChangeText={(val) => updatePersonalInfo('linkedin', val)}
            />

            <Field
              label="GitHub URL"
              placeholder="e.g. github.com/aritraio"
              autoCapitalize="none"
              value={content.personalInfo.github || ''}
              onChangeText={(val) => updatePersonalInfo('github', val)}
            />

            <Field
              label="Portfolio / Website URL"
              placeholder="e.g. aritra.dev"
              autoCapitalize="none"
              value={content.personalInfo.portfolio || ''}
              onChangeText={(val) => updatePersonalInfo('portfolio', val)}
            />

            <Field
              label="Professional summary"
              placeholder="Concise overview of your background, career focus and goals."
              value={content.personalInfo.summary || ''}
              onChangeText={(val) => updatePersonalInfo('summary', val)}
              multiline
              numberOfLines={4}
            />
          </View>
        )}

        {/* SECTION 2: Education */}
        {activeSection === 'education' && (
          <View style={styles.formSection}>
            {content.education.map((edu, idx) => (
              <Card key={idx} style={styles.entryCard}>
                <View style={styles.entryCardHeader}>
                  <Text style={[styles.entryCardTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                    Education #{idx + 1}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => removeEducation(idx)}>
                    <Trash2 size={16} color={hub.muted} />
                  </Pressable>
                </View>

                <Field
                  label="Institution"
                  placeholder="e.g. University of Technology"
                  value={edu.institution}
                  onChangeText={(val) => {
                    const copy = [...content.education];
                    copy[idx].institution = val;
                    setContent((p) => ({ ...p, education: copy }));
                  }}
                />

                <Field
                  label="Degree"
                  placeholder="e.g. Bachelor of Technology"
                  value={edu.degree || ''}
                  onChangeText={(val) => {
                    const copy = [...content.education];
                    copy[idx].degree = val;
                    setContent((p) => ({ ...p, education: copy }));
                  }}
                />

                <Field
                  label="Field of study"
                  placeholder="e.g. Computer Science"
                  value={edu.field || ''}
                  onChangeText={(val) => {
                    const copy = [...content.education];
                    copy[idx].field = val;
                    setContent((p) => ({ ...p, education: copy }));
                  }}
                />

                <View style={styles.rowFields}>
                  <View style={styles.flexField}>
                    <Field
                      label="Start date"
                      placeholder="e.g. 2022"
                      value={edu.startDate || ''}
                      onChangeText={(val) => {
                        const copy = [...content.education];
                        copy[idx].startDate = val;
                        setContent((p) => ({ ...p, education: copy }));
                      }}
                    />
                  </View>
                  <View style={styles.flexField}>
                    <Field
                      label="End date"
                      placeholder="e.g. 2026"
                      value={edu.endDate || ''}
                      onChangeText={(val) => {
                        const copy = [...content.education];
                        copy[idx].endDate = val;
                        setContent((p) => ({ ...p, education: copy }));
                      }}
                    />
                  </View>
                </View>

                <Field
                  label="GPA / CGPA (Optional)"
                  placeholder="e.g. 8.9 / 10"
                  value={edu.gpa || ''}
                  onChangeText={(val) => {
                    const copy = [...content.education];
                    copy[idx].gpa = val;
                    setContent((p) => ({ ...p, education: copy }));
                  }}
                />

                <Field
                  label="Key Achievements / Relevant Coursework"
                  placeholder="One point per line"
                  value={(edu.achievements || []).join('\n')}
                  onChangeText={(val) => {
                    const copy = [...content.education];
                    copy[idx].achievements = val.split('\n').filter(Boolean);
                    setContent((p) => ({ ...p, education: copy }));
                  }}
                  multiline
                  numberOfLines={3}
                />
              </Card>
            ))}

            <Button
              label="+ Add education"
              onPress={addEducation}
              variant="secondary"
              style={styles.addBtn}
            />
          </View>
        )}

        {/* SECTION 3: Experience */}
        {activeSection === 'experience' && (
          <View style={styles.formSection}>
            {content.experience.map((exp, idx) => (
              <Card key={idx} style={styles.entryCard}>
                <View style={styles.entryCardHeader}>
                  <Text style={[styles.entryCardTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                    Experience #{idx + 1}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => removeExperience(idx)}>
                    <Trash2 size={16} color={hub.muted} />
                  </Pressable>
                </View>

                <Field
                  label="Company / Organization"
                  placeholder="e.g. Tech Innovations Inc."
                  value={exp.company}
                  onChangeText={(val) => {
                    const copy = [...content.experience];
                    copy[idx].company = val;
                    setContent((p) => ({ ...p, experience: copy }));
                  }}
                />

                <Field
                  label="Job title"
                  placeholder="e.g. Software Engineering Intern"
                  value={exp.title}
                  onChangeText={(val) => {
                    const copy = [...content.experience];
                    copy[idx].title = val;
                    setContent((p) => ({ ...p, experience: copy }));
                  }}
                />

                <Field
                  label="Location"
                  placeholder="e.g. Remote or Bengaluru, India"
                  value={exp.location || ''}
                  onChangeText={(val) => {
                    const copy = [...content.experience];
                    copy[idx].location = val;
                    setContent((p) => ({ ...p, experience: copy }));
                  }}
                />

                <View style={styles.rowFields}>
                  <View style={styles.flexField}>
                    <Field
                      label="Start date"
                      placeholder="e.g. Jun 2024"
                      value={exp.startDate || ''}
                      onChangeText={(val) => {
                        const copy = [...content.experience];
                        copy[idx].startDate = val;
                        setContent((p) => ({ ...p, experience: copy }));
                      }}
                    />
                  </View>
                  <View style={styles.flexField}>
                    <Field
                      label="End date"
                      placeholder={exp.current ? 'Present' : 'e.g. Aug 2024'}
                      value={exp.endDate || ''}
                      onChangeText={(val) => {
                        const copy = [...content.experience];
                        copy[idx].endDate = val;
                        setContent((p) => ({ ...p, experience: copy }));
                      }}
                    />
                  </View>
                </View>

                <Field
                  label="Technologies used (comma-separated)"
                  placeholder="e.g. React Native, TypeScript, Node.js"
                  value={(exp.technologies || []).join(', ')}
                  onChangeText={(val) => {
                    const copy = [...content.experience];
                    copy[idx].technologies = val.split(',').map((s) => s.trim()).filter(Boolean);
                    setContent((p) => ({ ...p, experience: copy }));
                  }}
                />

                <Field
                  label="Bullet points / Responsibilities (one per line)"
                  placeholder="• Developed cross-platform mobile features..."
                  value={(exp.bullets || []).join('\n')}
                  onChangeText={(val) => {
                    const copy = [...content.experience];
                    copy[idx].bullets = val.split('\n').filter(Boolean);
                    setContent((p) => ({ ...p, experience: copy }));
                  }}
                  multiline
                  numberOfLines={4}
                />
              </Card>
            ))}

            <Button
              label="+ Add experience"
              onPress={addExperience}
              variant="secondary"
              style={styles.addBtn}
            />
          </View>
        )}

        {/* SECTION 4: Projects */}
        {activeSection === 'projects' && (
          <View style={styles.formSection}>
            {content.projects.map((proj, idx) => (
              <Card key={idx} style={styles.entryCard}>
                <View style={styles.entryCardHeader}>
                  <Text style={[styles.entryCardTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                    Project #{idx + 1}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => removeProject(idx)}>
                    <Trash2 size={16} color={hub.muted} />
                  </Pressable>
                </View>

                <Field
                  label="Project name"
                  placeholder="e.g. Career Pilot AI"
                  value={proj.name}
                  onChangeText={(val) => {
                    const copy = [...content.projects];
                    copy[idx].name = val;
                    setContent((p) => ({ ...p, projects: copy }));
                  }}
                />

                <Field
                  label="Description"
                  placeholder="Brief one-line summary of project goals and impact"
                  value={proj.description || ''}
                  onChangeText={(val) => {
                    const copy = [...content.projects];
                    copy[idx].description = val;
                    setContent((p) => ({ ...p, projects: copy }));
                  }}
                />

                <Field
                  label="Technologies used (comma-separated)"
                  placeholder="e.g. Python, Next.js, FastAPI, Tailwind"
                  value={(proj.technologies || []).join(', ')}
                  onChangeText={(val) => {
                    const copy = [...content.projects];
                    copy[idx].technologies = val.split(',').map((s) => s.trim()).filter(Boolean);
                    setContent((p) => ({ ...p, projects: copy }));
                  }}
                />

                <Field
                  label="GitHub repository URL"
                  placeholder="e.g. github.com/aritraio/project"
                  autoCapitalize="none"
                  value={proj.github || ''}
                  onChangeText={(val) => {
                    const copy = [...content.projects];
                    copy[idx].github = val;
                    setContent((p) => ({ ...p, projects: copy }));
                  }}
                />

                <Field
                  label="Live demo / App URL"
                  placeholder="e.g. https://myproject.app"
                  autoCapitalize="none"
                  value={proj.url || ''}
                  onChangeText={(val) => {
                    const copy = [...content.projects];
                    copy[idx].url = val;
                    setContent((p) => ({ ...p, projects: copy }));
                  }}
                />

                <Field
                  label="Highlights / Bullets (one per line)"
                  placeholder="• Engineered offline sync with async storage..."
                  value={(proj.bullets || []).join('\n')}
                  onChangeText={(val) => {
                    const copy = [...content.projects];
                    copy[idx].bullets = val.split('\n').filter(Boolean);
                    setContent((p) => ({ ...p, projects: copy }));
                  }}
                  multiline
                  numberOfLines={4}
                />
              </Card>
            ))}

            <Button
              label="+ Add project"
              onPress={addProject}
              variant="secondary"
              style={styles.addBtn}
            />
          </View>
        )}

        {/* SECTION 5: Skills */}
        {activeSection === 'skills' && (
          <View style={styles.formSection}>
            <Field
              label="Technical languages (comma-separated)"
              placeholder="e.g. JavaScript, TypeScript, Python, SQL, C++"
              value={(content.skills.technical || []).join(', ')}
              onChangeText={(val) => updateSkillsCategory('technical', val)}
            />

            <Field
              label="AI/ML & Frameworks (comma-separated)"
              placeholder="e.g. React Native, Next.js, Node.js, PyTorch"
              value={(content.skills.frameworks || []).join(', ')}
              onChangeText={(val) => updateSkillsCategory('frameworks', val)}
            />

            <Field
              label="Developer tools (comma-separated)"
              placeholder="e.g. Git, Docker, MongoDB, VS Code, Linux"
              value={(content.skills.tools || []).join(', ')}
              onChangeText={(val) => updateSkillsCategory('tools', val)}
            />

            <Field
              label="Interpersonal / Soft skills (comma-separated)"
              placeholder="e.g. Technical Writing, Team Leadership, Problem Solving"
              value={(content.skills.soft || []).join(', ')}
              onChangeText={(val) => updateSkillsCategory('soft', val)}
            />
          </View>
        )}

        {/* SECTION 6: Certifications */}
        {activeSection === 'certifications' && (
          <View style={styles.formSection}>
            {content.certifications.map((cert, idx) => (
              <Card key={idx} style={styles.entryCard}>
                <View style={styles.entryCardHeader}>
                  <Text style={[styles.entryCardTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                    Certification #{idx + 1}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => removeCertification(idx)}>
                    <Trash2 size={16} color={hub.muted} />
                  </Pressable>
                </View>

                <Field
                  label="Certification name"
                  placeholder="e.g. AWS Certified Solutions Architect"
                  value={cert.name}
                  onChangeText={(val) => {
                    const copy = [...content.certifications];
                    copy[idx].name = val;
                    setContent((p) => ({ ...p, certifications: copy }));
                  }}
                />

                <Field
                  label="Issuing organization"
                  placeholder="e.g. Amazon Web Services"
                  value={cert.issuer || ''}
                  onChangeText={(val) => {
                    const copy = [...content.certifications];
                    copy[idx].issuer = val;
                    setContent((p) => ({ ...p, certifications: copy }));
                  }}
                />

                <Field
                  label="Date issued"
                  placeholder="e.g. Oct 2024"
                  value={cert.date || ''}
                  onChangeText={(val) => {
                    const copy = [...content.certifications];
                    copy[idx].date = val;
                    setContent((p) => ({ ...p, certifications: copy }));
                  }}
                />

                <Field
                  label="Credential URL (Optional)"
                  placeholder="e.g. https://credly.com/..."
                  autoCapitalize="none"
                  value={cert.url || ''}
                  onChangeText={(val) => {
                    const copy = [...content.certifications];
                    copy[idx].url = val;
                    setContent((p) => ({ ...p, certifications: copy }));
                  }}
                />
              </Card>
            ))}

            <Button
              label="+ Add certification"
              onPress={addCertification}
              variant="secondary"
              style={styles.addBtn}
            />
          </View>
        )}

        {/* SECTION 7: Custom Sections */}
        {activeSection === 'custom' && (
          <View style={styles.formSection}>
            {content.customSections.map((sec, secIdx) => (
              <Card key={secIdx} style={styles.entryCard}>
                <View style={styles.entryCardHeader}>
                  <Text style={[styles.entryCardTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
                    Custom Section #{secIdx + 1}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => removeCustomSection(secIdx)}>
                    <Trash2 size={16} color={hub.muted} />
                  </Pressable>
                </View>

                <Field
                  label="Section Title"
                  placeholder="e.g. Leadership, Publications, Awards"
                  value={sec.title}
                  onChangeText={(val) => {
                    const copy = [...content.customSections];
                    copy[secIdx].title = val;
                    setContent((p) => ({ ...p, customSections: copy }));
                  }}
                />

                {sec.items.map((item, itemIdx) => (
                  <View
                    key={itemIdx}
                    style={[styles.customItemBox, { borderTopColor: hub.line }]}
                  >
                    <Field
                      label="Heading"
                      placeholder="e.g. Club Lead or Paper Title"
                      value={item.heading}
                      onChangeText={(val) => {
                        const copy = [...content.customSections];
                        copy[secIdx].items[itemIdx].heading = val;
                        setContent((p) => ({ ...p, customSections: copy }));
                      }}
                    />

                    <Field
                      label="Subheading / Organization"
                      placeholder="e.g. Coding Club"
                      value={item.subheading || ''}
                      onChangeText={(val) => {
                        const copy = [...content.customSections];
                        copy[secIdx].items[itemIdx].subheading = val;
                        setContent((p) => ({ ...p, customSections: copy }));
                      }}
                    />

                    <Field
                      label="Date"
                      placeholder="e.g. 2023 - 2024"
                      value={item.date || ''}
                      onChangeText={(val) => {
                        const copy = [...content.customSections];
                        copy[secIdx].items[itemIdx].date = val;
                        setContent((p) => ({ ...p, customSections: copy }));
                      }}
                    />

                    <Field
                      label="Bullets (one per line)"
                      placeholder="• Organized hackathons and weekly workshops..."
                      value={(item.bullets || []).join('\n')}
                      onChangeText={(val) => {
                        const copy = [...content.customSections];
                        copy[secIdx].items[itemIdx].bullets = val.split('\n').filter(Boolean);
                        setContent((p) => ({ ...p, customSections: copy }));
                      }}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                ))}

                <Button
                  label="+ Add item"
                  onPress={() => {
                    const copy = [...content.customSections];
                    copy[secIdx].items.push({
                      heading: '',
                      subheading: '',
                      date: '',
                      link: '',
                      bullets: [],
                    });
                    setContent((p) => ({ ...p, customSections: copy }));
                  }}
                  variant="secondary"
                  style={styles.addBtn}
                />
              </Card>
            ))}

            <Button
              label="+ Add custom section"
              onPress={addCustomSection}
              variant="secondary"
              style={styles.addBtn}
            />
          </View>
        )}

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <Button
            label="Preview formatted resume"
            onPress={() => {
              if (resumeId) {
                router.push({
                  pathname: '/resume-preview',
                  params: { id: resumeId },
                });
              }
            }}
            variant="primary"
            icon={<Eye size={18} color={hub.bg} />}
            iconPosition="right"
            style={styles.previewBtn}
          />

          <Button
            label={saving ? 'Saving changes…' : isDirty ? 'Save changes' : 'Saved'}
            onPress={handleSave}
            variant="secondary"
            icon={<Save size={18} color={hub.text} />}
            iconPosition="left"
            loading={saving}
          />
        </View>
      </ScrollView>

      {/* Section Selection Modal */}
      <Modal
        visible={sectionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSectionModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSectionModalVisible(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: hub.surface }]}>
            <Text style={[styles.modalTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
              Select Section
            </Text>

            {SECTION_OPTIONS.map((opt) => {
              const isSelected = opt.key === activeSection;
              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.modalOption,
                    isSelected && { backgroundColor: hub.soft },
                  ]}
                  onPress={() => {
                    setActiveSection(opt.key);
                    setSectionModalVisible(false);
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
                    {opt.label}
                  </Text>
                  {isSelected && <Check size={18} color={hub.text} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
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
  topMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  eyebrow: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.5,
  },
  headerSaveBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: targetSizes.minTouch,
  },
  headerSaveText: {
    fontSize: typography.sizes.body,
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
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
  sectionControlGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.sizes.body,
    marginBottom: spacing.xs,
  },
  sectionPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    minHeight: targetSizes.minTouch,
  },
  sectionPickerText: {
    fontSize: typography.sizes.body,
  },
  formSection: {
    gap: spacing.base,
    marginBottom: spacing.xl,
  },
  entryCard: {
    padding: spacing.base,
    gap: spacing.md,
  },
  entryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  entryCardTitle: {
    fontSize: typography.sizes.body,
  },
  rowFields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexField: {
    flex: 1,
  },
  customItemBox: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  addBtn: {
    marginTop: spacing.xs,
  },
  bottomActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  previewBtn: {
    marginBottom: spacing.xs,
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
