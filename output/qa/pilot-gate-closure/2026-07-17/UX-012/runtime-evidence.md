# UX-012 runtime evidence

Date: 2026-07-17 IST

Environment: local Next.js development server configured with `.env.qa.local`

Safety checks:

- QA Supabase project reference `eutycrtzzxmlkcpipgod` was present.
- Production project reference `vzhwahudircrpgtitwzd` was absent.
- Disposable QA records were created only in the confirmed QA project and were
  deleted after capture.
- No production access, production mutation, deployment, real billing action, or
  production subscription change was performed.

## Public terminology

Classification: `PASS` for the inspected public English terminology.

The rendered public page contained:

- Cost Estimate
- Quotation history
- Machine assignments
- Metres Produced This Shift
- Worker Hisaab

It did not contain the retired public plan name `Weavly Estimator` after the follow-up correction.

Evidence:

- `01-public-terminology.png`
- `02-public-workflow-terminology.png`

The development overlay showed two console issues during the screenshot session. One was a Sentry-injected script warning. The other was a hydration mismatch caused by the browser retaining pre-edit landing-page client text while the restarted server returned the new text. The final DOM contained the approved terminology, but screenshots containing the development issue badge are not suitable as final factory-review screenshots.

## Authenticated owner and supervisor terminology

Classification: `PASS` for the captured English owner and supervisor surfaces.

Disposable run `FORMAL-B2-1784310076133-C262F7` created a Premium owner, a
Premium supervisor and a Base owner in QA. Both the Premium owner and Premium
supervisor established authenticated application sessions through
`http://localhost:3000`.

The owner evidence shows:

- Cost Estimate and Quotations as separate navigation concepts;
- Machines, Machine Assignments, Machine Name and Machine Type;
- the retained technical machine types Jacquard, Rapier, Water Jet, Air Jet,
  Power Loom, Shuttle and Other;
- Godown Stock, Party Ledger, Upaad (Worker Advance) and Worker Hisaab;
- the Cost Estimate screen in authenticated context.

The supervisor evidence shows:

- Metres Produced This Shift in navigation and as the page heading;
- separate Day and Night shift selection;
- helper copy asking for total metres produced on each machine for the selected
  shift;
- Machines, Machine Board and Machine Assignments.

Evidence:

- `03-owner-navigation-terminology.png`
- `04-owner-cost-estimate.png`
- `05-owner-machines.png`
- `06-owner-worker-hisaab.png`
- `07-owner-upaad.png`
- `08-owner-party-ledger.png`
- `09-owner-delivery-challans.png`
- `10-owner-godown-stock.png`
- `11-supervisor-dashboard.png`
- `12-supervisor-machines.png`
- `13-owner-add-machine-dialog.png`

The empty disposable tenant could not display data-dependent rows for Taka
quantities, receipt variance, Piece-Rate/Salaried Worker assignments or Counter
Reading. Those exact data-dependent labels still require either seeded QA data
or factory review on a populated pilot tenant; no runtime PASS is claimed for
those particular contexts.

## First disposable-account diagnostic

Date: 2026-07-17 IST

Run: `FORMAL-B2-1784287284131-213C81`

The guarded QA fixture created:

- one Premium owner;
- one Premium supervisor;
- one Base owner;
- two prefixed QA organizations and active test subscriptions.

The fixture targeted QA project `eutycrtzzxmlkcpipgod`. Direct QA Auth sign-in with the disposable Premium owner succeeded, proving that the new account and password were valid. The application login action still returned to `/login` without establishing an authenticated browser session, so no authenticated terminology claim was inferred.

A production-mode local build was attempted as a diagnostic fallback. The build completed, but target inspection found both the QA and production project references in `.next` because Next loaded `.env.production.local`. The mixed-target bundle was not started and no request was sent through it.

Cleanup then deleted and reconciled all disposable subscriptions, profiles, organizations, and Auth users. The fixture script returned `cleaned: true`, and its private credential file was removed.

Final classification:

- Disposable QA account creation: `PASS`
- Direct QA Auth validation: `PASS`
- Application authenticated browser session in this first attempt: `BLOCKED`
- Account and fixture cleanup: `PASS`
- Production access or mutation: `NONE`

## Root cause and successful rerun

The first browser attempt used `http://127.0.0.1:3000` while the Next.js
development server advertised `http://localhost:3000`. Next.js blocked the
cross-origin development runtime, so the unhydrated login form fell back to a
plain `GET /login?` submission instead of invoking the application login
action. This was a QA-origin error, not an Auth, cookie or account defect.

The rerun used `http://localhost:3000`. Both disposable Premium accounts then
completed the real login action and reached `/owner/today` and
`/supervisor/dashboard`. No application code change was required.

Cleanup evidence:

- fixture run: `FORMAL-B2-1784310076133-C262F7`;
- cleanup response: `cleaned: true`;
- private fixture credential file absent after cleanup;
- local Next.js process stopped;
- no production project reference was used.

Final classification:

- QA target verification: `PASS`
- Disposable owner application login: `PASS`
- Disposable supervisor application login: `PASS`
- Authenticated English screenshot capture: `PASS`
- Disposable account/organization/subscription cleanup: `PASS`
- Production access or mutation: `NONE`
- UX-012 pre-pilot status: `PASS` by Raj's explicit Founder acceptance on
  2026-07-17 and his readiness-policy decision to move factory-side review into
  the pilot run
- Pilot-run control: named factory-side review of populated English contexts and
  exact Gujarati wording remains mandatory; any disagreement reopens UX-012 as
  a change request
