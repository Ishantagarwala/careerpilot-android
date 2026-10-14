# CareerPilot — Android design

The **design contract** for the CareerPilot Android client: the written specs,
the stylesheet and fonts the mockups are drawn with, and the rendered screens.

> **Status: design only.** This repository no longer carries an app
> implementation — earlier commits (`b5063d7` and before) held an Expo client
> that has since been superseded. The current client consumes these documents as
> its visual and architectural contract.

---

## Contents

| Path | What it is |
| --- | --- |
| `design/ANDROID_APP_PLAN.md` | Architecture, endpoint compatibility matrix, server-side blockers, phased roadmap, release checklist |
| `design/DESIGN_SPEC.md` | The visual contract — both brand languages, lime rules, type scale, spacing, radius, elevation, components, motion, accessibility |
| `design/API_CONTRACT.md` | **What the Android client needs from the web repo.** Read before changing anything server-side. |
| `design/screens.py` | The ten screens, authored as HTML |
| `design/android-shared.css` | The stylesheet they are drawn with — every token lifted from the web app's `globals.css` |
| `design/build.py` · `design/shot.mjs` | Renders `screens.py` to the PNGs |
| `design/png/` | The rendered screens, and `00-contact-sheet.png` with all ten |
| `design/fonts/` | Anybody, Hanken Grotesk and Space Grotesk, self-hosted |

## Start here

1. `design/png/00-contact-sheet.png` — all ten screens at a glance.
2. `design/DESIGN_SPEC.md` §1 — the two design languages the product already
   runs, and the tokens for each.
3. `design/ANDROID_APP_PLAN.md` §2 — the server-side blockers that must be
   settled before *any* Android client can authenticate. These are Phase 0.

The ten screens: `01` sign in · `02` AI Hub chat · `03` threads drawer ·
`04` career · `05` roadmap · `06` build · resume · `07` build · jobs · `08` me ·
`09` first run · `10` dark + offline.

## Regenerating the mockups

```bash
cd design
npm install playwright    # first time only
python3 build.py          # writes the .html, then the .png
```

Requires Python 3 and Node. `build.py` writes one `.html` per screen from
`screens.py`; `shot.mjs` then screenshots each at 592×1010 CSS px and 2×,
producing the 1184×2020 PNGs. The mockups are real HTML/CSS rendered headlessly
— not image-model output — so the text is genuinely readable and the set is
reproducible.

The renderer is **Chromium**, because that is what Playwright installs by
default. It previously required Firefox, so the generator failed on a fresh
clone with `Executable doesn't exist at …/firefox-…` and the committed PNGs were
never reproducible from source. Re-rendering now reproduces them: identical
dimensions, and a mean per-channel difference under 5/255 against the committed
files — font rasterisation only, with no layout or colour change.

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
   labels at 10–10.5px. The §9 checklist is the stricter of the two; an
   implementation should hold the 11px floor.

## Provenance

The web app lives at `Ishantagarwala/CareerPliot`. The tokens in
`design/android-shared.css` are copied from that repo's `app/globals.css` and
must be kept in sync — `design/DESIGN_SPEC.md` §1 carries the canonical values,
and where the two disagree, `globals.css` wins.

## Licence

See `LICENSE`.
