# Weavly Business And Legal Readiness Master Document

Last source-checked: June 16, 2026

This is the operating checklist for moving Weavly from a near-production textile SaaS into a legally chargeable business. It is not legal, tax, immigration, FEMA, accounting, or securities advice. Use it to brief an Indian company secretary, Indian CA, Indian startup lawyer, FEMA advisor, immigration lawyer, Canadian CPA, and Canadian business lawyer.

The goal is simple: once the open checklist items here are completed and verified, Weavly should be ready to onboard paying Indian textile customers through a proper entity, proper contracts, proper payment rails, proper privacy/security controls, and a clean founder-money structure.

## 1. Current Situation

Founder context:

- Canadian founder currently in India on an e-Business visa.
- Product is roughly 80-90% complete for a production build, with testing and polish remaining.
- First real pilot will be with your brother's factory context.
- If the brother pilot passes, next pilots will come from his textile-industry friend circle.
- A likely India-based cofounder/operator may handle local onboarding, training, and support after you return to Canada.
- The app is a multi-tenant textile operations SaaS for Indian weaving factories: estimator, quotes/orders, market runs, supervisor production logs, stock, dispatches, commercials, payroll, advances, WhatsApp, billing/referrals, and compliance/security records.

Working business stance:

- Brother pilot is a controlled validation exercise, not a public launch.
- Friend-circle pilots are design-partner pilots, not open self-serve SaaS.
- External paid onboarding should wait until entity, payment, tax, legal, privacy, security, and support gates are complete.

## 2. Executive Recommendation

Default recommendation:

1. Use an Indian private limited company as the first operating company for Indian factory customers.
2. Keep the Indian entity as the contracting, invoicing, GST, Razorpay, support, and implementation entity.
3. Make the India-based cofounder/operator a resident director only if they are genuinely trusted, active, and bound by vesting, confidentiality, IP, leaver, and spending controls.
4. Do not collect customer money into personal bank accounts, personal UPI, a relative's account, or a temporary informal account.
5. Sell the first paid offer as "factory digitisation setup + annual maintenance", not only as monthly SaaS rent.
6. Keep Razorpay in test mode until the company PAN, current account, KYC, live keys, GST/invoicing plan, live webhook, and legal pages are ready.
7. Pay yourself only through documented channels: salary/director remuneration, consulting/management fees, dividends, founder loan repayment, expense reimbursement, or later share sale/buyback. Each needs tax and FEMA review.
8. Apply for Startup India/DPIIT recognition after incorporation. Treat grants and tax benefits as upside, not as launch-critical cash.

Primary launch blocker today: the app has public legal pages and payment code, but the legal copy, pricing model, data export/delete coverage, DPA/subprocessor posture, and production security/payment verification are not yet aligned for paid launch.

## 3. Master Launch Checklist

Use this section as the live board. Do not mark an item complete until there is evidence: filed document, signed contract, deployed code, verified payment, advisor email, board resolution, or production test.

### 3.1 Professional Team

- [ ] Indian company secretary selected.
- [ ] Indian CA selected.
- [ ] Indian startup/company lawyer selected.
- [ ] FEMA/cross-border tax advisor selected if Canadian founder receives shares or money crosses borders.
- [ ] Immigration lawyer consulted on e-Business visa limits and director/remuneration questions.
- [ ] Canadian CPA consulted on residency, India-source income, dividends, foreign tax credits, foreign assets, and possible Canadian corporation use.
- [ ] Single shared folder created for incorporation, tax, contracts, board minutes, invoices, KYC, and advisor memos.

### 3.2 Entity And Incorporation

- [ ] Decide entity path: Indian private limited company unless advisors identify a stronger reason for LLP/Canada-first.
- [ ] Confirm proposed company name and trademark/domain risk.
- [ ] Confirm directors and resident director.
- [ ] Confirm shareholder split and investment route.
- [ ] Prepare registered office proof, owner NOC/lease, utility bill, and local address details.
- [ ] Prepare Canadian founder documents, notarisation/apostille, passport/address proof, and DSC/DIN needs.
- [ ] Incorporate through MCA/CS process.
- [ ] Receive Certificate of Incorporation, CIN, company PAN, and TAN.
- [ ] Open current account.
- [ ] Record first board meeting, share certificates, statutory registers, auditor appointment, bank signatories, and spending limits.
- [ ] File foreign investment reporting if Canadian founder invests into the Indian company.

### 3.3 Founder, Cofounder, And IP

- [ ] Founder agreement / shareholders agreement signed.
- [ ] Cofounder/operator role defined: director, employee, consultant, sales partner, or true cofounder.
- [ ] Cofounder equity subject to vesting, cliff/milestones, good-leaver/bad-leaver, and share transfer restrictions.
- [ ] Founder IP assignment signed for all pre-incorporation code, designs, docs, prompts, domains, schemas, brand assets, and product work.
- [ ] Contractor IP assignment template ready for anyone touching code, design, customer data, implementation, or support.
- [ ] Expense policy and founder loan policy approved.
- [ ] Bank authority requires dual approval above a fixed threshold.
- [ ] Local operator has customer/onboarding authority but not unchecked code, secrets, bank, IP, or deletion authority.

### 3.4 Tax, Accounting, PAN, GST, And Razorpay

- [ ] Accounting tool selected: Zoho Books, Tally, or another GST-ready stack.
- [ ] GST registration decision documented by CA. Recommendation: register before paid B2B pilots if issuing Weavly invoices.
- [ ] SAC, invoice wording, implementation fee treatment, annual maintenance treatment, refund credit notes, and GST handling confirmed by CA.
- [ ] Razorpay account created for the correct legal entity, not an individual.
- [ ] Razorpay KYC completed with business PAN, incorporation details, bank proof, UBO/control-person details, authorised signatory, website, and policy pages.
- [ ] Live keys generated and stored only in deployment secret managers.
- [ ] Test keys and live keys separated.
- [ ] Live webhook configured at `/api/webhooks/razorpay`.
- [ ] Webhook HMAC/idempotency verified with actual Razorpay event replay.
- [ ] Low-value internal live transaction tested only after CA confirms invoicing/GST flow.
- [ ] Razorpay settlement, fees, refunds, invoices, subscription records, and bank reconciliation mapped.

### 3.5 Customer Legal Pack

- [ ] Pilot agreement.
- [ ] Master Services Agreement or production SaaS Terms.
- [ ] Order form / proposal template.
- [ ] Data Processing Addendum.
- [ ] Privacy Policy rewrite.
- [ ] Refund and Cancellation Policy rewrite.
- [ ] Subprocessor list.
- [ ] Worker and WhatsApp consent notices in English, Hindi, and Gujarati.
- [ ] Data retention, export, and deletion policy.
- [ ] Support policy and severity/SLA definitions.
- [ ] Incident response and breach notification runbook.
- [ ] Customer onboarding checklist.
- [ ] Customer offboarding checklist.

### 3.6 App Legal And Compliance Gaps

- [ ] Terms pricing fixed. Current Terms still mention old Rs 600/month and Rs 1,700/month plan pricing.
- [ ] Landing, onboarding, billing, upgrade walls, Terms, and Refund Policy use one pricing source of truth.
- [ ] Refund policy updated for setup/implementation fees plus annual maintenance, not only monthly plans and Rs 4,999 setup add-on.
- [ ] Privacy policy updated for the current product: parties, GSTIN, dispatch/challan, stock sale, market run, commercials, payments, referrals, Sentry, Upstash, Razorpay, WhatsApp logs, audit logs, tracking links, and support data.
- [ ] Privacy role model fixed: Weavly is processor for factory operational/worker data but likely fiduciary/controller for account, billing, support, security, website, and business relationship data.
- [ ] DPA signing surface activated or manual DPA execution process documented.
- [ ] Subprocessors disclosed: Supabase, Vercel, Sentry, Upstash, Razorpay, Meta/WhatsApp, email provider, analytics if added.
- [ ] Export/delete map covers all active org-scoped tables, including stock, market run, commercials, dispatch packages, subscriptions, referrals, WhatsApp logs, consents, and audit/legal retention exceptions.
- [ ] Worker age/minor declaration handled in onboarding/worker creation or legal paperwork.
- [ ] Payroll/statutory-compliance disclaimers updated after labour-code commencement.
- [ ] Minimum wage/static labour thresholds are configurable, advisor-reviewed, or clearly non-authoritative.

### 3.7 Security And Production Readiness

- [ ] Deploy `supabase/migrations/20260601233631_production_security_hardening.sql` to production.
- [ ] Verify every public base table has RLS enabled.
- [ ] Verify `anon` has no broad table/sequence grants.
- [ ] Verify service-role-only payment/webhook tables are not client writable.
- [ ] Verify cross-tenant isolation with two orgs across workers, payroll, stock, dispatches, commercials, WhatsApp logs, and billing state.
- [ ] Rotate Supabase, Razorpay, Upstash, Sentry, and WhatsApp secrets if exposed outside secret managers.
- [ ] Configure Upstash in production so rate limiting does not fail open.
- [ ] Confirm Sentry scrubs worker/payroll/payment/access-code/secrets data.
- [ ] Confirm backups and restore procedure.
- [ ] Confirm production logs do not leak PII, GSTIN, payment IDs, access codes, signatures, or service keys.
- [ ] Add customer-data handling policy for AI-assisted debugging.

### 3.8 Brother Pilot

- [ ] Pilot agreement or signed email scope in place.
- [ ] Pilot org created.
- [ ] Data scope agreed: workers, phone numbers, party names, GSTINs, payroll, dispatch, payments.
- [ ] Worker/WhatsApp consent process used if worker phone numbers are entered.
- [ ] Razorpay real checkout disabled unless live/KYC/invoicing are ready.
- [ ] At least three real estimator examples reconciled against manual math.
- [ ] Supervisor logs 5-10 shifts on phone with minimal help.
- [ ] One order or market-run path completed.
- [ ] One stock sale -> dispatch -> receipt -> commercials path completed.
- [ ] One advance -> payroll -> settlement path completed.
- [ ] Export of pilot data can be produced manually or through the app.
- [ ] Pilot report captures blockers, willingness to pay, support load, and intro readiness.

### 3.9 Friend-Circle Paid Design Partners

- [ ] P0/P1 issues from brother pilot fixed.
- [ ] Paid design partner offer frozen.
- [ ] 1-page proposal ready.
- [ ] Pilot agreement and order form ready.
- [ ] Pricing and refund terms match legal pages.
- [ ] Entity/bank/GST/Razorpay path ready for collecting money.
- [ ] Support channel and response windows defined.
- [ ] Limit to 3-5 factories.
- [ ] No custom feature promises without paid change order.

### 3.10 Profit Extraction

- [ ] CA/CPA memo on salary/director remuneration.
- [ ] CA/CPA memo on consulting/management fees to founder personally or Canadian entity.
- [ ] Dividend taxation and India-Canada treaty documentation reviewed.
- [ ] Founder loan documentation if founder funds company.
- [ ] Expense reimbursement policy active.
- [ ] Cross-border remittance process confirmed: TDS, Form 15CA/15CB where applicable, FEMA/AD bank process, transfer pricing if related-party.
- [ ] Canada reporting plan confirmed before first founder distribution.

### 3.11 Grants, Incentives, And Recognition

- [ ] Apply for DPIIT Startup India recognition after incorporation if eligibility is met.
- [ ] Evaluate Section 80-IAC tax holiday after DPIIT recognition and IMB certification.
- [ ] Evaluate MSME/Udyam registration.
- [ ] Evaluate Gujarat startup incentives through Startup Gujarat / nodal institution.
- [ ] Monitor Startup India Seed Fund or successor window. The 2026 source showed startup applications ending May 31, 2026, so this may be closed for the current cycle.
- [ ] Treat Fund of Funds as indirect investor ecosystem support, not a direct grant to Weavly.
- [ ] Do not rely on grants to fund first launch.

## 4. Entity Decision: Private Limited, LLP, Canada, Or LLC

India does not use the US-style "LLC" as the normal startup structure. The relevant Indian choices are private limited company and LLP. If you meant a US LLC, it is not the clean default for an India-first B2B SaaS serving Indian factories.

| Structure | Fit | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Indian private limited company | Best default | Clean equity, familiar to investors/customers, better for cofounder shares/ESOPs, clearer Razorpay/banking/GST, can contract with Indian factories | ROC filings, audit, board process, CS/CA cost, resident director need | Use this unless advisors object |
| Indian LLP | Possible, weaker for startup equity | Lower formality, partnership economics, possible for close cash-flow business | Less investor-friendly, ESOP/equity less clean, FDI in LLPs needs sector/performance-condition review | Only if you want a small cash-flow partnership |
| Sole proprietorship/personal collection | Poor | Fast and cheap | Bad for liability, foreign founder, Razorpay, taxes, diligence, privacy, cofounder equity, refunds | Avoid |
| Canadian company selling directly to India | Possible later | Canada-side ownership may suit long-term founder/tax strategy | India GST/OIDAR and local trust/payments/support friction; harder Indian invoices and local operator structure | Not for first India rollout unless counsel recommends |
| Canadian HoldCo + Indian OpCo | Good later | Cleaner long-term IP/investor structure if Canada remains strategic | More contracts, tax, transfer pricing, FEMA, withholding, accounting | Revisit after first paid retention or before fundraising |
| US LLC | Usually poor fit here | Flexible for US founders | Not natural for Indian factory SaaS, India/Canada tax complexity, payment/banking mismatch | Avoid unless US market/investors require it |

Default implementation:

- Indian private limited company as Weavly India operating company.
- Canadian founder holds shares as non-resident shareholder through proper FDI route.
- India-based operator/cofounder is director and authorised signatory only after controls are signed.
- Customer contracts, Razorpay settlements, GST invoices, and India support obligations sit in the Indian company.
- IP created before incorporation is assigned or licensed into the company through written IP assignment.

Key professional question: whether to put all IP into Indian OpCo now, or hold core IP in Canada and license it to India. The Canada HoldCo/IP structure can be better for future investors or Canadian tax planning, but it adds transfer-pricing, withholding, GST/import-of-service, and FEMA complexity. Do not overbuild it before first revenue unless advisors see a strong reason.

## 5. Incorporation, PAN, TAN, GST, And Bank Setup

### 5.1 Private Limited Requirements To Design Around

Confirm with the CS before filing, but the working assumptions are:

- Private limited company needs at least two directors.
- Companies Act section 149 requires every company to have at least one director who has stayed in India for at least 182 days in the relevant period.
- A foreign national/non-resident can be shareholder and director, subject to document, DIN/DSC, notarisation/apostille, FDI/FEMA, and tax process.
- Use proper share subscription money through banking channels, not cash or informal reimbursement.

### 5.2 Getting The Business PAN

For a private limited company, the company PAN is normally handled as part of the incorporation workflow. Startup India material states PAN and TAN are allotted based on information filled in SPICe at incorporation. The practical path:

1. CS reserves name and files incorporation package.
2. Registrar issues Certificate of Incorporation with CIN.
3. Company PAN and TAN are issued/allotted through the incorporation process.
4. Use company PAN, Certificate of Incorporation, board resolutions, and registered office documents to open the current account and complete Razorpay KYC.

If you use an LLP instead, confirm the exact PAN/TAN path with the CS because the workflow differs.

### 5.3 GST

Working rule: register for GST before paid B2B pilots unless the CA gives a clear reason not to.

Why:

- Textile factory customers may want GST invoices and input tax credit.
- Public pricing can say "plus GST" cleanly.
- Razorpay, invoices, refunds, and accounting become cleaner.
- You avoid converting early informal receipts into formal accounts later.

Known reference points:

- CBIC/GST material uses Rs 20 lakh service registration threshold in normal category states and Rs 10 lakh in specified special category states, with exceptions and compulsory registration cases.
- GST Council IT/ITES FAQ material states IT services are generally taxed at 18%.
- Your CA should confirm SAC, place of supply, whether setup/implementation and annual maintenance should be separately described, and whether any export-of-service treatment applies for future non-India customers.

### 5.4 Razorpay KYC

Razorpay should be under the final legal entity. Do not activate paid customer collection under a personal account if the Indian company is about to be formed.

For a company, expect:

- Business PAN and date of incorporation.
- Company incorporation details.
- Control person / UBO / authorised signatory details.
- Director/authorised signatory identity and address proof.
- Bank account proof.
- Website/app with clear pricing, contact, privacy, terms, refund/cancellation, and support information.
- Business category consistent with software/SaaS/IT services.

Use test mode until:

- KYC is complete.
- Live mode is enabled.
- Live keys are stored in secrets.
- Test keys are not in production.
- Webhook secret is configured.
- GST/invoice flow is ready.

## 6. Founder And Cofounder Structure

### 6.1 Role Design

Split the roles explicitly.

Canadian founder:

- Product vision.
- Engineering and architecture.
- Security and data protection.
- Roadmap and release control.
- Pricing and strategic sales.
- Canada-side tax/investor planning.

India-based cofounder/operator:

- Factory relationships.
- Warm introductions.
- On-ground onboarding.
- Owner/supervisor training.
- Local-language support.
- Field feedback.
- Collections support, but not unchecked money control.

### 6.2 Equity And Vesting

Do not give permanent equity for informal help. Choose structure based on the real role.

If true cofounder:

- 4-year vesting with 1-year cliff is the clean default.
- Add reverse vesting where appropriate.
- Add good-leaver/bad-leaver rules.
- Add confidentiality, IP assignment, non-solicit where enforceable, non-disparagement, and dispute resolution.
- Add share transfer restrictions and right of first refusal.
- Add deadlock handling.

If local operator/sales lead:

- Prefer salary/consulting fee plus implementation commission first.
- Add smaller equity/options after 3-6 months of evidence.
- Use milestone vesting if equity is granted.

Example milestone vesting for an operator equity grant:

- 25% after 12 months of active onboarding/support work.
- 25% after 5 paid factories complete onboarding and remain active for 90 days.
- 25% after 10 paid factories or a defined revenue milestone.
- 25% over the next 24 months if they remain active and meet support/sales obligations.

Have the lawyer convert this into legally enforceable documents. The exact instrument may be equity shares, ESOP, sweat equity, phantom economics, commission, or a mix.

### 6.3 Control Rules

Founder should keep company and product control until the business relationship is proven.

Controls to put in writing:

- No one can issue shares, transfer IP, change bank signatories, take loans, pledge assets, or sign large contracts alone.
- Bank payments above a threshold require two approvals.
- Production secrets are not shared with local operator.
- Customer data access is role-limited and logged.
- Customer deletion/export requests require formal request and founder/security signoff.

## 7. Visa And Tax Residency Watchpoints

### 7.1 India e-Business Visa

Official Indian e-Visa material says e-Business visa continuous stay during each visit shall not exceed 180 days, with FRRO/FRO registration if intending to stay longer. MHA business visa material includes visits to establish or explore an industrial/business venture.

Practical rule:

- Use the e-Business visa for incorporation setup, customer discovery, business meetings, pilots, hiring discussions, demos, and board/customer meetings.
- Do not treat it as local employment permission.
- Do not start taking India salary while physically in India without immigration advice.
- Track India entry/exit dates.

### 7.2 India Tax Residency

Income Tax Department material states the general individual residency test as:

- stay in India for 182 days or more in the financial year, or
- stay in India for 60 days or more in that year plus 365 days or more in the preceding four years,
- with special exceptions for Indian citizens and persons of Indian origin.

Practical rule:

- Maintain a day-count calendar.
- Confirm whether you are Canadian-only, OCI/PIO, Indian citizen, or another status because exceptions matter.
- If you become India tax resident, India may tax more than India-source income depending on ROR/RNOR status.

### 7.3 Canada Tax Residency

CRA residency is fact-specific. CRA material says factual residents temporarily outside Canada can remain taxable in Canada on worldwide income if they keep significant Canadian residential ties. CRA also describes foreign tax credit relief where foreign income taxes are paid on income reported in Canada.

Practical rule:

- Ask a Canadian CPA before taking Indian salary, consulting fees, dividends, director fees, or remittances.
- Keep Indian TDS/withholding certificates.
- Keep board resolutions, invoices, bank trails, and tax challans.
- Do not assume physical presence in India eliminates Canadian tax.

## 8. Getting Paid Personally And Taking Profits Out

The right question is not "how do I take money out?" It is "what legal reason supports this payment?"

### 8.1 Clean Channels

Salary or director remuneration:

- Fits if you actively work for the Indian company.
- Needs board approval, payroll/TDS, and visa review.
- Can be deductible to the company if reasonable and compliant.

Consulting or management fee:

- Fits if you or a Canadian company provide real engineering, product, strategy, sales, or management services.
- Needs written services agreement, invoices, market-rate pricing, TDS/withholding review, GST/import-of-service review, transfer-pricing review where applicable, and AD bank process for foreign remittance.

Dividends:

- Fits for distributing post-tax profits.
- Not deductible to the company.
- India taxes non-resident dividend income subject to domestic law and DTAA eligibility.
- India-Canada treaty text includes dividend withholding limits of 15% in one corporate-control case and 25% in other cases, subject to treaty conditions, beneficial ownership, TRC/Form 10F, and advisor review.

Founder loan repayment:

- Fits if you previously loaned money to the company.
- Repays principal; not profit.
- Needs documentation, board approval, and FEMA/company-law review if cross-border.

Expense reimbursement:

- Fits for real company expenses you paid personally.
- Needs receipts, business purpose, approval, and correct accounting.

IP royalty/license fee:

- Only if IP is genuinely owned outside Indian OpCo and licensed to it.
- Heavy: withholding, GST/import services, transfer pricing, FEMA, and treaty analysis.
- Do not use casually in year one unless advisors structure it.

Share sale/buyback:

- Later-stage route, not first-year operating cash.
- Needs company law, tax, valuation, FEMA, and board/shareholder process.

### 8.2 Avoid

- Customer payments into personal accounts.
- Personal UPI or cash pilot fees.
- Paying yourself before GST, refunds, support, hosting, payroll, and tax reserves.
- Fake consulting invoices.
- Personal rent, family expenses, lifestyle travel, or unrelated assets as company expenses.
- Backdating agreements after money has moved.

### 8.3 First-Year Distribution Policy

Conservative policy:

1. First 3-6 months: keep cash inside the company except documented reimbursements.
2. After 3-5 paying customers: consider modest founder/operator pay if CA/CPA approves.
3. Keep at least 6 months of hosting, WhatsApp, Razorpay, support, legal, accounting, and refund reserve in the company.
4. Use dividends only after annual accounts, tax provision, and board/shareholder approvals.
5. Use cross-border payments only after contracts and tax/FEMA workflow are ready.

## 9. Pricing And Payment Model

The current repo has pricing drift:

- Landing page and billing/onboarding surfaces are not fully aligned.
- Terms page still lists stale Rs 600/month and Rs 1,700/month plans.
- Refund policy assumes monthly subscription refunds and a Rs 4,999 setup add-on.
- `docs/pricing-strategy-and-billing-migration-guide.md` recommends setup fee plus annual maintenance.

Recommended offer after brother pilot:

| Package | Positioning | Setup / implementation | Annual maintenance |
| --- | --- | ---: | ---: |
| Estimator Desk | Costing, quote history, margin control | Rs 19,999-29,999 + GST | Rs 9,999-14,999/year + GST |
| Factory Loop | Full floor, payroll, stock, dispatch, commercials | Rs 49,999-74,999 + GST | Rs 19,999-29,999/year + GST |
| Design partner | First 3-5 friend-circle factories | Rs 19,999-29,999 + GST | waived or discounted for 60-90 days |
| Multi-unit | Multiple factories or custom setup | custom | custom |

Position the upfront amount as:

- factory setup
- data import
- owner training
- supervisor training
- payroll/stock workflow calibration
- WhatsApp/template setup
- first-month handholding

Razorpay implementation target:

- Keep `plan_tier` for feature gates: `base`, `premium`, `trial`.
- Add `commercial_package` for billing model: estimator setup annual, factory loop setup annual, design partner, custom.
- Use Razorpay annual subscription plans.
- Use Razorpay `addons` for upfront setup fees.
- Use `start_at` if annual maintenance should start after onboarding instead of immediately.
- Store package, setup fee, annual fee, GST, invoice ID, Razorpay payment ID, Razorpay subscription ID, and org ID.

## 10. Legal Documents To Prepare

### 10.1 Customer-Facing Documents

Pilot Agreement:

- Pilot duration.
- Free/discounted status.
- Product is pre-launch/pilot.
- No real payment dependency unless agreed.
- Data scope.
- Worker/WhatsApp consent responsibility.
- Feedback rights.
- Support scope.
- Data export/delete at the end.
- No statutory payroll/compliance guarantee.

Master Services Agreement / SaaS Terms:

- Product scope.
- Customer responsibilities.
- Implementation and training.
- Subscription/annual maintenance.
- Payment, taxes, GST, late payment, suspension.
- Acceptable use.
- Security boundaries.
- Data ownership.
- Export/termination.
- Limitation of liability.
- Indemnity, especially labour/payroll/customer-entered data.
- Confidentiality.
- Dispute venue and arbitration.

Order Form:

- Customer legal name.
- Factory name and address.
- GSTIN if available.
- Package.
- Setup fee.
- Annual fee.
- GST.
- Start date.
- Onboarding milestones.
- Included support.
- Renewal date.
- Special terms.

Data Processing Addendum:

- Factory owner is Data Fiduciary/controller for worker/customer operational data.
- Weavly is Data Processor for that data.
- Weavly may be Data Fiduciary/controller for account, billing, website, security, support, and relationship data.
- Subprocessors listed.
- Cross-border/storage locations disclosed.
- Security safeguards.
- Breach notification process.
- Return/delete/export process.

Privacy Policy:

- Owner, supervisor, worker, party/customer, operational, payroll, payment, WhatsApp, technical, support, and security data categories.
- Purposes.
- Data roles.
- Consent and legitimate use basis where applicable.
- Retention.
- Rights and grievance route.
- Subprocessors.
- Breach handling.
- Local/offline data.
- Cross-border processing.

Refund And Cancellation Policy:

- Separate setup fee, implementation milestone, annual maintenance, pilot/design-partner, and subscription rules.
- Refund timeline.
- GST credit note handling.
- Data export window.
- Cancellation path at least as easy as subscription path.

Worker/WhatsApp Consent Notice:

- Plain English/Hindi/Gujarati.
- Worker name, phone, payroll, advances, attendance/production, WhatsApp message purposes.
- Factory owner responsibility.
- WhatsApp opt-out.
- Grievance path.

Subprocessor List:

- Supabase.
- Vercel.
- Sentry.
- Upstash.
- Razorpay.
- Meta/WhatsApp.
- Email provider.
- Analytics provider if added.

### 10.2 Internal Documents

- Shareholders agreement.
- Founder IP assignment.
- Cofounder/operator agreement.
- Contractor IP assignment.
- Board resolutions for bank, Razorpay, GST, contracts, founder remuneration, and customer agreements.
- Expense reimbursement policy.
- Founder loan agreement if needed.
- Related-party services agreement if founder/Canada entity invoices Indian OpCo.
- Access-control policy.
- Incident response plan.
- Backup/restore plan.
- Data request register.
- Security incident register.
- Tax calendar.

## 11. Current App Legal Audit

### 11.1 What Exists

The app already has useful foundations:

- Public `/privacy`, `/terms`, and `/refund-policy` pages.
- Footer/legal route allowlist.
- Owner/supervisor/admin role model.
- Multi-tenant org-scoped design.
- RLS/security hardening migration and hardening report.
- Razorpay subscription code and webhook hardening.
- WhatsApp opt-in in settings.
- Worker WhatsApp consent table.
- Worker erasure/anonymization path.
- Compliance tables: notices, consent artifacts, grievances, DPAs, organization DPAs, breach reports, platform security.
- Trial, subscription, payment, and referral tables.

### 11.2 Critical Legal Copy Gaps

Terms:

- Last updated March 25, 2026.
- Pricing is stale.
- Model assumes monthly Base/Premium subscriptions.
- Needs annual setup/maintenance model, legal entity name, implementation services, pilot/design-partner terms, support scope, data export, liability, and labour-code language.

Privacy:

- Last updated April 26, 2026.
- Data categories do not fully match current product.
- It overstates "processor only" framing.
- It omits or under-specifies parties, GSTIN, dispatch/challan, stock sale, market run, commercial receivable/payment, referral, Razorpay, Sentry, Upstash, audit, tracking, and broader WhatsApp data.
- Breach section should align with DPDP Rules and CERT-In rather than only saying 72 hours.

Refund Policy:

- Last updated March 25, 2026.
- Monthly subscription model is stale.
- Rs 4,999 setup add-on no longer matches recommended pricing.
- Needs milestone-based setup fee refund rules and annual maintenance cancellation rules.

DPA:

- Tables/actions exist, but customer-facing DPA signing is not active in the launch surface.
- Either activate it or execute DPA manually for first customers.

Export/Delete:

- Needs complete coverage of active org-scoped tables, not only older modules.
- Legal deletion must preserve required accounting, audit, payment, tax, security, legal, and labour records where applicable.

## 12. DPDP, Security, CERT-In, And Labour Compliance

### 12.1 DPDP

The DPDP Act 2023 is enacted. The DPDP Rules 2025 have been notified with staggered commencement. The Data Protection Board of India has been established under the DPDP Act.

Practical launch posture:

- Use clear privacy notices.
- Collect minimum necessary data.
- Do not claim statutory HR/payroll compliance.
- Keep worker/payroll data role-limited.
- Capture WhatsApp consent separately.
- Maintain a grievance contact.
- Maintain export/delete procedure.
- Maintain breach response process.
- Do not paste customer data, payroll, phone numbers, GSTINs, payment IDs, or secrets into public AI tools.

### 12.2 CERT-In

CERT-In directions require certain cyber incidents to be reported within 6 hours of noticing or being notified. Your runbook should assume:

- Immediate triage owner.
- Evidence preservation.
- Sentry/log review.
- Customer impact assessment.
- CERT-In report where incident type is covered.
- DPDP Board/affected Data Principal notification where applicable.
- Post-incident correction and customer notice.

### 12.3 Labour/Payroll

Government material states India's four Labour Codes were made effective from November 21, 2025. Weavly should not imply that its payroll, PF/ESI, wage, or worker calculations guarantee compliance.

Terms and app copy should say:

- Weavly is software for recordkeeping and calculations.
- Factory owner remains responsible for labour-law compliance, wage rules, PF, ESI, professional tax, TDS, attendance, overtime, safety, registers, and worker disputes.
- Payroll calculations depend on customer-entered data and configurations.
- Any legal employment decision must be independently verified.

Product action:

- Make wage/legal thresholds configurable or clearly non-authoritative.
- Avoid hardcoded stale minimum wage claims.
- Add owner declarations where the app processes worker data or worker age-sensitive records.

## 13. Brother Pilot Plan

Brother pilot is not launch. It is a rehearsal under controlled risk.

Before pilot:

- Use a pilot agreement or at least signed email scope.
- Use a clean org.
- Decide whether data is real, anonymized, or mixed.
- Do not process real payments unless business/payment gates are ready.
- Get consent before entering worker phone numbers.
- Explain payroll/statutory responsibility stays with the factory owner.

Pilot success gates:

- Three real estimator examples reconcile with manual math within accepted tolerance.
- Supervisor logs 5-10 shifts from phone with minimal help.
- Owner can see "what happened today" without asking the floor.
- One quote/order or market run works end to end.
- One stock sale, dispatch, receipt, and commercials path works.
- One advance, payroll preview, settlement, and payslip/manual fallback works.
- No cross-tenant/security/data-loss bug appears.
- Brother can name top 3 value drivers and top 3 blockers.
- Brother is willing to introduce 3 factory owners.

Evidence to collect:

- Time to onboard.
- Time to log one shift batch.
- Manual vs Weavly estimator delta.
- Manual vs Weavly payroll delta.
- Manual vs Weavly stock/commercials delta.
- Number of support calls/messages per day.
- Screens and labels that confused him.
- Willingness to pay setup fee.
- Exact price reaction.

## 14. Friend-Circle Design Partner Plan

Entry criteria:

- Brother pilot gates passed.
- P0/P1 issues fixed.
- Customer legal pack ready.
- Entity/payment/GST path ready for money.
- Security/payment production gates verified.
- Support model ready.

Recommended offer:

- 3-5 factories only.
- Rs 19,999-29,999 setup + GST.
- Annual maintenance waived or discounted for 60-90 days, then Rs 9,999-19,999 + GST.
- In exchange: weekly feedback, permission to use anonymized learnings, testimonial if successful, and 2 referrals.

Rules:

- No full ERP promise.
- No Tally replacement promise.
- No GST filing promise.
- No statutory payroll compliance promise.
- No custom feature without paid change order.
- Every request gets tagged: must-have for all factories, useful later, one-customer custom, or out of scope.

## 15. Startup Recognition, Grants, And Tax Benefits

This area is worth pursuing, but it should not delay first lawful customer onboarding.

### 15.1 DPIIT Startup India Recognition

Startup India recognition criteria currently include:

- Private limited company, registered partnership firm, LLP, or cooperative society.
- Turnover below Rs 200 crore in any previous financial year, or Rs 300 crore for DeepTech startups.
- Startup status up to 10 years from incorporation, or 20 years for DeepTech startups.
- Work toward innovation/improvement of products, services, or processes, with employment or wealth creation potential.
- Not formed by splitting up or reconstructing an existing business.

Apply after entity formation. Use it for credibility, schemes, tax-benefit eligibility, and government ecosystem access.

### 15.2 Section 80-IAC Tax Holiday

Startup India material says eligible startups can apply for 100% tax deduction for 3 consecutive financial years within the first 10 years of incorporation.

Working notes:

- Requires DPIIT recognition.
- Only private limited companies and LLPs are eligible.
- Startup India's 80-IAC page lists incorporation on or after April 1, 2016, less than 10 years old, turnover below Rs 100 crore in any financial year, and innovation/scalability conditions.
- Startup India Tax Playbook May 2026 also discusses newer Income Tax Act 2025 mapping and eligibility changes; CA must confirm which law/year applies when Weavly files.
- IMB certification/eligibility certificate is required.
- MAT/AMT or other tax mechanics may still matter.

Practical rule: apply only after the CA confirms timing. It may be better to claim the 3-year profit deduction once profits are meaningful, not necessarily immediately.

### 15.3 Startup India Seed Fund

The Startup India Seed Fund Scheme supports proof of concept, prototype development, product trials, market entry, and commercialization through incubators. The current official seed fund portal source showed final startup application date as May 31, 2026 and incubator selection by June 30, 2026.

As of June 16, 2026, assume the current application window may be closed. Monitor for a successor window or apply through an eligible incubator if still possible.

### 15.4 Fund Of Funds

Startup India Fund of Funds and Fund of Funds 2.0 are not direct grants to Weavly. They support startups indirectly by contributing to SEBI-registered AIFs that invest in startups. Treat this as investor ecosystem infrastructure, not near-term operating cash.

### 15.5 MSME/Udyam

Udyam registration is official MSME recognition. MSME annual-report material describes Udyam as online, free, paperless, and self-declaration based.

Why it may help:

- Access to MSME schemes.
- Delayed-payment protections where applicable.
- Bank/loan and government ecosystem eligibility.
- Procurement/marketing/support schemes.

Confirm classification and benefits with CA. Register only on the official Udyam/MSME portal, not paid lookalike sites.

### 15.6 Gujarat Startup Incentives

Startup India's Gujarat state policy page lists Gujarat startup assistance through the Industries Commissionerate / Startup Gujarat ecosystem, including:

- interest subsidy support,
- sustenance allowance for approved innovators,
- infrastructure/mentoring support through recognized institutions,
- marketing/publicity assistance,
- nodal institution process.

This may be relevant because the first customer cluster appears Gujarat/Surat textile. Confirm current scheme window, eligibility, and whether Weavly's entity and founder residency/shareholding qualify.

### 15.7 Other Benefits To Ask CA About

- ESOP/sweat equity tax deferral for eligible startups.
- Loss carry-forward relaxation for eligible startups.
- 80JJAA deduction for additional employees, if hiring qualifies.
- GST incubatee exemption only if Weavly becomes a qualifying incubatee under a recognized TBI/STEP/Bio-incubator and meets all limits.
- Patent box only if there is qualifying Indian patent royalty income.

## 16. First 90-Day Execution Plan

### Days 1-14: Legal And Pilot Foundation

- Select CS, CA, lawyer, FEMA advisor, immigration lawyer, Canadian CPA.
- Decide private limited unless advisors object.
- Draft founder/cofounder terms and IP assignment.
- Draft pilot agreement.
- Freeze pilot pricing hypothesis.
- Update app legal pages and pricing drift plan.
- Execute production security verification plan.
- Prepare brother pilot org and walkthrough.
- Create worker/WhatsApp consent notices.

### Days 15-30: Brother Pilot

- Run brother pilot.
- Collect real costing, stock, dispatch, payroll, and support evidence.
- Fix only P0/P1 and trust-breaking issues.
- Produce pilot report.
- Decide whether to move to friend-circle design partners.

### Days 31-60: Entity, Payment, Legal Pack

- Complete incorporation.
- Open current account.
- Complete PAN/TAN/GST/accounting setup.
- Complete Razorpay KYC/live setup.
- Finalize MSA, order form, DPA, privacy, terms, refund, subprocessors.
- Implement annual setup/maintenance billing model or use manual invoicing for first design partners.
- Verify security, data export/delete, and incident process.

### Days 61-90: First Paid Customers

- Convert brother or first design partner if pilot passes.
- Onboard 2-3 friend-circle factories.
- Collect setup fees through company account/Razorpay only.
- Track onboarding time, support hours, adoption, and gross margin.
- Keep custom work scoped and paid.
- Do not distribute profits until reserves, taxes, and advisor-approved channels are ready.

## 17. Go/No-Go Gate For Paid External Customers

Do not onboard an external paying customer unless each item below is true:

- [ ] Entity/payment path is final.
- [ ] Business bank/current account exists.
- [ ] GST/invoicing plan is ready.
- [ ] Customer contract pack is ready.
- [ ] Privacy/Terms/Refund pages match actual product and pricing.
- [ ] Worker/WhatsApp consent process is documented.
- [ ] Razorpay live mode, keys, webhook, and accounting reconciliation are ready if taking online payments.
- [ ] Security production migration and RLS/anon grant verification are complete.
- [ ] Data export/delete process is operational.
- [ ] Incident response process exists.
- [ ] Brother pilot completed without unresolved data-loss/security/payment blockers.
- [ ] Support owner and response window are defined.

If any item is false, use a free/controlled pilot or manual non-production demo. Do not call it paid production.

## 18. Professional Questions To Ask

Ask CS:

- What is the cleanest private limited incorporation path with one Canadian founder and one Indian resident director?
- What documents need notarisation/apostille?
- Can the Canadian founder be director and shareholder under current process?
- What resident director evidence is needed?
- How should share certificates, statutory registers, auditor appointment, and first board meeting be handled?

Ask CA/FEMA advisor:

- What FDI sector/classification should Weavly use?
- What RBI/FIRMS/FC-GPR/FLA filings apply if Canadian founder subscribes for shares?
- Should GST registration happen before first paid pilot?
- What SAC should implementation and annual maintenance use?
- How should Razorpay fees, refunds, GST credit notes, and setup fees be accounted for?
- What TDS applies to salary, director fees, contractors, founder consulting, dividends, and foreign remittances?

Ask Canadian CPA:

- Am I still Canadian tax resident?
- How will Indian salary, consulting fees, dividends, director fees, or company shares be reported in Canada?
- Should founder invoices come from me personally or a Canadian corporation?
- What foreign asset/share reporting applies?
- How do foreign tax credits apply?

Ask immigration lawyer:

- What activities are safe on e-Business visa?
- Can I be a director while in India on e-Business visa?
- Can I receive remuneration while physically in India?
- What visa is needed if I spend extended periods operating in India later?

Ask lawyer:

- Best founder/cofounder vesting structure.
- IP assignment and contractor IP terms.
- SaaS Terms/MSA, DPA, pilot agreement, refund policy.
- Liability cap for payroll, worker data, dispatch, commercials, and customer-entered data.
- Dispute venue and arbitration.

## 19. Source Register

Official and primary sources checked:

- India e-Visa/e-Business stay: https://indianvisaonline.gov.in/evisa/
- PIB e-Business visa stay update: https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1564759
- MEA FRRO/FRO visa services: https://www.mea.gov.in/visa-related-services-provided-by-FRROs-FROs.htm
- MHA work/business visa FAQ PDF: https://www.mha.gov.in/sites/default/files/2022-08/work_visa_faq%5B1%5D.pdf
- Companies Act 2013 section 149 / IndiaCode: https://www.indiacode.nic.in/bitstream/123456789/2114/5/A2013-18.pdf
- Startup India company incorporation / business in India guide: https://www.startupindia.gov.in/content/sih/en/international/go-to-market-guide/business-in-India.html
- Startup India recognition and 80-IAC: https://www.startupindia.gov.in/content/sih/en/startupgov/startup_recognition_page.html
- Startup India 80-IAC page: https://www.startupindia.gov.in/content/sih/en/form80iac.html
- Startup India Tax Playbook May 2026: https://www.startupindia.gov.in/content/dam/startupindia/Tax-Playbook-for-Startup-Ecosystem-May-2026.pdf
- Startup India Seed Fund: https://seedfund.startupindia.gov.in/
- SIDBI Fund of Funds: https://www.sidbivcf.in/en/funds/ffs
- Gujarat startup policy page: https://www.startupindia.gov.in/content/sih/en/state-startup-policies/Gujarat-state-policy.html
- MSME/Udyam official gateway: https://my.msme.gov.in/MyMsme/Reg/Home.aspx
- MSME annual report reference for Udyam: https://msme.gov.in/sites/default/files/MSMEANNUALREPORT2025-26ENGLISH_0.pdf
- DPIIT FDI FAQ: https://www.dpiit.gov.in/static/uploads/2025/07/bdcb2c6eda1dbc1f7c29981e4c3fd428.pdf
- DPIIT consolidated FDI policy PDF: https://www.dpiit.gov.in/static/uploads/2025/07/3ab2ec2a3bdb91c69653b7c34618c14a.pdf
- RBI FLA return FAQ: https://www.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=1171
- Income Tax Department company tax rates AY 2026-27: https://www.incometax.gov.in/iec/foportal/help/company/return-applicable
- Income Tax Department residential status: https://www.incometaxindia.gov.in/w/residential-status
- Income Tax Department dividend/interest guidance: https://www.incometaxindia.gov.in/taxation-of-dividend-and-interest
- Canada CRA factual residents temporarily outside Canada: https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-entering-canada-non-residents/factual-residents-temporarily-outside-canada.html
- Canada CRA determining residency status: https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/information-been-moved/determining-your-residency-status.html
- Canada CRA foreign tax credit: https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40500-federal-foreign-tax-credit.html
- Canada-India tax treaty text: https://www.treaty-accord.gc.ca/text-texte.aspx?id=102409&lang=eng
- GST Council IT/ITES FAQ: https://gstcouncil.gov.in/sites/default/files/2024-02/sectoral-faq-it-ite.pdf
- CBIC GST FAQ: https://cbic-gst.gov.in/hindi/faq.html
- MeitY DPDP Act 2023 PDF: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf
- MeitY DPDP Rules 2025 PDF: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
- MeitY Data Protection Board establishment notice: https://www.meity.gov.in/static/uploads/2025/11/cc217843dc3bcb37b2b05bcc3b4e031f.pdf
- CERT-In directions: https://www.cert-in.org.in/Directions70B.jsp
- CERT-In FAQ on cyber security directions: https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf
- CERT-In incident reporting: https://www.cert-in.org.in/SecurityIncident.jsp
- PIB labour-code commencement release: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2194018
- Razorpay setup/KYC: https://razorpay.com/docs/payments/set-up/
- Razorpay KYC documents: https://razorpay.com/docs/payments/business-types-kyc-documents/
- Razorpay test/live modes: https://razorpay.com/docs/payments/dashboard/test-live-modes/
- Razorpay API keys: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/
- Razorpay subscriptions create/upfront amount: https://razorpay.com/docs/payments/subscriptions/create/?preferred-country=IN
- Razorpay subscription payment methods: https://razorpay.com/docs/payments/subscriptions/supported-payment-methods/
- Razorpay webhook validation/idempotency: https://razorpay.com/docs/webhooks/validate-test/

Repo sources reviewed:

- `docs/general/MASTER_PRODUCT_DOCUMENT.md`
- `docs/general/INDIA_SAAS_BUSINESS_LAUNCH_MASTER_GUIDE.md`
- `docs/pricing-strategy-and-billing-migration-guide.md`
- `docs/factory-showcase-feedback-guide.md`
- `docs/features/compliance_and_admin.md`
- `SECURITY.md`
- `SECURITY_HARDENING_REPORT.md`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/refund-policy/page.tsx`
- `app/api/webhooks/razorpay/route.ts`
- `lib/rate-limit.ts`
- `lib/wage-config.ts`
- `supabase/migrations/20260601233631_production_security_hardening.sql`
