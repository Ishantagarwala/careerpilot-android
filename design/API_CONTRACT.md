# Android Client Contract

**What the Android app needs from the web repo.**

The app is a standalone client of `https://careerpilot.cc`. Most of that API it
consumes as-is, but a few things it *depends on* are fragile, and changing them
in the web repo will break the app silently — there is no shared build, no
shared types, and no test that spans both.

Keep this file next to the web code's concerns, not just in this repo. Anything
marked **FRAGILE** below deserves a note in the web repo's `SYSTEM_WORKFLOW.md`.

Last verified against web commit: `74fd996` (`CareerPliot` @ `main`).

---

## 1. Required server changes (Phase 0 — blocking)

Nothing in this section exists yet. Until all three are done, **no native client
can authenticate**.

### 1.1 Device token exchange — `POST /api/auth/mobile/token`

Auth.js is configured with no `cookies` block (`lib/auth.ts`), so it uses its
defaults, which include `SameSite=Lax`. A native app is a cross-site origin, so
those cookies are never sent: login would appear to succeed and every subsequent
request would be anonymous.

The route must run the **same** gate chain as `authorize()` — do not fork or
soften it:

1. Reject non-string credentials (blocks NoSQL `$ne` injection)
2. `isAllowedEmailProvider(email)`
3. `assertResidentialIp({ ip, email })`
4. Rate limit per email
5. Bot verification (see §1.2)
6. `bcrypt` compare against `User.findOne().select('+password')`

On success it returns a short-lived access token plus a rotating refresh token.
The app stores them in `expo-secure-store` (Android Keystore-backed) and sends
`Authorization: Bearer <token>`.

**Requirements**

- Access token TTL ~15 min; refresh token TTL ~60 days, rotated on every use
- Rotation must invalidate the previous refresh token (reuse detection)
- A revocation endpoint, so "sign out my other phone" is possible
- Never accept an expired access token — fail closed, as the rest of the auth
  path already does

**Why not `SameSite=None` cookies instead:** it is a smaller change but loosens
the web app's cookie posture and forces CSRF compensation. The token exchange
leaves the web's security model untouched and gives per-device revocation, which
cookies cannot express.

### 1.2 Bot verification without a web widget

The login chain hard-fails on a missing/invalid hCaptcha token
(`SYSTEM_WORKFLOW.md` §3 step 6). **hCaptcha is a web widget and does not run in
React Native.**

- **Recommended:** Play Integrity API. The app obtains an integrity verdict and
  the server verifies it in place of a captcha token.
- **Interim:** the hCaptcha Android SDK, which pulls in Google Play Services.
- **Do not:** skip bot verification for mobile and rely on IP + rate limits. That
  is a bypass any custom client can hit, on a public deployment.

Only the bot-verification step is swapped. The chain stays fail-closed.

### 1.3 CORS

Not strictly required for native fetch (not subject to browser CORS), but needed
for any web/PWA leg and for preflight on some Android HTTP stacks.

```
Access-Control-Allow-Origin: https://careerpilot.cc   # never *
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Vary: Origin
```

The existing CSP in `next.config.ts` is hand-maintained and fails *silently* —
consult `SYSTEM_WORKFLOW.md` §8 before editing.

---

## 2. FRAGILE — changes here break the app

### 2.1 `ai-hub/chat` SSE chunk shape

`app/api/ai-hub/chat/route.ts` streams `text/event-stream` and **separates
reasoning-model chain-of-thought from the answer** on distinct fields, because
providers disagree on the streamed field name. The client parses this to render
"thinking" separately from the reply.

- React Native's `fetch` cannot stream at all; the app uses `expo/fetch` or
  `react-native-sse`
- Any change to the event names, the reasoning-vs-answer split, or the chunk
  envelope requires a matching client release. Treat it as a versioned contract.

### 2.2 Auth cookie/session semantics

`lib/auth.config.ts` uses the JWT strategy and threads `user.id` through the
`jwt`/`session` callbacks. If the session strategy changes to database sessions,
the mobile token exchange (§1.1) must change with it.

### 2.3 Route paths and response shapes

All routes below are consumed directly. Renaming a path or changing a response
envelope is a breaking change:

```
auth/register                 career/recommendations      resume/[id]/analyze
auth/[...nextauth]            career/select               resume/[id]/latex
ai-hub/threads[/[id]]         career/voice-extract        resume/[id]/match-jd
ai-hub/models                 career/niche-catalog        resume/ats-analyze
ai-hub/documents[/[id]]       career/assess               jobs, jobs/applications
ai-hub/upload                 roadmap, roadmap/progress    projects, projects/teams
ai-hub/chat                   profile, progress, courses   news
voice/transcribe, voice/speak pdf/upload
```

### 2.4 `voice/speak` returns base64 WAV

The web plays it via a `data:` URL (and the CSP carries `media-src data:` for
exactly this). The app cannot use that trick — it decodes to a file and plays it.
Keep returning base64; a switch to a streamed binary response is a client change.

### 2.5 Upload limits

`ai-hub/upload` and `pdf/upload` use `req.formData()` with `formidable`. The app
sends RN `FormData`, which is compatible. If the size cap changes, the client's
pre-upload validation must match, or users get a failure *after* waiting through
a long upload.

---

## 3. Consumed as-is (no server change)

| Endpoint | Transport | Client cost |
| --- | --- | --- |
| `ai-hub/threads`, `/[id]` | JSON | Low |
| `ai-hub/models` | JSON | Low |
| `ai-hub/documents`, `/[id]` | JSON | Low |
| `ai-hub/chat` | SSE | **High** — see §2.1 |
| `ai-hub/upload`, `pdf/upload` | multipart | Medium |
| `voice/transcribe` | multipart audio | Medium — Android needs `RECORD_AUDIO` and a non-webm container (m4a); confirm Sarvam accepts it |
| `voice/speak` | JSON → base64 | Medium — see §2.4 |
| `career/*` | JSON | Low |
| `roadmap`, `roadmap/progress` | JSON | Low |
| `resume*` | JSON | Medium — LaTeX export opens via share sheet |
| `jobs`, `jobs/applications` | JSON | Low |
| `projects`, `projects/teams` | JSON | Low |
| `news` | JSON | Low — already server-cached |
| `profile`, `progress`, `courses` | JSON | Low |

---

## 4. Design tokens — single source of truth

`design/android-shared.css` holds a **hand-copied** snapshot of the tokens in the
web repo's `app/globals.css`. That file has been modified in 12 of 183 commits,
so this copy *will* drift.

The product runs two design languages and both are reproduced:

- **Brand** (`:root`) — cream/lime neo-brutalist. Auth and first-run only.
- **Hub** (`.aihub`) — near-white/near-black, quiet. All product surfaces.

**Before app scaffolding begins**, replace the hand-copy with a generated export:

1. Add an `export-tokens` script to the web repo that parses `app/globals.css`
   and emits `tokens.json`
2. Commit that JSON, and have the app's theme provider read it

One source of truth, no monorepo required. See `DESIGN_SPEC.md` §1 for the
canonical values, and §2 for where lime is and is not allowed.
