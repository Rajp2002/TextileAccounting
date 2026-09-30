import pathlib,json,sys,math
from PIL import Image,ImageDraw
r=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas/scratch/browser-verification')
group=sys.argv[1]
results=json.loads((r/f'{group}-results.json').read_text())
dest=r/'contacts';dest.mkdir(exist_ok=True)
manifest=[]
for result in results:
    if not result.get('record'):continue
    recordpath=pathlib.Path(result['record']);record=json.loads(recordpath.read_text())
    if (record.get('lang'),record.get('size')) not in [('en','1440x900'),('gu','390x844')]:continue
    steps=record.get('steps',[])
    for start in range(0,len(steps),3):
        entries=steps[start:start+3]
        phone=record['size']=='390x844'
        rowh=880 if phone else 590
        sheet=Image.new('RGB',(1020,rowh*len(entries)), '#eee')
        draw=ImageDraw.Draw(sheet)
        for offset,step in enumerate(entries):
            # Actual captured screenshot plus a full-resolution panel crop.
            image=Image.open(recordpath.parent/f'{start+offset+1:02d}.png').convert('RGB')
            small=image.copy();small.thumbnail((620,rowh-35))
            top=offset*rowh
            sheet.paste(small,(0,top+30))
            p=step.get('panel')
            if p:
                crop=image.crop((max(0,p['x']-4),max(0,p['y']-4),min(image.width,p['x']+p['w']+4),min(image.height,p['y']+p['h']+4)))
                crop.thumbnail((392,rowh-35));sheet.paste(crop,(628,top+30))
            draw.text((8,top+6),f"{result['id']} / {start+offset+1:02d} / {step.get('step')} / {step.get('status')}",fill='#111')
        path=dest/f"{result['id']}-{start+1:02d}-{start+len(entries):02d}.png"
        sheet.save(path)
        manifest.append({'run':result['id'],'steps':[s.get('step') for s in entries],'path':str(path)})
(r/f'{group}-contact-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'group':group,'sheets':len(manifest),'manifest':str(r/f'{group}-contact-manifest.json')}))
