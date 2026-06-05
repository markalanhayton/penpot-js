import { test, expect } from '@playwright/test';

test.describe('Text Toolbar E2E', () => {

  test('penpot-text-toolbar custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-text-toolbar'));
    expect(defined).toBe(true);
  });

  test('text toolbar is hidden by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const visible = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      return tt.classList.contains('penpot-ttoolbar__visible');
    });
    expect(visible).toBe(false);
  });

  test('text toolbar has font family trigger', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasTrigger = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      return !!tt.querySelector('#font-family-trigger');
    });
    expect(hasTrigger).toBe(true);
  });

  test('text toolbar has font size select', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasSize = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      return !!tt.querySelector('#font-size');
    });
    expect(hasSize).toBe(true);
  });

  test('text toolbar has bold, italic, and underline buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasButtons = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      return {
        bold: !!tt.querySelector('#bold-btn'),
        italic: !!tt.querySelector('#italic-btn'),
        underline: !!tt.querySelector('#underline-btn'),
      };
    });
    expect(hasButtons.bold).toBe(true);
    expect(hasButtons.italic).toBe(true);
    expect(hasButtons.underline).toBe(true);
  });

  test('text toolbar has alignment buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasButtons = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      return {
        left: !!tt.querySelector('#align-left-btn'),
        center: !!tt.querySelector('#align-center-btn'),
        right: !!tt.querySelector('#align-right-btn'),
      };
    });
    expect(hasButtons.left).toBe(true);
    expect(hasButtons.center).toBe(true);
    expect(hasButtons.right).toBe(true);
  });

  test('text toolbar shows when shape with text is set', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const isVisible = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      tt.shape = { id: 's1', type: 'text', content: 'Hello' };
      return tt.classList.contains('penpot-ttoolbar__visible');
    });
    expect(isVisible).toBe(true);
  });

  test('bold button click dispatches penpot-text-action event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const action = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      tt.shape = { id: 's1', type: 'text', content: 'Hello' };
      return new Promise((resolve) => {
        tt.addEventListener('penpot-text-action', (e) => resolve(e.detail?.action), true);
        tt.querySelector('#bold-btn')?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(action).toBe('bold');
  });

  test('italic button click dispatches penpot-text-action event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const action = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      tt.shape = { id: 's1', type: 'text', content: 'Hello' };
      return new Promise((resolve) => {
        tt.addEventListener('penpot-text-action', (e) => resolve(e.detail?.action), true);
        tt.querySelector('#italic-btn')?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(action).toBe('italic');
  });

  test('underline button click dispatches penpot-text-action event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const action = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      tt.shape = { id: 's1', type: 'text', content: 'Hello' };
      return new Promise((resolve) => {
        tt.addEventListener('penpot-text-action', (e) => resolve(e.detail?.action), true);
        tt.querySelector('#underline-btn')?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(action).toBe('underline');
  });

  test('alignment button click dispatches penpot-text-action event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const action = await page.evaluate(() => {
      const tt = document.createElement('penpot-text-toolbar');
      document.body.appendChild(tt);
      tt.shape = { id: 's1', type: 'text', content: 'Hello' };
      return new Promise((resolve) => {
        tt.addEventListener('penpot-text-action', (e) => resolve(e.detail?.action), true);
        tt.querySelector('#align-left-btn')?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(action).toBe('align-left');
  });
});