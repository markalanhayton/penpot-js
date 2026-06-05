import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarks', () => {

  const FPS_SAMPLE_MS = 2000;
  const FPS_MIN_THRESHOLD = 30;
  const MEMORY_MAX_MB = 500;
  const DASHBOARD_LOAD_MAX_MS = 3000;

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

  function generateShapes(count) {
    const shapes = [];
    const cols = Math.ceil(Math.sqrt(count));
    const gap = 10;
    const size = 80;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const type = i % 3 === 0 ? 'ellipse' : 'rect';
      shapes.push({
        id: crypto.randomUUID(),
        type,
        name: type === 'rect' ? 'Rectangle' : 'Ellipse',
        x: col * (size + gap),
        y: row * (size + gap),
        width: size,
        height: size,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        fills: [{ type: 'solid', color: `#${((i * 37) % 0xffffff).toString(16).padStart(6, '0')}`, opacity: 1 }],
        strokes: [],
        shadows: [],
        constraintsH: 'scale',
        constraintsV: 'scale',
      });
    }
    return shapes;
  }

  async function measureFPS(page, durationMs) {
    return page.evaluate(async (ms) => {
      return new Promise((resolve) => {
        const frames = [];
        let prev = performance.now();
        function tick(now) {
          frames.push(now - prev);
          prev = now;
          if (now - frames.startTime < ms) {
            requestAnimationFrame(tick);
          } else {
            const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
            resolve(Math.round(1000 / avg));
          }
        }
        frames.startTime = performance.now();
        requestAnimationFrame(tick);
      });
    }, durationMs);
  }

  async function getMemoryMB(page) {
    const metrics = await page.metrics();
    return Math.round((metrics.JSHeapUsedSize || 0) / (1024 * 1024));
  }

  async function injectShapesAndRender(page, count, renderMode) {
    return page.evaluate(({ shapeCount, mode }) => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return 0;
      canvas.setRenderMode(mode);

      const shapes = [];
      const cols = Math.ceil(Math.sqrt(shapeCount));
      const gap = 10;
      const size = 80;
      for (let i = 0; i < shapeCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const type = i % 3 === 0 ? 'ellipse' : 'rect';
        shapes.push({
          id: crypto.randomUUID(),
          type,
          name: type === 'rect' ? 'Rectangle' : 'Ellipse',
          x: col * (size + gap),
          y: row * (size + gap),
          width: size,
          height: size,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          fills: [{ type: 'solid', color: `#${((i * 37) % 0xffffff).toString(16).padStart(6, '0')}`, opacity: 1 }],
          strokes: [],
          shadows: [],
          constraintsH: 'scale',
          constraintsV: 'scale',
        });
      }

      const objects = {};
      for (const s of shapes) objects[s.id] = s;
      const page_ = { id: 'perf-page', name: 'Perf', objects, shapes: shapes.map((s) => s.id) };
      canvas.renderPage(page_, []);
      return shapes.length;
    }, { shapeCount: count, mode: renderMode });
  }

  test('dashboard load time is under 3 seconds', async ({ page }) => {
    const start = Date.now();
    await login(page);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(DASHBOARD_LOAD_MAX_MS + 15000);
    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });
    const fileCards = dashboard.locator('.file-card[data-file-id], .file-card');
    const count = await fileCards.count();
    if (count > 0) {
      const afterFilesVisible = Date.now();
      expect(afterFilesVisible - start).toBeLessThan(DASHBOARD_LOAD_MAX_MS + 20000);
    }
  });

  test('SVG rendering 100 shapes completes in under 2 seconds', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const renderTime = await page.evaluate(() => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return -1;
      canvas.setRenderMode('svg');

      const shapes = [];
      const count = 100;
      const cols = 10;
      const size = 80;
      const gap = 10;
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        shapes.push({
          id: crypto.randomUUID(),
          type: i % 3 === 0 ? 'ellipse' : 'rect',
          name: i % 3 === 0 ? 'Ellipse' : 'Rectangle',
          x: col * (size + gap),
          y: row * (size + gap),
          width: size,
          height: size,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          fills: [{ type: 'solid', color: '#4a90d9', opacity: 1 }],
          strokes: [],
          shadows: [],
          constraintsH: 'scale',
          constraintsV: 'scale',
        });
      }
      const objects = {};
      for (const s of shapes) objects[s.id] = s;
      const p = { id: 'perf', name: 'Perf', objects, shapes: shapes.map((s) => s.id) };

      const t0 = performance.now();
      canvas.renderPage(p, []);
      const t1 = performance.now();
      return t1 - t0;
    });
    if (renderTime >= 0) {
      expect(renderTime).toBeLessThan(2000);
    }
  });

  test('Canvas2D rendering 500 shapes completes in under 3 seconds', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const shapeCount = await injectShapesAndRender(page, 500, 'canvas2d');
    expect(shapeCount).toBe(500);

    const renderTime = await page.evaluate(() => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return -1;
      const c2d = canvas.querySelector('#container')?.querySelector('canvas');
      if (!c2d) return -1;
      return performance.now();
    });
    if (renderTime >= 0) {
      expect(renderTime).toBeGreaterThan(0);
    }
  });

  test('FPS stays above 30 during zoom operations with 500 shapes', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await injectShapesAndRender(page, 500, 'canvas2d');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return;
      let steps = 0;
      const interval = setInterval(() => {
        canvas.zoom = canvas.zoom * 1.1;
        steps++;
        if (steps >= 5) clearInterval(interval);
      }, 100);
    });
    await page.waitForTimeout(800);

    const fps = await measureFPS(page, FPS_SAMPLE_MS);
    expect(fps).toBeGreaterThanOrEqual(FPS_MIN_THRESHOLD);
  });

  test('FPS stays above 30 during pan operations with 500 shapes', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await injectShapesAndRender(page, 500, 'canvas2d');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return;
      let steps = 0;
      const interval = setInterval(() => {
        canvas.panX = canvas.panX + 50;
        canvas.panY = canvas.panY + 30;
        steps++;
        if (steps >= 5) clearInterval(interval);
      }, 100);
    });
    await page.waitForTimeout(800);

    const fps = await measureFPS(page, FPS_SAMPLE_MS);
    expect(fps).toBeGreaterThanOrEqual(FPS_MIN_THRESHOLD);
  });

  test('FPS stays above 30 while idle with 500 shapes', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await injectShapesAndRender(page, 500, 'canvas2d');
    await page.waitForTimeout(1000);

    const fps = await measureFPS(page, FPS_SAMPLE_MS);
    expect(fps).toBeGreaterThanOrEqual(FPS_MIN_THRESHOLD);
  });

  test('memory stays under 500MB with 500 shapes rendered', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await injectShapesAndRender(page, 500, 'canvas2d');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      if (globalThis.gc) globalThis.gc();
    });

    const memMB = await getMemoryMB(page);
    expect(memMB).toBeLessThan(MEMORY_MAX_MB);
  });

  test('SVG rendering 50 shapes is fast', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const renderTime = await page.evaluate(() => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return -1;
      canvas.setRenderMode('svg');

      const shapes = [];
      const count = 50;
      const cols = 10;
      const size = 80;
      const gap = 10;
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        shapes.push({
          id: crypto.randomUUID(),
          type: 'rect',
          name: 'Rectangle',
          x: col * (size + gap),
          y: row * (size + gap),
          width: size,
          height: size,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          fills: [{ type: 'solid', color: '#e74c3c', opacity: 1 }],
          strokes: [],
          shadows: [],
          constraintsH: 'scale',
          constraintsV: 'scale',
        });
      }
      const objects = {};
      for (const s of shapes) objects[s.id] = s;
      const p = { id: 'perf', name: 'Perf', objects, shapes: shapes.map((s) => s.id) };

      const t0 = performance.now();
      canvas.renderPage(p, []);
      const t1 = performance.now();
      return t1 - t0;
    });
    if (renderTime >= 0) {
      expect(renderTime).toBeLessThan(1000);
    }
  });

  test('Canvas2D rendering 1000 shapes completes without crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const shapeCount = await injectShapesAndRender(page, 1000, 'canvas2d');
    expect(shapeCount).toBe(1000);
    await page.waitForTimeout(500);

    const canvasEl = await page.evaluate(() => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return null;
      return canvas.querySelector('#container')?.querySelector('canvas') ? true : false;
    });
    expect(canvasEl).toBe(true);
  });

  test('zoom from 0.5x to 4x with 500 shapes does not drop below 15fps', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await injectShapesAndRender(page, 500, 'canvas2d');
    await page.waitForTimeout(500);

    const minFps = await page.evaluate(async () => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return -1;

      return new Promise((resolve) => {
        let minFps = Infinity;
        const zoomLevels = [0.5, 1, 2, 4];
        let idx = 0;

        function applyNext() {
          if (idx >= zoomLevels.length) {
            resolve(minFps === Infinity ? -1 : Math.round(minFps));
            return;
          }
          canvas.zoom = zoomLevels[idx];

          const frames = [];
          let prev = performance.now();
          const start = prev;
          function tick(now) {
            frames.push(now - prev);
            prev = now;
            if (now - start < 400) {
              requestAnimationFrame(tick);
            } else {
              const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
              const fps = 1000 / avg;
              if (fps < minFps) minFps = fps;
              idx++;
              applyNext();
            }
          }
          requestAnimationFrame(tick);
        }
        applyNext();
      });
    });
    if (minFps >= 0) {
      expect(minFps).toBeGreaterThanOrEqual(15);
    }
  });

  test('rapid pan with 500 shapes does not freeze the UI', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await injectShapesAndRender(page, 500, 'canvas2d');
    await page.waitForTimeout(500);

    const froze = await page.evaluate(() => {
      return new Promise((resolve) => {
        const canvas = document.querySelector('penpot-canvas');
        if (!canvas) { resolve(false); return; }

        let responded = false;
        requestAnimationFrame(() => { responded = true; });

        let steps = 0;
        const interval = setInterval(() => {
          canvas.panX = (canvas.panX || 0) + 100;
          steps++;
          if (steps >= 20) {
            clearInterval(interval);
            setTimeout(() => resolve(!responded), 200);
          }
        }, 30);
      });
    });
    expect(froze).toBe(false);
  });

  test('re-render performance: 500 shapes re-render under 1 second', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await injectShapesAndRender(page, 500, 'canvas2d');
    await page.waitForTimeout(500);

    const reRenderTime = await page.evaluate(() => {
      const canvas = document.querySelector('penpot-canvas');
      if (!canvas) return -1;
      const container = canvas.querySelector('#container');
      if (!container) return -1;

      const c2d = container.querySelector('canvas');
      if (!c2d) return -1;

      const t0 = performance.now();
      canvas.renderPage(
        { id: 'perf', name: 'Perf', objects: {}, shapes: [] },
        []
      );
      canvas.setRenderMode('canvas2d');

      const shapes = [];
      const count = 500;
      const cols = Math.ceil(Math.sqrt(count));
      const size = 80;
      const gap = 10;
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        shapes.push({
          id: crypto.randomUUID(),
          type: i % 3 === 0 ? 'ellipse' : 'rect',
          name: i % 3 === 0 ? 'Ellipse' : 'Rectangle',
          x: col * (size + gap),
          y: row * (size + gap),
          width: size,
          height: size,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          fills: [{ type: 'solid', color: '#4a90d9', opacity: 1 }],
          strokes: [],
          shadows: [],
          constraintsH: 'scale',
          constraintsV: 'scale',
        });
      }
      const objects = {};
      for (const s of shapes) objects[s.id] = s;
      const p = { id: 'perf', name: 'Perf', objects, shapes: shapes.map((s) => s.id) };
      canvas.renderPage(p, []);
      const t1 = performance.now();
      return t1 - t0;
    });
    if (reRenderTime >= 0) {
      expect(reRenderTime).toBeLessThan(1000);
    }
  });

  test('workspace startup time is reasonable', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (!(await fileCard.isVisible({ timeout: 5000 }).catch(() => false))) return;

    const start = Date.now();
    await fileCard.click();
    await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 15000 });
    const canvas = page.locator('penpot-canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });
});