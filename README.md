# 📱 Career Pilot — Android Client

[![Brainware AI Hackathon 2026](https://img.shields.io/badge/Brainware%20AI%20Hackathon-2026-blueviolet?style=for-the-badge)](https://github.com/aritraio/bwu-ai-hackathon-2026)
[![Made By](https://img.shields.io/badge/Made%20By-Career%20Wallah-orange?style=for-the-badge)](#-team)
[![Tech Stack](https://img.shields.io/badge/Stack-Expo%2057%20%7C%20React%20Native%200.86%20%7C%20TypeScript-blue?style=for-the-badge)](#-tech-stack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

The Android client for **[Career Pilot](https://careerpilot.cc)**, and the design
contract it is built against, developed by **Career Wallah** for the **Brainware
AI Hackathon 2026**.

Career Pilot reduces uncertainty in career planning for students. The Android app
carries the same product as the web platform — career assessment, generated
roadmaps, course and job discovery, document-aware AI tutoring, resume tools and
progress tracking — rebuilt as a native client against the same API.

**Production API:** [careerpilot.cc](https://careerpilot.cc)

The shared demo account is opt-in through **Demo Login**. Do not enter private
information into it.

---

## 📌 Table of Contents
1. [Why the design lives in this repository](#-why-the-design-lives-in-this-repository)
2. [Core Features](#-core-features)
3. [Voice](#-voice)
4. [Design System](#-design-system)
5. [System Architecture](#-system-architecture)
6. [Tech Stack](#-tech-stack)
7. [Project Structure](#-project-structure)
8. [Getting Started & Setup](#-getting-started--setup)
9. [Building the APK](#-building-the-apk)
10. [Regenerating the Mockups](#-regenerating-the-mockups)
11. [Available Scripts](#-available-scripts)
12. [Open Decisions](#-open-decisions)
13. [Team](#-team)

---

## 🧭 Why the design lives in this repository

```
design/   the contract — specs, stylesheet, fonts, rendered screens
mobile/   the Expo / React Native client that implements it
```

Both live here on purpose. While the app was developed in a separate repository
from the specs governing it, the two could drift apart without anyone noticing —
and they did: the client shipped with **no handling for three of the block types
its own system prompt asks the model to emit**.

Keeping them together means a change to the contract and a change to the client
arrive in the same commit, and the screenshots next to them can be regenerated
rather than remembered.

---

## 🌟 Core Features

* **📄 AI Study Hub:** Streams replies token-by-token over SSE. Threads persist, are searchable, and can be renamed or deleted. Uploaded documents can be attached to a turn so answers are grounded in their contents.
* **🧠 Reasoning Disclosure:** Reasoning models stream their chain of thought on a separate event, shown in a collapsed "thought for a moment" disclosure rather than mixed into the answer.
* **📊 Rich Block Rendering:** The assistant emits Mermaid diagrams, chart specs and whole documents as fenced blocks. Charts render natively with `react-native-svg`; generated documents become a real **PDF** through `expo-print`; diagrams fall back to their source rather than pretending to draw.
* **🎨 Two Design Languages:** Brand cream-and-lime for sign-in, career, and first-run; a neutral hub language for chat surfaces. Assigned **per screen**, not per theme — see [Design System](#-design-system).
* **🌗 Light and Dark:** Both languages define a full dark palette. The dark brand palette is a first-class token set, not an inversion of the light one.
* **🗣️ Voice:** Speak a question and hear the answer, across 11 Indian languages. [See below](#-voice).
* **🗺️ Personalized Roadmaps:** Beginner → Intermediate → Advanced milestones with completion tracking.
* **💼 Live Jobs & Courses:** Roadmap-driven course recommendations and aggregated live job listings, with an application tracker.
* **📝 Resume Tools:** Resume builder, preview, ATS scoring and job-description matching against the same endpoints the web app uses.
* **📶 Offline-Aware:** Cached threads and roadmaps are readable without a connection, with an explicit offline state rather than an error.
* **🔐 Token Auth with Transparent Refresh:** A 15-minute access token and a 60-day refresh token, held in `expo-secure-store`. Refresh is single-flight: a rotated refresh token replayed would be treated as theft and revoke the entire family, so concurrent 401s share one refresh.

---

## 🗣️ Voice

Speak to the assistant and hear it answer, in **11 languages** — the same set the
server's transcription route accepts.

| | |
| :--- | :--- |
| **Input** | `expo-audio` records a clip and uploads it for transcription |
| **Output** | Server speech first, automatic fallback to the device voice |
| **Languages** | English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia |
| **Permission** | `RECORD_AUDIO`, declared in `app.json` and verified present in the built APK |

**Guard state is a pure reducer**, not a set of refs. The web implementation of
this feature keeps its guards in refs across a large hook, and three regressions
shipped from it in a single session — a flag set on unmount and never reset, a
capture guard cleared before an async `getUserMedia`, and a MIME type carrying a
codec parameter the server rejects. None were hard to fix; all were hard to see.

Here the same transitions are enumerable and asserted, including the exact
malformed sequences above:

```
npm test
  tests/voiceMachine.test.mjs   a custom runner asserting 17 transitions
  tests/voiceApi.test.mjs       11 node:test cases
```

The invariant that matters most is explicit: **the microphone is only open in the
`recording` phase**, so a stuck state is one value rather than four booleans.

Recording is capped by the recorder itself (`recordForDuration(30)`), so a user
who never speaks cannot hold the microphone open.

---

## 🎨 Design System

The product runs **two design languages**, and which one a screen uses is a
deliberate choice recorded in `design/screens.py` — only screens 01, 04 and 09
are brand.

| | Brand | Hub |
| :--- | :--- | :--- |
| **Surfaces** | Cream `#f4f6e8` | Near-white `#f7f8fa` |
| **Accent** | Lime `#baf600` — an *action*, not a coat of paint | Near-black actions |
| **Edges** | 2px black keylines, hard offset shadows | Hairline `#e6e8ee` |
| **Screens** | Sign in, career, first run | Chat, roadmap, me, and the rest |

The canonical token values live in `design/DESIGN_SPEC.md` §1 and are lifted from
the web app's `app/globals.css`. **Where the two disagree, `globals.css` wins.**

---

## 🏗️ System Architecture

```text
Android device
  └─ Expo / React Native client (expo-router)
       ├─ (auth)  sign in, register, first run
       ├─ (tabs)  hub · career · roadmap · me
       └─ drill-down screens (resume, ATS, jobs, courses, tracker…)
            │
            ├─ src/api/client.ts
            │    Bearer token · single-flight refresh on 401 · timeout
            │
            ├─ SSE chat stream (expo/fetch — RN's global fetch cannot stream a body)
            │    meta → reasoning* → token* → title → done | error
            │
            ├─ src/voice/
            │    voiceMachine.ts   pure reducer, unit-tested
            │    useVoice.ts       expo-audio capture · expo-speech fallback
            │
            └─ expo-secure-store   access + refresh tokens

Career Pilot server (careerpilot.cc)
  └─ Next.js route handlers
       ├─ MongoDB (users, threads, documents, roadmaps, progress)
       ├─ OpenAI-compatible LLM router (streaming)
       └─ Speech: transcription and synthesis
```

---

## 🛠️ Tech Stack

| Layer | Technology | Description / Use Case |
| :--- | :--- | :--- |
| **Runtime** | **Expo SDK 57** | Managed workflow with continuous native generation — `android/` is generated, never hand-edited |
| **Framework** | **React Native 0.86 + React 19.2** | Native rendering of the shared product surface |
| **Navigation** | **expo-router 57** | File-based routing; `app/` is the route tree, `src/` holds everything else |
| **Language** | **TypeScript** | Checked with `tsc --noEmit` in CI and before every build |
| **Audio** | **expo-audio + expo-speech** | Recording and playback, with the device voice as a fallback |
| **Secure storage** | **expo-secure-store** | Access and refresh tokens, never in plain storage |
| **Charts** | **react-native-svg** | Bar, line, area and pie charts drawn from the assistant's chart blocks |
| **Documents** | **expo-print + expo-clipboard** | Generated replies become real, shareable PDFs |
| **Styling** | **Design tokens + StyleSheet** | Two palettes from `src/theme/tokens.ts`; no utility framework |
| **Builds** | **EAS Build** | Cloud APK/AAB builds — no local Android SDK required |
| **Tests** | **Node's built-in test runner** | 180 tests; pure logic is dependency-free so it runs without a native runtime |

---

## 📂 Project Structure

```
careerpilot-android/
├── design/                      # The visual contract
│   ├── DESIGN_SPEC.md           #   Tokens, type scale, spacing, elevation, motion
│   ├── ANDROID_APP_PLAN.md      #   Architecture and phased roadmap
│   ├── API_CONTRACT.md          #   What the client needs from the server
│   ├── screens.py               #   The ten screens, authored as HTML
│   ├── android-shared.css       #   The stylesheet they are drawn with
│   ├── build.py · shot.mjs      #   Renders screens.py → PNG
│   ├── make-contact-sheet.sh    #   Builds png/00-contact-sheet.png
│   ├── fonts/                   #   Anybody, Hanken Grotesk, Space Grotesk
│   └── png/                     #   The rendered screens
│
└── mobile/                      # The Expo / React Native client
    ├── app/                     # expo-router routes
    │   ├── (auth)/              #   Sign in, register, first run
    │   ├── (tabs)/              #   hub · career · roadmap · me
    │   └── *.tsx                #   Drill-down screens
    ├── src/
    │   ├── api/                 #   Client, SSE stream, reply parsers, voice endpoints
    │   ├── voice/               #   State machine, transcript logic, preferences, hook
    │   ├── components/          #   Primitives, brand controls, navigation, product kit
    │   ├── theme/               #   Both design languages, light and dark
    │   ├── context/             #   Auth and theme providers
    │   └── services/            #   Markdown-to-HTML for document export
    ├── tests/                   #   180 Node tests
    ├── docs/                    #   AI Hub audit and design-fidelity comparisons
    ├── app.config.js            #   Build guard for EXPO_PUBLIC_API_URL
    └── eas.json                 #   development · preview · production profiles
```

---

## ⚡ Getting Started & Setup

### Prerequisites

* [Node.js](https://nodejs.org/) 20 or newer
* A phone with **Expo Go**, or an Android emulator
* No Android SDK required — builds run in the cloud through EAS

### Installation & Run

```bash
git clone https://github.com/Ishantagarwala/careerpilot-android.git
cd careerpilot-android/mobile

npm install
npx tsc --noEmit     # typecheck
npm test             # 179 pass, 1 skipped
npx expo start       # dev server (scan the QR with Expo Go)
```

The one skipped test checks the web app's `/privacy`, `/terms` and
`/account-deletion` pages. Those belong to the web repository, so the test skips
itself when that project is not checked out alongside this one, rather than
failing for a reason that has nothing to do with the client.

---

## 🚢 Building the APK

Builds run in the cloud, so no local Android SDK or Gradle is involved:

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

| Profile | Output | Use |
| :--- | :--- | :--- |
| `development` | APK + dev client | Local debugging against Metro |
| `preview` | APK | Sideload to a phone — **start here** |
| `production` | AAB | Play Console upload |

### The API URL guard

`app.config.js` **fails the build** when `EXPO_PUBLIC_API_URL` is unset or points
at a private address. That guard exists because both release profiles previously
shipped one:

* `preview` pointed at a developer's LAN address, so the APK failed every request
  off that wifi;
* `production` had no value at all and fell back to `10.0.2.2` — the Android
  emulator's alias for the host machine — so a store build could never reach a
  server.

Both now point at `https://careerpilot.cc`, and a built APK can be checked the
same way this repository does: unzip it and confirm the URL is present and the
development hosts are not.

### Native configuration

`expo-audio` is a **native module**, so a new APK is required after adding or
changing it — a JavaScript reload cannot pick it up. Tap-to-record needs
`android.permission.RECORD_AUDIO`, declared in `app.json` and injected by the
`expo-audio` config plugin.

---

## 🖼️ Regenerating the Mockups

The screenshots are **real HTML/CSS rendered through headless Chromium** — not
image-model output — so the text is genuinely readable and the set is
reproducible.

```bash
cd design
npm install playwright    # first time only
python3 build.py          # writes the .html, then the .png
./make-contact-sheet.sh   # -> png/00-contact-sheet.png
```

Requires Python 3, Node, and ImageMagick for the contact sheet.

**Start here:** `design/png/00-contact-sheet.png` shows all ten screens at once.

The ten screens: `01` sign in · `02` AI Hub chat · `03` threads drawer ·
`04` career · `05` roadmap · `06` build · resume · `07` build · jobs · `08` me ·
`09` first run · `10` dark + offline.

---

## 📜 Available Scripts

Run from `mobile/`:

| Command | Purpose |
| :--- | :--- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Launch on a connected Android device or emulator |
| `npm run web` | Run the client in a browser (useful for layout checks only) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run all 180 tests |
| `npm run lint` | ESLint |

### Test suites worth knowing

| File | Covers |
| :--- | :--- |
| `tests/voiceMachine.test.mjs` | Voice guard transitions, including the three regressions that shipped on web |
| `tests/voiceApi.test.mjs` | MIME normalisation, language and voice allowlists — every normalised value must be one the server accepts |
| `tests/replyParsers.test.mjs` | Reply block parsing, including the `mermaid`, `chart` and `file` blocks the system prompt asks for |
| `tests/replyPipeline.test.mjs` | A captured reply through the application's own renderer |
| `tests/markdownToHtml.test.mjs` | Markdown → standalone HTML for PDF export |
| `tests/phase12-release.test.mjs` | Release config, Play compliance, and that every Android permission is deliberately justified |

---

## 🔓 Open Decisions

Still unsettled, and worth a decision rather than a default:

1. **Career / Roadmap visual language** — screens 04 and 05 use the brand
   cream-and-lime language. `PRODUCT.md` says lime is an action, not a coat of
   paint, and two consecutive lime-heavy tabs bends that rule. Either keep it, or
   move both to the neutral hub language and reserve lime for the pinned-direction
   card and progress bars.
2. **Bot verification** — Play Integrity attestation (recommended, strictly
   stronger) versus the hCaptcha Android SDK. hCaptcha does not run in React
   Native, and the web login chain hard-fails without a valid token.
3. **Auth mechanism** — device token exchange (recommended, and what the client
   now uses) versus `SameSite=None` cookies. Auth.js defaults to `SameSite=Lax`,
   which a native client cannot use.
4. **Type floor** — `DESIGN_SPEC.md` §3 forbids type below 11px, but
   `android-shared.css` draws the ring caption, stat-tile captions and tab labels
   at 10–10.5px. The §9 checklist is the stricter of the two; **the client holds
   the 11px floor**, a deliberate deviation from the mockups.
5. **Voice on iOS** — the recorder, permissions and playback are wired for
   Android. Nothing here is Android-only by design, but iOS has not been built or
   tested.

> **Resolved:** the server previously answered a request with no `modelSelection`
> with `500 Model not available.`, because the advertised default was rejected by
> the provider over its `reasoning_effort`. The server now validates against the
> live model catalogue and falls back automatically, and the reply reports which
> model answered. Verified against production: a request with no model selection
> returns `200` with `model` differing from `requestedModel`.

---

## 👥 Team

### Developed by Career Wallah
* **Sujoy Singha** — Team Leader, Full-Stack & Presentation Lead
* **Aritra Saha** — Backend & DevOps
* **Ishant Agarwala** — AI Engineer & UI/UX
* **Avik Singha Roy** — Database Administrator
* **Prathama Roy** — Presenter

---

## 🔗 Provenance

The web app lives at **[Ishantagarwala/CareerPliot](https://github.com/Ishantagarwala/CareerPliot)**.
The tokens in `design/android-shared.css` are copied from that repository's
`app/globals.css` and must be kept in sync.

## 📄 Licence

See [LICENSE](LICENSE).
