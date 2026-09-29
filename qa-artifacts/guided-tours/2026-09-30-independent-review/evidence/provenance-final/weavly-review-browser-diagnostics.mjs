import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_ROOT);
const { chromium } = require('playwright');
const launch = chromium.launch.bind(chromium);
const events = [];
process.on('uncaughtExceptionMonitor', error => events.push({ type: 'uncaught', at: Date.now(), message: String(error), stack: error.stack }));
process.on('exit', () => {
  if (process.env.NETWORK_LOG) writeFileSync(join(dirname(process.env.NETWORK_LOG), 'diagnostics.json'), JSON.stringify(events, null, 2));
});
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArgs) => {
    const context = await newContext(...contextArgs);
    context.on('requestfailed', request => events.push({ type: 'requestfailed', at: Date.now(), url: request.url(), failure: request.failure() }));
    context.on('page', page => {
      page.on('console', message => events.push({ type: 'console', level: message.type(), at: Date.now(), text: message.text() }));
      page.on('pageerror', error => events.push({ type: 'pageerror', at: Date.now(), message: error.message }));
      page.on('crash', () => events.push({ type: 'crash', at: Date.now() }));
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) events.push({ type: 'navigation', at: Date.now(), url: frame.url() }); });
      page.on('close', () => events.push({ type: 'close', at: Date.now() }));
    });
    return context;
  };
  return browser;
};
