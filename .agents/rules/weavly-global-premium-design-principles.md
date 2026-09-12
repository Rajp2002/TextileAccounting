# Weavly — Global Premium Design Principles

This document defines the core visual and interaction principles to apply across Weavly so future pages feel consistent, premium, and operationally clear.

The goal is not to add more UI. The goal is to create a system that feels intentional, restrained, and recognizable as Weavly.

---

### 1. Brand Character: Warm Industrial

Weavly should feel like modern operational software built specifically for the textile industry.

**Core visual personality:**
- Warm cream
- Charcoal / loom navy
- Saffron
- Quiet industrial structure

**Avoid becoming generic:**
- White + gray + blue SaaS

The warm identity is one of Weavly's strongest differentiators.

---

### 2. Content Must Dominate the Background

The branded orange/grid canvas is atmosphere. It should never visually compete with:
- Tables
- Forms
- Workflows
- Records
- Important numbers

**Hierarchy must be:**
1. Workflow / content
2. Controls / actions
3. Brand atmosphere
*(Not the reverse).*

Where content is dense, use opaque surfaces (`bg-surface`) to calm the background.

---

### 3. Use One Primary Surface Per Workflow

Avoid excessive cardization.

**Good:**
```
Page header
╭──────────────────────────────╮
│ Toolbar                      │
├──────────────────────────────┤
│ Main content                 │
╰──────────────────────────────╯
```

**Bad:**
```
card
  card
    card
      badge
```

Use nested containers only when there is a real conceptual hierarchy.

---

### 4. Typography Before Decoration

Establish hierarchy using:
- Font size
- Font weight
- Spacing
- Alignment

*Before* introducing:
- Badges
- Colored backgrounds
- Borders
- Shadows

If something can be communicated clearly as text, prefer text.

---

### 5. Saffron Is Precious

Saffron should remain one of the strongest Weavly brand signals. Because of that, do not use it everywhere.

**Good uses:**
- Brand logo
- Selected indicators
- Important accent details
- Occasional highlighted actions
- Small decorative moments

**Avoid using saffron simultaneously for:**
- Every CTA
- Every link
- Every selected nav item
- Every badge
- Every hover state

Overuse makes the color lose meaning.

---

### 6. Structural Actions Use Dark Navy

Primary operational actions should usually use the dark structural color (`loom` / dark navy: `bg-ink text-surface` or `bg-slate-900 text-white`).

**Examples:**
- `+ Add worker`
- `+ Add machine`
- `Save costing`
- `Create dispatch`

This creates consistency and lets saffron remain distinctive.

---

### 7. Minimize Filled Badges

Badges should convey genuine categories or statuses. Do not turn every piece of metadata into a pill.

**Prefer plain typography:**
- `Rapier`
- `Day shift`
- `Piece rate`

Leave as plain typography unless strong categorization is necessary. Use status indicators sparingly.

---

### 8. Shadows Should Be Almost Invisible

**Prefer:**
- Subtle border (`border border-hairline`)
- Very soft ambient shadow (`shadow-xs` or softest card shadow)

**Avoid:**
- Strong floating cards
- Multiple elevation layers
- Orange glows
- Dramatic drop shadows

Weavly should feel grounded.

---

### 9. Standardize Radius

Create a small radius system:
- **Controls:** `8px` (`rounded-lg` / `rounded-md`)
- **Primary panels:** `12–14px` (`rounded-xl` / `rounded-2xl`)
- **Pills:** `full` (`rounded-full`)

Avoid arbitrary values page by page.

---

### 10. Standardize Control Height

Inputs, dropdowns, search fields, and medium buttons should generally share a common height.

**Recommended:**
- `40–44px` desktop (`h-10` to `h-11`)
- `44px` minimum mobile interaction target

Consistent control sizing makes pages feel far more intentional.

---

### 11. Standardize Spacing

Use a limited spacing scale:
- `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`

Avoid arbitrary spacing (`13px`, `19px`, `27px`) unless layout constraints genuinely require them.

**Recommended page relationship:**
```
Title
4px
Subtitle

24px

Primary surface
```

---

### 12. Keep Page Headers Consistent

Most management pages should follow:
```
Page title                              Primary action
Short explanation
```

**Examples:**
- **Workers:** Add and manage your factory workforce. `[+ Add worker]`
- **Machines:** Add and manage the machines in your factory. `[+ Add machine]`
- **Dispatches:** Manage outgoing fabric dispatches. `[+ Create dispatch]`

Consistency creates perceived product maturity.

---

### 13. Avoid Dashboardification

Do not add KPI cards just because a page has empty space.

Only show a metric if it materially helps the user perform the page's job.
For example, Workers does not inherently need `23 total · 17 piece rate · 6 salary · 22 active` at the top.

Empty space is better than irrelevant information.

---

### 14. Operational Pages Should Be Dense but Calm

Weavly is factory software. Users should be able to scan quickly.

**Prioritize:**
- Clear rows
- Predictable columns
- Familiar control placement
- Short labels
- Visible actions

Avoid design patterns that reduce working density merely to appear modern.

---

### 15. Explicit Actions Beat Mystery Interactions

Do not make every row clickable. If a record supports:
- `Edit`
- `View assignments`

Show those actions. Avoid forcing users to discover behavior through hover.

---

### 16. Avoid Unnecessary `...` Menus

Use overflow menus when there are enough secondary actions to justify them. Do not hide two obvious actions behind a menu purely for aesthetic reasons.

---

### 17. Use Icons as Anchors, Not Decoration

Icons should assist recognition.

**Good:**
- Worker icon
- Machine icon
- Search icon
- Plus icon

**Avoid:**
- Multiple icons per row
- Colorful illustrations everywhere
- Icon-only actions with ambiguous meaning

---

### 18. Controls Must Never Look Browser-Native

Avoid default-looking:
- Selects
- Checkboxes
- Radio buttons
- File inputs

All controls should inherit Weavly's shared design system. Native select styling varies wildly across Chrome, Safari, Windows, and macOS.

---

### 19. Build Shared Primitives, Not Giant Abstractions

Create reusable components for recurring patterns:
- `PageHeader`
- `PrimaryButton`
- `SearchInput`
- `FilterSelect`
- `RegisterSurface`
- `StatusIndicator`
- `EmptyState`
- `ErrorState`
- `SkeletonRow`

Do not build a giant component that accepts dozens of configuration props just because Workers and Machines happen to look similar. Share the primitives; keep domain behavior local.

---

### 20. Every Surface Needs Complete States

Every data-driven page should explicitly design:
- `loading`
- `loaded`
- `empty`
- `no-results`
- `error`

Do not leave those states to default browser text or blank space.

---

### 21. Responsive Means Recompose, Not Shrink

Desktop columns should not simply compress onto mobile. Rearrange information.

**Desktop:**
```
Identity | Metadata | Status | Actions
```

**Mobile:**
```
Identity          Status
Metadata
Actions
```

Preserve hierarchy rather than geometry.

---

### 22. Design for Gujarati and Hindi From the Start

Never design controls based only on English label lengths. Avoid narrow fixed widths.

Let:
- Filters grow
- Buttons grow
- Text wrap where appropriate

Translations should not feel like an afterthought.

---

### 23. Keep Animations Restrained

Use motion primarily for:
- Menus
- Disclosure
- State transitions
- Hover/focus feedback
- Onboarding nudges

**Typical duration:** `120–200ms`.
Avoid constant decorative movement in normal operational workflows.

---

### 24. Maintain a Clear Color Hierarchy

- **Charcoal/Navy (`loom`/`ink`):** Structure + primary actions
- **Cream/Off-white (`surface`/`app-bg`):** Surfaces and canvas
- **Saffron:** Brand + emphasis only
- **Warm gray (`hairline`/`subtle`):** Borders + secondary text
- **Semantic colors:** True success/warning/error states only (never for visual variety)

---

### 25. Premium Does Not Mean More UI

Before adding any element, ask:
> *Does this improve comprehension, task speed, or confidence?*

If the answer is no, do not add it. The target should be:
**Fewer elements, better resolved.**

---

## Agent-Level Design Review Checklist

Before considering any new page polished, verify:

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

> **The Central Rule:** If removing something makes the page cleaner without hurting usability, remove it.
