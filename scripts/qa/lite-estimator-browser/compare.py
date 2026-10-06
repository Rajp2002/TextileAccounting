"""Compare fixture screenshots; synthetic browser evidence, never device QA."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

root = Path("output/playwright/lite-mobile-redesign/estimator")
before, after, target = root / "before", root / "after", root / "comparison"
target.mkdir(parents=True, exist_ok=True)
controls = [f"{tier}-estimator-{width}x{height}-synthetic.png"
            for tier in ("base", "free")
            for width, height in ((320, 568), (390, 844), (430, 932), (1440, 900))]
controls.append("lite-estimator-1440x900-synthetic.png")
results = []
for name in controls:
    initial, final = Image.open(before / name).convert("RGB"), Image.open(after / name).convert("RGB")
    if initial.size != final.size:
        raise ValueError(f"Screenshot dimensions changed: {name}")
    diff = ImageChops.difference(initial, final)
    changed = sum(1 for pixel in diff.getdata() if pixel != (0, 0, 0))
    results.append({"image": name, "changedPixels": changed, "totalPixels": initial.width * initial.height})
(target / "regression-pixels.json").write_text(json.dumps({
    "evidenceType": "Matching synthetic Chromium screenshots; captured initial states only.",
    "comparisons": results,
}, indent=2) + "\n")

mobile_sizes = ((320, 568), (390, 844), (430, 932))
content_height = 60 + max(round(height * 185 / width) for width, height in mobile_sizes)
canvas = Image.new("RGB", (1180, content_height), "#eeece6")
draw = ImageDraw.Draw(canvas)
for index, (width, height) in enumerate(mobile_sizes):
    left = index * 394
    draw.text((left + 10, 10), f"Lite {width} CSS pixels", fill="#14203a")
    for column, (label, directory) in enumerate((("Before", before), ("After", after))):
        image = Image.open(directory / f"lite-estimator-{width}x{height}-synthetic.png").convert("RGB")
        image.thumbnail((185, 980))
        x = left + 5 + column * 194
        draw.text((x, 30), label, fill="#14203a")
        canvas.paste(image, (x, 50))
canvas.save(target / "lite-mobile-before-after.png")
print(json.dumps({"comparisons": len(results), "changedPixels": sum(item["changedPixels"] for item in results)}))
