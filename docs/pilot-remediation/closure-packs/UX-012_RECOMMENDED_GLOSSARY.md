# UX-012 — Recommended Canonical Glossary

Prepared: 2026-07-14 IST

Status: **product-owner-approved provisional limited-pilot baseline**. Actual pilot factory-user comprehension validation remains open; this is not factory-supervisor approval.

The English and Gujarati entries below are the provisional implementation baseline approved by the product owner on 2026-07-14. Gujarati/local wording remains a pilot-validation priority. The actual pilot user must identify confusing or rejected wording in context, corrections must be implemented, and the user must confirm after changes.

| Canonical English proposal | Suggested Gujarati | Do not use interchangeably with | Definition / usage rule |
| --- | --- | --- | --- |
| Loom | લૂમ | generic machine, loom type | One physical weaving loom. Keep `machine` only as an internal technical identifier unless the supervisor chooses it for UI. |
| Loom type | લૂમનો પ્રકાર | loom name/number | Technical category such as Jacquard or Rapier. |
| Metres Produced This Shift | આ પાળીમાં ઉત્પાદિત મીટર | Counter Reading, daily total | Fabric metres produced on one loom in the selected shift. |
| Counter reading | કાઉન્ટર રીડિંગ | shift meters | Actual cumulative loom-counter value; show only in a real counter-entry mode. |
| Fabric quality | કાપડની ક્વોલિટી | market run, order, grade | Named fabric construction/specification used by costing, production and stock. |
| Market run | માર્કેટ રન | party order, shift | Production for market/godown stock without a committed buyer order. |
| Party order | પાર્ટી ઑર્ડર | quotation, market run | Confirmed buyer production target with party, metres and deadline. |
| Cost estimate | ખર્ચનો અંદાજ | quotation | Internal calculation of cost, margin and suggested price. |
| Quotation | ભાવપત્રક / કોટેશન | cost estimate, order | Customer-facing price proposal before acceptance. |
| Party | પાર્ટી / ગ્રાહક | supplier, broker | Buyer/account responsible for a sale, order, payment or claim. |
| Party ledger | પાર્ટી હિસાબ | stock ledger, payroll | Party-level sales/invoices, receipts, adjustments and balance. |
| Amount due | લેવાનું બાકી | fabric receipt | Money still owed by the party. |
| Godown stock | ગોડાઉન સ્ટોક | yarn inventory | Fabric recorded as available/pending in the godown; label expected versus physically counted state. |
| Stock Lot | કાપડનો સ્ટોક લોટ | dispatch batch, yarn batch | Traceable fabric quantity grouped by source, quality and cost. |
| Taka | તાકા (confirm spelling/meaning) | roll, bale, package | Physical unit used by the pilot factory; change the canonical term if the factory uses a different unit. |
| Stock inward | સ્ટોક આવક / ઇનવર્ડ | production estimate | Recording fabric entering available godown stock, with source and physical/expected status. |
| Dispatch | ડિસ્પેચ | sale, party receipt | Physical movement of fabric out of the factory. |
| Delivery challan | ડિલિવરી ચલણ / ચાલાન | invoice, payment receipt | Dispatch document reference accompanying the goods. |
| Metres sold | વેચાયેલા મીટર | metres sent, metres received | Quantity contractually sold. |
| Metres sent | મોકલેલા મીટર | metres sold, metres received | Quantity physically dispatched from the factory. |
| Metres received by party | પાર્ટીને મળેલા મીટર | money received | Quantity acknowledged by the party. |
| Sold — pending dispatch | વેચાયેલ — મોકલવાનું બાકી | available unsold stock | Sold quantity still physically awaiting dispatch. |
| Yarn | યાર્ન / સૂતર | finished fabric stock | Raw weaving thread/material. |
| Warp yarn | તાણો / Warp (confirm) | weft yarn | Lengthwise yarn prepared on the beam. |
| Weft yarn | વાણો / Weft (confirm) | warp yarn | Crosswise yarn inserted during weaving. |
| Beam | બીમ | yarn lot, loom | Prepared warp carrier mounted/linked to a loom. |
| Worker | કારીગર (Karigar) | party, supervisor role | Use Worker in English and Karigar in applicable Gujarati/local context. |
| Piece-rate worker | મીટર દરનો કારીગર | salaried worker | Worker paid from production metres and rate. |
| Salaried worker | ફિક્સ પગારનો કારીગર | piece-rate worker | Worker paid by salary/day/attendance rather than loom output. |
| Loom-shift assignment | લૂમ-પાળી કામગીરી | order assignment | Effective link between loom, worker, shift, pay mode and target. |
| Day shift / Night shift | દિવસની પાળી / રાતની પાળી | today total | Defined production period used for entry and accountability. |
| Upaad (worker advance) | ઉપાડ | Kharchi, wage payment | Recoverable money advanced to a worker. |
| Kharchi | ખર્ચી | Upaad, payroll payout | Supervisor-float cash event; always explain the exact accounting effect. |
| Worker hisaab | કારીગરનો હિસાબ | party settlement, payment-provider settlement | Payroll close: earnings, recoveries/adjustments, net payout and carry-forward. |
| Inam (bonus) | ઇનામ | ordinary wage | Approved positive manual payroll adjustment. |
| Kapaat (deduction) | કપાત | Upaad recovery | Approved negative payroll adjustment with a reason. |
| Hajiri (attendance) | હાજરી | shift assignment | Present/absent record used for attendance-based pay. |
| Pay cycle | હિસાબનો સમયગાળો | calendar month | Explicit payroll start/end period and pay date. |

## Unit style proposal

| Quantity/rate | UI symbol | Plain-language helper |
| --- | --- | --- |
| Fabric length | `m` | metres |
| Yarn/beam weight | `kg` | kilograms |
| Fabric rate | `₹/m` | rupees per metre |
| Yarn/process rate | `₹/kg` | rupees per kilogram |
| Yarn consumption | `kg/100m` | kilograms of yarn needed for 100 metres of fabric |
| Yield | `m/kg` | metres of fabric produced per kilogram |

Never show `m/kg` and `kg/100m` without their plain-language helper; they are inverse concepts and a reversal materially changes an estimate.

## Application rule after approval

Use the approved term consistently in navigation, heading, field label, helper, validation/toast, empty state, mobile screen, PDF/WhatsApp output, export column/documentation, and screenshot evidence. Internal database names may remain stable when translating them at the UI/export boundary avoids migration risk.
