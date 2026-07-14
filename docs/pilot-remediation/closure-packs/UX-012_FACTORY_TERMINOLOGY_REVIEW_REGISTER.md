# UX-012 — Factory Terminology Review Register

Prepared: 2026-07-14 IST
Status: **product-owner-approved baseline implemented for pre-pilot acceptance; actual pilot-user review remains OPEN**
Canonical source: the existing UX-012 terminology inventory and recommended glossary
Audience: the named actual pilot factory user who personally uses the relevant work

The product owner approved the baseline provisionally for the limited pilot on 2026-07-14. This is not factory-supervisor approval. During the pilot, use the deployed screens in real context to record the actual user's comprehension, confusing/rejected terms, corrections, and dated post-change confirmation.

Implementation evidence: production commit `bfc93dd11692408b7ccf5ce59fb99f3434e6aaae`; deployment `dpl_4z2xhBamSuufrjwGaS1wUS4rT1GD` (`READY`); local 93 test files / 662 passed / 1 skipped; remote 93 files / 663 passed. See `output/qa/pilot-gate-closure/2026-07-14/UX-012/`. The blank reviewer fields below are intentionally still blank until the actual pilot user performs the contextual review.

## How to review on a phone

Open one decision at a time. Look at the stated screen, say what the term means in your own words, then record one choice and any note.

- **A — Approve recommendation**
- **B — Use alternative**; write the selected alternative in Reviewer notes.
- **C — Supply different factory term**; write the exact term and language/script in Reviewer notes.
- **D — Term/concept not used in this factory**; say what the factory does instead.

Use only authorized records. Do not save or submit anything merely to reproduce a screen. Redact names, phone numbers, money, and identifiers in any screenshot.

## A. Terminology requiring factory approval

### UX-012-01 — Loom vs Machine

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-01` |
| Business concept | One physical weaving loom |
| Current wording in Weavly | Looms; Loom; machine; machines; Machine/Loom; Loom Assignments; Machine Attention |
| Where it appears / reproduce | **Owner:** sign in → `/owner/machines` → use one existing loom card → show the page title and assignment label; **Supervisor:** sign in → `/supervisor/machines` and `/supervisor/dashboard` → show one assigned loom, without editing. Repeat in every pilot language. |
| Plain-language meaning | The physical weaving equipment on which fabric is made. |
| Recommended English term | **Loom** |
| Recommended Gujarati / spoken term | **લૂમ**; reviewer must say whether the floor normally says **મશીન** instead. |
| Alternative wording | Machine; Machine/Loom; the factory's exact word |
| Why the decision matters | Navigation, assignments, production, alerts, analytics, and training should name the same asset. |
| Risk if misunderstood | “Machine” may also mean warping, sizing, or other equipment, so work can be assigned to the wrong asset class. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-02 — Shift Meters vs Production Meters

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-02` |
| Business concept | Fabric metres produced on one loom in one selected shift |
| Current wording in Weavly | Shift Meters; Shift Meter Log; Production Log; Log Production; Total metres this shift; meters produced; mtrs |
| Where it appears / reproduce | **Supervisor, mobile 390×844:** sign in → `/supervisor/dashboard` → choose day/night shift → use one existing assigned loom → show the metre field and helper; do not save. Repeat in every used locale. |
| Plain-language meaning | The total output made during that shift, not a cumulative machine counter value. |
| Recommended English term | **Shift metres** with helper “Total metres produced on this loom in this shift” |
| Recommended Gujarati / spoken term | **પાળીના મીટર** / “shift meter” as actually spoken |
| Alternative wording | Production metres; Shift production; Metre entry; factory term |
| Why the decision matters | It is the main production input used by stock, worker earnings, and Today totals. |
| Risk if misunderstood | A reviewer may enter a counter value or daily total, overstating production and pay. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-03 — Fabric Quality vs Design vs Item

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-03` |
| Business concept | The named fabric construction/specification used for costing, production, and stock |
| Current wording in Weavly | Quality; Fabric Quality; quality label; Quality Form; saved estimator quality; fabric label; design/item |
| Where it appears / reproduce | **Owner:** `/owner/estimator` → open an existing saved quality/cost analysis without saving; `/owner/machines` → show the quality on one loom card; `/owner/stock` → show the quality column on an authorized record. |
| Plain-language meaning | The fabric recipe/specification being made, not inspection grade and not the production run itself. |
| Recommended English term | **Fabric quality** on first use; **Quality** thereafter |
| Recommended Gujarati / spoken term | **કાપડની ક્વોલિટી** |
| Alternative wording | Design; Item; Fabric item; Construction; factory term |
| Why the decision matters | The same identifier connects estimate, loom target, stock, dispatch, and sale. |
| Risk if misunderstood | “Quality” may be read as good/bad grade, or a run/order may be selected instead of the fabric specification. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-04 — Market Run and the factory's actual equivalent

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-04` |
| Business concept | Production for market/godown stock before there is a committed buyer order |
| Current wording in Weavly | Market Run; run; market maal; market stock; stock run; direct market sale; Market-Run Stock |
| Where it appears / reproduce | **Owner:** `/owner/market-runs` → show one existing authorized run; `/owner/estimator` → enter market mode and show “Save & Create Market Run” without submitting; `/owner/machines` → show the assigned target if present. |
| Plain-language meaning | A planned quantity made for stock or later sale, without a named party commitment at the start. |
| Recommended English term | **Market run** |
| Recommended Gujarati / spoken term | **માર્કેટ રન** / **બજાર માટેનું ઉત્પાદન** |
| Alternative wording | Market maal; Market stock; Stock run; factory's actual equivalent |
| Why the decision matters | It distinguishes stock production from a party order throughout planning, stock, and reporting. |
| Risk if misunderstood | A market-stock job can be treated as a committed order, creating wrong due dates, party links, or reporting. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | State the factory's actual equivalent even when choosing `A`. |

### UX-012-05 — Godown Stock vs Stock vs Warehouse

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-05` |
| Business concept | Fabric stock in the factory's godown and its digital record |
| Current wording in Weavly | Godown; Godown Stock; Godown Ledger; warehouse; stock room; maal stock; stock |
| Where it appears / reproduce | **Owner:** `/owner/stock` → show the Godown heading and one redacted stock row; `/owner/today` → show the stock card. Do not create or confirm inward. |
| Plain-language meaning | Finished/grey fabric recorded as available or pending in the physical stock area; it is not yarn inventory. |
| Recommended English term | **Godown stock**, with expected/physically counted state stated separately |
| Recommended Gujarati / spoken term | **ગોડાઉન સ્ટોક** |
| Alternative wording | Stock; Stock room; Warehouse; Maal stock |
| Why the decision matters | The label appears in navigation, stock entry, KPIs, and sale/dispatch work. |
| Risk if misunderstood | “Stock” may include yarn, while “ledger” may falsely imply the quantity was physically counted. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-06 — Party vs Customer vs Buyer

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-06` |
| Business concept | The external buyer/account responsible for an order, sale, payment, or claim |
| Current wording in Weavly | Party; Party Name; Party / Customer; customer; client; buyer; trader; merchant |
| Where it appears / reproduce | **Owner:** `/owner/ledger` → show party selector with names/amounts redacted; `/owner/estimator` or `/owner/orders` → open a non-submitted form; stock sale/dispatch dialog → show the party field without submitting. |
| Plain-language meaning | The person or business buying fabric and owing/receiving money or goods. |
| Recommended English term | **Party**, with helper “buyer/customer” on first use |
| Recommended Gujarati / spoken term | **પાર્ટી** / **ગ્રાહક** |
| Alternative wording | Customer; Buyer; Client; Merchant; Trader |
| Why the decision matters | One consistent account name is needed across order, sale, dispatch, due money, and reports. |
| Risk if misunderstood | Users may think different labels are different accounts or choose a broker/supplier instead of the buyer. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-07 — Delivery Challan vs Delivery Note

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-07` |
| Business concept | The dispatch/delivery document reference sent with fabric |
| Current wording in Weavly | Challan; Challan Number; delivery challan; delivery note; dispatch slip; paper challan |
| Where it appears / reproduce | **Owner:** `/owner/dispatches` → open an existing redacted dispatch detail or a create form → show “Challan Number”; do not submit. Also show the stock sale/dispatch dialog if that is the factory's normal path. |
| Plain-language meaning | The document/reference accompanying sent goods; it is not an invoice or a money receipt. |
| Recommended English term | **Delivery challan** on first use; **Challan** thereafter |
| Recommended Gujarati / spoken term | **ડિલિવરી ચલણ / ચાલાન**; reviewer must confirm spelling used locally. |
| Alternative wording | Delivery Note; Dispatch Slip; Challan |
| Why the decision matters | It is used to identify a physical dispatch and resolve delivery disputes. |
| Risk if misunderstood | It may be mistaken for an invoice, payment receipt, or party-received confirmation. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-08 — Party Ledger vs Commercials

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-08` |
| Business concept | The party-level record of sales, receipts, adjustments, and unpaid amount |
| Current wording in Weavly | Party Ledger; Ledger; Commercials; receivables; dues; outstanding |
| Where it appears / reproduce | **Owner:** `/owner/ledger` and `/owner/commercials` → show the page title, party selector, and due/receipt headings on an authorized redacted account; `/owner/today` → show the related money card. |
| Plain-language meaning | The screen used to see what a party bought, paid, and still owes; it is not a full accounting ledger unless the factory confirms that expectation. |
| Recommended English term | **Party ledger** or **Party account (ledger)** |
| Recommended Gujarati / spoken term | **પાર્ટી હિસાબ / લેજર** |
| Alternative wording | Party account; Customer account; Commercials; Udhar/Len-den term supplied by factory |
| Why the decision matters | The owner needs one obvious place to find money due and money received. |
| Risk if misunderstood | “Commercials” is vague, while “ledger” can promise accounting completeness the screen may not provide. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-09 — Party Order

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-09` |
| Business concept | Confirmed production commitment for a named party |
| Current wording in Weavly | Order; party order; confirmed order; order run; active order; client target |
| Where it appears / reproduce | **Owner:** `/owner/orders` → open one authorized order; `/owner/machines` → show an order target in the assignment selector if present; **Supervisor:** `/supervisor/dashboard` → show the assigned target without saving production. |
| Plain-language meaning | A buyer-backed target with party, metres, and deadline, unlike a market run. |
| Recommended English term | **Party order** on first use; **Order** thereafter |
| Recommended Gujarati / spoken term | **પાર્ટી ઑર્ડર** |
| Alternative wording | Customer order; Order; Job; factory term |
| Why the decision matters | It determines party commitment, loom assignment, stock origin, and delivery tracking. |
| Risk if misunderstood | It can be confused with a purchase order, quotation, or internal backing row for a market run. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-10 — Production Mode

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-10` |
| Business concept | Whether the factory produces for market stock, party orders, or both |
| Current wording in Weavly | Production mode; market-run production; order-based production; both; market_run; order_based; Order-run path |
| Where it appears / reproduce | **Owner:** use the existing completed setup/settings view that displays production mode; do not rerun or change onboarding. Compare visible navigation for Market Runs and Orders. If no read-only mode display exists, use the prepared setup screenshot/context rather than mutating settings. |
| Plain-language meaning | The workflow families the factory actually uses. |
| Recommended English term | **Market stock**, **Party orders**, **Both** |
| Recommended Gujarati / spoken term | **માર્કેટ સ્ટોક / પાર્ટી ઑર્ડર / બંને** |
| Alternative wording | Market run; Order based; Stock production; factory terms |
| Why the decision matters | This choice controls which work screens are visible. |
| Risk if misunderstood | A developer-style value can hide the expected workflow or make “both” unclear. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-11 — Amount Due

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-11` |
| Business concept | Money still owed by a party |
| Current wording in Weavly | receivable; due; outstanding; open dues; pending receipt; balance |
| Where it appears / reproduce | **Owner:** `/owner/commercials`, `/owner/ledger`, and `/owner/today` → use one authorized redacted party → show due/outstanding labels; do not record a receipt. |
| Plain-language meaning | The money the factory still has to collect from the party. |
| Recommended English term | **Amount due** |
| Recommended Gujarati / spoken term | **લેવાનું બાકી** |
| Alternative wording | Outstanding; Receivable; Balance due; Baaki |
| Why the decision matters | It is the primary collection signal. |
| Risk if misunderstood | “Receipt pending” can be mistaken for fabric receipt confirmation rather than money collection. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-12 — Stock Inward

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-12` |
| Business concept | Recording fabric entering godown stock |
| Current wording in Weavly | stock inward; opening stock; rolling inward; expected stock; confirm inward; physical inward |
| Where it appears / reproduce | **Owner:** `/owner/stock` → open the inward form or an existing inward detail without submitting → show source and expected/confirmed state. Use opening-stock context only if the factory uses it. |
| Plain-language meaning | A stock event that makes fabric available in the godown, with source and whether it was physically confirmed. |
| Recommended English term | **Stock inward**, with source and expected/physically counted qualifier |
| Recommended Gujarati / spoken term | **સ્ટોક આવક / ઇનવર્ડ** |
| Alternative wording | Fabric inward; Maal inward; Stock received |
| Why the decision matters | Production expectation, opening stock, and physical receipt are different evidence states. |
| Risk if misunderstood | Expected metres may be treated as counted physical stock and then sold or dispatched incorrectly. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-13 — Fabric Stock Lot

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-13` |
| Business concept | A traceable grouping of fabric by source, quality, cost, and remaining metres |
| Current wording in Weavly | lot; batch; stock lot; source stock; fabric package; opening stock lot |
| Where it appears / reproduce | **Owner:** `/owner/stock` → show one redacted lot row/detail; open a dispatch stock selector without submitting to show the same grouping. |
| Plain-language meaning | A digital quantity group used to trace where fabric came from and how much remains; it is not necessarily one physical roll. |
| Recommended English term | **Fabric stock lot** |
| Recommended Gujarati / spoken term | **કાપડનો સ્ટોક લોટ** |
| Alternative wording | Stock batch; Fabric batch; Lot; factory term |
| Why the decision matters | It connects source, cost, sale, dispatch, and remaining stock. |
| Risk if misunderstood | “Batch” may mean dispatch batch or yarn batch, and “package” may imply one physical unit. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-14 — Yarn vs Material vs Inventory

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-14` |
| Business concept | Yarn used as the weaving input |
| Current wording in Weavly | Yarn; material; thread; inventory; raw material; yarn lot; yarn batch |
| Where it appears / reproduce | **Owner:** `/owner/inventory` → show the yarn heading and one redacted lot; `/owner/estimator` → show warp/weft material rows without saving; `/owner/orders` → show yarn requirements on an existing order if used. |
| Plain-language meaning | The thread/input consumed in weaving, distinct from finished fabric stock. |
| Recommended English term | **Yarn**; use **Materials** only for a genuinely broader category |
| Recommended Gujarati / spoken term | **યાર્ન / સૂતર** |
| Alternative wording | Thread; Raw material; Material; factory term |
| Why the decision matters | Rates, stock, and consumption calculations depend on the material category. |
| Risk if misunderstood | “Inventory” may be confused with finished fabric; “material” is too broad for yarn-specific quantities. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-15 — Beam

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-15` |
| Business concept | Prepared warp carrier mounted or linked to a loom |
| Current wording in Weavly | Beam; active beam; start beam; beam card; beam loaded; consumed/un-consume |
| Where it appears / reproduce | **Owner or Supervisor:** open the existing loom/beam management screen used by the factory → show one authorized beam card and its status; on `/supervisor/dashboard`, show beam context for an assigned loom if present; do not start, consume, or unlink it. |
| Plain-language meaning | The prepared roll of warp yarn fitted to the loom and tracked through use. |
| Recommended English term | **Beam** |
| Recommended Gujarati / spoken term | **બીમ** |
| Alternative wording | Warp beam; Beam roll; factory term |
| Why the decision matters | Beam status connects yarn preparation and loom production. |
| Risk if misunderstood | “Start beam” may sound like manufacturing a beam instead of mounting/linking it, and beam may be confused with loom or yarn lot. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-16 — Worker umbrella term

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-16` |
| Business concept | A person whose work, attendance, assignment, or pay is recorded |
| Current wording in Weavly | Worker; workers; karigar/કારીગર; weaver; operator; staff; employee |
| Where it appears / reproduce | **Owner:** open the existing workers list and one redacted worker detail; **Supervisor:** `/supervisor/workers` → show the list without opening money actions. Repeat in used locales. |
| Plain-language meaning | General name for factory people in Weavly; specific pay or loom roles remain separate. |
| Recommended English term | **Worker** as umbrella; role-specific label where needed |
| Recommended Gujarati / spoken term | **કારીગર** |
| Alternative wording | Karigar; Employee; Staff; Weaver; Operator |
| Why the decision matters | The term appears across assignment, attendance, advances, payroll, and exports. |
| Risk if misunderstood | “Operator” may mean only a loom role and “staff” may be read as salaried workers only. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-17 — Loom-shift Assignment and Shift names

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-17` |
| Business concept | Effective link between loom, worker, day/night shift, pay mode, and production target |
| Current wording in Weavly | assignment; link; assign; worker assignment; loom assignment; shift assignment; operator assignment; day shift; night shift; pali/pાળી |
| Where it appears / reproduce | **Owner:** `/owner/machines` → open an existing assignment detail without editing; **Supervisor:** `/supervisor/machines` and `/supervisor/dashboard` → show loom, worker, and day/night shift context. |
| Plain-language meaning | Who works on which loom, in which shift, for which target and pay basis. |
| Recommended English term | **Loom-shift assignment**; **Day shift / Night shift** |
| Recommended Gujarati / spoken term | **લૂમ-પાળી કામગીરી**; **દિવસની પાળી / રાતની પાળી** |
| Alternative wording | Loom duty; Worker link; Operator assignment; factory shift words |
| Why the decision matters | This link drives production responsibility and piece-rate pay. |
| Risk if misunderstood | A vague assignment or “Today” label can put metres and wages on the wrong person or shift. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-18 — Pay Cycle and Payslip

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-18` |
| Business concept | The wage calculation period and the worker-facing document produced at settlement |
| Current wording in Weavly | payroll cycle; monthly payroll; period; cycle start day; pay date; PDF Slip; payslip; payroll slip; parchi; wage summary |
| Where it appears / reproduce | **Owner:** `/owner/payroll` → show cycle start/end and one authorized redacted settlement; use an already generated QA/authorized payslip or redacted slip—do not settle a worker merely for review. |
| Plain-language meaning | The dates included in a wage calculation and the slip explaining earnings, recovery, adjustments, and net pay. |
| Recommended English term | **Pay cycle** with dates; **Payslip / Hisaab slip** for the document |
| Recommended Gujarati / spoken term | **હિસાબનો સમયગાળો**; **પગાર સ્લિપ / હિસાબ સ્લિપ** |
| Alternative wording | Payroll period; Wage period; Pagar cycle; Parchi |
| Why the decision matters | The reviewer must know which work dates and deductions a payment covers. |
| Risk if misunderstood | “Monthly” can be false for configurable cycles, and an unclear slip can create a worker-pay dispute. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-19 — Archive / History

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-19` |
| Business concept | Historical or closed records retained for viewing |
| Current wording in Weavly | archive; closed; history; completed; sold out; inactive |
| Where it appears / reproduce | **Owner:** `/owner/archive` → show category/status filters and one authorized redacted record; also show a completed market run/order status if present. Do not restore or alter a record. |
| Plain-language meaning | Old records kept for reference; the original business status still matters. |
| Recommended English term | **Archive**, while keeping the specific status such as Completed or Sold out |
| Recommended Gujarati / spoken term | **આર્કાઇવ / જૂના રેકોર્ડ** |
| Alternative wording | History; Old records; Closed records |
| Why the decision matters | Reviewers need to find history without thinking every archived record had the same outcome. |
| Risk if misunderstood | Closed, completed, sold out, inactive, and archived can imply different lifecycle effects. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

## B. Pure consistency changes that become safe only after the approved canonical term is known

These rows do not authorize wording changes now. They record whether the eventual approved word should be applied consistently.

### UX-012-20 — Loom type follows the Loom/Machine decision

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-20` |
| Business concept | Technical category of the weaving equipment |
| Current wording in Weavly | Loom type; machine type; custom type; Jacquard; Rapier; Powerloom |
| Where it appears / reproduce | **Owner:** `/owner/machines` and onboarding's existing read-only loom setup context → show the type label; `/owner/estimator` → show loom configuration type without changing it. |
| Plain-language meaning | The category/configuration of a loom, not its individual name or number. |
| Recommended English term | **Loom type**, only if `UX-012-01` approves Loom |
| Recommended Gujarati / spoken term | **લૂમનો પ્રકાર**, following `UX-012-01` |
| Alternative wording | Machine type; Equipment type; factory term + “type” |
| Why the decision matters | This is a consistency dependency, not a separate asset choice. |
| Risk if misunderstood | UI can look as if Loom and Machine are two different asset classes. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Reference the final choice for `UX-012-01`. |

### UX-012-21 — Metre spelling and abbreviation consistency

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-21` |
| Business concept | Display style for fabric length |
| Current wording in Weavly | meter; meters; metre; metres; m; mtrs; Target (m) |
| Where it appears / reproduce | Compare **Supervisor** `/supervisor/dashboard`, **Owner** `/owner/stock`, `/owner/dispatches`, `/owner/payroll`, and an authorized payslip/export. Show labels only; do not submit. |
| Plain-language meaning | All are presentations of fabric length; quantity and rate must still be visibly different. |
| Recommended English term | **m** beside numbers; **metres** in English prose |
| Recommended Gujarati / spoken term | **મીટર / `m`** |
| Alternative wording | meter(s); mtr; mtrs; reviewer-selected house style |
| Why the decision matters | The eventual approved style should match forms, validation, PDF, WhatsApp, and exports. |
| Risk if misunderstood | Users can confuse a length with a rate or assume differently spelled labels are different measures. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-22 — Sold — pending dispatch label

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-22` |
| Business concept | Sold fabric still physically waiting at the factory |
| Current wording in Weavly | sold not dispatched; pending dispatch; pending meters; available for dispatch |
| Where it appears / reproduce | **Owner:** `/owner/today`, `/owner/dispatches`, and `/owner/stock` → use one authorized redacted sale with unsent balance, if available; otherwise open a non-submitted sale/dispatch form and show the labels. |
| Plain-language meaning | The party bought it, but it has not yet left the factory. |
| Recommended English term | **Sold — pending dispatch** |
| Recommended Gujarati / spoken term | **વેચાયેલ — મોકલવાનું બાકી** |
| Alternative wording | Sold, not sent; Dispatch pending; Delivery pending |
| Why the decision matters | Once the sold/sent terms are approved, this is mainly a consistency change. |
| Risk if misunderstood | It may be counted as unsold stock or as an already failed/lost dispatch. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Reference `UX-012-27`. |

### UX-012-23 — UI, PDF, WhatsApp, export, and help-text consistency

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-23` |
| Business concept | Applying each approved term to every reviewer-visible output |
| Current wording in Weavly | UI may use local/factory words while payslips, WhatsApp summaries, validation, export keys, and docs use English or developer labels. |
| Where it appears / reproduce | Compare one authorized screen with its related redacted generated output: payroll → payslip/WhatsApp; stock/dispatch → export/challan reference; settings → data export. Use existing authorized artifacts only. |
| Plain-language meaning | The same approved concept should have the same understandable wording wherever the factory sees it; internal database names can remain unchanged. |
| Recommended English term | **Use the approved canonical term consistently** |
| Recommended Gujarati / spoken term | **Use the approved factory term consistently in every used locale/output** |
| Alternative wording | Intentionally different short label only when the reviewer records why |
| Why the decision matters | A correct screen label can still fail if a payslip or export uses a conflicting word. |
| Risk if misunderstood | Workers and owners may interpret the same transaction differently across UI and documents. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | List outputs the factory actually uses. |

## C. Terms that must remain distinct because they represent different business concepts

Approving a preferred word must not collapse the boundaries below.

### UX-012-24 — Counter Reading vs Shift Total

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-24` |
| Business concept | Cumulative loom counter value versus fabric made during one shift |
| Current wording in Weavly | opening meter reading; closing meter reading; counter reading; previous shift; Shift Meters; Total metres this shift |
| Where it appears / reproduce | **Supervisor:** `/supervisor/dashboard` → show the current quick shift-total field without saving. If the factory has a real counter-entry screen/record, show an authorized example; otherwise mark the counter concept `D`. Review production history/export labels if used. |
| Plain-language meaning | Counter reading is the number displayed by the loom counter; shift total is the output for one shift, often closing minus opening. |
| Recommended English term | **Counter reading** only for an actual counter; **Shift metres** for shift output |
| Recommended Gujarati / spoken term | **કાઉન્ટર રીડિંગ**; **પાળીના મીટર** |
| Alternative wording | Machine counter; Meter reading; Shift total; Production metres |
| Why the decision matters | These are different evidence and must not share one label. |
| Risk if misunderstood | Entering the cumulative counter as output can massively overstate stock and worker wages. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | State whether the factory actually records counter readings. |

### UX-012-25 — Fabric Quality vs Run vs Order

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-25` |
| Business concept | Fabric specification, market-stock production job, and buyer-backed job |
| Current wording in Weavly | Quality; fabric label; run; Market Run; active order; assigned target |
| Where it appears / reproduce | **Owner:** `/owner/machines` → show one loom's quality and target; `/owner/estimator`, `/owner/market-runs`, `/owner/orders` → show one authorized context for each used workflow. **Supervisor:** `/supervisor/dashboard` → show the same loom context without saving. |
| Plain-language meaning | Quality says **what fabric**; run/order says **why/for whom/how much it is being produced**. |
| Recommended English term | **Fabric quality**; **Market run**; **Party order** as separate labels |
| Recommended Gujarati / spoken term | **કાપડની ક્વોલિટી**; **માર્કેટ રન**; **પાર્ટી ઑર્ડર** |
| Alternative wording | Design/Item; Market maal/Stock run; Customer order |
| Why the decision matters | One loom card may show all three ideas together. |
| Risk if misunderstood | The wrong quality or target can be selected, breaking costing, stock origin, and delivery commitment. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Cross-reference `UX-012-03`, `04`, and `09`. |

### UX-012-26 — Quotation vs Estimate

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-26` |
| Business concept | Internal costing calculation versus customer-facing price offer |
| Current wording in Weavly | Estimator; estimate; costing; cost analysis; saved estimate; Quote; quotation; accepted quote; offer |
| Where it appears / reproduce | **Owner:** `/owner/estimator` → open an existing saved cost analysis and show calculated cost/margin; `/owner/quotes` → open an authorized redacted quote. Do not save, send, accept, or convert it. |
| Plain-language meaning | Estimate calculates internal cost and suggested price; quotation is the offer shown/sent to a party. |
| Recommended English term | **Cost estimate**; **Quotation** |
| Recommended Gujarati / spoken term | **ખર્ચનો અંદાજ**; **ભાવપત્રક / કોટેશન** |
| Alternative wording | Costing / Quote; Calculation / Offer; factory terms |
| Why the decision matters | Internal cost and external commitment must remain visibly separate. |
| Risk if misunderstood | A draft cost can be sent as a customer price or treated as an accepted order. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Give both preferred terms. |

### UX-012-27 — Sold vs Sent vs Received quantities

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-27` |
| Business concept | Quantity sold, quantity physically sent, and quantity acknowledged by the party |
| Current wording in Weavly | sold metres; sold quantity; sent/dispatched metres; actual dispatched metres; received quantity; trader received; receipt confirmation |
| Where it appears / reproduce | **Owner:** `/owner/dispatches` → open one authorized redacted dispatch detail with sold/sent/received context, or a non-submitted form; `/owner/stock` and `/owner/commercials` → show related quantity headings. Do not confirm receipt. |
| Plain-language meaning | Sold is the commercial quantity; sent left the factory; received is what the party says arrived. |
| Recommended English term | **Metres sold**; **Metres sent**; **Metres received by party** |
| Recommended Gujarati / spoken term | **વેચાયેલા મીટર**; **મોકલેલા મીટર**; **પાર્ટીને મળેલા મીટર** |
| Alternative wording | Sale quantity; Dispatched quantity; Party-received quantity |
| Why the decision matters | Each quantity changes a different stock, receivable, shortage, or claim state. |
| Risk if misunderstood | Stock can be decremented twice, unsent goods can look delivered, or a shortage claim can be missed. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Give three distinct terms. |

### UX-012-28 — Piece-rate vs Salaried worker

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-28` |
| Business concept | Worker paid from output versus worker paid by salary/day/attendance |
| Current wording in Weavly | meter worker; piece-rate worker; floor worker; production worker; fixed worker; salaried staff; staff; monthly worker; day-to-day worker |
| Where it appears / reproduce | **Owner:** workers setup/detail, `/owner/payroll`, and `/owner/advances` → show one redacted worker of each used pay type; **Supervisor:** worker/assignment view → show pay-type label without money action. |
| Plain-language meaning | Piece-rate pay comes from metres/rate; salaried pay comes from salary/day/attendance rules. |
| Recommended English term | **Piece-rate worker** (helper “paid per metre”); **Salaried worker** |
| Recommended Gujarati / spoken term | **મીટર દરનો કારીગર**; **ફિક્સ પગારનો કારીગર** |
| Alternative wording | Meter worker; Production worker; Fixed worker; Monthly worker |
| Why the decision matters | The classification selects the wage calculation path. |
| Risk if misunderstood | “Meter worker” can sound like a counter reader; “fixed” can mean permanent employment rather than pay mode. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Give two distinct terms. |

### UX-012-29 — Warp and Weft, including local floor terms

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-29` |
| Business concept | Lengthwise yarn versus crosswise yarn |
| Current wording in Weavly | warp; warp yarn; tana/તાણો; warp requirement; weft; weft yarn; bana/વાણો; picks; weft requirement |
| Where it appears / reproduce | **Owner:** `/owner/estimator` → open an existing authorized quality and show warp/weft rows and `kg/100m`; `/owner/orders` → show yarn requirements if used; beam card → show warp context. Do not save. |
| Plain-language meaning | Warp runs lengthwise on the beam; weft is inserted across the cloth. |
| Recommended English term | **Warp yarn**; **Weft yarn** |
| Recommended Gujarati / spoken term | **તાણો / “warp”**; **વાણો / “weft”** — the reviewer must supply the factory's actual pronunciation/spelling. |
| Alternative wording | Tana and Bana; Warp and Weft; local floor pair |
| Why the decision matters | The two yarn directions have different formulas and settings. |
| Risk if misunderstood | Reversal materially changes yarn requirement, crimp/waste treatment, and cost. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Give both local floor terms and script/transliteration. |

### UX-012-30 — All displayed units

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-30` |
| Business concept | Length, weight, rates, yarn consumption, and yield |
| Current wording in Weavly | `m`; `₹/m`; `kg`; `₹/kg`; `kg/100m`; `m/kg`, plus metre/meter/mtrs and kilo/kilogram |
| Where it appears / reproduce | **Owner:** `/owner/estimator` → show yarn/process rate, consumption, and yield labels; `/owner/stock` and `/owner/dispatches` → show length; `/owner/inventory` → show kg and ₹/kg. Use existing/redacted records or non-submitted forms. |
| Plain-language meaning | `m` length; `₹/m` rupees per metre; `kg` weight; `₹/kg` rupees per kilogram; `kg/100m` yarn needed for 100m; `m/kg` metres produced per kg. |
| Recommended English term | Keep symbols exactly: **m, ₹/m, kg, ₹/kg, kg/100m, m/kg**, with plain-language helpers for the inverse units. |
| Recommended Gujarati / spoken term | **મીટર, રૂપિયા પ્રતિ મીટર, કિલો, રૂપિયા પ્રતિ કિલો, 100 મીટર દીઠ કિલો, પ્રતિ કિલો મીટર** |
| Alternative wording | Reviewer-approved symbols/words that preserve the same dimensions |
| Why the decision matters | Units control costing, stock, sale rate, and consumption. |
| Risk if misunderstood | `kg/100m` and `m/kg` are inverse; swapping them can create a major estimate and purchase error. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Record any change separately for each of the six units. |

### UX-012-31 — Dispatch vs Sale vs Delivery/Receipt

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-31` |
| Business concept | Commercial sale, physical sending, and party confirmation |
| Current wording in Weavly | Dispatch; dispatch batch; shipment; delivery; send; Sell & Dispatch; pending dispatch; receipt confirmation |
| Where it appears / reproduce | **Owner:** `/owner/stock` → open Sell & Dispatch without submitting; `/owner/dispatches` → show create/detail and receipt-confirmation labels on an authorized record; `/owner/commercials` → show the sale/money side. |
| Plain-language meaning | Sale creates the commercial obligation; dispatch moves fabric; receipt confirms what the party received. |
| Recommended English term | **Sale**; **Dispatch**; **Party receipt confirmation** as separate actions |
| Recommended Gujarati / spoken term | **વેચાણ**; **ડિસ્પેચ / માલ મોકલવો**; **પાર્ટીને માલ મળ્યાની ખાતરી** |
| Alternative wording | Sell; Send/Shipment; Delivery confirmation |
| Why the decision matters | One combined button may start related but not identical lifecycle events. |
| Risk if misunderstood | A user can believe fabric was sent when only a sale was saved, or confuse fabric receipt with money receipt. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-32 — Upaad, Kharchi, Hisaab payout, Inam, and Kapaat boundaries

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-32` |
| Business concept | Five different worker-money events |
| Current wording in Weavly | advance/Upaad; Record Kharchi; payroll payout/settlement; inam/bonus; kapaat/deduction/recovery |
| Where it appears / reproduce | **Owner:** `/owner/advances` and `/owner/payroll` → show authorized redacted advance, adjustment, recovery, and payout labels; **Supervisor:** `/supervisor/workers` → open Kharchi dialog without submitting. Use an existing authorized payslip for cross-check. |
| Plain-language meaning | Upaad creates recoverable worker debt; Kharchi uses supervisor float; payout pays net wages; Inam adds approved pay; Kapaat subtracts an approved adjustment; Upaad recovery reduces existing debt. |
| Recommended English term | Keep all five named and separate; never use “adjustment” alone where the type matters. |
| Recommended Gujarati / spoken term | **ઉપાડ; ખર્ચી; પગાર/હિસાબ ચૂકવણી; ઇનામ; કપાત** |
| Alternative wording | Exact factory terms, provided each accounting effect remains distinct |
| Why the decision matters | Each event changes a different balance and authorization trail. |
| Risk if misunderstood | Worker debt, supervisor cash, net pay, bonus, and deduction can be posted to the wrong ledger. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Explain each used event in the reviewer's own words. |

## D. Terms intentionally retained in local factory vocabulary

“Intentionally retained” is still a proposal until the reviewer chooses `A`, `B`, or `C`. These familiar floor words should keep an English helper where needed and must preserve the business boundaries in section C.

### UX-012-33 — Upaad / Worker Advance

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-33` |
| Business concept | Recoverable money advanced to a worker |
| Current wording in Weavly | Upaad; Upad; advance; worker advance; Advances (Upaad) |
| Where it appears / reproduce | **Owner:** `/owner/advances` → show one authorized redacted worker advance and balance; **Supervisor:** `/supervisor/workers` → show advance context without recording cash; **Owner:** `/owner/payroll` → show recovery label on an authorized preview/slip. |
| Plain-language meaning | Money given before wages and later recovered through the worker's hisaab. |
| Recommended English term | **Upaad (worker advance)** |
| Recommended Gujarati / spoken term | **ઉપાડ** |
| Alternative wording | Worker advance; Advance; exact factory spelling/transliteration |
| Why the decision matters | The local word is familiar but should clearly state its recoverable-debt meaning. |
| Risk if misunderstood | It can be confused with Kharchi, a wage payment, or a non-recoverable expense. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Confirm spelling and whether every Upaad is recoverable. |

### UX-012-34 — Kharchi, kept distinct from Upaad

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-34` |
| Business concept | Cash issued/spent through the supervisor's floor float |
| Current wording in Weavly | Kharchi; Record Kharchi; petty cash; floor expense; cash given; supervisor float |
| Where it appears / reproduce | **Supervisor:** `/supervisor/workers` → select an authorized redacted worker → open `Record Kharchi` dialog → show amount/purpose/float context; close without submitting. **Owner:** show the related audit/advance effect if an authorized record exists. |
| Plain-language meaning | A supervisor-float cash event; when given to a worker it may also create the related advance, but it is not the same concept as worker debt. |
| Recommended English term | **Kharchi**, with an explicit purpose and accounting-effect helper |
| Recommended Gujarati / spoken term | **ખર્ચી** |
| Alternative wording | Floor cash; Petty cash; Cash given; factory term |
| Why the decision matters | The floor action and the worker advance ledger must remain understandable and reconcilable. |
| Risk if misunderstood | It can be recorded as an ordinary expense, wage payment, or duplicate Upaad. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | State what “Kharchi” means in this factory and who receives it. |

### UX-012-35 — Worker Hisaab vs Payroll vs Pagar Hisaab

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-35` |
| Business concept | Closing a worker's pay period and paying the net result |
| Current wording in Weavly | Hisaab; Payroll / Hisaab; Settle Hisaab; payroll; settlement; wage settlement; pay cycle; payout |
| Where it appears / reproduce | **Owner:** `/owner/today` → show “Payroll / Hisaab” and “Settle Hisaab”; `/owner/payroll` → show an authorized redacted preview with gross, Upaad/recovery, adjustments, and net pay. Do not settle. |
| Plain-language meaning | Review earnings, recoveries/adjustments, net payout, and carried balance for a defined cycle. |
| Recommended English term | **Worker hisaab**, helper “payroll settlement” |
| Recommended Gujarati / spoken term | **કારીગરનો હિસાબ / પગાર હિસાબ** |
| Alternative wording | Payroll; Pagar Hisaab; Wage settlement; factory term |
| Why the decision matters | It is the final worker-pay action and appears on owner screens and worker documents. |
| Risk if misunderstood | Generic “settlement” can be confused with party or payment-provider settlement, and the worker may not understand what was deducted. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes |  |

### UX-012-36 — Taka vs Roll vs Package vs Bale

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-36` |
| Business concept | The factory's physical packed fabric unit |
| Current wording in Weavly | taka; takas; roll; rolls; package; bale; bulk; unit label |
| Where it appears / reproduce | **Owner:** `/owner/stock` → show one authorized row/form with total metres, metres per unit, and configured unit; open stock sale/dispatch selection without submitting. Also inspect the related redacted export if the factory uses it. |
| Plain-language meaning | The physical unit the factory counts in addition to metres; the exact object may differ by factory. |
| Recommended English term | **Taka** only if that is the factory's actual unit; otherwise use the reviewer-supplied unit |
| Recommended Gujarati / spoken term | **તાકા / રોલ**, exact factory word required |
| Alternative wording | Roll; Package; Bale; Bulk; another factory term |
| Why the decision matters | Unit count supports stock, sale, loading, and discrepancy checks. |
| Risk if misunderstood | These objects are not always interchangeable, so stock and dispatch counts can be materially wrong. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Define one unit physically, including whether roll/package/bale differ. |

### UX-012-37 — Inam, Kapaat, and Hajiri

| Field | Review detail |
| --- | --- |
| Decision ID | `UX-012-37` |
| Business concept | Positive pay adjustment, negative pay adjustment, and attendance |
| Current wording in Weavly | inam; bonus; earning adjustment; kapaat; deduction; recovery; attendance; hajiri; present/absent |
| Where it appears / reproduce | **Owner:** `/owner/payroll` → show authorized redacted Inam/Kapaat labels in an adjustment/preview; **Supervisor:** `/supervisor/attendance` → show Hajiri and present/absent controls without changing a record. |
| Plain-language meaning | Inam adds approved pay; Kapaat subtracts an approved adjustment; Hajiri records presence used for attendance-based pay. |
| Recommended English term | **Inam (bonus)**; **Kapaat (deduction)**; **Hajiri (attendance)** |
| Recommended Gujarati / spoken term | **ઇનામ; કપાત; હાજરી** |
| Alternative wording | Bonus; Deduction; Attendance; exact factory terms |
| Why the decision matters | Familiar local terms can be retained while their payroll effect stays explicit. |
| Risk if misunderstood | Kapaat may be confused with Upaad recovery, Inam with statutory bonus, or Hajiri with a loom assignment. |
| Reviewer choice | ___ (`A`, `B`, `C`, or `D`) |
| Reviewer notes | Give a separate decision for each used term. |

## Reviewer identity and completion

Reviewer: ____________________
Factory role: ____________________
Factory: ____________________
Languages reviewed: ____________________
Weavly deployed URL/build/commit reviewed: ____________________
Date/time/time zone: ____________________
Traceable approval/signature reference: ____________________
Open unclear terms: ____________________

This register is complete only when every row has a choice and any `B`, `C`, or `D` choice has an explanatory note. A completed first review does **not** make `UX-012` pass when changes are requested. Implement only the reviewer's decisions, retest every affected UI/locale/output, and obtain the same reviewer's dated re-approval before any status promotion.

## Compact response format

Copy this block and fill every line. For `B`, name the chosen alternative. For `C`, supply the exact factory term and language/script. For `D`, say what the factory does instead.

```text
UX-012-01:
UX-012-02:
UX-012-03:
UX-012-04:
UX-012-05:
UX-012-06:
UX-012-07:
UX-012-08:
UX-012-09:
UX-012-10:
UX-012-11:
UX-012-12:
UX-012-13:
UX-012-14:
UX-012-15:
UX-012-16:
UX-012-17:
UX-012-18:
UX-012-19:
UX-012-20:
UX-012-21:
UX-012-22:
UX-012-23:
UX-012-24:
UX-012-25:
UX-012-26:
UX-012-27:
UX-012-28:
UX-012-29:
UX-012-30:
UX-012-31:
UX-012-32:
UX-012-33:
UX-012-34:
UX-012-35:
UX-012-36:
UX-012-37:
Reviewer:
Factory role:
Factory:
Languages reviewed:
Build/commit reviewed:
Date/time/time zone:
Traceable approval/signature reference:
Open unclear terms:
```

Examples:

```text
UX-012-01: A
UX-012-02: C — use “Shift Production” / “શિફ્ટ પ્રોડક્શન”
UX-012-24: D — counter readings are not recorded in this factory
```
