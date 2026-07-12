# Estimator Calculation Specification

The server is authoritative. Client previews and persisted snapshots must reconcile to the same validated inputs and deterministic rounding.

- Beam cloth metres: `tape metres / (1 + crimp percent / 100)`. Example: `1000 / 1.05 = 952.38095m`.
- Loom output: convert picks per inch through 39.3701 inches per metre, multiply RPM by minutes, efficiency, hours, and loom count. The reference case 700 RPM, 60 PPI, 12 hours, 85% yields about 181.356m per loom/day.
- English cotton count: `denier = 5315 / Ne`; 40 Ne is 132.875 denier.
- Each warp and weft row contributes once. Formula and manual modes remain distinct and snapshots preserve the selected mode and recipe.
- Disabled optional cost sections contribute zero. Commission and transport are included only when their section is enabled.
- Quote totals preserve yarn, weave, pre-weaving, optional processing, overhead, commission, transport, margin, landed cost, and quoted price inputs/results.
- Empty recipes, non-finite values, negative required quantities, impossible rates, and invalid commission-plus-margin boundaries are rejected before persistence.
- Currency-facing snapshots use deterministic normalization; historical quotes are restored from their snapshots rather than current factory defaults.
