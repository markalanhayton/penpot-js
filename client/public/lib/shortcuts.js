const SHORTCUTS = new Map();
const ACTIVE_SHORTCUTS = new Map();
let initialized = false;
let workspace = null;

export function registerShortcut(key, modifiers, action, description = '') {
  const combo = normalizeCombo(key, modifiers);
  if (SHORTCUTS.has(combo)) {
    console.warn(`[shortcuts] Overriding shortcut: ${combo}`);
  }
  SHORTCUTS.set(combo, { key, modifiers, action, description });
}

export function unregisterShortcut(key, modifiers) {
  const combo = normalizeCombo(key, modifiers);
  SHORTCUTS.delete(combo);
  const handler = ACTIVE_SHORTCUTS.get(combo);
  if (handler) {
    ACTIVE_SHORTCUTS.delete(combo);
  }
}

export function registerShortcuts(shortcuts) {
  for (const s of shortcuts) {
    registerShortcut(s.key, s.modifiers || {}, s.action, s.description || '');
  }
}

export function initShortcuts(ws) {
  if (initialized) return;
  initialized = true;
  workspace = ws;
  document.addEventListener('keydown', handleKeyDown);
}

export function destroyShortcuts() {
  if (!initialized) return;
  initialized = false;
  workspace = null;
  document.removeEventListener('keydown', handleKeyDown);
  SHORTCUTS.clear();
  ACTIVE_SHORTCUTS.clear();
}

export function getShortcuts() {
  return [...SHORTCUTS.entries()].map(([combo, s]) => ({
    combo,
    key: s.key,
    modifiers: s.modifiers,
    description: s.description,
  }));
}

function handleKeyDown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.contentEditable === 'true') {
    return;
  }

  const combo = eventToCombo(event);
  const shortcut = SHORTCUTS.get(combo);

  if (shortcut) {
    event.preventDefault();
    event.stopPropagation();
    shortcut.action(event);
  }
}

function eventToCombo(event) {
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push('mod');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
}

function normalizeCombo(key, modifiers = {}) {
  const parts = [];
  if (modifiers.ctrl || modifiers.meta || modifiers.cmd) parts.push('mod');
  if (modifiers.shift) parts.push('shift');
  if (modifiers.alt) parts.push('alt');
  parts.push(key.toLowerCase());
  return parts.join('+');
}

export function wireShortcuts(toolManager, workspaceEl) {
  const canvas = workspaceEl.querySelector('#canvas');
  const tools = workspaceEl.querySelector('#tools');

  function switchTool(name) {
    return () => {
      if (toolManager) toolManager.switchTool(name);
      if (tools) tools.setAttribute('active-tool', name);
    };
  }

  function zoomCanvas(action) {
    return () => {
      if (!canvas) return;
      if (action === 'in') canvas.zoom = canvas.zoom * 1.25;
      else if (action === 'out') canvas.zoom = canvas.zoom / 1.25;
      else if (action === 'fit') canvas.zoom = 1;
      else if (action === 'reset') canvas.zoom = 1;
      else if (action === '200') canvas.zoom = 2;
      const toolsBar = workspaceEl.querySelector('#tools');
      if (toolsBar) toolsBar.zoom = canvas.zoom;
    };
  }

  function workspaceAction(method, ...args) {
    return () => {
      if (workspaceEl && typeof workspaceEl[method] === 'function') {
        workspaceEl[method](...args);
      }
    };
  }

  const shortcuts = [
    { key: 'v', modifiers: {}, action: switchTool('select'), description: 'Select tool' },
    { key: 'h', modifiers: {}, action: switchTool('hand'), description: 'Hand tool' },
    { key: 'f', modifiers: {}, action: switchTool('frame'), description: 'Frame tool' },
    { key: 'r', modifiers: {}, action: switchTool('rect'), description: 'Rectangle tool' },
    { key: 'e', modifiers: {}, action: switchTool('ellipse'), description: 'Ellipse tool' },
    { key: 't', modifiers: {}, action: switchTool('text'), description: 'Text tool' },
    { key: 'p', modifiers: {}, action: switchTool('path'), description: 'Pen/Path tool' },
    { key: 'i', modifiers: {}, action: switchTool('image'), description: 'Image tool' },
    { key: 'z', modifiers: { ctrl: true }, action: () => { if (toolManager) toolManager.undo(); }, description: 'Undo' },
    { key: 'z', modifiers: { ctrl: true, shift: true }, action: () => { if (toolManager) toolManager.redo(); }, description: 'Redo' },
    { key: 'y', modifiers: { ctrl: true }, action: () => { if (toolManager) toolManager.redo(); }, description: 'Redo' },
    { key: 'Delete', modifiers: {}, action: () => { if (toolManager) toolManager.deleteSelected(); }, description: 'Delete selected' },
    { key: 'Backspace', modifiers: {}, action: () => { if (toolManager) toolManager.deleteSelected(); }, description: 'Delete selected' },
    { key: 'a', modifiers: { ctrl: true }, action: () => { if (toolManager) toolManager.selectAll(); }, description: 'Select all' },
    { key: 'd', modifiers: { ctrl: true }, action: () => { if (toolManager) toolManager.duplicateSelected(); }, description: 'Duplicate' },
    { key: 'g', modifiers: { ctrl: true }, action: () => { if (toolManager) toolManager.groupSelected(); }, description: 'Group' },
    { key: 'g', modifiers: { ctrl: true, shift: true }, action: () => { if (toolManager) toolManager.ungroupSelected(); }, description: 'Ungroup' },
    { key: ']', modifiers: {}, action: () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.bringForward([...toolManager.selectedIds][0]); }, description: 'Bring forward' },
    { key: '[', modifiers: {}, action: () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.sendBackward([...toolManager.selectedIds][0]); }, description: 'Send backward' },
    { key: ']', modifiers: { shift: true }, action: () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.bringToFront([...toolManager.selectedIds][0]); }, description: 'Bring to front' },
    { key: '[', modifiers: { shift: true }, action: () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.sendToBack([...toolManager.selectedIds][0]); }, description: 'Send to back' },
    { key: 's', modifiers: { ctrl: true }, action: () => { if (workspaceEl) workspaceEl.saveFile(); }, description: 'Save file' },
    { key: 'e', modifiers: { ctrl: true }, action: () => { const dlg = workspaceEl?.querySelector('#export-dialog'); if (dlg) dlg.open(); }, description: 'Export' },
    { key: '+', modifiers: { ctrl: true }, action: zoomCanvas('in'), description: 'Zoom in' },
    { key: '=', modifiers: { ctrl: true }, action: zoomCanvas('in'), description: 'Zoom in' },
    { key: '-', modifiers: { ctrl: true }, action: zoomCanvas('out'), description: 'Zoom out' },
    { key: '0', modifiers: { ctrl: true }, action: zoomCanvas('fit'), description: 'Zoom to fit' },
    { key: '1', modifiers: { ctrl: true }, action: zoomCanvas('reset'), description: 'Zoom 100%' },
    { key: '2', modifiers: { ctrl: true }, action: zoomCanvas('200'), description: 'Zoom 200%' },
    { key: 'Escape', modifiers: {}, action: () => { if (toolManager) toolManager.clearSelection(); }, description: 'Deselect / Cancel' },
    { key: 'u', modifiers: { alt: true }, action: () => { if (toolManager) toolManager.createBoolOp('union'); }, description: 'Boolean union' },
    { key: 'd', modifiers: { alt: true }, action: () => { if (toolManager) toolManager.createBoolOp('difference'); }, description: 'Boolean difference' },
    { key: 'i', modifiers: { alt: true }, action: () => { if (toolManager) toolManager.createBoolOp('intersection'); }, description: 'Boolean intersection' },
    { key: 'e', modifiers: { alt: true }, action: () => { if (toolManager) toolManager.createBoolOp('exclude'); }, description: 'Boolean exclude' },
  ];

  registerShortcuts(shortcuts);
  initShortcuts(workspaceEl);
}