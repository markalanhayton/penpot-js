import { test, expect } from '@playwright/test';

export function registerComponentTest(tagName) {
  test(`${tagName} custom element is registered`, async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate((tag) => !!customElements.get(tag), tagName);
    expect(defined).toBe(true);
  });
}

export async function createComponent(page, tagName, props = {}) {
  return page.evaluate(({ tag, props }) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'attributes') {
        for (const [attr, attrVal] of Object.entries(value)) {
          el.setAttribute(attr, attrVal);
        }
      } else {
        el[key] = value;
      }
    }
    document.body.appendChild(el);
    return true;
  }, { tag: tagName, props });
}

export async function waitForEvent(el, eventName, timeoutMs = 2000) {
  return el.evaluate((node, { event, timeout }) => {
    return new Promise((resolve) => {
      node.addEventListener(event, () => resolve(true), { once: true });
      setTimeout(() => resolve(false), timeout);
    });
  }, { event: eventName, timeout: timeoutMs });
}