import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE_ERROR: ' + msg.text().substring(0, 300)); });
  await page.goto('http://localhost:3449/', { timeout: 10000 });
  await page.waitForTimeout(3000);
  const el = await page.$('penpot-auth-screen');
  console.log('penpot-auth-screen found:', !!el);
  if (errors.length > 0) console.log('Errors:\n' + errors.join('\n'));
  else console.log('No JS errors!');
  await browser.close();
})();