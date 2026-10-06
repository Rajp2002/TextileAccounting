"""Playwright CLI capture of real components with local synthetic transport."""
import json, os, pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parents[3]
phase = sys.argv[1]
prior = '--prior' in sys.argv
baseline = '--baseline' in sys.argv
out = root / 'output/playwright/lite-mobile-records' / phase
out.mkdir(parents=True, exist_ok=True)
cases = [(view, tier, width, height) for view in ('quotes', 'rates') for tier, width, height in [('lite', 320, 568), ('lite', 430, 932), ('lite', 1440, 900), ('base', 320, 568), ('none', 320, 568), ('free', 320, 568)]]
if prior:
    cases = [('quotes',tier,width,height) for tier,width,height in [('lite',320,568),('lite',430,932),('lite',1440,900),('base',320,568)]]
code = '''async (page) => {
const cases = CASES; const results = [];
for (const [view,tier,width,height] of cases) {
  const context=await page.context().browser().newContext({viewport:{width,height},hasTouch:width<768,isMobile:width<768});
  try {
    const p=await context.newPage();
    await p.goto(`http://127.0.0.1:4195/owner/${view}?tier=${tier}PRIOR`);
    await p.locator('h1').last().waitFor(); await p.waitForTimeout(650);
    const file=`OUT/${view}-${tier}-${width}.png`;
    await p.screenshot({path:file,fullPage:true});
    results.push({view,tier,width,height,file,heading:await p.locator('h1').last().innerText(),scrollWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});
  } finally { await context.close(); }
}
return results;
}'''.replace('CASES', json.dumps(cases)).replace('OUT', str(out)).replace('PRIOR', ('&prior=1' if prior else '') + ('&baseline=1' if baseline else ''))
env = {**os.environ, 'PLAYWRIGHT_CLI_TIMEOUT_SECONDS':'60'}
result = subprocess.run(['/Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh', '-s=lite-records', 'run-code', code], cwd=root, env=env, text=True, capture_output=True)
(out/'cli.log').write_text(result.stdout+result.stderr)
if result.returncode or '### Error' in result.stdout or '### Result' not in result.stdout:
    raise SystemExit(result.stdout+result.stderr)
data = json.loads(result.stdout.split('### Result\n',1)[1].split('\n###',1)[0])
(out/'manifest.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({'cases':len(data),'overflows':[row for row in data if row['scrollWidth']>row['width']]}))
