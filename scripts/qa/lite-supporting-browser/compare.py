"""Compare immutable same-fixture before/after; report dimensions and exact pixel deltas."""
import json
from pathlib import Path
from PIL import Image,ImageChops
root=Path('output/playwright/lite-mobile-supporting')
for family in ['supporting','entry']:
 before=root/('before' if family=='supporting' else 'entry-before')
 after=root/('after' if family=='supporting' else 'entry-after')
 results=[]
 for source in sorted(before.glob('*.png')):
  target=after/source.name
  if not target.exists():continue
  a,b=Image.open(source).convert('RGB'),Image.open(target).convert('RGB')
  diff=None if a.size!=b.size else ImageChops.difference(a,b)
  results.append({'file':source.name,'beforeSize':a.size,'afterSize':b.size,'changedPixels':None if diff is None else sum(1 for pixel in diff.getdata() if pixel!=(0,0,0)),'diffBounds':None if diff is None else diff.getbbox(),'channelMaxDelta':None if diff is None else [v[1] for v in diff.getextrema()]})
 (root/f'{family}-comparison.json').write_text(json.dumps(results,indent=2))
 print(family,[(r['file'],r['changedPixels']) for r in results if r['file'].endswith('1440.png') or 'base-' in r['file'] or 'free-account' in r['file']])
