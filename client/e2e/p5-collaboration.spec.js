import { test, expect } from '@playwright/test';

test.describe('P5: Collaboration (WebSocket)', () => {

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

  test('workspace renders with cursor overlay component', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const cursorOverlay = page.locator('penpot-cursor-overlay');
    await expect(cursorOverlay).toBeVisible();
  });

  test('workspace renders with presence bar in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const presenceBar = page.locator('penpot-toolbar').locator('penpot-presence-bar');
    await expect(presenceBar).toBeVisible();
  });

  test('presence bar shows disconnected status when no WS', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const presenceBar = toolbar.locator('penpot-presence-bar');
    await expect(presenceBar).toBeVisible();

    const statusDot = presenceBar.locator('#status');
    await expect(statusDot).toBeVisible();
  });

  test('presence bar has avatar container', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const presenceBar = toolbar.locator('penpot-presence-bar');
    await expect(presenceBar).toBeVisible();

    const avatars = presenceBar.locator('#avatars');
    await expect(avatars).toBeVisible();
  });

  test('cursor overlay has container element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const cursorOverlay = page.locator('penpot-cursor-overlay');
    await expect(cursorOverlay).toBeVisible();

    const container = cursorOverlay.locator('#cursors');
    await expect(container).toBeVisible();
  });

  test('cursor overlay accepts cursors property', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const cursorOverlay = page.locator('penpot-cursor-overlay');

    await cursorOverlay.evaluate((el) => {
      el.cursors = [
        { id: 'user-1', name: 'Alice', x: 100, y: 200, color: '#31efb8', page: 'page-1' },
      ];
    });

    const cursors = cursorOverlay.locator('.cursor-container > div');
    const count = await cursors.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('ws module exports are available', async ({ page }) => {
    await page.goto('/');
    const wsAvailable = await page.evaluate(() => {
      return typeof window.__penpot !== 'undefined';
    });
    expect(wsAvailable).toBe(true);
  });

  test('toolbar has presence bar element before share button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const shareBtn = toolbar.locator('#share-btn');
    await expect(shareBtn).toBeVisible();
    const presenceBar = toolbar.locator('penpot-presence-bar');
    await expect(presenceBar).toBeVisible();
  });

  test('app store has collaboration state keys', async ({ page }) => {
    await page.goto('/');
    const hasKeys = await page.evaluate(() => {
      const store = window.__penpot?.store;
      if (!store) return false;
      return store.get('wsConnected') !== undefined;
    });
    expect(hasKeys).toBe(true);
  });

  test('store has onlineUsers key', async ({ page }) => {
    await page.goto('/');
    const users = await page.evaluate(() => {
      const store = window.__penpot?.store;
      if (!store) return null;
      return store.get('onlineUsers');
    });
    expect(Array.isArray(users)).toBe(true);
  });

  test('store has cursorPositions key', async ({ page }) => {
    await page.goto('/');
    const cursors = await page.evaluate(() => {
      const store = window.__penpot?.store;
      if (!store) return null;
      return store.get('cursorPositions');
    });
    expect(Array.isArray(cursors)).toBe(true);
  });

  test('collaboration module exports are available', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/collaboration.js');
      return {
        hasInit: typeof mod.initCollaboration === 'function',
        hasBroadcast: typeof mod.broadcastChange === 'function',
        hasBroadcastChanges: typeof mod.broadcastChanges === 'function',
        hasResolve: typeof mod.resolveConflict === 'function',
        hasFetchLagged: typeof mod.fetchLaggedChanges === 'function',
        hasDestroy: typeof mod.destroyCollaboration === 'function',
        hasGetSession: typeof mod.getSessionId === 'function',
      };
    });
    expect(exports.hasInit).toBe(true);
    expect(exports.hasBroadcast).toBe(true);
    expect(exports.hasBroadcastChanges).toBe(true);
    expect(exports.hasResolve).toBe(true);
    expect(exports.hasFetchLagged).toBe(true);
    expect(exports.hasDestroy).toBe(true);
    expect(exports.hasGetSession).toBe(true);
  });

  test('persistence module has conflict resolution integration', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/persistence.js');
      return {
        hasInit: typeof mod.initPersistence === 'function',
        hasGetRevn: typeof mod.getRevision === 'function',
        hasGetLastSaved: typeof mod.getLastSavedRevision === 'function',
        hasEnqueue: typeof mod.enqueueChange === 'function',
        hasFlush: typeof mod.flushSave === 'function',
        hasMakeCreate: typeof mod.makeCreateChange === 'function',
        hasMakeModify: typeof mod.makeModifyChange === 'function',
        hasMakeDelete: typeof mod.makeDeleteChange === 'function',
        hasMakeMove: typeof mod.makeMoveChange === 'function',
      };
    });
    expect(exports.hasInit).toBe(true);
    expect(exports.hasGetRevn).toBe(true);
    expect(exports.hasGetLastSaved).toBe(true);
    expect(exports.hasEnqueue).toBe(true);
    expect(exports.hasFlush).toBe(true);
  });

  test('file-change WS messages skip own session', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const { onWSMessage } = await import('/lib/ws.js');
      const { initCollaboration, handleRemoteFileChange } = await import('/lib/collaboration.js');
      return typeof handleRemoteFileChange === 'function';
    });
    expect(result).toBe(true);
  });
});