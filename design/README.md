# CareerPilot — Android App Design

Architecture plan and rendered screen mockups for the CareerPilot Android app.

| File | What it is |
| --- | --- |
| `ANDROID_APP_PLAN.md` | Architecture, API compatibility matrix, server-side blockers, phased roadmap, release checklist |
| `DESIGN_SPEC.md` | The visual contract — both brand languages, lime rules, type scale, components, motion, accessibility |
| `screens.py` | The ten screens, authored as HTML against the real design tokens |
| `android-shared.css` | Stylesheet carrying tokens lifted from the web app's `app/globals.css` |
| `png/` | Rendered output — the design deliverables |

## Why the mockups are code, not images

These are **not** image-model renders. Each screen is real HTML/CSS rendered to PNG
through headless Chromium at true Android density (412×915 @2x). That means:

- text is genuinely readable, because it is real text
- every colour is the actual token from `app/globals.css`, not an approximation
- the set is reproducible — edit `screens.py`, re-render, get updated screens

The three brand typefaces (Hanken Grotesk, Space Grotesk, Anybody) are bundled in
`fonts/` so the mockups carry authentic typography offline.

## Regenerating the PNGs

Requires Python 3, Node, and ImageMagick for the contact sheet.

```bash
npm install playwright    # first time only — provides the headless browser
python3 build.py          # -> the NN-*.html, then png/*.png
./make-contact-sheet.sh   # -> png/00-contact-sheet.png
```

`build.py` writes the intermediate `NN-*.html` files from `screens.py`, then runs
`shot.mjs` to screenshot each one at 592×1010 CSS px and 2×, giving the
1184×2020 PNGs.

The renderer is **Chromium**, because that is what Playwright installs by
default. It previously required Firefox, so the generator failed on a fresh
clone with `Executable doesn't exist at …/firefox-…`, and the committed PNGs
were not reproducible from source. Re-rendering now reproduces them: identical
dimensions, and a mean per-channel difference under 5/255 against the committed
files — font rasterisation only, with no layout or colour change.

`make-contact-sheet.sh` builds the 5×2 sheet. The screen list inside it is
spelled out on purpose — a `png/0*.png` glob also matches
`00-contact-sheet.png` itself, which gives montage 11 inputs for a 10-tile grid
and makes it silently split the output into `00-contact-sheet-0.png` and `-1.png`.

## The screens

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

## Keeping tokens in sync

These mockups hard-code the token values in `android-shared.css`. The web app
owns them, and `app/globals.css` changes regularly — so when it does, this
stylesheet has to be updated by hand.

`DESIGN_SPEC.md` §1 documents the canonical values. The API contract now lives in
`API_CONTRACT.md`; if the client ever grows a generated `tokens.json` exported
from the web repo, this hand-copying can go away and the app can no longer drift
from the brand.

## Design decisions still open

1. **Career/Roadmap visual language** — screens 04 and 05 use the brand
   cream/lime language. `PRODUCT.md` says lime is an action, not a coat of paint,
   and two consecutive lime-heavy tabs is the one place the set bends that rule.
   Either keep it, or move both to the neutral hub language and reserve lime for
   the pinned-direction card and progress bars.
2. **Bot verification** — Play Integrity attestation vs the hCaptcha Android SDK.
   See `ANDROID_APP_PLAN.md` §3.
3. **Auth mechanism** — device token exchange vs `SameSite=None` cookies.
   See `ANDROID_APP_PLAN.md` §2.
