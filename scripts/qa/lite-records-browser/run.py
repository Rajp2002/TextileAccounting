"""Fail fast on CLI errors and failed browser assertions; preserve exact results."""
import json, os, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[3]
name, source = sys.argv[1:3]
out = root / 'output/playwright/lite-mobile-records' / name
out.mkdir(parents=True, exist_ok=True)
code = (root / source).read_text().replace('EVIDENCE', str(out))
code = code.replace('LANGUAGE', sys.argv[3] if len(sys.argv) > 3 else 'en')
result = subprocess.run(['/Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh','-s=lite-records','run-code',code],cwd=root,env={**os.environ,'PLAYWRIGHT_CLI_TIMEOUT_SECONDS':'60'},text=True,capture_output=True)
(out/'cli.log').write_text(result.stdout+result.stderr)
if result.returncode or '### Error' in result.stdout or '### Result' not in result.stdout:
    raise SystemExit(result.stdout+result.stderr)
data = json.loads(result.stdout.split('### Result\n',1)[1].split('\n###',1)[0])
(out/'results.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps(data))
if isinstance(data,dict) and data.get('failed',0): raise SystemExit(1)
