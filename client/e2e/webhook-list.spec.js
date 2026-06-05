import { test, expect } from '@playwright/test';

test.describe('Webhook List E2E', () => {

  test('penpot-webhook-list custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-webhook-list'));
    expect(defined).toBe(true);
  });

  test('webhook list renders create row with URL input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasInput = await page.evaluate(() => {
      const wl = document.createElement('penpot-webhook-list');
      document.body.appendChild(wl);
      return !!wl.querySelector('#webhook-uri');
    });
    expect(hasInput).toBe(true);
  });

  test('webhook list renders content type select', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasSelect = await page.evaluate(() => {
      const wl = document.createElement('penpot-webhook-list');
      document.body.appendChild(wl);
      return !!wl.querySelector('#webhook-mtype');
    });
    expect(hasSelect).toBe(true);
  });

  test('webhook list renders Add button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasBtn = await page.evaluate(() => {
      const wl = document.createElement('penpot-webhook-list');
      document.body.appendChild(wl);
      return !!wl.querySelector('#create-webhook');
    });
    expect(hasBtn).toBe(true);
  });

  test('webhook list shows empty state when no webhooks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const wl = document.createElement('penpot-webhook-list');
      document.body.appendChild(wl);
      const content = wl.querySelector('#content');
      return content?.innerHTML?.includes('No webhooks') || false;
    });
    expect(hasEmpty).toBe(true);
  });

  test('teamId setter triggers webhook loading', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const loadingShown = await page.evaluate(() => {
      const wl = document.createElement('penpot-webhook-list');
      document.body.appendChild(wl);
      wl.teamId = 'test-team-id';
      const content = wl.querySelector('#content');
      return content?.innerHTML?.includes('Loading') || false;
    });
    expect(loadingShown).toBe(true);
  });
});