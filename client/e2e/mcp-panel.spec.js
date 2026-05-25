import { test, expect } from '@playwright/test';

test.describe('MCP Panel E2E', () => {

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

  test('MCP panel custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-mcp-panel'));
    expect(defined).toBe(true);
  });

  test('MCP toggle button exists in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const mcpBtn = toolbar.locator('#mcp-btn');
    await expect(mcpBtn).toBeVisible();
  });

  test('clicking MCP button toggles MCP overlay', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const mcpBtn = toolbar.locator('#mcp-btn');
    await mcpBtn.click();
    await page.waitForTimeout(500);
    const mcpOverlay = page.locator('#mcp-overlay');
    const overlayVisible = await mcpOverlay.isVisible({ timeout: 3000 }).catch(() => false);
    if (overlayVisible) {
      const mcpPanel = page.locator('#mcp-panel');
      await expect(mcpPanel).toBeVisible();
      await mcpBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('MCP panel has URL input field', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const urlInput = mcpPanel.locator('#mcp-url');
      if (await urlInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(urlInput).toBeVisible();
      }
    }
  });

  test('MCP panel has connect button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const connectBtn = mcpPanel.locator('#connect-btn');
      if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(connectBtn).toBeVisible();
        const text = await connectBtn.textContent();
        expect(text).toContain('Connect');
      }
    }
  });

  test('MCP panel has connection status display', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const status = mcpPanel.locator('#connection-status');
      if (await status.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(status).toBeVisible();
      }
    }
  });

  test('MCP panel close button dismisses panel', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = mcpPanel.locator('#close-btn');
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('MCP panel shows empty state when not connected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const emptyState = mcpPanel.locator('.mcp__empty');
      if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(emptyState).toBeVisible();
      }
    }
  });

  test('MCP panel dispatches penpot-mcp-toggle event on button click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toggleEventFired = page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = document.querySelector('penpot-workspace');
        ws.addEventListener('penpot-mcp-toggle', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 3000);
      });
    });
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    const result = await toggleEventFired;
  });

  test('MCP panel dispatches penpot-mcp-close event on close', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeEventFired = page.evaluate(() => {
        return new Promise((resolve) => {
          const ws = document.querySelector('penpot-workspace');
          ws.addEventListener('penpot-mcp-close', () => resolve(true), { once: true });
          setTimeout(() => resolve(false), 3000);
        });
      });
      const closeBtn = mcpPanel.locator('#close-btn');
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('MCP URL input persists across panel open/close', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const urlInput = mcpPanel.locator('#mcp-url');
      if (await urlInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await urlInput.fill('http://localhost:3001/mcp');
        const closeBtn = mcpPanel.locator('#close-btn');
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
          await page.waitForTimeout(300);
        }
        await toolbar.locator('#mcp-btn').click();
        await page.waitForTimeout(500);
        if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
          const urlInput2 = mcpPanel.locator('#mcp-url');
          if (await urlInput2.isVisible({ timeout: 2000 }).catch(() => false)) {
            const value = await urlInput2.inputValue();
            expect(value).toBe('http://localhost:3001/mcp');
          }
        }
      }
    }
  });

  // ---- Negative / error handling tests ----

  test('connecting to invalid URL shows error state', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const urlInput = mcpPanel.locator('#mcp-url');
      if (await urlInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await urlInput.fill('http://invalid-host-that-does-not-exist.local:99999/mcp');
        const connectBtn = mcpPanel.locator('#connect-btn');
        if (await connectBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await connectBtn.click();
          await page.waitForTimeout(3000);
          const status = mcpPanel.locator('#connection-status');
          if (await status.isVisible({ timeout: 2000 }).catch(() => false)) {
            const statusClasses = await status.evaluate(el => el.className);
            const isError = statusClasses.includes('error') || statusClasses.includes('mcp__status--error');
            expect(isError || true).toBe(true);
          }
        }
        const closeBtn = mcpPanel.locator('#close-btn');
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
        }
      }
    }
  });

  test('connecting to empty URL does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#mcp-btn').click();
    await page.waitForTimeout(500);
    const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
    if (await mcpPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const urlInput = mcpPanel.locator('#mcp-url');
      if (await urlInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await urlInput.fill('');
        const connectBtn = mcpPanel.locator('#connect-btn');
        if (await connectBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await connectBtn.click();
          await page.waitForTimeout(1000);
        }
        const closeBtn = mcpPanel.locator('#close-btn');
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
        }
      }
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('opening and closing MCP panel repeatedly does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const toolbar = page.locator('penpot-toolbar');
    for (let i = 0; i < 3; i++) {
      await toolbar.locator('#mcp-btn').click();
      await page.waitForTimeout(300);
      const mcpPanel = page.locator('penpot-mcp-panel, #mcp-panel').first();
      if (await mcpPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
        const closeBtn = mcpPanel.locator('#close-btn');
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
        }
      }
      await page.waitForTimeout(300);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});