# CareerPilot — Android

The Android client for [CareerPilot](https://careerpilot.cc), and the design
contract it is built against.

```
design/   the contract — specs, stylesheet, fonts, rendered screens
mobile/   the Expo / React Native client that implements it
```

Both live here on purpose. While the app was developed in a separate repository
from the specs that govern it, the two could drift apart without anyone noticing
— and they did: the client shipped with no handling for three of the block types
its own system prompt asks the model to emit.

---

## Contents

### `design/` — the contract

| Path | What it is |
| --- | --- |
| `design/DESIGN_SPEC.md` | The visual contract — both brand languages, lime rules, type scale, spacing, radius, elevation, components, motion, accessibility |
| `design/ANDROID_APP_PLAN.md` | Architecture, endpoint compatibility matrix, server-side blockers, phased roadmap, release checklist |
| `design/API_CONTRACT.md` | What the client needs from the server. Read before changing anything server-side. |
| `design/screens.py` | The ten screens, authored as HTML |
| `design/android-shared.css` | The stylesheet they are drawn with — every token lifted from the web app's `globals.css` |
| `design/build.py` · `design/shot.mjs` | Renders `screens.py` to the PNGs |
| `design/png/` | The rendered screens, and `00-contact-sheet.png` with all ten |
| `design/fonts/` | Anybody, Hanken Grotesk and Space Grotesk, self-hosted |

### `mobile/` — the client

| Path | What it is |
| --- | --- |
| `mobile/app/` | expo-router routes — `(auth)`, `(tabs)`, and the drill-down screens |
| `mobile/src/api/` | The API layer, including the SSE chat stream and the dependency-free reply parsers |
| `mobile/src/theme/` | The design tokens, both languages, light and dark |
| `mobile/src/components/` | Primitives, brand controls, navigation, product kit |
| `mobile/tests/` | Node test suites, run with `npm test` |
| `mobile/docs/` | The AI Hub capability audit and the design-fidelity comparisons |
| `mobile/app.config.js` | Fails the build if `EXPO_PUBLIC_API_URL` is missing or points somewhere a real device cannot reach |

## Start here

1. `design/png/00-contact-sheet.png` — all ten screens at a glance.
2. `design/DESIGN_SPEC.md` §1 — the two design languages the product already
   runs, and the tokens for each.
3. `design/ANDROID_APP_PLAN.md` §2 — the server-side blockers that must be
   settled before *any* Android client can authenticate. These are Phase 0.

The ten screens: `01` sign in · `02` AI Hub chat · `03` threads drawer ·
`04` career · `05` roadmap · `06` build · resume · `07` build · jobs · `08` me ·
`09` first run · `10` dark + offline.

## Working on the client

```bash
cd mobile
npm install
npx tsc --noEmit     # typecheck
npm test             # 167 pass, 1 skipped
npx expo start       # dev server
```

The one skipped test checks the web app's `/privacy`, `/terms` and
`/account-deletion` pages. Those belong to the web repository, so the test skips
itself when that project is not checked out alongside this one, rather than
failing for a reason that has nothing to do with the client.

Builds run in the cloud through EAS — no local Android SDK required:

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

| Profile | Output | Use |
| --- | --- | --- |
| `development` | APK + dev client | local debugging against Metro |
| `preview` | APK | sideload to a phone — **start here** |
| `production` | AAB | Play Console upload |

`app.config.js` refuses to build when `EXPO_PUBLIC_API_URL` is unset or points at
a private address. That guard exists because both profiles previously shipped
one: `preview` pointed at a developer's LAN address, and `production` had none at
all, falling back to `10.0.2.2` — the Android emulator's alias for the host
machine. Neither could reach a server from a real device.

## Regenerating the mockups

```bash
cd design
npm install playwright    # first time only
python3 build.py          # writes the .html, then the .png
./make-contact-sheet.sh   # -> png/00-contact-sheet.png
```

Requires Python 3, Node, and ImageMagick for the contact sheet. The mockups are
real HTML/CSS rendered through headless Chromium — not image-model output — so
the text is genuinely readable and the set is reproducible.

## Open decisions

Still blocking the design from being final:

1. **Career/Roadmap visual language** — screens 04 and 05 use the brand
   cream/lime language. `PRODUCT.md` says lime is an action, not a coat of paint,
   and two consecutive lime-heavy tabs bends that rule. Either keep it, or move
   both to the neutral hub language and reserve lime for the pinned-direction
   card and progress bars.
2. **Bot verification** — Play Integrity attestation (recommended, strictly
   stronger) vs the hCaptcha Android SDK. hCaptcha does not run in React Native,
   and the web login chain hard-fails without a valid token.
3. **Auth mechanism** — device token exchange (recommended) vs `SameSite=None`
   cookies. Auth.js defaults to `SameSite=Lax`, which a native client cannot use.
4. **Type floor** — `DESIGN_SPEC.md` §3 forbids type below 11px, but
   `android-shared.css` draws the ring caption, stat-tile captions and tab
   labels at 10–10.5px. The §9 checklist is the stricter of the two; the client
   holds the 11px floor.
5. **Server default model** — `https://careerpilot.cc` answers a request with no
   `modelSelection` with `500 Model not available.`, because the advertised
   default (`deepseek-ai/DeepSeek-V4.1-Flash`) is rejected by the provider over
   its `reasoning_effort`. The client works around this by naming a model
   explicitly; the real fix is server-side.

## Provenance

The web app lives at `Ishantagarwala/CareerPliot`. The tokens in
`design/android-shared.css` are copied from that repo's `app/globals.css` and
must be kept in sync — `design/DESIGN_SPEC.md` §1 carries the canonical values,
and where the two disagree, `globals.css` wins.

## Licence

See `LICENSE`.
