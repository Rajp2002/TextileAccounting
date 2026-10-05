import os,sys,subprocess,json
from pathlib import Path
name=sys.argv[1]
script=Path(f'scripts/qa/lite-supporting-browser/{name}.js').read_text()
r=subprocess.run(['/Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh','--session','lite-entry' if name.startswith('entry') else 'lite-supporting-text' if name.endswith('200') else 'lite-supporting-customer' if name=='support' else 'lite-supporting-behavior' if name=='behavior' else 'lite-supporting','run-code',script],env={**os.environ,'PLAYWRIGHT_CLI_TIMEOUT_SECONDS':'60'},text=True,capture_output=True)
Path(f'output/playwright/lite-mobile-supporting/{name}.log').write_text(r.stdout+r.stderr)
if '### Result' in r.stdout:
    raw=r.stdout.split('### Result\n',1)[1].split('\n###',1)[0]
    try: Path(f'output/playwright/lite-mobile-supporting/{name}.json').write_text(json.dumps(json.loads(raw),indent=2))
    except ValueError: pass
print((r.stdout+r.stderr)[:6500])
raise SystemExit(r.returncode if '### Result' in r.stdout else 1)
