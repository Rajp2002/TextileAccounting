# Weavly colour system — discovery and definition

Status: **proposal for review. Nothing in the app has been recoloured.** Written 2026-09-29 on branch `claude/weavly-brand-colour-system-942ff8`.
Companion specimen: [`color-specimen.html`](./color-specimen.html) (static, open it in a browser; it is not part of the app).

Evidence tags used throughout: **[Observed]** present in the rendered page or source · **[Inferred]** a design-system conclusion from observations · **[Proposed]** a new value or rule.

---

## A. Executive summary

Weavly's identity is **cotton, indigo and one saffron thread**. The redesigned landing page ("Neel", chosen 2026-09-28 in `docs/landing-page-redesign.md`) is warm-neutral paper, deep indigo for text, actions and dark bands, and a single saffron accent that is the same orange as the logo. Saffron is used sparingly and never as a background block: a 2px rule, an eyebrow label, two slider thumbs, one large ₹ figure on the dark band. That restraint is what makes it recognisably Weavly. [Observed → Inferred]

The authenticated app is a different palette wearing the same name: yellower cream (`#FFF8EA`), a green-grey charcoal ink (`#1E2528`), sand hairlines, a neutral `#111111` sidebar, and saffron used as a filled selected state, a button variant and a background blob. A visitor going landing → sign-in → app sees the paper change temperature, the ink change hue, and saffron change role. [Observed]

**Recommendation:** adopt the landing palette as canonical, mature it in five places, and have the product inherit it at a lower intensity.

1. **Cotton** (warm paper neutrals) and **Neel** (indigo ink ramp) are the structure. Saffron is the signature and stays rare.
2. **Saffron gets two jobs, not one:** `saffron-500` for things you look at (logo, threads, display figures, focus on dark) and `saffron-700` for things you read or click (labels, focus on light). White-on-saffron-500 is 2.98:1 and fails; Ink-on-saffron-500 is 5.34:1 and passes, so any saffron fill carries an Ink label.
3. **Danger moves off saffron's hue.** The app's risk red (`#A6402D`) is visually the same colour as saffron-ink (`#A8430E`): OKLab distance 0.027, contrast 1.06:1. It moves to a crimson "madder" (`#AC1637`), distance 0.086, so "brand" and "something is wrong" stop colliding.
4. **Warning moves off saffron too**, to an olive ochre, and loses the orange cast the app's `#B87908` had.
5. **Near-duplicates are merged**: 6 pairs on the landing page alone (table in B), and the three parallel token vocabularies (`--lp-*`, `--weavly-*`, shadcn) collapse into one `--wv-*` set.

Colour's role: **structure first (cotton, indigo), identity second (one saffron thread), meaning third (status hues, always with an icon or label).** Nothing else decorates.

---

## B. Landing-page findings

**Where I looked.** Rendered `/` at 1280×800 and a 1280×5200 full-page capture in the in-app browser; walked every element's computed colour (text, background, border, SVG stroke) with JS and matched the results to `components/landing/landing.module.css`, the `[color:var(--lp-*)]` classes in `components/landing/*.tsx`, and the logo PNG's pixels. Also rendered `/login` and `/signup`. I could not verify hover/focus states in the browser (the pane cannot force pseudo-states); those are read from the CSS. Mobile was not re-rendered here; the landing redesign doc records its own 390×844 check.

**Dominant colours (computed from the live DOM, [Observed]).** Ink `#16213E` (95 text nodes, 57 SVG strokes), body `#2B3246` (99), muted `#535A6D` (76), line-strong `#B5AFA1`, line `#D9D5CA` (34 borders), on-loom text `#EEF0F6` (24), saffron-ink `#A8430E` (13 text nodes), saffron `#E8762A` (9 backgrounds), paper `#F4F2EC`, sheet white (7), loom `#101A33` (3 full-width bands), black (navbar only).

**Signature combinations.**
- Ink text on paper (14.2:1) with white "sheet" cards edged in a warm grey hairline: the ledger look.
- Loom band with paper-coloured text and one saffron figure (5.8:1): the "cloth on the beam".
- Saffron 2px thread + mono uppercase eyebrow in saffron-ink: how saffron introduces every section.
- Ink primary button, hollow secondary with a grey edge: the only two button styles on the page.

**Hierarchy.** Colour is almost entirely structural. Saffron is referenced about 30 times in the landing source (14 in TSX, 16 in the CSS module) and is never a block fill except the navbar pill. There are no gradients on the page body, no blur blobs, no tinted cards (the redesign removed them).

**Inconsistencies and duplicates [Observed].**

| Finding | Detail |
|---|---|
| Loom-raised `#18233F` ≈ Ink `#16213E` | ΔOKLab 0.008: indistinguishable |
| Loom-line `#26314F` ≈ primary hover `#243258` ≈ body `#2B3246` | ΔOKLab 0.016–0.034 |
| On-loom `#EEF0F6` = callout blue bg `#EEF0F7` | ΔOKLab 0.001 |
| Cost-stack rust `#A94713` = saffron-ink `#A8430E` | ΔOKLab 0.009, a second copy from the app |
| Saffron `#E8762A` / app `#E27025` / logo ≈`#E8782A` / shader `#EE7F2D` / navbar gradient `#F59E0B→#F97316` | five oranges for one idea |
| Saffron focus ring on paper | 2.66:1: fails the 3:1 non-text minimum |
| `line-strong` `#B5AFA1` as the secondary-button and control edge | 1.95:1 on paper: fails 3:1 for control boundaries |
| Callout red `#A8361C` | third near-copy of saffron-ink / app risk |
| `--lp-good` `#2F6B43` | declared, no consumer in `components/landing/` |

**Surprising.** (1) The logo's pixels measure ≈`#E8782A`, within 0.005 OKLab of landing saffron (0.022 from the app's `#E27025`), so landing saffron is the truer logo colour. (2) The navbar's "Start with Free" pill still uses Tailwind default `amber-500→orange-500`, so the most saturated orange on the page is not in the palette. (3) The landing is *less* saffron than the app: the app has 203 `bg/text/border/ring-saffron` class uses plus 134 `saffron-deep`, against about 30 saffron references on the whole landing.

**Legacy [Observed].** `app/globals.css` still defines `--color-yarn-orange`, `--color-factory-green`, `--color-warning-amber`, `--color-risk-red`, `--color-info-blue` (older names for today's semantic colours; no `bg-/text-/border-` class in `app/` or `components/` uses them), and `design.md` describes the landing as "white/zinc/orange", which is out of date.

### Colour inventory (landing page)

| Colour | HEX | Source | Where / weight | Classification | Verdict |
|---|---|---|---|---|---|
| Ink / indigo text | #16213E | `--lp-ink` | ~95 text nodes, buttons, headings | Identity | **Survives** → `neel-900` |
| Body | #2B3246 | `--lp-body` | 99 text nodes | Support | Merged → `neel-700` |
| Muted | #535A6D | `--lp-muted` | 76 text nodes | Support | **Survives** → `neel-500` |
| Paper | #F4F2EC | `--lp-paper` | page background, secondary-button text | Identity | **Survives** → `cotton-100` |
| Paper-deep | #E9E6DD | `--lp-paper-deep` | 3 alternating bands, neutral callout | Support | **Survives** → `cotton-200` |
| Sheet | #FFFFFF | `--lp-sheet` | 7 surfaces (cost sheet, plan cards) | Support | **Survives** → `cotton-0` |
| Line | #D9D5CA | `--lp-line` | 34 borders, warp hairlines, range track | Support | **Survives** → `cotton-300` |
| Line-strong | #B5AFA1 | `--lp-line-strong` | 37 borders, dotted leaders, secondary button edge | Support | Survives as `cotton-400` (decorative); control edges move to new `cotton-500` |
| Loom | #101A33 | `--lp-loom` | paise band, closing CTA, footer | Identity | **Survives** → `neel-950` |
| Loom-raised | #18233F | `--lp-loom-raised` | hover on loom secondary button | Duplicate of Ink (ΔOKLab 0.008) | Merged → `neel-900` |
| Loom-line | #26314F | `--lp-loom-line` | warp hairlines on loom | Near-duplicate of #243258 / #2B3246 (ΔOKLab ≤0.034) | Merged → `neel-700` |
| On-loom | #EEF0F6 | `--lp-on-loom` | text on loom (24 nodes) | Support | **Survives** → `neel-50` (also equals callout bg #EEF0F7, ΔOKLab 0.001) |
| On-loom-muted | #A9B0C4 | `--lp-on-loom-muted` | muted text on loom (15 nodes) | Support | **Survives** → `neel-300` |
| Saffron | #E8762A | `--lp-saffron` | Eyebrow thread, slider thumbs, ₹ figure on loom, focus ring, underline hover | Identity — the accent | **Survives** → `saffron-500` (fills, threads, on-Loom only) |
| Saffron-ink | #A8430E | `--lp-saffron-ink` | 13 text nodes: labels, "Suggested price" | Identity (accessible form) | **Survives** → `saffron-700` |
| Good | #2F6B43 | `--lp-good` | declared, no consumer found in `components/landing/` | Functional | Survives → `moss-700` (same as app success) |
| Primary hover | #243258 | `.primary:hover` | 1 rule | Interaction | Merged → `neel-700` |
| Loom button border | #3A4668 | `.secondaryOnLoom` | 1 rule | One-off | Replaced by `neel-700`/`neel-600` |
| Callout red border | #A8361C | `.calloutRed` | policy pages | Near-duplicate of app risk #A6402D and saffron-ink #A8430E | Replaced by `madder-600` |
| Cost-stack rust | #A94713 | `COST_SEGMENTS` | warp yarn bar segment | Viz; duplicate of saffron-700 (ΔOKLab 0.009) | Merged → `saffron-700` |
| Cost-stack gold | #D9A441 | `COST_SEGMENTS` | weft yarn bar segment | Viz | Survives → `ochre-400` |
| Cost-stack indigo | #34487A | `COST_SEGMENTS` | weaving bar segment | Viz | Survives → `neel-600` |
| Cost-stack stone | #A39D8F | `COST_SEGMENTS` | overheads bar segment | Viz | Survives → `stone-400` |
| Navbar black | #000000 | `bg-black` in `header.tsx` | Protected navbar + policy legal bar | Marketing chrome ("the beam") | Kept for marketing; not an app colour |
| Navbar pill gradient | #F59E0B → #F97316 | `from-amber-500 to-orange-500` | "Start with Free" | Legacy Tailwind default oranges | Replace with flat `saffron-500` + Ink label when the navbar is next unlocked |
| Logo pixels | ≈#E8782A | `public/images/WeavlyLogo.png` (measured) | logo; shader comment says #EE7F2D | Identity | Confirms saffron-500 is the logo hue (ΔOKLab 0.005 from #E8762A, 0.022 from the app value #E27025) |
| Slate-300 text | #CBD5E1 | `text-slate-300` / `.legalLink` #C9CDD8 | mobile menu, legal links on black | Framework default | Use `neel-300` on black |

---

## C. Core brand palette

The brand is three primitive families. Steps are named by role-relevant position, not 50–950 for its own sake; gaps are deliberate.

### Neel (indigo): ink, action, bands

| Token | HEX | RGB | OKLCH | Role |
|---|---|---|---|---|
| `--wv-neel-50` | #EEF0F6 | 238, 240, 246 | oklch(0.955 0.008 271) | Selected/active fill, info-neutral callout, text on Loom. |
| `--wv-neel-200` | #C9D0E4 | 201, 208, 228 | oklch(0.858 0.029 270) | Border on Neel-50 surfaces. |
| `--wv-neel-300` | #A9B0C4 | 169, 176, 196 | oklch(0.758 0.030 270) | Muted text on Loom, on-dark secondary icons. |
| `--wv-neel-500` | #535A6D | 83, 90, 109 | oklch(0.469 0.032 269) | Secondary/muted text on light surfaces. |
| `--wv-neel-600` | #34487A | 52, 72, 122 | oklch(0.410 0.088 266) | Mid indigo: links in dense UI, chart series, selected-row marker, progress. Not a button fill. |
| `--wv-neel-700` | #28324D | 40, 50, 77 | oklch(0.321 0.050 268) | **Merged.** Body text; primary hover; hairlines and raised states on Loom. |
| `--wv-neel-900` | #16213E | 22, 33, 62 | oklch(0.254 0.057 267) | **Ink.** Headings, primary action fill, high-emphasis text, "raised" surface on Loom. |
| `--wv-neel-950` | #101A33 | 16, 26, 51 | oklch(0.223 0.051 266) | **Loom.** Dark bands, sidebar, closing CTA, inverse canvas. |

**Hue** 266–271 throughout; chroma rises from 0.008 (tints) to 0.088 (`neel-600`) so tints stay quiet and the mid indigo is the only one that reads as *blue*.
**Do not** use `neel-600` as a button fill (buttons are Ink) or as a hover colour; it is a link/chart/marker colour.

### Saffron: the thread

| Token | HEX | RGB | OKLCH | Role |
|---|---|---|---|---|
| `--wv-saffron-50` | #FCF1E7 | 252, 241, 231 | oklch(0.964 0.018 65) | Brand-soft surface (amber-style callouts, "highlighted" table row). |
| `--wv-saffron-200` | #F0CFB2 | 240, 207, 178 | oklch(0.875 0.054 63) | Brand-soft border only (does not carry text). |
| `--wv-saffron-500` | #E8762A | 232, 118, 42 | oklch(0.686 0.164 50) | **The thread.** Logo, display-size figures on Loom, threads/rules, focus ring on Loom, accent button fill (with Ink text). |
| `--wv-saffron-600` | #DA6912 | 218, 105, 18 | oklch(0.645 0.165 50) | **New.** Hover/pressed for the accent button fill. |
| `--wv-saffron-700` | #A8430E | 168, 67, 14 | oklch(0.513 0.145 43) | **Saffron ink.** Any saffron that must be read: labels, links-on-emphasis, focus ring on light, brand text. |

**Rules.**
- `saffron-500` is never body text, a border on inputs, or a light-mode focus ring (2.66:1).
- Any saffron **fill** carries an `neel-900` label (5.34:1), never white (2.98:1).
- Readable saffron is `saffron-700` (5.40:1 on canvas).
- Saffron is *never a status*. Success/warning/danger/info have their own hues.
- **Proposed change to the source colour:** the app's `#E27025` and the landing's `#E8762A` are one colour; canonical is `#E8762A` (closest to the logo, ΔOKLab 0.018 from the app value, so the change is invisible in practice). The navbar's `amber→orange` gradient is legacy.

---

## D. Neutral palette (Cotton)

| Token | HEX | RGB | OKLCH | Role |
|---|---|---|---|---|
| `--wv-cotton-0` | #FFFFFF | 255, 255, 255 | oklch(1.000 0.000 90) | Standard surface: cards, sheets, inputs, table body. The "paper the figures are printed on". |
| `--wv-cotton-100` | #F4F2EC | 244, 242, 236 | oklch(0.961 0.008 91) | Canvas: page background everywhere. (Landing `--lp-paper`.) |
| `--wv-cotton-200` | #E9E6DD | 233, 230, 221 | oklch(0.925 0.012 92) | Subtle fill / sunken band: table headers, zebra, sidebar-less panels, section alternates. (`--lp-paper-deep`.) |
| `--wv-cotton-300` | #D9D5CA | 217, 213, 202 | oklch(0.873 0.016 90) | Subtle border and divider, decorative rules.  Not for control edges. |
| `--wv-cotton-400` | #B5AFA1 | 181, 175, 161 | oklch(0.755 0.021 88) | Default card/panel edge, dotted leaders, disabled-control edge. Decorative, 1.95:1 on canvas. |
| `--wv-cotton-500` | #8A867C | 138, 134, 124 | oklch(0.621 0.015 89) | **New.** Control border (inputs, selects, checkboxes, secondary button). Clears 3:1 on canvas and white. |

Five surface-and-line steps plus one control edge. The landing had four; the fifth (`cotton-500`) exists because `cotton-400` fails 3:1 as a control border.
Cotton is warm but barely chromatic (C 0–0.016, hue 88–92): it reads as paper, not beige. The app's `#FFF8EA` cream (C 0.020) and sand hairlines (`#DED2BD`, C 0.031) are yellower and more saturated; that is the temperature shift a visitor feels at sign-in.

Text greys are **not** in Cotton. Text is indigo-tinted (`neel-900/700/500`) so type always reads as ink, not as grey.

---

## E. Semantic palette

Each status has four roles: **fg** (text/icon on light), **bg** (soft surface), **border**, **solid** (fill for chips/buttons).

| Token | HEX | RGB | OKLCH |
|---|---|---|---|
| `--wv-moss-50` | #E1F0E5 | 225, 240, 229 | oklch(0.941 0.022 154) |
| `--wv-moss-200` | #AED6B8 | 174, 214, 184 | oklch(0.839 0.059 153) |
| `--wv-moss-700` | #2F6B43 | 47, 107, 67 | oklch(0.476 0.090 152) |
| `--wv-ochre-50` | #F7E8C2 | 247, 232, 194 | oklch(0.933 0.052 89) |
| `--wv-ochre-200` | #E1C88E | 225, 200, 142 | oklch(0.840 0.080 87) |
| `--wv-ochre-400` | #D9A441 | 217, 164, 65 | oklch(0.751 0.130 80) |
| `--wv-ochre-800` | #755900 | 117, 89, 0 | oklch(0.480 0.098 87) |
| `--wv-madder-50` | #FFE6E6 | 255, 230, 230 | oklch(0.945 0.027 18) |
| `--wv-madder-200` | #EFBBBD | 239, 187, 189 | oklch(0.839 0.060 16) |
| `--wv-madder-600` | #AC1637 | 172, 22, 55 | oklch(0.481 0.180 17) |
| `--wv-lagoon-50` | #DDEAF0 | 221, 234, 240 | oklch(0.929 0.016 227) |
| `--wv-lagoon-200` | #B4CFE2 | 180, 207, 226 | oklch(0.841 0.039 239) |
| `--wv-lagoon-700` | #315C78 | 49, 92, 120 | oklch(0.456 0.066 239) |

| Status | fg | bg | border | solid | Label rule |
|---|---|---|---|---|---|
| Success — moss | `moss-700` | `moss-50` | `moss-200` | `moss-700` + white label (6.35:1) | icon ✓ or word "Paid / Done" |
| Warning — ochre | `ochre-800` | `ochre-50` | `ochre-200` | `ochre-400` + **Ink** label (7.07:1) | icon ⚠︎ or word "Due / Check" |
| Danger — madder | `madder-600` | `madder-50` | `madder-200` | `madder-600` + white label (7.18:1) | icon ✕ / ! or word "Overdue / Failed" |
| Info — lagoon | `lagoon-700` | `lagoon-50` | `lagoon-200` | `lagoon-700` + white label (7.16:1) | icon ⓘ or word "Sent / In progress" |

**Why these hues [Proposed, with evidence].**
- **Moss** and **lagoon** are the app's existing success `#2F6B43` and info `#315C78`, kept unchanged: they already read as Weavly and harmonise with indigo. Soft surfaces are the app's existing `#E1F0E5` and `#DDEAF0`.
- **Ochre** replaces `#B87908` (hue 72°, 3.25:1 on canvas, and only 0.089 OKLab from saffron-500). New text colour is `#755900` (hue 87°, 5.89:1), pushed toward olive so it can't be read as orange. Its fill reuses the landing's cost-stack gold `#D9A441`, which is already in the design.
- **Madder** replaces `#A6402D` (hue 33°, effectively identical to saffron-700). Hue moves to 17°, chroma rises, distance to saffron-700 goes 0.027 → 0.086. Named for madder dye: a real textile red.
- Distinguishability check (OKLab distance between solids): moss↔lagoon 0.111, ochre-fg↔saffron-700 0.107, madder↔saffron-700 0.086, ochre-400↔saffron-500 0.106. Nothing is under 0.08 except the *old* risk/saffron pair, which this proposal removes.
- **Colour is never the only carrier**: every status pairs the hue with an icon *and* a word (this is already how `StatusBadge` works).

---

## F. Interaction colours

The rule: **structure is indigo, meaning is hue, saffron is a thread.** Primary actions are Ink, not saffron.

| Role | Fill / colour | Label / edge | Notes |
|---|---|---|---|
| Primary | `neel-900` | label `cotton-100` (14.2:1) | Save, Create, Sign in. Matches landing `.primary` and CLAUDE.md "structural actions use dark ink". |
| Primary hover / active | `neel-700` / `neel-950` | same label | Hover merges the three near-identical mid-indigos. |
| Secondary | `cotton-0` | edge `cotton-500`, label `neel-900` | Hover: edge → `neel-900`. Control edge passes 3:1 (3.63:1 on white). |
| Subtle / ghost | transparent | label `neel-700` | Hover: fill `cotton-200`. |
| Accent (rare) | `saffron-500` | label `neel-900` (5.34:1) | One per screen at most (e.g. "Start free" on marketing, upgrade prompt). Hover `saffron-600` (4.55:1). |
| Destructive | `madder-600` | label white (7.18:1) | Confirmation dialogs; never for "Cancel". |
| Link | `neel-900`, semibold, underlined in `cotton-400` | hover underline → `saffron-500` | Dense UI may use `neel-600` (8.92:1). Underline is the non-colour cue. |
| Selected (page level) | fill `neel-50`, text `neel-900`, 2px `saffron-500` marker | | Tabs, table rows, options. Marker + fill + weight, so colour is not the sole cue. |
| Selected (on Loom) | fill `neel-900`/`neel-700`, text `neel-50`, 2px `saffron-500` marker | | Replaces the current filled `saffron-deep` nav pill. |
| Focus | 2px `saffron-700`, 2px offset (on light); `saffron-500` (on Loom) | | 5.40:1 and 5.80:1. Keeps saffron in the focus ring without failing 3:1. |
| Disabled | fill `cotton-200`, text `#8A8F9C`, edge `cotton-400` | | Exempt from contrast; must also be unclickable/aria-disabled. |
| Loading / progress | `neel-600` track fill on `cotton-300` | | |

---

## G. Data visualisation

Weavly has **no chart library today** (no recharts/chart.js/d3; the only visualisation I found is the landing cost-stack bar). So this is deliberately small.

| Token | HEX | RGB | OKLCH |
|---|---|---|---|
| `--wv-neel-600` | #34487A | 52, 72, 122 | oklch(0.410 0.088 266) |
| `--wv-ochre-400` | #D9A441 | 217, 164, 65 | oklch(0.751 0.130 80) |
| `--wv-saffron-700` | #A8430E | 168, 67, 14 | oklch(0.513 0.145 43) |
| `--wv-stone-400` | #A39D8F | 163, 157, 143 | oklch(0.697 0.021 88) |
| `--wv-viz-teal` | #29706C | 41, 112, 108 | oklch(0.500 0.070 190) |

- **Categorical (max 5):** `neel-600`, `ochre-400`, `saffron-700`, `stone-400`, then `viz-teal` only when a fifth series is unavoidable. The first four are the colours already on the landing cost-stack.
- **Highlight one series:** `saffron-500` for the focus series, everything else `stone-400`.
- **Sequential:** `neel-50 → neel-200 → neel-300 → neel-600 → neel-900` (single hue, lightness only).
- **Positive/negative change:** `moss-700` / `madder-600` **with** ▲/▼ and a signed number.
- **Accessibility:** `ochre-400` (2.2:1 on white) and `stone-400` (2.7:1) do not pass 3:1 as a sole encoding. Rule: segments need a legend with values and 2px gaps (the landing already does this); never rely on adjacent-colour discrimination alone.

---

## H. Surface hierarchy

| Level | Token | Value | Used for |
|---|---|---|---|
| Canvas | `--wv-bg-canvas` | `cotton-100` #F4F2EC | The page, everywhere |
| Standard | `--wv-bg-surface` | `cotton-0` #FFFFFF | The one primary surface per workflow (cards, tables, forms, dialogs) |
| Subtle | `--wv-bg-subtle` | `cotton-200` #E9E6DD | Sunken: table header, zebra, alternating bands, disabled fill |
| Selected | `--wv-bg-selected` | `neel-50` #EEF0F6 | Selected row/tab/option |
| Brand-soft | `--wv-bg-brand-soft` | `saffron-50` #FCF1E7 | Rare highlight |
| Inverse | `--wv-bg-inverse` | `neel-950` #101A33 | Loom: sidebar, dark bands, closing CTA |
| Inverse-raised | `--wv-bg-inverse-raised` | `neel-900` #16213E | Cards on Loom |

Elevation is edge and shadow, not tint: `shadow-sm` is `0 1px 0 rgba(22,33,62,.04), 0 18px 40px -24px rgba(22,33,62,.3)` (landing `.sheet`, indigo-tinted so shadows share the ink hue). Surface-to-surface separation is 1.02–1.18:1 by design; the border carries the boundary (see J).

## I. Typography colour hierarchy

| Role | Token | Value | On canvas | On white |
|---|---|---|---|---|
| Primary | `--wv-text-primary` | `neel-900` | 14.20 | 15.89 |
| Body | `--wv-text-body` | `neel-700` #28324D | 11.34 | 12.70 |
| Secondary / muted | `--wv-text-secondary` | `neel-500` | 6.15 | 6.88 |
| Disabled | `--wv-text-disabled` | #8A8F9C | 2.89 | 3.24 (exempt) |
| Inverse | `--wv-text-inverse` | `neel-50` | on Loom 15.14 | |
| Inverse secondary | `--wv-text-inverse-secondary` | `neel-300` | on Loom 7.96 | |
| Link | `--wv-text-link` | `neel-900` + underline | 14.20 | |
| Brand / highlight | `--wv-text-brand` | `saffron-700` | 5.40 | 6.04 |
| Brand on Loom | `--wv-text-brand-on-inverse` | `saffron-500` | on Loom 5.80 | |

Highlighted text in prose is `saffron-700` semibold, or an underline in `saffron-500`. Never a saffron-500 word on a light surface.

## J. Border hierarchy

| Level | Token | Value | Use |
|---|---|---|---|
| Subtle | `--wv-border-subtle` | `cotton-300` | Dividers, table rules, warp hairlines |
| Default | `--wv-border-default` | `cotton-400` | Card and panel edges, dotted leaders |
| Control | `--wv-border-control` | `cotton-500` (3.24 / 3.63) | Inputs, selects, checkboxes, secondary buttons |
| Strong / interactive | `--wv-border-strong` | `neel-900` | Control hover, table-head rule |
| Inverse | `--wv-border-inverse` | `neel-700` | Hairlines on Loom |
| Focus | `--wv-border-focus` | `saffron-700` (light) / `saffron-500` (Loom) | Focus ring |
| Semantic | `--wv-status-*-border` | `moss/ochre/madder/lagoon-200` | Alerts, badges |

Card edges (`cotton-400`, 1.95:1) may be low-contrast because they are not the only cue that a card exists (white on canvas plus shadow); **control** edges may not.

---

## K. Token architecture

Two layers, both CSS custom properties, prefix `--wv-` so they can coexist with the three existing vocabularies during migration:

1. **Primitives** (raw, never used in components): `--wv-cotton-*`, `--wv-neel-*`, `--wv-saffron-*`, `--wv-moss-*`, `--wv-ochre-*`, `--wv-madder-*`, `--wv-lagoon-*`, `--wv-stone-400`.
2. **Semantic** (used everywhere): `--wv-bg-*`, `--wv-text-*`, `--wv-border-*`, `--wv-action-*`, `--wv-brand-*`, `--wv-status-*-{fg,bg,border,solid}`, `--wv-viz-*`.

Components and shadcn shims consume only the semantic layer. Dark mode, if ever needed, is a second set of semantic values over the same primitives; today the Loom is the only dark surface and `.dark` is defined in `globals.css` but I found no theme provider that applies it.

| Semantic token | Resolves to | Use |
|---|---|---|
| **Canvas / surfaces** | | |
| `--wv-bg-canvas` | `cotton-100` #F4F2EC | Page background (all surfaces incl. app) |
| `--wv-bg-surface` | `cotton-0` #FFFFFF | Cards, sheets, inputs, table body, dialogs |
| `--wv-bg-subtle` | `cotton-200` #E9E6DD | Sunken bands, table header, zebra, disabled control fill |
| `--wv-bg-selected` | `neel-50` #EEF0F6 | Selected row/tab/option, info-neutral panel |
| `--wv-bg-brand-soft` | `saffron-50` #FCF1E7 | Highlighted row, brand callout |
| `--wv-bg-inverse` | `neel-950` #101A33 | Loom: sidebar, dark bands |
| `--wv-bg-inverse-raised` | `neel-900` #16213E | Cards on Loom, hover on Loom rows |
| **Text** | | |
| `--wv-text-primary` | `neel-900` #16213E | Headings, key figures, labels |
| `--wv-text-body` | `neel-700` #28324D | Paragraphs and table cells |
| `--wv-text-secondary` | `neel-500` #535A6D | Helper text, metadata, column headers |
| `--wv-text-disabled` | `disabled` #8A8F9C | Disabled controls only |
| `--wv-text-inverse` | `neel-50` #EEF0F6 | Text on Loom |
| `--wv-text-inverse-secondary` | `neel-300` #A9B0C4 | Secondary text on Loom |
| `--wv-text-brand` | `saffron-700` #A8430E | Eyebrows, brand labels, "suggested" figures on light |
| `--wv-text-brand-on-inverse` | `saffron-500` #E8762A | Display figures on Loom |
| `--wv-text-link` | `neel-900` #16213E | Links (underlined; hover underline turns saffron-500) |
| `--wv-text-on-action` | `cotton-100` #F4F2EC | Label on primary fill |
| `--wv-text-on-accent` | `neel-900` #16213E | Label on saffron fill |
| **Border** | | |
| `--wv-border-subtle` | `cotton-300` #D9D5CA | Dividers, hairlines, table rules |
| `--wv-border-default` | `cotton-400` #B5AFA1 | Card and panel edges, dotted leaders |
| `--wv-border-control` | `cotton-500` #8A867C | Inputs, selects, checkboxes, secondary button |
| `--wv-border-strong` | `neel-900` #16213E | Hover/active control edge, table head rule |
| `--wv-border-inverse` | `neel-700` #28324D | Hairlines on Loom |
| `--wv-border-focus` | `saffron-700` #A8430E | Focus ring on light surfaces |
| `--wv-border-focus-inverse` | `saffron-500` #E8762A | Focus ring on Loom |
| **Action** | | |
| `--wv-action-primary` | `neel-900` #16213E | Primary fill |
| `--wv-action-primary-hover` | `neel-700` #28324D | Primary hover |
| `--wv-action-primary-active` | `neel-950` #101A33 | Primary pressed |
| `--wv-action-accent` | `saffron-500` #E8762A | Accent CTA fill (rare: one per screen at most) |
| `--wv-action-accent-hover` | `saffron-600` #DA6912 | Accent hover/pressed |
| `--wv-action-destructive` | `madder-600` #AC1637 | Destructive fill (+ Ink-free white label) |
| `--wv-action-selected-marker` | `saffron-500` #E8762A | 2px selection thread (nav, tab underline) |
| **Brand** | | |
| `--wv-brand-accent` | `saffron-500` #E8762A | Logo, thread, decorative |
| `--wv-brand-accent-strong` | `saffron-700` #A8430E | Readable brand |
| `--wv-brand-ink` | `neel-900` #16213E | Brand dark |
| `--wv-brand-loom` | `neel-950` #101A33 | Brand dark surface |
| **Status (× success | warning | danger | info)** | | |
| `--wv-status-success-{fg,bg,border,solid}` | moss-700 / moss-50 / moss-200 / moss-700 |  |
| `--wv-status-warning-{fg,bg,border,solid}` | ochre-800 / ochre-50 / ochre-200 / ochre-400 (Ink label) |  |
| `--wv-status-danger-{fg,bg,border,solid}` | madder-600 / madder-50 / madder-200 / madder-600 |  |
| `--wv-status-info-{fg,bg,border,solid}` | lagoon-700 / lagoon-50 / lagoon-200 / lagoon-700 |  |
| **Data** | | |
| `--wv-viz-1 … 5` | neel-600, ochre-400, saffron-700, stone-400, + teal (proposed) | Categorical, in order |
| `--wv-viz-highlight / --wv-viz-muted` | saffron-500 / stone-400 | Single-series emphasis |

**Mapping from today's vocabularies** (for the migration phase):

| Old (`--lp-*`) | → | Old (`--weavly-*` / shadcn) | → |
|---|---|---|---|
| `--lp-paper` | `--wv-bg-canvas` | `--weavly-app-bg` / `--background` | `--wv-bg-canvas` (colour changes: cream → paper) |
| `--lp-sheet` | `--wv-bg-surface` | `--weavly-surface` / `--card` | `--wv-bg-surface` |
| `--lp-paper-deep` | `--wv-bg-subtle` | `--weavly-surface-soft`, `--secondary`, `--muted` | `--wv-bg-subtle` |
| `--lp-ink` | `--wv-text-primary` | `--weavly-ink`, `--foreground` | `--wv-text-primary` |
| `--lp-body` | `--wv-text-body` | `--weavly-body` | `--wv-text-body` |
| `--lp-muted` | `--wv-text-secondary` | `--weavly-muted`, `--muted-foreground`, `--weavly-subtle` | `--wv-text-secondary` |
| `--lp-line` | `--wv-border-subtle` | `--weavly-hairline`, `--border` | `--wv-border-subtle` / `-default` |
| `--lp-line-strong` | `--wv-border-default` | `--weavly-hairline-strong`, `--input` | `--wv-border-control` |
| `--lp-loom` | `--wv-bg-inverse` | `--weavly-loom-navy`, `#111111` sidebar | `--wv-bg-inverse` |
| `--lp-saffron` | `--wv-brand-accent` | `--weavly-saffron`, `--brand-accent`, `--ring` | `--wv-brand-accent` (ring → `--wv-border-focus`) |
| `--lp-saffron-ink` | `--wv-text-brand` | `--weavly-saffron-deep`, `--accent-foreground` | `--wv-brand-accent-strong` |
| `--lp-on-loom`, `-muted` | `--wv-text-inverse`, `-secondary` | `--weavly-risk`, `--destructive` | `--wv-status-danger-fg` |

---

## L. Marketing → product: how the palette behaves

The same three primitives appear everywhere; what changes is **how much saffron and how much Loom.**

| Surface | Canvas | Loom (dark) | Saffron | Status hues | Notes |
|---|---|---|---|---|---|
| **Marketing** | paper, alternating `cotton-200` bands | 2–3 full-width bands | Expressive but still a thread: eyebrows, one display figure, thumbs, the accent CTA | Rare | Black navbar remains the "beam". |
| **Auth** (the bridge) | paper | Optional loom panel beside the form at ≥1024px | One eyebrow thread + focus ring | Errors only | Same white "sheet" card as the landing cost sheet; Ink primary button; no blur blobs. This is the screen that must feel identical in temperature to `/`. |
| **Onboarding** | paper | Loom header/progress band | Step marker (2px thread) and the finish screen may use the accent CTA | Validation + completion | Brand-forward, but forms remain white sheets with `cotton-500` control edges. |
| **Core app** | paper | Sidebar only (Loom, replacing `#111111`) | ≤2 uses per screen: selected-nav marker, focus ring; optional accent CTA for upgrade | Badges and alerts | White surface on paper; Ink actions; page header unchanged. |
| **Dense data** (tables, payroll, stock, production) | paper + white | Sidebar only | Focus ring only | Status badges with icon+word; semantic fg on soft bg | Effectively monochrome indigo-on-cotton; colour is reserved for state. |

What carries through unchanged: the paper, the indigo ink, the Ink primary button, the saffron thread as the only accent, and the ₹/figure typography (mono). What gets quieter: saffron area, Loom area, type scale, motion.

## M. Application mapping (conceptual)

| Surface | Mapping |
|---|---|
| Landing page | Unchanged except: secondary-button/control edges `cotton-400 → cotton-500`, focus ring `saffron-500 → saffron-700` on light, navbar pill flat saffron with Ink label, `#243258/#26314F/#3A4668` → `neel-700`. |
| Sign-in | Canvas paper; white card `cotton-400` edge; inputs `cotton-500` edge; Ink "Sign in"; "Sign up"/"Forgot" as underlined `neel-900` links; drop the blur blobs and the cream. |
| Signup | Same card; terms checkbox edge `cotton-500`; disabled "Create factory" = `cotton-200` fill / `#8A8F9C` text (currently grey-on-grey). |
| Onboarding | Loom progress band, saffron 2px marker on the current step, moss ✓ on completed steps; step cards are white sheets. |
| Sidebar | `neel-950`; item text `neel-300`, hover fill `neel-900`; selected fill `neel-700` + text `neel-50` + 2px `saffron-500` marker (replaces the filled `saffron-deep` pill); factory chip `neel-900`. |
| App shell | Canvas paper; no blobs; header `text-primary`, subtitle `text-secondary`; page-level primary action Ink. |
| Forms | White surface; label `text-primary`; helper `text-secondary`; control edge `cotton-500`; focus `saffron-700` ring; error: `madder-600` text + edge + icon. |
| Cards | `cotton-0`, `cotton-400` edge, sheet shadow; one per workflow. |
| Tables | Header `cotton-200` with `text-secondary` uppercase; rows `cotton-0`, rules `cotton-300`; row hover `cotton-100`; selected `neel-50` + marker; numerics mono `text-primary`. |
| Modals | `cotton-0` on Ink-at-40% scrim; title `text-primary`; footer: Secondary + Primary (or Destructive). |
| Badges | `status-*-bg` fill, `status-*-fg` text, icon + word; neutral badge `cotton-200`/`text-body`. Draft = neutral; Inactive = neutral with strike-free "Inactive" word. |
| Notifications / toasts | `cotton-0` surface, 3px left edge in the status hue, icon in `status-*-fg`. |
| Destructive confirm | Title states the object; body in `text-body`; **Destructive** button `madder-600` + white label; Cancel is Secondary, focused first. |

Product-state vocabulary: **Paid** moss ✓ · **Unpaid/Due soon** ochre clock · **Overdue** madder · **Completed** moss ✓ · **In progress** lagoon · **Draft** neutral · **Active** moss dot+word · **Inactive** neutral · **Available** moss · **Unavailable** neutral (not madder: absence isn't an error) · **Positive change** moss ▲ · **Negative change** madder ▼.

---

## N. Accessibility matrix

Ratios computed in sRGB per WCAG 2.x (computed by a throwaway script that is not committed; the tables in this document and the specimen are generated from the same token data, not hand-typed).

### Text

| Pairing | Foreground | Background | Ratio | AA (4.5) | Intended use | Note |
|---|---|---|---|---|---|---|
| Primary text | #16213E | #F4F2EC | 14.20:1 | ✅ AA | Body/heading on canvas |  |
| Primary text on surface | #16213E | #FFFFFF | 15.89:1 | ✅ AA | Cards, tables |  |
| Body text | #28324D | #F4F2EC | 11.34:1 | ✅ AA | Paragraphs |  |
| Body text on subtle | #28324D | #E9E6DD | 10.18:1 | ✅ AA | Table headers |  |
| Secondary text | #535A6D | #F4F2EC | 6.15:1 | ✅ AA | Helper text, metadata |  |
| Secondary text on subtle | #535A6D | #E9E6DD | 5.52:1 | ✅ AA | Metadata in sunken bands |  |
| Disabled text (exempt) | #8A8F9C | #FFFFFF | 3.24:1 | ⚠️ large/UI only | Disabled controls | WCAG exempts disabled UI |
| Saffron-500 as text | #E8762A | #F4F2EC | 2.66:1 | ❌ fail | — | Use saffron-700 |
| Saffron-700 as text | #A8430E | #F4F2EC | 5.40:1 | ✅ AA | Eyebrows, labels, brand text |  |
| Saffron-700 on brand-soft | #A8430E | #FCF1E7 | 5.43:1 | ✅ AA | Highlighted callout |  |
| Saffron-700 on saffron-200 | #A8430E | #F0CFB2 | 4.11:1 | ⚠️ large/UI only | — | Do not put text on saffron-200 |
| Primary button label | #F4F2EC | #16213E | 14.20:1 | ✅ AA | Primary action |  |
| Primary hover label | #F4F2EC | #28324D | 11.34:1 | ✅ AA | Primary hover |  |
| Accent button label (Ink on saffron) | #16213E | #E8762A | 5.34:1 | ✅ AA | Accent CTA |  |
| Accent hover label | #16213E | #DA6912 | 4.55:1 | ✅ AA | Accent hover |  |
| White on saffron-500 (current app `saffron` variant) | #FFFFFF | #E8762A | 2.98:1 | ❌ fail | — | Replace with Ink label |
| White on saffron-700 | #FFFFFF | #A8430E | 6.04:1 | ✅ AA | Strong brand fill (e.g. selected count) |  |
| Text on Loom | #EEF0F6 | #101A33 | 15.14:1 | ✅ AA | Bands, sidebar |  |
| Muted text on Loom | #A9B0C4 | #101A33 | 7.96:1 | ✅ AA | Bands, sidebar secondary |  |
| Saffron-500 on Loom (figures/thread) | #E8762A | #101A33 | 5.80:1 | ✅ AA | Display figure, thread, focus |  |
| Text on Loom-raised | #EEF0F6 | #16213E | 13.95:1 | ✅ AA | Cards on Loom |  |
| Link/selected indigo on white | #34487A | #FFFFFF | 8.92:1 | ✅ AA | Dense-UI links |  |
| Text on selected fill | #16213E | #EEF0F6 | 13.95:1 | ✅ AA | Selected row/tab |  |
| Success text on soft | #2F6B43 | #E1F0E5 | 5.38:1 | ✅ AA | Paid, Completed |  |
| Warning text on soft | #755900 | #F7E8C2 | 5.42:1 | ✅ AA | Due soon, Draft-attention |  |
| Danger text on soft | #AC1637 | #FFE6E6 | 6.06:1 | ✅ AA | Overdue, Failed |  |
| Info text on soft | #315C78 | #DDEAF0 | 5.83:1 | ✅ AA | Sent, In progress |  |
| Danger on canvas | #AC1637 | #F4F2EC | 6.42:1 | ✅ AA | Inline error text |  |
| White on danger fill | #FFFFFF | #AC1637 | 7.18:1 | ✅ AA | Destructive button |  |
| White on success fill | #FFFFFF | #2F6B43 | 6.35:1 | ✅ AA | Solid success chip |  |
| Ink on warning fill | #16213E | #D9A441 | 7.07:1 | ✅ AA | Solid warning chip |  |
| Old app warning #B87908 on canvas | #B87908 | #F4F2EC | 3.25:1 | ⚠️ large/UI only | — | Replace with ochre-800 |
| Old app risk vs saffron-deep | #A6402D | #A94713 | 1.06:1 | ❌ fail | — | Colour identity collision |

### Non-text

| Pairing | Colour | Against | Ratio | ≥3:1 |
|---|---|---|---|---|
| Control border on canvas | #8A867C | #F4F2EC | 3.24:1 | ✅ |
| Control border on white | #8A867C | #FFFFFF | 3.63:1 | ✅ |
| Old line-strong on canvas (current landing) | #B5AFA1 | #F4F2EC | 1.95:1 | ❌ |
| Focus ring (saffron-700) on canvas | #A8430E | #F4F2EC | 5.40:1 | ✅ |
| Focus ring (saffron-700) on white | #A8430E | #FFFFFF | 6.04:1 | ✅ |
| Focus ring (saffron-500) on Loom | #E8762A | #101A33 | 5.80:1 | ✅ |
| Focus ring (saffron-500) on canvas (current landing) | #E8762A | #F4F2EC | 2.66:1 | ❌ |
| Saffron thread on canvas (decorative) | #E8762A | #F4F2EC | 2.66:1 | n/a (decorative or relational; needs a non-colour cue) |
| Selected fill vs canvas | #EEF0F6 | #F4F2EC | 1.02:1 | n/a (decorative or relational; needs a non-colour cue) |
| Loom vs Ink (raised card) | #101A33 | #16213E | 1.09:1 | n/a (decorative or relational; needs a non-colour cue) |

**Reading it.** Fails in the *current* system that this proposal fixes: saffron-500 as text (2.66) and as light-mode focus ring (2.66), white on saffron-500 (2.98, the app's `saffron` button variant, used in 6 places, and `bg-saffron … text-white` in ~18 places), warning `#B87908` on canvas (3.25), control edge `#B5AFA1` (1.95), and risk-vs-saffron collision (1.06). Everything in the *proposed* text matrix passes 4.5:1 except the disabled colour (exempt) and `saffron-700` on `saffron-200`, which is documented as "no text here".

---

## O. Migration observations (for a later phase; nothing changed)

I audited the app by **source and static render only**: `/login` and `/signup` were rendered; authenticated screens were **not** rendered because that requires signing in to the shared QA Supabase, which I did not do. Counts below are greps over `app/` and `components/`, excluding `landing/`, `intro/`, `policies/`.

| # | Category | Evidence | Migration action |
|---|---|---|---|
| 1 | **Three token vocabularies + a legacy fourth.** shadcn (`--primary`…), `--weavly-*`, `--color-*` legacy (`--color-yarn-orange`…), and `--lp-*` on the landing. `globals.css` defines `--color-canvas`/`--color-primary` in both `@theme` and `:root`. | `app/globals.css` 18–254 | Introduce `--wv-*`; re-point shadcn and `--weavly-*` at it; delete unused legacy tokens (no class uses them). |
| 2 | **Raw Tailwind palette bypassing tokens.** ≈1,945 utility uses across 75 files: amber 500, stone 499, slate 234, emerald 166, red 139, gray 118, zinc 81, rose 80, indigo 51, blue 30, orange 27. | Top files: `FactoryCostWizard.tsx` (92), `EstimatorClient.tsx` (79), `base/Step6Review.tsx` (56), `AuditTable.tsx` (51), `signup/page.tsx` (40), `CostingExportDialog.tsx` (38) | Map stone/gray/slate/zinc → cotton/neel roles; amber → ochre (status) or saffron (brand) case by case; emerald → moss; red/rose → madder; blue/indigo → lagoon/neel. |
| 3 | **A CSS band-aid for #2.** `globals.css` ~310–330 force-recolours `text-slate/gray/zinc-300…500` to `--color-muted`. | `app/globals.css` | Remove once #2 is done. |
| 4 | **Saffron in the wrong role.** Filled `saffron-deep` selected nav pill; `saffron` button variant with white text; 203 `saffron` + 134 `saffron-deep` class uses; saffron-tinted hover on every nav row; blur blob backgrounds `#f97316→#c2410c`. | `owner-sidebar.tsx`, `button.tsx`, `brand-background.tsx` | Apply saffron rules in C/F; delete blobs. |
| 5 | **Danger/brand collision.** `--weavly-risk` `#A6402D` vs `--weavly-saffron-deep` `#A94713`; 11 files use both `risk` and `saffron-deep` together. | tokens + usage grep | Move to `madder-600`; audit the 11 files for adjacency. |
| 6 | **Warning too close to brand.** `#B87908` (3.25:1) vs saffron. | tokens | → `ochre-800` / `ochre-400`. |
| 7 | **Cream canvas ≠ landing paper.** `#FFF8EA` (app), `#FFFDF7` canvas, sand hairlines `#DED2BD/#CBB894`; also PWA `theme_color`/`background_color` `#FFF8EA` in `app/manifest.ts` and `app/layout.tsx`. | tokens + manifest | → `cotton-100`; update manifest/theme colour with it (PWA installs cache the old value). |
| 8 | **Ink hue split.** App ink `#1E2528` (green-grey, hue 226), loom navy `#18252E` (hue 239), sidebar `#111111` (neutral) vs landing indigo (hue 266). | tokens + sidebar | → `neel-*`. Sidebar → `neel-950`. |
| 9 | **Hard-coded hex.** 40+ distinct values in TSX/TS, notably `#CDE5D3` ×16, `#64748B` ×10, `#111111` ×7, `#FFF8EA` ×6, `#F97316` ×6, plus slate/blue/green tints. | grep | Replace with semantic tokens; PDF/export colours (`lib/`) need a separate decision because they render outside CSS. |
| 10 | **Dark-mode scaffolding without a consumer.** `.dark` block in `globals.css`, `dark:` in 34 files, no theme provider found. | grep | Decide: drop, or later add a second semantic set. |
| 11 | **Source-contract tests.** Over half of `__tests__/` asserts on class names and copy, so recolouring will break tests deliberately. | CLAUDE.md, `__tests__/` | Update contracts in the same PR as each surface; search `__tests__/` for the token/class first. |
| 12 | **Guided tours** anchor to DOM targets; changing nav markup (e.g. selected marker) can break them. | `lib/tours` | Only recolour, don't restructure, in the nav pass. |

---

## P. Verification log

| Check | Result |
|---|---|
| Landing rendered in browser | ✅ 1280×800 and 1280×5200 full page |
| Computed DOM colours vs source | ✅ every computed colour on `/` traced to an `--lp-*` token, the cost-stack constants, the black navbar, or Tailwind defaults in the header |
| Logo colour | ✅ measured from PNG pixels (≈#E8782A) |
| `/login`, `/signup` rendered | ✅ (cream + blobs confirmed) |
| Authenticated screens | ⛔ **not rendered**. Source and grep only (needs QA sign-in) |
| Hover / focus / active | ⛔ **not observed live**. Read from CSS |
| Mobile | ⛔ not re-rendered here; previously verified at 390×844 per `docs/landing-page-redesign.md` |
| Contrast, OKLCH | ✅ computed (sRGB WCAG 2.x; OKLab per Ottosson) |
| Proposed status hues distinguishable | ✅ pairwise OKLab distances in E |
| Proposed tokens in app | ⛔ none applied; no app files modified |
| Specimen | ✅ static, opened and checked in the browser |

Two things the specimen and doc do **not** prove: how the proposal looks at real information density (I mocked one table), and the effect on the PDF exports.
