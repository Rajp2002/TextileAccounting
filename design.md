# Weavly Design Reference

This document captures the current product design language so future UI work can stay consistent across the app. It reflects the implementation in `app/globals.css`, shared `components/ui/*`, dashboard layouts, auth screens, and the public landing page.

## Product Feel

Weavly is an operational factory OS for grey fabric weaving units. The UI should feel practical, warm, dense, and trustworthy. Prioritize fast scanning, low-friction data entry, and clear operational status over decorative presentation.

The product has three related surfaces:

- **Dashboard/PWA:** warm textile-ledger palette, dense cards, persistent navigation, touch-friendly mobile controls.
- **Auth:** same warm brand system, centered panel, calm onboarding/login flow.
- **Landing:** sharper marketing contrast with white/zinc/orange, bold editorial type, and product mockups.

## Global Design Principles

This core framework governs all visual and interaction design across Weavly. The goal is not to add more UI, but to create a system that feels intentional, restrained, and recognizable as Weavly.

1. **Brand Character: Warm Industrial**: Warm cream + charcoal/loom navy + saffron + quiet industrial structure. Avoid becoming generic white + gray + blue SaaS.
2. **Content Must Dominate the Background**: Content and workflows come first; controls second; branded background canvas atmosphere third. Use opaque surfaces (`bg-surface`) to calm dense data.
3. **Use One Primary Surface Per Workflow**: Avoid excessive cardization (`card > card > card > badge`). Toolbar + register + list live in one unified container.
4. **Typography Before Decoration**: Establish hierarchy through font size, weight, spacing, and alignment before reaching for badges, borders, or shadows.
5. **Saffron Is Precious**: Saffron is our strongest brand signal. Reserve it for brand anchors, selected indicators, and meaningful accents. Never use it everywhere.
6. **Structural Actions Use Dark Navy**: Primary operational CTAs (`+ Add worker`, `+ Add machine`, `Save costing`, `Create dispatch`) use dark ink/navy (`loom`/`ink`), keeping saffron special.
7. **Minimize Filled Badges**: Use plain typography (`Rapier`, `Day shift`, `Piece rate`) unless strong status or categorization is strictly needed.
8. **Shadows Should Be Almost Invisible**: Rely on hairline borders (`border-hairline`) and very soft ambient shadows (`shadow-xs`). No dramatic drop shadows or glowing cards.
9. **Standardize Radius**: Controls: `8px` (`rounded-lg`/`rounded-md`), Primary panels: `12–14px` (`rounded-xl`/`rounded-2xl`), Pills: `full` (`rounded-full`).
10. **Standardize Control Height**: `40–44px` on desktop (`h-10`/`h-11`), `44px` minimum mobile touch target.
11. **Standardize Spacing**: Use the fixed scale: `4, 8, 12, 16, 24, 32, 48px`. Avoid arbitrary values. Standard relationship: Title → `4px` → Subtitle → `24px` → Primary surface.
12. **Keep Page Headers Consistent**: `Page title + short explanation` on the left, `Primary dark action` on the right.
13. **Avoid Dashboardification**: No unnecessary KPI cards just to fill empty space. Only show metrics that directly advance the page's workflow.
14. **Operational Pages Should Be Dense but Calm**: Prioritize fast scanning, predictable columns, familiar control placement, and visible actions over airy decorative trends.
15. **Explicit Actions Beat Mystery Interactions**: Show explicit action buttons (`Edit`, `View`); do not rely on whole-row clicks or hover discoveries.
16. **Avoid Unnecessary `...` Menus**: Don't hide 1 or 2 obvious actions behind overflow menus purely for aesthetics.
17. **Use Icons as Anchors, Not Decoration**: Icons assist recognition; avoid multiple icons per row or illustrations everywhere.
18. **Controls Must Never Look Browser-Native**: Shared styled inputs, custom selects, checkboxes, and radio buttons across all browsers.
19. **Build Shared Primitives, Not Giant Abstractions**: Reusable focused primitives (`PageHeader`, `PrimaryButton`, `SearchInput`, `FilterSelect`, `RegisterSurface`, `EmptyState`, `SkeletonRow`). Keep domain behavior local.
20. **Every Surface Needs Complete States**: Design `loading`, `loaded`, `empty`, `no-results`, and `error` states for every data-driven view.
21. **Responsive Means Recompose, Not Shrink**: Rearrange desktop columns into stacked mobile hierarchies (`Identity + Status` → `Metadata` → `Actions`), not compressed tables.
22. **Design for Gujarati and Hindi From the Start**: Fluid widths and text wrapping so translated phrases never break or truncate awkwardly.
23. **Keep Animations Restrained**: Functional motion only (`120–200ms`) for menus, dialogs, disclosures, and focus feedback.
24. **Maintain a Clear Color Hierarchy**: Navy/charcoal for structure/actions; warm cream/white for surfaces; saffron for brand; warm gray for hairline borders; semantic colors for actual status only.
25. **More UI Is Not Better UI**: Before adding anything, ask: *Does this improve comprehension, task speed, or confidence?* If no, remove it. *Fewer elements, better resolved.*

### Agent-Level Design Review Checklist

Before considering any page or component complete:
- [ ] Does the actual workflow visually dominate the background?
- [ ] Is there one clear primary surface?
- [ ] Are there unnecessary nested cards?
- [ ] Are there too many badges?
- [ ] Is saffron being overused?
- [ ] Are primary actions dark and consistent?
- [ ] Do all form controls look like Weavly controls?
- [ ] Are radius and spacing values consistent?
- [ ] Is typography doing enough hierarchy work?
- [ ] Are there unnecessary KPI cards?
- [ ] Are row actions explicit?
- [ ] Does the page have loading/empty/no-results/error states?
- [ ] Does mobile recompose properly?
- [ ] Does the page work in English, Hindi, and Gujarati?
- [ ] Could any decorative element be removed without reducing usability?
*(Central Rule: If removing something makes the page cleaner without hurting usability, remove it).*

## Typography

The app uses:

- **Primary font:** Inter via `--font-inter`
- **Mono font:** Geist Mono via `--font-geist-mono`
- **Base body size:** `14px`

Use these patterns:

- Page titles: `text-xl font-bold leading-tight text-ink`
- Card titles: `text-lg font-semibold leading-[1.3] text-ink`
- Body copy: `text-sm text-body` or `text-sm text-muted-foreground`
- Labels/section headers: small uppercase, usually `text-[11px] font-semibold uppercase tracking-wide`
- Mobile nav labels: `text-[10px] font-semibold leading-none`

Avoid negative letter spacing. Keep dashboard text compact; reserve oversized type for landing pages only.

## Color System

Prefer Tailwind tokens backed by CSS variables instead of hard-coded hex values.

### Core App Tokens

| Token | CSS Variable | Hex | Use |
| --- | --- | --- | --- |
| `background` / `app-bg` | `--weavly-app-bg` | `#FFF8EA` | Dashboard/auth page background |
| `canvas` | `--weavly-canvas` | `#FFFDF7` | Mobile headers, elevated canvas |
| `surface` | `--weavly-surface` | `#FFFFFF` | Cards, forms, panels |
| `surface-soft` | `--weavly-surface-soft` | `#FAF1E2` | Secondary surfaces, hover states |
| `surface-muted` | `--weavly-surface-muted` | `#F0DFC2` | Muted fills |
| `ledger` | `--weavly-ledger-cream` | `#F6E8CF` | Ledger-like warm sections |
| `cotton` | `--weavly-cotton-beige` | `#EAD8B8` | Textile neutral |
| `loom` | `--weavly-loom-navy` | `#18252E` | Dark industrial surfaces |
| `ink` | `--weavly-ink` | `#1E2528` | Headings and strong text |
| `body` | `--weavly-body` | `#3F4542` | Main body text |
| `subtle` | `--weavly-subtle` | `#6B6D64` | Low emphasis text that remains readable at compact sizes |
| `hairline` | `--weavly-hairline` | `#DED2BD` | Borders |
| `hairline-strong` | `--weavly-hairline-strong` | `#CBB894` | Hover/strong borders |

### Brand And Semantic Tokens

| Token | CSS Variable | Hex | Use |
| --- | --- | --- | --- |
| `saffron` | `--weavly-saffron` | `#E27025` | Main brand accent, icons, highlights |
| `saffron-deep` | `--weavly-saffron-deep` | `#A94713` | Active nav, emphasized brand text |
| `saffron-soft` | `--weavly-saffron-soft` | `#F9DFC8` | Accent backgrounds |
| `success` | `--weavly-success` | `#2F6B43` | Positive/running/clear states |
| `success-soft` | `--weavly-success-soft` | `#E1F0E5` | Positive fills |
| `warning` | `--weavly-warning` | `#B87908` | Attention/maintenance states |
| `warning-soft` | `--weavly-warning-soft` | `#F7E8C2` | Warning fills |
| `risk` | `--weavly-risk` | `#A6402D` | Critical/destructive states |
| `risk-soft` | `--weavly-risk-soft` | `#F2D8D1` | Risk fills |
| `info` | `--weavly-info` | `#315C78` | Informational states |
| `info-soft` | `--weavly-info-soft` | `#DDEAF0` | Info fills |

### Landing Page Palette

The landing page intentionally uses a sharper palette:

- White backgrounds: `bg-white`, `bg-zinc-50`
- Strong text: `text-zinc-950`
- Dark sections: `bg-zinc-950`
- Brand highlights: `orange-500`, `orange-600`, `orange-700`, `orange-300`
- Marketing buttons often use `zinc-950` or white instead of dashboard `primary`

Keep this separation. Do not bring large marketing hero typography into operational dashboard screens.

## Backgrounds And Elevation

Dashboard/auth backgrounds use `BrandBackground`, which applies `.weavly-app-bg`: warm canvas with faint textile-grid and saffron/amber radial warmth.

Preferred shadows:

- Card: `shadow-[var(--shadow-card)]`
- Panel/auth: `shadow-[var(--shadow-panel)]`
- Modal: `shadow-[var(--shadow-modal)]`
- Button: `shadow-[var(--shadow-button)]`

Use borders heavily:

- Default: `border border-hairline`
- Hover/active: `border-hairline-strong`
- Dark sidebar borders: `border-white/10`

Avoid adding extra decorative background blobs. The existing brand background already provides texture.

## Shape And Spacing

Global radius starts at `--radius: 0.625rem`.

Common shapes:

- Buttons: `rounded-lg`, smaller buttons `rounded-md`
- Cards: `rounded-xl`
- Dense operational rows: `rounded-xl` or `rounded-2xl` when the row is a major touch surface
- Badges/pills: `rounded-full`
- Landing product mockups: often `rounded-lg`

Dashboard layout:

- Main content max width: `max-w-7xl`
- Mobile page padding: `px-3 py-4`
- Desktop page padding: `md:px-6 md:py-6 lg:px-8`
- Card padding: `py-5`, content `px-4 sm:px-5`
- Grids: `gap-4` for card grids, `space-y-4` or `space-y-6` for vertical rhythm

Do not nest cards inside cards unless there is a clear repeated item or modal-like sub-surface.

## Components

### Buttons

Use `components/ui/button.tsx`.

Variants:

- `default`: primary dark ink button
- `saffron`: orange brand action
- `destructive`: risk/destructive action
- `outline`: bordered surface action
- `secondary`: quiet surface action
- `ghost`: low-emphasis toolbar/nav action
- `link`: inline text action

Sizes:

- `default`: `h-10`
- `sm`: `h-9`
- `lg`: `h-11`
- `icon`: `size-10`
- `icon-sm`: `size-9`

Buttons should include lucide icons when the action benefits from quick recognition. Keep button labels short and operational.

### Cards

Use `components/ui/card.tsx`.

Default card style:

```tsx
bg-surface text-card-foreground flex flex-col gap-5 rounded-xl border border-hairline py-5 shadow-[var(--shadow-card)]
```

Use cards for:

- Dashboard modules
- Repeated operational items
- Action panels
- Modal-like contained flows

Avoid using cards as page section wrappers for everything.

### Badges

Use `components/ui/badge.tsx`.

Preferred semantic variants:

- `success`: running, paid, clear, synced
- `warning`: maintenance, pending attention, behind but not critical
- `risk`: critical, overdue, blocked
- `info`: informational state
- `brand`: brand highlight
- `outline`/`secondary`: neutral status

Badges should carry concise state labels, usually one to three words.

### Inputs

Use shared inputs/selects/textarea components. Inputs are `h-10`, `rounded-md`, `bg-surface`, and use `focus-visible:ring-ring/25`.

On mobile, form controls are forced to `16px` to prevent iOS zoom. Preserve that behavior.

### Icons

Use `lucide-react`, which is already the app standard.

Common icon intent:

- `Factory`: factory/today/organization
- `Package`: orders/stock
- `Truck`: dispatch
- `DollarSign`/`HandCoins`: finance/payroll/advances
- `Users`: workforce
- `Settings`/`Server`: setup and looms
- `AlertCircle`/`AlertTriangle`: attention/risk
- `CheckCircle2`: success/all clear

Icons inside nav are usually `18px`; mobile bottom nav icons are `20px`.

## Navigation

Desktop dashboards use a persistent `248px` dark sidebar:

- Background: `#111111`
- Text: `zinc-100`
- Active item: `bg-saffron-deep text-white`
- Inactive item: `text-saffron hover:bg-saffron-deep hover:text-white`
- Groups use small uppercase `text-zinc-500`

Mobile dashboards use a fixed bottom nav:

- Background: `bg-canvas/92 backdrop-blur-xl`
- Border: `border-t border-border`
- Active icon pill: `bg-saffron-soft`, text `text-saffron-deep`
- Inactive: `text-body`
- Includes safe-area padding with `pb-safe pl-safe pr-safe`
- Minimum height: `64px`, compact landscape height: `52px`

Supervisor screens also use a sticky mobile header with the logo and menu/install controls. Owner screens rely mostly on bottom navigation plus a sheet menu.

## Layout Patterns

### Dashboard Page Header

Use a compact header row:

- Optional icon tile: `h-10 w-10 rounded-xl border border-saffron/30 bg-saffron/10`
- Page title: `text-xl font-bold text-ink`
- Context badges or date chips on the right
- Mobile should stack or wrap without overflow

### KPI Strips

Use horizontal or responsive grid strips with compact labels, strong numeric values, and semantic color cues. Keep them scannable, not decorative.

### Operational Cards

Each card should answer:

- Current state
- Count/value
- Next action
- Risk level if any

Use semantic badges and concise action buttons rather than long explanatory copy.

### Empty / All-Clear States

All-clear states can be more spacious and reassuring:

- Centered icon in semantic circle
- `text-xl font-bold`
- Short body line
- Semantic fill such as `bg-success-soft`

Do not overuse empty states on screens that should remain workflow-oriented.

### Shared Route Primitives And Copy

Base Plan routes use the shared `PageHeader`, `Toolbar`, `SectionHeader`,
`StatusBadge`, and `EmptyState` patterns from `components/ui/page-header.tsx`.
Keep route headers compact, action areas right-aligned on desktop, and wrapped
on narrow screens. Use `Card` for a complete surface and `Toolbar` for search,
filters, and view controls; do not use a card as a toolbar.

Use one status vocabulary across routes:

- `Draft`, `Pending`, `In progress`, `Needs review`, `Active`, `Complete`,
  `Sent`, `Accepted`, `Archived`, `Rejected`, and `Failed`.
- Prefer sentence case and describe the next action when a status needs help.
- Use “Save” for a user-created record, “Update” for an existing record,
  “Archive” for reversible removal, and “Delete” only for permanent removal.
- Lead with the task and result: “Save cost estimate”, “Review unusual values”,
  or “No saved costings yet”. Avoid internal terms, blame, and unexplained
  technical errors in user-facing copy.

## Mobile And PWA Rules

The app is designed for installed mobile use:

- Root viewport disables user scaling and uses `viewportFit: "cover"`.
- Safe-area utilities are defined in `globals.css`: `pt-safe`, `pb-safe`, `px-safe`, etc.
- Mobile bottom nav requires page bottom padding: `pb-[calc(72px+env(safe-area-inset-bottom,0px))]`.
- Use `min-w-0`, `truncate`, and stable dimensions for narrow screens.
- Touch controls should remain usable on small phones and landscape.
- Avoid layouts that depend on hover only.
- Avoid text overflow in buttons, badges, tabs, nav labels, and table-like rows.

## Auth Screens

Auth screens use `AuthLayout`:

- Full-screen centered layout
- `BrandBackground variant="auth"`
- Single panel: `max-w-[440px]`, `rounded-2xl`, `border-hairline`, `bg-surface/88`, backdrop blur
- Logo at top, centered
- Title: `text-2xl font-semibold text-ink`
- Subtitle: `text-sm text-muted-foreground`
- Footer: small muted brand/date line

Keep auth calm and focused. Avoid dashboard density here.

## Landing Page

Landing is intentionally more editorial:

- Full viewport scroll container with snap sections
- Fixed translucent header
- Large bold hero type: `text-5xl sm:text-7xl lg:text-8xl font-black`
- Strong contrast with `zinc-950`, white, and orange
- Product mockup card demonstrates workflow instead of abstract illustration
- CTA buttons are larger: `px-8 py-6 text-base font-bold`

Landing may use more dramatic shadows and typography, but should still show real product workflows: estimates, loom assignments, shift logs, dispatches, advances, payroll, and WhatsApp briefs.

## Internationalization

The app supports translated nav and labels through `useTranslation()`. New navigation items and repeated UI labels should use existing translation patterns where practical.

Design must allow Gujarati/Hindi labels to be longer than English:

- Use `min-w-0`, `truncate`, wrapping, or responsive stacking.
- Avoid fixed-width text containers unless the content is numeric or icon-only.

## Accessibility And Interaction

- Use visible focus states from shared components.
- Keep destructive actions visually distinct with `destructive`/`risk`.
- Use semantic HTML for buttons and links.
- Icon-only buttons need accessible names.
- Modal/sheet headings should exist, even if visually hidden.
- Use `aria-label` for date chips or compressed controls when needed.

## Implementation Checklist

When adding or changing UI:

- Use existing `components/ui/*` primitives first.
- Prefer design tokens (`bg-surface`, `text-ink`, `border-hairline`, `text-saffron-deep`) over raw hex values.
- Match the surface: dashboard/auth use warm Weavly tokens; landing uses white/zinc/orange marketing treatment.
- Preserve safe-area spacing for mobile PWA screens.
- Check narrow mobile widths for text overflow.
- Use semantic badge variants for state.
- Keep dashboard copy short and action-oriented.
- Use lucide icons for nav/actions/status.
- Avoid adding unrelated decorative gradients, blobs, or nested cards.

## Source Files

Primary references:

- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `components/brand-background.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- `components/ui/input.tsx`
- `components/navigation/owner-sidebar.tsx`
- `components/navigation/supervisor-nav.tsx`
- `components/auth/auth-layout.tsx`
- `app/(dashboard)/owner/layout.tsx`
- `app/(dashboard)/supervisor/layout.tsx`
- `app/(dashboard)/owner/today/FactoryTodayClient.tsx`
- `app/(dashboard)/supervisor/dashboard/page.tsx`
- `components/landing/header.tsx`
- `components/landing/hero.tsx`
