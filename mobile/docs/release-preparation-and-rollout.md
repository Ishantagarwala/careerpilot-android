# Career Pilot — Release Preparation and Authorized Rollout (Phase 12)

**Document Version:** 1.0.0  
**Target Platform:** Android (Google Play Store)  
**Package Name:** `com.careerpilot.app`  
**Version:** `1.0.0` (Version Code `1`)  
**Target SDK:** Android 15 (API level 35) &bull; **Minimum SDK:** Android 7.0 (API level 24)  
**Bundler / Runtime:** Expo SDK 57, React Native 0.86, Hermes Bytecode Engine  

---

## 1. Executive Summary & Release Readiness

Career Pilot has completed full implementation and automated verification across all 35 screens (P01–P35), 4 core bottom navigation tabs, drawer navigation, and end-to-end integration flows. 

Phase 12 establishes production hardening, security audits, legal/data compliance, store listing assets, automated bundling verification, and a gated release operating procedure.

**Status:**
- **Automated Test Suite:** 125/125 tests passing (`npm test`).
- **TypeScript Typecheck:** 0 errors (`npm run typecheck` and `npx tsc --noEmit`).
- **Production Routing Hygiene:** All development fixtures, sandboxes, and abandoned mock screens removed.
- **Production Bundler:** Hermes bytecode Android bundle successfully generated with 3,384 modules compiled.

---

## 2. Security, Privacy & Data Protection Audit

| Area | Production Implementation | Verification Result |
| :--- | :--- | :--- |
| **Credential Storage** | Auth token (`careerpilot_auth_token`) stored inside Android Keystore via `expo-secure-store`. Never logged or stored in unencrypted storage. | Verified &bull; Pass |
| **Cache Isolation** | Offline caches and drafts keyed with `@prefix_${userId}` to prevent data leakage across accounts. | Verified &bull; Pass |
| **Logout Sanitization** | `AuthContext.logout()` executes `SecureStore.deleteItemAsync` and multi-removes all user-isolated caches, drafts, focus logs, and document references, preserving only device-level `@careerpilot_theme_mode`. | Verified &bull; Pass |
| **Cross-Tenant Authorization** | Every backend API route (`/api/profile`, `/api/ai-hub/*`, `/api/pdf/*`, `/api/resume/*`, `/api/jobs/*`) validates authenticated `userId` against target records. | Verified &bull; Pass |
| **Log Sanitization** | Console output contains zero passwords, tokens, full resume texts, or uploaded document buffers. | Verified &bull; Pass |
| **Cascade Account Deletion** | Destructive deletion via `DELETE /api/profile` permanently cascades across 12 database collections (`User`, `UserProfile`, `UserProgress`, `CareerRecommendation`, `Roadmap`, `CourseCompletion`, `Document`, `ChatHistory`, `Todo`, `Application`, `Resume`, `TeamPost`). | Verified &bull; Pass |

---

## 3. Google Play Store & Regulatory Compliance

### 3.1 Target API and 64-Bit Architecture
- **Target SDK 35 (Android 15):** Exceeds Google Play's requirement (minimum API 34).
- **Architecture:** Hermes 64-bit engine (`arm64-v8a`, `x86_64`) fully supported.
- **Android App Bundle (AAB):** Configured via `eas.json` for Google Play App Signing and dynamic delivery.

### 3.2 Permission Minimization
- Android Manifest permissions configured to `permissions: []` in `app.json`.
- File uploads utilize the Android System Storage Access Framework (SAF) via `expo-document-picker`, avoiding dangerous storage permissions (`READ_EXTERNAL_STORAGE` / `MANAGE_EXTERNAL_STORAGE`).
- PDF export utilizes Android native print services and system share sheet via `expo-print` and `expo-sharing`.

### 3.3 Google Play Data Safety Disclosures
- **In-App Account Deletion:** Available in `Settings &rarr; Account actions &rarr; Delete my account`.
- **Web-Based Account Deletion Resource:** Live at `https://careerpilot.app/account-deletion` satisfying Google Play Policy for external user data deletion requests.
- **Privacy Policy URL:** Live at `https://careerpilot.app/privacy` declaring collected fields, processing purposes, and zero third-party data sharing.
- **Terms of Service URL:** Live at `https://careerpilot.app/terms`.

---

## 4. Build Profiles & EAS Configuration (`eas.json`)

The application supports standard Expo Application Services (EAS) cloud and local builds:

```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "internal"
      }
    }
  }
}
```

### Build Commands:
- **Produce Internal Testing APK:**
  ```bash
  cd mobile && npx eas-cli build --platform android --profile preview
  ```
- **Produce Production Android App Bundle (.aab):**
  ```bash
  cd mobile && npx eas-cli build --platform android --profile production
  ```
- **Local Bundle Export Verification:**
  ```bash
  cd mobile && npx expo export --platform android
  ```

---

## 5. Store Listing Assets & Visual Artifacts

1. **App Icon:** High-resolution 1024&times;1024 master icon (`mobile/assets/icon.png`) and 512&times;512 adaptive foreground icon (`mobile/assets/android-icon-foreground.png`).
2. **Splash Screen:** 1024&times;1024 splash graphic (`mobile/assets/splash-icon.png`) with `#0A0A0A` background.
3. **Store Listing Copy:** Stored in `mobile/store-assets/play-store-metadata.json`:
   - Title: `Career Pilot: AI Career Guide` (30 chars)
   - Short Description: `Personalized career roadmaps, PDF note summaries, ATS resume tools & AI tutoring` (78 chars)
   - Full Description: Comprehensive feature breakdown, student data ownership guarantee, and support links.
   - Content Rating: PEGI 3 / Everyone.

---

## 6. Pre-Rollout Verification Checklist

Before publishing to production, complete the authorized rollout checklist:

- [x] **Code & Type Integrity:** Zero TypeScript errors, zero lint warnings.
- [x] **Automated Tests:** 125 tests passing covering all 35 screens and release invariants.
- [x] **Production Bundle:** Hermes bytecode export verified without bundling defects.
- [x] **Legal Compliance:** In-app and web Privacy Policy, Terms of Service, and Account Deletion live.
- [x] **Data Safety:** Complete Play Store Data Safety mapping documented in metadata.
- [ ] **EAS Build Trigger:** Execute internal testing build (`preview` profile) to obtain physical APK.
- [ ] **Internal Device Testing:** Test on physical lower-memory Android device (navigation, deep linking, offline cache, PDF share).
- [ ] **20-Tester Closed Beta Track:** Invite 20 internal testers on Google Play Console for 14-day validation (if personal developer account).
- [ ] **Publishing Authorization:** Present final verification report to user; await explicit authorization before promoting build to production track.

---

## 7. Rollback & Incident Response Plan

If an unexpected crash or critical defect occurs during staged rollout:
1. **Immediate Halt:** Pause the staged rollout in Google Play Console (reduces exposure to current percentage).
2. **Crash & ANR Triage:** Check Play Console Android Vitals (ensure crash rate < 1.09% and ANR rate < 0.47%).
3. **Rollback Strategy:** 
   - Backend API hotfix can be deployed independently without requiring an app store review.
   - If client-side patch is required, bump `versionCode` to `2` (`1.0.1`), trigger `eas build --profile production`, and submit an expedited emergency release.
