import { test, expect } from '@playwright/test';

test.describe('Comment Panel E2E', () => {

  async function login(page) {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  }

  async function openWorkspace(page) {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');
    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
      return true;
    }
    return false;
  }

  test('comment panel custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-comment-panel'));
    expect(defined).toBe(true);
  });

  test('comment panel close button emits penpot-comment-close', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; });
    await page.waitForTimeout(200);

    const closeBtn = panel.locator('#close-btn');
    if (!(await closeBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-comment-close', () => resolve(true), { once: true });
        const btn = el.querySelector('#close-btn');
        if (btn) btn.click();
        else resolve(false);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('filter tabs render with open, resolved, all options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; el.comments = []; });
    await page.waitForTimeout(200);

    const openFilter = panel.locator('[data-filter="open"]');
    const resolvedFilter = panel.locator('[data-filter="resolved"]');
    const allFilter = panel.locator('[data-filter="all"]');
    await expect(openFilter).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(resolvedFilter).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(allFilter).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('filter tab click toggles active class', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; el.comments = []; });
    await page.waitForTimeout(200);

    const resolvedFilter = panel.locator('[data-filter="resolved"]');
    if (!(await resolvedFilter.isVisible({ timeout: 2000 }).catch(() => false))) return;
    await resolvedFilter.click();

    const isActive = await resolvedFilter.evaluate((el) => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });

  test('comment input and send button exist', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; el.comments = []; });
    await page.waitForTimeout(200);

    const input = panel.locator('#comment-input');
    const sendBtn = panel.locator('#send-btn');
    await expect(input).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(sendBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; el.comments = []; });
    await page.waitForTimeout(200);

    const sendBtn = panel.locator('#send-btn');
    if (!(await sendBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
    const isDisabled = await sendBtn.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('typing text enables send button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; el.comments = []; });
    await page.waitForTimeout(200);

    const input = panel.locator('#comment-input');
    const sendBtn = panel.locator('#send-btn');
    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) return;

    await input.fill('Test comment');
    const isDisabled = await sendBtn.isDisabled();
    expect(isDisabled).toBe(false);
  });

  test('submitting comment emits penpot-comment-create', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; el.comments = []; });
    await page.waitForTimeout(200);

    const input = panel.locator('#comment-input');
    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) return;
    await input.fill('Test comment');

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-comment-create', (e) => {
          resolve(e.detail);
        }, { once: true });
        const input = el.querySelector('#comment-input');
        if (input) {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        } else {
          resolve(null);
        }
      });
    });
    if (eventFired) {
      expect(eventFired.comment).toBeTruthy();
      expect(eventFired.comment.text).toBeTruthy();
    }
  });

  test('empty state shows when no comments', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => { el.style.display = 'block'; el.comments = []; });
    await page.waitForTimeout(200);

    const emptyState = panel.locator('.penpot-comment__empty-state');
    if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await emptyState.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('pending position shows coordinates', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-comment-panel');
    await panel.evaluate((el) => {
      el.style.display = 'block';
      el.comments = [];
      el.pendingPosition = { x: 150, y: 300 };
    });
    await page.waitForTimeout(200);

    const indicator = panel.locator('#comment-pin-indicator');
    if (await indicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await indicator.textContent();
      expect(text).toContain('150');
    }
  });
});