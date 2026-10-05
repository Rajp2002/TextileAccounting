# Free account, billing and customer support

This is the supporting-screen portion of the Free-only redesign on `codex/free-mobile-redesign`, based on `cf00bf4616cfb8c2e128815eeb266d00b67d7ca1`. The complete route inventory and tier allocation are in [FREE.md](FREE.md). No production data, providers, migrations, push, PR, merge or deployment were used.

## Included behavior

| Route | Change and preserved behavior |
| --- | --- |
| `/free/account` | Mobile personal, factory, security and device groups show compact summaries. Editors remain mounted when folded, dirty state stays visible, current invalid/alert feedback prevents closing, and delayed errors reopen their editor. Unverified email is visible in the security summary. Free still has no costing defaults or payroll controls. |
| `/free/account` deletion review | All original monetary/deletion consequences and typed confirmation safeguards remain. Free mobile Cancel/Close now returns focus to the original review button. No delete handler or server safeguard changed. |
| `/free/billing` | Compact mobile cards, actual organization name from the existing organization row, and explicit active/pending/suspended/unavailable/ended-access presentation. Missing grant data no longer defaults to Active. Verified mounted Lite/Base access displays unlimited costing, with no Free quota/no-payment claim. History and upgrade destinations remain. “Payments & receipts” matches the existing receipt-only policy. |
| `/support` | Only verified Free owners receive compact mobile presentation. Optional introduction is under Help. Close retains the memory-only intake draft, whose unsaved status remains explicit. Existing request payload, key, uncertainty/editing lock and retry contract remain. A synchronous UI guard now prevents same-task double submission for compact Free customers. |
| `/support/[id]` | Free mobile shows the latest two messages, with earlier messages and status history available through disclosures. Promised updates stay visible. Reply moves focus to the existing composer. Enter remains a newline. The Free-only single-flight guard preserves exact pending retry payload/key and clears after completion or rejection. |

Support presentation is enabled only after the existing requester guard succeeds and a plan read confirms `effectiveTier === 'free'`. A failed plan read preserves the existing full support workflow. Paid customer and privileged founder modes keep their original presentation and handler behavior.

## Explicit deferrals

No paid-specific settings/billing/support redesign, security/auth/deletion policy change, support delivery change, durable drafts, local offline mutation replay, or new entitlement is introduced. The shared support route layout and access-fallback presentation, `/free/settings` redirect, `/install`, `/offline`, `/locked`, policy/privacy/security utility pages, expired-paid archive/data rights, and all production/stock/workforce screens remain as inventoried in FREE.md. Their complete browser/device QA is outside this component fixture; no new Free capability is inferred.

## Source files

- `components/settings/plan-aware/plan-aware-settings-view.tsx`, `free-settings.module.css`, and the optional Free mobile focus return in `deletion-review-card.tsx`.
- `app/free/billing/FreeBillingClient.tsx`, `page.tsx`, `free-billing.module.css`; pure display helper `lib/free-billing-presentation.ts`; optional Free portal class in `components/billing/PaymentHistoryDialog.tsx`.
- `components/support/support-workspace.tsx`, `free-support.module.css`, `support-history-export.tsx`; both existing customer support page routes.
- `lib/i18n/free-supporting.ts` provides English, Hindi and Gujarati for all new presentation and consequential states. Native-speaker copy review remains unrun.
- Focused tests and `scripts/qa/free-supporting-browser/` reproduce the isolated component checks. The server requires explicit synthetic mode, disables HMR/watch, and stores Vite cache outside the repository. Final focused source matches the committed application files at `3d3831c6`; source hashes and provenance are retained in the evidence.

## Screenshots

BEFORE captures were taken from the real components before editing them. AFTER uses the same local synthetic identity/data and matching viewports. These are Chromium component emulation, with local transport and system font fallback; they are not authenticated app/device screenshots.

| View | Small mobile 320×568 | Large mobile 430×932 | Desktop 1440×900 |
| --- | --- | --- | --- |
| Account | [before](../../output/playwright/free-mobile-supporting/before/account-320.png) / [after](../../output/playwright/free-mobile-supporting/after/account-320.png) | [before](../../output/playwright/free-mobile-supporting/before/account-430.png) / [after](../../output/playwright/free-mobile-supporting/after/account-430.png) | [before](../../output/playwright/free-mobile-supporting/before/account-1440.png) / [after](../../output/playwright/free-mobile-supporting/after/account-1440.png) |
| Billing | [before](../../output/playwright/free-mobile-supporting/before/billing-320.png) / [after](../../output/playwright/free-mobile-supporting/after/billing-320.png) | [before](../../output/playwright/free-mobile-supporting/before/billing-430.png) / [after](../../output/playwright/free-mobile-supporting/after/billing-430.png) | [before](../../output/playwright/free-mobile-supporting/before/billing-1440.png) / [after](../../output/playwright/free-mobile-supporting/after/billing-1440.png) |
| Support inbox | [before](../../output/playwright/free-mobile-supporting/before/support-320.png) / [after](../../output/playwright/free-mobile-supporting/after/support-320.png) | [before](../../output/playwright/free-mobile-supporting/before/support-430.png) / [after](../../output/playwright/free-mobile-supporting/after/support-430.png) | [before](../../output/playwright/free-mobile-supporting/before/support-1440.png) / [after](../../output/playwright/free-mobile-supporting/after/support-1440.png) |
| Support thread | [before](../../output/playwright/free-mobile-supporting/before/thread-320.png) / [after](../../output/playwright/free-mobile-supporting/after/thread-320.png) | [before](../../output/playwright/free-mobile-supporting/before/thread-430.png) / [after](../../output/playwright/free-mobile-supporting/after/thread-430.png) | [before](../../output/playwright/free-mobile-supporting/before/thread-1440.png) / [after](../../output/playwright/free-mobile-supporting/after/thread-1440.png) |

Desktop account images are pixel-identical. Desktop support inbox/thread dimensions and placement match, with a small date-whitespace difference from explicit localized text. Billing placement is preserved; receipt terminology and localized allowance wording account for text differences.

## Verification

| Status | Check | Evidence and limits |
| --- | --- | --- |
| Passed | Focused ESLint, zero warnings | [focused-lint.log](../../output/playwright/free-mobile-supporting/focused-lint.log), exit 0 against final authored supporting source, fixture TSX/server, and changed/new tests. Generated cache dependencies are outside the repository. |
| Passed | Focused unit/integration tests, 43/43 in eight files | [focused-unit.log](../../output/playwright/free-mobile-supporting/focused-unit.log), rerun after final source changes. Billing actual rendered access/quota facts, support guard/Free-only mode and plan-source failure, Free/paid settings and deletion preflight regressions. CLI exclusions prevent unrelated ignored scratch worktrees from being discovered; repository configuration was not changed. |
| Passed | Compact Free interrupted/repeated browser flows | [verification.log](../../output/playwright/free-mobile-supporting/verification.log): mounted dirty editors, validation/error visibility, delayed failure, safe Cancel/focus, billing states/history Escape, memory-only intake Close/reopen, exact retry key after lost response, duplicate same-task create/reply taps, refresh with pending attempt, reply focus, Enter, older messages/history, and EN/HI/GU reflow at 320 CSS pixels with normal/200% root text. |
| Passed | Support default/founder browser regression, 12/12 after final guard | [support-results.json](../../output/playwright/free-mobile-supporting/regression/support-results.json): desktop/mobile Chromium, public/private separation, immutable lost-response/429 retry, lifecycle, retained memory-only draft and Enter. Existing generated founder/admin screenshot artifacts were restored; only Free evidence is retained. |
| Passed | Final representative capture, all 12 views without horizontal overflow | [after/capture.log](../../output/playwright/free-mobile-supporting/after/capture.log). |
| Fixed and rechecked | Review findings | Hidden validation/asynchronous error risk corrected; paid-upgrade Free-quota claim corrected; existing Free deletion Cancel focus loss corrected; state-only busy guard's same-task duplicate request issue corrected narrowly for compact Free customers. |
| Interrupted, then rerun | Initial fixture/runner attempts | An outdated Vite cache and a synthetic navigation dialog interrupted early attempts. A fresh named browser and external cache completed the final assertions; incomplete attempts are not counted as passes. Initial supporting `/` fixture paths also used public-page translation maps; final language checks use `/free/account`, `/free/billing`, `/support` and `/support/id`, with settled styles. Preliminary artifacts are explicitly labeled in the text-resize README. |
| Passed | Computed-text 200% enlargement, 15/15 EN/HI/GU cases at 320 pixels | [Final results](../../output/playwright/free-mobile-supporting/text200/final/results.json) check actual app-like route paths, coarse touch, all computed fonts/line heights, direct rendered ranges, clipping, native field clearance and 44-pixel targets. Account opened editors and invalid/delayed errors, support/thread and billing history/receipt dialogs with synthetic saved facts pass; no POSTs were sent. The earlier root-size check was weaker. |
| Passed | Accessibility correction regression | [9/9 paid/default styling cases](../../output/playwright/free-mobile-supporting/text200/final/styling.json), five affected behavior groups, 14 focused tests, zero-warning lint and [four pixel-identical desktop captures](../../output/playwright/free-mobile-supporting/text200/final/desktop-correction-comparison.json). |
| Passed | Full lint/type/build/required aggregate | See [FREE-validation.md](FREE-validation.md): final source passed zero-warning ESLint, standalone TypeScript, production build, 2968 unit/integration tests and 273 disposable database tests. Database worker teardown emitted a warning after passing assertions. |
| Unrun | Real installed iOS/Android PWA, real software keyboard, OS suspension/termination, VoiceOver/TalkBack | Component viewport emulation cannot establish these results. Shared shell/input-navigation tests belong to root; actual safe areas, keyboard occlusion, Back/Forward and device focus need device QA. |
| Unrun | Remote auth/RLS/server writes or real payment/support provider outcomes | Local synthetic transport exercises client presentation and state, while server contract and integration tests are reported separately. |

Full-text checks found and corrected clipped account actions/badges, fixed-height fields, wrapping billing summary facts and the Free receipt-link touch target. The corrections remain scoped to Free mobile presentation.

No known unresolved bug remains in this supporting slice's completed synthetic checks. Existing memory-only support drafts can be lost on page/process termination; Close only retains the mounted page draft. No stronger recovery or offline claim is made.
