import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(process.env.PLAYWRIGHT_ROOT);
const { chromium } = require('playwright');
const out=process.env.REVIEW_OUT;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const results=[];
try {
 for (const scenario of ['quotes','quotes?tier=lite','free-costings','quotes-compare']) {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await page.route('**/api/free/costings*',route=>route.fulfill({json:{costings:[],nextPage:null}}));
  const [s,q='']=scenario.split('?');
  const rec={scenario,steps:[],errors:[]};results.push(rec);
  page.on('pageerror',e=>rec.errors.push(e.message));
  try {
   await page.goto(`http://localhost:5199/?s=${s}&${q}&lang=en&fresh=1`);
   await page.waitForFunction(()=>window.__harnessReady,null,{timeout:60000});
   const launcher=s==='quotes-compare'?'compare-tour':'take-tour';
   let found=false;
   for(let i=0;i<50;i++) {
    await page.keyboard.press('Tab');
    if(await page.evaluate(control=>document.activeElement?.getAttribute('data-tour-control')===control,launcher)){found=true;break;}
   }
   assert.ok(found,'keyboard could not reach launcher');
   await page.keyboard.press('Enter');
   await page.locator('.guided-tour-panel').waitFor({timeout:15000});
   for(let n=0;n<15;n++) {
    await page.waitForFunction(()=>document.querySelector('.guided-tour-panel')?.getAttribute('data-tour-status')==='ready');
    const state=await page.evaluate(()=>({id:document.querySelector('.guided-tour-panel').getAttribute('data-tour-step'),active:document.activeElement?.getAttribute('data-tour-control'),panelFocused:document.activeElement===document.querySelector('.guided-tour-panel')}));
    if(n===0)assert.ok(state.panelFocused,'launch must focus the panel container (§5.4)');
    else assert.equal(state.active,'next','Next activation must retain Next focus (§5.4)');
    for(let i=0;i<12;i++) {
     await page.keyboard.press('Tab');
     assert.ok(await page.evaluate(()=>document.querySelector('.guided-tour-panel').contains(document.activeElement)),'Tab escaped panel');
    }
    for(let i=0;i<12;i++) {
     await page.keyboard.press('Shift+Tab');
     assert.ok(await page.evaluate(()=>document.querySelector('.guided-tour-panel').contains(document.activeElement)),'Shift+Tab escaped panel');
    }
    const move=async control=>{
     for(let i=0;i<12;i++){
      if(await page.evaluate(c=>document.activeElement?.getAttribute('data-tour-control')===c,control))return;
      await page.keyboard.press('Tab');
     }
     throw Error('control not keyboard reachable: '+control);
    };
    if(await page.locator('[data-tour-control="more"]').count()){
     await move('more');await page.keyboard.press('Enter');
     assert.equal(await page.locator('[data-tour-control="more"]').getAttribute('aria-expanded'),'true');
     await page.keyboard.press('Enter');
     assert.equal(await page.locator('[data-tour-control="more"]').getAttribute('aria-expanded'),'false');
    }
    if(n===1) {
     await move('back');await page.keyboard.press('Enter');
     await page.waitForFunction(()=>document.querySelector('.guided-tour-panel')?.getAttribute('data-tour-status')==='ready');
     await move('next');await page.keyboard.press('Enter');
     await page.waitForFunction(id=>document.querySelector('.guided-tour-panel')?.getAttribute('data-tour-step')===id&&document.querySelector('.guided-tour-panel')?.getAttribute('data-tour-status')==='ready',state.id);
    }
    rec.steps.push(state);
    const label=await page.locator('[data-tour-control="next"]').innerText();
    await move('next');await page.keyboard.press('Enter');
    if(label==='Done')break;
   }
   await page.locator('.guided-tour-panel').waitFor({state:'detached'});
   rec.after=await page.evaluate(()=>({anchor:document.activeElement?.getAttribute('data-tour-anchor'),calls:window.__serverCalls||[],nav:window.__navigations||[],inert:[...document.querySelectorAll('[inert]')].length}));
   assert.ok(rec.after.anchor,'Done focus missing');assert.equal(rec.after.inert,0);
   assert.deepEqual(rec.after.nav,[]);assert.ok(rec.after.calls.every(c=>c.fn==='recordTourEventAction'));
   const replay=s==='quotes-compare'?'compare-tour':'quiet-tour';
   // Continue keyboard traversal from the handoff, including wrap through the document.
   found=false;
   for(let i=0;i<80;i++){
    await page.keyboard.press('Tab');
    if(await page.evaluate(c=>document.activeElement?.getAttribute('data-tour-control')===c,replay)){found=true;break;}
   }
   assert.ok(found,'replay not keyboard reachable');await page.keyboard.press('Enter');
   await page.locator('.guided-tour-panel').waitFor();await page.keyboard.press('Escape');
   await page.locator('.guided-tour-panel').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-tour-control')),replay);
   assert.deepEqual(rec.errors,[]);rec.passed=true;
  } catch(e){rec.error=String(e);rec.passed=false;await page.screenshot({path:out+'/'+s+'-failure.png'});process.exitCode=1;}
  finally {await context.close();writeFileSync(out+'/record.json',JSON.stringify(results,null,2));}
 }
}finally{await browser.close();}
