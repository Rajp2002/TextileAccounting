# Textile domain primer for Weavly

**Audience:** engineer with no textile-manufacturing background

**Focus:** grey-fabric weaving and the costing concepts represented in the Base Plan

## 1. The factory in one sentence

A weaving unit buys yarn, prepares the lengthwise yarn on beams, inserts crosswise yarn on looms, produces fabric by the metre, and sells or dispatches that fabric. Its commercial question is not only “what will one metre sell for?” but “what did one metre really cost after yarn, loom work, labour/processes, factory expenses, selling commission, transport, and margin?”

Weavly Base digitizes the costing desk and now adds a deliberately small owner-only Production Core: a costing-linked job, metre entry, and simple piece-rate settlement. Full Suite extends the same quality/costing records into formal production, stock, dispatch, commercial collection, and controlled worker settlement.

## 2. Physical production flow

```text
Yarn purchase
    │
    ▼
Warp preparation ──► beam / sized beam
    │
    ▼
Loom setup: warp on loom + weft supply + reed/density settings
    │
    ▼
Weaving: pick after pick, shift after shift
    │
    ▼
Grey fabric inspection / roll or package formation
    │
    ├─ customer/order production
    └─ market production → godown stock → sale → dispatch
```

### What each stage means

- **Yarn purchase:** yarn is bought by weight, usually priced in ₹/kg. Different yarns can have different linear densities, GST rates, and suppliers.
- **Warping:** individual lengthwise yarns are arranged into a sheet and wound onto a beam. The number of lengthwise threads is the **ends** count.
- **Sizing:** a protective coating/starch/finish can be applied to warp yarn so it survives loom abrasion. A factory may size in-house or pay an outside unit.
- **Weaving:** the loom raises selected warp threads and inserts weft. Each insertion is a **pick**. Fabric density is commonly expressed in PPI.
- **Grey fabric:** unfinished woven fabric, before optional dyeing, printing, heat-setting, calendering, or other finishing.
- **Godown:** the factory’s storage area. Full Suite uses the term for physical/expected stock; Base does not create stock.

## 3. What a “quality” is

In factory language, a **quality** is a fabric construction/specification, not a quality score. It describes the recipe that should produce a repeatable fabric:

- warp yarn type/count and number of ends;
- weft yarn type/count and picks per inch;
- finished output width;
- loom type and operating assumptions;
- expected waste/crimp;
- weaving/preparation/process rates;
- optional commercial assumptions.

Examples of quality labels might be a buyer’s familiar name, an internal construction code, or a product name. In Weavly, a saved quality is the reusable recipe in `estimator_templates`. A saved costing is a dated financial snapshot made from that recipe and the assumptions active at that time.

## 4. Vocabulary

### Yarn and construction

| Term | Meaning | Why it matters in Weavly |
|---|---|---|
| Yarn | Continuous textile strand used to make fabric. | Main raw-material cost. |
| Warp | Lengthwise yarns running along the fabric. | Cost depends on effective denier and beam ends; warp crimp applies here. |
| Weft | Crosswise yarn inserted across the warp. | Cost depends on denier, picks per inch, and effective cloth width. |
| Denier / D | Grams per 9,000 metres of yarn. Higher denier means a heavier/coarser linear yarn. | Used directly in yarn-weight formulas. |
| Cotton count / Ne | Indirect count system for cotton-style yarns. Higher Ne means finer yarn. | Converted in code with `denier = 5315 / Ne`. |
| Ply | Number of yarn strands combined in one yarn. | Effective denier must reflect all plies. |
| Beam | Large package carrying the prepared warp sheet. | Beam ends and tape length are used for capacity/preparation calculations. |
| Ends | Individual warp threads on the beam. | More ends generally means more warp yarn consumption. |
| Selvedge | Finished edge of the fabric. | Often represented as an additional warp layer/row. |
| Blend / layer | One component in a mixed warp or weft recipe. | `warp_rows` and `weft_rows` support multiple components. |

### Weaving and machine terms

| Term | Meaning | Why it matters |
|---|---|---|
| Pick | One weft insertion across the fabric. | The estimator uses picks per inch to calculate weft consumption and weave charge. |
| PPI | Picks per inch; weft density. | A core input. More PPI usually means more weft yarn and more pick-based loom cost per metre. |
| Reed | The comb-like loom part that spaces warp ends. | “Reed space” is an older input name; Base costing should use effective finished output width. |
| Effective costing width | Finished cloth width used for the weft formula. | Distinct from the physical reed/loom width. |
| RPM | Loom revolutions per minute. | Used in output-capacity previews, not as a direct yarn formula input. |
| Efficiency | Percentage of theoretical loom time that becomes useful output. | Reduces capacity/output preview. |
| Loom type | Machine class such as Water Jet, Rapier, Air Jet, Jacquard, Projectile, or Dobby. | Supplies starting RPM, kW, and efficiency defaults; owner can customize them. |
| kW | Electrical power rating/assumption. | Used in capacity/overhead scenarios and electricity assumptions. |
| Per-pick rate | Internal loom/weaving charge assigned to each pick. | Weave cost is total PPI × per-pick value. |

### Cost and commercial terms

| Term | Meaning | Weavly meaning |
|---|---|---|
| Costing / Cost Estimate | Internal calculation of what fabric costs to make. | Base’s primary record. It is not automatically a customer document. |
| Production cost | Cost of making one metre before selling commission and transport. | Direct costs plus selected overhead per metre. |
| Overhead | Factory costs not directly attributable to one metre of yarn/loom work. | Rent, electricity, repairs, oil, depreciation, security, admin, and similar monthly items. |
| Landed cost | Production cost plus transport and selling commission at the selected price. | The cost basis used to calculate expected profit. |
| Break-even price | Minimum selling price that leaves zero profit after transport and commission. | Separate from landed cost because commission depends on selling price. |
| Margin | Desired or actual profit as a percentage of selling price. | The target margin is an input; actual margin is derived from the final price/cost. |
| Commission | Broker/agent/selling percentage. | Percentage of selling price, not a flat percentage of production cost. |
| Transport | Delivery cost per metre when the factory bears delivery. | Optional ₹/m commercial input. |
| GST | Goods and Services Tax. | Applied per yarn row in the estimator; customer PDF can show a GST note but is explicitly not a tax invoice. |
| Quotation | Customer-facing price proposal. | Full Suite has a durable quotation lifecycle; Base creates a customer-safe PDF artifact from a standalone costing. |
| Party | Buyer/customer account. | A Full Suite term. Base can accept a customer name in export context but does not create the party lifecycle. |

### Factory operations and money terms used elsewhere in the product

| Term | Meaning |
|---|---|
| Market Run | Make-to-stock production without a committed buyer; output is intended for godown stock. |
| Party Order | Buyer-backed production commitment. |
| Stock lot | Traceable group of saleable fabric metres in godown. |
| Sale | Commercial decision that a quantity is sold to a party. |
| Dispatch | Physical handoff of sold fabric from factory to party/transport. |
| Challan | Delivery document/reference accompanying a dispatch; not an invoice or receipt. |
| Metres sent / received | Separate dispatch quantities; a receipt variance can become a shortage/excess discrepancy. |
| Receivable | Amount the party owes after a sale on credit. |
| Worker Hisaab | Payroll close/worker settlement. |
| Upaad / advance | Money given to a worker before final settlement. |
| Inam | Incentive/bonus addition in a settlement. |
| Kapaat | Deduction/adjustment in a settlement. |
| Hajiri | Attendance record used for attendance-based pay. |

## 5. Units and conventions

| Unit | Meaning | Common mistake |
|---|---|---|
| `m` / metre | Finished fabric length. | Confusing a length metre with kg yield. |
| `kg/100m` | Yarn weight consumed per 100 metres of fabric. | Reading it as metres per kg. |
| `m/kg` | Inverse yarn yield. | Treating it as the estimator’s primary stored weight unit. |
| `₹/kg` | Yarn or preparation rate per kilogram. | Applying a per-kg rate to a per-metre value without converting. |
| `₹/m` | Cost, transport, or price per finished metre. | Mixing internal cost with customer price. |
| `₹/pick` | Internal weaving charge per pick; the UI may show paise. | The legacy state field is named `perPickCostPaisa`, but `0.16` represents ₹0.16 = 16 paise per pick. |
| `PPI` | Picks per inch. | Entering picks per centimetre or a machine counter reading. |
| `cm` / `inch` | Width units. | Entering an inch-like value as centimetres. |
| `RPM` | Loom revolutions per minute. | Assuming RPM alone equals output; PPI, hours, and efficiency also matter. |
| `kW` | Power assumption. | Treating nameplate power as actual monthly electricity consumption without an operating assumption. |
| `%` | Waste, crimp, GST, commission, efficiency, or margin depending on the field. | Applying a percentage to the wrong base. |

The active product uses **metres** for fabric quantities. “Taka” may be familiar in the industry but is not the active Base calculation/storage unit; do not introduce a taka conversion without a product decision.

## 6. Costing formulas used by the app

The implementation lives in `lib/estimator.ts`. The formulas below use the same units and terminology as the code.

### 6.1 Linear-density conversion

For English cotton count:

```text
effective denier = 5315 ÷ Ne
```

For a plied yarn, `calcDenier` should represent the effective total denier after accounting for the plies. Legacy rows default to denier unless their unit explicitly says `cotton_count_ne`.

### 6.2 Warp yarn weight

For one warp component:

```text
base warp kg/100m = effective denier × beam ends ÷ 90,000
```

The code expresses the same calculation as `(beamEnds × denier × 100) / 9,000,000`.

Warp adjustments are:

```text
warp total adjustment % = warp crimp % + effective waste/shortage %
final warp kg/100m = base warp kg/100m × (1 + total adjustment % ÷ 100)
```

Warp crimp is **warp-only**. It represents extra warp length consumed because yarn takes up/undulates while becoming fabric length.

### 6.3 Weft yarn weight

For one weft component:

```text
effective width inches = effective costing width cm ÷ 2.54
base weft kg/100m = effective denier × PPI × effective width inches ÷ 90,000
final weft kg/100m = base weft kg/100m × (1 + effective waste/shortage % ÷ 100)
```

The width must be the **finished output width used for costing**, not an oversized loom/reed width. Using the wrong width can materially overstate weft consumption.

The estimator supports multiple warp and weft rows. It calculates each row independently and sums the rows.

### 6.4 Yarn cost

For one yarn row, expressed per 100 metres:

```text
yarn cost/100m
  = base kg/100m
  × yarn rate ₹/kg
  × (1 + GST% ÷ 100)
  × (1 + adjustment% ÷ 100)
```

The final per-metre yarn cost is the row’s cost per 100m divided by 100. GST is applied per row because different material rows may have different tax assumptions.

The UI/audit model separates:

- raw yarn cost before waste/crimp;
- adjustment cost created by waste/crimp;
- total yarn cost.

### 6.5 Weaving cost

```text
weave cost ₹/m = total picks per inch × internal ₹/pick value
```

Example:

```text
68 PPI × ₹0.16/pick = ₹10.88/m
```

The code field is historically called `perPickCostPaisa`; internally the calculation uses a rupee value such as `0.16`. The name is a compatibility detail, not a second unit conversion.

### 6.6 Warping and sizing

```text
warping + sizing ₹/m
  = total warp kg/100m
  × (warping rate ₹/kg + effective sizing rate ₹/kg)
  ÷ 100
```

When `sizingMode = 'in_house'`, the variable sizing rate is zero because the factory treats the sizing expense as part of its own overhead model. When `sizingMode = 'outsourced'`, the configured sizing rate is included.

### 6.7 Optional conversion stages

```text
winding ₹/m    = total warp+weft kg/100m × winding rate ₹/kg ÷ 100
processing ₹/m = configured flat processing rate when enabled
finishing ₹/m  = configured flat finishing rate when enabled
```

Winding is used when yarn arrives in a form that needs rewinding, such as hanks to cones. Processing can represent dyeing/printing. Finishing can represent calendering, heat-setting, or similar post-weaving work.

### 6.8 Direct production cost and overhead

```text
direct cost/m
  = warp yarn
  + weft yarn
  + weaving
  + warping/sizing
  + winding
  + processing
  + finishing

production cost/m = direct cost/m + overhead/m
```

The current overhead model has two explicit methods:

```text
Direct method:
  overhead/m = owner-entered direct ₹/m rate

Monthly-expenses method:
  overhead/m = sum of resolved monthly overhead items ÷ monthly output metres
```

Overhead items can include rent, electricity, repairs/spares, oil/lubricants, drawing/denting, bank interest, depreciation, water, security, admin, and custom items. Locked electricity/depreciation items can be resolved from loom count and metadata before the monthly sum is divided by output.

The same state can preview rated capacity and idle-capacity cost:

```text
rated monthly capacity
  = loom count × average output per loom/day × working days

capacity utilisation %
  = monthly output ÷ rated capacity × 100
```

These are decision-support calculations. Base Production Core may create a separate lightweight job and owner metre entry from a saved costing, but it does not create Full Suite production logs, stock, or order records.

### 6.9 Price, landed cost, break-even, and profit

Commission and target margin are percentages of the **selling price**. Let:

- `P` = production cost per metre;
- `T` = transport per metre;
- `C` = commission percentage as a decimal;
- `M` = target margin percentage as a decimal.

Suggested selling price:

```text
quote price/m = (P + T) ÷ (1 - C - M)
```

The boundary is invalid when `C + M >= 1` (100%).

Commission and landed cost:

```text
commission/m = quote price/m × C
landed cost/m = P + T + commission/m
```

Break-even is intentionally separate:

```text
break-even price/m = (P + T) ÷ (1 - C)
```

Expected profit:

```text
profit/m = quote price/m - landed cost/m
expected total profit = profit/m × quantity metres
```

When Base has no quantity, the per-metre figures remain meaningful but total expected profit is unavailable rather than shown as a false zero.

## 7. Illustrative calculation

This is an explanatory example, not a factory recommendation.

Assume:

- one warp row: 3,800 ends, 75D yarn, 5% warp crimp, 2% waste, ₹120/kg, 5% GST;
- one weft row: 60 PPI, 62cm effective width, 75D yarn, 2% waste, ₹110/kg, 5% GST;
- per-pick value: ₹0.16;
- outsourced sizing, warping ₹2/kg, sizing ₹1.50/kg;
- monthly expenses: ₹620,000 and output 70,000m;
- transport ₹0.50/m, commission 2%, target margin 10%.

Warp:

```text
base = 75 × 3,800 ÷ 90,000 = 3.1667 kg/100m
final = 3.1667 × (1 + (5 + 2)/100) = 3.3883 kg/100m
```

Weft:

```text
width = 62 ÷ 2.54 = 24.409 inches
base = 75 × 60 × 24.409 ÷ 90,000 = 1.2205 kg/100m
final = 1.2205 × 1.02 = 1.2449 kg/100m
```

The app then prices each row with its own yarn rate/GST, adds `60 × ₹0.16 = ₹9.60/m` for weaving, adds warping/sizing, and adds monthly overhead of:

```text
₹620,000 ÷ 70,000m = ₹8.857/m
```

Finally it solves for the selling price using commission and margin. The important engineering point is the dependency graph: changing the weft rate changes weft yarn cost, production cost, break-even, suggested price, and expected profit, while the saved old snapshot stays unchanged.

## 8. How factory records map to Weavly objects

| Physical/paper practice | Weavly object |
|---|---|
| Calculator or Excel costing sheet | Live `EstimateState` and `calcFullTotals` |
| Reusable quality notebook page | `estimator_templates` / Saved Fabric Quality |
| Dated old costing sheet | `estimator_quotes` with `record_kind = 'costing'` |
| Rate diary | `cost_rate_book` + append-only `cost_rate_history` |
| “Why did this price change?” comparison | Persisted costing snapshot comparison |
| Internal cost sheet | Internal export mode |
| Customer price paper/WhatsApp attachment | Customer quotation PDF export mode |
| Factory monthly expense list | `factory_cost_profile.overhead_items` |
| Lost half-filled calculator | Browser autosave draft |
| File cabinet/archive | `is_archived` flags plus restore, not destructive deletion |

## 9. Base-specific mental model

The cleanest explanation to a new engineer is:

```text
Rate Book = “What do inputs cost now?”
Factory Defaults = “What does this factory usually assume?”
Saved Quality = “What construction are we making?”
Saved Costing = “What did this construction cost under this period’s assumptions?”
Version = “Another immutable answer for the same quality.”
Comparison = “Explain the delta between two answers.”
Customer PDF = “Share price without sharing internal economics.”
```

The words are deliberately separate. A quality is not a costing; a costing is not a quotation; a quotation is not an invoice; a sale is not a dispatch; a dispatch is not a receipt.

## 10. Domain pitfalls to watch for

1. **Reed width vs finished width:** the weft formula uses effective finished costing width. Treating a 110cm loom/reed value as a 62-inch/62cm finished width can badly distort yarn consumption.
2. **PPI unit:** PPI is picks per inch, not picks per centimetre and not a cumulative counter reading.
3. **Warp crimp scope:** crimp applies to warp in the current engine. It is not added to weft.
4. **Waste semantics:** `null` means use the default; explicit `0` means intentional zero waste. A row override wins over the global default.
5. **Sizing mode:** in-house sizing is not the same as outsourced sizing. The current engine treats in-house sizing as zero variable sizing rate.
6. **Percent bases:** commission and target margin are percentages of selling price; GST is applied to the yarn row; overhead is divided by monthly output.
7. **Paise naming:** `perPickCostPaisa = 0.16` is an internal ₹0.16/pick value. Do not multiply by 100 again.
8. **Costing vs quotation:** Base can create a customer-safe PDF, but the standalone row does not have Full Suite quotation status transitions.
9. **Meter semantics:** Base and active stock/dispatch flows use metres; do not mix a future taka display into calculations without a product decision.
10. **Historical truth:** never rebuild an old costing from today’s Rate Book. Read its persisted snapshot.

## 11. Regional/context terms

The product is designed around Indian weaving-factory language and supports English, Hindi, and Gujarati UI surfaces. Some operational terms are intentionally retained because users recognize them:

- **maal:** goods/fabric stock;
- **paisa:** money/profit/collections;
- **godown:** storage area;
- **karigar:** worker/artisan;
- **hisaab:** settlement/accounting of a person or cycle;
- **upaad:** advance taken by a worker;
- **hajiri:** attendance;
- **challan:** delivery document/reference.

The UI should pair specialized terms with plain explanations on first use. A software engineer should treat terminology as part of the domain contract: changing “Cost Estimate” to “Quotation” or “Metres Received” to “Delivered” changes the user’s interpretation of the underlying event.
