# CareerPilot — Android

Android client for [CareerPilot](https://careerpilot.cc) — the AI study hub,
career roadmap and resume tool for students working toward a specific career goal.

This is the **mobile client only**. The Next.js web app, API and MongoDB live in
the [`CareerPliot`](https://github.com/Ishantagarwala/CareerPliot) repository and
are consumed over HTTPS at `https://careerpilot.cc/api/*`.

> **Status: design & planning.** No application code yet. The repository
> currently holds the architecture plan, the design contract, and ten rendered
> screen mockups. Application scaffolding begins after the open decisions in
> `design/README.md` are settled.

---

## Contents

| Path | What it is |
| --- | --- |
| `design/ANDROID_APP_PLAN.md` | Architecture, endpoint compatibility matrix, server-side blockers, phased roadmap, release checklist |
| `design/DESIGN_SPEC.md` | The visual contract — both brand languages, lime rules, type scale, components, motion, accessibility |
| `design/API_CONTRACT.md` | **What the Android app needs from the web repo.** Read before changing anything on the server. |
| `design/screens.py` | The ten screens, authored as HTML against the real design tokens |
| `design/png/` | Rendered screens — the design deliverables |

## Start here

1. `design/ANDROID_APP_PLAN.md` §2 — two verified blockers in the web repo that
   prevent *any* Android client from authenticating. These are Phase 0.
2. `design/DESIGN_SPEC.md` §1 — the two design languages the product already
   runs, and the tokens for each.
3. `design/png/00-contact-sheet.png` — all ten screens at a glance.

## Regenerating the mockups

Requires Python 3, Node and ImageMagick.

```bash
cd design
npm install          # Playwright + its Firefox build
npm run render       # -> png/*.png
npm run contact-sheet
```

The mockups are real HTML/CSS rendered through headless Firefox at true Android
density (412×915 @2x) — not image-model output — so text is genuinely readable
and the set is reproducible. `design/README.md` has the details.

## The app

- **Stack:** Expo + React Native, TypeScript
- **Backend:** the existing production API, no second server
- **Builds:** EAS cloud build (no local Android SDK required)
- **Distribution:** Play Store internal testing
- **Tabs:** Hub · Career · Build · Me

## Building the APK

Cloud build via EAS — no local Android SDK required.

```bash
npx eas-cli@latest login                   # one-time, interactive
npx eas-cli@latest build --platform android --profile preview
```

> The global `eas` command is not `npx eas` — that package name resolves to
> nothing. Use `npx eas-cli@latest`, or install `eas-cli` globally.
>
> A cloud build requires an Expo account; `eas whoami` reports `Not logged in`
> until you authenticate. That login is interactive, so it has to be you.

| Profile | Output | Use |
| --- | --- | --- |
| `development` | APK + dev client | local debugging against Metro |
| `preview` | APK | sideload to a phone — **start here** |
| `production` | AAB | Play Console upload |

**Two things must be set before a build will sign in successfully:**

1. `EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER` — the Google Cloud project
   number. Without it the app reports that it cannot verify itself, which is
   accurate. Set it in `eas.json` under the profile's `env`, or as an EAS
   environment variable.
2. The matching `PLAY_INTEGRITY_*` values on the **server**
   (see the web repo's `.env.example`). Configuring only one side does not work,
   and the error message says so.

`eas submit` expects the Play service-account key at
`./play-service-account.json`. It is gitignored — never commit it.

## Permissions

Only two are declared, and both are requested at the point of use rather than on
launch:

| Permission | Requested when | State |
| --- | --- | --- |
| `USE_BIOMETRIC` | the user chooses "Remember with fingerprint/face" on sign-in | wired |
| `RECORD_AUDIO` | the voice feature is first used | **not yet** — voice is not built |

`RECORD_AUDIO` is declared but never requested, because there is no microphone
feature to attach it to yet. Declaring it early is harmless; requesting it on
launch would not be, and asking before the user has seen the feature is how you
earn a permanent denial.

## Open decisions

Blocking the design from being final:

1. **Career/Roadmap visual language** — screens 04 and 05 currently use the brand
   cream/lime language. `PRODUCT.md` says lime is an action, not a coat of paint,
   and two consecutive lime-heavy tabs bends that rule. Either keep it, or move
   both to the neutral hub language and reserve lime for the pinned-direction
   card and progress bars.
2. **Bot verification** — Play Integrity attestation (recommended, strictly
   stronger) vs the hCaptcha Android SDK. hCaptcha does not run in React Native,
   and the web login chain hard-fails without a valid token.
3. **Auth mechanism** — device token exchange (recommended) vs `SameSite=None`
   cookies. Auth.js defaults to `SameSite=Lax`, which a native client cannot use.

## Provenance

The web app lives at `Ishantagarwala/CareerPliot`. Design tokens in
`design/android-shared.css` are copied from that repo's `app/globals.css` and
must be kept in sync — see `design/DESIGN_SPEC.md` §1 for the canonical values.
