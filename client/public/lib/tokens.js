/**
 * @module tokens
 * @description Design tokens as CSS custom properties.
 * Provides the shared visual language for all Web Components.
 */

export const TOKENS = `
:root {
  /* Colors — Brand */
  --penpot-primary: #31efb8;
  --penpot-primary-hover: #28d4a3;
  --penpot-primary-pressed: #1fbf92;
  --penpot-primary-bg: rgba(49, 239, 184, 0.08);
  --penpot-primary-bg-hover: rgba(49, 239, 184, 0.15);

  /* Colors — Semantic */
  --penpot-danger: #f44336;
  --penpot-danger-hover: #e53935;
  --penpot-danger-bg: rgba(244, 67, 54, 0.08);
  --penpot-warning: #ff9800;
  --penpot-warning-bg: rgba(255, 152, 0, 0.08);
  --penpot-success: #4caf50;
  --penpot-success-bg: rgba(76, 175, 80, 0.08);
  --penpot-info: #2196f3;
  --penpot-info-bg: rgba(33, 150, 243, 0.08);

  /* Colors — Surfaces */
  --penpot-bg: #1c1c1c;
  --penpot-bg-secondary: #222;
  --penpot-surface: #2a2a2a;
  --penpot-surface-high: #333;
  --penpot-surface-highest: #3c3c3c;

  /* Colors — Text */
  --penpot-text: #e6e6e6;
  --penpot-text-dim: #999;
  --penpot-text-disabled: #666;
  --penpot-text-inverse: #111;

  /* Colors — Borders */
  --penpot-border: #444;
  --penpot-border-focused: #555;
  --penpot-border-hover: #666;

  /* Colors — Inputs */
  --penpot-input-bg: #333;
  --penpot-input-border: #555;
  --penpot-input-border-focused: var(--penpot-primary);

  /* Spacing */
  --penpot-spacing-xxs: 2px;
  --penpot-spacing-xs: 4px;
  --penpot-spacing-s: 8px;
  --penpot-spacing-m: 12px;
  --penpot-spacing-l: 16px;
  --penpot-spacing-xl: 24px;
  --penpot-spacing-xxl: 32px;
  --penpot-spacing-xxxl: 48px;

  /* Typography */
  --penpot-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  --penpot-font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  --penpot-font-size-xxs: 9px;
  --penpot-font-size-xs: 10px;
  --penpot-font-size-s: 11px;
  --penpot-font-size-m: 13px;
  --penpot-font-size-l: 16px;
  --penpot-font-size-xl: 20px;
  --penpot-font-size-xxl: 28px;

  /* Borders */
  --penpot-radius-xs: 2px;
  --penpot-radius-s: 4px;
  --penpot-radius-m: 8px;
  --penpot-radius-l: 12px;
  --penpot-radius-full: 9999px;

  /* Shadows */
  --penpot-shadow-s: 0 1px 3px rgba(0,0,0,0.3);
  --penpot-shadow-m: 0 4px 12px rgba(0,0,0,0.4);
  --penpot-shadow-l: 0 8px 24px rgba(0,0,0,0.5);
  --penpot-shadow-xl: 0 16px 48px rgba(0,0,0,0.6);

  /* Transitions */
  --penpot-transition-fast: 0.1s ease;
  --penpot-transition-normal: 0.2s ease;
  --penpot-transition-slow: 0.3s ease;

  /* Z-index layers */
  --penpot-z-canvas: 0;
  --penpot-z-canvas-overlay: 1;
  --penpot-z-sidebar: 10;
  --penpot-z-toolbar: 20;
  --penpot-z-dropdown: 50;
  --penpot-z-modal-backdrop: 90;
  --penpot-z-modal: 100;
  --penpot-z-tooltip: 110;
  --penpot-z-notification: 120;
  --penpot-z-context-menu: 130;

  /* Layout — Workspace */
  --penpot-topbar-height: 44px;
  --penpot-toolsbar-height: 36px;
  --penpot-sidebar-width: 260px;
  --penpot-rulers-size: 20px;

  /* Interactive */
  --penpot-clickable-min: 24px;
  --penpot-focus-outline: 2px solid var(--penpot-primary);
  --penpot-focus-outline-offset: 2px;
}

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--penpot-font-family);
  background: var(--penpot-bg);
  color: var(--penpot-text);
  font-size: var(--penpot-font-size-m);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a { color: var(--penpot-primary); text-decoration: none; }
a:hover { text-decoration: underline; }

button { cursor: pointer; font-family: inherit; }
button:disabled { cursor: not-allowed; }

input, textarea, select {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
}

:focus-visible {
  outline: var(--penpot-focus-outline);
  outline-offset: var(--penpot-focus-outline-offset);
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--penpot-bg); }
::-webkit-scrollbar-thumb { background: var(--penpot-border); border-radius: var(--penpot-radius-full); }
::-webkit-scrollbar-thumb:hover { background: var(--penpot-border-hover); }
`;

export function injectTokens() {
  const style = document.createElement('style');
  style.textContent = TOKENS;
  document.head.appendChild(style);
}