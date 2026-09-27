# CareerPilot Android — Design Spec

The visual contract for the Android app. Every value here is either **lifted
from the web app** (`app/globals.css`, `app/layout.tsx`) or **derived from it**
by the rules in §2. If a value here disagrees with `globals.css`, `globals.css`
wins — this file exists so the Android side doesn't reinvent the brand.

Companion files: `ANDROID_APP_PLAN.md` (architecture), `screens.py` (mockups),
`png/` (rendered screens).

---

## 1. The two design languages

The product already runs two distinct visual systems. Reproduce both; don't
average them.

### Language A — Brand (`globals.css` `:root`)

Cream, lime, hard black borders, hard offset shadows. Neo-brutalist. Used for
**auth and first-run**, where the brand introduces itself.

| Token | Value |
| --- | --- |
| `--background` | `#f4f6e8` |
| `--foreground` | `#151f00` |
| `--card` | `#ffffff` |
| `--primary` | `#baf600` (lime) |
| `--primary-foreground` | `#151f00` |
| `--secondary` | `#0043eb` (electric) |
| `--accent` | `#00f0ff` (cyan) |
| `--muted` | `#e8ecd6` |
| `--muted-foreground` | `#434933` |
| `--destructive` | `#ba1a1a` |
| `--border` | `#000000` |
| `--ring` | `#4c6700` |
| `--radius` | `8px` |

Signature moves: `2px solid #000` borders, `3px 3px 0 #000` / `4px 4px 0 #000`
hard offset shadows, thin black keylines, dashed borders for secondary actions.

### Language B — Hub (`globals.css` `.aihub`)

Near-white, near-black, quiet. Lime appears **only** as a small accent. Used for
**all product surfaces**: chat, roadmap, resume, jobs, profile.

| Token | Value | Notes |
| --- | --- | --- |
| `--hub-bg` | `#f7f8fa` | |
| `--hub-surface` | `#ffffff` | |
| `--hub-raised` | `#fbfbfc` | |
| `--hub-text` | `#15171b` | |
| `--hub-muted` | `#6b7280` | 4.8:1 on white — chosen for 11–13px labels |
| `--hub-line` | `#e6e8ee` | |
| `--hub-soft` | `#eceef2` | |
| `--hub-strong` | `#050505` | primary action colour |
| `--hub-danger` | `#dc2626` | |
| `--radius-composer` | `22px` | |

Dark variant (`globals.css` `.dark .aihub`): `--background` `#0f1115`,
`--card`/`--popover` `#16181d`, `--muted` `#1e2128`, `--border`/`--input`
`#262a32`, `--muted-foreground` `#9198a4`.

> Note: the hub's send button is `--hub-strong` (near-black), **not** lime. The
> web app deliberately keeps lime out of the hub's primary action. Match that.

---

## 2. Where lime is allowed

PRODUCT.md principle 3: *"Lime is an action, not a theme."* Derived rules for
Android:

**Lime may be:**
- the primary button fill in Language A (sign in, Continue)
- the brand wordmark chip
- the active tab indicator behind a bottom-nav icon
- progress fills (`--primary` on `.track`)
- completion state on a milestone knob
- the AI reply's identity mark and the bullet dots inside a reply
- a `92%` match tag

**Lime may not be:**
- a screen background, ever
- body text colour (fails contrast on light surfaces)
- more than roughly one accent moment per screen in Language B
- a filled card whose content is not itself an action

Screen 04 (Career) is the current edge case — the "today's milestone" card is a
full lime fill, which is defensible because the card *is* the action, but it's
the one place to revisit (see `ANDROID_APP_PLAN.md` §8, decision 1).

---

## 3. Type

Loaded via `next/font/google` on web; bundle the same three on Android with
`expo-font`.

| Role | Family | Token |
| --- | --- | --- |
| Body, UI | **Hanken Grotesk** | `--font-sans` |
| Labels, mono, metadata | **Space Grotesk** | `--font-mono` / `--font-label` |
| Headings, numerals of emphasis | **Anybody** | `--font-heading` |

Android scale (Material 5 roles, biased to the web app's actual sizes):

| Role | Size / line-height / weight | Family |
| --- | --- | --- |
| Screen title | 25 / 1.1 / 700 | Anybody |
| App-bar title | 19–20 / 1.15 / 700 | Anybody |
| Brand display | 37–42 / 1.04 / 800 | Anybody |
| Section heading | 17 / 1.25 / 700 | Anybody |
| Body (chat) | 15.5 / 1.68 / 400 | Hanken |
| Body (UI) | 14.5–15 / 1.5 / 400 | Hanken |
| Label / eyebrow | 11 / 1.0 / 600 · `.1em` · uppercase | Space Grotesk |
| Metadata | 12–13 / 1.4 / 400 | Hanken |
| Metric (ATS score) | 40 / 1.0 / 800 · `-.04em` | Anybody |

Rules: never below 11px; body never below 14px; uppercase labels always tracked
`+.1em`; emphasis numerals always tabular. Support Dynamic Type — nothing may
truncate at the largest system setting.

---

## 4. Spacing, radius, elevation

**Spacing** — strict 4/8dp scale: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`.
Screen gutter 16dp. Section gap 22–24dp. Component internal padding 12–16dp.
Prefer whitespace over dividers; when a divider is needed it is `1.5px
--hub-line`.

**Radius**

| Context | Radius |
| --- | --- |
| Language A controls | `8px` (hard, consistent with the border language) |
| Hub cards | `14px` |
| Hub small chips / inputs | `11–12px` |
| Composer | `22px` |
| Bottom sheets / drawer | `26px` on the leading corner only |
| Pills, avatars, FAB | fully round, or `20px` for the FAB |

**Elevation** — Language A uses *hard offset shadows* (`4px 4px 0 #000`), not
blur. Language B uses soft low shadows (`0 2px 12px rgba(21,23,27,.04)`), and
elevation is carried mostly by the `--hub-line` border instead. Never mix the
two on one screen.

**Touch targets** — minimum 48×48dp (Material), 8dp minimum gap. Icon buttons
are 44dp with the glyph inside; expand hit area when the glyph is smaller.

---

## 5. Components

**Bottom navigation** — exactly 4 tabs: `Hub · Career · Build · Me`. Icon plus
label, never icon-only. Active state is the lime pill **behind the icon only**,
plus a heavier label weight. The pill must never reach the label text — an
indicator overlapping its own label reads as a rendering bug.

**App bar** — title plus optional context subtitle. Navigation icon on drill-down
screens. Max one trailing action; overflow goes to a menu.

**Composer** (Hub) — 22px radius, soft shadow, placeholder, then a control row:
`Attach` · optional context chips · send. Send is a 44dp circle in
`--hub-strong`; disabled send is `--hub-soft` with a muted glyph. Focus raises
the border to `--hub-strong`.

**Reply block** — identity row (lime 20px rule + mono uppercase name), then
flowing prose at 15.5/1.68, capped around 68ch. Bullets use lime dots. Grounding
citations are a bordered `--hub-raised` card with a PDF mark and page reference.

**Streaming state** — three muted dots plus a mono label ("writing summary…").
Quiet, never bouncy. Respect reduced-motion: fall back to a static label.

**Metric ring** — 132dp, 12dp stroke, `--hub-soft` track, lime progress,
`stroke-linecap: round`, rotated −90°. Centre carries the number in Anybody 800
with a mono uppercase caption beneath.

**Milestone spine** — 22dp knob on a 2px rail. Three states only: done (lime
fill + black check), in-progress (3px near-black ring + centre dot), locked
(hairline ring, no fill). The rail is lime above the current milestone and
`--hub-line` below it.

---

## 6. Motion

150–300ms for micro-interactions; sheets and screen transitions ≤400ms.
Ease-out on enter, ease-in on exit, exit at ~65% of enter duration. Transform and
opacity only — never animate width, height, or layout position. Stagger list
entrances 30–50ms per item. Sheets rise from their trigger; forward navigation
slides in from the right, back reverses it.

**Honour reduced motion**: streaming indicators become static text, reveals
become crossfades, parallax is removed. PRODUCT.md principle 5 is explicit that
thinking and streaming states stay quiet.

---

## 7. Accessibility

Inherited from PRODUCT.md and enforced on Android:

- Body text ≥4.5:1 in both themes; secondary text ≥3:1. Lime is never text on a
  light surface.
- Every interactive element has an `accessibilityLabel`; icon-only buttons name
  their action, not their glyph.
- Focus order matches visual order; screen-reader traversal is checked per screen.
- Colour is never the only signal — match percentage, milestone state, and
  application status all carry a label or glyph too.
- Full operation at 200% font scale without truncation or overlap.
- Safe areas respected: status bar, punch-hole, and gesture bar. No tappable
  content in the gesture zone.

---

## 8. Copy voice

PRODUCT.md: *calm co-pilot, not a hype-man.* Capable, warm, precise.

**Do** — "You're offline. This thread is read from your device." · "Fix these to
score higher" · "Sign-in is restricted to residential IPs. Turn off VPN if login
fails."

**Don't** — emoji greetings, "🚀 Let's crush it!", "Unlock your potential",
"Seamless control", fake enthusiasm of any kind. No emoji anywhere in the UI;
icons are vector glyphs on a consistent 2px stroke.

Empty states carry the brand (PRODUCT.md principle 4). They are deterministic and
plain — never AI-generated confetti.

---

## 9. Pre-ship design checklist

- [ ] Both languages present and not blended within a screen
- [ ] Lime audited against §2 — no lime background, no lime body text
- [ ] All type ≥11px; body ≥14px; readable at 200% font scale
- [ ] Every touch target ≥48dp with ≥8dp separation
- [ ] Active tab indicator clear of its label
- [ ] Dark theme contrast verified independently, not inferred from light
- [ ] Reduced-motion path implemented for streaming and reveals
- [ ] Safe areas clear on a punch-hole device and in landscape
- [ ] Offline and error states designed, not just the happy path
- [ ] No emoji, no placeholder-lorem, no fake stats in shipped UI
