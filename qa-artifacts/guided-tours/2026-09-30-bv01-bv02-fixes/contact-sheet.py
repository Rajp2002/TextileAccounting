#!/usr/bin/env python3
"""Builds a labelled contact sheet from the numbered step screenshots of one run (01.png, 02.png, ...).

    python3 contact-sheet.py <run-dir> <out.png> [columns] [cell-width]

The sheet is for human inspection only; assertions are never derived from it. Uses Pillow.
"""
import glob
import os
import re
import sys

from PIL import Image, ImageDraw

run, out = sys.argv[1], sys.argv[2]
columns = int(sys.argv[3]) if len(sys.argv) > 3 else 5
cell_w = int(sys.argv[4]) if len(sys.argv) > 4 else 360

shots = sorted(f for f in glob.glob(os.path.join(run, '**', '*.png'), recursive=True) if re.fullmatch(r'\d\d(-[\w.-]+)?\.png', os.path.basename(f)))
if not shots:
    raise SystemExit(f'no step screenshots under {run}')
images = []
for path in shots:
    image = Image.open(path).convert('RGB')
    scale = cell_w / image.width
    images.append((os.path.basename(path)[:-4], image.resize((cell_w, max(1, int(image.height * scale))))))
label_h = 18
cell_h = max(i.height for _, i in images) + label_h
rows = (len(images) + columns - 1) // columns
sheet = Image.new('RGB', (columns * (cell_w + 6) + 6, rows * (cell_h + 6) + 6), (245, 245, 245))
draw = ImageDraw.Draw(sheet)
for index, (name, image) in enumerate(images):
    x, y = 6 + (index % columns) * (cell_w + 6), 6 + (index // columns) * (cell_h + 6)
    draw.text((x + 2, y + 2), name, fill=(0, 0, 0))
    sheet.paste(image, (x, y + label_h))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
sheet.save(out)
print(out, sheet.size, len(images), 'frames')
