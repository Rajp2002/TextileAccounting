import pathlib,json
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
rows=json.loads((out/'gt15-results.json').read_text())
jobs=json.loads((out/'gt15-jobs.json').read_text())
failed=[r for r in rows if not r['record']]
assert len(failed)==2 and all('net::ERR_CONNECTION_REFUSED' in (out/'runs'/r['id']/'command.log').read_text() for r in failed)
retry=[]
for row in failed:
    job=next(j for j in jobs if j['id']==row['id']).copy()
    job['originalRun']=job['id'];job['id']=job['id'].replace('gt15-','gt15-retry-',1)
    retry.append(job)
path=out/'gt15-retry-jobs.json';assert not path.exists()
path.write_text(json.dumps(retry,indent=2))
incident=dict(originalServerPid=48739,originalServerSessionId=91675,originalServerExitCode=1,criticalServerLog='[48739] Mark-Compact near 4199 MB; FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory',affectedOriginalRuns=[r['id'] for r in failed],classification='Fixture infrastructure failure before any tour step; original results retained',restart=dict(identicalConfig=True,identicalPort=5199,newSessionId=12188),runner='Unchanged tracked run-tour.mjs; no assertion, timeout, fixture or source changes',auxiliaryObservation='A sandboxed ps inventory command failed EPERM; no process data was emitted. Scoped listener discovery used for ownership proof.')
(out/'gt15-fixture-oom.json').write_text(json.dumps(incident,indent=2))
report=json.loads((out/'report.json').read_text());report['fixtureIncident']='gt15-fixture-oom.json'
report['serverHistory']=[dict(**report['server'],terminated='Node heap exhaustion',exitCode=1)]
report['server']=dict(owned=True,pid=70042,sessionId=12188,url='http://127.0.0.1:5199',command=report['server']['command'],restartOf=48739)
(out/'report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(dict(retryJobs=len(retry),originalFailuresPreserved=True)))
