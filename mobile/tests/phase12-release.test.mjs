import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Locate the web app, which owns the public /privacy, /terms and
 * /account-deletion pages these assertions check for.
 *
 * This used to be `path.resolve(rootDir, '..')` — one level above the app. That
 * only worked while the app sat inside the CareerPilotAI monorepo next to the
 * web project. Now that the app lives in its own repository, `..` is the
 * repository root and there is no web app there, so the test failed for a
 * reason that has nothing to do with the app being wrong.
 *
 * Probe the layouts we actually use, and report honestly when none is present
 * rather than asserting against a path that cannot exist.
 */
function findWebWorkspace() {
  const candidates = [
    path.resolve(rootDir, '..'), // monorepo: <root>/mobile -> <root>
    path.resolve(rootDir, '..', '..'), // nested: <root>/apps/mobile -> <root>
  ];
  return (
    candidates.find(
      (dir) =>
        fs.existsSync(path.join(dir, 'app', 'privacy', 'page.tsx')) &&
        fs.existsSync(path.join(dir, 'components', 'layout', 'Footer.tsx'))
    ) ?? null
  );
}

const workspaceDir = findWebWorkspace();

test('Phase 12: app.json release configuration and Android Play compliance', () => {
  const appJsonPath = path.join(rootDir, 'app.json');
  assert.ok(fs.existsSync(appJsonPath), 'app.json must exist');

  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const expo = appConfig.expo;
  assert.ok(expo, 'expo configuration must exist');

  // Identity & Versioning
  assert.equal(expo.name, 'Career Pilot');
  assert.equal(expo.slug, 'career-pilot');
  assert.equal(expo.version, '1.0.0');
  assert.equal(expo.scheme, 'careerpilot');

  // Android Configuration
  assert.ok(expo.android, 'android configuration must exist');
  assert.equal(expo.android.package, 'com.careerpilot.app');
  assert.equal(typeof expo.android.versionCode, 'number');
  assert.ok(expo.android.versionCode >= 1, 'versionCode must be >= 1');
  assert.ok(Array.isArray(expo.android.permissions), 'android permissions must be an explicit array');
  assert.equal(expo.android.permissions.length, 0, 'no unnecessary dangerous permissions for store submission');

  // Splash & Adaptive Icon
  assert.ok(expo.splash, 'splash configuration must exist');
  assert.ok(fs.existsSync(path.join(rootDir, expo.splash.image)), 'splash image file must exist');
  assert.ok(expo.android.adaptiveIcon, 'adaptiveIcon configuration must exist');
  assert.ok(fs.existsSync(path.join(rootDir, expo.android.adaptiveIcon.foregroundImage)), 'adaptive foreground icon must exist');
  assert.ok(fs.existsSync(path.join(rootDir, expo.android.adaptiveIcon.backgroundImage)), 'adaptive background icon must exist');
  assert.ok(fs.existsSync(path.join(rootDir, expo.icon)), 'app icon must exist');
});

test('Phase 12: EAS build profiles for preview APK and production AAB', () => {
  const easJsonPath = path.join(rootDir, 'eas.json');
  assert.ok(fs.existsSync(easJsonPath), 'eas.json must exist for EAS cloud and local release builds');

  const easConfig = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
  assert.ok(easConfig.build, 'eas.json must define build profiles');

  // Preview APK profile for internal testing
  assert.ok(easConfig.build.preview, 'preview build profile must exist');
  assert.equal(easConfig.build.preview.android?.buildType, 'apk');

  // Production App Bundle profile for Google Play Store
  assert.ok(easConfig.build.production, 'production build profile must exist');
  assert.equal(easConfig.build.production.android?.buildType, 'app-bundle');
});

test('Phase 12: Production routing hygiene - no development fixtures or abandoned stacks', () => {
  const appDir = path.join(rootDir, 'app');
  const files = fs.readdirSync(appDir, { recursive: true });

  const disallowedKeywords = ['test-', 'mock-', 'fixture', 'demo-screen', 'sandbox', 'playground'];
  for (const file of files) {
    const filename = String(file).toLowerCase();
    for (const disallowed of disallowedKeywords) {
      assert.ok(
        !filename.includes(disallowed),
        `Development or fixture route "${filename}" must not exist in production routes`
      );
    }
  }
});

test('Phase 12: Secure storage and privacy - credentials segregation and cleanup', () => {
  const authContextPath = path.join(rootDir, 'src', 'context', 'AuthContext.tsx');
  const authContent = fs.readFileSync(authContextPath, 'utf8');

  // SecureStore for token
  assert.ok(authContent.includes('clearStoredToken()'), 'logout must clear SecureStore auth token');
  assert.ok(authContent.includes('AsyncStorage.multiRemove'), 'logout must remove user-specific keys');
  assert.ok(authContent.includes('@careerpilot_theme_mode'), 'logout must preserve device-level appearance mode');
});

/*
 * The public legal pages belong to the web app, not to this repository. When
 * the web app is not checked out alongside the app there is nothing here to
 * verify, and a failure would be misleading — so the test is skipped with a
 * reason instead of asserting against a path that cannot exist.
 */
test(
  'Phase 12: Privacy Policy and Account Deletion public web portals exist',
  { skip: workspaceDir ? false : 'web app not present next to this repository' },
  () => {
    const privacyPage = path.join(workspaceDir, 'app', 'privacy', 'page.tsx');
    const termsPage = path.join(workspaceDir, 'app', 'terms', 'page.tsx');
    const deletionPage = path.join(workspaceDir, 'app', 'account-deletion', 'page.tsx');
    const footerLayout = path.join(workspaceDir, 'components', 'layout', 'Footer.tsx');

    assert.ok(fs.existsSync(privacyPage), 'Public web /privacy page must exist for Google Play Data Safety requirement');
    assert.ok(fs.existsSync(termsPage), 'Public web /terms page must exist');
    assert.ok(fs.existsSync(deletionPage), 'Public web /account-deletion page must exist for Google Play Account Deletion requirement');

    const footerContent = fs.readFileSync(footerLayout, 'utf8');
    assert.ok(footerContent.includes('/privacy'), 'Footer must link to /privacy');
    assert.ok(footerContent.includes('/terms'), 'Footer must link to /terms');
    assert.ok(footerContent.includes('/account-deletion'), 'Footer must link to /account-deletion');
  }
);

test('Phase 12: Play Store metadata and Data Safety declarations completeness', () => {
  const metadataPath = path.join(rootDir, 'store-assets', 'play-store-metadata.json');
  assert.ok(fs.existsSync(metadataPath), 'play-store-metadata.json must exist');

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  assert.ok(metadata.storeListing.title.length <= 30, 'Play Store title must be <= 30 characters');
  assert.ok(metadata.storeListing.shortDescription.length <= 80, 'Short description must be <= 80 characters');
  assert.ok(metadata.storeListing.fullDescription.length <= 4000, 'Full description must be <= 4000 characters');

  assert.equal(metadata.dataSafety.securityPractices.encryptionInTransit, true);
  assert.equal(metadata.dataSafety.securityPractices.inAppDeletion, true);
  assert.ok(metadata.dataSafety.securityPractices.accountDeletionWebLink.includes('account-deletion'));
});
