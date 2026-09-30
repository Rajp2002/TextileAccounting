import pathlib,json,subprocess,hashlib
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
bundle=root/'qa-artifacts/guided-tours/2026-09-30-independent-review'
wrapper=['node',str(root/'scripts/performance/isolated-command.mjs')]
def git(*args,**kwargs):return subprocess.check_output(wrapper+['git',*args],cwd=root,**kwargs)
manifest=json.loads((bundle/'manifest.json').read_text())
assert not git('diff','--cached','--name-only').strip(),'Preserve an unexpected existing staged change'
review=json.loads((root/'scratch/browser-verification/source-end.json').read_text())
is_app=lambda p:p.startswith(('app/','components/','hooks/','lib/','__tests__/')) or p in ('package.json','package-lock.json','tsconfig.json','vitest.config.ts')
expected={p:h for p,h in review['files'].items() if is_app(p)}
current={p:hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else 'DELETED' for p in expected}
assert expected==current,'Reviewed application source changed'
fp=hashlib.sha256(json.dumps(current,sort_keys=True).encode()).hexdigest()
assert fp==manifest['reviewedApplicationFingerprint']
git('add','--',*manifest['sourcePathsToCommit'],str(bundle.relative_to(root)))
index={}
for item in git('ls-files','--stage','-z').decode().split('\0'):
    if not item:continue
    meta,p=item.split('\t',1);mode,sha,stage=meta.split();assert stage=='0';index[p]=sha
hash_name=git('rev-parse','--show-object-format').decode().strip()
for p,sha in expected.items():
    if sha=='DELETED':assert p not in index,p
    else:
        content=(root/p).read_bytes();blob=hashlib.new(hash_name,b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest()
        assert index.get(p)==blob,p
assert {p for p in index if is_app(p)}=={p for p,v in expected.items() if v!='DELETED'}
staged=[p for p in git('diff','--cached','--name-only','-z').decode().split('\0') if p]
assert all(p in manifest['sourcePathsToCommit'] or p.startswith(str(bundle.relative_to(root))+'/') for p in staged)
proof=dict(reviewedHead=review['head'],branch=git('branch','--show-current').decode().strip(),applicationFingerprint=fp,indexMatchesReviewedApplication=True,stagedPathsBeforeThisProof=len(staged),sourcePaths=manifest['sourcePathsToCommit'],evidenceRoot=str(bundle.relative_to(root)),noApplicationFixApplied=True)
assert proof['branch']=='tours/implementation'
(bundle/'stage-verification.json').write_text(json.dumps(proof,indent=2))
git('add','--',str((bundle/'stage-verification.json').relative_to(root)))
print(json.dumps({k:proof[k] for k in ['branch','applicationFingerprint','indexMatchesReviewedApplication','stagedPathsBeforeThisProof']}))
