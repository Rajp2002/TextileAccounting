import pathlib,json,shutil,hashlib
root=pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out=root/'scratch/browser-verification'
dest=out/'integrity-first-attempt';dest.mkdir(exist_ok=False)
for name in ['source-integrity.json','source-end.json','git-status-end.txt']:
    shutil.copy2(out/name,dest/name)
original=out/'provenance-final/weavly-review-integrity.py'
shutil.copy2(original,dest/'weavly-review-integrity.py')
assert "and (root / p).is_file()" in original.read_text()
repair=out/'provenance-integrity-repair';repair.mkdir(exist_ok=False)
manifest=[]
for name in ['weavly-review-integrity.py','weavly-review-integrity-repair.py','weavly-review-report.py']:
    source=pathlib.Path('/private/tmp')/name;target=repair/name;shutil.copy2(source,target)
    manifest.append(dict(source=str(source),copy=str(target),sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
(repair/'manifest.json').write_text(json.dumps(manifest,indent=2))
report=json.loads((out/'report.json').read_text());report['integrityRepair']=dict(originalFailure='integrity-first-attempt/source-integrity.json',reason='Starting manifest represents preexisting tracked deletions with DELETED; first final manifest wrongly omitted those entries. Final helper now uses the identical tombstone representation. No application change was made.',provenance='provenance-integrity-repair/manifest.json');(out/'report.json').write_text(json.dumps(report,indent=2))
ledger=root/'docs/guided-tours/EXECUTION_STATUS.md'
current=ledger.read_text();marker='### Independent integrity comparison correction — 2026-09-30'
assert marker not in current
ledger.write_text(current+f'\n\n{marker}\n\nThe first final integrity comparison incorrectly omitted the eleven tracked files already represented as `DELETED` in the starting manifest, producing a false change report. The failed artifacts and executed helper are preserved under `scratch/browser-verification/integrity-first-attempt/`. The comparator was corrected to use the same starting tombstone schema; final proof is recalculated after this entry. Corrected helper provenance is additionally preserved under `provenance-integrity-repair/manifest.json`. No application edit was made by this correction.\n')
print(json.dumps(dict(originalFailurePreserved=True,correctedManifestSchema=True)))
