import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(process.env.PLAYWRIGHT_ROOT);
const {chromium}=require('playwright');
const [scenario,lang,size,dest]=process.argv.slice(2);
const [width,height]=size.split('x').map(Number);
const out=dest+'/transition';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768,deviceScaleFactor:1});
const page=await context.newPage();
const [name,query='']=scenario.split('?');
const record={scenario,lang,size,steps:[],issues:[],purpose:'Read-only Back/Next timing diagnosis; original main run remains unchanged and preserved'};
try{
 await page.goto(`http://localhost:5199/?s=${encodeURIComponent(name)}${query?'&'+query:''}&lang=${lang}&fresh=1`);
 await page.waitForFunction(()=>window.__harnessReady||window.__harnessError,null,{timeout:60000});
 await page.waitForTimeout(1200);
 await page.locator('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]').filter({visible:true}).first().click();
 for(const id of ['mc-purpose','mc-details']){
  await page.locator(`[data-tour-step="${id}"][data-tour-status="ready"]`).waitFor();
  await page.waitForTimeout(900);
  await page.locator('[data-tour-control="next"]').click();
 }
 await page.locator('[data-tour-step="mc-readiness"][data-tour-status="ready"]').waitFor();
 await page.waitForTimeout(900);
 await page.locator('[data-tour-control="back"]').click();
 await page.locator('[data-tour-step="mc-details"][data-tour-status="ready"]').waitFor();
 await page.locator('[data-machines-tour-preview="true"][data-state="open"]').waitFor();
 await page.locator('[data-tour-control="next"]').click();
 await page.locator('[data-tour-step="mc-readiness"][data-tour-status="ready"]').waitFor();
 for(const [index,delay] of [0,500,1500].entries()){
  if(delay)await page.waitForTimeout(delay);
  const state=await page.evaluate(()=>{
   const panel=document.querySelector('.guided-tour-panel'),highlight=document.querySelector('.guided-tour-highlight'),target=document.querySelector('[data-machines-tour-id="tour-machines-incomplete"]');
   const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height}};
   const p=r(panel),h=r(highlight),t=r(target);
   const intersect=(a,b)=>a&&b?Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)):0;
   return{step:panel?.getAttribute('data-tour-step'),status:panel?.getAttribute('data-tour-status'),panel:p,highlight:h,target:t,overlapArea:intersect(p,h),actualTargetOverlap:intersect(p,t),focusInPanel:panel?.contains(document.activeElement),title:panel?.querySelector('h2')?.textContent,storage:Object.fromEntries(Object.entries(localStorage).filter(([k])=>!k.startsWith('weavly:tour'))),calls:window.__serverCalls||[],animations:document.querySelector('.guided-tour-portal')?.getAnimations({subtree:true}).map(a=>({state:a.playState}))};
  });
  record.steps.push({...state,afterBackNextMilliseconds:[0,500,2000][index]});
  await page.screenshot({path:`${out}/${String(index+1).padStart(2,'0')}.png`});
 }
 const final=record.steps.at(-1);
 if(final.status!=='ready'||!final.focusInPanel||final.actualTargetOverlap||final.overlapArea)record.issues.push('Settled readiness state obstructed or not ready');
 if(!final.highlight||!final.target||Math.abs(final.highlight.x-final.target.x)>10||Math.abs(final.highlight.y-final.target.y)>10)record.issues.push('Settled outline does not track readiness target');
 await page.keyboard.press('Escape');
 await page.locator('.guided-tour-panel').waitFor({state:'detached'});
 record.after=await page.evaluate(()=>({calls:window.__serverCalls||[],prefs:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('weavly:tour'))),activeControl:document.activeElement?.getAttribute('data-tour-control')}));
 if(record.after.calls.some(c=>c.fn!=='recordTourEventAction'))record.issues.push('Unexpected business handler');
}catch(error){record.error=String(error);process.exitCode=1;}
writeFileSync(out+'/record.json',JSON.stringify(record,null,2));
console.log(JSON.stringify({scenario,steps:record.steps.length,issues:record.issues,error:record.error}));
if(record.issues.length)process.exitCode=1;
await browser.close();
