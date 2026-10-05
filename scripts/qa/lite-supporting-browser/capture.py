"""Runs the Playwright CLI with an explicit local-only synthetic transport."""
import os
from pathlib import Path
import subprocess
import sys

stage = sys.argv[1]
if stage not in ("before", "after"):
    raise SystemExit("Expected before or after")
evidence=Path(f'output/playwright/lite-mobile-supporting/{stage}')
if stage == 'before' and any(evidence.glob('*.png')): raise SystemExit('BEFORE evidence already exists; refusing overwrite')
evidence.mkdir(parents=True,exist_ok=True)
code = r'''async (page) => {
  const id = '33333333-3333-4333-8333-333333333333';
  const ticket = {id, orgId:'22222222-2222-4222-8222-222222222222',subject:'Synthetic costing question',category:'costing',priority:'normal',status:'in_progress',source:'in_app',requesterBound:true,createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-04T10:00:00Z',version:4,nextAction:'',followUpDueAt:null,nextUpdateDueAt:'2026-10-06T10:00:00Z',needsFounderReply:true,resolvedAt:null,resolutionCode:null,resolutionSummary:null,firstPublicFounderReplyAt:null,reopenedCount:0};
  const messages = Array.from({length:4},(_,i)=>({id:'message-'+i,authorKind:i%2?'founder':'customer',messageKind:i===0?'initial_intake':'public_reply',body:i%2?'Synthetic answer: check the saved costing and its revision.':'Synthetic question: can I correct my saved result?',createdAt:'2026-10-04T10:00:00Z',messageSeq:i+1}));
  const dto = {ticket,messages,events:[{id:'event-1',eventType:'create',before:{},after:{status:'new'},createdAt:'2026-10-01T10:00:00Z'}],asOf:'2026-10-04T10:00:00Z',nextMessageBefore:null,nextEventBefore:null};
  await page.route('**/api/support**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/support'?{items:[ticket],nextCursor:null,totalMatching:1,asOf:dto.asOf}:dto}));
  const results = [];
  for (const size of [{width:320,height:740},{width:430,height:932},{width:1440,height:1000}]) {
    await page.setViewportSize(size);
    for (const view of ['settings','billing','audit','export','support','thread']) {
      await page.goto('http://127.0.0.1:4194/?view='+view);
      await page.getByRole('heading',{level:1}).waitFor();await page.waitForTimeout(200);
      if(view==='support')await page.getByRole('link',{name:'Open ticket'}).waitFor();
      await page.screenshot({path:'output/playwright/lite-mobile-supporting/STAGE/'+view+'-'+size.width+'.png',fullPage:true});
      results.push({view,width:size.width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),heading:await page.getByRole('heading',{level:1}).innerText()});
    }
  }
  for(const tier of ['base']) {
    for(const width of [320,430,1440]) {await page.setViewportSize({width,height:1000});for(const view of ['settings','billing','audit','export']) {await page.goto('http://127.0.0.1:4194/?view='+view+'&tier='+tier);await page.getByRole('heading',{level:1}).waitFor();await page.waitForTimeout(200);await page.waitForTimeout(150);await page.screenshot({path:'output/playwright/lite-mobile-supporting/STAGE/'+view+'-'+tier+'-'+width+'.png',fullPage:true});}}
  }
  for(const width of [320,430,1440]) {await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4194/?view=free-account');await page.getByRole('heading',{level:1}).waitFor();await page.waitForTimeout(200);await page.waitForTimeout(150);await page.screenshot({path:'output/playwright/lite-mobile-supporting/STAGE/free-account-'+width+'.png',fullPage:true});}
  return results;
}'''.replace('STAGE', stage)
env = {**os.environ, "PLAYWRIGHT_CLI_TIMEOUT_SECONDS": "60"}
result = subprocess.run(["/Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh", "--session", "lite-supporting", "run-code", code], env=env, text=True, capture_output=True)
Path(f"output/playwright/lite-mobile-supporting/{stage}/capture.log").write_text(result.stdout + result.stderr)
print(result.stdout + result.stderr)
raise SystemExit(result.returncode)
