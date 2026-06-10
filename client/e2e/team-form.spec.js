import { test, expect } from '@playwright/test';

test.describe('Team Form (WU-T3) E2E', () => {

  test('penpot-team-form custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-team-form'));
    expect(defined).toBe(true);
  });

  test('renders all required form fields: name, description, color, photo', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const fields = await page.evaluate(() => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      return {
        hasName: !!form.querySelector('#tform-name'),
        hasPhoto: !!form.querySelector('#tform-photo-input'),
        hasDescription: !!form.querySelector('#tform-description'),
        hasColor: !!form.querySelector('#tform-color-input'),
        hasColorPalette: !!form.querySelector('#tform-color-row'),
        hasSubmit: !!form.querySelector('#tform-submit'),
        hasCancel: !!form.querySelector('#tform-cancel'),
        hasTitle: !!form.querySelector('#tform-title'),
        hasPhotoPreview: !!form.querySelector('#tform-photo-preview'),
        hasCounter: !!form.querySelector('#tform-desc-counter'),
      };
    });
    expect(fields.hasName).toBe(true);
    expect(fields.hasPhoto).toBe(true);
    expect(fields.hasDescription).toBe(true);
    expect(fields.hasColor).toBe(true);
    expect(fields.hasColorPalette).toBe(true);
    expect(fields.hasSubmit).toBe(true);
    expect(fields.hasCancel).toBe(true);
    expect(fields.hasTitle).toBe(true);
    expect(fields.hasPhotoPreview).toBe(true);
    expect(fields.hasCounter).toBe(true);
  });

  test('defaults to create mode and shows "Create" submit button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const state = await page.evaluate(() => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      return {
        title: form.querySelector('#tform-title')?.textContent,
        submitText: form.querySelector('#tform-submit')?.textContent,
      };
    });
    expect(state.title).toBe('Create team');
    expect(state.submitText).toBe('Create');
  });

  test('switches to edit mode with "Save" submit button and pre-fills fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const result = await page.evaluate(() => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      form.mode = 'edit';
      form.team = {
        id: 'team-1',
        name: 'Test Team',
        features: { description: 'Existing description', color: '#abcdef' },
      };
      return {
        title: form.querySelector('#tform-title')?.textContent,
        submitText: form.querySelector('#tform-submit')?.textContent,
        nameValue: form.querySelector('#tform-name')?.value,
        descriptionValue: form.querySelector('#tform-description')?.value,
        colorValue: form.querySelector('#tform-color-input')?.value,
      };
    });
    expect(result.title).toBe('Edit team');
    expect(result.submitText).toBe('Save');
    expect(result.nameValue).toBe('Test Team');
    expect(result.descriptionValue).toBe('Existing description');
    expect(result.colorValue).toBe('#abcdef');
  });

  test('color palette has 15 swatches', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const swatchCount = await page.evaluate(() => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      return form.querySelectorAll('.penpot-tform-color-swatch').length;
    });
    expect(swatchCount).toBe(15);
  });

  test('clicking a color swatch sets the color input value', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const value = await page.evaluate(() => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      const swatch = form.querySelector('[data-color="#3b82f6"]');
      swatch?.click();
      return form.querySelector('#tform-color-input')?.value;
    });
    expect(value).toBe('#3b82f6');
  });

  test('description counter updates as user types', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const counter = await page.evaluate(() => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      const input = form.querySelector('#tform-description');
      input.value = 'Hello world';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return form.querySelector('#tform-desc-counter')?.textContent;
    });
    expect(counter).toBe('11 / 500');
  });

  test('shows error when name is empty on submit', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const error = await page.evaluate(async () => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      form.querySelector('#tform').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 50));
      const errEl = form.querySelector('#tform-error');
      return {
        visible: errEl?.style.display !== 'none',
        text: errEl?.textContent,
      };
    });
    expect(error.visible).toBe(true);
    expect(error.text).toContain('name is required');
  });

  test('shows error when color format is invalid', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const error = await page.evaluate(async () => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      form.querySelector('#tform-name').value = 'My Team';
      form.querySelector('#tform-color-input').value = 'red'; // invalid
      form.querySelector('#tform').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 50));
      const errEl = form.querySelector('#tform-error');
      return {
        visible: errEl?.style.display !== 'none',
        text: errEl?.textContent,
      };
    });
    expect(error.visible).toBe(true);
    expect(error.text).toMatch(/color/i);
  });

  test('cancel button closes the overlay', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const closed = await page.evaluate(() => {
      const form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
      form.show();
      const overlay = form.querySelector('#overlay');
      const wasVisible = overlay?.style.display === 'flex';
      form.querySelector('#tform-cancel').click();
      return { wasVisible, nowHidden: overlay?.style.display === 'none' };
    });
    expect(closed.wasVisible).toBe(true);
    expect(closed.nowHidden).toBe(true);
  });
});
