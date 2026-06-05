import { test, expect } from '@playwright/test';

test.describe('Form Components E2E', () => {

  test('penpot-checkbox custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-checkbox'));
    expect(defined).toBe(true);
  });

  test('penpot-switch custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-switch'));
    expect(defined).toBe(true);
  });

  test('penpot-slider custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-slider'));
    expect(defined).toBe(true);
  });

  test('penpot-radio custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-radio'));
    expect(defined).toBe(true);
  });

  test('penpot-input custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-input'));
    expect(defined).toBe(true);
  });

  test('penpot-button custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-button'));
    expect(defined).toBe(true);
  });

  test('penpot-select custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-select'));
    expect(defined).toBe(true);
  });

  test('penpot-dropdown custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-dropdown'));
    expect(defined).toBe(true);
  });

  test('penpot-modal custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-modal'));
    expect(defined).toBe(true);
  });

  test('penpot-tooltip custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-tooltip'));
    expect(defined).toBe(true);
  });

  test('penpot-tabs custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-tabs'));
    expect(defined).toBe(true);
  });

  test('penpot-badge custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-badge'));
    expect(defined).toBe(true);
  });

  test('penpot-avatar custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-avatar'));
    expect(defined).toBe(true);
  });

  test('penpot-icon custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-icon'));
    expect(defined).toBe(true);
  });

  test('penpot-loader custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-loader'));
    expect(defined).toBe(true);
  });
});