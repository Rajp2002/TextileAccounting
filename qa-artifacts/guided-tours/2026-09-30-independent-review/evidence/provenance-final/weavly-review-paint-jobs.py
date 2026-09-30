import pathlib,json,sys
out = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas/scratch/browser-verification')
group = sys.argv[1]
jobs=[]
for index,scenario in enumerate(sys.argv[2:]):
    name=f'{group}-paint-{index}-en-1440x900'
    jobs.append(dict(id=name,task='GT-'+group[2:],scenario=scenario,language='en',size='1440x900',script='/private/tmp/weavly-review-run-paint.mjs',args=[scenario,'en','1440x900',str(out/'runs'/name)]))
path=out/f'{group}-paint-jobs.json'
assert not path.exists(), 'Preserve prior paint evidence'
path.write_text(json.dumps(jobs,indent=2))
print(path)
