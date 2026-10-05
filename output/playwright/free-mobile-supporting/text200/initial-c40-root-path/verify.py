"""Read-only fixed-pixel supporting text reflow; no live transport."""
import os, subprocess, json
from pathlib import Path

ROOT=Path('/Users/rajpatel/Projects/textile Saas')
OUT=ROOT/'output/playwright/free-mobile-supporting/text200'
code=r'''async (page) => {
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
  const scale=()=>page.evaluate(()=>{
    const originals=Reflect.get(window,'__text200Originals')??new WeakMap();
    Reflect.set(window,'__text200Originals',originals);
    const entries=[document.body,...document.body.querySelectorAll('*')].filter(el=>el instanceof HTMLElement&&!originals.has(el)).map(el=>{
      const style=getComputedStyle(el); const size=parseFloat(style.fontSize); const line=parseFloat(style.lineHeight);
      originals.set(el,{size,line});return {el,size,line};
    });
    for(const {el,size,line} of entries){ if(Number.isFinite(size)) el.style.fontSize=size*2+'px'; if(Number.isFinite(line))el.style.lineHeight=line*2+'px'; }
    return {elements:entries.length,rootFont:getComputedStyle(document.documentElement).fontSize};
  });
  const measure=()=>page.evaluate(()=>{
    const visible=el=>{const style=getComputedStyle(el);const rect=el.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
    const nodes=[...document.body.querySelectorAll('h1,h2,h3,p,label,button,a,summary,input,textarea,[role="combobox"],[role="radio"]')].filter(visible);
    const horizontal=nodes.filter(el=>{const r=el.getBoundingClientRect();return r.left<-.75||r.right>innerWidth+.75}).map(el=>({tag:el.tagName,role:el.getAttribute('role'),text:(el.textContent??'').trim().slice(0,130),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
    const clips=nodes.filter(el=>{const style=getComputedStyle(el);return (style.overflowX==='hidden'||style.overflow==='hidden')&&el.scrollWidth>el.clientWidth+1}).map(el=>({tag:el.tagName,text:(el.textContent??'').trim().slice(0,130),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    const heightClips=nodes.filter(el=>{const style=getComputedStyle(el);return (style.overflowY==='hidden'||style.overflow==='hidden')&&el.scrollHeight>el.clientHeight+2&&!['INPUT','TEXTAREA'].includes(el.tagName)}).map(el=>({tag:el.tagName,text:(el.textContent??'').trim().slice(0,130),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
    return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontal,clips,heightClips};
  });
  for(const lang of ['en','hi','gu'])for(const view of ['account','billing','support','thread']){
    await page.goto('http://127.0.0.1:4192/?view='+view+'&lang='+lang);
    await page.getByRole('heading',{level:1}).waitFor();
    await page.waitForFunction(expected=>document.documentElement.lang===expected,lang);
    const state={lang,view,source:'c40c92eb',checks:[]};
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
    state.scale=await scale();
    state.layout=await measure();
    const controls=page.locator('input:not([type="hidden"]), textarea, [role="combobox"]');
    state.focus=[];
    for(let i=0;i<await controls.count();i++){
      const control=controls.nth(i);
      if(!(await control.isVisible())||await control.isDisabled())continue;
      await control.scrollIntoViewIfNeeded();
      await control.focus();
      state.focus.push(await control.evaluate(node=>{const r=node.getBoundingClientRect();return {tag:node.tagName,focused:node===document.activeElement,left:r.left,right:r.right,top:r.top,bottom:r.bottom,inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}}));
    }
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/'+view+'-'+lang+'-320-computed200.png',fullPage:true});
    if(view==='billing'){
      await page.locator('section[aria-labelledby="billing-history-heading"] button').click();
      await page.getByRole('dialog').waitFor();
      await scale();
      state.dialogLayout=await measure();
      await page.screenshot({path:'/Users/rajpatel/Projects/textile Saas/output/playwright/free-mobile-supporting/text200/billing-history-'+lang+'-320-computed200.png',fullPage:true});
      await page.keyboard.press('Escape');
      state.checks.push('payment history opened/scaled and Escape closed');
    }
    state.pass=state.layout.scrollWidth<=320&&state.layout.horizontal.length===0&&state.layout.clips.length===0&&state.layout.heightClips.length===0&&state.focus.every(c=>c.focused&&c.inViewport)&&(!state.dialogLayout||(state.dialogLayout.scrollWidth<=320&&state.dialogLayout.horizontal.length===0&&state.dialogLayout.clips.length===0&&state.dialogLayout.heightClips.length===0));
    results.push(state);
  }
  return {kind:'synthetic Chromium; frozen committed app; each original computed font size/line height 200%, html root/layout spacing unchanged; no keyboard/device/provider evidence',results,mutations,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
}'''
env={**os.environ,'PLAYWRIGHT_CLI_TIMEOUT_SECONDS':'60'}
result=subprocess.run(['/Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh','--session','free-supporting-text200','run-code',code],cwd=ROOT,env=env,text=True,capture_output=True)
output=result.stdout+result.stderr
(OUT/'verification.log').write_text(output)
print(output)
if '### Result' in output:
 raw=output.split('### Result',1)[1].split('### Ran',1)[0].strip()
 try:(OUT/'results.json').write_text(json.dumps(json.loads(raw),indent=2)+'\n')
 except ValueError:pass
raise SystemExit(result.returncode or (1 if '### Error' in output or '### Result' not in output else 0))
