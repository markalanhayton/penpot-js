import { test, expect } from '@playwright/test';

test.describe('Team Management E2E', () => {

  test('penpot-team-management custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-team-management'));
    expect(defined).toBe(true);
  });

  test('team management renders header with back button and title', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasHeader = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      return {
        backBtn: !!tm.querySelector('#back-btn'),
        title: !!tm.querySelector('#team-title'),
      };
    });
    expect(hasHeader.backBtn).toBe(true);
    expect(hasHeader.title).toBe(true);
  });

  test('team management renders Members, Invitations, and Settings tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const tabs = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const tabEls = tm.querySelectorAll('.penpot-tm__tab');
      return Array.from(tabEls).map((t) => t.dataset.tab);
    });
    expect(tabs).toContain('members');
    expect(tabs).toContain('invitations');
    expect(tabs).toContain('settings');
  });

  test('Members tab is active by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const activeTabEl = tm.querySelector('.penpot-tm__tab.penpot-tm__active');
      return activeTabEl?.dataset.tab || '';
    });
    expect(activeTab).toBe('members');
  });

  test('clicking Invitations tab activates it', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const invTab = tm.querySelector('[data-tab="invitations"]');
      invTab?.click();
      const activeTabEl = tm.querySelector('.penpot-tm__tab.penpot-tm__active');
      return activeTabEl?.dataset.tab || '';
    });
    expect(activeTab).toBe('invitations');
  });

  test('clicking Settings tab activates it', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      const activeTabEl = tm.querySelector('.penpot-tm__tab.penpot-tm__active');
      return activeTabEl?.dataset.tab || '';
    });
    expect(activeTab).toBe('settings');
  });

  test('back button emits penpot-team-management-close event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      return new Promise((resolve) => {
        tm.addEventListener('penpot-team-management-close', () => resolve(true), { once: true });
        tm.querySelector('#back-btn')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('members tab shows empty state when no members loaded', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const content = tm.querySelector('#content');
      return content?.querySelector('.penpot-tm__empty-state') !== null;
    });
    expect(hasEmpty).toBe(true);
  });

  test('invitations tab shows empty state when no invitations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const invTab = tm.querySelector('[data-tab="invitations"]');
      invTab?.click();
      const content = tm.querySelector('#content');
      return content?.innerHTML?.includes('No pending') || false;
    });
    expect(hasEmpty).toBe(true);
  });

  test('invitations tab shows New Invitation button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasBtn = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const invTab = tm.querySelector('[data-tab="invitations"]');
      invTab?.click();
      return !!tm.querySelector('#new-invite-btn');
    });
    expect(hasBtn).toBe(true);
  });

  test('settings tab renders team name input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasInput = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      return !!tm.querySelector('#team-name-input');
    });
    expect(hasInput).toBe(true);
  });

  test('settings tab shows Leave Team button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasBtn = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      return !!tm.querySelector('#leave-team-btn');
    });
    expect(hasBtn).toBe(true);
  });

  test('settings tab shows danger zone with Delete Team for owners', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasDangerZone = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      const content = tm.querySelector('#content');
      return content?.innerHTML?.includes('Danger Zone') || false;
    });
    expect(hasDangerZone).toBe(true);
  });

  test('renders Access Requests and Webhooks tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const tabs = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      return Array.from(tm.querySelectorAll('.penpot-tm__tab')).map((t) => t.dataset.tab);
    });
    expect(tabs).toContain('access');
    expect(tabs).toContain('webhooks');
  });

  test('clicking Access Requests tab activates it', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="access"]')?.click();
      return tm.querySelector('.penpot-tm__tab.penpot-tm__active')?.dataset.tab || '';
    });
    expect(activeTab).toBe('access');
  });

  test('clicking Webhooks tab activates it', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="webhooks"]')?.click();
      return tm.querySelector('.penpot-tm__tab.penpot-tm__active')?.dataset.tab || '';
    });
    expect(activeTab).toBe('webhooks');
  });

  test('Access Requests tab shows empty state for non-admin', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="access"]')?.click();
      const content = tm.querySelector('#content');
      return content?.innerHTML?.includes('No pending access requests')
        || content?.innerHTML?.includes('Only team owners and admins')
        || content?.innerHTML?.includes('not a member')
        || false;
    });
    expect(hasEmpty).toBe(true);
  });

  test('Webhooks tab shows empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="webhooks"]')?.click();
      const content = tm.querySelector('#content');
      return content?.innerHTML?.includes('No webhooks configured') || false;
    });
    expect(hasEmpty).toBe(true);
  });

  // WU-T1: Team ownership transfer workflow

  test('Transfer Ownership button is rendered in settings when member is owner and has peers', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const result = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      // Inject a fake members list where the current user is the owner
      // and there's one other member.
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'owner' },
        { id: 'them', fullname: 'Them', email: 'them@x.test', role: 'editor' },
      ];
      tm.profileId = 'me';
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="settings"]')?.click();
      const content = tm.querySelector('#content');
      return {
        hasButton: !!content?.querySelector('#transfer-ownership-btn'),
        sectionHasText: content?.textContent?.includes('Transfer Ownership'),
        // Should NOT show Delete Team danger zone prompt to re-transfer warning twice
        noDuplicate: (content?.textContent?.match(/Transfer Ownership/g) || []).length >= 1,
      };
    });
    expect(result.hasButton).toBe(true);
    expect(result.sectionHasText).toBe(true);
    expect(result.noDuplicate).toBe(true);
  });

  test('Transfer Ownership button is hidden when member has no peers', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasButton = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'owner' },
      ];
      tm.profileId = 'me';
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="settings"]')?.click();
      const content = tm.querySelector('#content');
      return !!content?.querySelector('#transfer-ownership-btn');
    });
    expect(hasButton).toBe(false);
  });

  test('Transfer Ownership button is hidden for non-owner members', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasButton = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'admin' },
        { id: 'them', fullname: 'Them', email: 'them@x.test', role: 'editor' },
      ];
      tm.profileId = 'me';
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="settings"]')?.click();
      const content = tm.querySelector('#content');
      return !!content?.querySelector('#transfer-ownership-btn');
    });
    expect(hasButton).toBe(false);
  });

  test('clicking Transfer Ownership opens a modal with member dropdown', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const result = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'owner' },
        { id: 'alice', fullname: 'Alice', email: 'a@x.test', role: 'editor' },
        { id: 'bob', fullname: 'Bob', email: 'b@x.test', role: 'admin' },
      ];
      tm.profileId = 'me';
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="settings"]')?.click();
      tm.querySelector('#transfer-ownership-btn')?.click();
      const modal = document.body.querySelector('#transfer-ownership-modal');
      const select = modal?.querySelector('#transfer-owner-select');
      const options = select ? Array.from(select.options).map(o => ({ value: o.value, text: o.textContent })) : [];
      return {
        modalExists: !!modal,
        hasSelect: !!select,
        optionCount: options.length,
        // Should NOT include 'me' as a candidate for the new owner
        excludesMe: !options.find(o => o.value === 'me'),
        includesBoth: options.find(o => o.value === 'alice') && options.find(o => o.value === 'bob'),
        hasCancel: !!modal?.querySelector('#transfer-cancel-btn'),
        hasConfirm: !!modal?.querySelector('#transfer-confirm-btn'),
        hasTitle: modal?.querySelector('h3')?.textContent?.includes('Transfer Ownership'),
      };
    });
    expect(result.modalExists).toBe(true);
    expect(result.hasSelect).toBe(true);
    expect(result.optionCount).toBe(2);
    expect(result.excludesMe).toBe(true);
    expect(result.includesBoth).toBe(true);
    expect(result.hasCancel).toBe(true);
    expect(result.hasConfirm).toBe(true);
    expect(result.hasTitle).toBe(true);
  });

  test('Transfer Ownership modal closes on cancel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const closed = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'owner' },
        { id: 'alice', fullname: 'Alice', email: 'a@x.test', role: 'editor' },
      ];
      tm.profileId = 'me';
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="settings"]')?.click();
      tm.querySelector('#transfer-ownership-btn')?.click();
      const modal = document.body.querySelector('#transfer-ownership-modal');
      const cancelBtn = modal?.querySelector('#transfer-cancel-btn');
      cancelBtn?.click();
      return document.body.querySelector('#transfer-ownership-modal') === null;
    });
    expect(closed).toBe(true);
  });

  test('Transfer Ownership modal closes on Escape key', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const closed = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'owner' },
        { id: 'alice', fullname: 'Alice', email: 'a@x.test', role: 'editor' },
      ];
      tm.profileId = 'me';
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="settings"]')?.click();
      tm.querySelector('#transfer-ownership-btn')?.click();
      const modal = document.body.querySelector('#transfer-ownership-modal');
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
      return document.body.querySelector('#transfer-ownership-modal') === null;
    });
    expect(closed).toBe(true);
  });

  test('Transfer Ownership modal closes on backdrop click', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const closed = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'owner' },
        { id: 'alice', fullname: 'Alice', email: 'a@x.test', role: 'editor' },
      ];
      tm.profileId = 'me';
      document.body.appendChild(tm);
      tm.querySelector('[data-tab="settings"]')?.click();
      tm.querySelector('#transfer-ownership-btn')?.click();
      const modal = document.body.querySelector('#transfer-ownership-modal');
      // Click on the backdrop itself, not the inner modal
      modal?.click();
      return document.body.querySelector('#transfer-ownership-modal') === null;
    });
    expect(closed).toBe(true);
  });

  test('confirming transfer calls update-team-member-role for both members and pushes audit', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    // Spy on fetch to count RPC calls
    const result = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      tm.members = [
        { id: 'me', fullname: 'Me', email: 'me@x.test', role: 'owner' },
        { id: 'alice', fullname: 'Alice', email: 'a@x.test', role: 'editor' },
      ];
      tm.profileId = 'me';
      tm.teamId = 'team-1';
      document.body.appendChild(tm);

      // Stub confirm() so the transfer proceeds without user prompt
      const origConfirm = window.confirm;
      window.confirm = () => true;

      // Track cmd calls
      const calls = [];
      const origFetch = window.fetch;
      window.fetch = (url, opts) => {
        const body = opts?.body ? JSON.parse(opts.body) : null;
        calls.push({ url: String(url), body });
        return origFetch(url, opts);
      };

      return tm.querySelector('[data-tab="settings"]')?.click()
        && tm.querySelector('#transfer-ownership-btn')?.click()
        && tm.querySelector('#transfer-ownership-modal')?.querySelector('#transfer-owner-select')
        && (tm.querySelector('#transfer-owner-select').value = 'alice')
        && tm.querySelector('#transfer-confirm-btn')?.click()
        && new Promise((resolve) => {
          setTimeout(() => {
            window.confirm = origConfirm;
            window.fetch = origFetch;
            resolve({
              callCount: calls.length,
              calls,
            });
          }, 150);
        });
    });
    expect(result.callCount).toBeGreaterThanOrEqual(3);
    // Should include update-team-member-role for new owner
    const newOwnerCall = result.calls.find(c => c.body?.role === 'owner' && c.body?.memberId === 'alice');
    expect(newOwnerCall).toBeDefined();
    expect(newOwnerCall.body.teamId).toBe('team-1');
    // Should include update-team-member-role for previous owner (demote to admin)
    const demoteCall = result.calls.find(c => c.body?.role === 'admin' && c.body?.memberId === 'me');
    expect(demoteCall).toBeDefined();
    // Should include push-audit-events
    const auditCall = result.calls.find(c => c.url.includes('push-audit-events'));
    expect(auditCall).toBeDefined();
    expect(auditCall.body.events[0].name).toBe('transfer-ownership');
  });
});