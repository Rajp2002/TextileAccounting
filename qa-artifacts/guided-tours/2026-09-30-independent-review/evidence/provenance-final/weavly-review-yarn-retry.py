import pathlib, json
out = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas/scratch/browser-verification')
name = 'gt09-retry-gu-390x844'
jobs = [dict(id=name, task='GT-09', scenario='yarn-stock', language='gu', size='390x844', script='/private/tmp/weavly-review-run-diagnostic.mjs', args=['yarn-stock', 'gu', '390x844', str(out/'runs'/name)])]
path = out / 'gt09-retry-jobs.json'
assert not path.exists(), 'Preserve prior retry evidence'
path.write_text(json.dumps(jobs, indent=2))
print(path)
