/**
 * @module router
 * @description Client-side router with path-based routing and auth guards.
 * Port of app.main.router (reitit-based) to pure ES JS.
 */

const routes = new Map();

let currentRoute = { name: 'login', params: {}, query: {} };
const listeners = new Set();

const ROUTE_MAP = [
  { pattern: /^\/auth\/login$/, name: 'login' },
  { pattern: /^\/auth\/register$/, name: 'register' },
  { pattern: /^\/auth\/recovery\/request$/, name: 'recovery-request' },
  { pattern: /^\/auth\/recovery$/, name: 'recovery' },
  { pattern: /^\/dashboard$/, name: 'dashboard' },
  { pattern: /^\/dashboard\/search$/, name: 'dashboard-search' },
  { pattern: /^\/dashboard\/fonts$/, name: 'dashboard-fonts' },
  { pattern: /^\/dashboard\/libraries$/, name: 'dashboard-libraries' },
  { pattern: /^\/workspace\/([^/]+)\/([^/]+)$/, name: 'workspace', paramNames: ['projectId', 'fileId'] },
  { pattern: /^\/view\/(.+)$/, name: 'viewer', paramNames: ['fileId'] },
  { pattern: /^\/settings\/profile$/, name: 'settings-profile' },
  { pattern: /^\/settings\/password$/, name: 'settings-password' },
  { pattern: /^\/settings\/feedback$/, name: 'settings-feedback' },
];

const AUTH_REQUIRED = new Set([
  'dashboard', 'dashboard-search', 'dashboard-fonts', 'dashboard-libraries',
  'workspace', 'settings-profile', 'settings-password', 'settings-feedback',
]);

export function registerRoute(name, handler) {
  routes.set(name, handler);
}

export function navigate(name, params = {}) {
  currentRoute = { name, params, query: {} };
  const path = routeToPath(name, params);
  history.pushState(null, '', path);
  for (const fn of listeners) fn(currentRoute);
}

export function replace(name, params = {}) {
  currentRoute = { name, params, query: {} };
  const path = routeToPath(name, params);
  history.replaceState(null, '', path);
  for (const fn of listeners) fn(currentRoute);
}

export function current() { return currentRoute; }

export function subscribe(fn) {
  listeners.add(fn);
  fn(currentRoute);
  return () => listeners.delete(fn);
}

export function unsubscribe(fn) {
  listeners.delete(fn);
}

export function init() {
  currentRoute = parseRoute(location.pathname, location.search);
  window.addEventListener('popstate', () => {
    currentRoute = parseRoute(location.pathname, location.search);
    for (const fn of listeners) fn(currentRoute);
  });
}

function routeToPath(name, params = {}) {
  switch (name) {
    case 'login': return '/auth/login';
    case 'register': return '/auth/register';
    case 'recovery-request': return '/auth/recovery/request';
    case 'recovery': return '/auth/recovery';
    case 'dashboard': return '/dashboard';
    case 'dashboard-search': return '/dashboard/search';
    case 'dashboard-fonts': return '/dashboard/fonts';
    case 'dashboard-libraries': return '/dashboard/libraries';
    case 'workspace': return `/workspace/${params.projectId || ''}/${params.fileId || ''}`;
    case 'viewer': return `/view/${params.fileId || ''}`;
    case 'settings-profile': return '/settings/profile';
    case 'settings-password': return '/settings/password';
    case 'settings-feedback': return '/settings/feedback';
    default: return '/dashboard';
  }
}

function parseRoute(pathname, search) {
  const path = pathname.replace(/^\/|\/$/g, '');
  const query = Object.fromEntries(new URLSearchParams(search));

  for (const route of ROUTE_MAP) {
    const match = path.match(route.pattern);
    if (match) {
      const params = {};
      if (route.paramNames) {
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
      }
      return { name: route.name, params, query };
    }
  }

  return { name: 'login', params: {}, query };
}