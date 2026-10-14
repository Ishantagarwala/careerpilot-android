# Android Execution Log — Phase 1, Phase 2, Phase 3 & Phase 4

## Session Overview
- **Phase:** Phase 4 — Career discovery and learning (P05 Interests, P06 Goals, P07 Subjects, P08 Skills, P09 Career Matches, P10 Learn Roadmap, P11 Courses & Filter Sheet)
- **Status:** Complete & Phase Gate Passed
- **Verification:**
  - Next.js web application: TypeScript checked (`npx tsc --noEmit` -> 0 errors) and Turbopack production build verified (`npm run build` -> 40 API routes + all pages compiled cleanly).
  - Native workspace (`mobile/`): TypeScript checked (`npm run typecheck` -> 0 errors).
  - Test suite: `npm test` -> 38/38 tests passed across auth, home, shared assessment draft, validation, ranking, roadmap stages, and course filtering/completions.

---

## 1A. Mobile Contracts & Server Dependency Gates
1. **Authentication & Session Strategy:**
   - Implemented `lib/mobileAuth.ts` using `jose` with `AUTH_SECRET` for HS256 JWT generation and validation (30-day expiration).
   - Augmented `lib/auth.ts:getAuthenticatedUser(req?: Request)` to seamlessly authenticate both native `Bearer <token>` headers and web NextAuth cookie sessions.
   - Built `POST /api/auth/mobile/login` returning `{ token, expiresAt, user: { id, email, name } }`.
   - Built `GET /api/auth/mobile/session` verifying stored bearer tokens.
2. **Idempotent Course Completion (Pre-P11 Gate):**
   - Created `models/CourseCompletion.ts` with compound unique index `{ userId: 1, courseId: 1 }`.
   - Implemented `POST` and `DELETE /api/courses/completion` calculating authoritative per-user completed counts and synchronizing `UserProgress.coursesCompleted`.
3. **Safe Roadmap Generation (Pre-P09/P10 Gate):**
   - Eliminated destructive `Roadmap.deleteOne` on `GET /api/roadmap`. Added safe path-change detection returning `{ roadmap: null, pathChanged: true }`.
   - Implemented explicit `POST /api/roadmap` with confirmation requirement to avoid accidental replacements.
4. **Streak Calculation & Read-Only Snapshot (Pre-P04 Gate):**
   - Separated dashboard reads from activity mutation in `app/api/progress/route.ts`. Reading progress is now strictly passive.
5. **Upload Size & Storage Bounds (Pre-P15 Gate):**
   - Enforced 10MB file limit with HTTP 413 response in `app/api/ai-hub/upload/route.ts`.
   - Standardized canonical mobile response shape `{ type, docId, filename, fileUrl, summary, questions }`.
6. **External Event ID Normalization (Pre-P32 Gate):**
   - Updated `models/TeamPost.ts` and `app/api/projects/teams/route.ts` to support external string IDs (e.g. `hackerearth-...`, `devfolio-...`) without Mongoose ObjectId casting errors.
7. **Account Lifecycle & Privacy Compliance:**
   - Implemented cascading `DELETE /api/profile` to permanently erase roadmaps, resumes, documents, threads, applications, and completions under Google Play and GDPR privacy requirements.
8. **Proxy Route Protection:**
   - Added `/jobs` and `/projects` to `proxy.ts` protected route matchers.

---

## 1B. Native Workspace Foundation
1. **Workspace & Engine:**
   - Initialized `mobile/` with Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6.0.
   - Configured `app.json` with scheme `careerpilot`, Android package `com.careerpilot.app`, and edge-to-edge support.
2. **API Client (`mobile/src/api/client.ts`):**
   - Automatically detects Android emulator and resolves host machine `10.0.2.2:3000` (or `EXPO_PUBLIC_API_URL`).
   - Injects secure bearer tokens from `expo-secure-store`.
   - Configured timeout handling (15s default) and normalized `ApiError` responses.
   - Attached convenient, typed REST helpers (`.get`, `.post`, `.put`, `.delete`).
3. **Authentication Context (`mobile/src/context/AuthContext.tsx`):**
   - Session restoration on cold start before routing.
   - Cache clearing on sign out (`clearStoredToken()`, AsyncStorage flushing).

---

## 1C. Monolith Primitives & Navigation Shell
1. **Design System & Typography:**
   - Centralized tokens in `mobile/src/theme/tokens.ts`:
     - Monolith Dark default (`#0A0A0A` bg, `#1A1A1A` card, `#262626` border, `#E5E2E1` text).
     - Monolith Light support (`#F9F9F9` bg, `#FFFFFF` card, `#CFC4C5` border, `#1A1C1C` text).
     - Rectangular radius tokens: `radii.none` (0) and `radii.xs` (2) / `radii.sm` (4).
     - Touch targets: minimum 48dp on all actionable surfaces.
   - Fonts bundled via `expo-font` / `@expo-google-fonts`:
     - Hanken Grotesk (`HankenGrotesk-Bold`, `HankenGrotesk-SemiBold`).
     - Inter (`Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`).
     - JetBrains Mono (`JetBrainsMono-Regular`, `JetBrainsMono-Medium`).
     - Deterministic system fallback helper in `mobile/src/theme/fonts.ts`.
2. **Monolith Primitives (`mobile/src/components/primitives/`):**
   - `Button`: Primary, secondary, text, and danger variants with 48dp touch compliance and loading states.
   - `IconButton`: 48x48dp touch targets for menu, back, and tool actions.
   - `Field`: Accessible labels, rectangular inputs, error messages, and keyboard types.
   - `Card`: Monolith dark/light border container.
   - `Chip`: Rectangular filter/choice chips with pressed states.
   - `ListRow`: Row layout with leading/trailing icon slots.
   - `ProgressTrack`: Slim rectangular progress bar supporting both `progress` (0..1) and `progressPercent` (0..100).
   - `Sheet`: Bottom sheet dialog with scrim backdrop and Android hardware Back dismissal.
   - `StateView`: Reusable `OfflineBanner`, `ErrorStateView`, `LoadingStateView`, and `EmptyStateView` components.
3. **Four Tab Roots & Custom Tab Bar:**
   - Configured `mobile/app/(tabs)/_layout.tsx` with exactly 4 tabs:
     - **Home** (`LayoutDashboard`)
     - **Learn** (`Map`)
     - **Study** (`Sparkles`)
     - **Career** (`Briefcase`)
   - Custom `BottomTabBar` component with visible 11px labels, 48dp touch targets, active indicators, and automatic keyboard hiding.
4. **Grouped Hamburger Drawer (`mobile/src/components/navigation/DrawerMenu.tsx`):**
   - Matches approved `menu.png` and `approved-preview.html`:
     - 88% screen width (capped at 360dp on tablets).
     - Dark `#0E0E0E` / Light `#F3F3F3` drawer background with 1px border.
     - Brand header with square "C" logo badge, "Career Pilot", and "YOUR LEARNING JOURNEY" in JetBrains Mono.
     - Student Account card displaying avatar, user name, and email with direct navigation to profile.
     - 5 Groups: OVERVIEW, LEARNING, STUDY TOOLS, CAREER TOOLS, ACCOUNT.
     - Active item highlighted with `accent` surface and `2px solid primary` indicator.
     - Touch-to-dismiss scrim and Android hardware Back button integration.
5. **App Header (`mobile/src/components/navigation/AppHeader.tsx`):**
   - Shows Hamburger menu on root tabs (`isRoot={true}`).
   - Shows Back arrow button on child screens (`isRoot={false}`).
   - Left-aligns screen title directly adjacent to leading navigation icon, matching all approved mockups.
   - Displays quick profile avatar button on authenticated root tabs.
6. **Screen Registry & Complete Page Units:**
   - Created `mobile/src/navigation/routes.ts` documenting all 35 page units.
   - Implemented all 35 route components in `mobile/app/` with zero 404 links.
   - Account screens (`profile.tsx`, `settings.tsx`) live in the root stack above tabs, naturally restoring the previous tab branch on Back.
   - Resume preview (`resume-preview.tsx`) operates in full-screen mode with tabs hidden.

---

## Phase 2 — Account Entry (One Page at a Time)

### P01 — Welcome
- **Page ID / name:** P01 — Welcome
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/welcome.png`, `approved-preview.html#welcome`
- **Prerequisites completed:** Phase 1 (Navigation Shell & Theme Primitives)
- **Routes / contracts used:** `/(auth)/welcome`, `/(auth)/register`, `/(auth)/login`
- **Files changed:** `mobile/app/(auth)/welcome.tsx`, `mobile/src/components/navigation/AppHeader.tsx`
- **States and actions checked:**
  - Initial cold launch awaiting session restoration: `index.tsx` displays `LoadingStateView` until token resolution finishes; never briefly flashes welcome screen for signed-in users.
  - AppHeader: Left-aligned "Career Pilot" title with 1px border; leading hamburger and profile avatar cleanly omitted (`hideLeading={true}`, `hideProfile={true}`).
  - Brand Mark: 48x48dp square C mark with 2dp corner radius (`radii.xs`), white background with black bold letter on dark theme.
  - Eyebrow: `CAREER PILOT` in JetBrains Mono Medium (11px, letter-spacing 1.5).
  - Heading: Two lines: `Your next step` / `starts here.` in Hanken Grotesk Bold (38px, line height 42px).
  - Introduction: `Find your direction. Build your skills.` / `Move toward the career you want.` in Inter Regular (14px).
  - Benefit rows: Compass, Map, and Sparkles icons with exact text items; accessible typography tokens.
  - Actions: Primary "Create account" with right arrow icon routes to `/(auth)/register`; Secondary "Log in" routes to `/(auth)/login`. Both actions maintain >=48dp touch targets.
  - Scroll view: Centered layout with `flexGrow: 1` ensuring accessibility on compact screens without clipping buttons.
- **Native device / viewport / theme / font scale:** 390 × 844 dp reference viewport; Monolith Dark and Light theme compliant; 1.0x to 1.3x font scale verified.
- **Capture paths and comparison findings:** Visual structure conforms directly to `welcome.png` with left-aligned app header and no bottom tabs.
- **Tests / commands / results:** `npm test` -> `P01: Welcome Screen contract & structure` passed.
- **Downstream links awaiting integration:** Forward routes `/(auth)/register` and `/(auth)/login` verified.
- **Native adaptations / approved deviations:** Integrated native `AppHeader` ensuring safe insets and edge-to-edge status bar padding.
- **Remaining issue or blocker:** None.
- **Next exact step:** P02 — Login.

---

### P02 — Login
- **Page ID / name:** P02 — Login
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/login.png`, `approved-preview.html#login`
- **Prerequisites completed:** P01 + Native Auth contract (`lib/mobileAuth.ts`, `apiClient`)
- **Routes / contracts used:** `POST /api/auth/mobile/login`, `GET /api/auth/mobile/session`, `/(auth)/login`
- **Files changed:** `mobile/app/(auth)/login.tsx`, `mobile/src/context/AuthContext.tsx`, `mobile/src/components/primitives/Field.tsx`
- **States and actions checked:**
  - Header: Back arrow leading button navigates back to welcome screen; title "Log in"; profile avatar hidden.
  - Form & validation: Field-level validation for empty email, malformed email regex, and empty password.
  - Autofill & keyboard: `keyboardType="email-address"`, `autoComplete="email"`, `textContentType="username"`, `autoComplete="password"`, `textContentType="password"`, `KeyboardAvoidingView` integration with `keyboardShouldPersistTaps="handled"`.
  - Password visibility toggle: Interactive eye icon inside field container toggles `secureTextEntry`, accompanied by accessible "Show password" / "Hide password" labels.
  - Contract & error handling:
    - 401 Unauthorized maps to clear user-facing error "Invalid email or password. Please try again."
    - 429 maps to "Too many attempts. Please try again in a few moments."
    - 0 / 408 network errors map to "Cannot connect to server. Please check your internet connection."
    - On failure, email is preserved while password is automatically cleared for security.
  - Duplicate prevention: Primary button disabled with `ActivityIndicator` during active request.
  - Intended destination preservation: Supports `redirect` query parameter and `redirectPath` in `AuthContext` to seamlessly route authenticated users back to intended protected destinations (e.g. `/profile`, `/study`).
  - Offline resilience: Stored JWT tokens are retained during offline/timeout blips rather than being wiped prematurely.
- **Native device / viewport / theme / font scale:** 390 × 844 dp reference viewport; Monolith Dark and Light theme compliant; accessible keyboard avoidance.
- **Capture paths and comparison findings:** Visual structure directly matches `login.png` with inline eye toggle and footer link to register.
- **Tests / commands / results:** `npm test` -> 7 login validation and error mapping tests passed.
- **Downstream links awaiting integration:** Forward route `/(tabs)/home` and deep link redirects verified.
- **Native adaptations / approved deviations:** Keyboard avoiding wrapper and safe inset handling for Android edge-to-edge mode.
- **Remaining issue or blocker:** None.
- **Next exact step:** P03 — Register.

---

### P03 — Register
- **Page ID / name:** P03 — Register
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/register.png`, `approved-preview.html#register`
- **Prerequisites completed:** P02
- **Routes / contracts used:** `POST /api/auth/register`, `POST /api/auth/mobile/login`, `/(auth)/register`
- **Files changed:** `mobile/app/(auth)/register.tsx`
- **States and actions checked:**
  - Header: Back arrow leading button navigates back; title "Create account"; profile avatar hidden.
  - Four input fields:
    1. Full name (`autoCapitalize="words"`, `autoComplete="name"`)
    2. Email (`keyboardType="email-address"`, `autoComplete="email"`, `autoCapitalize="none"`)
    3. Password (secure entry with eye toggle, min 6 characters rule)
    4. Confirm password (secure entry with eye toggle, strict match against password)
  - Validation: Real-time checks for required fields, standard email regex, password minimum 6 chars, password matching.
  - Contract & lifecycle flow:
    - Step 1: Invokes `POST /api/auth/register` with `{ name, email, password }`.
    - Handles duplicate email: Server returns 400 "User with this email already exists", cleanly presented on the email field.
    - Step 2: On successful creation, immediately invokes native session establishment via `login(email, password)`.
    - Step 3: Navigates cleanly to `/(tabs)/home`, reaching the new-user home state with empty authoritative progress.
    - Recovery: If session establishment experiences an unexpected transient fault after account creation, user is gracefully redirected to `/(auth)/login` with email prefilled to prevent accidental duplicate registration.
  - Primary button: "Create account" without arrow icon, exactly matching `register.png`.
  - Footer: "Already have an account? Log in" routes to `/(auth)/login`.
- **Native device / viewport / theme / font scale:** 390 × 844 dp reference viewport; Monolith Dark and Light theme compliant.
- **Capture paths and comparison findings:** Visual structure conforms directly to `register.png`.
- **Tests / commands / results:** `npm test` -> 5 registration validation and contract tests passed.
- **Downstream links awaiting integration:** Forward route `/(tabs)/home` verified.
- **Native adaptations / approved deviations:** Android keyboard avoidance and touch target standards.
- **Remaining issue or blocker:** None.
- **Phase Gate Status:** Passed. Register -> login -> restart -> session expiry -> logout verified.

---

## Phase 3 — Home Overview

### P04 — Home (Returning and New Account States)
- **Page ID / name:** P04 — Home, returning and new account states
- **Status:** verified
- **Reference screenshots / templates:** `docs/android-mockups/home.png`, `docs/android-mockups/new-home.png`, `docs/android-mockups/home-light.png`, `approved-preview.html#home`, `approved-preview.html#new-home`
- **Prerequisites completed:** P03 + progress/streak contract (`GET /api/progress`)
- **Routes / contracts used:** `GET /api/progress`, `/(tabs)/home`, `/(tabs)/learn`, `/(tabs)/study`, `/focus`, `/interests`, `/profile`
- **Files changed:**
  - `mobile/app/(tabs)/home.tsx` (fully implemented with state resolution, dynamic readiness sheet, live streak week, and pull-to-refresh)
  - `mobile/src/api/progress.ts` (created typed progress client, readiness calculator, and AsyncStorage offline cache)
  - `app/api/progress/route.ts` (added fallback to selected CareerRecommendation and included currentStage in roadmap response)
  - `mobile/tests/phase3-home.test.mjs` (unit test suite for states, math, streaks, and offline resilience)
  - `android-development-todos.md` (checked off all Phase 3 tasks, recorded gate passed)
- **States and actions checked:**
  - App bar / greeting:
    - Root header with hamburger menu leading icon, "Career Pilot" title, and user avatar button routing to `/profile`.
    - Eyebrow: `YOUR LEARNING JOURNEY` in JetBrains Mono.
    - Returning account greeting: `Welcome back,\n{displayName}.` with `A little progress, every day.`
    - New account greeting: `Find your\nstarting point.` with `Tell us what you enjoy and what you want to learn.`
  - Selected Career Path card (Returning account):
    - Eyebrow row with `SELECTED CAREER PATH` and compass icon.
    - Career title in 23px font (e.g. `Software Engineer`).
    - Milestone metadata e.g. `Intermediate · 5 of 12 milestones`.
    - Rectangular `ProgressTrack` reflecting authoritative milestone completion percentage.
    - Primary "Continue learning" button with right arrow routing to `/(tabs)/learn`.
  - Readiness indicator (Returning account):
    - Left side: `READINESS INDICATOR` eyebrow, `Keep building momentum.` title, and accessible "How is this calculated?" touch link.
    - Right side: Big 40px readiness score with `/100` denominator in JetBrains Mono.
    - Bottom border dividing line conforming to `home.png` / `approved-preview.html`.
  - Dynamic "How is this calculated?" sheet:
    - Displays genuine activity breakdown based on actual counts, never hardcoding sample 64/100:
      - Milestones: `{completedMilestones} of {totalMilestones} ({rate}%) · 40% weight` -> points
      - Courses complete: `{coursesCompleted} courses (10 pts each, max 30) · 30% weight` -> points
      - PDFs studied: `{pdfsAnalyzed} PDFs (5 pts each, max 15) · 15% weight` -> points
      - AI tutor sessions: `{tutorSessions} sessions (3 pts each, max 15) · 15% weight` -> points
      - Authoritative total score: `{readinessScore} / 100`
    - Explicit explanation: activity formula tracking genuine study engagement, not employability probability.
  - Counts / metrics row:
    - 3 columns with bottom divider: `Courses complete`, `PDFs studied`, `Tutor session(s)` with bold numbers and responsive plural labels.
  - Learning streak section:
    - Section header with `Learning streak` and flame tag `{streakDays} days`.
    - 7-box week grid (`Su`, `Mo`, `Tu`, `We`, `Th`, `Fr`, `Sa`).
    - Today's box highlighted with border outline.
    - Authoritative checkmarks `✓` for days active in current streak window, `—` for inactive days.
  - Focus session CTA listrow:
    - Timer icon, "Make time to focus", "Start a 25-minute study session", arrow icon routing to `/focus`.
  - New account variant (`new-home.png`):
    - Automatically rendered when `careerPath` is absent / null.
    - "No career path yet" card with compass icon and "Find my path" primary button routing to `/interests`.
    - "You can also explore" section with two listrows:
      - "Ask your AI tutor" -> `/(tabs)/study`
      - "Start a focus session" -> `/focus`
    - No fabricated counts, streaks, or readiness score.
  - Offline resilience & honest states:
    - Instant load from `@cache_home_progress_${userId}` in AsyncStorage.
    - Shows `OfflineBanner` when network is offline while displaying cached data.
    - `LoadingStateView` during cold un-cached initial fetch.
    - `ErrorStateView` with retry when server is unreachable and no cache exists.
    - Read-only `GET /api/progress`: pull-to-refresh never increments user activity or streak days accidentally.
- **Native device / viewport / theme / font scale:** 390 × 844 dp reference viewport; Monolith Dark and Light theme compliant; accessible minimum 48dp touch targets on all interactive rows and sheet trigger.
- **Capture paths and comparison findings:** Visual structure conforms directly to `home.png`, `new-home.png`, and `home-light.png`.
- **Tests / commands / results:**
  - `npm test` -> 25/25 tests passed (10 dedicated tests for P04 state resolution, readiness formula, streak grid, and cache).
  - Native workspace typecheck: `npm run typecheck` -> 0 errors.
  - Web application build: `npm run build` -> 40 API routes + static pages cleanly compiled with Turbopack.
- **Downstream links awaiting integration:**
  - `/interests` (P05 — Assessment: Interests)
  - `/(tabs)/learn` (P10 — Learn: Roadmap)
  - `/(tabs)/study` (P12 — AI Study Hub)
  - `/focus` (P19 — Focus Session)
  - `/profile` (P34 — Profile)
- **Remaining issue or blocker:** None.
- **Phase Gate Status:** Passed. Both account states render authoritative data, readiness formula is strictly dynamic, offline cache fallback verified, and downstream links correctly wired.

---

## Phase 4 — Career Discovery and Learning

### P05 — Assessment: Interests
- **Page ID / name:** P05 — Assessment: interests
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/interests.png`, `approved-preview.html#interests`
- **Prerequisites completed:** P04 + user-scoped assessment draft storage (`@careerpilot_assessment_draft_${userId}`)
- **Routes / contracts used:** `/interests`, `/goals`
- **Files changed:** `mobile/app/interests.tsx`, `mobile/src/api/career.ts`, `mobile/src/components/primitives/StepTrack.tsx`, `mobile/src/components/primitives/ChoiceButton.tsx`
- **States and actions checked:**
  - Header: Back arrow leading button, title "Assessment · interests", profile avatar hidden.
  - Eyebrow: `CAREER DISCOVERY` in JetBrains Mono Medium; Meta: `STEP 1 OF 4`.
  - Steptrack: 4-segment indicator with 1 filled segment (`colors.primary`), 3 accent segments.
  - Heading: `What draws\nyour interest?` in Hanken Grotesk Bold (32px).
  - Subtitle: `Choose the areas you enjoy exploring.`
  - Rectangular Choice buttons: 8 full-width options matching web config (Software engineering, Artificial intelligence, Data science, Cybersecurity, Web development, UI/UX design, Cloud computing, Mobile development).
  - Selected state: Primary background, onPrimary text, font bold; unselected card surface with 1px border.
  - Accessibility: `accessibilityRole="checkbox"`, `accessibilityState={{ checked: isSelected }}` exposed to TalkBack.
  - User-scoped draft persistence: Reads and saves from `@careerpilot_assessment_draft_${userId}` on every toggle; retains selections across back navigation and app restarts.
  - Minimum selection validation: Prevents advancing with 0 selected; renders adjacent error "Please select at least one interest to continue."
  - Continue button: Validates >= 1 selected, preserves draft, routes to `/goals`.
- **Tests / commands / results:** `npm test` -> P05 validation and toggling tests passed.

---

### P06 — Assessment: Goals
- **Page ID / name:** P06 — Assessment: goals
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/goals.png`, `approved-preview.html#goals`
- **Prerequisites completed:** P05
- **Routes / contracts used:** `/goals`, `/interests`, `/subjects`
- **Files changed:** `mobile/app/goals.tsx`
- **States and actions checked:**
  - Header: Back arrow leading button navigates back to `/interests`; title "Assessment · goals".
  - Eyebrow: `CAREER DISCOVERY`; Meta: `STEP 2 OF 4`.
  - Steptrack: 2 filled segments, 2 unfilled.
  - Heading: `What do you\nwant to achieve?`
  - Subtitle: `Think about the work you would like to do and the skills you want to build.`
  - Label: `Your career goals` above multiline text area (minHeight: 140dp, textAlignVertical: top).
  - Keyboard avoidance: `KeyboardAvoidingView` with `keyboardShouldPersistTaps="handled"` ensuring Continue button remains reachable.
  - Bounded input validation: Requires at least 10 characters without enforcing an invented career choice. Shows adjacent explanatory error if < 10 characters.
  - Shared draft persistence: Restores goals from draft; updating goals retains earlier selected interests.
  - Continue button: Validates, saves draft, routes to `/subjects`.
- **Tests / commands / results:** `npm test` -> P06 goals 10-char threshold and draft retention tests passed.

---

### P07 — Assessment: Subjects
- **Page ID / name:** P07 — Assessment: subjects
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/subjects.png`, `approved-preview.html#subjects`
- **Prerequisites completed:** P06
- **Routes / contracts used:** `/subjects`, `/goals`, `/skills`
- **Files changed:** `mobile/app/subjects.tsx`
- **States and actions checked:**
  - Header: Back arrow leading button navigates back to `/goals`; title "Assessment · subjects".
  - Eyebrow: `CAREER DISCOVERY`; Meta: `STEP 3 OF 4`.
  - Steptrack: 3 filled segments, 1 unfilled.
  - Heading: `Which subjects\ndo you enjoy?`
  - Subtitle: `Select at least one subject.`
  - Supported subjects: 8 options matching API schema (Programming, Mathematics, Statistics, Data structures, Database systems, Computer networks, Operating systems, Design).
  - Rectangular choice buttons with TalkBack `accessibilityRole="checkbox"`.
  - Minimum selection validation: Rejects 0 selected with adjacent error; retains earlier interests and goals in draft.
  - Continue button: Saves draft, routes to `/skills`.
- **Tests / commands / results:** `npm test` -> P07 subject validation tests passed.

---

### P08 — Assessment: Skills & Final Submission
- **Page ID / name:** P08 — Assessment: skills and final submission
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/skills.png`, `approved-preview.html#skills`
- **Prerequisites completed:** P07 + `POST /api/career/assess`
- **Routes / contracts used:** `POST /api/career/assess`, `/skills`, `/subjects`, `/matches`
- **Files changed:** `mobile/app/skills.tsx`
- **States and actions checked:**
  - Header: Back arrow leading button navigates back to `/subjects`; title "Assessment · skills".
  - Eyebrow: `CAREER DISCOVERY`; Meta: `STEP 4 OF 4`.
  - Steptrack: 4 filled segments.
  - Heading: `Build on what\nyou already know.`
  - Subtitle: `Add a skill and your current comfort level.`
  - Skill input form:
    - Text input with placeholder `e.g. Python, Figma`.
    - Level selector: 3 rectangular choices (`Beginner`, `Intermediate`, `Advanced`).
    - Secondary `+ Add skill` button.
    - Normalization: Trims leading/trailing whitespace; blocks duplicate skill names with "Skill already added".
    - Auto-add: If user taps "Find my matches" with valid skill text typed, it is automatically included in the submission payload.
  - Added skill list: Displays skill name and level; remove button (X) with accessible >=48dp touch target.
  - Pre-submit review card: Compact summary displaying selected interests count/list and subjects count/list without altering the approved page hierarchy.
  - Submission contract:
    - Disables submit button during active request; shows spinner with "Analyzing your profile and finding top matches…".
    - Dispatches full `{ interests, goals, subjects, skills }` payload to `POST /api/career/assess`.
    - Timeout resilience: Configured 45s timeout for AI generation.
    - Error safety: Draft is PRESERVED on error or timeout; user can retry without losing input.
    - Confirmed success: Caches recommendations, clears draft from storage, routes to `/matches`.
- **Tests / commands / results:** `npm test` -> P08 duplicate detection, whitespace trimming, auto-add, and failure safety tests passed.

---

### P09 — Career Matches
- **Page ID / name:** P09 — Career matches
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/matches.png`, `approved-preview.html#matches`
- **Prerequisites completed:** P08 + `GET /api/career/recommendations`, `POST /api/career/select`
- **Routes / contracts used:** `GET /api/career/recommendations`, `POST /api/career/select`, `/matches`, `/(tabs)/learn`, `/interests`
- **Files changed:** `mobile/app/matches.tsx`
- **States and actions checked:**
  - Header: Back arrow leading button navigates back; title "Career matches".
  - Eyebrow: `YOUR CAREER MATCHES`; Heading: `Explore your\npossibilities.`; Subtitle: `Suggestions based on your interests, goals and skills.`
  - Real recommendations fetched from `GET /api/career/recommendations`.
  - Honest states:
    - Loading: `LoadingStateView` with skeleton cards.
    - Empty: `EmptyStateView` with "Start assessment" CTA to `/interests`.
    - Error: `ErrorStateView` with retry button.
    - Offline: Loads from `@careerpilot_recommendations_cache_${userId}` with `OfflineBanner`.
  - Top AI Match card:
    - `TOP AI MATCH` tag + match score percentage (e.g. `92%`).
    - Career title (e.g. `Software Engineer`).
    - Clear 2-sentence AI reasoning.
    - Primary button: `Choose this path` with `ArrowRight`.
  - Subsequent match cards: Match percentage, career title, reasoning, secondary `Choose this path` button.
  - Active path state: Marked with `CURRENT PATH` tag and `Active path` button with `Check` icon.
  - Path selection:
    - Calls `POST /api/career/select` with `{ recommendationId: rec._id }`.
    - Shows loading indicator on the specific button being selected (`selectingId`).
    - If user already had an active path, displays confirmation dialog before replacing.
    - On confirmed server success: updates local selection state, caches data, and navigates to `/(tabs)/learn`.
    - On failure: preserves current state, does not display fake active path.
  - Fine print: `AI matches are guidance, not guarantees. Explore the reasoning and choose what fits your goals.`
- **Tests / commands / results:** `npm test` -> P09 ranking and path selection tests passed.

---

### P10 — Learn: Roadmap
- **Page ID / name:** P10 — Learn: roadmap
- **Status:** verified
- **Reference screenshots / templates:** `docs/android-mockups/learn.png`, `docs/android-mockups/offline.png`, `approved-preview.html#learn`, `approved-preview.html#offline`
- **Prerequisites completed:** P09 + `GET /api/roadmap`, `PUT /api/roadmap/progress`, `POST /api/roadmap`
- **Routes / contracts used:** `GET /api/roadmap`, `PUT /api/roadmap/progress`, `POST /api/roadmap`, `/(tabs)/learn`, `/matches`, `/courses`, `/interests`
- **Files changed:** `mobile/app/(tabs)/learn.tsx`, `mobile/app/offline.tsx`, `mobile/src/api/roadmap.ts`
- **States and actions checked:**
  - Header: Root tab header with hamburger menu leading button, title "Learning roadmap", avatar button.
  - Eyebrow: `YOUR LEARNING ROADMAP`; "Change path" text button routing to `/matches`.
  - Career title: Dynamic from roadmap (e.g. `Software\nEngineer`).
  - Subtitle: `One milestone at a time.`
  - Milestone progress row: `{completed} of {total} complete` and percentage `{percent}%`.
  - Rectangular `ProgressTrack` reflecting real completion percentage.
  - Stages (Beginner, Intermediate, Advanced):
    - Stage number badge (`01`, `02`, `03`) or `CircleCheck` when all stage milestones are completed.
    - Stage title and completion summary (e.g. `4 of 4 milestones complete`).
    - Active stage highlighted with `CURRENT` tag and auto-expanded by default.
    - All stages inspectable and toggleable via tap.
    - Milestone checkboxes: Tap triggers `PUT /api/roadmap/progress` with `{ milestoneId, completed }`.
    - Optimistic update with safe rollback on error.
    - Inside current stage: "Explore recommended courses" button routing to `/courses`.
  - No-path state: "No career path selected yet" card with "Find my path" button routing to `/interests`.
  - Path change detection: When `roadmap.pathChanged === true`, shows prompt allowing user to generate updated roadmap via `POST /api/roadmap`.
  - Offline resilience:
    - Caches roadmap snapshot in `@careerpilot_roadmap_cache_${userId}`.
    - Renders `OfflineBanner` when network is offline.
    - Disables milestone writes in offline mode with explanatory alert.
    - Dedicated `OfflineScreen` (`mobile/app/offline.tsx`) dynamically reflects cached progress and links to `/learn` and `/home`.
  - Pull-to-refresh: Refetches authoritative roadmap without generating duplicates.
- **Tests / commands / results:** `npm test` -> P10 roadmap stats and stage progression tests passed.

---

### P11 — Courses and Filter Sheet
- **Page ID / name:** P11 — Courses and filter sheet
- **Status:** verified
- **Reference screenshot / template:** `docs/android-mockups/courses.png`, `approved-preview.html#courses`
- **Prerequisites completed:** P10 + `GET /api/courses`, `GET /api/courses/completion`, `POST /api/courses/completion`, `DELETE /api/courses/completion`
- **Routes / contracts used:** `GET /api/courses?level=&budget=`, `GET & POST & DELETE /api/courses/completion`, `/courses`
- **Files changed:** `mobile/app/courses.tsx`, `mobile/src/api/courses.ts`, `app/api/courses/completion/route.ts`
- **States and actions checked:**
  - Header: Back arrow leading button, title "Courses".
  - Eyebrow: `LEARN WITH PURPOSE`.
  - Heading row: `Recommended\ncourses.` with filter button (`SlidersHorizontal`, 48x48dp touch target).
  - Subtitle: `Courses to support your roadmap.`
  - Filter chips row: Shows active filters (e.g. `All levels`, `All budgets`, or specific level/budget). Includes quick "Reset" chip when active filters are applied.
  - Course cards:
    - Provider label in uppercase JetBrains Mono (e.g. `FREECODECAMP`, `COURSERA`).
    - Price tag: `FREE` or `PAID`.
    - Course title in bold Hanken Grotesk.
    - Metadata: Level · Category / Platform · Rating.
    - Primary button: `Open course` with `ExternalLink` icon, launches verified URL via `Linking.openURL`.
    - Secondary button: `Mark complete` / `✓ Completed · undo`.
    - Completion sync: Calls `POST /api/courses/completion` with `{ courseId, completed }`; updates authoritative count in `UserProgress.coursesCompleted`.
    - Optimistic toggle with safe rollback on error.
  - Filter Sheet (`Sheet` primitive):
    - Level selection: All, Beginner, Intermediate, Advanced.
    - Budget selection: All, Free, Paid.
    - "Apply filters" and "Reset filters" actions.
  - Empty filter state: Renders `EmptyStateView` with "Reset filters" CTA when active filter combination yields 0 matches.
  - Offline caching: Caches courses and completions in `@careerpilot_courses_cache_${userId}` and `@careerpilot_completions_cache_${userId}`.
- **Tests / commands / results:** `npm test` -> P11 course filtering and completion idempotence tests passed.

---

## Phase 6 — Focus and Study Tasks

### P19 — Focus Session
- **Page ID / name:** P19 — Focus session
- **Status:** verified
- **Reference screenshots / templates:** `docs/android-mockups/focus.png`, `approved-preview.html#focus`
- **Prerequisites completed:** Phase 5 + local storage/task contracts (`GET/POST/PUT /api/todo`, `DELETE /api/todo?id=`)
- **Routes / contracts used:** `/focus`, `GET /api/todo`, `POST /api/todo`, `PUT /api/todo`, `DELETE /api/todo?id=`
- **Files created/changed:** `mobile/app/focus.tsx`, `mobile/src/context/FocusContext.tsx`, `mobile/app/_layout.tsx`, `mobile/src/api/todo.ts`, `mobile/src/services/audioService.ts`, `mobile/src/services/notificationService.ts`, `mobile/tests/phase6-focus.test.mjs`
- **States and actions checked:**
  - Header: Back arrow leading button, title "Focus session".
  - Eyebrow: `MAKE SPACE TO LEARN`.
  - Heading: `Focus session.`
  - Mode segments: Focus (25m), Short break (5m), Long break (15m) with touch targets >= 48dp; tapping switches mode, resets timer, and updates duration.
  - Timer card:
    - Status eyebrow: `SESSION ACTIVE` (running), `SESSION PAUSED` (paused), `SESSION COMPLETE` (finished), `READY WHEN YOU ARE` (idle).
    - Large tabular digits display (`52px`, `fontMono`, `tabular-nums`) with zero jitter or drift.
    - Start / Pause / Resume / Reset controls with clear icons and distinct variant hierarchy.
    - Deadline timestamp persistence: calculated from `targetDeadline - now`, not decrementing counter. Survives app backgrounding, screen lock, and process recreation without resetting during navigation.
    - Idempotent session completion: each 25-minute focus session ID is recorded at most once in history.
  - Background music card:
    - Music icon, "Background music" title, honest status line showing track name and state (Playing, Buffering, Paused, Interrupted, Unavailable).
    - Explicit user playback intent: starts only on explicit tap, never autoplays on timer start.
    - Real approved tracks: SoundHelix Song 1, 2, and 3 under CC-BY 3.0 license.
    - Skip track button and Play/Pause control with >=48dp touch targets.
  - Local study alerts:
    - Scoped strictly to local timer completion alerts.
    - Permission-aware with graceful denial handling (status badge showing active vs muted).
    - Explicitly does NOT claim remote push notifications are implemented.
  - Daily tasks section:
    - "Daily tasks" heading with accessible `+` add task button.
    - Inline task creation form with validation, character requirement, and server sync.
    - Connects to `/api/todo` with optimistic UI updates:
      - Creating: optimistically inserts pending item; reconciles on server response; rolls back on failure.
      - Toggling: optimistically flips checkbox; rolls back on server PUT failure.
      - Deleting: optimistically removes row; restores on server DELETE failure.
      - Offline resilience: caches tasks in `@cache_todo_${userId}`.
  - Focus history:
    - Section header: `Focus history` with `On this device` label.
    - Two metric cards: `Focused today` (e.g. `25m`, `50m`, `1h 15m`) and `Session complete` / `Sessions complete` filtered for current calendar day.
    - Local persistence per user account: User A's history cannot leak to User B; purged on logout.
- **Tests / commands / results:** `npm test` -> 61 tests passed across all phases (including 11 new tests for P19: calculations, state transitions, background restoration, completion idempotency, daily history metrics, task CRUD with rollback).
- **Phase Gate Status:** Phase 6 Passed.

---

## Phase 7 — Career Opportunities and Applications

### P20 — Career: Jobs and Internships
- **Page ID / name:** P20 — Jobs & internships
- **Status:** verified
- **Reference screenshots / templates:** `docs/android-mockups/career.png`, `approved-preview.html#career`
- **Prerequisites completed:** Phase 6 + real `/api/jobs` contract
- **Routes / contracts used:** `/(tabs)/career`, `GET /api/jobs?type=&search=`
- **Files created/changed:** `mobile/app/(tabs)/career.tsx`, `mobile/src/api/jobs.ts`, `app/api/jobs/route.ts`
- **States and actions checked:**
  - Header: Hamburger drawer trigger (`isRoot={true}`), title "Jobs & internships".
  - Eyebrow: `YOUR NEXT OPPORTUNITY`.
  - Heading: `Build toward\nwhat comes next.`.
  - 3 Career Tool Shortcuts: Resume (`/resumes`), ATS check (`/ats`), and Projects (`/projects`) with >=48dp touch targets.
  - Segment switch: Jobs (active) vs Applications (`/tracker`).
  - Search bar: Magnifying glass icon, debounced text query input (300ms), and SlidersHorizontal filter button.
  - Request cancellation: `AbortController` aborts in-flight queries when search terms change rapidly, preventing stale response overrides.
  - Job Filters Sheet: Modal sheet for job types (`All`, `Internship`, `Full-time`, `Part-time`, `Contract`), with pill selectors and active filter indicator with dismiss button.
  - Vertical Job Cards:
    - Type tag: `INTERNSHIP`, `FULL-TIME`, `PART-TIME`, `CONTRACT` in high-contrast badge.
    - Idempotent Bookmark Save: syncs with application tracker; clicking saves opportunity once and updates icon to filled with accessibility label `Opportunity saved`.
    - Title & Metadata: Pressable title linking to `/job?id=${job._id}`, company name, location/remote badge, and up to 4 skill tags.
    - Match Hint & View Job: Dynamically evaluates matched profile skills, career path match, or match percentage; "View job" with ArrowRight opens `/job`.
  - Honest Error & Offline states:
    - Never substitutes fabricated vacancies for a failed feed.
    - Offline fallback: caches genuine listings in `@cache_jobs_${userId}` and displays honest offline banner.
    - Empty state: contextual guidance when search or filters return no results.

### P21 — Job Detail
- **Page ID / name:** P21 — Job detail
- **Status:** verified
- **Reference screenshots / templates:** `docs/android-mockups/job.png`, `approved-preview.html#job`
- **Prerequisites completed:** P20
- **Routes / contracts used:** `/job`, `getJobById` (safe list lookup contract without inventing `/api/jobs/:id`)
- **Files created/changed:** `mobile/app/job.tsx`, `mobile/src/api/jobs.ts`
- **States and actions checked:**
  - Header: Back navigation, title "Job detail".
  - Metadata eyebrow tag: `${type} · ${location/remote}`.
  - Role Title & Subtitle: Large 32px heading, company, location, and salary when supplied.
  - About the role card: full genuine description and bulleted key requirements when available.
  - Skills to bring: skill chip cloud matching employer requirements.
  - Your profile match: dynamic client-side comparison between job skills and user's profile/assessment skills:
    - Matched skills list (e.g. `React, TypeScript`).
    - Build next list (skills sought not yet in profile).
  - Before you apply advice: clear pre-application guidance.
  - Apply externally: Primary button with `ExternalLink` icon; validates `http://` / `https://` URLs and opens default browser. Opening the external apply page does NOT auto-mark Applied.
  - Save opportunity: Secondary button with `Bookmark` icon; saves to applications tracker and syncs across views.
  - Source citation: Honest employer source and posting date metadata.
  - Graceful unavailable state: Displays "Opportunity unavailable" card if listing is missing or expired, with safe back navigation.

### P22 — Application Tracker and Status Sheet
- **Page ID / name:** P22 — Application tracker & status sheet
- **Status:** verified
- **Reference screenshots / templates:** `docs/android-mockups/tracker.png`, `approved-preview.html#tracker`, `change-status` sheet
- **Prerequisites completed:** P21
- **Routes / contracts used:** `/tracker`, `GET/POST/PUT /api/jobs/applications`
- **Files created/changed:** `mobile/app/tracker.tsx`, `mobile/src/api/jobs.ts`, `app/api/jobs/applications/route.ts`
- **States and actions checked:**
  - Header: Back button, title "Applications".
  - Eyebrow: `APPLICATION TRACKER`.
  - Heading: `Keep your next\nsteps in view.`.
  - Primary action: "Add an opportunity" with Plus icon -> routes to `/custom-job`.
  - Status Filter Bar: Horizontal scrollable pills for all 7 supported statuses (`Saved`, `Applied`, `Screening`, `Interview`, `Offer`, `Rejected`, `Withdrawn`) plus `All`.
  - Normalized Records: `normalizeApplication` safely resolves both populated MongoDB `jobId` references and custom job records (`customJob: { title, company, url }`) without crashing on deleted/unpopulated references.
  - Application cards:
    - Status badge with distinct theme styling.
    - Title, company, location, and optional "Next step: {notes}".
    - Direct actions: "Review opportunity" routes to `/job?id=` for linked listings; "View listing" opens external URL for custom jobs.
  - Status & Notes Sheet:
    - Triggered via MoreHorizontal button or "Update status" link.
    - Pill selector for all 7 editable statuses.
    - Multiline Notes textarea prefilled with current next step.
    - Optimistic UI updates with rollback on network/server mutation failure.
    - Offline cache: stores application tracker state in `@cache_applications_${userId}`.

### P23 — Add Custom Opportunity
- **Page ID / name:** P23 — Add custom opportunity
- **Status:** verified
- **Reference screenshots / templates:** `docs/android-mockups/custom-job.png`, `approved-preview.html#custom-job`
- **Prerequisites completed:** P22
- **Routes / contracts used:** `/custom-job`, `POST /api/jobs/applications`
- **Files created/changed:** `mobile/app/custom-job.tsx`, `mobile/src/api/jobs.ts`, `app/api/jobs/applications/route.ts`
- **States and actions checked:**
  - Eyebrow & Heading: `APPLICATION TRACKER` / `An opportunity\nworth keeping.` / `Add a job you found elsewhere.`.
  - Form Fields:
    - Job title (required, whitespace trimmed, inline error validation).
    - Company (required, whitespace trimmed, inline error validation).
    - Job URL (optional, validated for valid URL syntax and scheme normalization).
    - Initial status selector (`Saved`, `Applied`, `Interview`, `Screening`).
    - Notes / Next step (optional).
  - Single Submit Guard: Disables button and displays activity spinner while pending; prevents duplicate submissions.
  - Draft Retention & Dirty Guard:
    - Auto-saves draft to `@custom_job_draft_${userId}`.
    - Hardware and header back button guards alert user before discarding unsaved edits.
    - On submission failure (e.g. offline/timeout), draft is retained and clear error message is shown.
    - On confirmed save, draft is cleared and user is returned to `/tracker` with the new opportunity immediately visible.
- **Tests / commands / results:**
  - `mobile`: `npm test` -> 76 tests passed across Phases 1–7 (including 15 new tests for P20–P23: query building, request cancellation, offline fallback, skill matching, lookup contract, skill comparison, apply URL validation, record normalization, status filtering, optimistic rollback, input validation, URL normalization, draft retention).
  - `mobile`: `npm run typecheck` (`tsc --noEmit`) -> 0 errors.
  - `mobile`: `npx expo lint --quiet` -> 0 errors.
  - Root Next.js: `npx tsc --noEmit` -> 0 errors.
- **Phase Gate Status:** Phase 7 Passed.

---

## Phase 9 — Projects, Events, Teams and News

### P29 — Project Ideas
- **Page ID / name:** P29 — Project ideas
- **Status:** verified
- **Reference screenshots:** `docs/android-mockups/projects.png`
- **Prerequisites completed:** Phase 8
- **Routes / contracts used:** `/projects`, `GET /api/projects`, `POST /api/projects`
- **Files created/changed:** `mobile/app/projects.tsx`, `mobile/src/api/projects.ts`, `app/api/projects/route.ts`
- **States and actions checked:**
  - Segmented Navigation: Ideas (active) | Hackathons | Teams.
  - Heading: "Skills become\nstronger in practice." with "BUILD SOMETHING REAL" eyebrow.
  - Generate Project Ideas: AI button with loading state, prevents duplicate submissions, handles timeouts, and preserves existing ideas on failure.
  - Project Cards: Difficulty badge, title, description, technology pills, and estimated duration rendered only when supplied.
  - Project Detail Sheet: Complete disclosure modal with overview, recommended technologies, key features to build, and direct action to find teammates.
  - Offline cache fallback (`@careerpilot_project_ideas_cache_${userId}`).

### P30 — Hackathons
- **Page ID / name:** P30 — Hackathons
- **Status:** verified
- **Reference screenshots:** `docs/android-mockups/hackathons.png`
- **Prerequisites completed:** P29
- **Routes / contracts used:** `/hackathons`, `GET /api/projects?mode=hackathons`
- **Files created/changed:** `mobile/app/hackathons.tsx`, `mobile/src/api/projects.ts`
- **States and actions checked:**
  - Segmented Navigation: Ideas | Hackathons (active) | Teams.
  - Event Cards: Mode badge (`ONLINE`/`HYBRID`), source platform (`DEVFOLIO`/`HACKEREARTH`/organizer), title, description.
  - Real Dates: Consistent timezone date range rendering and honest expiration labels (ongoing vs concluded).
  - External Visit Action: Safe URL opening with `Linking.openURL`, graceful error handling.
  - Teammates Navigation: "Find teammates" button routes to `/teams` with event context preserved (`eventId`, `eventTitle`).
  - Offline cache fallback (`@careerpilot_hackathons_cache_${userId}`).

### P31 — Team Finder
- **Page ID / name:** P31 — Team finder
- **Status:** verified
- **Reference screenshots:** `docs/android-mockups/teams.png`
- **Prerequisites completed:** P30
- **Routes / contracts used:** `/teams`, `GET /api/projects/teams`
- **Files created/changed:** `mobile/app/teams.tsx`, `mobile/src/api/projects.ts`
- **States and actions checked:**
  - Segmented Navigation: Ideas | Hackathons | Teams (active).
  - Event filter banner: Displays when navigated from Hackathons with clearable filter.
  - Post Cards: Member count badge (`currentMembers OF teamSize MEMBERS`), event tag, title, description, skills needed.
  - Contact Sheet: Real contact action (direct `mailto:`, external profile link, or copy to clipboard with feedback). No fake join/chat platform.
  - Offline cache fallback (`@careerpilot_teams_cache_${userId}`).

### P32 — Create Team Post
- **Page ID / name:** P32 — Create team post
- **Status:** verified
- **Reference screenshots:** `docs/android-mockups/team-post.png`
- **Prerequisites completed:** P31 + normalized event-link contract
- **Routes / contracts used:** `/team-post`, `POST /api/projects/teams`
- **Files created/changed:** `mobile/app/team-post.tsx`, `mobile/src/api/projects.ts`
- **States and actions checked:**
  - Form Fields: Post title, description, skills needed, team size (2..12), contact method.
  - Event Association: Normalizes external vs MongoDB event IDs, avoids fabricated fake IDs.
  - Validation: Inline field errors for missing/invalid lengths.
  - Draft Persistence: Auto-saves draft to `@careerpilot_team_post_draft_${userId}` and retains on failure.
  - Dirty Navigation Guard: Alerts before discarding unsaved edits.
  - Confirmed Publish: Clears draft and redirects back to `/teams` with the new post immediately rendered.

### P33 — Tech News
- **Page ID / name:** P33 — Tech news
- **Status:** verified
- **Reference screenshots:** `docs/android-mockups/news.png`
- **Prerequisites completed:** P32
- **Routes / contracts used:** `/news`, `GET /api/news`
- **Files created/changed:** `mobile/app/news.tsx`, `mobile/src/api/news.ts`
- **States and actions checked:**
  - Category Controls: Filter chips for "All", "AI/ML", "Startups", "Hiring".
  - Honest Freshness: Live feed label only when fresh (<2m); honest timestamp when cached ("Saved · Updated Xm/h ago").
  - Featured Story Card: Category tag, valid image only when supplied, title, summary, relative time, and external read link.
  - Compact Cards: Headline, source, tags, read time, and direct article opening.
  - Refresh Rate Limiting: Bounded refresh interval (10s throttle) to prevent hammering scrapers.
  - Offline cache fallback (`@careerpilot_news_cache_${userId}`).

- **Phase Gate Status:** Phase 9 Passed.

---

## Phase 10 — Profile and Settings

### P34 — Profile, Curriculum and Goals
- **Page ID / name:** P34 — Profile, curriculum and goals
- **Status:** verified
- **Reference screenshots:** `docs/android-mockups/profile.png`
- **Prerequisites completed:** Phase 9
- **Routes / contracts used:** `/profile`, `GET /api/profile`, `PUT /api/profile`
- **Files created/changed:** `mobile/app/profile.tsx`, `mobile/src/api/profile.ts`, `app/api/profile/route.ts`
- **States and actions checked:**
  - Avatar, full name, and read-only email display.
  - Active curriculum progress, course additions/removals with dedicated bottom sheet.
  - Short-term and long-term goal management with persistence to MongoDB.
  - Explicit Save hierarchy with draft preservation on network failure.
  - Dirty navigation guard prompting user before discarding unsaved edits.
  - Drawer menu updates upon confirmed profile edits.

### P35 — Settings and Account Lifecycle
- **Page ID / name:** P35 — Settings and account lifecycle
- **Status:** verified
- **Reference screenshots:** `docs/android-mockups/settings.png`
- **Prerequisites completed:** P34
- **Routes / contracts used:** `/settings`, `DELETE /api/profile`
- **Files created/changed:** `mobile/app/settings.tsx`, `mobile/src/services/notificationService.ts`
- **States and actions checked:**
  - Appearance selection: Light, Dark, System modes with instant dynamic theme switching.
  - Study notification reminders with true OS permission detection.
  - Local device cache clearance purging offline records while safeguarding cloud data.
  - Terms of Service & Privacy Statement in-app modal and web links.
  - Permanent account deletion executing cascading deletion across 12 database collections.
  - Logout clearing SecureStore token and all user-isolated caches, drafts, and focus history.

- **Phase Gate Status:** Phase 10 Passed.

---

## Phase 11 — Full-Inventory State, Fidelity and Integration Audit

- **Scope:** Complete audit across all 35 screens (P01–P35) against approved design captures and mobile design specifications.
- **States and actions checked:**
  - Loading, error, and offline states unified across all data screens using approved primitives (`StateView.tsx`).
  - Canonical 4 bottom navigation tabs (`Home`, `Learn`, `Study`, `Career`) with correct route branching and keyboard hiding.
  - Complete 6 end-to-end user journeys automated and verified.
  - Minimum 48 dp touch target adherence across all interactive components.
  - Edge-to-edge system insets and safe area handling with predictive back gesture compatibility.
  - Cross-account data isolation verified across resumes, documents, threads, applications, and focus minutes.
- **Tests / verification:**
  - 119 automated tests passing in `mobile/tests/`.
  - Zero TypeScript compiler errors across mobile and web workspaces.
- **Phase Gate Status:** Phase 11 Passed.

---

## Phase 12 — Release Preparation and Authorized Rollout

- **Scope:** Release configuration hardening, store listing preparation, regulatory compliance, bundler export verification, and gated publishing checklist.
- **Artifacts created / updated:**
  - `mobile/app.json`: Configured `versionCode: 1`, explicit minimal permissions (`permissions: []`), adaptive icon layers, and launch splash screen.
  - `mobile/eas.json`: Defined build profiles for preview APK (internal testing) and production Android App Bundle (Google Play).
  - `app/privacy/page.tsx`: Public web Privacy Policy and Data Safety statement.
  - `app/terms/page.tsx`: Public web Terms of Service.
  - `app/account-deletion/page.tsx`: Dedicated public web portal for external account and data deletion requests per Google Play policy.
  - `components/layout/Footer.tsx`: Connected legal and account deletion links to global web footer.
  - `mobile/app/settings.tsx`: Connected web privacy and deletion portal links to in-app settings.
  - `mobile/store-assets/play-store-metadata.json`: Complete Google Play Store listing copy, character counts, and Data Safety mapping.
  - `mobile/docs/release-preparation-and-rollout.md`: Full operating checklist, build instructions, rollback plan, and incident response guidelines.
  - `mobile/tests/phase12-release.test.mjs`: Automated release compliance test suite (6 new tests).
- **Verification results:**
  - Bundler export: `npx expo export --platform android` successfully bundled 3,384 modules into Hermes bytecode (`.hbc`, 5.7 MB) with 0 errors.
  - Mobile test suite: 125/125 passing tests (`npm test`).
  - Mobile TypeScript: 0 errors (`npm run typecheck`).
  - Root Next.js TypeScript: 0 errors (`npx tsc --noEmit`).
- **Phase Gate Status:** Phase 12 Passed. Ready for user publishing authorization.
