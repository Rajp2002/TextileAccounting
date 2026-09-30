import pathlib,json,hashlib,shutil,subprocess
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
harness=root/'scratch/browser-verification-harness'
bundle=root/'qa-artifacts/guided-tours/2026-09-30-independent-review'
assert not bundle.exists()
wrapper=['node',str(root/'scripts/performance/isolated-command.mjs')]
def git(*args):return subprocess.check_output(wrapper+['git',*args],cwd=root)
status=json.loads((out/'source-end.json').read_text())
paths=git('ls-files','-z','--cached','--others','--exclude-standard').decode().split('\0')
current={p:hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else 'DELETED' for p in sorted(set(paths)) if p}
assert current==status['files'],'Source changed since the completed independent review'
changes=git('diff','--name-only','-z').decode().split('\0')
new=git('ls-files','--others','--exclude-standard','-z').decode().split('\0')
source_paths=sorted(set(p for p in changes+new if p))
bundle.mkdir(parents=True)
evidence=bundle/'evidence';evidence.mkdir()
copied=[];omitted=[]
def copy(source,relative):
    dest=evidence/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
    copied.append(dict(file=str(dest.relative_to(bundle)),source=str(source),bytes=source.stat().st_size,sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
selected=set()
for row in json.loads((out/'gt05-results.json').read_text()):
    if row['language']=='gu' and row['size']=='390x844' and row.get('record'):
        selected.add(pathlib.Path(row['record']).parent/'09.png')
for row in json.loads((out/'gt15-results.json').read_text())+json.loads((out/'gt15-retry-results.json').read_text()):
    if row.get('record'):
        record=json.loads(pathlib.Path(row['record']).read_text())
        if record['steps'][0]['overlapArea']>0:selected.add(pathlib.Path(row['record']).parent/'01.png')
for group in ['gt10-paint','gt11-paint','gt13-transition','gt14-transition','gt15-transition']:
    for row in json.loads((out/f'{group}-results.json').read_text()):
        selected.update(pathlib.Path(row['record']).parent.glob('[0-9][0-9].png'))
for source in sorted(p for p in out.rglob('*') if p.is_file()):
    relative=source.relative_to(out)
    if source.suffix=='.png' and source not in selected:
        omitted.append(dict(file=str(relative),bytes=source.stat().st_size,sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
    elif source.name!='review.diff':copy(source,relative)
for name in ['gt01-runtime-probe.json','gt01-motion-probe.json','gt02-invitations-final','gt03-lifecycle','gt03-variants']:
    source=harness/name
    entries=[source] if source.is_file() else [p for p in source.rglob('*') if p.is_file()]
    for path in entries:
        if path.suffix!='.png':copy(path,pathlib.Path('harness-supplemental')/path.relative_to(harness))
shutil.copy2('/private/tmp/weavly-handoff-README.md',bundle/'README.md')
shutil.copy2('/private/tmp/weavly-handoff-reproduce.mjs',bundle/'reproduce.mjs')
shutil.copy2(out/'provenance-final/weavly-review-network.mjs',bundle/'network-guard.mjs')
assert 'at:Date.now()' in (bundle/'network-guard.mjs').read_text() or 'at: Date.now()' in (bundle/'network-guard.mjs').read_text()
for name in ['weavly-handoff-package.py','weavly-handoff-README.md','weavly-handoff-reproduce.mjs']:
    copy(pathlib.Path('/private/tmp')/name,pathlib.Path('handoff-provenance')/name)
manifest=dict(date='2026-09-30',reviewedHead=status['head'],reviewedBranch=status['branch'],reviewedApplicationFingerprint='a70241eef16e00357e5bb1be433f3e991f9a02777ba08e535c4ce2a091189167',sourcePathsToCommit=source_paths,files=copied,omittedImages=omitted,excludedDiff='review.diff duplicates the reviewed source delta now being committed',copiedBytes=sum(f['bytes'] for f in copied))
(bundle/'manifest.json').write_text(json.dumps(manifest,indent=2))
ledger=root/'docs/guided-tours/EXECUTION_STATUS.md';text=ledger.read_text();marker='### Portable reviewed-snapshot handoff — 2026-09-30'
assert marker not in text
ledger.write_text(text+f'\n\n{marker}\n\nThe owner requested a commit and push so fixes can continue in another harness. The handoff commits the already reviewed, previously uncommitted integrated source snapshot together with this ledger; no application fix is added. Portable review records, logs, helper provenance, selected finding/adjudication screenshots and isolated reproduction instructions are under `qa-artifacts/guided-tours/2026-09-30-independent-review/README.md`. The complete originals remain in ignored scratch. Historical integrity evidence is from before this packaging/commit. BV-01/GT-05 and BV-02/GT-15 remain FAILED; pending human/live gates and GT-16/GT-17 status are unchanged. Target branch: `tours/implementation`.\n')
print(json.dumps(dict(bundle=str(bundle),sourcePaths=len(source_paths),evidenceFiles=len(copied),copiedBytes=manifest['copiedBytes'],selectedImages=len(selected),omittedImages=len(omitted))))
