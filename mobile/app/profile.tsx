import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Check, AlertCircle, Trash2 } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Sheet } from '../src/components/primitives/Sheet';
import {
  ActiveCurriculumItem,
  UserProfileData,
  fetchProfile,
  updateProfile,
  getProfileDraft,
  saveProfileDraft,
  clearProfileDraft,
} from '../src/api/profile';
import { radii, spacing, typography, targetSizes } from '../src/theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user, updateUser } = useAuth();
  const userId = user?.id || 'default_user';

  // Profile fields state
  const [name, setName] = useState(user?.name || 'Aritra');
  const [email, setEmail] = useState(user?.email || 'student@example.com');
  const [currentCourse, setCurrentCourse] = useState('Computer science student');
  const [activeCurriculum, setActiveCurriculum] = useState<ActiveCurriculumItem[]>([
    {
      title: 'Database systems',
      platform: 'Self-paced',
      progress: 40,
      estCompletion: '40% complete',
    },
  ]);
  const [goalsList, setGoalsList] = useState<string[]>([
    'Build a full-stack project.',
    'Prepare for a software internship.',
  ]);

  // Server baseline for dirty tracking & conflict reconciliation
  const [serverBaseline, setServerBaseline] = useState<UserProfileData | null>(null);

  // Status state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sheets state
  const [showCourseSheet, setShowCourseSheet] = useState(false);
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);
  const [courseTitleInput, setCourseTitleInput] = useState('');
  const [coursePlatformInput, setCoursePlatformInput] = useState('');
  const [courseProgressInput, setCourseProgressInput] = useState('');
  const [courseEstInput, setCourseEstInput] = useState('');
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  const [showGoalSheet, setShowGoalSheet] = useState(false);
  const [editingGoalIndex, setEditingGoalIndex] = useState<number | null>(null);
  const [goalTextInput, setGoalTextInput] = useState('');
  const [goalFormError, setGoalFormError] = useState<string | null>(null);

  const [showDiscardSheet, setShowDiscardSheet] = useState(false);

  // Calculate dirty state
  const isDirty = Boolean(
    serverBaseline &&
      (name.trim() !== (serverBaseline.name || '').trim() ||
        currentCourse.trim() !== (serverBaseline.currentCourse || '').trim() ||
        JSON.stringify(activeCurriculum) !== JSON.stringify(serverBaseline.activeCurriculum || []) ||
        JSON.stringify(goalsList) !== JSON.stringify(serverBaseline.futureGoals?.shortTerm || []))
  );

  // Load initial profile data and restore any interrupted draft
  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchProfile(userId, { name: user?.name, email: user?.email });
      setServerBaseline(data);

      // Check if there is an unsaved local draft
      const draft = await getProfileDraft(userId);
      if (draft) {
        setName(draft.name !== undefined ? draft.name : data.name);
        setEmail(data.email); // Email is always strictly from identity
        setCurrentCourse(draft.currentCourse !== undefined ? draft.currentCourse : data.currentCourse);
        if (Array.isArray(draft.activeCurriculum)) {
          setActiveCurriculum(draft.activeCurriculum);
        } else {
          setActiveCurriculum(data.activeCurriculum || []);
        }
        if (Array.isArray(draft.futureGoals?.shortTerm)) {
          setGoalsList(draft.futureGoals.shortTerm);
        } else {
          setGoalsList(data.futureGoals?.shortTerm || []);
        }
      } else {
        setName(data.name || 'Aritra');
        setEmail(data.email || 'student@example.com');
        setCurrentCourse(data.currentCourse || '');
        setActiveCurriculum(data.activeCurriculum || []);
        setGoalsList(data.futureGoals?.shortTerm || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load profile. Showing offline records.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, user?.name, user?.email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Persist draft on changes
  useEffect(() => {
    if (!isLoading && isDirty) {
      saveProfileDraft(userId, {
        name,
        currentCourse,
        activeCurriculum,
        futureGoals: { shortTerm: goalsList, longTerm: [] },
      });
    }
  }, [name, currentCourse, activeCurriculum, goalsList, isDirty, isLoading, userId]);

  // Guard navigation when dirty
  const handleBackPress = useCallback(() => {
    if (isDirty) {
      setShowDiscardSheet(true);
      return;
    }
    router.back();
  }, [isDirty, router]);

  useEffect(() => {
    const backAction = () => {
      if (isDirty) {
        setShowDiscardSheet(true);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isDirty]);

  // Save changes
  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      name: name.trim(),
      currentCourse: currentCourse.trim(),
      activeCurriculum,
      futureGoals: {
        shortTerm: goalsList,
        longTerm: [],
      },
      goals: goalsList.join('\n'),
    };

    try {
      const updated = await updateProfile(payload, userId);
      setServerBaseline(updated);
      await clearProfileDraft(userId);
      // Update global AuthContext user name so header and drawer update instantly
      await updateUser({ name: payload.name });
      setSuccessMessage('Profile changes saved successfully.');
    } catch (err: any) {
      // Save draft on failure so user doesn't lose their input
      await saveProfileDraft(userId, payload);
      setErrorMessage(err.message || 'Failed to save changes. Your draft has been kept on this device.');
    } finally {
      setIsSaving(false);
    }
  };

  // Course sheet actions
  const openAddCourse = () => {
    setEditingCourseIndex(null);
    setCourseTitleInput('');
    setCoursePlatformInput('Self-paced');
    setCourseProgressInput('0');
    setCourseEstInput('In progress');
    setCourseFormError(null);
    setShowCourseSheet(true);
  };

  const openEditCourse = (index: number) => {
    const item = activeCurriculum[index];
    if (!item) return;
    setEditingCourseIndex(index);
    setCourseTitleInput(item.title);
    setCoursePlatformInput(item.platform);
    setCourseProgressInput(String(item.progress));
    setCourseEstInput(item.estCompletion);
    setCourseFormError(null);
    setShowCourseSheet(true);
  };

  const handleSaveCourse = () => {
    const trimmedTitle = courseTitleInput.trim();
    if (!trimmedTitle) {
      setCourseFormError('Course title cannot be empty.');
      return;
    }

    const parsedProgress = parseInt(courseProgressInput.replace('%', '').trim(), 10);
    const progressNum = isNaN(parsedProgress) ? 0 : Math.min(100, Math.max(0, parsedProgress));
    const platformStr = coursePlatformInput.trim() || 'Self-paced';
    const estStr = courseEstInput.trim() || `${progressNum}% complete`;

    const newCourse: ActiveCurriculumItem = {
      title: trimmedTitle,
      platform: platformStr,
      progress: progressNum,
      estCompletion: estStr,
    };

    if (editingCourseIndex !== null) {
      const updated = [...activeCurriculum];
      updated[editingCourseIndex] = newCourse;
      setActiveCurriculum(updated);
    } else {
      setActiveCurriculum([...activeCurriculum, newCourse]);
    }

    setShowCourseSheet(false);
  };

  const handleRemoveCourse = () => {
    if (editingCourseIndex === null) return;
    const updated = activeCurriculum.filter((_, i) => i !== editingCourseIndex);
    setActiveCurriculum(updated);
    setShowCourseSheet(false);
  };

  // Goal sheet actions
  const openAddGoal = () => {
    setEditingGoalIndex(null);
    setGoalTextInput('');
    setGoalFormError(null);
    setShowGoalSheet(true);
  };

  const openEditGoal = (index: number) => {
    const goalText = goalsList[index];
    if (goalText === undefined) return;
    setEditingGoalIndex(index);
    setGoalTextInput(goalText);
    setGoalFormError(null);
    setShowGoalSheet(true);
  };

  const handleSaveGoal = () => {
    const trimmed = goalTextInput.trim();
    if (trimmed.length < 3) {
      setGoalFormError('Goal must be at least 3 characters long.');
      return;
    }

    if (editingGoalIndex !== null) {
      const updated = [...goalsList];
      updated[editingGoalIndex] = trimmed;
      setGoalsList(updated);
    } else {
      setGoalsList([...goalsList, trimmed]);
    }

    setShowGoalSheet(false);
  };

  const handleRemoveGoal = () => {
    if (editingGoalIndex === null) return;
    const updated = goalsList.filter((_, i) => i !== editingGoalIndex);
    setGoalsList(updated);
    setShowGoalSheet(false);
  };

  const userInitial = name.trim().charAt(0).toUpperCase() || 'A';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: hub.bg }]}
    >
      <AppHeader title="Your profile" isRoot={false} onBackPress={handleBackPress} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Centered Large Circular Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: hub.surface, borderColor: hub.line }]}>
            <Text style={[styles.avatarLetter, { color: hub.text, fontFamily: typography.fontHeading }]}>
              {userInitial}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: hub.text, fontFamily: typography.fontHeading }]}>
            {name || 'Student'}
          </Text>
          <Text style={[styles.profileTagline, { color: hub.muted, fontFamily: typography.fontBody }]}>
            Make your journey your own.
          </Text>
        </View>

        {/* Status Alerts */}
        {errorMessage && (
          <View style={[styles.alertBox, { borderColor: hub.danger, backgroundColor: hub.surface }]}>
            <AlertCircle size={18} color={hub.danger} />
            <Text style={[styles.alertText, { color: hub.danger, fontFamily: typography.fontBody }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {successMessage && (
          <View style={[styles.alertBox, { borderColor: hub.line, backgroundColor: hub.surface }]}>
            <Check size={18} color={hub.text} />
            <Text style={[styles.alertText, { color: hub.text, fontFamily: typography.fontBody }]}>
              {successMessage}
            </Text>
          </View>
        )}

        {/* Input Fields */}
        <View style={styles.formSection}>
          {/* Full name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
              Full name
            </Text>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setSuccessMessage(null);
              }}
              placeholder="Your full name"
              placeholderTextColor={hub.muted}
              style={[
                styles.textInput,
                {
                  backgroundColor: hub.surface,
                  borderColor: hub.line,
                  color: hub.text,
                  fontFamily: typography.fontBody,
                },
              ]}
              accessibilityLabel="Full name"
            />
          </View>

          {/* Email (Read-only identity field) */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
              Email
            </Text>
            <View
              style={[
                styles.textInput,
                styles.readOnlyInput,
                {
                  backgroundColor: hub.surface,
                  borderColor: hub.line,
                },
              ]}
              accessibilityLabel="Email (read only)"
            >
              <Text
                style={[
                  styles.readOnlyText,
                  { color: hub.muted, fontFamily: typography.fontBody },
                ]}
              >
                {email}
              </Text>
            </View>
          </View>

          {/* Current course / role */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
              Current course / role
            </Text>
            <TextInput
              value={currentCourse}
              onChangeText={(text) => {
                setCurrentCourse(text);
                setSuccessMessage(null);
              }}
              placeholder="Computer science student"
              placeholderTextColor={hub.muted}
              style={[
                styles.textInput,
                {
                  backgroundColor: hub.surface,
                  borderColor: hub.line,
                  color: hub.text,
                  fontFamily: typography.fontBody,
                },
              ]}
              accessibilityLabel="Current course / role"
            />
          </View>
        </View>

        {/* Active Curriculum Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
            Active curriculum
          </Text>
          <Pressable
            onPress={openAddCourse}
            accessibilityRole="button"
            accessibilityLabel="Add course"
            style={({ pressed }) => [styles.plusButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Plus size={22} color={hub.text} />
          </Pressable>
        </View>

        <View style={styles.listSection}>
          {activeCurriculum.length === 0 ? (
            <Text style={[styles.emptyNotice, { color: hub.muted, fontFamily: typography.fontBody }]}>
              No active courses added. Tap + to add a course.
            </Text>
          ) : (
            activeCurriculum.map((course, index) => (
              <React.Fragment key={`${course.title}-${index}`}>
                <Pressable
                  onPress={() => openEditCourse(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit course ${course.title}`}
                  style={({ pressed }) => [
                    styles.curriculumRow,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.itemTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
                    {course.title}
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: hub.muted, fontFamily: typography.fontBody }]}>
                    {course.platform} · {course.progress}% complete
                  </Text>
                </Pressable>
                {index < activeCurriculum.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: hub.line }]} />
                )}
              </React.Fragment>
            ))
          )}
        </View>

        {/* My Goals Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.xl }]}>
          <Text style={[styles.sectionTitle, { color: hub.text, fontFamily: typography.fontHeadingMedium }]}>
            My goals
          </Text>
          <Pressable
            onPress={openAddGoal}
            accessibilityRole="button"
            accessibilityLabel="Add goal"
            style={({ pressed }) => [styles.plusButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Plus size={22} color={hub.text} />
          </Pressable>
        </View>

        <View style={styles.listSection}>
          {goalsList.length === 0 ? (
            <Text style={[styles.emptyNotice, { color: hub.muted, fontFamily: typography.fontBody }]}>
              No goals added yet. Tap + to set a goal.
            </Text>
          ) : (
            goalsList.map((goal, index) => (
              <React.Fragment key={`goal-${index}`}>
                <Pressable
                  onPress={() => openEditGoal(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit goal ${goal}`}
                  style={({ pressed }) => [
                    styles.goalRow,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.goalText, { color: hub.text, fontFamily: typography.fontBody }]}>
                    {goal}
                  </Text>
                </Pressable>
                {index < goalsList.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: hub.line }]} />
                )}
              </React.Fragment>
            ))
          )}
        </View>

        {/* Explicit Save Hierarchy */}
        <View style={styles.saveContainer}>
          <Button
            label={isSaving ? 'Saving changes...' : 'Save changes'}
            onPress={handleSave}
            variant={isDirty ? 'primary' : 'secondary'}
            loading={isSaving}
            disabled={isSaving || !name.trim()}
          />
          {isDirty && (
            <Text style={[styles.dirtyNotice, { color: hub.muted, fontFamily: typography.fontMono }]}>
              UNSAVED EDITS DETECTED
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Add / Edit Course Sheet */}
      <Sheet
        visible={showCourseSheet}
        title={editingCourseIndex !== null ? 'Edit course' : 'Add course'}
        onClose={() => setShowCourseSheet(false)}
      >
        <View style={styles.sheetContent}>
          {courseFormError && (
            <View style={[styles.alertBox, { borderColor: hub.danger, marginBottom: spacing.md }]}>
              <AlertCircle size={16} color={hub.danger} />
              <Text style={[styles.alertText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                {courseFormError}
              </Text>
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
            Course title
          </Text>
          <TextInput
            value={courseTitleInput}
            onChangeText={setCourseTitleInput}
            placeholder="e.g. Database systems"
            placeholderTextColor={hub.muted}
            style={[
              styles.textInput,
              {
                backgroundColor: hub.bg,
                borderColor: hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
                marginBottom: spacing.md,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
            Platform / provider
          </Text>
          <TextInput
            value={coursePlatformInput}
            onChangeText={setCoursePlatformInput}
            placeholder="e.g. Self-paced, Coursera, University"
            placeholderTextColor={hub.muted}
            style={[
              styles.textInput,
              {
                backgroundColor: hub.bg,
                borderColor: hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
                marginBottom: spacing.md,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
            Progress percentage (0 - 100)
          </Text>
          <TextInput
            value={courseProgressInput}
            onChangeText={setCourseProgressInput}
            placeholder="40"
            keyboardType="numeric"
            placeholderTextColor={hub.muted}
            style={[
              styles.textInput,
              {
                backgroundColor: hub.bg,
                borderColor: hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
                marginBottom: spacing.md,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
            Estimated completion note
          </Text>
          <TextInput
            value={courseEstInput}
            onChangeText={setCourseEstInput}
            placeholder="e.g. 40% complete or 2 months"
            placeholderTextColor={hub.muted}
            style={[
              styles.textInput,
              {
                backgroundColor: hub.bg,
                borderColor: hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
                marginBottom: spacing.lg,
              },
            ]}
          />

          <View style={styles.sheetActions}>
            <Button
              label={editingCourseIndex !== null ? 'Save course' : 'Add to curriculum'}
              onPress={handleSaveCourse}
              variant="primary"
            />
            {editingCourseIndex !== null && (
              <Button
                label="Remove course"
                onPress={handleRemoveCourse}
                variant="danger"
                icon={<Trash2 size={16} color={hub.danger} />}
                iconPosition="left"
              />
            )}
            <Button
              label="Cancel"
              onPress={() => setShowCourseSheet(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Sheet>

      {/* Add / Edit Goal Sheet */}
      <Sheet
        visible={showGoalSheet}
        title={editingGoalIndex !== null ? 'Edit goal' : 'Add goal'}
        onClose={() => setShowGoalSheet(false)}
      >
        <View style={styles.sheetContent}>
          {goalFormError && (
            <View style={[styles.alertBox, { borderColor: hub.danger, marginBottom: spacing.md }]}>
              <AlertCircle size={16} color={hub.danger} />
              <Text style={[styles.alertText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                {goalFormError}
              </Text>
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: hub.muted, fontFamily: typography.fontBodyMedium }]}>
            Goal description
          </Text>
          <TextInput
            value={goalTextInput}
            onChangeText={setGoalTextInput}
            placeholder="e.g. Build a full-stack project."
            placeholderTextColor={hub.muted}
            multiline
            numberOfLines={3}
            style={[
              styles.textArea,
              {
                backgroundColor: hub.bg,
                borderColor: hub.line,
                color: hub.text,
                fontFamily: typography.fontBody,
                marginBottom: spacing.lg,
              },
            ]}
          />

          <View style={styles.sheetActions}>
            <Button
              label={editingGoalIndex !== null ? 'Save goal' : 'Add goal'}
              onPress={handleSaveGoal}
              variant="primary"
            />
            {editingGoalIndex !== null && (
              <Button
                label="Remove goal"
                onPress={handleRemoveGoal}
                variant="danger"
                icon={<Trash2 size={16} color={hub.danger} />}
                iconPosition="left"
              />
            )}
            <Button
              label="Cancel"
              onPress={() => setShowGoalSheet(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Sheet>

      {/* Dirty Navigation Discard Confirmation Sheet */}
      <Sheet
        visible={showDiscardSheet}
        title="Discard unsaved changes?"
        onClose={() => setShowDiscardSheet(false)}
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.discardBody, { color: hub.muted, fontFamily: typography.fontBody }]}>
            You have unsaved changes to your profile. Leaving now will discard your current edits.
          </Text>
          <View style={[styles.sheetActions, { marginTop: spacing.lg }]}>
            <Button
              label="Discard changes"
              onPress={() => {
                setShowDiscardSheet(false);
                clearProfileDraft(userId);
                router.back();
              }}
              variant="danger"
            />
            <Button
              label="Keep editing"
              onPress={() => setShowDiscardSheet(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: spacing.xxs,
  },
  profileTagline: {
    fontSize: typography.sizes.body,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  alertText: {
    fontSize: typography.sizes.body,
    flex: 1,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  fieldGroup: {
    marginBottom: spacing.base,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  textInput: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    fontSize: typography.sizes.body,
    justifyContent: 'center',
  },
  readOnlyInput: {
    opacity: 0.8,
  },
  readOnlyText: {
    fontSize: typography.sizes.body,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  plusButton: {
    width: targetSizes.iconTouch,
    height: targetSizes.iconTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listSection: {
    marginBottom: spacing.md,
  },
  curriculumRow: {
    paddingVertical: spacing.sm,
  },
  itemTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: typography.sizes.sm,
  },
  goalRow: {
    paddingVertical: spacing.sm,
  },
  goalText: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyNotice: {
    fontSize: typography.sizes.sm,
    paddingVertical: spacing.sm,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  saveContainer: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  dirtyNotice: {
    fontSize: typography.sizes.fine,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  sheetContent: {
    paddingVertical: spacing.xs,
  },
  textArea: {
    minHeight: 80,
    padding: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    fontSize: typography.sizes.body,
    textAlignVertical: 'top',
  },
  sheetActions: {
    gap: spacing.sm,
  },
  discardBody: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
});
