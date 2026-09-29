import pathlib, subprocess, json, time, re
r = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out = r / 'scratch/browser-verification'
wrapper = ['node', 'scripts/performance/isolated-command.mjs']
tests = subprocess.check_output(wrapper + ['rg', '--files', '__tests__'], cwd=r, text=True).splitlines()
subset = sorted(f for f in tests if re.search(r'Tutorial|-tour|Tour[A-Z]|TourInvitation|guided-tour|data-[a-z-]*tour', (r/f).read_text()))
commands = [('types', ['node','node_modules/typescript/bin/tsc','--noEmit','--incremental','false']), ('lint',['npm','run','lint']), ('vitest-full',['node','node_modules/vitest/vitest.mjs','run','--maxWorkers=1']), ('vitest-tour',['node','node_modules/vitest/vitest.mjs','run','--maxWorkers=1'] + subset)]
results = []
for name, command in commands:
    start = time.monotonic()
    print('START ' + name, flush=True)
    with (out/'commands'/f'{name}.log').open('w') as log:
        child = subprocess.run(wrapper + command, cwd=r, stdout=log, stderr=subprocess.STDOUT)
    result = {'name':name, 'command':wrapper+command, 'exitCode':child.returncode, 'elapsedSeconds':round(time.monotonic()-start,2), 'log':str(out/'commands'/f'{name}.log')}
    results.append(result)
    (out/'commands/results.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(result), flush=True)
print('DONE', flush=True)
