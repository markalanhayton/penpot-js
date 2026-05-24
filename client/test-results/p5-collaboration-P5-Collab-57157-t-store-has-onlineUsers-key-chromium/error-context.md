# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p5-collaboration.spec.js >> P5: Collaboration (WebSocket) >> store has onlineUsers key
- Location: e2e\p5-collaboration.spec.js:109:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  16  |     const dashboard = page.locator('penpot-dashboard');
  17  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  18  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  19  |       await fileCard.click();
  20  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  21  |       return true;
  22  |     }
  23  |     return false;
  24  |   }
  25  | 
  26  |   test('workspace renders with cursor overlay component', async ({ page }) => {
  27  |     if (!(await openWorkspace(page))) return;
  28  |     const cursorOverlay = page.locator('penpot-cursor-overlay');
  29  |     await expect(cursorOverlay).toBeVisible();
  30  |   });
  31  | 
  32  |   test('workspace renders with presence bar in toolbar', async ({ page }) => {
  33  |     if (!(await openWorkspace(page))) return;
  34  |     const presenceBar = page.locator('penpot-toolbar').locator('penpot-presence-bar');
  35  |     await expect(presenceBar).toBeVisible();
  36  |   });
  37  | 
  38  |   test('presence bar shows disconnected status when no WS', async ({ page }) => {
  39  |     if (!(await openWorkspace(page))) return;
  40  |     const toolbar = page.locator('penpot-toolbar');
  41  |     const presenceBar = toolbar.locator('penpot-presence-bar');
  42  |     await expect(presenceBar).toBeVisible();
  43  | 
  44  |     const statusDot = presenceBar.locator('#status');
  45  |     await expect(statusDot).toBeVisible();
  46  |   });
  47  | 
  48  |   test('presence bar has avatar container', async ({ page }) => {
  49  |     if (!(await openWorkspace(page))) return;
  50  |     const toolbar = page.locator('penpot-toolbar');
  51  |     const presenceBar = toolbar.locator('penpot-presence-bar');
  52  |     await expect(presenceBar).toBeVisible();
  53  | 
  54  |     const avatars = presenceBar.locator('#avatars');
  55  |     await expect(avatars).toBeVisible();
  56  |   });
  57  | 
  58  |   test('cursor overlay has container element', async ({ page }) => {
  59  |     if (!(await openWorkspace(page))) return;
  60  |     const cursorOverlay = page.locator('penpot-cursor-overlay');
  61  |     await expect(cursorOverlay).toBeVisible();
  62  | 
  63  |     const container = cursorOverlay.locator('#cursors');
  64  |     await expect(container).toBeVisible();
  65  |   });
  66  | 
  67  |   test('cursor overlay accepts cursors property', async ({ page }) => {
  68  |     if (!(await openWorkspace(page))) return;
  69  |     const cursorOverlay = page.locator('penpot-cursor-overlay');
  70  | 
  71  |     await cursorOverlay.evaluate((el) => {
  72  |       el.cursors = [
  73  |         { id: 'user-1', name: 'Alice', x: 100, y: 200, color: '#31efb8', page: 'page-1' },
  74  |       ];
  75  |     });
  76  | 
  77  |     const cursors = cursorOverlay.locator('.cursor-container > div');
  78  |     const count = await cursors.count();
  79  |     expect(count).toBeGreaterThanOrEqual(0);
  80  |   });
  81  | 
  82  |   test('ws module exports are available', async ({ page }) => {
  83  |     await page.goto('/');
  84  |     const wsAvailable = await page.evaluate(() => {
  85  |       return typeof window.__penpot !== 'undefined';
  86  |     });
  87  |     expect(wsAvailable).toBe(true);
  88  |   });
  89  | 
  90  |   test('toolbar has presence bar element before share button', async ({ page }) => {
  91  |     if (!(await openWorkspace(page))) return;
  92  |     const toolbar = page.locator('penpot-toolbar');
  93  |     const shareBtn = toolbar.locator('#share-btn');
  94  |     await expect(shareBtn).toBeVisible();
  95  |     const presenceBar = toolbar.locator('penpot-presence-bar');
  96  |     await expect(presenceBar).toBeVisible();
  97  |   });
  98  | 
  99  |   test('app store has collaboration state keys', async ({ page }) => {
  100 |     await page.goto('/');
  101 |     const hasKeys = await page.evaluate(() => {
  102 |       const store = window.__penpot?.store;
  103 |       if (!store) return false;
  104 |       return store.get('wsConnected') !== undefined;
  105 |     });
  106 |     expect(hasKeys).toBe(true);
  107 |   });
  108 | 
  109 |   test('store has onlineUsers key', async ({ page }) => {
  110 |     await page.goto('/');
  111 |     const users = await page.evaluate(() => {
  112 |       const store = window.__penpot?.store;
  113 |       if (!store) return null;
  114 |       return store.get('onlineUsers');
  115 |     });
> 116 |     expect(Array.isArray(users)).toBe(true);
      |                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  117 |   });
  118 | 
  119 |   test('store has cursorPositions key', async ({ page }) => {
  120 |     await page.goto('/');
  121 |     const cursors = await page.evaluate(() => {
  122 |       const store = window.__penpot?.store;
  123 |       if (!store) return null;
  124 |       return store.get('cursorPositions');
  125 |     });
  126 |     expect(Array.isArray(cursors)).toBe(true);
  127 |   });
  128 | 
  129 |   test('collaboration module exports are available', async ({ page }) => {
  130 |     await page.goto('/');
  131 |     const exports = await page.evaluate(async () => {
  132 |       const mod = await import('/lib/collaboration.js');
  133 |       return {
  134 |         hasInit: typeof mod.initCollaboration === 'function',
  135 |         hasBroadcast: typeof mod.broadcastChange === 'function',
  136 |         hasBroadcastChanges: typeof mod.broadcastChanges === 'function',
  137 |         hasResolve: typeof mod.resolveConflict === 'function',
  138 |         hasFetchLagged: typeof mod.fetchLaggedChanges === 'function',
  139 |         hasDestroy: typeof mod.destroyCollaboration === 'function',
  140 |         hasGetSession: typeof mod.getSessionId === 'function',
  141 |       };
  142 |     });
  143 |     expect(exports.hasInit).toBe(true);
  144 |     expect(exports.hasBroadcast).toBe(true);
  145 |     expect(exports.hasBroadcastChanges).toBe(true);
  146 |     expect(exports.hasResolve).toBe(true);
  147 |     expect(exports.hasFetchLagged).toBe(true);
  148 |     expect(exports.hasDestroy).toBe(true);
  149 |     expect(exports.hasGetSession).toBe(true);
  150 |   });
  151 | 
  152 |   test('persistence module has conflict resolution integration', async ({ page }) => {
  153 |     await page.goto('/');
  154 |     const exports = await page.evaluate(async () => {
  155 |       const mod = await import('/lib/persistence.js');
  156 |       return {
  157 |         hasInit: typeof mod.initPersistence === 'function',
  158 |         hasGetRevn: typeof mod.getRevision === 'function',
  159 |         hasGetLastSaved: typeof mod.getLastSavedRevision === 'function',
  160 |         hasEnqueue: typeof mod.enqueueChange === 'function',
  161 |         hasFlush: typeof mod.flushSave === 'function',
  162 |         hasMakeCreate: typeof mod.makeCreateChange === 'function',
  163 |         hasMakeModify: typeof mod.makeModifyChange === 'function',
  164 |         hasMakeDelete: typeof mod.makeDeleteChange === 'function',
  165 |         hasMakeMove: typeof mod.makeMoveChange === 'function',
  166 |       };
  167 |     });
  168 |     expect(exports.hasInit).toBe(true);
  169 |     expect(exports.hasGetRevn).toBe(true);
  170 |     expect(exports.hasGetLastSaved).toBe(true);
  171 |     expect(exports.hasEnqueue).toBe(true);
  172 |     expect(exports.hasFlush).toBe(true);
  173 |   });
  174 | 
  175 |   test('file-change WS messages skip own session', async ({ page }) => {
  176 |     await page.goto('/');
  177 |     const result = await page.evaluate(async () => {
  178 |       const { onWSMessage } = await import('/lib/ws.js');
  179 |       const { initCollaboration, handleRemoteFileChange } = await import('/lib/collaboration.js');
  180 |       return typeof handleRemoteFileChange === 'function';
  181 |     });
  182 |     expect(result).toBe(true);
  183 |   });
  184 | });
```