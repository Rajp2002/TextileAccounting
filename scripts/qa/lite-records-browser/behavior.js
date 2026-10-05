/* eslint-disable @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates this callback expression. */
async (page) => {
  const context=await page.context().browser().newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true});
  const p=await context.newPage(); p.setDefaultTimeout(3500); const results=[];
  const check=(condition,message)=>{if(!condition)throw Error(message)};
  const go=async(view,extra='')=>{await p.goto(`http://127.0.0.1:4195/owner/${view}?${extra}`,{timeout:15000});await p.locator('h1').last().waitFor();await p.waitForTimeout(350)};
  const calls=()=>p.evaluate(()=>window.__liteRecords.calls);
  const test=async(name,body)=>{try{const detail=await body();results.push({name,status:'passed',detail})}catch(error){results.push({name,status:'failed',error:String(error)});await p.screenshot({path:`EVIDENCE/failure-${results.length}.png`,fullPage:true})}};
  try {
    await test('Help mounted, focus, close and active tour',async()=>{
      for(const view of ['quotes','rates']){
        await go(view);const guide=p.locator(view==='quotes'?'#lite-costings-help':'#lite-ratebook-help');
        check(!await guide.isVisible(),'Guide should start compact');await p.getByRole('button',{name:'Help',exact:true}).click();
        check(await guide.isVisible(),'Guide unavailable');check(await guide.evaluate(el=>el.contains(document.activeElement)),'Help did not move focus to guide');
        await p.getByRole('button',{name:'Help',exact:true}).click();check(!await guide.isVisible(),'Help failed to close');
        await p.getByRole('button',{name:'Help',exact:true}).click();await guide.locator('[data-tour-control="take-tour"],[data-tour-control="quiet-tour"]').first().click();
        await p.waitForTimeout(450);check(await guide.isVisible(),'Active tour guide hidden');
      }
      return 'Both existing guide instances are reachable, focused, closable and visible while tour is active';
    });
    await test('Search, counted filters, archived/favourites and re-opened disclosure',async()=>{
      await go('quotes');await p.locator('#saved-costings-search').fill('No such record');check((await p.locator('main').innerText()).includes('No saved records match'),'No-results missing');await p.locator('#saved-costings-search').fill('');
      await p.locator('summary').filter({hasText:/^Filters/}).click();await p.getByRole('switch',{name:'Favourites',exact:true}).click();check((await p.locator('summary').filter({hasText:/^Filters/}).innerText()).includes('1'),'Filter count missing');
      await p.locator('summary').filter({hasText:/^Filters/}).click();await p.locator('summary').filter({hasText:/^Filters/}).click();check(await p.getByRole('switch',{name:'Favourites',exact:true}).isChecked(),'Filter state lost');
      await p.getByRole('switch',{name:'Favourites',exact:true}).click();await p.getByRole('button',{name:'Archived',exact:true}).click();check((await p.locator('main').innerText()).includes('archived'),'Archive mode unavailable');await p.getByRole('button',{name:'Active',exact:true}).click();
      return 'Search/no-results and active filter state remain available after closing/reopening';
    });
    await test('Compare exact saved versions, dismiss/reopen, exit mode',async()=>{
      await go('quotes');await p.getByRole('button',{name:'Compare',exact:true}).click();await p.getByRole('button',{name:/^Cotton Roto Sheeting v2/}).click();
      await p.getByRole('checkbox',{name:'Select Cotton Roto Sheeting version 1 for comparison'}).check();await p.getByRole('checkbox',{name:'Select Cotton Roto Sheeting version 2 for comparison'}).check();
      await p.getByRole('button',{name:'Close Cotton Roto Sheeting details'}).click();await p.getByRole('button',{name:'Compare Costings',exact:true}).click();await p.waitForTimeout(450);
      const text=await p.getByRole('dialog').innerText();check(text.includes('v1')&&text.includes('v2')&&text.includes('Old')&&text.includes('New'),'Version provenance absent');await p.keyboard.press('Escape');
      await p.getByRole('button',{name:'Compare Costings',exact:true}).click();await p.keyboard.press('Escape');await p.getByRole('button',{name:'Exit comparison',exact:true}).click();check(await p.getByRole('button',{name:'Compare',exact:true}).getAttribute('aria-pressed')==='false','Mode did not exit');
      return {requests:await calls(),provenance:text.slice(0,420)};
    });
    await test('Export names selected saved version and date; closing sends no document',async()=>{
      await go('quotes');await p.getByRole('button',{name:/^Cotton Roto Sheeting v2/}).click();await p.getByRole('button',{name:'View version 1 breakdown for Cotton Roto Sheeting'}).click();await p.getByRole('button',{name:'Export',exact:true}).first().click();await p.waitForTimeout(450);
      const text=await p.getByRole('dialog').innerText();check(text.includes('Cotton Roto Sheeting')&&text.includes('v1'),'Selected export identity missing');check(text.includes('Oct')||text.includes('2026'),'Saved date missing');await p.keyboard.press('Escape');check(!(await calls()).some(call=>call.name==='document'),'Preview or close mutated document');return text.slice(0,500);
    });
    await test('Existing paid draft overwrite warning Cancel and restore payload',async()=>{
      await go('quotes');await p.evaluate(()=>localStorage.setItem(window.__liteDraft.key,JSON.stringify(window.__liteDraft.draft)));
      await p.getByRole('button',{name:/^Premium Airjet Twill/}).click();await p.getByRole('button',{name:'Use',exact:true}).first().click();
      await p.getByRole('heading',{name:'Replace estimator draft?'}).waitFor();await p.getByRole('button',{name:'Keep draft',exact:true}).click();check(!await p.evaluate(()=>window.__liteNavigation),'Cancel navigated');check(await p.evaluate(()=>JSON.parse(localStorage.getItem(window.__liteDraft.key)).qualityLabel)==='Unsaved quality','Cancel replaced draft');
      await p.getByRole('button',{name:/^Premium Airjet Twill/}).click();await p.getByRole('button',{name:'Use',exact:true}).first().click();await p.getByRole('button',{name:'Overwrite draft',exact:true}).click();
      const draft=await p.evaluate(()=>JSON.parse(localStorage.getItem(window.__liteDraft.key)));check(draft.sourceQuoteId==='33333333-3333-4333-8333-333333333333'&&draft.sourceQuoteVersionNumber===1,'Wrong restored identity');return {sourceQuoteId:draft.sourceQuoteId,sourceQuoteVersionNumber:draft.sourceQuoteVersionNumber};
    });
    await test('Saved archive Cancel leaves action untouched, failed attempt retains record',async()=>{
      await go('quotes');await p.getByRole('button',{name:/^Premium Airjet Twill/}).click();await p.getByRole('button',{name:'Archive snapshot',exact:true}).first().click();await p.getByRole('button',{name:'Keep snapshot',exact:true}).last().click();check((await calls()).length===0,'Cancel sent archive');
      await p.getByRole('button',{name:'Archive snapshot',exact:true}).first().click();await p.evaluate(()=>window.__liteRecords.mode='reject');await p.getByRole('button',{name:'Archive snapshot',exact:true}).last().click();await p.waitForTimeout(300);await p.keyboard.press('Escape');await p.waitForTimeout(450);check(await p.getByRole('button',{name:/^Premium Airjet Twill/}).count()>0,'Failed archive removed record');return await calls();
    });
    await test('Rate invalid input, typed values after rejected/uncertain save and exact retry',async()=>{
      await go('rates');await p.getByRole('button',{name:'Edit rate',exact:true}).first().click();const input=p.locator('input[id^="quick-rate-"]');await input.fill('-1');check(await p.getByRole('button',{name:'Save Rate',exact:true}).isDisabled(),'Negative input enabled save');await input.fill('199');await p.locator('input[id^="quick-source-"]').fill('Typed supplier note');
      await p.evaluate(()=>{window.__liteRecords.mode='reject';window.__liteRecords.delay=350});await p.getByRole('button',{name:'Save Rate',exact:true}).evaluate(el=>{el.click();el.click()});await p.waitForTimeout(600);
      check((await calls()).filter(call=>call.name==='rate-save').length===1,'Duplicate save request');check(await input.inputValue()==='199','Rejected save lost typed rate');check(await p.getByRole('alert').count()>0,'Rejection feedback missing');
      await p.evaluate(()=>window.__liteRecords.mode='throw');await p.getByRole('button',{name:'Save Rate',exact:true}).click();await p.waitForTimeout(500);check(await input.inputValue()==='199','Uncertain save lost proposal');
      await p.evaluate(()=>window.__liteRecords.mode='ok');await p.getByRole('button',{name:'Save Rate',exact:true}).click();await p.waitForTimeout(500);
      const payloads=(await calls()).filter(call=>call.name==='rate-save').map(call=>call.payload);check(payloads.length===3&&JSON.stringify(payloads[0])===JSON.stringify(payloads[1])&&JSON.stringify(payloads[1])===JSON.stringify(payloads[2]),'Retry changed immutable payload/CAS');return payloads;
    });
    await test('Favourite duplicate rejection followed by retry preserves payload',async()=>{
      await go('quotes');await p.getByRole('button',{name:/^Premium Airjet Twill/}).click();await p.evaluate(()=>{window.__liteRecords.mode='reject';window.__liteRecords.delay=350});const favorite=p.getByRole('button',{name:/^Add Premium Airjet Twill.*to favourites$/});await favorite.evaluate(el=>{el.click();el.click()});await p.waitForTimeout(500);check((await calls()).length===1,'Duplicate favourite request');await p.evaluate(()=>window.__liteRecords.mode='ok');await favorite.click();await p.waitForTimeout(500);const requests=await calls();check(requests.length===2&&JSON.stringify(requests[0].payload)===JSON.stringify(requests[1].payload),'Favorite retry changed payload/CAS');return requests;
    });
    await test('In-flow due modal, dismissal and explicit captured bulk set',async()=>{
      await go('rates');const review=p.getByRole('button',{name:'Review due: 1',exact:true});await review.click();await p.keyboard.press('Escape');check((await calls()).length===0,'Dismiss confirmed rates');await review.click();const text=await p.getByRole('dialog').innerText();check(text.includes('Existing costing snapshots are not changed')&&text.includes('₹180.00/kg'),'Consequences or current value hidden');await p.getByRole('button',{name:'Confirm All (1) as Current',exact:true}).click();await p.waitForTimeout(350);const request=(await calls()).find(call=>call.name==='rate-review-all');check(request?.payload.length===1&&request.payload[0].expectedUpdatedAt==='2026-10-01T10:00:00Z','Bulk set/CAS changed');return request;
    });
    await test('Rate filters retain state; Back/Forward sends no actions; small viewport focus',async()=>{
      await go('rates');const toggle=p.locator('button[aria-controls="lite-ratebook-filters"]');await toggle.click();await p.locator('[data-ratebook-field="needsReviewFilter"]').getByRole('switch').click();await toggle.click();check((await toggle.innerText()).includes('1'),'Hidden active filter uncounted');await toggle.click();check(await p.locator('[data-ratebook-field="needsReviewFilter"]').getByRole('switch').isChecked(),'Closing reset filter');
      await go('quotes');await p.goBack();await p.locator('h1').waitFor();check(p.url().includes('/owner/rates'),'Back route wrong');check((await calls()).length===0,'Back sent mutation');await p.goForward();await p.locator('h1').waitFor();check(p.url().includes('/owner/quotes'),'Forward route wrong');check((await calls()).length===0,'Forward sent mutation');
      await go('rates');await p.getByRole('button',{name:'Edit rate',exact:true}).first().click();await p.setViewportSize({width:320,height:320});const input=p.locator('input[id^="quick-source-"]');await input.focus();await p.waitForTimeout(450);const bounds=await input.evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,focused:document.activeElement===el}});check(bounds.focused&&bounds.top>=0&&bounds.bottom<=bounds.height,'Focused rate note hidden in shrunken viewport');await p.setViewportSize({width:320,height:568});await p.keyboard.press('Escape');return {bounds,keyboard:'Viewport resize emulation only; no native keyboard'};
    });
    await test('Retained Free history stays mounted and preserves search through close',async()=>{
      await go('quotes','prior=1');const toggle=p.locator('[data-lite-prior-history] > button');check(await toggle.getAttribute('aria-expanded')==='false','Prior history not compact');await toggle.click();const history=p.locator('[data-lite-prior-history]');check((await history.innerText()).includes('Earlier Free receipt'),'Retained receipt unreachable');const input=history.locator('input[type="search"],input[id*="search"]');await input.first().fill('Earlier');await toggle.click();await toggle.click();check(await input.first().inputValue()==='Earlier','Closing remounted history');return {mounted:await history.locator('[data-free-costing]').count(),search:await input.first().inputValue()};
    });
    await test('Embedded history has unique connected labels and unchanged defaults',async()=>{
      await go('quotes','prior=1');await p.locator('[data-lite-prior-history] > button').click();const ids=await p.evaluate(()=>{const all=[...document.querySelectorAll('[id]')].map(el=>el.id);return {duplicates:all.filter((id,index)=>all.indexOf(id)!==index),labels:['search','sort','margin'].map(name=>{const id=`lite-prior-saved-costings-${name}`;const el=document.getElementById(id);const label=[...document.querySelectorAll('label')].find(label=>label.htmlFor===id);return {id,connected:!!el&&!!label&&label.control===el}})}});check(ids.duplicates.length===0,'Duplicate mounted IDs');check(ids.labels.every(label=>label.connected),'Embedded labels not connected');
      await go('quotes','prior=1&tier=base');const defaults=await p.evaluate(()=>['search','sort','margin'].map(name=>{const id=`saved-costings-${name}`;const el=document.getElementById(id);const label=[...document.querySelectorAll('label')].find(label=>label.htmlFor===id);return {id,connected:!!el&&!!label&&label.control===el}}));check(defaults.every(label=>label.connected),'Default IDs or labels changed');return {embedded:ids,defaults};
    });
    await test('Retained-history load error cannot be hidden by disclosure',async()=>{await go('quotes','prior=1&priorError=1');await p.getByRole('alert').waitFor();const toggle=p.locator('[data-lite-prior-history] > button');check(await toggle.getAttribute('aria-expanded')==='true','Load error hidden by default');await toggle.click();check(await p.getByRole('alert').isVisible(),'Toggle hid load error');return 'Existing load alert remains visible'});
    return {results,failed:results.filter(row=>row.status==='failed').length};
  } finally {await context.close()}
}
