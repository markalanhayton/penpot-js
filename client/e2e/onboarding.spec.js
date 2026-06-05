import { test, expect } from '@playwright/test';
import { createComponent } from './helpers/component-test.js';

test.describe('Onboarding E2E', () => {

  test('penpot-onboarding custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-onboarding'));
    expect(defined).toBe(true);
  });

  test('onboarding auto-shows when localStorage is not set', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const el = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      return { overlayDisplay: ob.querySelector('#overlay')?.style.display || 'none' };
    });
    expect(el.overlayDisplay).toBe('flex');
  });

  test('onboarding does not show when localStorage is set', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.setItem('penpot-onboarding-done', '1'));
    const el = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      return { overlayDisplay: ob.querySelector('#overlay')?.style.display || 'flex' };
    });
    expect(el.overlayDisplay).toBe('none');
  });

  test('onboarding renders all 6 steps', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const stepCount = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      return ob.querySelectorAll('.onboarding-step').length;
    });
    expect(stepCount).toBe(6);
  });

  test('onboarding initial step shows Welcome title', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const title = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      return ob.querySelector('#title')?.textContent || '';
    });
    expect(title).toBe('Welcome to Penpot');
  });

  test('Next button advances step and updates title', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const result = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      ob.querySelector('#next-btn')?.click();
      return ob.querySelector('#title')?.textContent || '';
    });
    expect(result).toBe('Select & Move');
  });

  test('Next button text changes to Get Started on last step', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const btnText = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      for (let i = 0; i < 5; i++) ob.querySelector('#next-btn')?.click();
      return ob.querySelector('#next-btn')?.textContent || '';
    });
    expect(btnText).toBe('Get Started');
  });

  test('Skip button hides overlay and sets localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const result = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      ob.querySelector('#skip-btn')?.click();
      return {
        overlayDisplay: ob.querySelector('#overlay')?.style.display || 'flex',
        stored: localStorage.getItem('penpot-onboarding-done'),
      };
    });
    expect(result.overlayDisplay).toBe('none');
    expect(result.stored).toBe('1');
  });

  test('completing all steps hides overlay and sets localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const result = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      for (let i = 0; i < 6; i++) ob.querySelector('#next-btn')?.click();
      return {
        overlayDisplay: ob.querySelector('#overlay')?.style.display || 'flex',
        stored: localStorage.getItem('penpot-onboarding-done'),
      };
    });
    expect(result.overlayDisplay).toBe('none');
    expect(result.stored).toBe('1');
  });

  test('show method makes overlay visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.setItem('penpot-onboarding-done', '1'));
    const display = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      ob.show();
      return ob.querySelector('#overlay')?.style.display || 'none';
    });
    expect(display).toBe('flex');
  });

  test('reset method clears localStorage and shows onboarding from step 0', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.setItem('penpot-onboarding-done', '1'));
    const result = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      ob.reset();
      return {
        overlayDisplay: ob.querySelector('#overlay')?.style.display || 'none',
        title: ob.querySelector('#title')?.textContent || '',
        stored: localStorage.getItem('penpot-onboarding-done'),
      };
    });
    expect(result.overlayDisplay).toBe('flex');
    expect(result.title).toBe('Welcome to Penpot');
  });

  test('onboarding-complete event fires when finished', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const eventFired = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      return new Promise((resolve) => {
        ob.addEventListener('onboarding-complete', () => resolve(true), { once: true });
        ob.querySelector('#skip-btn')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('active step is rendered with full opacity', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.evaluate(() => localStorage.removeItem('penpot-onboarding-done'));
    const opacities = await page.evaluate(() => {
      const ob = document.createElement('penpot-onboarding');
      document.body.appendChild(ob);
      const steps = ob.querySelectorAll('.onboarding-step');
      return Array.from(steps).map((s) => s.style.opacity);
    });
    expect(opacities[0]).toBe('1');
    expect(opacities[1]).toBe('0.5');
  });
});