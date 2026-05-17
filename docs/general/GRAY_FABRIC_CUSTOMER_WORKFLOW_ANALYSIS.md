# Gray Fabric Customer Workflow Analysis

Date: May 17, 2026

Target customer stance: owner/operator of a Surat-style grey fabric weaving unit or trader-manufacturer who produces market maal, sells through traders/brokers, dispatches takas/rolls, manages worker hisaab, and tracks money mostly through memory, registers, Excel, WhatsApp, and phone calls.

## Executive Summary

The product is pointed in the right direction. The strongest loop is:

1. Estimate fabric cost.
2. Start market run or party order.
3. Supervisor logs loom production.
4. Production creates expected godown stock.
5. Owner sells and dispatches takas.
6. Commercials tracks profit, receivable, and payment.
7. Payroll uses production logs for worker hisaab.

The stock-inward pivot is correct. A grey fabric owner does not want to manually inward every production lot if the same person already has to run the factory, sell the maal, and chase payments. The app now treats stock as an expected ledger from production and checks physical reality at dispatch, which matches the real workflow better than daily manual inward.

The main remaining risk is that several workflows still assume clean, structured data entry at the wrong moment. A real user will tolerate one quick shift log and one sale/dispatch entry. They will not maintain perfect day/night worker assignments, order anchors, quality masters, party records, physical stock counts, and discrepancy reviews unless those are embedded into the exact moment they already do the work.

## Customer Reality

Grey fabric manufacturing is not a generic ERP workflow. The owner thinks in a few operational questions:

- What is running on each loom?
- How many meters were produced?
- Which maal is ready or expected in godown?
- Which takas can I sell today?
- What rate did I sell at and what margin did I make?
- Which dispatch is pending or disputed?
- Who owes me money and since when?
- What is the worker hisaab?

External workflow signals:

- Fabric production normally flows through preparation, weaving, inspection, and warehouse/packing. Warping winds yarn to beam, sizing strengthens warp, weaving produces greige fabric, and inspection/warehouse prepare it for packing and dispatch. Source: [PT BNP production process](https://www.bnptextile.com/production/).
- Inspection and packing often require roll/bale identifiers, length, weight, loom number, batch/lot number, production date, grade, and order number. Source: [The Textile Compass on grey fabric inspection and packing](https://denimstudent.com/lecture-4-fabric-inspection-and-grey-fabric-packing-the-final-steps-in-the-weaving-mill/).
- Surat grey fabric trade commonly involves brokers/commission agents, cash/cheque/credit-like payments, customized packaging, and road shipment. Source: [Textile Infomedia grey broker listing](https://www.textileinfomedia.com/Gautam-Textile-Agency).
- E-way bill handling matters around dispatch. CBIC rules reference e-way bill generation around the Rs 50,000 consignment value threshold, transporter details, invoice/bill/challan carriage, and validity periods. Source: [CBIC GST e-way bill rules](https://cbic-gst.gov.in/ewaybill-rules.html).
- Credit discipline matters. MSME delayed payment guidance says buyer-seller agreed payment terms cannot exceed 45 days, with interest consequences for delay. Source: [Ministry of MSME delayed payment FAQ](https://msme.gov.in/node/401).

## What The App Gets Right

### 1. Market-run first mode fits this customer

Defaulting to market-run production is sensible. Many grey fabric units keep looms running even before a named buyer exists. The product has a production mode where market runs, stock, dispatches, commercials, payroll, and analytics stay active while quotes/orders can be hidden (`lib/production-mode.ts:23-73`).

### 2. The stock-inward retreat is the correct product call

The active stock screen labels market-run stock as "Godown Ledger" and explicitly says expected meters are not a daily physical confirmation (`app/(dashboard)/owner/stock/TakaStockClient.tsx:648-690`). This aligns with the owner's reality: physical stock is checked when stock is sold, counted, loaded, or disputed.

### 3. Factory Today has the right mental model

Factory Today puts production, loom assignment, work at risk, sold-not-dispatched, pending receipts, payroll, and quick actions into one owner view. That matches the daily operating questions better than a generic BI dashboard.

### 4. Sell & Dispatch is the right workflow shape

Combining sale, stock depletion, dispatch metadata, tracking, and receivable creation is right. The user does not think "first create a sale row, then create a dispatch row, then create a receivable." They think "maal gaya, rate kya, transporter kaun, paisa kab ayega?"

### 5. Payroll from production logs is a strong anchor

If the shift log becomes trusted, payroll becomes much easier. Worker hisaab is one of the clearest reasons for a factory owner to keep using the product.

## High Priority Gaps

### Gap 1: Production logging is still too brittle for real floor behavior

The supervisor screen filters eligible looms to only those with a current order and both day and night standing workers assigned (`app/(dashboard)/supervisor/actions.ts:771-779`). The save path repeats this guard and blocks production unless the loom has active order/current order plus day and night workers (`app/(dashboard)/supervisor/actions.ts:1107-1120`).

Why this is a problem:

- Some factories are day-only or temporarily night-closed.
- Workers change, substitute, or share looms.
- A loom may produce today even if the owner did not perfectly assign the order in advance.
- The app may show "no looms found" or block a valid shift because master data is incomplete.

Customer reaction:

> "Maal bana hai. Tumhara software bol raha hai setup incomplete. Mere paas abhi setup karne ka time nahi."

Recommendation:

- Separate "eligible to display" from "ideal setup."
- Show all active looms.
- Let supervisor enter meters even when worker/order is missing, but mark the row as "needs owner mapping" before payroll/stock finalization.
- Do not require both day and night workers for a single-shift factory. Require the current shift worker only.
- Add an owner queue: "Unmapped production - assign worker/order before payroll."

### Gap 2: The app claims meter-reading trust, but the UI saves shift totals as fake readings

The supervisor submit path sends `opening_meter_reading: 0` and `closing_meter_reading: metersProduced` (`app/(dashboard)/supervisor/dashboard/page.tsx:787-803`). This is simple, but it means the app is not actually using loom counter opening/closing readings.

Why this matters:

- If owners trust physical counter readings, this implementation does not give that proof.
- If the product wants low friction, then it should stop pretending it is a meter-counter workflow.
- Suspicious reading validation becomes weak if opening/closing are synthetic.

Recommendation:

Choose one product stance:

- Quick mode: "Shift meters only." Make it honest and optimize for speed.
- Counter mode: "Closing reading only." Derive opening from last log, allow counter reset, and calculate shift production automatically.

For this target customer, start with quick mode plus exception detection. Add counter mode only for factories that already use loom counter registers.

### Gap 3: Market-run dispatch still depends on a party order

Market-run mode hides Orders in navigation (`lib/production-mode.ts:55-73`), but Sell & Dispatch still asks "Who is this dispatch for?" and requires an active party order (`components/dispatches/SellAndDispatchDialog.tsx:187-205`; `app/(dashboard)/owner/dispatches/actions.ts:39-66`). The SQL function also rejects dispatch from non-active orders (`supabase/migrations/20260506133000_dispatch_sold_stock_sales.sql:76-89`).

Why this is a problem:

- Market maal is often sold after production to a trader, broker, processor, or known buyer.
- That buyer may not have existed as an order before production.
- Forcing a fake order creates data pollution and makes the user feel the app's mental model is wrong.

Recommendation:

Make Sell & Dispatch party-first:

1. Select/create party or trader.
2. Select stock/takas.
3. Enter rate, broker/commission, date, and payment terms.
4. Create sale, dispatch, and receivable.

Use order only when dispatch is against a real pre-committed party order.

### Gap 4: Receivables are not yet strong enough for the textile money loop

Commercials has the right top-level cards: realized revenue, profit, money to collect, expected profit (`app/(dashboard)/owner/commercials/CommercialsClient.tsx:351-380`). It lists receivables and lets owners record payment (`app/(dashboard)/owner/commercials/CommercialsClient.tsx:392-535`).

But receivables are created only for fabric stock sales, and when a stock sale is not linked to an order, the party becomes "Anonymous" (`lib/commercials/receivables.ts:11-75`). The code also has a TODO for market-run sale and party invoice receivables (`lib/commercials/receivables.ts:74-75`).

Why this is a problem:

- The owner cares as much about "who owes me money" as "how much profit did I make."
- Broker, credit days, cheque, due date, payment promise, partial payment, and deductions are central.
- Anonymous receivables destroy trust.

Recommendation:

- Add a lightweight party picker in Sell & Dispatch.
- Store party name, phone, broker, GSTIN, credit days, and due date at sale time.
- Use the existing party ledger schema concepts instead of leaving `/owner/ledger` archived forever. The schema already supports party type, broker name, credit days, credit limit, invoices, receipts, and adjustments (`supabase/migrations/20260428120000_party_ledger.sql:13-79`).
- Surface overdue buckets: due today, 1-7 days overdue, 8-30, 30+.

### Gap 5: Discrepancy creation exists, but the owner review loop is incomplete

Sell & Dispatch inserts `stock_discrepancies` when actual dispatched meters differ from expected meters (`app/(dashboard)/owner/dispatches/actions.ts:147-166`). Dispatch overview surfaces open discrepancy counts in parts of the app, but there is no obvious first-class workflow to resolve, write off, convert to party claim, or adjust receivable.

Why this is a problem:

- Shortage/excess is not just an alert. It affects stock, profit, party claims, and trust.
- Owners need to decide: recount, sample/cutting, damage, dispatch shortage, party claim, worker/floor issue, or write-off.

Recommendation:

Add a "Review Differences" queue in Stock or Factory Today:

- Show expected vs actual meters.
- Ask for reason: recount, damage, sample, loading shortage, party claim, processing return, internal adjustment.
- Choose accounting effect: adjust stock only, create claim/deduction, write off, or mark resolved.
- Keep photo/note optional, not mandatory.

### Gap 6: Taka/roll identity is too averaged for dispatch-grade confidence

The app models lot-level `available_taka_count`, `available_meters`, and average meters per unit. That is fine for high-level stock valuation. It is weaker for loading and disputes, where physical labels matter.

Why this is a problem:

- Real packing labels often carry roll/bale number, length, weight, loom number, batch/lot number, production date, grade, and order number.
- A customer dispute often starts with "which taka was short/damaged?"

Recommendation:

Do not add a daily packing ERP. Instead, add optional dispatch-time taka detail:

- Allow "simple dispatch": count units and actual meters.
- Allow "detailed dispatch": add taka numbers and per-taka meters only for selected shipment.
- Print/share a packing list from dispatch.
- Store defect/grade only if the owner wants to use it.

### Gap 7: Tax/dispatch metadata is useful but too incomplete to be relied on

The dispatch flow asks for e-way bill number, vehicle number, transporter, and distance. The SQL estimates GST at 5 percent and sets e-way required based on sale value plus GST crossing Rs 50,000 (`supabase/migrations/20260506133000_dispatch_sold_stock_sales.sql:56-59`, `supabase/migrations/20260506133000_dispatch_sold_stock_sales.sql:117-164`).

Why this is a problem:

- Actual GST/e-way handling needs party GSTIN, state, place of supply, HSN/SAC, invoice/challan number, taxable value, transport mode, vehicle format, and whether movement is supply, job work, sample, or return.
- A wrong compliance hint is worse than no hint if the owner relies on it.

Recommendation:

Keep this as a checklist unless the app collects the required fields. Label it "E-way reminder" rather than "compliance done." Add party GSTIN/state and invoice/challan number before claiming dispatch paperwork readiness.

## Medium Priority Gaps

### Gap 8: Broker/commission exists in costing but not in settlement reality

The estimator has broker commission as a cost input, but sales/receivables do not clearly capture broker, commission payable, or net realization. In the Surat grey fabric market, broker involvement is common enough that this should not be buried in notes.

Recommendation:

- Add optional broker to party/sale.
- Store broker commission percent or INR/m.
- Show gross sale, broker commission, transport, and net receivable.

### Gap 9: Claims and rate differences need a path into money

The party ledger schema already names claim/deduction adjustments, but the active Commercials surface mostly handles simple receipt recording. Real payment collection often includes shortage, damage, late discount, rate difference, or claim deduction.

Recommendation:

- Add "Record deduction/claim" on a receivable.
- Link claim to dispatch discrepancy when relevant.
- Keep the first version simple: amount, reason, note, date.

### Gap 10: Activation checklist can give false friction around qualities

Factory Today checks `qualities` for "has quality" (`app/(dashboard)/owner/today/actions.ts:238-246`), while the estimator quality picker primarily uses saved estimator templates as "Saved estimator qualities" (`app/(dashboard)/owner/estimator/EstimatorClient.tsx:1497-1523`). This can make a user feel setup is incomplete even after saving a real quality template.

Recommendation:

Treat an active estimator template as a completed quality for onboarding/activation.

## What To Deprioritize

These should not be core-loop blockers for the target pilot:

- Full yarn/beam inventory ERP.
- Daily physical stock inward review.
- Mandatory inspection/defect module for every meter.
- Full GST invoice automation before party master is reliable.
- Deep BI dashboards before production, dispatch, receivables, and payroll are trusted.

## Recommended Core Loop For Pilot

### Owner flow

1. Create market run from estimator.
2. Assign looms at a broad level, but do not block later production if assignment is missing.
3. See expected godown stock from production.
4. Sell & Dispatch from stock:
   - select/create party
   - select stock/takas
   - enter rate, broker, sale date, credit days
   - enter actual dispatched meters and transport details
   - create receivable
5. Review differences only if expected and actual do not match.
6. Track money to collect and overdue parties.
7. Settle payroll from production logs.

### Supervisor flow

1. Open shift log.
2. See all active looms.
3. Copy previous setup if available.
4. Enter meters or closing counter.
5. Add service reason only for zero production.
6. Submit.

Anything missing should go to owner review, not block floor logging.

## Product Requirements Implied By This Customer

- The floor screen must work even with imperfect setup.
- The app should never ask the owner to confirm stock twice unless money or dispatch depends on it.
- Market stock must be sellable without creating fake party orders.
- Every sale must create a named receivable or the money module is not trustworthy.
- Discrepancy review must end in an operational decision, not just an alert.
- Packing/taka details should be optional and dispatch-time, not daily inward-time.
- Broker, credit days, and claim deductions are not advanced accounting. They are part of normal grey fabric trade.

## Final Assessment

If I were the target customer, I would understand the value proposition and probably try the app for market-run production, dispatch, payroll, and receivables. I would churn if:

- my supervisor cannot log production because setup is incomplete,
- I have to create fake orders to sell market stock,
- receivables show "Anonymous",
- shortages are flagged but not resolvable,
- or the app asks me to maintain data before I get money/control value from it.

The next product pass should not add more modules. It should make the existing loop more forgiving at input time and stricter only at money/payroll/dispatch finalization.
