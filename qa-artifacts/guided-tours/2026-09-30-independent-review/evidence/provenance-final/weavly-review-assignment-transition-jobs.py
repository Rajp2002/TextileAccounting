import pathlib,json
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
source=pathlib.Path('/private/tmp/weavly-review-machine-transition.mjs').read_text()
source=source.replace("['mc-purpose','mc-details']", "['ma-purpose','ma-shift','ma-job','ma-assign','ma-choose']")
source=source.replace('mc-readiness','ma-linked').replace('mc-details','ma-choose')
source=source.replace('[data-machines-tour-preview="true"][data-state="open"]','[data-configuration-picker-preview="true"]')
source=source.replace('[data-machines-tour-id="tour-machines-incomplete"]','[data-configuration-tour="saved-preview"]')
source=source.replace('readiness','linked')
source=source.replace('return{step:panel?', 'const offscreen=b=>!b||b.x<0||b.y<0||b.x+b.w>innerWidth||b.y+b.h>innerHeight; return{panelOffscreen:offscreen(p),highlightOffscreen:offscreen(h),step:panel?')
source=source.replace("final.overlapArea)record.issues", "final.overlapArea||final.panelOffscreen||final.highlightOffscreen)record.issues")
assert 'mc-' not in source and 'data-machines-' not in source
path=pathlib.Path('/private/tmp/weavly-review-assignment-transition.mjs')
assert not path.exists()
path.write_text(source)
jobs=[]
for lang,size in [('en','1440x900'),('en','1024x768'),('gu','390x844')]:
    scenario='assignments?populated=1'
    name=f'gt15-transition-{lang}-{size}'
    jobs.append(dict(id=name,task='GT-15',scenario=scenario,language=lang,size=size,script=str(path),args=[scenario,lang,size,str(out/'runs'/name)]))
path=out/'gt15-transition-jobs.json'; assert not path.exists()
path.write_text(json.dumps(jobs,indent=2));print(str(path))
