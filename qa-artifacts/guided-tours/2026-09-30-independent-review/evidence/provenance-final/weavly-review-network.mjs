import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_ROOT);
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
const events = [];
process.on('exit', () => { if (process.env.NETWORK_LOG) writeFileSync(process.env.NETWORK_LOG, JSON.stringify(events,null,2)); });
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArgs) => {
    const context = await newContext(...contextArgs);
    context.on('request', request => events.push({type:'request',url:request.url(),method:request.method(),at:Date.now(),body:request.postData()}));
    context.on('response', response => events.push({type:'response',url:response.url(),status:response.status()}));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!['http:', 'ws:'].includes(url.protocol) || !['localhost','127.0.0.1'].includes(url.hostname) || url.port !== '5199') {
        events.push({type:'blocked-external',url:url.href,method:route.request().method()});
        await route.abort('blockedbyclient');
      } else if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/free/costings')) {
        events.push({type:'blocked-api',url:url.href,method:route.request().method()});
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    return context;
  };
  return browser;
};
