import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3449/', { timeout: 10000 });
await page.waitForTimeout(3000);

const elements = [
  'penpot-context-menu',
  'penpot-gradient-editor',
  'penpot-shadow-editor',
  'penpot-import-dialog',
  'penpot-export-dialog',
  'penpot-mcp-panel',
  'penpot-rulers',
  'penpot-guide-overlay',
  'penpot-asset-panel',
];

for (const el of elements) {
  const defined = await page.evaluate((name) => !!customElements.get(name), el);
  console.log(`${el}: ${defined ? 'registered' : 'NOT registered'}`);
}
await browser.close();