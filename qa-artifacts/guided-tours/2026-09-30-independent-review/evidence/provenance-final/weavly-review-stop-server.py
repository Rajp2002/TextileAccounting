import pathlib,json,subprocess,os,signal,time
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
pid=70042
wrapper=['node',str(root/'scripts/performance/isolated-command.mjs')]
info=subprocess.check_output(wrapper+['ps','-p',str(pid),'-o','pid=,command='],cwd=root,text=True).strip()
assert str(pid) in info and 'vite' in info and 'scratch/browser-verification-harness/vite.config.mjs' in info,info
os.kill(pid,signal.SIGTERM)
for _ in range(50):
    check=subprocess.run(wrapper+['ps','-p',str(pid),'-o','pid=,stat=,command='],cwd=root,text=True,capture_output=True)
    if check.returncode or not check.stdout.strip():break
    time.sleep(0.1)
else:raise AssertionError('Owned server has not stopped; no unrelated process killed')
proof=dict(pid=pid,commandBefore=info,signal='SIGTERM',stopped=True,scope='Only the Vite process started for this isolated synthetic browser review')
(out/'owned-server-stop.json').write_text(json.dumps(proof,indent=2))
report=json.loads((out/'report.json').read_text());report['ownedServer']=proof
(out/'report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(proof))
