# Guided tour refinement integration

Integration branch: `codex/guided-tour-refinement`.

All eleven section tasks ran sequentially with Astra High and produced committed changes. Each tour now prioritizes purpose, prerequisites, a worked workflow, consequences, and the next action. Secondary details remain discoverable through contextual help or optional guides. English, Gujarati, and Hindi are retained.

| Section | Core path |
| --- | --- |
| Cost Estimator | 10 paid / 9 Free steps; optional field guide |
| Saved Costings | 7 production / 6 Lite / 4 Free steps; optional comparison |
| Yarn Rate Book | 6 steps; linked recipe versus historical snapshot consequences |
| Production | 12 steps across Prepare and Record; optional setup/history/corrections |
| Machine Assignments | 7 steps; immediate save, Undo, Daily Sheet |
| Machines | 6 steps; physical register versus production readiness |
| Workers | 7 piece-rate / 8 salary steps; authoritative wage source |
| Payroll | 10 Base / 9 Full steps; correct recovery and zero-earning obligations |
| Fabric Stock | 7 steps; eligible opening versus absolute correction |
| Yarn Stock | 8 steps; unused plus embodied ownership and dispatch deduction |
| Dispatch | 11 steps; goods, acknowledgement, and money remain distinct |

## Integration details

Combined all section commits, preserving both Fabric and Yarn contextual help and their tests. Kept the Machine Assignments navigation fix for `tab=production`. Worker wage display uses the active quality wage, resolving the Production review concern. Financial calculations and stock rules are unchanged.

The shared layout patch cancels desktop application zoom on tour overlay portals so viewport measurements align with fixed highlights and cutouts. Preview translation explicitly overrides dialog centering utilities and the phone bottom-sheet rule. A CSS custom property preserves this override through production CSS optimization. The final production build retained the override. On a 390 × 844 viewport, the preview starts at x=8/y=72 and its fields render above the reading panel. Expanded help scrolls while Back/Next remain visible.

## Verification

- Full suite: 285 files passed; 2,332 tests passed, one skipped.
- Full TypeScript check passed.
- ESLint across changed TypeScript files: zero errors, seven existing warnings.
- Production build passed.
- User approved local browser verification. Signed into the supplied Base QA account on the local production build; Base entitlement was visible in the app.
- Launched all eleven tours. Traversed Estimator, Rate Book, Production, Assignments, Machines, Workers salary, Base Payroll, Fabric Stock, Yarn Stock and Dispatch core lessons. Saved Costings reached its state-aware final step; Finish closed the overlay and returned focus to the launcher.
- Estimator exit restored initial Quick mode. Production, Assignments, Machines, Workers, Payroll and stock exits restored real page contents. No business forms were submitted.
- Overlay bounds checked at 1024, 1280, 1440, 1660, 1920 and 390 px. Overlay width matched viewport; reading panels remained inside it.
- Browser console error log was empty after the walkthrough.
- Dispatch optional help expanded on mobile; Gujarati phone rendering and Hindi content checked. English restored.
- Browser scope is Base. Full/Lite/Free variants and all-language parity have automated coverage, not an exhaustive browser pass.
- Integration verified and ready for commit/push. No main merge or manual deployment performed.
