# Base Plan costing oracle

Run: `BASEPILOT-20260824-0300-LNNP`  
Target: `https://textile-accounting.vercel.app`  
Currency: INR; quantities in finished metres.

## Canonical inputs

- Quality: `BASEPILOT-20260824-0300-LNNP-QA-60G`
- Warp: 50D, 5,200 ends, 5% crimp, blank row waste (10% default), ₹350/kg
- Weft: 68 PPI, 112 cm finished width, 50D, blank row waste (10% default), ₹350/kg
- Weave: ₹8/m
- Warping: ₹12/kg; sizing in-house
- Direct overhead: ₹5.75/m
- Target margin: 12%; commission 2%; transport ₹1.50/m; quantity 1,000 m

The UI's configured adjustment convention is additive: warp formula adjustment is 5% + 10% = 15%; weft default waste is 10%.

## Independent expected result

| Layer | Expected |
| --- | ---: |
| Warp consumption | 3.322222 kg/100m |
| Weft consumption | 1.832371 kg/100m |
| Warp layer | ₹11.63/m |
| Weft layer | ₹6.41/m |
| Weaving | ₹8.00/m |
| Warping | ₹0.40/m |
| Direct overhead | ₹5.75/m |
| Production cost | ₹32.19/m |
| Break-even | ₹34.37/m |
| Landed cost | ₹34.47/m |
| Suggested price | ₹39.17/m |
| Actual margin | 12.0% |
| Expected profit | ₹4,700 on 1,000 m |

The UI matched every value and the persisted v1 row matched the same scalars. The formal comparison tolerances used were: yarn ±0.001 kg/100m; cost layers ±₹0.05/m; production, landed, and quote ±₹0.10/m; percentages ±0.10 percentage points; persisted scalar fields ±₹0.01; totals max ₹1 or the per-metre tolerance multiplied by quantity.

## Immutable version checks

| Version | Change | Production | Break-even | Landed | Quote | Margin (DB) | Profit | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| v1 | Canonical inputs; Weft ₹350; output 54,000 | ₹32.19 | ₹34.37 | ₹34.47 | ₹39.17 | 12.00% | ₹4,700 | Pass |
| v2 | Weft current rate ₹350→₹360 | ₹32.37 | ₹34.56 | ₹34.66 | ₹39.38 | 11.99% | ₹4,720 | Pass; v1 unchanged |
| v3 | Monthly output 54,000→60,000; overhead ₹10.33/m | ₹36.95 | ₹39.24 | ₹39.35 | ₹44.71 | 11.99% | ₹5,360 | Pass; v1/v2 unchanged |

The UI rounds the v2/v3 margin to 12.0%; the stored 11.99% is within the stated percentage tolerance and is explained by the price-based commission/rounding calculation. The v3 card and internal preview show the saved ₹36.95/m and ₹44.71/m values.

## Boundary evidence

- Blank warp waste displayed “Default 10.0% → applied 10.0%”; explicit `0` displayed “Override 0.0%” and reduced warp consumption/cost as expected.
- 112 cm converted to 44.09 inches and back to 112 cm.
- Formula/manual warp and weft modes matched when manual values were entered on the documented pre-adjustment basis.
- In-house sizing was ₹0.40/m; outsourced changed only the sizing layer to ₹0.45/m.
- Negative denier returned a clear >0 validation; 999,999,999 denier returned supported-range validation and no non-finite totals.
- Margin 100% was blocked with “Commission and profit margin together must be less than 100%.”

## Gate note

This is an independent arithmetic oracle prepared for this run, not a factory-owner-signed truth sheet. The formal release gate should still freeze and approve the business truth sheet before five external customers receive access.
