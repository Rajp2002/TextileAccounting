import pathlib, subprocess, json, time, re, os, sys
r = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out = r / 'scratch/browser-verification'
h = r / 'scratch/browser-verification-harness'
wrapper = ['node', str(r/'scripts/performance/isolated-command.mjs')]
env = ['env','PLAYWRIGHT_ROOT=/Users/rajpatel/.npm/_npx/5e2e484947874241/node_modules/','CHROMIUM_PATH=/Users/rajpatel/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']
group = sys.argv[1]
jobs = json.loads((out/f'{group}-jobs.json').read_text())
results=[]
for i, job in enumerate(jobs):
    name = job['id']; dest=out/'runs'/name; dest.mkdir(parents=True,exist_ok=False)
    command = wrapper + env + [f'NETWORK_LOG={dest}/network.json'] + [f'{k}={v}' for k,v in job.get('env',{}).items()] + ['node','--import','/private/tmp/weavly-review-network.mjs',str(h/'run-tour.mjs'),job['scenario'],job['language'],job['size'],str(dest)]
    command = [str(r/'scratch/tour-harness/bin/timeout'),'170'] + command
    print(f"START {group} {i+1}/{len(jobs)} {name}",flush=True)
    start=time.monotonic()
    with (dest/'command.log').open('w') as log:
        p=subprocess.run(command,cwd=h,stdout=log,stderr=subprocess.STDOUT)
    records=list(dest.glob('*/record.json'))
    record=json.loads(records[0].read_text()) if records else {}
    network=json.loads((dest/'network.json').read_text()) if (dest/'network.json').exists() else []
    blocked=[e for e in network if e['type'].startswith('blocked')]
    result={**job,'command':command,'exitCode':p.returncode,'elapsedSeconds':round(time.monotonic()-start,2),'record':str(records[0]) if records else None,'steps':len(record.get('steps',[])),'error':record.get('error'),'blockedNetwork':blocked,'classification':'FAIL' if p.returncode or record.get('error') or blocked or not records else 'AUTOMATED_PASS','visualReview':'UNVERIFIED'}
    results.append(result)
    (out/f'{group}-results.json').write_text(json.dumps(results,indent=2))
    print(json.dumps({k:result[k] for k in ['id','exitCode','steps','error','classification']}),flush=True)
    report=json.loads((out/'report.json').read_text()); report['phase']=group; report['lastCompletedRun']=result; report['nextCommand']=jobs[i+1]['id'] if i+1<len(jobs) else 'inspect screenshots and per-task acceptance'; (out/'report.json').write_text(json.dumps(report,indent=2))
print('DONE '+group,flush=True)
