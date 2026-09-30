import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_ROOT);
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
const evidence = [];
process.on('exit', () => {
  if (process.env.NETWORK_LOG) writeFileSync(join(dirname(process.env.NETWORK_LOG), 'paint.json'), JSON.stringify(evidence, null, 2));
});
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArgs) => {
    const context = await newContext(...contextArgs);
    context.on('page', page => {
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async (...screenshotArgs) => {
        const state = await page.evaluate(() => {
          const rect = element => { if (!element) return null; const box=element.getBoundingClientRect(); return {x:box.x,y:box.y,w:box.width,h:box.height}; };
          const describe = element => { if(!element) return null; const css=getComputedStyle(element); return {tag:element.tagName,classes:element.className,role:element.getAttribute('role'),rect:rect(element),zIndex:css.zIndex,position:css.position,background:css.backgroundColor,opacity:css.opacity,pointerEvents:css.pointerEvents,inert:element.inert,text:element.textContent?.trim().slice(0,90)}; };
          const panel = document.querySelector('.guided-tour-panel');
          const rail = [...document.querySelectorAll('aside')].find(element => /left-rail/.test(element.className) && getComputedStyle(element).position==='fixed');
          const highlight = document.querySelector('.guided-tour-highlight');
          const dialog = document.querySelector('[data-payroll-tour-preview="true"], [data-production-tour-preview="true"]');
          const a=rect(rail),b=rect(highlight);
          const intersection=a&&b?{left:Math.max(a.x,b.x),top:Math.max(a.y,b.y),right:Math.min(a.x+a.w,b.x+b.w),bottom:Math.min(a.y+a.h,b.y+b.h)}:null;
          const points=[];
          if (intersection && intersection.right>intersection.left && intersection.bottom>intersection.top) {
            for (const fx of [0.25,0.5,0.75]) for (const fy of [0.25,0.5,0.75]) {
              const x=intersection.left+(intersection.right-intersection.left)*fx,y=intersection.top+(intersection.bottom-intersection.top)*fy;
              points.push({x,y,elements:document.elementsFromPoint(x,y).slice(0,6).map(describe)});
            }
          }
          return {step:panel?.getAttribute('data-tour-step'),status:panel?.getAttribute('data-tour-status'),rail:describe(rail),railChildren:rail?[...rail.children].map(describe):[],dialog:describe(dialog),highlight:describe(highlight),intersection,points};
        });
        evidence.push({path:screenshotArgs[0]?.path,at:Date.now(),...state});
        return screenshot(...screenshotArgs);
      };
    });
    return context;
  };
  return browser;
};
