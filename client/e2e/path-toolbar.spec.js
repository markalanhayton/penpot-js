import { test, expect } from '@playwright/test';

test.describe('Path Toolbar E2E', () => {

  test('penpot-path-toolbar custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-path-toolbar'));
    expect(defined).toBe(true);
  });

  test('renders move and draw mode buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const buttons = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      const btns = tb.querySelectorAll('.penpot-path-toolbar__btn[data-action]');
      return Array.from(btns).map((b) => b.dataset.action);
    });
    expect(buttons).toContain('move');
    expect(buttons).toContain('draw');
  });

  test('move button is active by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const isActive = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      const moveBtn = tb.querySelector('[data-action="move"]');
      return moveBtn?.classList.contains('active') || false;
    });
    expect(isActive).toBe(true);
  });

  test('draw button becomes active when state set to draw', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const isActive = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      tb.state = { editMode: 'draw', selectedCount: 0, snapToggled: false };
      const drawBtn = tb.querySelector('[data-action="draw"]');
      const moveBtn = tb.querySelector('[data-action="move"]');
      return {
        drawActive: drawBtn?.classList.contains('active') || false,
        moveActive: moveBtn?.classList.contains('active') || false,
      };
    });
    expect(isActive.drawActive).toBe(true);
    expect(isActive.moveActive).toBe(false);
  });

  test('add-node and remove-node buttons are disabled when selectedCount is 0', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const disabled = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      const addBtn = tb.querySelector('[data-action="add-node"]');
      const removeBtn = tb.querySelector('[data-action="remove-node"]');
      return { addDisabled: addBtn?.disabled || false, removeDisabled: removeBtn?.disabled || false };
    });
    expect(disabled.addDisabled).toBe(true);
    expect(disabled.removeDisabled).toBe(true);
  });

  test('add-node and remove-node buttons are enabled when selectedCount > 0', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const disabled = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      tb.state = { editMode: 'move', selectedCount: 1, snapToggled: false };
      const addBtn = tb.querySelector('[data-action="add-node"]');
      const removeBtn = tb.querySelector('[data-action="remove-node"]');
      return { addDisabled: addBtn?.disabled || false, removeDisabled: removeBtn?.disabled || false };
    });
    expect(disabled.addDisabled).toBe(false);
    expect(disabled.removeDisabled).toBe(false);
  });

  test('merge-nodes and join-nodes require selectedCount >= 2', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const disabled = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      tb.state = { editMode: 'move', selectedCount: 1, snapToggled: false };
      const mergeBtn = tb.querySelector('[data-action="merge-nodes"]');
      const joinBtn = tb.querySelector('[data-action="join-nodes"]');
      return { mergeDisabled: mergeBtn?.disabled || false, joinDisabled: joinBtn?.disabled || false };
    });
    expect(disabled.mergeDisabled).toBe(true);
    expect(disabled.joinDisabled).toBe(true);
  });

  test('merge-nodes and join-nodes are enabled when selectedCount >= 2', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const disabled = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      tb.state = { editMode: 'move', selectedCount: 2, snapToggled: false };
      const mergeBtn = tb.querySelector('[data-action="merge-nodes"]');
      const joinBtn = tb.querySelector('[data-action="join-nodes"]');
      return { mergeDisabled: mergeBtn?.disabled || false, joinDisabled: joinBtn?.disabled || false };
    });
    expect(disabled.mergeDisabled).toBe(false);
    expect(disabled.joinDisabled).toBe(false);
  });

  test('snap toggle button reflects snapToggled state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const isActive = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      tb.state = { editMode: 'move', selectedCount: 0, snapToggled: true };
      const snapBtn = tb.querySelector('[data-action="toggle-snap"]');
      return snapBtn?.classList.contains('active') || false;
    });
    expect(isActive).toBe(true);
  });

  test('clicking a button dispatches penpot-path-action event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const action = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      return new Promise((resolve) => {
        tb.addEventListener('penpot-path-action', (e) => resolve(e.detail.action), true);
        const moveBtn = tb.querySelector('[data-action="move"]');
        moveBtn?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(action).toBe('move');
  });

  test('clicking draw button dispatches draw action', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const action = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      return new Promise((resolve) => {
        tb.addEventListener('penpot-path-action', (e) => resolve(e.detail.action), true);
        const drawBtn = tb.querySelector('[data-action="draw"]');
        drawBtn?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(action).toBe('draw');
  });

  test('renders separator elements between button groups', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const sepCount = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      return tb.querySelectorAll('.penpot-path-toolbar__sep').length;
    });
    expect(sepCount).toBeGreaterThanOrEqual(3);
  });

  test('toggle-snap button click dispatches toggle-snap action', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const action = await page.evaluate(() => {
      const tb = document.createElement('penpot-path-toolbar');
      document.body.appendChild(tb);
      return new Promise((resolve) => {
        tb.addEventListener('penpot-path-action', (e) => resolve(e.detail.action), true);
        const snapBtn = tb.querySelector('[data-action="toggle-snap"]');
        snapBtn?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(action).toBe('toggle-snap');
  });
});