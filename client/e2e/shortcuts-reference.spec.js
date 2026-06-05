import { test, expect } from '@playwright/test';

test.describe('Shortcuts Reference E2E', () => {

  test('penpot-shortcuts-reference custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-shortcuts-reference'));
    expect(defined).toBe(true);
  });

  test('shortcuts reference is hidden by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const display = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      return sr.style.display;
    });
    expect(display).toBe('none');
  });

  test('open method shows the panel and sets open attribute', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const result = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      return {
        display: sr.style.display,
        hasOpenAttr: sr.hasAttribute('open'),
      };
    });
    expect(result.display).toBe('');
    expect(result.hasOpenAttr).toBe(true);
  });

  test('close method hides panel and removes open attribute', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const result = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      sr.close();
      return {
        display: sr.style.display,
        hasOpenAttr: sr.hasAttribute('open'),
      };
    });
    expect(result.display).toBe('none');
    expect(result.hasOpenAttr).toBe(false);
  });

  test('close method emits shortcuts-close event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      return new Promise((resolve) => {
        sr.addEventListener('shortcuts-close', () => resolve(true), { once: true });
        sr.close();
      });
    });
    expect(eventFired).toBe(true);
  });

  test('shortcuts reference renders search input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasSearch = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      return !!sr.querySelector('#search');
    });
    expect(hasSearch).toBe(true);
  });

  test('shortcuts list renders shortcut rows', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const count = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      return sr.querySelectorAll('.penpot-sc__row').length;
    });
    expect(count).toBeGreaterThan(0);
  });

  test('shortcuts list renders category headers', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const count = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      return sr.querySelectorAll('.penpot-sc__category').length;
    });
    expect(count).toBeGreaterThan(0);
  });

  test('search input filters shortcuts', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const count = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      const searchInput = sr.querySelector('#search');
      if (searchInput) {
        searchInput.value = 'undo';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return sr.querySelectorAll('.penpot-sc__row').length;
    });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('search with no match shows empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      const searchInput = sr.querySelector('#search');
      if (searchInput) {
        searchInput.value = 'zzzzzznonexistent';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return !!sr.querySelector('.penpot-sc__empty');
    });
    expect(hasEmpty).toBe(true);
  });

  test('close button exists in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasCloseBtn = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      return !!sr.querySelector('#close-btn');
    });
    expect(hasCloseBtn).toBe(true);
  });

  test('shortcut rows contain key badges', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasKeyBadges = await page.evaluate(() => {
      const sr = document.createElement('penpot-shortcuts-reference');
      document.body.appendChild(sr);
      sr.open();
      return sr.querySelectorAll('.penpot-sc__key').length > 0;
    });
    expect(hasKeyBadges).toBe(true);
  });
});