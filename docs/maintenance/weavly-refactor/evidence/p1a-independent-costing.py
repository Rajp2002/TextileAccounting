"""Independent reference values for Package 1A costing characterization tests.

Written from the business formulas (lib/estimator.ts doc comments, E8 register)
with Python's decimal module; it never imports or executes the application.
Run: python3 docs/maintenance/weavly-refactor/evidence/p1a-independent-costing.py
"""
from decimal import Decimal as D, ROUND_HALF_UP, getcontext

getcontext().prec = 40


def r2(x):
    return D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def warp_kg(ends, denier):            # ends x denier x 100 / 9,000,000
    return D(ends) * D(denier) * 100 / D(9_000_000)


def weft_kg(ppi, width_cm, denier, length_m):   # ppi x inches x denier x length / 9,000,000
    return D(ppi) * (D(width_cm) / D("2.54")) * D(denier) * D(length_m) / D(9_000_000)


def yarn_cost_100m(kg, rate, gst, adj):          # kg x rate x (1+gst) x (1+adj)
    return D(kg) * D(rate) * (1 + D(gst) / 100) * (1 + D(adj) / 100)


def commercial(production, transport, commission_pct, margin_pct, qty):
    c, m = D(commission_pct) / 100, D(margin_pct) / 100
    price = (production + transport) / (1 - c - m)
    landed = production + transport + price * c
    break_even = (production + transport) / (1 - c)
    s, l = r2(price), r2(landed)
    out = {
        "production": r2(production), "price": s, "commission_per_m": r2(price * c),
        "landed": l, "break_even": r2(break_even), "profit_per_m": r2(s - l),
        "margin_pct": r2((r2(s - l) / s) * 100),
    }
    if qty:
        tv, tl = r2(s * qty), r2(l * qty)
        out.update(total_value=tv, total_landed=tl, expected_profit=r2(tv - tl))
    return out


# F1: one formula warp, one formula weft, every optional layer on.
warp_base = warp_kg(3444, 75)                     # 2.87
warp_adj = D(3) + D(2)                            # crimp 3 + default waste 2
weft_base = weft_kg(60, 127, 75, 100)             # 2.5 (127 cm = 50 in)
weft_adj = D(2)
warp_cost = yarn_cost_100m(warp_base, 180, 5, warp_adj) / 100
weft_cost = yarn_cost_100m(weft_base, 170, 5, weft_adj) / 100
warp_final = warp_base * (1 + warp_adj / 100)
weft_final = weft_base * (1 + weft_adj / 100)
weave = D(60) * D("0.16")
warping_sizing = warp_final * (D(12) + D(8)) / 100
winding = (warp_final + weft_final) * D(5) / 100
direct = warp_cost + weft_cost + weave + warping_sizing + winding + D("2.00") + D("1.50")
overhead = (D(150000) + D(50000)) / D(100000)
production = direct + overhead
print("F1 kg: warp_base", warp_base, "warp_final", warp_final, "weft_base", weft_base, "weft_final", weft_final)
print("F1 layers /m: warp", warp_cost, "weft", weft_cost, "weave", weave, "warping+sizing", warping_sizing, "winding", winding)
print("F1 direct", direct, "overhead", overhead, "production(raw)", production)
print("F1 rounded:", {k: str(v) for k, v in commercial(production, D("0.50"), 3, 12, 5000).items()})

# F2 (C-INV-08 legacy defaults): same as F1 but warpingMode/sizingMode missing.
# Missing warping mode + rate > 0 => outsourced (charged); missing sizing mode => in-house (not charged).
f2_ws = warp_final * D(12) / 100
f2_prod = direct - warping_sizing + f2_ws + overhead
print("F2 warping only", f2_ws, "production", r2(f2_prod))

# F3 (C-INV-09): commission/transport toggles OFF but values > 0 still apply; winding/processing/finishing OFF removed.
f3_direct = warp_cost + weft_cost + weave + warping_sizing
f3_prod = f3_direct + overhead
print("F3 production", r2(f3_prod), {k: str(v) for k, v in commercial(f3_prod, D("0.50"), 3, 12, None).items()})

# F4 (C-INV-10 characterization): override 5.00 present while mode is monthly_expenses => override wins.
print("F4 production", r2(direct + D(5)))

# Multi-row conventions (weft 75 D, 127 cm, rate 170, GST 5, no waste).
one_60 = weft_kg(60, 127, 75, 100)
two_60 = 2 * weft_kg(60, 127, 75, 50)
two_30 = 2 * weft_kg(30, 127, 75, 50)
mixed_formula = weft_kg(60, 127, 75, 50)          # formula row shares the run with a manual row
print("WEFT kg: one row 60 PPI", one_60, "| two rows 60 PPI", two_60, "| two rows 30 PPI", two_30, "| formula row beside manual 1.0 kg", mixed_formula, "total", mixed_formula + 1)
print("WEAVE /m at 0.16: one row 60", D(60) * D("0.16"), "| two rows 60", D(120) * D("0.16"), "| two rows 30", D(60) * D("0.16"))
print("WARP kg: one row 3444 ends", warp_kg(3444, 75), "| two rows 1722 ends", 2 * warp_kg(1722, 75))

# Ne conversion (denier = 5315 / Ne): 40 Ne warp, 2000 ends.
den = D(5315) / D(40)
print("Ne40 denier", den, "warp kg 2000 ends", warp_kg(2000, den))

# Half-up at the presentation boundary (values chosen where binary floats round down).
for v in ("1.005", "2.675", "10.125", "0.285"):
    print("half-up", v, "->", r2(D(v)))

# F5 invalid commercial: commission 40 + margin 60 >= 100 => invalid, price 0.
# (F5 values) break-even ignores margin: (production + transport) / (1 - commission).
print("F5 break-even", r2((production + D("0.50")) / (1 - D(40) / 100)))
# Explicit row waste 0 vs default 10 on the F1 weft (no crimp): 2.5 vs 2.5 x 1.10.
print("waste explicit-0 final kg", weft_base, "| default-10 final kg", weft_base * D("1.10"))
