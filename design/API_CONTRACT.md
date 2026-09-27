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

## 1. Server changes (Phase 0)

**Status: implemented in the web repo, one config step outstanding.**

| Item | State |
| --- | --- |
| 1.1 Device token exchange | ✅ Implemented |
| 1.2 Bot verification | ✅ Implemented — **needs Play Integrity credentials configured** |
| 1.3 CORS | ✅ Implemented |

Until the Play Integrity credentials are set on the server, mobile sign-in is
refused (see 1.2). That is deliberate, not a bug.

### 1.1 Device token exchange — implemented

`POST /api/auth/mobile/token` runs the same gate chain as web sign-in
(`lib/authGates.ts`), then mints a short-lived access token plus a rotating
refresh token.

**Request**

```json
{ "email": "...", "password": "...", "integrityToken": "...", "deviceLabel": "Pixel 8" }
```

**Response 200**

```json
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 900,
  "refreshExpiresIn": 5184000, "user": { "id": "...", "email": "...", "name": "..." } }
```

**Failure** — `{ message, reason }` with a status of 401 (bad credentials),
403 (email provider / network / bot check), 429 (rate limited, includes
`Retry-After`), or 400 (malformed body).

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/mobile/refresh` | `{ refreshToken }` → new token pair. One-time rotation. |
| `GET  /api/auth/mobile/session` | Verifies a bearer token; 401 when it is no longer good. |
| `POST /api/auth/mobile/revoke` | Sign out this device, or `{ all: true }` for every device. |

**Token lifetimes:** access 15 minutes, refresh 60 days.

**Security properties** (unit-tested, `npm run check:mobile-tokens`)

- Access and refresh tokens are separated by JWT **audience**, so a stolen
  15-minute access token cannot be traded for a 60-day one, and a refresh token
  cannot be used as an API credential.
- Signing secret is derived from `AUTH_SECRET` with a domain separator, so a
  mobile token can never be mistaken for an Auth.js session token.
- Refresh tokens are stored **hashed** (sha256); a database dump yields none.
- Rotation is one-time, and **reuse is detected**: presenting an already-rotated
  token revokes every session for that user and returns `reason: "reuse"`.

**Rotation and reuse detection were verified end-to-end** against a local server
and an in-memory MongoDB, not just unit-tested:

| Scenario | Result |
| --- | --- |
| sign in with real credentials | 200, access + refresh returned |
| `GET /session` with a valid bearer | 200 with the user |
| refresh with a valid token | 200, new pair, refresh token differs |
| **replay the old refresh token** | **401 `reason: "reuse"`** |
| use the newly-issued token after that | 401 — all sessions revoked |
| revoke this device | 200, then its refresh token fails |
| revoke with no bearer | 401 |
| wrong password | 401 `invalid_credentials` |

Also verified in **production** after deploy: all four routes respond, CORS
echoes an allowlisted origin, and a disallowed origin gets no
`Access-Control-Allow-Origin` header at all.

### 1.2 Bot verification — implemented, needs credentials

`lib/playIntegrity.ts` verifies a Play Integrity token: the app must be
**PLAY_RECOGNIZED** (a re-signed APK is refused), the device must report
**MEETS_DEVICE_INTEGRITY**, and both the app and request package names must
match. The policy is unit-tested (`npm run check:play-integrity`).

**This is fail-closed.** If Play Integrity is not configured, mobile sign-in is
refused outright. The tempting shortcut — skip bot verification for mobile
because a captcha cannot run there — would hand anyone with a custom HTTP client
a captcha bypass on a public deployment.

**Outstanding:** set these on the server's `.env.production` (never committed):

```
PLAY_INTEGRITY_SERVICE_ACCOUNT_EMAIL=
PLAY_INTEGRITY_PRIVATE_KEY=          # PEM, \n escaped
PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=
PLAY_INTEGRITY_PACKAGE_NAME=         # optional, defaults to cc.careerpilot.app
```

Until then the app's sign-in shows the server's refusal message verbatim, which
says the server has no mobile verification configured.

### 1.3 CORS — implemented

`lib/cors.ts` echoes the request `Origin` only when it is allowlisted. It is
**not** in `next.config.ts` because `Access-Control-Allow-Origin` accepts
exactly one origin or `*` — a comma-separated list is invalid and browsers
reject it, and static headers cannot echo.

`*` is deliberately not used: these endpoints are authenticated, and a wildcard
lets any web page drive a request from a signed-in user's browser.

Native fetch ignores CORS, so this exists for a web/PWA client and for preflight
on some Android HTTP stacks — not because the Expo app requires it.

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
