const SHORTCUTS = new Map();
const ACTIVE_SHORTCUTS = new Map();
let initialized = false;
let workspace = null;

export const DEFAULT_SHORTCUTS = [
  { key: 'v', modifiers: {}, description: 'Select tool' },
  { key: 'h', modifiers: {}, description: 'Hand tool' },
  { key: 'f', modifiers: {}, description: 'Frame tool' },
  { key: 'r', modifiers: {}, description: 'Rectangle tool' },
  { key: 'e', modifiers: {}, description: 'Ellipse tool' },
  { key: 't', modifiers: {}, description: 'Text tool' },
  { key: 'p', modifiers: {}, description: 'Pen/Path tool' },
  { key: 'i', modifiers: {}, description: 'Image tool' },
  { key: 'z', modifiers: { ctrl: true }, description: 'Undo' },
  { key: 'z', modifiers: { ctrl: true, shift: true }, description: 'Redo' },
  { key: 'y', modifiers: { ctrl: true }, description: 'Redo' },
  { key: 'Delete', modifiers: {}, description: 'Delete selected' },
  { key: 'Backspace', modifiers: {}, description: 'Delete selected' },
  { key: 'a', modifiers: { ctrl: true }, description: 'Select all' },
  { key: 'd', modifiers: { ctrl: true }, description: 'Duplicate' },
  { key: 'g', modifiers: { ctrl: true }, description: 'Group' },
  { key: 'g', modifiers: { ctrl: true, shift: true }, description: 'Ungroup' },
  { key: ']', modifiers: {}, description: 'Bring forward' },
  { key: '[', modifiers: {}, description: 'Send backward' },
  { key: ']', modifiers: { shift: true }, description: 'Bring to front' },
  { key: '[', modifiers: { shift: true }, description: 'Send to back' },
  { key: 's', modifiers: { ctrl: true }, description: 'Save file' },
  { key: 'e', modifiers: { ctrl: true }, description: 'Export' },
  { key: '+', modifiers: { ctrl: true }, description: 'Zoom in' },
  { key: '=', modifiers: { ctrl: true }, description: 'Zoom in' },
  { key: '-', modifiers: { ctrl: true }, description: 'Zoom out' },
  { key: '0', modifiers: { ctrl: true }, description: 'Zoom to fit' },
  { key: '1', modifiers: { ctrl: true }, description: 'Zoom 100%' },
  { key: '2', modifiers: { ctrl: true }, description: 'Zoom 200%' },
  { key: 'Escape', modifiers: {}, description: 'Deselect / Cancel' },
  { key: 'u', modifiers: { alt: true }, description: 'Boolean union' },
  { key: 'd', modifiers: { alt: true }, description: 'Boolean difference' },
  { key: 'i', modifiers: { alt: true }, description: 'Boolean intersection' },
  { key: 'e', modifiers: { alt: true }, description: 'Boolean exclude' },
  { key: 'k', modifiers: { ctrl: true, alt: true }, description: 'Create component' },
  { key: 'd', modifiers: { ctrl: true, alt: true, shift: true }, description: 'Detach instance' },
  { key: 'k', modifiers: { ctrl: true, alt: true, shift: true }, description: 'Sync instance to main' },
  { key: 'i', modifiers: { ctrl: true, shift: true }, description: 'Import .penpot file' },
];

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

  const shortcuts = DEFAULT_SHORTCUTS.map(s => ({
    ...s,
    action: s.key === 'v' ? switchTool('select') :
            s.key === 'h' ? switchTool('hand') :
            s.key === 'f' ? switchTool('frame') :
            s.key === 'r' ? switchTool('rect') :
            s.key === 'e' && !s.modifiers.ctrl && !s.modifiers.alt ? switchTool('ellipse') :
            s.key === 't' ? switchTool('text') :
            s.key === 'p' ? switchTool('path') :
            s.key === 'i' && !s.modifiers.ctrl ? switchTool('image') :
            s.key === 'z' && s.modifiers.ctrl && !s.modifiers.shift ? () => { if (toolManager) toolManager.undo(); } :
            s.key === 'z' && s.modifiers.ctrl && s.modifiers.shift ? () => { if (toolManager) toolManager.redo(); } :
            s.key === 'y' && s.modifiers.ctrl ? () => { if (toolManager) toolManager.redo(); } :
            s.key === 'Delete' || s.key === 'Backspace' ? () => { if (toolManager) toolManager.deleteSelected(); } :
            s.key === 'a' && s.modifiers.ctrl ? () => { if (toolManager) toolManager.selectAll(); } :
            s.key === 'd' && s.modifiers.ctrl && !s.modifiers.alt ? () => { if (toolManager) toolManager.duplicateSelected(); } :
            s.key === 'g' && s.modifiers.ctrl && !s.modifiers.shift ? () => { if (toolManager) toolManager.groupSelected(); } :
            s.key === 'g' && s.modifiers.ctrl && s.modifiers.shift ? () => { if (toolManager) toolManager.ungroupSelected(); } :
            s.key === ']' && !s.modifiers.shift ? () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.bringForward([...toolManager.selectedIds][0]); } :
            s.key === '[' && !s.modifiers.shift ? () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.sendBackward([...toolManager.selectedIds][0]); } :
            s.key === ']' && s.modifiers.shift ? () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.bringToFront([...toolManager.selectedIds][0]); } :
            s.key === '[' && s.modifiers.shift ? () => { if (toolManager && toolManager.selectedIds.size > 0) toolManager.sendToBack([...toolManager.selectedIds][0]); } :
            s.key === 's' && s.modifiers.ctrl ? () => { if (workspaceEl) workspaceEl.saveFile(); } :
            s.key === 'e' && s.modifiers.ctrl && !s.modifiers.alt ? () => { const dlg = workspaceEl?.querySelector('#export-dialog'); if (dlg) dlg.open(); } :
            (s.key === '+' || s.key === '=') && s.modifiers.ctrl ? zoomCanvas('in') :
            s.key === '-' && s.modifiers.ctrl ? zoomCanvas('out') :
            s.key === '0' && s.modifiers.ctrl ? zoomCanvas('fit') :
            s.key === '1' && s.modifiers.ctrl ? zoomCanvas('reset') :
            s.key === '2' && s.modifiers.ctrl ? zoomCanvas('200') :
            s.key === 'Escape' ? () => { if (toolManager) toolManager.clearSelection(); } :
            s.key === 'u' && s.modifiers.alt ? () => { if (toolManager) toolManager.createBoolOp('union'); } :
            s.key === 'd' && s.modifiers.alt && !s.modifiers.shift ? () => { if (toolManager) toolManager.createBoolOp('difference'); } :
            s.key === 'i' && s.modifiers.alt && !s.modifiers.ctrl ? () => { if (toolManager) toolManager.createBoolOp('intersection'); } :
            s.key === 'e' && s.modifiers.alt && !s.modifiers.ctrl ? () => { if (toolManager) toolManager.createBoolOp('exclude'); } :
            s.key === 'k' && s.modifiers.ctrl && s.modifiers.alt && !s.modifiers.shift ? () => { if (workspaceEl && typeof workspaceEl.createComponentFromSelection === 'function') workspaceEl.createComponentFromSelection(); } :
            s.key === 'd' && s.modifiers.ctrl && s.modifiers.alt && s.modifiers.shift ? () => { if (workspaceEl && typeof workspaceEl.detachSelectedInstance === 'function') workspaceEl.detachSelectedInstance(); } :
            s.key === 'k' && s.modifiers.ctrl && s.modifiers.alt && s.modifiers.shift ? () => { if (workspaceEl && typeof workspaceEl.syncSelectedInstance === 'function') workspaceEl.syncSelectedInstance(); } :
            s.key === 'i' && s.modifiers.ctrl && s.modifiers.shift ? () => { if (workspaceEl && typeof workspaceEl.importPenpotFile === 'function') workspaceEl.importPenpotFile(); } :
            () => {},
  }));

  registerShortcuts(shortcuts);
  initShortcuts(workspaceEl);
}