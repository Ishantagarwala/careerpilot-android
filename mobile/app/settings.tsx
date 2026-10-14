import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  LogOut,
  Trash2,
  HardDrive,
  FileText,
  ExternalLink,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { getApiBaseUrl } from '../src/api/client';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { Button } from '../src/components/primitives/Button';
import { Sheet } from '../src/components/primitives/Sheet';
import { ThemeMode, radii, spacing, typography, targetSizes } from '../src/theme/tokens';
import { notificationService, NotificationPermissionStatus } from '../src/services/notificationService';
import { clearLocalDeviceCache, deleteAccount } from '../src/api/profile';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, setTheme, hub } = useTheme();
  const { logout, user } = useAuth();

  // Notification reminder state
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>('undetermined');

  // Sheets state
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Initialize notification permission check
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const status = await notificationService.getPermissionStatus();
      if (isMounted) {
        setPermissionStatus(status);
        setRemindersEnabled(status === 'granted');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Theme options
  const themeOptions: { label: string; mode: ThemeMode }[] = [
    { label: 'Monolith Dark', mode: 'dark' },
    { label: 'Monolith Light', mode: 'light' },
    { label: 'Device setting', mode: 'system' },
  ];

  const currentThemeLabel =
    themeOptions.find((t) => t.mode === theme)?.label || 'Monolith Dark';

  // Toggle notification reminders with honest permission reflection
  const handleToggleReminders = async () => {
    if (remindersEnabled) {
      // Disabling reminder
      await notificationService.setPermissionStatus('denied');
      setRemindersEnabled(false);
      setPermissionStatus('denied');
    } else {
      // Enabling reminder: request permission
      const status = await notificationService.requestPermission();
      setPermissionStatus(status);
      if (status === 'granted') {
        setRemindersEnabled(true);
      } else {
        setRemindersEnabled(false);
        Alert.alert(
          'Permission Denied',
          'Focus-session reminders require notification permissions. Please grant notification permission in your device system settings to enable local alerts.'
        );
      }
    }
  };

  // Device cache clear action (without deleting server records)
  const handleClearCache = async () => {
    try {
      setIsClearingCache(true);
      await clearLocalDeviceCache();
      Alert.alert(
        'Local Cache Cleared',
        'Offline cache, saved drafts, and local session files have been cleared from this device. Your server account data remains completely intact.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not clear device cache.');
    } finally {
      setIsClearingCache(false);
    }
  };

  // Destructive account deletion
  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await deleteAccount();
      setShowDeleteSheet(false);
      setShowPrivacySheet(false);
      await logout();
      router.replace('/(auth)/welcome' as any);
    } catch (err: any) {
      Alert.alert('Deletion Failed', err.message || 'Could not delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/welcome' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: hub.bg }]}>
      <AppHeader title="Settings" isRoot={false} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.base) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Eyebrow & Title */}
        <Text
          style={[
            styles.eyebrow,
            { color: hub.muted, fontFamily: typography.fontMonoMedium },
          ]}
        >
          MAKE IT YOUR SPACE
        </Text>
        <Text
          style={[
            styles.heading,
            { color: hub.text, fontFamily: typography.fontHeading },
          ]}
        >
          Settings.
        </Text>

        {user?.isDemo ? (
          <View
            style={[
              styles.demoCard,
              { backgroundColor: hub.soft, borderColor: hub.line },
            ]}
          >
            <View style={styles.demoCardHeader}>
              <Sparkles size={18} color={hub.text} />
              <Text
                style={[
                  styles.demoCardTitle,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                Demo Exploration Account
              </Text>
            </View>
            <Text
              style={[
                styles.demoCardDescription,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              You are exploring the total Career Pilot app with pre-seeded progress, learning roadmap, and study tools.
            </Text>
            <Button
              label="Exit demo"
              onPress={handleSignOut}
              variant="secondary"
              icon={<LogOut size={16} color={hub.text} />}
              iconPosition="right"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : null}

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            Appearance
          </Text>

          <Text
            style={[
              styles.fieldLabel,
              { color: hub.muted, fontFamily: typography.fontBodyMedium },
            ]}
          >
            Theme
          </Text>

          {/* Theme Dropdown Selector */}
          <Pressable
            onPress={() => setShowThemeSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`Theme: ${currentThemeLabel}. Tap to change.`}
            style={({ pressed }) => [
              styles.dropdownButton,
              {
                backgroundColor: hub.surface,
                borderColor: hub.line,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.dropdownText,
                { color: hub.text, fontFamily: typography.fontBodyBold },
              ]}
            >
              {currentThemeLabel}
            </Text>
            <ChevronDown size={20} color={hub.text} />
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: hub.line }]} />

        {/* Study Preferences Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            Study preferences
          </Text>

          {/* Focus-session reminders Checkbox Row */}
          <Pressable
            onPress={handleToggleReminders}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remindersEnabled }}
            accessibilityLabel="Focus-session reminders checkbox"
            style={styles.checkboxRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: remindersEnabled ? hub.text : hub.line,
                  backgroundColor: remindersEnabled ? hub.text : 'transparent',
                },
              ]}
            >
              {remindersEnabled && <Check size={14} color={hub.bg} strokeWidth={3} />}
            </View>
            <Text
              style={[
                styles.checkboxLabel,
                { color: hub.text, fontFamily: typography.fontBodyBold },
              ]}
            >
              Focus-session reminders
            </Text>
          </Pressable>

          <Text
            style={[
              styles.subtext,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            Optional local alerts. You stay in control.
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: hub.line }]} />

        {/* Your Data Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            Your data
          </Text>

          <Text
            style={[
              styles.dataParagraph,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            Focus history is stored on this device. Saved documents and account data need a
            signed-in connection.
          </Text>

          {/* Privacy and Account Controls Row */}
          <Pressable
            onPress={() => setShowPrivacySheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Privacy and account controls"
            style={({ pressed }) => [
              styles.actionRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Shield size={20} color={hub.text} />
            <View style={styles.actionRowText}>
              <Text
                style={[
                  styles.actionRowTitle,
                  { color: hub.text, fontFamily: typography.fontBodyBold },
                ]}
              >
                Privacy and account controls
              </Text>
              <Text
                style={[
                  styles.actionRowSubtitle,
                  { color: hub.muted, fontFamily: typography.fontBody },
                ]}
              >
                Review storage and deletion options
              </Text>
            </View>
            <ChevronRight size={18} color={hub.muted} />
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: hub.line }]} />

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out of your account"
            style={({ pressed }) => [
              styles.signOutButton,
              {
                borderColor: hub.line,
                backgroundColor: pressed ? hub.soft : hub.surface,
              },
            ]}
          >
            <LogOut size={18} color={hub.text} />
            <Text
              style={[
                styles.signOutText,
                { color: hub.text, fontFamily: typography.fontBodyBold },
              ]}
            >
              {user?.isDemo ? 'Exit demo' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Theme Picker Sheet */}
      <Sheet
        visible={showThemeSheet}
        title="Select appearance theme"
        onClose={() => setShowThemeSheet(false)}
      >
        <View style={styles.sheetContent}>
          {themeOptions.map((opt, index) => {
            const isSelected = theme === opt.mode;
            return (
              <React.Fragment key={opt.mode}>
                <Pressable
                  onPress={async () => {
                    await setTheme(opt.mode);
                    setShowThemeSheet(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={styles.sheetOptionRow}
                >
                  <Text
                    style={[
                      styles.sheetOptionLabel,
                      {
                        color: hub.text,
                        fontFamily: isSelected
                          ? typography.fontBodyBold
                          : typography.fontBody,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && <Check size={20} color={hub.text} />}
                </Pressable>
                {index < themeOptions.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: hub.line }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </Sheet>

      {/* Privacy and Account Controls Sheet */}
      <Sheet
        visible={showPrivacySheet}
        title="Privacy & account controls"
        onClose={() => setShowPrivacySheet(false)}
      >
        <View style={styles.sheetContent}>
          {/* Device-Local Cache Explanation & Action */}
          <View style={styles.sheetSection}>
            <View style={styles.sheetHeaderWithIcon}>
              <HardDrive size={18} color={hub.text} />
              <Text
                style={[
                  styles.sheetSubheading,
                  { color: hub.text, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                Device-local cache
              </Text>
            </View>
            <Text
              style={[
                styles.sheetParagraph,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              Offline views, in-progress profile drafts, and local study timers are stored
              directly on this device for speed and offline availability.
            </Text>
            <Button
              label={isClearingCache ? 'Clearing cache...' : 'Clear local device cache'}
              onPress={handleClearCache}
              variant="secondary"
              loading={isClearingCache}
              style={{ marginTop: spacing.sm }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: hub.line, marginVertical: spacing.md }]} />

          {/* Privacy Policy & Terms Links */}
          <View style={styles.sheetSection}>
            <View style={styles.sheetHeaderWithIcon}>
              <Shield size={18} color={hub.text} />
              <Text
                style={[
                  styles.sheetSubheading,
                  { color: hub.text, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                Data safety & compliance
              </Text>
            </View>
            <Text
              style={[
                styles.sheetParagraph,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              Career Pilot strictly adheres to Google Play Data Safety and GDPR standards. We do
              not sell user data or track students across external applications.
            </Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              <Pressable
                onPress={() => setShowTermsSheet(true)}
                style={styles.textLinkRow}
              >
                <FileText size={16} color={hub.muted} />
                <Text
                  style={[
                    styles.textLink,
                    { color: hub.text, fontFamily: typography.fontBodyBold },
                  ]}
                >
                  View Terms of Service & Privacy Statement
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const base = getApiBaseUrl();
                  Linking.openURL(`${base}/privacy`).catch(() => {});
                }}
                style={styles.textLinkRow}
              >
                <ExternalLink size={16} color={hub.muted} />
                <Text
                  style={[
                    styles.textLink,
                    { color: hub.text, fontFamily: typography.fontBodyBold },
                  ]}
                >
                  Online Privacy Policy & Data Disclosures
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: hub.line, marginVertical: spacing.md }]} />

          {/* Destructive Account Deletion */}
          <View style={styles.sheetSection}>
            <View style={styles.sheetHeaderWithIcon}>
              <Trash2 size={18} color={hub.danger} />
              <Text
                style={[
                  styles.sheetSubheading,
                  { color: hub.danger, fontFamily: typography.fontHeadingMedium },
                ]}
              >
                Permanent account deletion
              </Text>
            </View>
            <Text
              style={[
                styles.sheetParagraph,
                { color: hub.muted, fontFamily: typography.fontBody },
              ]}
            >
              Permanently erase your student profile, generated roadmaps, uploaded PDFs, chat
              history, resumes, and tracker applications from our servers.
            </Text>
            <Button
              label="Delete my account"
              onPress={() => setShowDeleteSheet(true)}
              variant="danger"
              style={{ marginTop: spacing.sm }}
            />
            <Pressable
              onPress={() => {
                const base = getApiBaseUrl();
                Linking.openURL(`${base}/account-deletion`).catch(() => {});
              }}
              style={[styles.textLinkRow, { marginTop: spacing.xs }]}
            >
              <ExternalLink size={14} color={hub.muted} />
              <Text
                style={[
                  styles.textLink,
                  { color: hub.muted, fontFamily: typography.fontBody, fontSize: 12 },
                ]}
              >
                Web-based account deletion portal
              </Text>
            </Pressable>
          </View>
        </View>
      </Sheet>

      {/* Confirmation Sheet for Destructive Account Deletion */}
      <Sheet
        visible={showDeleteSheet}
        title="Permanently delete account?"
        onClose={() => setShowDeleteSheet(false)}
      >
        <View style={styles.sheetContent}>
          <Text
            style={[
              styles.sheetParagraph,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            Are you sure you want to permanently delete your account ({user?.email})? All
            associated learning data, resumes, documents, and credentials will be purged
            immediately and cannot be recovered.
          </Text>
          <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
            <Button
              label="Confirm permanent deletion"
              onPress={handleDeleteAccount}
              variant="danger"
              loading={isDeleting}
            />
            <Button
              label="Cancel"
              onPress={() => setShowDeleteSheet(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Sheet>

      {/* Terms of Service & Privacy Sheet */}
      <Sheet
        visible={showTermsSheet}
        title="Terms & privacy policy"
        onClose={() => setShowTermsSheet(false)}
      >
        <ScrollView style={{ maxHeight: 360 }}>
          <Text
            style={[
              styles.termsHeading,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            1. User Data Ownership
          </Text>
          <Text
            style={[
              styles.sheetParagraph,
              { color: hub.muted, fontFamily: typography.fontBody, marginBottom: spacing.md },
            ]}
          >
            All resumes, study notes, and goals entered in Career Pilot remain your sole
            intellectual property. Career Pilot processes your data exclusively to generate
            custom learning roadmaps, ATS insights, and personalized study feedback.
          </Text>

          <Text
            style={[
              styles.termsHeading,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            2. Local Storage and Offline Usage
          </Text>
          <Text
            style={[
              styles.sheetParagraph,
              { color: hub.muted, fontFamily: typography.fontBody, marginBottom: spacing.md },
            ]}
          >
            Timer session logs and drafts are stored locally on your device. Clearing your
            device cache clears local copies without deleting cloud records.
          </Text>

          <Text
            style={[
              styles.termsHeading,
              { color: hub.text, fontFamily: typography.fontHeadingMedium },
            ]}
          >
            3. Right to Complete Erasure
          </Text>
          <Text
            style={[
              styles.sheetParagraph,
              { color: hub.muted, fontFamily: typography.fontBody },
            ]}
          >
            You have the right to request deletion of all stored records at any time via the
            Account Deletion feature, fulfilling GDPR and Google Play lifecycle rules.
          </Text>
        </ScrollView>
      </Sheet>
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
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: spacing.xl,
  },
  section: {
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  dropdownButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    borderRadius: radii.chip,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: typography.sizes.body,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: typography.sizes.body,
  },
  subtext: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
    paddingLeft: 34,
  },
  dataParagraph: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.xs,
  },
  actionRowText: {
    flex: 1,
  },
  actionRowTitle: {
    fontSize: typography.sizes.body,
  },
  actionRowSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  signOutContainer: {
    marginTop: spacing.lg,
  },
  signOutButton: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.chip,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: typography.sizes.body,
  },
  sheetContent: {
    paddingVertical: spacing.xs,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  sheetOptionLabel: {
    fontSize: typography.sizes.body,
  },
  sheetSection: {
    paddingVertical: spacing.xs,
  },
  sheetHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetSubheading: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
  },
  sheetParagraph: {
    fontSize: typography.sizes.body,
    lineHeight: 22,
  },
  textLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  textLink: {
    fontSize: typography.sizes.body,
  },
  termsHeading: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  demoCard: {
    padding: spacing.base,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  demoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  demoCardTitle: {
    fontSize: typography.sizes.body,
  },
  demoCardDescription: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
});
