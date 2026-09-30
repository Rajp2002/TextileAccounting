import pathlib,json
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
source=pathlib.Path('/private/tmp/weavly-review-machine-transition.mjs').read_text()
source=source.replace("const record={scenario,lang,size,steps:[],issues:[]", "const salary=name==='workers-salary'; const targetStep=salary?'wks-salary':'wkp-availability'; const record={scenario,lang,size,steps:[],issues:[]")
source=source.replace("for(const id of ['mc-purpose','mc-details']){", "await page.locator('[data-tour-step=\"wk-paytype\"][data-tour-status=\"ready\"]').waitFor();\n if(salary)await page.locator('[data-tour-control=\"path-salary\"]').click();\n for(const id of ['wk-paytype']){")
source=source.replace("'[data-tour-step=\"mc-readiness\"][data-tour-status=\"ready\"]'", "`[data-tour-step=\"${targetStep}\"][data-tour-status=\"ready\"]`")
source=source.replace("'[data-tour-step=\"mc-details\"][data-tour-status=\"ready\"]'", "'[data-tour-step=\"wk-paytype\"][data-tour-status=\"ready\"]'")
source=source.replace("[data-machines-tour-preview=\"true\"][data-state=\"open\"]", "[data-workers-tour-preview=\"true\"]")
source=source.replace("page.evaluate(()=>{", "page.evaluate(salary=>{")
source=source.replace("document.querySelector('[data-machines-tour-id=\"tour-machines-incomplete\"]')", "document.querySelector(salary?'[data-workers-tour-field=\"salary\"]':'[data-workers-tour-field=\"availability\"]')")
source=source.replace("\n  });\n  record.steps.push", "\n  },salary);\n  record.steps.push")
assert 'mc-' not in source and 'data-machines-' not in source
path=pathlib.Path('/private/tmp/weavly-review-worker-transition.mjs')
assert not path.exists()
path.write_text(source)
jobs=[]
for i,scenario in enumerate(['workers','workers-salary']):
    for lang,size in [('en','1440x900'),('gu','390x844')]:
        name=f'gt14-transition-{i}-{lang}-{size}'
        jobs.append(dict(id=name,task='GT-14',scenario=scenario,language=lang,size=size,script=str(path),args=[scenario,lang,size,str(out/'runs'/name)]))
path=out/'gt14-transition-jobs.json'; assert not path.exists()
path.write_text(json.dumps(jobs,indent=2));print(str(path))
