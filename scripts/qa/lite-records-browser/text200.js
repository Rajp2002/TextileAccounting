/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates this callback expression. */
async (page) => {
  const language='LANGUAGE';const context=await page.context().browser().newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true});const p=await context.newPage();p.setDefaultTimeout(4500);const results=[];
  const closeDetail=async()=>p.getByRole('dialog').locator('button').filter({has:p.locator('svg.lucide-x')}).first().click();
  try {
    for(const scene of ['quotes','quotes-details','quotes-compare','quotes-export','quotes-prior','rates','rates-edit','rates-due','rates-add']){
      try {
        const view=scene.startsWith('quotes')?'quotes':'rates';await p.goto(`http://127.0.0.1:4195/owner/${view}?lang=${language}${scene==='quotes-prior'?'&prior=1':''}`,{timeout:15000});await p.locator('h1').last().waitFor();await p.waitForTimeout(700);
        if(scene==='quotes-details'||scene==='quotes-export'){await p.locator('[data-tour-anchor="costings.first-card"] button').first().click();await p.locator('[data-costing-card-control]').nth(1).locator('button').first().click();if(scene==='quotes-export')await p.getByRole('dialog').locator('button').filter({has:p.locator('svg.lucide-download')}).first().click()}
        if(scene==='quotes-compare'){await p.locator('[data-lite-costings] button[aria-pressed]').click();await p.locator('[data-tour-anchor="costings.first-card"] button').first().click();await p.getByRole('checkbox').nth(0).check();await p.getByRole('checkbox').nth(1).check();await closeDetail();await p.locator('[role="status"] button').filter({has:p.locator('svg.lucide-git-compare-arrows')}).first().click()}
        if(scene==='quotes-prior')await p.locator('[data-lite-prior-history] > button').click();
        if(scene==='rates-edit')await p.locator('[data-ratebook-field="quickEditAction"]:visible').first().click();
        if(scene==='rates-due')await p.locator('[data-lite-rates] > button[aria-haspopup="dialog"]').click();
        if(scene==='rates-add')await p.locator('[data-ratebook-field="addRateAction"]:visible').first().click();
        await p.waitForTimeout(450);
        const metrics=await p.evaluate(()=>{
          const nodes=[...document.querySelectorAll('body, body *')].map(el=>{const c=getComputedStyle(el);return{el,font:parseFloat(c.fontSize),line:parseFloat(c.lineHeight)}});
          for(const {el,font,line} of nodes){if(Number.isFinite(font)&&font>0)el.style.setProperty('font-size',`${font*2}px`,'important');if(Number.isFinite(line)&&line>0)el.style.setProperty('line-height',`${line*2}px`,'important')}
          return {scaled:nodes.length,touch:matchMedia('(pointer:coarse)').matches};
        });await p.waitForTimeout(350);
        const bounds=await p.evaluate(()=>{
          const visible=el=>{if(el.closest('.sr-only,.comparison-column-label,nav,[aria-hidden="true"]'))return false;const s=getComputedStyle(el);const r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
          const roots=[document.querySelector('main'),...document.querySelectorAll('[data-slot="dialog-content"],[data-slot="sheet-content"]')].filter(Boolean);
          const textIssues=[],targetIssues=[],inputIssues=[],adornmentIssues=[];
          for(const root of roots){
            const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
            while(node=walk.nextNode()){
              if(!node.textContent.trim())continue;const el=node.parentElement;if(!visible(el)||el.closest('script,style,svg'))continue;const range=document.createRange();range.selectNodeContents(node);
              for(const r of range.getClientRects()){
                if(r.width===0||r.height===0)continue;
                if(r.left<-1||r.right>innerWidth+1)textIssues.push({text:node.textContent.trim().slice(0,65),reason:'horizontal',left:r.left,right:r.right});
                let scrollX=false,scrollY=false;for(let ancestor=el;ancestor&&ancestor!==root.parentElement;ancestor=ancestor.parentElement){const css=getComputedStyle(ancestor),box=ancestor.getBoundingClientRect();if(['auto','scroll'].includes(css.overflowX)&&ancestor.scrollWidth>ancestor.clientWidth+1)scrollX=true;if(['auto','scroll'].includes(css.overflowY)&&ancestor.scrollHeight>ancestor.clientHeight+1)scrollY=true;if(!scrollX&&['hidden','clip'].includes(css.overflowX)&&(r.left<box.left-1||r.right>box.right+1))textIssues.push({text:node.textContent.trim().slice(0,65),reason:'clipped-x',ancestor:ancestor.tagName});if(!scrollY&&['hidden','clip'].includes(css.overflowY)&&(r.top<box.top-1||r.bottom>box.bottom+1))textIssues.push({text:node.textContent.trim().slice(0,65),reason:'clipped-y',ancestor:ancestor.tagName})}
              }
            }
            for(const el of root.querySelectorAll('button,a,summary,input,select,textarea,[role="menuitem"]')){if(!visible(el)||el.disabled)continue;const r=el.getBoundingClientRect();if(r.width<43.9||r.height<43.9)targetIssues.push({text:el.getAttribute('aria-label')||el.textContent.trim().slice(0,45),tag:el.tagName,width:r.width,height:r.height});if(el.matches('input:not([type="checkbox"]),select')){const css=getComputedStyle(el),line=parseFloat(css.lineHeight),clear=r.height-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)-parseFloat(css.borderTopWidth)-parseFloat(css.borderBottomWidth);if(Number.isFinite(line)&&clear+1<line)inputIssues.push({id:el.id,line,clear})}}
          }
          for(const input of document.querySelectorAll('input[id^="quick-rate-"]')){if(!visible(input))continue;const box=input.getBoundingClientRect(),css=getComputedStyle(input);const start=box.left+parseFloat(css.borderLeftWidth)+parseFloat(css.paddingLeft),end=box.right-parseFloat(css.borderRightWidth)-parseFloat(css.paddingRight);for(const span of input.parentElement.querySelectorAll('span')){const range=document.createRange();range.selectNodeContents(span);const rect=range.getBoundingClientRect();if(span.textContent.trim()==='₹'?rect.right>start:rect.left<end)adornmentIssues.push({text:span.textContent.trim(),left:rect.left,right:rect.right,contentStart:start,contentEnd:end})}}
          return{documentWidth:document.documentElement.scrollWidth,textIssues,targetIssues,inputIssues,adornmentIssues};
        });
        await p.screenshot({path:`EVIDENCE/${scene}-${language}-320.png`,fullPage:true});results.push({scene,language,...metrics,...bounds,status:bounds.documentWidth<=320&&!bounds.textIssues.length&&!bounds.targetIssues.length&&!bounds.inputIssues.length&&!bounds.adornmentIssues.length?'passed':'failed'});
      } catch(error){results.push({scene,language,status:'failed',error:String(error)})}
    }
    return{results,failed:results.filter(row=>row.status==='failed').length};
  }finally{await context.close()}
}
