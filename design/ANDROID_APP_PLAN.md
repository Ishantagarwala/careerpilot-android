# CareerPilot Android — Architecture & Build Plan

> Status: **planning**. No Android code exists yet. This document is the
> decision record; `DESIGN_SPEC.md` is the visual contract; `screens.py` +
> `png/` are the generated mockups.

---

## 1. What we're building

An Android app for the existing CareerPilot product, backed by the **live
`https://careerpilot.cc` deployment**, distributed through **Play Store internal
testing**, built in the cloud (no local Android SDK required).

The web app is Next.js 16 App Router, 15 pages, 37 API routes, NextAuth v5 (JWT),
MongoDB, SSE-streamed LLM chat, Sarvam voice, PDF ingestion. None of that is
thrown away: the Android client is a **new presentation layer over the same
backend**.

### Decision: React Native (Expo) + EAS Build

| Option | Verdict |
| --- | --- |
| **Expo + React Native** | **Chosen.** Real native UI, real Play Store AAB, cloud builds via EAS (no local SDK), one codebase, and you already have React/TypeScript skills from this repo. |
| Capacitor / TWA wrapper | Rejected as the primary path. Lowest effort, but a WebView app feels like a website and Play Console applies extra scrutiny to thin wrappers. Worth keeping as a fallback. |
| Native Kotlin + Jetpack Compose | Rejected. Best platform feel, wrong cost — it means a second language and a second full UI implementation, with no reuse from this repo. |

The stack reuses your existing design tokens directly (see `DESIGN_SPEC.md`),
so the app and web stay one product rather than two.

---

## 2. The two blockers that must be fixed server-side first

I verified both against the current code. Until these are done, **no Android
client can talk to the API at all** — this is the first work item, not a
detail.

### Blocker 1 — Cookies are not usable cross-site

`lib/auth.ts` configures no `cookies` block, so Auth.js uses its defaults, which
include `SameSite=Lax`. A native app is a cross-site origin: `SameSite=Lax`
cookies are **not sent** on requests from it. Login will appear to succeed and
every subsequent request will be anonymous.

Two ways out, in preference order:

- **A · Device token exchange (recommended).** Add `POST /api/auth/mobile/token`
  that accepts email + password + captcha, runs the *same* gate chain as
  `authorize()` (email allowlist → `assertResidentialIp` → rate limit → captcha →
  bcrypt), then mints a signed, rotating refresh token. The app stores it in
  `expo-secure-store` (Android Keystore-backed) and sends
  `Authorization: Bearer …`. This keeps `SameSite=Lax` intact for the web — no
  web security posture is weakened to serve mobile.
- **B · `SameSite=None; Secure` cookies.** Smaller change, but it loosens the
  web app's cookie posture and forces you to add CSRF protection to compensate.
  Only take this if you want zero new auth code.

**Recommendation: A.** It also gives you per-device revocation ("sign out my
other phone"), which cookies can't express.

### Blocker 2 — No CORS headers

`next.config.ts` sets CSP, HSTS, `nosniff` and `X-Frame-Options`, but no
`Access-Control-Allow-Origin`. Native fetch is not subject to browser CORS, so
this is only strictly required if you also ship a web/PWA client or use
`expo-web-browser` for an OAuth leg. Add it anyway for the preflight that
`Authorization` headers trigger on some Android HTTP stacks:

```
Access-Control-Allow-Origin: https://careerpilot.cc   (never *)
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Vary: Origin
```

Keep the CSP edit discipline already noted in `SYSTEM_WORKFLOW.md` §8 — it is
hand-maintained and fails silently.

---

## 3. Endpoint compatibility matrix

Every route below was read from the repo. Cost is estimated in client work, not
server work.

| Endpoint | Transport | Android cost | Notes |
| --- | --- | --- | --- |
| `auth/register`, `auth/[...nextauth]` | JSON | Low | Registration needs the captcha rewrite (below). |
| `ai-hub/threads`, `/[id]` | JSON | Low | Straightforward CRUD. |
| `ai-hub/models` | JSON | Low | Drives the model picker. |
| `ai-hub/documents`, `/[id]` | JSON | Low | Library list + delete. |
| **`ai-hub/chat`** | **SSE** | **High** | React Native's `fetch` cannot stream. Use `expo/fetch` (streaming-capable) or `react-native-sse`, then parse the reasoning-channel chunks — the route already separates chain-of-thought from answer, so the client must too. |
| `ai-hub/upload`, `pdf/upload` | multipart | Medium | RN `FormData` + `expo-document-picker`. Server side is `req.formData()` — compatible. File size cap must be respected. |
| `voice/transcribe` | multipart audio | Medium | `expo-av` records; Android needs `RECORD_AUDIO` permission and a non-webm container (m4a) — verify Sarvam accepts it. |
| `voice/speak` | JSON → base64 WAV | Medium | Decode base64 to a file, then play. Cannot use the web's `data:` URL trick. |
| `career/assess`, `recommendations`, `select`, `niche-catalog` | JSON | Low | Long-running recommendations need a real progress state. |
| `career/voice-extract` | multipart | Medium | Spoken assessment answers. |
| `roadmap`, `roadmap/progress` | JSON | Low | Progress writes are optimistic-friendly. |
| `resume*` (CRUD, `analyze`, `ats-analyze`, `match-jd`, `latex`) | JSON | Medium | LaTeX export must open in a viewer/share sheet. |
| `jobs`, `jobs/applications` | JSON | Low | Multi-provider latency varies; needs caching. |
| `projects`, `projects/teams` | JSON | Low | — |
| `news` | JSON | Low | Cached server-side; safe to cache client-side too. |
| `profile`, `progress`, `courses` | JSON | Low | — |

### The captcha problem (needs a product decision)

Every auth route hard-fails without a valid hCaptcha token
(`SYSTEM_WORKFLOW.md` §3, step 6). hCaptcha is a **web widget**; it does not run
in React Native. Three options:

1. **hCaptcha native SDK** — there is an Android SDK, but it pulls in Google
   Play Services and adds a dependency for every login.
2. **Attestation instead of captcha** — Play Integrity API for the mobile
   client, with the server trusting a verified Play Integrity verdict in place
   of a captcha token. This is the *correct* long-term answer and is strictly
   stronger than a captcha.
3. **Captcha-free mobile path, IP + rate-limit only** — smallest change, but it
   creates a captcha bypass that anyone can hit with a custom client. **Do not
   do this** on a public deployment.

**Recommendation: 2**, with 1 as the interim if you want to ship before Play
Integrity is wired. Either way the login order in `lib/auth.ts` stays
fail-closed; only the bot-verification step is swapped, never removed.

---

## 4. Screen inventory

Tabs follow Material's ≤5 rule and the app's real usage weight:

```
Hub  ·  Career  ·  Build  ·  Me
```

- **Hub** — AI Hub chat (the daily surface), threads drawer, document library
- **Career** — pinned direction, recommendations, roadmap, assessment
- **Build** — Resume + ATS score, Projects, Jobs + application tracker
- **Me** — profile, study stats, theme, offline downloads, sign out

Ten mockups are generated in `png/`. They are the design contract:

| # | Screen | Demonstrates |
| --- | --- | --- |
| 01 | Sign in | Brand language, captcha placement, security notice |
| 02 | AI Hub chat | Streamed reply, PDF grounding with citation, thinking state |
| 03 | Threads drawer | Search, pinned, recency grouping |
| 04 | Career | Pinned direction, roadmap %, today's milestone, recommendations |
| 05 | Roadmap | Milestone spine — done / in-progress / locked |
| 06 | Build · Resume | ATS score as focal metric, ranked fixes, JD match |
| 07 | Build · Jobs | Match %, missing-skill gap, application tracker |
| 08 | Me | Study stats, theme, biometric sign-in, residential-IP notice |
| 09 | First run | Permissions in context, both refusable, offline explained |
| 10 | Dark + offline | Cached thread, disabled composer, honest reconnect state |

### Deliberately deferred

Mermaid diagrams (432 lines on web), Recharts, and KaTeX have **no** native
React Native renderer. For v1 they render inside a small `react-native-webview`
block only when the model emits that content type — native for 95% of replies,
WebView for the rest. Revisit only if usage data says diagrams matter.

---

## 5. Offline and state strategy

This is where a study app is won or lost, and it's why screen 10 exists.

| Data | Strategy |
| --- | --- |
| Threads + messages | Local store (`expo-sqlite`), read-through cache. Opened threads are readable offline. |
| Documents | PDFs cached on first open; explicit "Save offline" per document. |
| Roadmap / progress | Optimistic write, queue-and-replay when connectivity returns. |
| Career recommendations | Cache last result; re-fetch on demand. |
| Jobs | Cache last fetch with a visible "as of" timestamp. |
| Chat send while offline | **Disable the composer** and say so. Do not queue a prompt and silently send it later — the user must see the difference. |

Auth tokens live in `expo-secure-store` only. Never `AsyncStorage`, never logged.

---

## 6. Phased roadmap

**Phase 0 — unblock the server (½ day).** Implement the token-exchange route,
CORS headers, and the mobile bot-verification decision. Verify with `curl`
before any app code exists. *Exit test: obtain a token and read
`/api/ai-hub/threads` with it.*

**Phase 1 — skeleton (2–3 days).** Expo project, theme provider carrying the
real tokens, navigation shell with 4 tabs, sign-in against the new route, secure
token storage, biometric unlock. *Exit test: sign in, kill the app, reopen still
signed in.*

**Phase 2 — the Hub (1 week).** The hard part: SSE streaming with the
reasoning-channel split, thread CRUD, composer with attach, model picker.
*Exit test: a full streamed, grounded reply on a real device.*

**Phase 3 — Career + Roadmap (4–5 days).** Assessment (text + voice),
recommendations, pinned direction, milestone progress writes.

**Phase 4 — Build (1 week).** Resume CRUD, ATS score view, JD match, LaTeX export
via share sheet, jobs + tracker. WebView fallback for diagram/chart blocks.

**Phase 5 — Polish + release (4–5 days).** Offline cache, dark theme, haptics,
accessibility pass, Play Console listing, internal testing track.

Realistic total: **5–6 focused weeks**. Phases 0–2 are the risky ones; everything
after is execution against a settled pattern.

---

## 7. Release checklist

- `applicationId` set once, never changed after first upload
- Target the current Play-required API level (Play raises this annually)
- AAB via EAS, uploaded to **internal testing** first
- Data safety form: this app collects email, and sends study content to a
  third-party LLM — declare both, since undeclared data collection is the most
  common rejection reason for exactly this kind of app
- Privacy policy URL reachable (you have `careerpilot.cc` already)
- Screenshots: the ten mockups in `png/` are the source art
- Keystore generated and backed up **outside the repo**; losing it means losing
  the ability to update the listing

---

## 8. Open decisions

1. **Career/Roadmap visual language** — currently mocked in the brand
   cream/lime language. PRODUCT.md says lime is an action, not a coat of paint;
   two consecutive lime-heavy tabs is the one place the mockups bend that rule.
   Options: keep as-is, or adopt the neutral hub language and reserve lime for
   the pinned direction card only.
2. **Bot verification** — Play Integrity vs hCaptcha native SDK (see §3).
3. **Auth cookies** — token exchange vs `SameSite=None` (see §2).
4. **Minimum Android version** — drives biometric API choice and Market share.
