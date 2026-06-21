# Weavly India SaaS Business Launch Master Guide

Last updated: June 15, 2026

> Status: supporting background guide. The authoritative launch-control checklist is now `docs/general/MASTER_BUSINESS_LEGAL_DOCUMENT.md`, source-checked on June 16, 2026. Use that master document for go/no-go decisions, open checklist status, advisor questions, legal-page gaps, incorporation/PAN/GST/Razorpay readiness, grants, cofounder vesting, and profit-extraction planning.

This guide is for turning Weavly from a near-production product into a real Indian software business, with the current founder context in mind:

- Canadian founder currently in India on an e-Business visa.
- One likely India-based cofounder/operator who can manage local operations when the founder returns to Canada.
- First validation customer is the founder's brother, followed by his textile-industry friend circle.
- Product is a multi-tenant textile operations SaaS for Indian weaving factories.
- Phase 1 product is already mostly built: estimator, quote/order, market run, supervisor logging, stock/dispatch, commercials, payroll/advances, WhatsApp, billing/referrals.

This is not legal, tax, immigration, FEMA, or securities advice. Use it as the working checklist for conversations with a company secretary, CA, tax lawyer, FEMA advisor, and immigration lawyer. The goal is to avoid obvious founder mistakes before the first real customer money flows.

## 1. Executive Decision Summary

The recommended setup is:

1. Incorporate an Indian private limited company for Weavly.
2. Appoint at least two directors, with the India-based cofounder/operator acting as the resident India director if they can satisfy the Companies Act resident director requirement.
3. Put all founder equity, vesting, IP assignment, operating authority, and exit terms into a shareholders agreement before the first paying pilots.
4. Keep all customer receipts inside the Indian company bank account. Do not collect SaaS money into personal UPI, personal bank, or a relative's account.
5. Use Razorpay in test mode only until the Indian entity, business PAN, current account, Razorpay KYC, live keys, website policies, GST decision, and webhook production verification are complete.
6. Sell the first commercial package as "factory digitisation setup plus annual maintenance", not as a high monthly SaaS subscription.
7. Use the brother pilot as a no-money or nominal-money operational validation pilot. Use his friend circle as paid design partners only after the pilot gates in this document are passed.
8. Pay yourself through properly documented company routes: founder salary/director remuneration, consulting/management fees, dividend, or later exit proceeds. Each route has tax, visa, FEMA, and Canada tax implications.
9. Before any paying customer uses production, verify the Supabase security migration, RLS, anon grants, Razorpay webhook, secret rotation, rate limiting, backups, Sentry, privacy flows, and WhatsApp consent.

The practical founder stance: preserve control, keep compliance boring, use pilots to prove factory value, charge enough to fund hands-on onboarding, and delay complex enterprise/accounting scope until the Phase 1 operating loop is trusted.

## 2. Best Entity Structure

India does not use the US-style "LLC" term for this setup. The closest choices are a private limited company or an LLP.

| Structure | Fit for Weavly | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Private Limited Company | Best fit | Familiar for SaaS, clean equity, easier future fundraising, Razorpay/business banking credibility, clear ESOP/founder share structure, scalable FDI path | More ROC compliance, audit, board records, annual filings, more CA/CS cost | Recommended |
| LLP | Possible, but less ideal | Simpler profit sharing, lower corporate formality, supported by Razorpay KYC | Less ideal for venture funding/ESOPs, FDI in LLPs needs careful sector/performance-condition review, partner economics can get messy | Use only if you are certain this will remain a closely held cash-flow business |
| Sole proprietorship | Poor fit | Fastest and cheapest | Not appropriate for a Canadian founder, weak liability shield, poor for cofounder equity, hard to separate IP and money | Avoid |
| Partnership firm | Poor fit | Simple domestic arrangement | Foreign founder, liability, IP ownership, banking, and scaling issues | Avoid |
| Canadian company selling directly to India | Possible later | You already understand Canada | Indian GST/OIDAR, customer trust, local collections, UPI/mandate friction, Indian support, and local operator complications | Do not use for the first India textile rollout unless advised by cross-border counsel |

### Why private limited is the default

Private limited gives you the cleanest startup structure:

- Founder and cofounder can hold shares.
- The India-based operator can be a director and local signing authority.
- The Canadian founder can hold equity as a non-resident shareholder, subject to FEMA/FDI reporting.
- Future investors understand the cap table.
- Customer contracts, Razorpay, GST, hiring, vendor contracts, and IP ownership sit inside one entity.
- Profit extraction can be handled through normal company mechanics.

### Minimum private limited requirements to design around

Use a company secretary to confirm the current procedural details. As a working assumption:

- Private limited companies need at least two directors.
- Every company must have at least one director who has stayed in India for at least 182 days in the relevant period under Companies Act section 149. See IndiaCode section 149: https://www.indiacode.nic.in/show-data?actid=AC_CEN_22_29_00008_201318_1517807327856&orderno=153&sectionId=49078&sectionno=149
- A foreign national can be a shareholder and director, but documents, DSC, DIN, notarisation/apostille, and FEMA reporting must be handled correctly.
- DPIIT explains that automatic route FDI does not require prior RBI or Central Government approval, while government route investments do. See DPIIT FDI FAQ: https://www.dpiit.gov.in/static/uploads/2025/07/bdcb2c6eda1dbc1f7c29981e4c3fd428.pdf
- RBI FLA return applies to entities with FDI/ODI, including companies and LLPs, and is due by July 15 of the reporting year. See RBI FAQ: https://www.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=1171

## 3. Founder And Cofounder Structure

Do not treat the India-based cofounder as "just helping" if they will manage customers, support, local payments, onboarding, and factory operations. Define the relationship formally.

### Recommended roles

| Role | Canadian founder | India-based cofounder/operator |
| --- | --- | --- |
| Product vision | Owns roadmap, UX, workflow quality, AI-assisted product development | Gives local workflow feedback, validates field practicality |
| Engineering | Owns app, security, infrastructure, releases | Coordinates bug reports and customer training feedback |
| Sales | Leads positioning, pricing, founder-led selling | Handles warm introductions, factory visits, local demos |
| Customer success | Builds onboarding playbook, data templates, support process | Runs setup/training on the ground |
| Legal/business | Drives incorporation, cap table, contracts | Resident director/local authorized signatory if appropriate |
| Money control | Co-approver on bank and spending | Local execution with spending limits |

### Equity and vesting

Do not give permanent equity without future contribution protection.

Recommended structure:

- Founder equity should reflect who created the product and owns the vision.
- Cofounder/operator equity should vest over time or milestones, not be fully earned on day one.
- Use a 4-year vesting period with a 1-year cliff, or a milestone-based local-operator vesting schedule if the role is part-time.
- Add founder reverse vesting, bad-leaver/good-leaver clauses, IP assignment, confidentiality, non-solicit, decision rights, share transfer restrictions, and deadlock handling.
- If the local person is mainly operations/sales rather than true cofounder, consider salary plus sales/implementation commission first, with equity options later.

### Control recommendation

Keep product and company control with the founder until revenue, customer value, and the working relationship are proven. A practical early split could be:

- Founder majority control.
- Local cofounder/operator minority stake with vesting.
- Board/signing authority structured so neither person can drain funds, issue shares, change bank access, or assign IP unilaterally.

Your company secretary and lawyer should convert this into articles, SHA, board resolutions, and employment/consulting agreements.

## 4. Visa And Founder Presence

Your e-Business visa is helpful for setup and market validation, but it should not be treated as permission to work like a local employee indefinitely.

Working rules to confirm with immigration counsel:

- e-Business/business visa activity can include establishing or exploring a business venture. Indian government material says e-Business visa continuous stay during each visit should not exceed 180 days. See PIB: https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1564759
- MEA FRRO guidance says foreign nationals with stays of 180 days or less generally do not require registration, while longer stays trigger registration requirements. See MEA: https://www.mea.gov.in/visa-related-services-provided-by-frros-fros-menu
- Do not draw India employment salary while physically working in India unless your visa and tax position support it.
- When you return to Canada, structure your role as non-resident shareholder/director, consultant, or employee only after tax/immigration review.

Practical approach:

1. Use the current India stay to incorporate, validate workflow, meet customers, hire local help, and set up operations.
2. Do not overstay or blur business visa and employment visa boundaries.
3. Document founder services through board-approved agreements once money starts moving.
4. Keep travel, board meetings, customer visits, and work location records for tax residency and visa clarity.

## 5. Incorporation And Setup Roadmap

### Phase A: Decide structure and prepare documents

Owner: founder plus CS/CA

Prepare:

- Company name options.
- Registered office address and NOC/lease/utility proof.
- Director list.
- Shareholder list.
- Proposed capital and shareholding.
- DSC for Indian director and foreign founder/director.
- DIN applications where needed.
- Passport, address proof, photos, and contact details.
- Notarised/apostilled documents for the Canadian founder as required.
- Business activity description: textile operations software/SaaS, IT services, implementation, training, support.
- Trademark/domain review for "Weavly".

### Phase B: Incorporate private limited company

Owner: CS

Typical company incorporation path uses MCA SPICe+ and linked forms. Government parliamentary material describes SPICe+ as an integrated web form for name reservation, incorporation, DIN, PAN, TAN, EPFO, ESIC, profession tax in certain states, bank account opening, GSTIN if applied for, and some shops and establishment registration. See Sansad/MCA reply: https://sansad.in/getFile/annex/258/AU670.pdf?source=pqars

Expected outputs:

- Certificate of incorporation.
- Company PAN.
- TAN.
- CIN.
- Company current account path.
- EPFO/ESIC registration numbers if issued through incorporation workflow.
- GSTIN if applied for.

### Phase C: Post-incorporation

Owner: CS/CA/founder

Do immediately:

- Open/activate current account.
- Set accounting software.
- Issue share certificates.
- Maintain statutory registers.
- Record first board meeting.
- Appoint auditor.
- Approve bank signatories and spending limits.
- Execute founder IP assignment and SHA.
- Execute cofounder/operator role agreement.
- Decide GST registration timing.
- Register for Startup India recognition if eligible.
- Decide Udyam/MSME registration if useful.

DPIIT Startup India recognition is available to eligible private limited companies, LLPs, registered partnerships, and cooperative societies, subject to turnover/age/innovation criteria. See Startup India: https://www.startupindia.gov.in/content/sih/en/startupgov/startup_recognition_page.html

### Phase D: Foreign investment compliance

Owner: CA/FEMA advisor

If the Canadian founder invests equity:

- Bring money only through proper banking channels into the company account.
- Obtain FIRC/KYC documentation from the bank.
- Complete required RBI/FIRMS/FC-GPR reporting for share issuance.
- Maintain valuation/pricing documentation.
- File annual FLA return if applicable.

Do not casually reimburse yourself with shares, undocumented loans, personal UPI, or third-party deposits. Cross-border founder money is where paperwork matters.

## 6. GST, Tax, And Accounting

### GST

For Weavly's Indian factory customers, assume the clean commercial path is GST registration and GST invoices before paid pilots.

Why:

- B2B customers may want GST invoices and input tax credit.
- Razorpay KYC/business verification is easier with proper business documents.
- It keeps pricing transparent from the first paid invoice.
- It avoids needing to migrate pilot customers from informal receipts to compliant invoices.

Working rules:

- GST Council IT/ITES FAQ states the GST rate on IT services is 18%. See GST Council IT/ITES FAQ: https://gstcouncil.gov.in/sites/default/files/2024-02/sectoral-faq-it-ite.pdf
- General GST service registration threshold is Rs 20 lakh in normal category states and Rs 10 lakh in special category states, but inter-state, export, e-commerce, and B2B edge cases should be reviewed by a CA.
- If selling to overseas customers later, export of software/services may be zero-rated if export conditions are satisfied, with LUT/refund mechanics.

Implementation:

- Show prices as "plus GST" in proposals.
- Issue tax invoices from the Indian company.
- Keep Razorpay payment ID mapped to invoice/customer/org.
- Reconcile Razorpay settlement fees, TDS/TCS if any, refunds, chargebacks, and GST.
- Maintain separate ledgers for implementation fee and recurring subscription.

### Income tax

For domestic companies, the Income Tax Department lists AY 2026-27 company rates including 22% under section 115BAA if opted, 25% for certain companies, and 30% otherwise, excluding surcharge and cess. See Income Tax Department: https://www.incometax.gov.in/iec/foportal/help/company/return-applicable

Practical rules:

- Have the CA choose the tax regime.
- Keep founder reimbursements documented.
- Deduct TDS where required.
- File TDS returns if paying salary, contractor fees, rent, professional fees, or non-residents.
- File company income tax return.
- Audit financials as required for companies.

### Accounting stack

For the first year:

- Use Zoho Books, Tally, or another India GST-capable system.
- Keep Razorpay, bank, GST invoices, receipts, refunds, and subscription ledger reconcilable.
- Create cost centers: hosting, WhatsApp, Razorpay fees, contractor/AI tools, travel, implementation, customer support, legal, accounting.
- Track customer acquisition cost manually at first.

## 7. Getting Paid Personally And Taking Profits Out

This is the area where you need CA plus Canada tax advice. The goal is to get money into your pocket without creating visa, FEMA, TDS, transfer-pricing, or Canada tax problems.

### Rule 1: Company money is not founder money

Once Weavly invoices customers, money belongs to the Indian company. Pay yourself through an approved route.

Avoid:

- Customer payments to personal accounts.
- Personal UPI collections.
- Cash "pilot fees".
- Undocumented "repayments" to the founder.
- Expenses without bills.
- Paying yourself from Razorpay settlements before accounting.

### Route A: Salary or director remuneration

Best when:

- You are actively working for the Indian company.
- Your visa and tax position allow it.
- The board approves remuneration.
- Payroll/TDS is handled.

Risks:

- If you are physically in India on a business visa, employment-style salary may be a visa problem.
- If you are Canadian tax resident, Canada reporting/tax credits need review.
- Director remuneration has Companies Act, tax, and FEMA considerations.

### Route B: Consulting or management fee to you or a Canadian entity

Best when:

- You return to Canada and provide product/engineering/founder services from Canada.
- The Indian company has a written services agreement.
- Fees are market-rate and defensible.
- TDS and remittance documents are handled.

Risks:

- Payments to non-residents can trigger Indian withholding and Form 15CA/15CB.
- Transfer pricing may apply if related-party arrangements become significant.
- Canada tax and GST/HST treatment need review.

### Route C: Dividend

Best when:

- Company has post-tax distributable profits.
- You want owner returns rather than service compensation.
- Board/shareholder process is followed.

Risks:

- Dividends are paid after company tax.
- Income Tax Department notes non-resident dividend income is taxable at a special 20% rate subject to DTAA. See Income Tax Department dividend guidance: https://www.incometaxindia.gov.in/taxation-of-dividend-and-interest
- India-Canada treaty text lists dividend withholding limits of 15% in one corporate-control case and 25% in other cases, subject to treaty conditions and documentation. See Canada treaty text: https://www.treaty-accord.gc.ca/text-texte.aspx?id=102409&lang=eng
- You may need TRC/Form 10F and CA handling to claim treaty benefit.

### Route D: Expense reimbursement

Best when:

- You incurred real business expenses for the company.
- Bills are in the correct name where possible.
- Board/accounting policy allows reimbursement.

Risks:

- Poor documentation can be disallowed or treated as income.
- Travel and mixed personal/business costs need careful treatment.

### Practical first-year extraction plan

1. First 3 to 6 months: keep cash inside the company; only reimburse documented setup expenses.
2. Once there are 3 to 5 paying customers: pay modest founder consulting or salary only if the CA confirms the route.
3. Once annual profits are real: consider dividends after tax, audit, and working-capital buffer.
4. Keep at least 6 months of hosting, WhatsApp, support, travel, and compliance runway in the company.

## 8. Razorpay And Payment Setup

### Current product state

The codebase currently has Razorpay subscription routes, a billing page, trial logic, subscription payments, referral conversion/refund support, and webhook idempotency. The pricing guide in `docs/pricing-strategy-and-billing-migration-guide.md` recommends shifting from monthly Base/Premium SaaS pricing to implementation fee plus annual maintenance.

### Payment strategy

Recommended launch offer:

| Package | Use | Price |
| --- | --- | --- |
| Brother pilot | workflow validation | Free or nominal, no production payment dependency |
| Design partner | first 3 to 5 friend-circle factories | Rs 19,999 to Rs 29,999 setup + Rs 9,999 to Rs 19,999 annual, plus GST |
| Factory Loop | public first package | Rs 49,999 setup + Rs 19,999 annual, plus GST |
| Multi-unit | later | custom setup + custom annual support |

Do not position the setup fee as pure software rent. Position it as:

- factory setup
- data migration
- owner training
- supervisor training
- payroll/stock workflow calibration
- WhatsApp/template setup
- first-month handholding

### Razorpay KYC sequence

Razorpay documents that test mode does not involve actual money transactions and live/test API keys are separate. See Razorpay setup docs: https://razorpay.com/docs/payments/set-up/ and test/live docs: https://razorpay.com/docs/payments/dashboard/test-live-modes/?preferred-country=IN

Razorpay KYC documents vary by business type and include private limited and LLP categories. See Razorpay KYC docs: https://razorpay.com/docs/payments/business-types-kyc-documents/

Before live payments:

- Complete entity incorporation.
- Get business PAN.
- Activate current account.
- Decide and obtain GSTIN if registering.
- Add website/domain.
- Publish terms, privacy, refund, cancellation, contact, pricing, and support details.
- Complete Razorpay KYC as the correct business type.
- Generate live keys only in live mode.
- Store keys only in Vercel/Supabase secret managers.
- Configure live webhook endpoint.
- Verify webhook secret.
- Run a real low-value live payment only after CA confirms invoicing/GST flow.

### Subscription architecture

Razorpay Subscriptions supports setup/upfront amount via `addons`, future start via `start_at`, and recurring payment methods including cards, UPI Autopay, and eMandate. See Razorpay subscriptions docs: https://razorpay.com/docs/payments/subscriptions/create/?preferred-country=IN and supported methods: https://razorpay.com/docs/payments/subscriptions/supported-payment-methods/?preferred-country=IN

Target implementation:

- Create annual Razorpay plans.
- Use `addons` for one-time setup fee.
- Use `start_at` if the annual maintenance should begin after onboarding.
- Store `commercial_package` separately from `plan_tier`.
- Continue using feature gates as base/premium internally.
- Map payment to org, invoice, subscription, package, setup fee, annual fee, and GST.

### Webhook production checklist

Razorpay says webhook signature validation uses HMAC SHA256 over the raw webhook body and the `X-Razorpay-Signature` header; it also recommends idempotency using `x-razorpay-event-id`. See Razorpay webhook docs: https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN

Current code already does the important parts:

- Raw body signature validation.
- Timing-safe compare.
- Public POST rate limiting.
- Webhook event idempotency ledger.
- Generic client errors.
- Payment duplicate checks.

Before production:

- Configure `/api/webhooks/razorpay` in live Razorpay dashboard.
- Set `RAZORPAY_WEBHOOK_SECRET`.
- Subscribe to subscription and payment events needed by the app.
- Test on staging using test webhooks.
- Test live with a low-value internal transaction.
- Confirm `razorpay_webhook_events` records `processed`.
- Confirm subscription gates update without manual DB edits.

## 9. Legal Documents To Prepare Before Paid Pilots

Minimum customer-facing documents:

- Master services agreement or simple SaaS terms.
- Order form/proposal with setup fee, annual fee, GST, payment terms, pilot duration, included support, and renewal.
- Privacy policy.
- Data processing addendum for factory worker/personal data.
- Refund/cancellation policy.
- WhatsApp consent wording.
- Acceptable use/security clause.
- Support policy and response expectations.
- Data export and termination clause.
- Limitation of liability.
- Confidentiality clause.

Minimum founder/company documents:

- Shareholders agreement.
- Founder IP assignment.
- Cofounder/operator agreement.
- Board resolutions for bank, Razorpay, GST, and contracts.
- Expense reimbursement policy.
- Related-party services agreement if paying founder/Canadian entity.
- Contractor IP assignment for anyone who touches code, design, data, implementation, or support.

Minimum operational policies:

- Incident response plan.
- Backup/restore plan.
- Access-control policy.
- Customer onboarding checklist.
- Customer offboarding checklist.
- Data deletion/export procedure.
- Support escalation process.

## 10. Data Protection, Security, And Privacy Compliance

Weavly handles sensitive operational and personal data:

- Owner and supervisor names, phone numbers, emails, roles.
- Worker names, wages, attendance, advances, payroll, payslips.
- Party/customer contact and GST details.
- Factory financials, production, revenue, receivables, margins.
- WhatsApp consent and delivery logs.

### DPDP

The Government of India notified the DPDP Rules, 2025 on November 14, 2025, giving effect to the Digital Personal Data Protection Act, 2023. PIB's explainer identifies principles including consent/transparency, purpose limitation, data minimisation, accuracy, storage limitation, security safeguards, and accountability. See PIB: https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf

Before paid pilots:

- Use a clear privacy notice for owners, supervisors, workers, and parties.
- Collect only data needed for factory operations.
- Capture WhatsApp opt-in separately from account creation.
- Keep worker payroll and advances access limited.
- Provide export/delete request process.
- Do not train external AI tools on customer data unless the contract and consent allow it.
- Maintain breach response steps.
- Document data processors: Supabase, Vercel, Sentry, Razorpay, WhatsApp/Meta, Upstash, any analytics provider.

### CERT-In

CERT-In directions require service providers, intermediaries, data centres, body corporates, and government organisations to report listed cyber incidents within 6 hours of noticing or being notified. See CERT-In directions: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf

Practical response:

- Keep Sentry alerts on.
- Keep production access logs and audit logs.
- Maintain incident contact list.
- Know who files reports if a breach occurs.
- Keep time sync/log retention enabled.
- Pre-write a breach triage template.

## 11. Weavly Product Readiness Before Brother Pilot

Do the brother pilot as a structured factory validation session, not a casual demo.

Use `docs/factory-showcase-feedback-guide.md` as the walkthrough script. This master guide adds business and launch gates around it.

### Pre-pilot technical checklist

Must be ready:

- Production or staging URL stable on mobile.
- Clean pilot organisation.
- Owner account.
- Supervisor account.
- 2 to 3 machines matching the factory.
- 2 to 3 workers, including meter-based and fixed salary examples.
- Production mode selected.
- Payroll cycle/pay date configured.
- Factory cost profile set.
- WhatsApp simulation or live send path decided.
- Razorpay kept out of real collection unless live KYC is ready.
- Sentry enabled.
- Backups configured.
- Access codes tested.
- Policies visible: privacy, terms, refund.

### Workflows that must work in the pilot

1. Owner signup/onboarding.
2. Factory setup: machines, workers, payroll timing, production mode.
3. Estimator using at least 3 real fabric qualities from the brother's business.
4. Quote save and restore.
5. Quote accept and order conversion.
6. Market run creation from estimator.
7. Supervisor mobile production logging.
8. Copy previous shift.
9. Duplicate/correction flow with owner access code.
10. Owner Factory Today action center.
11. Order/market-run progress.
12. Stock expected godown view.
13. Party-first stock sale.
14. Dispatch batch and owner receipt confirmation.
15. Commercials receivable and gross profit.
16. Worker advance.
17. Payroll preview and settlement.
18. Payslip generation or WhatsApp simulation.
19. Billing/trial page only as demonstration if live payments are not ready.

### What to confirm during the brother pilot

Ask for real data, not opinions only:

- Does estimator math match his current parchi/Excel for 3 actual qualities?
- Which fields are missing from costing?
- Does the owner understand landed cost, margin, and quote price quickly?
- Can a supervisor log a shift on a phone without your help?
- Does "Copy Previous Shift" reduce enough data-entry pain?
- Are access-code protections acceptable or too strict?
- Does stock/dispatch reflect real godown practice: meters, takas, partial dispatch, shortage/excess?
- Does payroll match the current worker hisaab/Upaad method?
- Does WhatsApp add trust or noise?
- Which one workflow would make him pay?
- What price would feel fair for setup and annual maintenance?
- Would he introduce you to 3 factory owners after using it?

### Brother pilot success definition

Do not expand to paying pilots until these are true:

- Three real estimator examples reconcile within an acceptable tolerance agreed by the brother.
- Supervisor can log at least 5 to 10 shifts with minimal help.
- Owner can answer "what happened today?" from Factory Today/analytics.
- One stock sale to dispatch to receipt to commercials path is completed.
- One payroll/advance path is explainable to a worker.
- No critical security, data-loss, or tenant-isolation issue appears.
- Brother can name the top 3 value drivers and top 3 blockers.
- Brother is comfortable introducing friend-circle factories with a clear pilot pitch.

## 12. Gate To Friend-Circle Pilots

Friend-circle pilots are not the same as the brother pilot. They are the first test of whether strangers will tolerate onboarding friction and attach real value to the product.

### Entry criteria

Before inviting them:

- Fix all P0 and P1 issues from brother pilot.
- Freeze pilot scope. Do not promise full ERP, Tally replacement, GST filing, automatic bank reconciliation, or deep yarn inventory.
- Prepare a 1-page offer.
- Prepare a 30-day pilot agreement.
- Decide whether the pilot is free, refundable, or paid design partner.
- Set customer support channel and response window.
- Set data ownership/export terms.
- Set WhatsApp consent language.

### Recommended friend-circle design partner offer

Use a paid but discounted offer:

- Rs 19,999 to Rs 29,999 setup plus GST.
- Annual maintenance waived for first 60 to 90 days or priced at Rs 9,999 to Rs 19,999 plus GST.
- In exchange, they agree to weekly feedback, testimonial if successful, and 2 referrals.
- Limit to 3 to 5 factories.

Do not over-customize for each pilot. Every custom request should be tagged:

- Must-have for all weaving factories.
- Useful but later.
- One-customer custom.
- Out of scope.

## 13. Security: What Works So Far

Evidence reviewed from the repo:

- `SECURITY.md`
- `SECURITY_HARDENING_REPORT.md`
- `lib/auth.ts`
- `proxy.ts`
- `next.config.ts`
- `app/api/webhooks/razorpay/route.ts`
- `lib/rate-limit.ts`
- `lib/supabase/admin.ts`
- Supabase migrations, especially `20260601233631_production_security_hardening.sql`
- `BROWSER_WORKFLOW_QA_REPORT.md`

Current strong points:

- Multi-tenant security model is org-scoped through `org_id`.
- Server-side `requireRole()` validates role and org from database profile rows after `getUser()`.
- Service-role Supabase client is server-only.
- Protected routes and APIs are handled in `proxy.ts`.
- Public webhook routes are separated and authenticate internally.
- One-hour inactivity timeout exists.
- Revoked-session checks exist if Upstash is configured.
- Owner/supervisor route mismatch redirects exist.
- Owner access codes protect sensitive supervisor corrections and destructive flows.
- Access codes are validated, consumed, and rate-limitable.
- CSP, HSTS in production, X-Frame-Options, nosniff, referrer, and permissions headers are configured in `next.config.ts`.
- Razorpay webhook uses raw body HMAC validation and timing-safe compare.
- Razorpay webhook has event idempotency ledger.
- Public POST/webhook rate limiter exists.
- Public tracking was hardened to avoid exposing internal UUIDs according to the hardening report.
- Major hardening migration enables RLS across current public base tables and revokes broad anon grants according to `SECURITY_HARDENING_REPORT.md`.
- Prior QA report shows browser console, lint, build, and Vitest gates passed on June 1, 2026.

## 14. Security: Must Tighten Before Real Pilots

Treat these as production blockers for paying customers.

### Database and tenant isolation

- Deploy `supabase/migrations/20260601233631_production_security_hardening.sql` to production.
- Verify every public base table has RLS enabled.
- Verify `anon` has no broad table/sequence grants.
- Verify subscription/payment tables are service-managed.
- Verify public tracking RPC grants are service-role only where intended.
- Run at least one cross-tenant access test: owner A must not read owner B workers, payroll, stock, dispatches, commercials, WhatsApp logs, or billing state.

### Secrets

- Rotate Supabase service role key if ever shared outside secret manager.
- Rotate Razorpay keys after switching from test to live if copied into unsafe places.
- Rotate Upstash and Sentry keys if exposed.
- Move pg_cron/pg_net auth material out of `whatsapp_settings` into Supabase Vault or another managed secret path.
- Keep `.env.local` out of Git and screenshots.

### Rate limiting

`lib/rate-limit.ts` fails open if Upstash Redis is missing. That is acceptable for local development but not for production.

Before paid pilots:

- Set `UPSTASH_REDIS_REST_URL`.
- Set `UPSTASH_REDIS_REST_TOKEN`.
- Test auth route rate limiting.
- Test access-code lockout.
- Test public webhook rate limiting.

### Payments

- Configure live Razorpay webhook endpoint and secret.
- Test event replay/idempotency.
- Confirm duplicate webhook delivery does not duplicate payments/refunds.
- Confirm test keys cannot be used in production deployment.
- Add an environment sanity check that blocks live deployment if key prefixes are mismatched.

### Privacy and logging

- Confirm Sentry does not capture payroll/worker personal data, access codes, service keys, Razorpay signatures, or full webhook payloads.
- Confirm console logs do not leak customer data.
- Confirm audit logs record sensitive actions.
- Confirm data export/delete flows are documented and working for pilot data.

### Backups and restore

- Enable Supabase backups appropriate for production.
- Test restore into a non-production project.
- Export schema and migration state.
- Document who can restore and how long it takes.

### AI tool hygiene

Because the product was built with AI tools:

- Do not paste live customer data, payroll records, personal phone numbers, GSTINs, payment IDs, or secrets into public AI tools.
- Use synthetic or redacted data for debugging.
- Add a customer-data handling policy before friend-circle pilots.

## 15. Support And Operations When Founder Returns To Canada

The company needs to function without the founder physically in India.

### Local operator authority

The India-based operator can handle:

- Factory visits.
- Onboarding.
- Training.
- First-level support.
- Data collection templates.
- Customer relationship management.
- Local language explanation.
- Escalation triage.

They should not be able to:

- Change source code or production env vars.
- View service-role keys.
- Withdraw arbitrary funds.
- Sign large contracts alone.
- Promise custom features without approval.
- Delete customer data without formal request.

### Operating cadence

Weekly:

- Active pilot status.
- Bugs by severity.
- Customer adoption metrics.
- Cash collected/outstanding.
- Implementation workload.
- Roadmap requests.

Monthly:

- P&L.
- Bank/Razorpay reconciliation.
- GST/TDS status.
- Security review.
- Customer health.
- Sales pipeline.

### Support model

For first 5 customers:

- WhatsApp support group with owner/operator/founder.
- Issue tracker in Notion/GitHub.
- Severity definitions.
- Daily response for P0/P1 during working days.
- Weekly customer success call during onboarding.

Do not promise 24/7 support unless priced.

## 16. Long-Term Roadmap

### 0 to 30 days: foundation and brother pilot

- Incorporation decision and professional team selected.
- Founder/cofounder agreement drafted.
- Business bank/Razorpay/GST path started.
- Brother pilot environment ready.
- Security production checklist executed.
- Pilot walkthrough completed.
- Top product blockers fixed.

### 30 to 90 days: design partner pilots

- 3 to 5 factories onboarded.
- Setup fee collected through compliant company route.
- Core operating loop used for real shifts.
- Weekly feedback loop.
- Pricing validated.
- Onboarding playbook stabilized.
- Support burden measured.
- No broad feature expansion unless it improves Phase 1.

### 3 to 6 months: repeatable sales

- Public Factory Loop package launched.
- Landing page/pricing/terms aligned.
- Razorpay annual setup model live.
- Case study from first successful factory.
- Referral motion through textile owner network.
- Local operator can onboard without founder present.
- Product analytics added for activation and retention.

### 6 to 12 months: operational maturity

- More robust billing packages.
- Customer data import tooling.
- Admin support console with strict audit.
- Better WhatsApp templates and opt-out handling.
- Stronger reporting for owners.
- Hardened incident response.
- Formal roadmap based on paid usage, not demo requests.

### 12 to 24 months: category expansion

Only after Phase 1 has paying retention:

- Multi-unit groups.
- Broker/trader workflows.
- Deeper supplier ledger.
- Advanced inventory if market proves it.
- Tally/accounting exports, not full accounting replacement.
- Bank reconciliation if customers demand it.
- Role-based admin/customer-success tooling.
- Additional textile clusters beyond Surat.

## 17. Metrics To Track From Day One

Business:

- Setup fees collected.
- Annual subscription committed.
- Cash received vs receivables.
- Gross margin after hosting, WhatsApp, Razorpay, support, travel.
- Time to onboard a factory.
- Support hours per factory per week.

Product:

- Estimator quotes created per factory.
- Quotes accepted.
- Production logs per active machine per week.
- Supervisor logging completion rate.
- Payroll previews generated.
- Advances recorded.
- Dispatches recorded.
- Commercial receivables tracked.

Adoption:

- Owner active days per week.
- Supervisor active shifts per week.
- Number of manual WhatsApp/support corrections needed.
- Features used by at least 3 factories.
- Features ignored by all pilots.

Risk:

- P0/P1 bugs.
- Cross-tenant/security issues.
- Data correction incidents.
- Payment/webhook failures.
- Backup/restore test age.

## 18. The 14-Day Action Plan

Day 1 to 2:

- Choose private limited unless CS/CA gives a strong reason not to.
- Shortlist CS, CA, FEMA/tax advisor, and immigration lawyer.
- Decide founder/cofounder roles and draft equity assumptions.
- Freeze pilot scope around Phase 1.

Day 3 to 5:

- Prepare incorporation documents.
- Prepare registered office proof.
- Prepare foreign founder documents for notarisation/apostille.
- Draft SHA and IP assignment terms.
- Confirm visa limits and Canada tax questions.

Day 6 to 8:

- Prepare brother pilot org and data.
- Run technical smoke across estimator, quote/order, supervisor log, stock/dispatch, commercials, payroll, WhatsApp simulate, access code.
- Verify security migration status in production/staging.
- Configure Sentry and backups.

Day 9 to 11:

- Run brother pilot.
- Record exact costing examples, workflow blockers, price reaction, and adoption concerns.
- Fix P0/P1 issues only.

Day 12 to 14:

- Decide friend-circle pilot offer.
- Prepare 1-page proposal and pilot agreement.
- Complete Razorpay/GST/bank setup path if incorporation is ready.
- Create the first design partner list and introduction script.

## 19. Professional Questions To Ask

Ask CS:

- What is the cleanest private limited incorporation path with one Canadian founder and one Indian resident director?
- What documents need notarisation/apostille?
- How should shares be issued to the foreign founder?
- What board/shareholder approvals are needed for bank, Razorpay, founder remuneration, and IP assignment?

Ask CA/FEMA advisor:

- What is the correct FDI sector/classification for Weavly?
- What RBI/FIRMS filings are required when the Canadian founder remits capital?
- Should GST registration happen before first paid pilot?
- What SAC should invoices use?
- How should implementation fee plus annual maintenance be invoiced?
- What TDS applies to founder consulting, director remuneration, dividends, and foreign remittances?
- What India-Canada treaty documentation is needed?

Ask Canada tax advisor:

- How will Indian salary, consulting fees, dividends, or director fees be taxed in Canada?
- Should the founder invoice through a Canadian corporation or personally?
- What foreign asset/share reporting is required in Canada?
- How do foreign tax credits apply?

Ask immigration lawyer:

- What business activities are safe on current e-Business visa?
- Can the founder be a director while on e-Business visa?
- Can the founder receive remuneration while physically in India?
- What visa is needed for future extended India operating periods?

Ask lawyer:

- SHA, vesting, IP assignment, founder services agreement.
- SaaS terms, DPA, pilot order form, refund/cancellation policy.
- Data processing and liability caps for payroll/worker data.

## 20. Source Register

Regulatory and payment sources reviewed:

- Companies Act section 149, IndiaCode: https://www.indiacode.nic.in/show-data?actid=AC_CEN_22_29_00008_201318_1517807327856&orderno=153&sectionId=49078&sectionno=149
- DPIIT FDI FAQ: https://www.dpiit.gov.in/static/uploads/2025/07/bdcb2c6eda1dbc1f7c29981e4c3fd428.pdf
- RBI FLA return FAQ: https://www.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=1171
- MCA/SPICe+ parliamentary reply: https://sansad.in/getFile/annex/258/AU670.pdf?source=pqars
- Startup India recognition: https://www.startupindia.gov.in/content/sih/en/startupgov/startup_recognition_page.html
- Income Tax Department domestic company rates: https://www.incometax.gov.in/iec/foportal/help/company/return-applicable
- Income Tax Department dividend guidance: https://www.incometaxindia.gov.in/taxation-of-dividend-and-interest
- India-Canada tax treaty text: https://www.treaty-accord.gc.ca/text-texte.aspx?id=102409&lang=eng
- GST Council IT/ITES FAQ: https://gstcouncil.gov.in/sites/default/files/2024-02/sectoral-faq-it-ite.pdf
- DPDP Rules 2025 PIB explainer: https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf
- CERT-In directions: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf
- PIB e-Business visa stay update: https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1564759
- MEA FRRO visa services guidance: https://www.mea.gov.in/visa-related-services-provided-by-frros-fros-menu
- EPFO employer threshold material: https://www.epfindia.gov.in/site_docs/PDFs/Updates/Presentation_ERservices062016.pdf
- ESIC coverage: https://esic.gov.in/coverage
- Surat professional tax FAQ: https://www.suratmunicipal.gov.in/FAQs/ProfessionTax
- Razorpay setup: https://razorpay.com/docs/payments/set-up/
- Razorpay business KYC docs: https://razorpay.com/docs/payments/business-types-kyc-documents/
- Razorpay test/live modes: https://razorpay.com/docs/payments/dashboard/test-live-modes/?preferred-country=IN
- Razorpay API keys: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/?preferred-country=IN
- Razorpay subscriptions create/upfront amount: https://razorpay.com/docs/payments/subscriptions/create/?preferred-country=IN
- Razorpay subscription payment methods: https://razorpay.com/docs/payments/subscriptions/supported-payment-methods/?preferred-country=IN
- Razorpay webhook validation/idempotency: https://razorpay.com/docs/webhooks/validate-test/?preferred-country=IN

Repo sources reviewed:

- `docs/general/MASTER_PRODUCT_DOCUMENT.md`
- `docs/general/PHASE_1_SCOPE.md`
- `docs/general/CURRENT_PRODUCT_IMPLEMENTATION_ANALYSIS.md`
- `docs/pricing-strategy-and-billing-migration-guide.md`
- `docs/factory-showcase-feedback-guide.md`
- `TESTING_GUIDE.md`
- `SECURITY.md`
- `SECURITY_HARDENING_REPORT.md`
- `BROWSER_WORKFLOW_QA_REPORT.md`
- `lib/auth.ts`
- `proxy.ts`
- `next.config.ts`
- `app/api/subscriptions/create/route.ts`
- `app/api/webhooks/razorpay/route.ts`
- `lib/rate-limit.ts`
- `lib/supabase/admin.ts`
- `supabase/migrations/20260601233631_production_security_hardening.sql`
