# Narola Weavly proposal - technical notes

This document is a faithful, structured technical summary of the preserved proposal at `docs/reference/narola-weavly-commercial-technical-proposal.pdf`. It records what Narola proposed; it does not endorse those choices or assert that they are missing from the current Weavly repository. Page references refer to the 22-page attached PDF.

## 1. Proposal identity

- Agency: Narola Infotech.
- Recipient: Raj Patel.
- Prepared by: Urvesh Sojitra (Business Representative) and Vrushal Meruliya (Technical Representative).
- PDF metadata title: "Commercial & Technical Proposal for Weavly."
- Displayed title: "Greenfield multi-tenant textile manufacturing operations SAAS."
- Date: not stated in the visible document or PDF metadata.
- Core assumption: a greenfield, production-ready SaaS for Indian grey-fabric weaving factories, designed around transaction integrity, tenant isolation, traceability, and operational usability (pages 1-2).
- Scale assumptions: 10-25 tenants in year one, at least 100 tenants without fundamental rearchitecture, typically 12-50 looms and 10-40 workers per factory, and representative larger tenants of about 150 looms and 100 workers (page 2).

## 2. Option A - Estimator scope

Narola describes Option A as a standalone commercial Estimator SaaS, not a single calculator screen (pages 2-3). Its proposed scope includes:

- Owner authentication, organisation creation, and tenant-scoped access.
- A factory cost-profile wizard for power, labour, loom, overhead, and recurring costs.
- Multiple warp/weft rows and deterministic calculations using yarn rates, GST, denier/count, ends, picks, width, tape length, shortage/wastage, crimp, and related inputs.
- Loom type, RPM, power, shifts, and theoretical/adjusted production assumptions.
- Warping, sizing, winding, weaving, processing, finishing, transport, commission, overhead, margin, profit, and tax treatment.
- An explanatory cost stack spanning yarn, conversion, processes, overhead, commercial additions, and final price.
- Scenario comparison for selected changes in rates, output, cost, or margin.
- Reusable qualities/templates and quotation status history.
- Immutable quote snapshots, historical restore/revision, and printable/shareable PDFs.
- A responsive PWA, dashboard, backup strategy, error logging, production deployment, and formula acceptance tests.

The client remains responsible for supplying formulas, terminology, worked examples, and expected results. Narola would implement and test approved formulas but explicitly would not invent undisclosed textile formulas (page 3).

Option A excludes production orders/runs, loom and supervisor workflows, stock/dispatch, commercials, payroll/advances, native applications, statutory accounting, government integrations, IoT, and large-scale historical migration (page 4).

## 3. Option B - Full Suite scope

Option B connects Estimator -> Quote -> Order/Market Run -> Production -> Stock -> Dispatch -> Commercials -> Payroll -> SaaS Billing (pages 5-8). It includes Option A plus:

- Factory onboarding and master data for identity, production mode, payroll baseline, machines, workers, godowns, parties, and qualities.
- Owner-controlled supervisor access and regenerable organisation join codes.
- Accepted-quote-to-order and market-estimate-to-market-run workflows with commercial/rate snapshots.
- Loom assignment, progress, pace, deadline, closure, and historical traceability.
- Mobile-first supervisor day/night shift logging, Indian factory dates, meter calculation, bulk submission, idempotency, and controlled corrections.
- Owner analytics for Factory Today, pending logs, order/run health, progress, pace, risk, utilisation, and worker production.
- Opening, manual, and production-origin stock with actual metres per taka, optional default quality length, partial sales, adjustments, movement history, and duplicate prevention.
- Dispatch references, packages, public token tracking, received metres, variance reconciliation, and auditable override.
- Receivables, credit days, due dates, collections, operational gross profit, and outstanding views.
- Meter-worker and fixed-worker payroll, historical rates, attendance, adjustments, Upaad/advances, capped deductions, settlement, and payslip PDFs.
- Subscription/trial states, server-verified Razorpay/webhooks, optional referrals, and non-blocking WhatsApp messages with retries and audit.
- Tenant isolation, audit logging, atomic writes, idempotency, backups, monitoring, QA, deployment, documentation, source code, and knowledge transfer.

The proposed stock model treats taka count and actual metres separately: there is no global fixed taka length, although a quality can supply a default; actual metres govern stock arithmetic and partial movement (page 6).

Tax scope is configurable GST/HSN/SAC and relevant intra/inter-state or inclusive/exclusive calculations, while full statutory accounting, GST filing, general ledger, Tally replacement, and direct government integrations remain excluded (page 6).

## 4. Proposed team composition

Option A proposes seven people: one senior PM/BA, one senior technical lead/architect, one mid-senior UX/UI designer, one senior frontend engineer, one senior backend engineer, one mid-senior QA engineer, and one senior DevOps/cloud engineer. Allocations range from two to six months (page 3).

Option B proposes ten people: one senior PM/BA, one senior technical lead/architect, one mid-senior UX/UI designer, two senior frontend engineers, two senior backend engineers, two mid-senior QA engineers, and one senior DevOps/cloud engineer. Allocations range from three to twelve months (page 6).

Option C uses a part-time PM/BA and architect plus module-dependent design, frontend, backend, QA, DevOps, mobile, data, or IoT specialists (page 9).

## 5. Proposed delivery timelines

- Option A: approximately 24-26 weeks. Milestones cover discovery, UX/architecture, core estimator, quotes/history/PDF, QA/security/performance, then UAT/launch/handover (pages 4 and 18).
- Option B: approximately 48-52 weeks. Milestones progressively cover tenancy, estimator, orders/runs, production/analytics, stock/dispatch, commercials/payroll, billing/operations, then full-system QA/pilot/launch (page 7 and 18).
- Option C: separately scoped; the example milestone table describes module discovery, architecture, implementation, integration validation, and a final UAT/release period (pages 9-10).

## 6. Proposed architecture

The baseline architecture is a modular web system (pages 10-13):

- Frontend: React/Next.js responsive PWA, with mobile-first production workflows.
- Backend: modular Node.js/NestJS-style service architecture, subject to final technical sign-off.
- Database: PostgreSQL for transactions, reporting, and constraints.
- Product surfaces: Owner application, Supervisor PWA, and Platform Administration interface.
- Domain services: identity/tenancy, estimation, quotes/orders, production, inventory, dispatch, commercials, payroll, billing, messaging, audit/operations, and reporting.
- Async processing: queue-backed work where needed for messages, webhooks, PDFs, and retries.
- Object storage: client-owned cloud storage for documents/assets.
- Hosting: a client-owned AWS, Azure, or GCP account.
- Source control: client-owned Git repository from project commencement.
- Environments: separate development, QA/staging, and production configuration and credentials.

The application and DevOps diagrams are high-level greenfield target diagrams, not evidence about the current repository (pages 12-13).

## 7. Security and tenant isolation

The proposal calls for organisation scoping on protected reads/writes; application-level authorisation plus database safeguards; server-side validation for material/financial operations; and enforcement for owner, supervisor, platform administrator, and public recipient/buyer roles (page 13).

It also recommends rate limiting for login, access codes, public tracking, and sensitive APIs; secrets outside source control; separate credentials; and least privilege (page 13).

## 8. Data integrity and idempotency

Narola recommends atomic database transactions and controlled state transitions whenever partial completion would create inconsistency (pages 13-15). It explicitly calls for retry-safe/idempotent duplicate clicks, network retries, payment webhooks, stock inward, dispatch, receivables, and settlements (page 14).

The stated cross-module risk controls are transactions, historical snapshots, database constraints, reconciliation rules, and integration tests across production, stock, dispatch, commercials, and payroll (page 15).

Critical security, material, financial, correction, and reversal actions should produce audit/event records (page 14). The proposal does not prescribe full event sourcing.

## 9. Background jobs and asynchronous processing

Queue-backed jobs are recommended where needed for messaging, webhooks, PDFs, and retryable background work (page 11). Option B specifically describes WhatsApp operational messaging as non-blocking, retried, and audited (page 5). The proposal does not select a queue product or demonstrate that every listed activity requires one.

## 10. QA and acceptance strategy

The proposed QA strategy includes (page 14):

- Unit tests for estimator formulas, quantity arithmetic, payroll, and deterministic rules.
- Integration tests for database/service operations, tenant isolation, state transitions, webhooks, and idempotency.
- End-to-end browser tests for principal owner and supervisor workflows.
- Manual mobile/responsive, usability, and exploratory edge-case testing.
- Logged-out, wrong-role, and cross-tenant security tests.
- Representative-volume performance smoke tests.
- UAT against client-supplied textile examples and pilot scenarios.
- No unresolved blocker or critical defect at handover unless expressly accepted in writing.

## 11. Mandatory acceptance journeys

Narola lists these golden journeys (page 14):

1. Fresh owner -> onboarding -> machines/workers/godown/party/quality -> usable estimator.
2. Estimator -> quote -> accepted quote -> order -> loom assignment -> supervisor log -> owner progress -> payroll earning.
3. Market-mode estimator -> market run -> loom assignment -> supervisor log -> stock inward -> partial stock sale -> remaining quantity.
4. Stock/order sale -> dispatch -> public receipt -> shortage/extra reconciliation -> receivable.
5. Worker advance -> payroll preview -> capped deduction -> settlement -> payslip -> remaining advance.
6. Wrong-role, logged-out, and second-tenant attempts against protected routes/APIs.
7. Refresh/re-login after each critical write, including duplicate-click and network-retry checks.

## 12. Observability and operational monitoring

The proposal recommends structured logs, production monitoring/error tracking, and explicit webhook/payment/messaging diagnostics and alerts (page 11). The DevOps architecture adds CI/CD, scalable hosting, logging, backup, and disaster recovery, with final sizing based on provider, availability, projected volumes, and budget (page 13).

No specific error-tracking vendor, correlation-ID scheme, alert thresholds, or sensitive-data logging rules are prescribed.

## 13. Backup, recovery and incident readiness

Backup, restoration, and an incident-response approach should be documented before production handover (page 14). The handover package should include backup/restore and deployment documentation (page 16). Storage/backup budget is estimated separately, indicating an assumed managed operational setup rather than a repository-proven need (page 14).

## 14. Infrastructure assumptions

Narola assumes client-owned cloud, provider, payment, messaging, email, monitoring, and source-control accounts where practical (pages 11, 16, and 18). It budgets:

- Cloud hosting plus managed database: INR 35,000-70,000/month for production plus staging at early year-one scale.
- Storage/backups: INR 5,000-15,000/month.
- Monitoring/error tracking: INR 0-15,000/month initially.
- Email, WhatsApp, and Razorpay: usage/provider fees paid by the client.

The proposal assumes a greenfield build with no reusable code, schema, design system, or tests (page 18). This assumption is fundamentally different from the present repository-grounded review.

## 15. Source-code and IP handover

Subject to the final contract and payment, client-specific source, schema, designs, documentation, and tests would be assigned to the client (page 16). Narola proposes a client-owned Git repository from commencement, disclosure of material pre-existing/commercial/open-source components, documented development/staging/production configuration, deployment/monitoring/backup documentation, training, and client-owned service accounts where practical.

## 16. Warranty and post-launch support

The commercial support model provides (page 15):

- Three-month defect warranty from production acceptance.
- Initial response targets of four business hours for critical, one business day for high, two for medium, and three for low severity during Narola business operations.
- Optional annual maintenance at 15% of implementation value per year, with scope/SLA to be agreed.
- Time-and-material alternative and change requests at INR 1,500 per engineering hour, subject to availability or fixed-price scoping.
- Exclusions from defect warranty for new functionality, changed rules/integrations, third-party API changes, statutory changes, and unauthorised external changes.

## 17. Product or UX ideas

Product ideas with potential independent value include:

- Cost-stack explanation and formula acceptance examples in the Estimator (pages 3 and 15).
- Scenario comparison for changes in rates, output, cost, and margin (page 3).
- Reusable qualities and quote revision/history (page 3).
- Immutable commercial/rate snapshots for quotes and orders (pages 2, 3, and 5).
- Mobile-first, task-focused day/night supervisor workflows (page 5).
- Public dispatch/receipt tracking and variance reconciliation (page 5).
- Actual-metres-per-taka stock semantics (page 6).
- Platform administration/support controls (pages 8 and 12).
- Gujarati/Hindi-ready architecture while launching in English (page 18).
- Offline/low-connectivity assessment for selected workflows (page 8).

These ideas require repository validation before being treated as gaps.

## 18. Optional future modules

Option C proposes separately commissioned modules for (pages 8-10):

- Yarn lots, inward/movements/adjustments, beam cards, allocations, and order-wise yarn planning.
- Deeper party/supplier ledgers, invoices, receipts, allocations, exports, and accounting operations.
- Expanded tenant/subscription/support administration, audit registry, security lockdown/session revocation, and governance cases.
- Advanced analytics, privacy-approved cross-factory benchmarking, prediction, forecasting, and capacity insight.
- Native Android/iOS applications, push notifications, and optional offline capabilities.
- Loom sensors, counters, gateways, automated metre capture, machine status, and telemetry.

Narola explicitly conditions accounting on client-validated rules, prediction on sufficient history, IoT on hardware/API details, and native mobile on separate UX/QA/release work (page 10).

## 19. Recommendations that appear enterprise-heavy

These proposal elements may encode sound principles but are likely oversized if applied literally to an implemented, early-stage product:

- A NestJS-style backend and separate service topology rather than incremental modular-monolith boundaries.
- Client-owned AWS/Azure/GCP hosting regardless of the existing Supabase/Vercel setup.
- Queue infrastructure for every background-capable task rather than a demonstrated retry/outbox gap.
- A ten-person, year-long Option B delivery model despite a substantially implemented repository.
- A broad platform administration interface before specific support operations require it.
- Native mobile applications while a responsive Supervisor PWA can serve pilot workflows.
- Advanced governance, cross-factory analytics, prediction, deep ERP/accounting, and IoT before data, users, and operational ownership justify them.
- INR 40,000-100,000/month baseline infrastructure/storage/monitoring assumptions before measuring current load and service limits.

The review should extract the principles - transactionality, retry safety, traceability, environment separation, recovery, and acceptance proof - while rejecting technologies or staffing assumptions unsupported by repository evidence.

## 20. Questions requiring repository validation

The repository review must answer, rather than assume:

- Are domain boundaries already adequate in the Next.js/Supabase modular monolith, and which mutations actually span domains unsafely?
- Which external calls occur in critical request paths, and are existing provider/webhook retry and deduplication controls sufficient?
- Which critical writes have database-level uniqueness, idempotency keys, atomic RPCs, or only client-side duplicate prevention?
- Which commercial, production, stock, payroll, access, and subscription records are snapshotted, audited, corrected, reversed, or silently overwritten?
- Which listed golden journeys already have automated or runtime evidence, and which remain FAIL/BLOCKED?
- Can a user operation be traced through browser, server, database/RPC, provider, audit, and error tracking without logging sensitive data?
- What backup/restore/rollback proof already exists, how recent is it, and which gaps are only documentation gaps?
- Are performance issues measured at representative volume, and which routes/queries are actually unbounded or waterfall-prone?
- Are owner, supervisor, public, and platform-support experiences genuinely role-specific at runtime?
- Does the existing Estimator already expose its cost stack and allow duplication/comparison without altering validated formulas?
- What minimum platform support tools are operationally required for pilot?
- Are commercial values immutable at quote/order time, historically rate-bound where needed, and compatible with later corrections?
- How are development, QA, and production separated in actual configuration and deployment controls?
- Which proposal principles solve a demonstrated pilot problem, and which would introduce regression risk without a present caller, owner, or validation path?

## Commercial context

Commercial size is useful only for understanding Narola's greenfield assumptions (pages 3, 6, 15, and 18):

| Option | Estimated effort | Price | Timeline | Proposed team |
|---|---:|---:|---:|---:|
| A - Standalone Estimator | Approx. 2,200 hours | INR 33,00,000 plus GST | 24-26 weeks | 7 people |
| B - Full Weavly Suite | Approx. 8,500 hours | INR 1,27,50,000 plus GST | 48-52 weeks | 10 people |
| C - Future modules | To be scoped | To be discussed | To be discussed | Module-dependent |

Warranty is three months. Annual maintenance is proposed at 15% of implementation value; the alternative maintenance/change-request rate is INR 1,500/hour. The cloud, storage/backup, and monitoring assumptions total roughly INR 40,000-100,000/month before usage-based provider charges. These prices and staffing levels explain the breadth and formality of the proposed architecture, but do not prove that literal adoption is appropriate for the current Weavly repository.
