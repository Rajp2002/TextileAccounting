"""Read-only fixed-pixel supporting text reflow; no live transport."""
import os, subprocess, json
from pathlib import Path

ROOT=Path('/Users/rajpatel/Projects/textile Saas')
OUT=ROOT/'output/playwright/free-mobile-supporting/text200/final'
code=r'''async (page) => {
  const context=await page.context().browser().newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true});
  page=await context.newPage();
  try {
  page.setDefaultTimeout(6000);
  await page.setViewportSize({width:320,height:568});
  const id='33333333-3333-4333-8333-333333333333';
  const ticket={id,orgId:'22222222-2222-4222-8222-222222222222',subject:'Synthetic costing question',category:'costing',priority:'normal',status:'in_progress',source:'in_app',requesterBound:true,createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-04T10:00:00Z',version:4,nextAction:'',followUpDueAt:null,nextUpdateDueAt:'2026-10-06T10:00:00Z',needsFounderReply:true,resolvedAt:null,resolutionCode:null,resolutionSummary:null,firstPublicFounderReplyAt:null,reopenedCount:0};
  const dto={ticket,messages:Array.from({length:4},(_,i)=>({id:'message-'+i,authorKind:i%2?'founder':'customer',messageKind:i?'public_reply':'initial_intake',body:i%2?'Synthetic answer: check the saved costing and its revision.':'Synthetic question: can I correct my saved result?',createdAt:'2026-10-04T10:00:00Z',messageSeq:i+1})),events:[{id:'event-1',eventType:'create',before:{},after:{status:'new'},createdAt:'2026-10-01T10:00:00Z'}],asOf:'2026-10-04T10:00:00Z',nextMessageBefore:null,nextEventBefore:null};
  const mutations=[];
  await page.route('**/*', async route=>{
    const request=route.request(), url=new URL(request.url());
    if(url.hostname!=='127.0.0.1') return route.abort('blockedbyclient');
    if(request.method()!=='GET'){mutations.push(url.pathname);return route.abort('blockedbyclient');}
    if(url.pathname.startsWith('/api/support')) return route.fulfill({json:url.pathname==='/api/support'?{items:[ticket],nextCursor:null,totalMatching:1,asOf:dto.asOf}:dto});
    return route.continue();
  });
  const text={en:{newTicket:'New ticket',help:'Help',older:'Earlier messages (2)',history:'Status history',reply:'Reply',billingHistory:'View billing history'},hi:{newTicket:'नया टिकट',help:'मदद',older:'पुराने संदेश (2)',history:'स्थिति का इतिहास',reply:'जवाब',billingHistory:'बिलिंग इतिहास देखें'},gu:{newTicket:'નવી ટિકિટ',help:'મદદ',older:'અગાઉના સંદેશા (2)',history:'સ્થિતિનો ઇતિહાસ',reply:'જવાબ',billingHistory:'બિલિંગ ઇતિહાસ જુઓ'}};
  const results=[];
  const scale=()=>page.evaluate(async()=>{
    const originals=Reflect.get(window,'__text200Originals')??new WeakMap();
    Reflect.set(window,'__text200Originals',originals);
    const entries=[document.body,...document.body.querySelectorAll('*')].filter(el=>el instanceof HTMLElement&&!originals.has(el)).map(el=>{
      const style=getComputedStyle(el); const size=parseFloat(style.fontSize); const line=parseFloat(style.lineHeight);
      originals.set(el,{size,line});return {el,size,line};
    });
    for(const {el,size,line} of entries){ if(Number.isFinite(size)) el.style.setProperty('font-size',size*2+'px','important'); if(Number.isFinite(line))el.style.setProperty('line-height',line*2+'px','important'); }
    await new Promise(resolve=>setTimeout(resolve,250));
    const mismatches=entries.filter(({el,size,line})=>{const computed=getComputedStyle(el);return Number.isFinite(size)&&Math.abs(parseFloat(computed.fontSize)-size*2)>.1||Number.isFinite(line)&&Math.abs(parseFloat(computed.lineHeight)-line*2)>.15}).map(({el,size,line})=>({tag:el.tagName,text:el.textContent?.slice(0,80),expectedSize:size*2,actualSize:getComputedStyle(el).fontSize,expectedLine:line*2,actualLine:getComputedStyle(el).lineHeight}));
    return {elements:entries.length,rootFont:getComputedStyle(document.documentElement).fontSize,coarse:matchMedia('(pointer:coarse)').matches,mismatches};
  });
  const measure=()=>page.evaluate(()=>{
    const visible=el=>{const style=getComputedStyle(el);const rect=el.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
    const nodes=[...document.body.querySelectorAll('h1,h2,h3,p,label,button,a,summary,input,textarea,[role="combobox"],[role="radio"]')].filter(visible);
    const horizontal=nodes.filter(el=>{const r=el.getBoundingClientRect();return r.left<-.75||r.right>innerWidth+.75}).map(el=>({tag:el.tagName,role:el.getAttribute('role'),text:(el.textContent??'').trim().slice(0,130),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
    const clips=nodes.filter(el=>{const style=getComputedStyle(el);return (style.overflowX==='hidden'||style.overflow==='hidden')&&el.scrollWidth>el.clientWidth+1}).map(el=>({tag:el.tagName,text:(el.textContent??'').trim().slice(0,130),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    const heightClips=nodes.filter(el=>{const style=getComputedStyle(el);return (style.overflowY==='hidden'||style.overflow==='hidden')&&el.scrollHeight>el.clientHeight+2&&!['INPUT','TEXTAREA'].includes(el.tagName)}).map(el=>({tag:el.tagName,text:(el.textContent??'').trim().slice(0,130),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
    const textOverflow=[];
    for(const el of document.body.querySelectorAll('*')){
      if(!(el instanceof HTMLElement)||!visible(el)||el.closest('[aria-hidden="true"]'))continue;
      const style=getComputedStyle(el); if(style.clip!=='auto'||el.classList.contains('sr-only'))continue;
      for(const node of el.childNodes){
        if(node.nodeType!==Node.TEXT_NODE||!node.textContent?.trim())continue;
        const range=document.createRange();range.selectNodeContents(node);
        for(const r of range.getClientRects())if(r.width>0&&(r.left<-.75||r.right>innerWidth+.75))textOverflow.push({tag:el.tagName,text:node.textContent.trim().slice(0,130),left:r.left,right:r.right});
      }
    }
    return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontal,clips,heightClips,textOverflow};
  });
  const touchTargets=()=>page.evaluate(()=>[...document.querySelectorAll('button,a[href],summary,input:not([type=hidden]),textarea,[role=combobox],[role=radio]')].filter(el=>{const r=el.getBoundingClientRect();const style=getComputedStyle(el);return !el.closest('[aria-hidden="true"]')&&style.display!=='none'&&style.visibility!=='hidden'&&r.width>0&&r.height>0}).map(el=>({tag:el.tagName,text:(el.textContent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim().slice(0,80),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
  for(const lang of ['en','hi','gu'])for(const view of ['account','billing','support','thread']){
    const appPath={account:'/free/account',billing:'/free/billing',support:'/support',thread:'/support/'+id}[view];
    await page.goto('http://127.0.0.1:4192'+appPath+'?view='+view+'&lang='+lang);
    await page.getByRole('heading',{level:1}).waitFor();
    await page.waitForFunction(expected=>document.documentElement.lang===expected,lang);
    const state={lang,view,source:'c40c92eb plus scoped Free supporting CSS corrections',checks:[]};
    if(view==='account'){
      const groups=page.locator('button[aria-expanded][aria-controls]').filter({hasNot:page.locator('[role="combobox"]')});
      // The four disclosure titles are mounted buttons; startup combobox has role=combobox and is excluded.
      const ids=await groups.evaluateAll(nodes=>nodes.filter(node=>node.getAttribute('role')!=='combobox'&&document.getElementById(node.getAttribute('aria-controls')??'')?.querySelector('section')).map(node=>node.getAttribute('aria-controls')));
      for(const id of ids)await page.locator('button[aria-controls="'+id+'"]:not([role="combobox"])').click();
      state.openedEditors=ids.length;
      state.checks.push('personal/factory/security/device editors opened');
    }
    if(view==='support'){
      await page.locator('a[href^="/support/"]').first().waitFor();
      await page.locator('summary').click();
      await page.locator('header button').click();
      await page.locator('textarea').waitFor();
      state.checks.push('Help and intake opened; subject/category/description reachable');
    }
    if(view==='thread'){
      await page.locator('button[aria-controls][aria-expanded]').evaluateAll(nodes=>nodes.filter(node=>node.getAttribute('aria-expanded')==='false').forEach(node=>node.click()));
      await page.locator('textarea').waitFor();
      state.checks.push('older messages and status history opened; reply composer reachable');
    }
    state.normalTouch=await touchTargets();
    state.scale=await scale();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    state.layout=await measure();
    if(view==='account'){
      const name=page.locator('form').first().locator('input').first();
      const save=page.locator('form').first().locator('button[type=submit]');
      const group=page.locator('button[aria-controls][aria-expanded]:not([role=combobox])').first();
      const discard=()=>page.locator('form').first().locator('button[type=button][data-slot=button]');
      await name.fill('x');await save.click();await page.locator('p[role=alert]').first().waitFor();
      await group.click();
      const invalidOpen=await group.getAttribute('aria-expanded')==='true';
      const invalidScale=await scale();
      const invalid=await measure();
      await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/final/account-'+lang+'-invalid-computed200.png',fullPage:true});
      await discard().click();
      await name.fill('Synthetic rejected owner');await save.click();await group.click();
      await page.locator('p[role=alert]').first().waitFor();
      const delayedOpen=await group.getAttribute('aria-expanded')==='true';
      const delayedScale=await scale();
      const delayed=await measure();
      await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/final/account-'+lang+'-delayed-feedback-computed200.png',fullPage:true});
      state.criticalFeedback={invalidOpen,invalidScale,invalid,delayedOpen,delayedScale,delayed};
      await discard().click();
    }
    const controls=page.locator('input:not([type="hidden"]), textarea, [role="combobox"]');
    state.focus=[];
    for(let i=0;i<await controls.count();i++){
      const control=controls.nth(i);
      if(!(await control.isVisible())||await control.isDisabled())continue;
      await control.scrollIntoViewIfNeeded();
      await control.focus();
      state.focus.push(await control.evaluate(node=>{const r=node.getBoundingClientRect();return {tag:node.tagName,focused:node===document.activeElement,css:{font:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight,height:r.height,paddingTop:getComputedStyle(node).paddingTop,paddingBottom:getComputedStyle(node).paddingBottom,contentHeight:node.clientHeight-parseFloat(getComputedStyle(node).paddingTop)-parseFloat(getComputedStyle(node).paddingBottom)},lineFits:node.clientHeight-parseFloat(getComputedStyle(node).paddingTop)-parseFloat(getComputedStyle(node).paddingBottom)>=parseFloat(getComputedStyle(node).lineHeight)-.75,left:r.left,right:r.right,top:r.top,bottom:r.bottom,inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}}));
    }
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/final/'+view+'-'+lang+'-320-computed200.png',fullPage:true});
    if(view==='billing'){
      await page.locator('section[aria-labelledby="billing-history-heading"] button').click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.goto('http://127.0.0.1:4192/free/billing?view=billing&lang='+lang);
      await page.getByRole('heading',{level:1}).waitFor();
      await page.waitForFunction(expected=>document.documentElement.lang===expected,lang);
      await page.locator('section[aria-labelledby="billing-history-heading"] button').click();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(450);
      state.dialogNormalTouch=await touchTargets();
      state.dialogScale=await scale();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      state.dialogLayout=await measure();
      await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/final/billing-history-'+lang+'-320-computed200.png',fullPage:true});
      await page.keyboard.press('Escape');
      state.checks.push('payment history opened/scaled and Escape closed');
    }
    const cleanFeedback=layout=>layout.scrollWidth<=320&&layout.horizontal.length===0&&layout.clips.length===0&&layout.heightClips.length===0&&layout.textOverflow.length===0;
    state.pass=(!state.criticalFeedback||(state.criticalFeedback.invalidOpen&&state.criticalFeedback.delayedOpen&&state.criticalFeedback.invalidScale.mismatches.length===0&&state.criticalFeedback.delayedScale.mismatches.length===0&&cleanFeedback(state.criticalFeedback.invalid)&&cleanFeedback(state.criticalFeedback.delayed)))&&state.normalTouch.every(target=>target.width>=44-.75&&target.height>=44-.75)&&state.scale.coarse&&state.scale.mismatches.length===0&&state.layout.scrollWidth<=320&&state.layout.horizontal.length===0&&state.layout.clips.length===0&&state.layout.heightClips.length===0&&state.layout.textOverflow.length===0&&state.focus.every(c=>c.focused&&c.inViewport&&c.lineFits&&c.css.height>=44)&&(!state.dialogLayout||(state.dialogNormalTouch.every(target=>target.width>=44-.75&&target.height>=44-.75)&&state.dialogScale.mismatches.length===0&&state.dialogLayout.scrollWidth<=320&&state.dialogLayout.horizontal.length===0&&state.dialogLayout.clips.length===0&&state.dialogLayout.heightClips.length===0&&state.dialogLayout.textOverflow.length===0));
    results.push(state);
  }
  for(const lang of ['en','hi','gu']){
    await page.goto('http://127.0.0.1:4192/free/billing?view=billing&records=1&lang='+lang);
    await page.getByRole('heading',{level:1}).waitFor();
    await page.waitForFunction(expected=>document.documentElement.lang===expected,lang);
    const state={lang,view:'billing-records',source:'c40c92eb plus scoped Free supporting CSS corrections',checks:['synthetic prior-paid captured receipt: latest date/amount summary and full history row/reference/receipt control']};
    state.normalTouch=await touchTargets();
    state.scale=await scale();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    state.layout=await measure();
    await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/final/billing-records-'+lang+'-320-computed200.png',fullPage:true});
    await page.locator('section[aria-labelledby="billing-history-heading"] button').click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.goto('http://127.0.0.1:4192/free/billing?view=billing&records=1&lang='+lang);
    await page.getByRole('heading',{level:1}).waitFor();
    await page.waitForFunction(expected=>document.documentElement.lang===expected,lang);
    await page.locator('section[aria-labelledby="billing-history-heading"] button').click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(450);
      state.dialogNormalTouch=await touchTargets();
      state.dialogScale=await scale();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    state.dialogLayout=await measure();
    state.amount=await page.getByRole('dialog').getByText('₹1,250',{exact:true}).isVisible();
    state.receipt=await page.getByRole('dialog').locator('a[href="/api/billing/receipt/payment-1"]').isVisible();
    await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/final/billing-records-history-'+lang+'-320-computed200.png',fullPage:true});
    await page.keyboard.press('Escape');
    const clean=layout=>layout.scrollWidth<=320&&layout.horizontal.length===0&&layout.clips.length===0&&layout.heightClips.length===0&&layout.textOverflow.length===0;
    state.pass=state.normalTouch.every(target=>target.width>=44-.75&&target.height>=44-.75)&&state.scale.coarse&&state.scale.mismatches.length===0&&state.dialogNormalTouch.every(target=>target.width>=44-.75&&target.height>=44-.75)&&state.dialogScale.mismatches.length===0&&state.amount&&state.receipt&&clean(state.layout)&&clean(state.dialogLayout);
    results.push(state);
  }
  return {kind:'synthetic Chromium hasTouch/coarse; frozen c40c92eb plus scoped Free supporting CSS corrections, app-like paths;  each original computed font size/line height 200%, html root/layout spacing unchanged; no keyboard/device/provider evidence',results,mutations,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
  } finally { await context.close(); }
}'''
env={**os.environ,'PLAYWRIGHT_CLI_TIMEOUT_SECONDS':'60'}
result=subprocess.run(['/Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh','--session','free-supporting-text200','run-code',code],cwd=ROOT,env=env,text=True,capture_output=True)
output=result.stdout+result.stderr
(OUT/'verification.log').write_text(output)
print(output)
if '### Result' in output:
 raw=output.split('### Result',1)[1].split('### Ran',1)[0].strip()
 try:
  data=json.loads(raw)
  (OUT/'results.json').write_text(json.dumps(data,indent=2)+'\n')
 except ValueError:pass
raise SystemExit(result.returncode or (1 if '### Error' in output or '### Result' not in output or ('data' in locals() and data.get('failed',0)) else 0))
