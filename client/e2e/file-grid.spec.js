import { test, expect } from '@playwright/test';

test.describe('File Grid E2E', () => {

  test('penpot-file-grid custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-file-grid'));
    expect(defined).toBe(true);
  });

  test('file grid renders container element', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasContainer = await page.evaluate(() => {
      const fg = document.createElement('penpot-file-grid');
      document.body.appendChild(fg);
      return !!fg.querySelector('#container');
    });
    expect(hasContainer).toBe(true);
  });

  test('file grid shows new file card when empty', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasNewFileCard = await page.evaluate(() => {
      const fg = document.createElement('penpot-file-grid');
      document.body.appendChild(fg);
      fg.renderFiles();
      return !!fg.querySelector('#new-file-card');
    });
    expect(hasNewFileCard).toBe(true);
  });

  test('new file card emits penpot-create-file event on click', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const fg = document.createElement('penpot-file-grid');
      document.body.appendChild(fg);
      fg.renderFiles();
      return new Promise((resolve) => {
        fg.addEventListener('penpot-create-file', () => resolve(true), { once: true });
        fg.querySelector('#new-file-card')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('file grid renders file cards when files are provided', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const fileCardCount = await page.evaluate(() => {
      const fg = document.createElement('penpot-file-grid');
      document.body.appendChild(fg);
      fg.files = [
        { id: 'f1', name: 'Test File 1', modifiedAt: new Date().toISOString() },
        { id: 'f2', name: 'Test File 2', modifiedAt: new Date().toISOString() },
      ];
      fg.renderFiles();
      return fg.querySelectorAll('.penpot-fgrid__file-card[data-file-id]').length;
    });
    expect(fileCardCount).toBe(2);
  });

  test('project-id attribute triggers file loading', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const observesAttr = await page.evaluate(() => {
      const fg = document.createElement('penpot-file-grid');
      document.body.appendChild(fg);
      const observed = PenpotFileGrid?.observedAttributes || fg.constructor?.observedAttributes || [];
      return observed.includes('project-id');
    });
    expect(observesAttr).toBe(true);
  });

  test('file grid renders new file card alongside existing files', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasNewCardAndFiles = await page.evaluate(() => {
      const fg = document.createElement('penpot-file-grid');
      document.body.appendChild(fg);
      fg.files = [{ id: 'f1', name: 'File', modifiedAt: new Date().toISOString() }];
      fg.renderFiles();
      return {
        newCard: !!fg.querySelector('#new-file-card'),
        fileCards: fg.querySelectorAll('.penpot-fgrid__file-card[data-file-id]').length,
      };
    });
    expect(hasNewCardAndFiles.newCard).toBe(true);
    expect(hasNewCardAndFiles.fileCards).toBe(1);
  });

  test('clicking file card emits penpot-open-file event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventDetail = await page.evaluate(() => {
      const fg = document.createElement('penpot-file-grid');
      document.body.appendChild(fg);
      fg.files = [{ id: 'f1', name: 'File', modifiedAt: new Date().toISOString() }];
      fg.renderFiles();
      return new Promise((resolve) => {
        fg.addEventListener('penpot-open-file', (e) => resolve(e.detail), { once: true });
        const fileCard = fg.querySelector('.penpot-fgrid__file-card[data-file-id]');
        fileCard?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(eventDetail?.fileId).toBe('f1');
  });
});