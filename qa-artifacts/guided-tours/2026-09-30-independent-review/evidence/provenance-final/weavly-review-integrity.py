import pathlib, json, hashlib, subprocess

root = pathlib.Path('/Users/rajpatel/.codex/worktrees/tours-implementation/textile Saas')
out = root / 'scratch/browser-verification'
wrapper = ['node', 'scripts/performance/isolated-command.mjs']
def git(*args):
    return subprocess.check_output(wrapper + ['git', *args], cwd=root)
start = json.loads((out / 'source-start.json').read_text())
head = git('rev-parse', 'HEAD').decode().strip()
branch = git('branch', '--show-current').decode().strip()
paths = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').decode().split('\0')
files = {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in sorted(set(paths)) if p and (root / p).is_file()}
fingerprint = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
is_app = lambda p: p.startswith(('app/', 'components/', 'hooks/', 'lib/', '__tests__/')) or p in ('package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts')
app = {p: h for p, h in files.items() if is_app(p)}
app_fingerprint = hashlib.sha256(json.dumps(app, sort_keys=True).encode()).hexdigest()
changes = [{'file': p, 'before': start['files'].get(p), 'after': files.get(p)} for p in sorted(set(start['files']) | set(files)) if start['files'].get(p) != files.get(p)]
end = dict(date='2026-09-30', worktree=str(root), branch=branch, head=head, sourceFingerprint=fingerprint, applicationFingerprint=app_fingerprint, files=files)
(out / 'source-end.json').write_text(json.dumps(end, indent=2))
(out / 'git-status-end.txt').write_bytes(git('status', '--short'))
integrity = dict(headUnchanged=head == start['head'], branchUnchanged=branch == start['branch'], applicationFingerprint=app_fingerprint, applicationUnchanged=app_fingerprint == 'a70241eef16e00357e5bb1be433f3e991f9a02777ba08e535c4ce2a091189167', fileChanges=changes, allowedChangesOnly=all(row['file'] == 'docs/guided-tours/EXECUTION_STATUS.md' for row in changes))
(out / 'source-integrity.json').write_text(json.dumps(integrity, indent=2))
assert all(integrity[k] for k in ['headUnchanged', 'branchUnchanged', 'applicationUnchanged', 'allowedChangesOnly']), integrity
report = json.loads((out / 'report.json').read_text())
report['sourceIntegrity'] = integrity
(out / 'report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(integrity, indent=2))
