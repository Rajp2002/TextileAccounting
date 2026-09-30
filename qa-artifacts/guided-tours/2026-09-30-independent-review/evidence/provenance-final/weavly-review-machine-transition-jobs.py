import pathlib,json
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
rows=[]
for i,(scenario,lang,size) in enumerate([('machines','en','1440x900'),('machines?populated=1','gu','390x844')]):
    name=f'gt13-transition-{i}-{lang}-{size}'
    rows.append(dict(id=name,task='GT-13',scenario=scenario,language=lang,size=size,script='/private/tmp/weavly-review-machine-transition.mjs',args=[scenario,lang,size,str(out/'runs'/name)]))
path=out/'gt13-transition-jobs.json'
assert not path.exists()
path.write_text(json.dumps(rows,indent=2))
print(str(path))
