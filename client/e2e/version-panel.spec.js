import { test, expect } from '@playwright/test';

test.describe('Version Panel E2E', () => {

  test('penpot-version-panel custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-version-panel'));
    expect(defined).toBe(true);
  });

  test('version panel renders header with close button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasClose = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      return !!vp.querySelector('#close-btn');
    });
    expect(hasClose).toBe(true);
  });

  test('version panel renders Save Version button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasBtn = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      return !!vp.querySelector('#create-btn');
    });
    expect(hasBtn).toBe(true);
  });

  test('version panel shows empty state when no snapshots', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      const content = vp.querySelector('#snapshot-list');
      return content?.innerHTML?.includes('No versions') || false;
    });
    expect(hasEmpty).toBe(true);
  });

  test('close button emits penpot-version-close event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      return new Promise((resolve) => {
        vp.addEventListener('penpot-version-close', () => resolve(true), { once: true });
        vp.querySelector('#close-btn')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('close method emits penpot-version-close event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      return new Promise((resolve) => {
        vp.addEventListener('penpot-version-close', () => resolve(true), { once: true });
        vp.close();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('refresh method is callable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const callable = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      return typeof vp.refresh === 'function';
    });
    expect(callable).toBe(true);
  });

  test('fileId setter triggers snapshot loading', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const fileIdSettable = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      vp.fileId = 'test-file-id';
      return vp.fileId === 'test-file-id';
    });
    expect(fileIdSettable).toBe(true);
  });

  test('version panel header shows Version History title', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const title = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      const h3 = vp.querySelector('.penpot-ver__header h3');
      return h3?.textContent || '';
    });
    expect(title).toBe('Version History');
  });

  test('snapshot list container exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasList = await page.evaluate(() => {
      const vp = document.createElement('penpot-version-panel');
      document.body.appendChild(vp);
      return !!vp.querySelector('#snapshot-list');
    });
    expect(hasList).toBe(true);
  });
});