# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p0-flow.spec.js >> Full P0 Flow: Login → Dashboard → Create File → Workspace >> workspace loads file and shows pages/layers
- Location: e2e\p0-flow.spec.js:101:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('penpot-auth-screen') to be visible

```

# Test source

```ts
  3   | test.describe('Full P0 Flow: Login → Dashboard → Create File → Workspace', () => {
  4   | 
  5   |   test('login and see dashboard', async ({ page }) => {
  6   |     await page.goto('/');
  7   |     await page.waitForSelector('penpot-auth-screen');
  8   |     await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  9   | 
  10  |     await page.locator('#email').fill('admin@penpot.local');
  11  |     await page.locator('#pw').fill('penpot123');
  12  |     await page.locator('#submit').click();
  13  | 
  14  |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  15  |   });
  16  | 
  17  |   test('login → dashboard shows team sidebar and projects', async ({ page }) => {
  18  |     await page.goto('/');
  19  |     await page.waitForSelector('penpot-auth-screen');
  20  | 
  21  |     await page.locator('#email').fill('admin@penpot.local');
  22  |     await page.locator('#pw').fill('penpot123');
  23  |     await page.locator('#submit').click();
  24  | 
  25  |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  26  | 
  27  |     const teamSidebar = page.locator('penpot-dashboard').locator('penpot-team-sidebar');
  28  |     await expect(teamSidebar).toBeVisible({ timeout: 10000 });
  29  | 
  30  |     const teams = teamSidebar.locator('.penpot-team__team-item');
  31  |     await expect(teams.first()).toBeVisible({ timeout: 5000 });
  32  |   });
  33  | 
  34  |   test('login → click project → see files', async ({ page }) => {
  35  |     await page.goto('/');
  36  |     await page.waitForSelector('penpot-auth-screen');
  37  | 
  38  |     await page.locator('#email').fill('admin@penpot.local');
  39  |     await page.locator('#pw').fill('penpot123');
  40  |     await page.locator('#submit').click();
  41  | 
  42  |     const dashboard = page.locator('penpot-dashboard');
  43  |     await expect(dashboard).toBeVisible({ timeout: 15000 });
  44  | 
  45  |     const projectCard = dashboard.locator('.project-card').first();
  46  |     if (await projectCard.isVisible({ timeout: 5000 })) {
  47  |       await projectCard.click();
  48  | 
  49  |       const fileCard = dashboard.locator('.file-card').first();
  50  |       await expect(fileCard).toBeVisible({ timeout: 5000 });
  51  |     }
  52  |   });
  53  | 
  54  |   test('login → create file → enter workspace', async ({ page }) => {
  55  |     await page.goto('/');
  56  |     await page.waitForSelector('penpot-auth-screen');
  57  | 
  58  |     await page.locator('#email').fill('admin@penpot.local');
  59  |     await page.locator('#pw').fill('penpot123');
  60  |     await page.locator('#submit').click();
  61  | 
  62  |     const dashboard = page.locator('penpot-dashboard');
  63  |     await expect(dashboard).toBeVisible({ timeout: 15000 });
  64  | 
  65  |     const newFileBtn = dashboard.locator('#new-file-btn, .new-file, .file-new, .file-card').first();
  66  |     if (await newFileBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  67  |       await newFileBtn.click();
  68  | 
  69  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 15000 });
  70  | 
  71  |       const fileName = page.locator('penpot-workspace').locator('#file-name');
  72  |       await expect(fileName).toBeVisible();
  73  |     }
  74  |   });
  75  | 
  76  |   test('dashboard → workspace → back to dashboard', async ({ page }) => {
  77  |     await page.goto('/');
  78  |     await page.waitForSelector('penpot-auth-screen');
  79  | 
  80  |     await page.locator('#email').fill('admin@penpot.local');
  81  |     await page.locator('#pw').fill('penpot123');
  82  |     await page.locator('#submit').click();
  83  | 
  84  |     const dashboard = page.locator('penpot-dashboard');
  85  |     await expect(dashboard).toBeVisible({ timeout: 15000 });
  86  | 
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
> 103 |     await page.waitForSelector('penpot-auth-screen');
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
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
  187 |     await page.waitForSelector('penpot-auth-screen');
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