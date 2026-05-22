let container = null;
let notificationId = 0;

const VARIANTS = {
  info: { bg: 'var(--penpot-info-bg, rgba(33,150,243,0.08))', border: 'var(--penpot-info, #2196f3)', color: 'var(--penpot-info, #2196f3)' },
  success: { bg: 'var(--penpot-success-bg, rgba(76,175,80,0.08))', border: 'var(--penpot-success, #4caf50)', color: 'var(--penpot-success, #4caf50)' },
  warning: { bg: 'var(--penpot-warning-bg, rgba(255,152,0,0.08))', border: 'var(--penpot-warning, #ff9800)', color: 'var(--penpot-warning, #ff9800)' },
  danger: { bg: 'var(--penpot-danger-bg, rgba(244,67,54,0.08))', border: 'var(--penpot-danger, #f44336)', color: 'var(--penpot-danger, #f44336)' },
};

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'penpot-notifications';
  container.style.cssText = 'position:fixed;top:var(--penpot-spacing-l,16px);right:var(--penpot-spacing-l,16px);z-index:var(--penpot-z-notification,120);display:flex;flex-direction:column;gap:var(--penpot-spacing-s,8px);pointer-events:none;max-width:400px;';
  document.body.appendChild(container);
  return container;
}

function showNotification(message, variant = 'info', duration = 4000) {
  const c = ensureContainer();
  const id = ++notificationId;
  const v = VARIANTS[variant] || VARIANTS.info;

  const el = document.createElement('div');
  el.setAttribute('role', 'alert');
  el.style.cssText = `background:${v.bg};border:1px solid ${v.border};border-radius:var(--penpot-radius-s,4px);padding:var(--penpot-spacing-s,8px) var(--penpot-spacing-m,12px);color:${v.color};font-size:var(--penpot-font-size-m,13px);font-family:var(--penpot-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);display:flex;align-items:center;justify-content:space-between;gap:var(--penpot-spacing-s,8px);pointer-events:auto;animation:penpot-notif-enter 0.2s ease;box-shadow:var(--penpot-shadow-m,0 4px 12px rgba(0,0,0,0.4));`;

  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u00D7';
  closeBtn.style.cssText = 'background:none;border:none;color:inherit;cursor:pointer;font-size:16px;padding:0 4px;line-height:1;opacity:0.7;';
  closeBtn.addEventListener('click', () => dismiss(id));
  el.appendChild(closeBtn);

  el.dataset.id = id;
  c.appendChild(el);

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }

  return id;
}

function dismiss(id) {
  const c = ensureContainer();
  const el = c.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.style.animation = 'penpot-notif-exit 0.2s ease forwards';
    setTimeout(() => el.remove(), 200);
  }
}

function info(message, duration) { return showNotification(message, 'info', duration); }
function success(message, duration) { return showNotification(message, 'success', duration); }
function warning(message, duration) { return showNotification(message, 'warning', duration); }
function danger(message, duration) { return showNotification(message, 'danger', duration); }

if (!document.getElementById('penpot-notif-styles')) {
  const style = document.createElement('style');
  style.id = 'penpot-notif-styles';
  style.textContent = `
    @keyframes penpot-notif-enter { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
    @keyframes penpot-notif-exit { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(20px); } }
  `;
  document.head.appendChild(style);
}

export { showNotification, dismiss, info, success, warning, danger };