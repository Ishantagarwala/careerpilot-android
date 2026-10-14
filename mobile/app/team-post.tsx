import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  BackHandler,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { radii, spacing, typography } from '../src/theme/tokens';
import {
  createTeamPost,
  getTeamPostDraft,
  setTeamPostDraft,
  clearTeamPostDraft,
  normalizeEventId,
} from '../src/api/projects';

export default function TeamPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    eventId?: string;
    eventTitle?: string;
    prefillTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { hub } = useTheme();
  const { user } = useAuth();

  const [title, setTitle] = useState(params.prefillTitle || '');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [teamSize, setTeamSize] = useState('4');
  const [contactMethod, setContactMethod] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isDirtyRef = useRef(false);

  // Restore local draft if available
  useEffect(() => {
    if (!user?.id) return;
    getTeamPostDraft(user.id).then((draft) => {
      if (draft) {
        if (!params.prefillTitle && draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.lookingFor && draft.lookingFor.length > 0) setSkills(draft.lookingFor.join(', '));
        if (draft.teamSize) setTeamSize(String(draft.teamSize));
        if (draft.contactMethod) setContactMethod(draft.contactMethod);
        isDirtyRef.current = true;
      }
    });
  }, [user, params.prefillTitle]);

  // Track dirty state
  useEffect(() => {
    const isDirty =
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      skills.trim().length > 0 ||
      contactMethod.trim().length > 0;
    isDirtyRef.current = isDirty;

    // Save draft periodically
    if (user?.id && isDirty) {
      const skillsArray = skills.split(',').map((s) => s.trim()).filter(Boolean);
      setTeamPostDraft(user.id, {
        title,
        description,
        lookingFor: skillsArray,
        teamSize: parseInt(teamSize, 10) || 4,
        contactMethod,
        hackathonId: normalizeEventId(params.eventId),
      }).catch(() => {});
    }
  }, [title, description, skills, teamSize, contactMethod, user, params.eventId]);

  // Guard navigation when dirty
  const handleAttemptBack = () => {
    if (!isDirtyRef.current) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard draft?',
      'You have unsaved changes in your team post. Do you want to keep editing or discard?',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard draft',
          style: 'destructive',
          onPress: async () => {
            isDirtyRef.current = false;
            if (user?.id) {
              await clearTeamPostDraft(user.id);
            }
            router.back();
          },
        },
      ]
    );
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleAttemptBack();
      return true;
    });
    return () => backHandler.remove();
  }, [title, description, skills, contactMethod]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = 'Post title is required';
    } else if (title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (title.trim().length > 100) {
      errors.title = 'Title must be 100 characters or fewer';
    }

    if (!description.trim()) {
      errors.description = 'Description is required';
    } else if (description.trim().length < 10) {
      errors.description = 'Provide at least 10 characters describing what you are building';
    }

    if (!skills.trim()) {
      errors.skills = 'Specify at least one skill needed';
    }

    const parsedSize = parseInt(teamSize, 10);
    if (isNaN(parsedSize) || parsedSize < 2 || parsedSize > 12) {
      errors.teamSize = 'Team size must be between 2 and 12';
    }

    if (!contactMethod.trim()) {
      errors.contactMethod = 'Contact method is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePublish = async () => {
    if (!validate() || publishing) return;

    setPublishing(true);
    const skillsArray = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Normalize event ID: use no event when optional rather than a fabricated ID
    const normalizedEvent = normalizeEventId(params.eventId);

    try {
      await createTeamPost({
        title: title.trim(),
        description: description.trim(),
        lookingFor: skillsArray,
        teamSize: parseInt(teamSize, 10) || 4,
        contactMethod: contactMethod.trim(),
        hackathonId: normalizedEvent,
      });

      // Clear draft on confirmed server response
      isDirtyRef.current = false;
      if (user?.id) {
        await clearTeamPostDraft(user.id);
      }

      // Return to Teams screen
      router.replace('/teams' as any);
    } catch (err: any) {
      Alert.alert(
        'Publish Failed',
        err.message || 'Could not publish your team post. Your draft has been saved. Please try again.'
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: hub.bg }]}
    >
      <AppHeader
        title="Create team post"
        isRoot={false}
        onBackPress={handleAttemptBack}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.eyebrow, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
          FIND YOUR TEAMMATES
        </Text>

        <Text style={[styles.heading, { color: hub.text, fontFamily: typography.fontHeading }]}>
          What are you{'\n'}building?
        </Text>

        {params.eventTitle && (
          <View style={[styles.eventBadge, { backgroundColor: hub.soft, borderColor: hub.line }]}>
            <Text style={[styles.eventBadgeLabel, { color: hub.muted, fontFamily: typography.fontMonoMedium }]}>
              TARGET EVENT:
            </Text>
            <Text style={[styles.eventBadgeTitle, { color: hub.text, fontFamily: typography.fontBodyBold }]}>
              {params.eventTitle}
            </Text>
          </View>
        )}

        <View style={styles.form}>
          {/* Post Title */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyMedium }]}>
              Post title
            </Text>
            <TextInput
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="Describe your project"
              placeholderTextColor={hub.muted}
              style={[
                styles.input,
                {
                  backgroundColor: hub.surface,
                  borderColor: fieldErrors.title ? hub.danger : hub.line,
                  color: hub.text,
                  fontFamily: typography.fontBody,
                },
              ]}
              accessibilityLabel="Post title"
            />
            {fieldErrors.title ? (
              <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                {fieldErrors.title}
              </Text>
            ) : null}
          </View>

          {/* Description */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyMedium }]}>
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="What is the idea and who do you need?"
              placeholderTextColor={hub.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[
                styles.textArea,
                {
                  backgroundColor: hub.surface,
                  borderColor: fieldErrors.description ? hub.danger : hub.line,
                  color: hub.text,
                  fontFamily: typography.fontBody,
                },
              ]}
              accessibilityLabel="Project description"
            />
            {fieldErrors.description ? (
              <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                {fieldErrors.description}
              </Text>
            ) : null}
          </View>

          {/* Skills Needed */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyMedium }]}>
              Skills needed
            </Text>
            <TextInput
              value={skills}
              onChangeText={(text) => {
                setSkills(text);
                if (fieldErrors.skills) setFieldErrors((prev) => ({ ...prev, skills: '' }));
              }}
              placeholder="e.g. React, UI/UX"
              placeholderTextColor={hub.muted}
              style={[
                styles.input,
                {
                  backgroundColor: hub.surface,
                  borderColor: fieldErrors.skills ? hub.danger : hub.line,
                  color: hub.text,
                  fontFamily: typography.fontBody,
                },
              ]}
              accessibilityLabel="Skills needed, comma separated"
            />
            {fieldErrors.skills ? (
              <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                {fieldErrors.skills}
              </Text>
            ) : null}
          </View>

          {/* Team Size & Contact Method Row */}
          <View style={styles.row}>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyMedium }]}>
                Team size
              </Text>
              <TextInput
                value={teamSize}
                onChangeText={(text) => {
                  setTeamSize(text);
                  if (fieldErrors.teamSize) setFieldErrors((prev) => ({ ...prev, teamSize: '' }));
                }}
                placeholder="4"
                placeholderTextColor={hub.muted}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: hub.surface,
                    borderColor: fieldErrors.teamSize ? hub.danger : hub.line,
                    color: hub.text,
                    fontFamily: typography.fontBody,
                  },
                ]}
                accessibilityLabel="Total team size"
              />
              {fieldErrors.teamSize ? (
                <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                  {fieldErrors.teamSize}
                </Text>
              ) : null}
            </View>

            <View style={[styles.fieldContainer, { flex: 2 }]}>
              <Text style={[styles.fieldLabel, { color: hub.text, fontFamily: typography.fontBodyMedium }]}>
                Contact method
              </Text>
              <TextInput
                value={contactMethod}
                onChangeText={(text) => {
                  setContactMethod(text);
                  if (fieldErrors.contactMethod) setFieldErrors((prev) => ({ ...prev, contactMethod: '' }));
                }}
                placeholder="Email or handle"
                placeholderTextColor={hub.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: hub.surface,
                    borderColor: fieldErrors.contactMethod ? hub.danger : hub.line,
                    color: hub.text,
                    fontFamily: typography.fontBody,
                  },
                ]}
                accessibilityLabel="Contact method"
              />
              {fieldErrors.contactMethod ? (
                <Text style={[styles.errorText, { color: hub.danger, fontFamily: typography.fontBody }]}>
                  {fieldErrors.contactMethod}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Publish Post Button */}
          <Button
            label={publishing ? 'Publishing…' : 'Publish post'}
            onPress={handlePublish}
            disabled={publishing}
            variant="primary"
            icon={publishing ? <ActivityIndicator size="small" color={hub.bg} /> : undefined}
            style={styles.publishBtn}
          />

          <Text style={[styles.footnote, { color: hub.muted, fontFamily: typography.fontBody }]}>
            Your contact method appears with the post. Choose what you are comfortable sharing publicly with fellow students and builders.
          </Text>
        </View>
      </ScrollView>
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
  eventBadge: {
    borderWidth: 1,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.base,
  },
  eventBadgeLabel: {
    fontSize: typography.sizes.fine,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  eventBadgeTitle: {
    fontSize: typography.sizes.sm,
  },
  form: {
    gap: spacing.base,
  },
  fieldContainer: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.input,
    height: 48,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: radii.input,
    height: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.fine,
    marginTop: 2,
  },
  publishBtn: {
    marginTop: spacing.sm,
  },
  footnote: {
    fontSize: typography.sizes.fine,
    lineHeight: 18,
    marginTop: spacing.xxs,
  },
});
