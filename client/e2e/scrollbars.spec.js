import { test, expect } from '@playwright/test';

test.describe('Scrollbars E2E', () => {

  test('penpot-scrollbars custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-scrollbars'));
    expect(defined).toBe(true);
  });

  test('scrollbars render with vertical and horizontal tracks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const tracks = await page.evaluate(() => {
      const sb = document.createElement('penpot-scrollbars');
      document.body.appendChild(sb);
      return {
        vTrack: !!sb.querySelector('#v-track'),
        hTrack: !!sb.querySelector('#h-track'),
        vThumb: !!sb.querySelector('#v-thumb'),
        hThumb: !!sb.querySelector('#h-thumb'),
        corner: !!sb.querySelector('#corner'),
      };
    });
    expect(tracks.vTrack).toBe(true);
    expect(tracks.hTrack).toBe(true);
    expect(tracks.vThumb).toBe(true);
    expect(tracks.hThumb).toBe(true);
    expect(tracks.corner).toBe(true);
  });

  test('scrollbars are hidden when content fits viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const display = await page.evaluate(() => {
      const sb = document.createElement('penpot-scrollbars');
      sb.style.position = 'relative';
      sb.style.width = '800px';
      sb.style.height = '600px';
      document.body.appendChild(sb);
      sb.viewport = { width: 800, height: 600, zoom: 1, panX: 0, panY: 0 };
      sb.contentBounds = { width: 400, height: 300 };
      return sb.style.display;
    });
    expect(display).toBe('none');
  });

  test('vertical scrollbar appears when content exceeds viewport height', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const vTrackDisplay = await page.evaluate(() => {
      const sb = document.createElement('penpot-scrollbars');
      sb.style.position = 'relative';
      sb.style.width = '800px';
      sb.style.height = '600px';
      document.body.appendChild(sb);
      sb.viewport = { width: 800, height: 600, zoom: 1, panX: 0, panY: 0 };
      sb.contentBounds = { width: 400, height: 2000 };
      return sb.querySelector('#v-track')?.style.display || '';
    });
    expect(vTrackDisplay).not.toBe('none');
  });

  test('horizontal scrollbar appears when content exceeds viewport width', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hTrackDisplay = await page.evaluate(() => {
      const sb = document.createElement('penpot-scrollbars');
      sb.style.position = 'relative';
      sb.style.width = '800px';
      sb.style.height = '600px';
      document.body.appendChild(sb);
      sb.viewport = { width: 800, height: 600, zoom: 1, panX: 0, panY: 0 };
      sb.contentBounds = { width: 3000, height: 300 };
      return sb.querySelector('#h-track')?.style.display || '';
    });
    expect(hTrackDisplay).not.toBe('none');
  });

  test('pan setter updates scroll position and triggers render', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const thumbTop = await page.evaluate(() => {
      const sb = document.createElement('penpot-scrollbars');
      sb.style.position = 'relative';
      sb.style.width = '800px';
      sb.style.height = '600px';
      document.body.appendChild(sb);
      sb.viewport = { width: 800, height: 600, zoom: 1, panX: 0, panY: 0 };
      sb.contentBounds = { width: 2000, height: 2000 };
      sb.panX = -100;
      sb.panY = -200;
      return {
        hThumbLeft: sb.querySelector('#h-thumb')?.style.left || '0',
        vThumbTop: sb.querySelector('#v-thumb')?.style.top || '0',
      };
    });
    expect(parseFloat(thumbTop.hThumbLeft)).toBeGreaterThan(0);
    expect(parseFloat(thumbTop.vThumbTop)).toBeGreaterThan(0);
  });

  test('dragging vertical thumb emits penpot-scrollbar-pan event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const sb = document.createElement('penpot-scrollbars');
      sb.style.position = 'relative';
      sb.style.width = '800px';
      sb.style.height = '600px';
      document.body.appendChild(sb);
      sb.viewport = { width: 800, height: 600, zoom: 1, panX: 0, panY: 0 };
      sb.contentBounds = { width: 2000, height: 2000 };
      return new Promise((resolve) => {
        sb.addEventListener('penpot-scrollbar-pan', (e) => resolve(!!e.detail), true);
        const vThumb = sb.querySelector('#v-thumb');
        if (vThumb) {
          vThumb.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, bubbles: true }));
          document.dispatchEvent(new PointerEvent('pointermove', { clientY: 150, bubbles: true }));
        }
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('zoom affects scrollbar thumb sizes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const sizes = await page.evaluate(() => {
      const sb = document.createElement('penpot-scrollbars');
      sb.style.position = 'relative';
      sb.style.width = '800px';
      sb.style.height = '600px';
      document.body.appendChild(sb);
      sb.contentBounds = { width: 2000, height: 2000 };
      sb.viewport = { width: 800, height: 600, zoom: 1, panX: 0, panY: 0 };
      const thumbH1 = sb.querySelector('#v-thumb')?.style.height || '0';
      sb.viewport = { width: 800, height: 600, zoom: 2, panX: 0, panY: 0 };
      const thumbH2 = sb.querySelector('#v-thumb')?.style.height || '0';
      return { thumbH1, thumbH2 };
    });
    expect(parseFloat(sizes.thumbH1)).toBeGreaterThan(0);
    expect(parseFloat(sizes.thumbH2)).toBeGreaterThan(parseFloat(sizes.thumbH1));
  });
});