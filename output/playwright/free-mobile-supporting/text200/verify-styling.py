import os,subprocess,json
from pathlib import Path
ROOT=Path('/Users/rajpatel/Projects/textile Saas')
OUT=ROOT/'output/playwright/free-mobile-supporting/text200/final'
code=r"""async(page)=>{
  const checks=[];
  for(const width of [320,1440])for(const tier of ['lite','base']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:4192/owner/settings?view=paid-account&tier='+tier+'&lang=en');
    const save=page.getByRole('button',{name:'Save personal information',exact:true});await save.waitFor();
    checks.push(await save.evaluate((node,options)=>{const s=getComputedStyle(node);return {...options,whiteSpace:s.whiteSpace,flexShrink:s.flexShrink,maxWidth:s.maxWidth,freeDisclosures:document.querySelectorAll('button[aria-expanded][aria-controls]:not([role=combobox])').length,pass:s.whiteSpace==='nowrap'&&s.flexShrink==='0'&&s.maxWidth==='none'}},{tier,width,view:'paid-account'}));
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4192/free/account?view=account&lang=en');
  const freeSave=page.getByRole('button',{name:'Save personal information',exact:true});await freeSave.waitFor();
  checks.push(await freeSave.evaluate(node=>{const s=getComputedStyle(node);return {view:'Free account desktop',whiteSpace:s.whiteSpace,flexShrink:s.flexShrink,maxWidth:s.maxWidth,pass:s.whiteSpace==='nowrap'&&s.flexShrink==='0'&&s.maxWidth==='none'}}));
  const freeInput=page.getByRole('textbox',{name:/^Your name/});
  checks.push(await freeInput.evaluate(node=>({view:'Free account desktop input',height:node.getBoundingClientRect().height,rootFont:getComputedStyle(document.documentElement).fontSize,pass:node.getBoundingClientRect().height===2.75*parseFloat(getComputedStyle(document.documentElement).fontSize)})));
  for(const width of [320,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:4192/owner/billing?view=default-history&lang=en');
    await page.getByRole('button',{name:'View payment history',exact:true}).click();
    await page.getByRole('dialog').waitFor();await page.waitForTimeout(450);
    const receipt=page.getByRole('dialog').locator('a[href="/api/billing/receipt/payment-1"]');
    checks.push(await receipt.evaluate((node,width)=>({view:'Default payment dialog',width,minHeight:getComputedStyle(node).minHeight,FreePortalClass:node.closest('[role=dialog]').className.includes('_history_'),pass:['0px','auto'].includes(getComputedStyle(node).minHeight)&&!node.closest('[role=dialog]').className.includes('_history_')}),width));
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:4192/free/billing?view=billing&records=1&lang=en');
  await page.locator('section[aria-labelledby="billing-history-heading"] button').click();
  await page.getByRole('dialog').waitFor();await page.waitForTimeout(450);
  checks.push(await page.getByRole('dialog').locator('a[href="/api/billing/receipt/payment-1"]').evaluate(node=>({view:'Free payment dialog desktop',minHeight:getComputedStyle(node).minHeight,pass:getComputedStyle(node).minHeight==='0px'})));
  return {kind:'Synthetic CSS/default-prop regression, bounded existing settings/receipt controls; no paid persistence/auth/device evidence',checks,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length};
}"""
result=subprocess.run(['/Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh','--session','free-supporting-text200','run-code',code],cwd=ROOT,env={**os.environ,'PLAYWRIGHT_CLI_TIMEOUT_SECONDS':'60'},text=True,capture_output=True)
output=result.stdout+result.stderr
(OUT/'styling.log').write_text(output)
print(output)
failed=1
if '### Result' in output:
 raw=output.split('### Result',1)[1].split('### Ran',1)[0].strip()
 data=json.loads(raw);(OUT/'styling.json').write_text(json.dumps(data,indent=2)+'\n');failed=data['failed']
raise SystemExit(result.returncode or (1 if '### Error' in output or failed else 0))
