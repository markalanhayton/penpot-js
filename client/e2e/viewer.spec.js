import { test, expect } from '@playwright/test';

test.describe('Viewer E2E', () => {

  test('penpot-viewer custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-viewer'));
    expect(defined).toBe(true);
  });

  test('viewer renders toolbar with back button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasBack = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return !!v.querySelector('#back-btn');
    });
    expect(hasBack).toBe(true);
  });

  test('viewer renders zoom controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasZoom = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return {
        zoomIn: !!v.querySelector('#zoom-in-btn'),
        zoomOut: !!v.querySelector('#zoom-out-btn'),
        zoomFit: !!v.querySelector('#zoom-fit-btn'),
        zoomLabel: !!v.querySelector('#zoom-label'),
      };
    });
    expect(hasZoom.zoomIn).toBe(true);
    expect(hasZoom.zoomOut).toBe(true);
    expect(hasZoom.zoomFit).toBe(true);
    expect(hasZoom.zoomLabel).toBe(true);
  });

  test('viewer renders page navigation buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasNav = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return {
        prev: !!v.querySelector('#prev-page-btn'),
        next: !!v.querySelector('#next-page-btn'),
      };
    });
    expect(hasNav.prev).toBe(true);
    expect(hasNav.next).toBe(true);
  });

  test('viewer renders title in toolbar', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasTitle = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return !!v.querySelector('#title');
    });
    expect(hasTitle).toBe(true);
  });

  test('viewer renders page list sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasList = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return !!v.querySelector('#page-list');
    });
    expect(hasList).toBe(true);
  });

  test('viewer shows loading message initially', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasLoading = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return !!v.querySelector('#empty-msg');
    });
    expect(hasLoading).toBe(true);
  });

  test('viewer renders inspect sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasInspect = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return !!v.querySelector('.penpot-viewer__inspect');
    });
    expect(hasInspect).toBe(true);
  });

  test('viewer zoom label shows 100% by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const zoomText = await page.evaluate(() => {
      const v = document.createElement('penpot-viewer');
      v.style.width = '800px';
      v.style.height = '600px';
      document.body.appendChild(v);
      return v.querySelector('#zoom-label')?.textContent || '';
    });
    expect(zoomText).toContain('100');
  });
});