import { test, expect } from '@playwright/test';

test.describe('Color Picker E2E', () => {

  test('penpot-color-picker custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-color-picker'));
    expect(defined).toBe(true);
  });

  test('color picker has native color input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasNativePicker = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      return !!cp.querySelector('#native-picker');
    });
    expect(hasNativePicker).toBe(true);
  });

  test('color picker has hex input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasHexInput = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      return !!cp.querySelector('#hex');
    });
    expect(hasHexInput).toBe(true);
  });

  test('color picker has opacity slider', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasOpacity = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      return !!cp.querySelector('#opacity');
    });
    expect(hasOpacity).toBe(true);
  });

  test('color picker renders palette swatches', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const swatchCount = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      return cp.querySelectorAll('.penpot-color__swatch').length;
    });
    expect(swatchCount).toBeGreaterThan(0);
  });

  test('color picker value attribute sets initial color', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hexValue = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      cp.setAttribute('value', '#ff0000');
      document.body.appendChild(cp);
      return cp.querySelector('#hex')?.value || '';
    });
    expect(hexValue).toBe('#ff0000');
  });

  test('clicking a palette swatch updates hex input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hexUpdated = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      const swatch = cp.querySelector('.penpot-color__swatch');
      if (swatch) {
        swatch.click();
      }
      const hexInput = cp.querySelector('#hex');
      return hexInput?.value?.startsWith('#') || false;
    });
    expect(hexUpdated).toBe(true);
  });

  test('opacity slider defaults to 1', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const opacityValue = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      return cp.querySelector('#opacity')?.value || '';
    });
    expect(opacityValue).toBe('1');
  });

  test('opacity value displays 100% by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const display = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      return cp.querySelector('#opacity-value')?.textContent || '';
    });
    expect(display).toBe('100%');
  });

  test('color picker has observedAttributes for value and opacity', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const observed = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      return cp.constructor?.observedAttributes || [];
    });
    expect(observed).toContain('value');
    expect(observed).toContain('opacity');
  });

  test('clicking swatch dispatches penpot-color-change event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const cp = document.createElement('penpot-color-picker');
      document.body.appendChild(cp);
      return new Promise((resolve) => {
        cp.addEventListener('penpot-color-change', () => resolve(true), { once: true });
        const swatch = cp.querySelector('.penpot-color__swatch');
        swatch?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });
});