import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3449/');
await page.waitForSelector('penpot-auth-screen');
await page.locator('#email').fill('admin@penpot.local');
await page.locator('#pw').fill('penpot123');
await page.locator('#submit').click();
await page.waitForSelector('penpot-dashboard', { timeout: 15000 });
await page.waitForTimeout(2000);

// Check what elements the dashboard has
const dashboardHTML = await page.evaluate(() => {
  const db = document.querySelector('penpot-dashboard');
  return db ? db.shadowRoot?.innerHTML?.substring(0, 2000) || 'no shadowRoot' : 'no dashboard';
});
const newFileBtn = await page.locator('#new-file-btn, .new-file, .penpot-app__file-card--new').count();
const newBtn = await page.locator('#new-file-btn').count();
const newBtn2 = await page.locator('.penpot-app__new-file-btn, [data-test="new-file"]').count();

console.log('newFileBtn count:', newFileBtn);
console.log('#new-file-btn count:', newBtn);
console.log('alt selector count:', newBtn2);
console.log('Dashboard HTML:', dashboardHTML?.substring(0, 500));

await browser.close();