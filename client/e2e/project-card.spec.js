import { test, expect } from '@playwright/test';

test.describe('Project Card E2E', () => {

  test('penpot-project-card custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-project-card'));
    expect(defined).toBe(true);
  });

  test('project card renders project name via property', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const name = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      pc.project = { name: 'Test Project', fileCount: 3 };
      return pc.querySelector('#name')?.textContent || '';
    });
    expect(name).toBe('Test Project');
  });

  test('project card renders file count in meta', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const meta = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      pc.project = { name: 'Test', fileCount: 5 };
      return pc.querySelector('#meta')?.textContent || '';
    });
    expect(meta).toContain('5 files');
  });

  test('project card renders file count as singular for 1 file', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const meta = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      pc.project = { name: 'Test', fileCount: 1 };
      return pc.querySelector('#meta')?.textContent || '';
    });
    expect(meta).toContain('1 file');
    expect(meta).not.toContain('1 files');
  });

  test('project card has rename and delete buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasRename = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      return {
        rename: !!pc.querySelector('#rename-btn'),
        delete: !!pc.querySelector('#delete-btn'),
      };
    });
    expect(hasRename.rename).toBe(true);
    expect(hasRename.delete).toBe(true);
  });

  test('project card has menu button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasMenu = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      return !!pc.querySelector('#menu-btn');
    });
    expect(hasMenu).toBe(true);
  });

  test('clicking card body emits penpot-project-open event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      pc.project = { name: 'Test', fileCount: 1 };
      return new Promise((resolve) => {
        pc.addEventListener('penpot-project-open', () => resolve(true), { once: true });
        pc.querySelector('#card')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('clicking rename button emits penpot-project-rename event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      pc.project = { name: 'Test', fileCount: 1 };
      return new Promise((resolve) => {
        pc.addEventListener('penpot-project-rename', () => resolve(true), { once: true });
        pc.querySelector('#rename-btn')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('clicking delete button emits penpot-project-delete event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      document.body.appendChild(pc);
      pc.project = { name: 'Test', fileCount: 1 };
      return new Promise((resolve) => {
        pc.addEventListener('penpot-project-delete', () => resolve(true), { once: true });
        pc.querySelector('#delete-btn')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('project name and file-count attributes work', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const result = await page.evaluate(() => {
      const pc = document.createElement('penpot-project-card');
      pc.setAttribute('project-name', 'Attr Project');
      pc.setAttribute('file-count', '7');
      document.body.appendChild(pc);
      return {
        name: pc.querySelector('#name')?.textContent || '',
        meta: pc.querySelector('#meta')?.textContent || '',
      };
    });
    expect(result.name).toBe('Attr Project');
    expect(result.meta).toContain('7 files');
  });
});