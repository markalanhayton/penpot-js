import { test, expect } from '@playwright/test';

test.describe('Notification E2E', () => {

  test('notification container is created on demand', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const containerCreated = await page.evaluate(async () => {
      const { showNotification } = await import('/components/penpot-notification.js');
      showNotification('Test message', 'info', 0);
      return !!document.getElementById('penpot-notifications');
    });
    expect(containerCreated).toBe(true);
  });

  test('info notification shows message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const messageVisible = await page.evaluate(async () => {
      const { info } = await import('/components/penpot-notification.js');
      info('Info message', 0);
      const container = document.getElementById('penpot-notifications');
      return container?.textContent?.includes('Info message') || false;
    });
    expect(messageVisible).toBe(true);
  });

  test('success notification shows message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const messageVisible = await page.evaluate(async () => {
      const { success } = await import('/components/penpot-notification.js');
      success('Success message', 0);
      const container = document.getElementById('penpot-notifications');
      return container?.textContent?.includes('Success message') || false;
    });
    expect(messageVisible).toBe(true);
  });

  test('warning notification shows message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const messageVisible = await page.evaluate(async () => {
      const { warning } = await import('/components/penpot-notification.js');
      warning('Warning message', 0);
      const container = document.getElementById('penpot-notifications');
      return container?.textContent?.includes('Warning message') || false;
    });
    expect(messageVisible).toBe(true);
  });

  test('danger notification shows message', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const messageVisible = await page.evaluate(async () => {
      const { danger } = await import('/components/penpot-notification.js');
      danger('Danger message', 0);
      const container = document.getElementById('penpot-notifications');
      return container?.textContent?.includes('Danger message') || false;
    });
    expect(messageVisible).toBe(true);
  });

  test('notification has role="alert"', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasAlertRole = await page.evaluate(async () => {
      const { showNotification } = await import('/components/penpot-notification.js');
      showNotification('Alert test', 'info', 0);
      const container = document.getElementById('penpot-notifications');
      const el = container?.querySelector('[role="alert"]');
      return !!el;
    });
    expect(hasAlertRole).toBe(true);
  });

  test('dismiss removes notification', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const dismissed = await page.evaluate(async () => {
      const { showNotification, dismiss } = await import('/components/penpot-notification.js');
      const id = showNotification('Dismiss me', 'info', 0);
      const container = document.getElementById('penpot-notifications');
      const beforeCount = container?.children.length || 0;
      dismiss(id);
      return new Promise((resolve) => {
        setTimeout(() => {
          const afterCount = container?.children.length || 0;
          resolve(afterCount < beforeCount);
        }, 400);
      });
    });
    expect(dismissed).toBe(true);
  });

  test('close button exists on notification', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasCloseBtn = await page.evaluate(async () => {
      const { showNotification } = await import('/components/penpot-notification.js');
      showNotification('Close test', 'info', 0);
      const container = document.getElementById('penpot-notifications');
      const btn = container?.querySelector('button');
      return !!btn;
    });
    expect(hasCloseBtn).toBe(true);
  });

  test('close button click dismisses notification', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const dismissed = await page.evaluate(async () => {
      const { showNotification } = await import('/components/penpot-notification.js');
      showNotification('Close click test', 'info', 0);
      const container = document.getElementById('penpot-notifications');
      const btn = container?.querySelector('button');
      btn?.click();
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(container?.children.length === 0);
        }, 400);
      });
    });
    expect(dismissed).toBe(true);
  });

  test('multiple notifications can coexist', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const count = await page.evaluate(async () => {
      const { info, success, warning } = await import('/components/penpot-notification.js');
      info('First', 0);
      success('Second', 0);
      warning('Third', 0);
      const container = document.getElementById('penpot-notifications');
      return container?.children.length || 0;
    });
    expect(count).toBe(3);
  });

  test('notification styles are injected into document', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasStyles = await page.evaluate(async () => {
      const { showNotification } = await import('/components/penpot-notification.js');
      showNotification('Style test', 'info', 0);
      return !!document.getElementById('penpot-notif-styles');
    });
    expect(hasStyles).toBe(true);
  });
});