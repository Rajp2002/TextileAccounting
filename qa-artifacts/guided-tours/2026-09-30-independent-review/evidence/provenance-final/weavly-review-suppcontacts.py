import pathlib,sys,json,math
from PIL import Image,ImageDraw
r=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
h=r/'scratch/browser-verification-harness';o=r/'scratch/browser-verification/contacts'
manifest=[]
for group in sys.argv[1:]:
 files=sorted((h/group).rglob('*.png'))
 for start in range(0,len(files),8):
  entries=files[start:start+8];canvas=Image.new('RGB',(1240,480*math.ceil(len(entries)/2)),'#eee');draw=ImageDraw.Draw(canvas)
  for i,p in enumerate(entries):
   im=Image.open(p).convert('RGB');im.thumbnail((610,445));x=(i%2)*620;y=(i//2)*480
   draw.text((x+5,y+5),p.name,fill='#111');canvas.paste(im,(x,y+30))
  dest=o/f'{group}-supp-{start//8+1}.png';canvas.save(dest);manifest.append({'path':str(dest),'source':[str(p) for p in entries]})
(o/'supplemental-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps([x['path'] for x in manifest]))
