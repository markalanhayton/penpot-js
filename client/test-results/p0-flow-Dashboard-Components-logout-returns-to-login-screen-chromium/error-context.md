# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p0-flow.spec.js >> Dashboard Components >> logout returns to login screen
- Location: e2e\p0-flow.spec.js:185:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('penpot-auth-screen') to be visible

```

# Test source

```ts
  87  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  88  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  89  |       await fileCard.click();
  90  | 
  91  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  92  | 
  93  |       const backBtn = page.locator('penpot-workspace').locator('#back');
  94  |       await expect(backBtn).toBeVisible();
  95  |       await backBtn.click();
  96  | 
  97  |       await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 5000 });
  98  |     }
  99  |   });
  100 | 
  101 |   test('workspace loads file and shows pages/layers', async ({ page }) => {
  102 |     await page.goto('/');
  103 |     await page.waitForSelector('penpot-auth-screen');
  104 | 
  105 |     await page.locator('#email').fill('admin@penpot.local');
  106 |     await page.locator('#pw').fill('penpot123');
  107 |     await page.locator('#submit').click();
  108 | 
  109 |     const dashboard = page.locator('penpot-dashboard');
  110 |     await expect(dashboard).toBeVisible({ timeout: 15000 });
  111 | 
  112 |     const fileCard = dashboard.locator('.file-card[data-file-id]').first();
  113 |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  114 |       await fileCard.click();
  115 | 
  116 |       const workspace = page.locator('penpot-workspace');
  117 |       await expect(workspace).toBeVisible({ timeout: 10000 });
  118 | 
  119 |       await expect(workspace.locator('#file-name')).toBeVisible();
  120 | 
  121 |       const pageList = workspace.locator('#page-list');
  122 |       await expect(pageList).toBeVisible();
  123 | 
  124 |       const toolBtns = workspace.locator('.tool-btn');
  125 |       await expect(toolBtns.first()).toBeVisible();
  126 |     }
  127 |   });
  128 | });
  129 | 
  130 | test.describe('Auth Screen Edge Cases', () => {
  131 | 
  132 |   test('switches to recovery mode and back', async ({ page }) => {
  133 |     await page.goto('/');
  134 |     await page.waitForSelector('penpot-auth-screen');
  135 | 
  136 |     const switchLink = page.locator('#switch-link');
  137 |     await switchLink.click();
  138 |     await expect(page.locator('#title')).toHaveText('Create your account');
  139 | 
  140 |     await switchLink.click();
  141 |     await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  142 |   });
  143 | 
  144 |   test('shows validation error on empty email', async ({ page }) => {
  145 |     await page.goto('/');
  146 |     await page.waitForSelector('penpot-auth-screen');
  147 | 
  148 |     await page.locator('#submit').click();
  149 |     await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 5000 });
  150 |   });
  151 | 
  152 |   test('password visibility toggle works', async ({ page }) => {
  153 |     await page.goto('/');
  154 |     await page.waitForSelector('penpot-auth-screen');
  155 | 
  156 |     const pwInput = page.locator('#pw');
  157 |     await pwInput.fill('testpassword');
  158 |     await expect(pwInput).toHaveAttribute('type', 'password');
  159 | 
  160 |     await page.locator('#pw-toggle').click();
  161 |     await expect(pwInput).toHaveAttribute('type', 'text');
  162 | 
  163 |     await page.locator('#pw-toggle').click();
  164 |     await expect(pwInput).toHaveAttribute('type', 'password');
  165 |   });
  166 | });
  167 | 
  168 | test.describe('Dashboard Components', () => {
  169 | 
  170 |   test('team sidebar renders without errors', async ({ page }) => {
  171 |     await page.goto('/');
  172 |     await page.waitForSelector('penpot-auth-screen');
  173 | 
  174 |     await page.locator('#email').fill('admin@penpot.local');
  175 |     await page.locator('#pw').fill('penpot123');
  176 |     await page.locator('#submit').click();
  177 | 
  178 |     const dashboard = page.locator('penpot-dashboard');
  179 |     await expect(dashboard).toBeVisible({ timeout: 15000 });
  180 | 
  181 |     const teamSidebar = page.locator('penpot-team-sidebar');
  182 |     await expect(teamSidebar).toBeVisible({ timeout: 10000 });
  183 |   });
  184 | 
  185 |   test('logout returns to login screen', async ({ page }) => {
  186 |     await page.goto('/');
> 187 |     await page.waitForSelector('penpot-auth-screen');
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  188 | 
  189 |     await page.locator('#email').fill('admin@penpot.local');
  190 |     await page.locator('#pw').fill('penpot123');
  191 |     await page.locator('#submit').click();
  192 | 
  193 |     const dashboard = page.locator('penpot-dashboard');
  194 |     await expect(dashboard).toBeVisible({ timeout: 15000 });
  195 | 
  196 |     await page.locator('#logout-btn').click();
  197 | 
  198 |     await expect(page.locator('penpot-auth-screen')).toBeVisible({ timeout: 5000 });
  199 |   });
  200 | });
```