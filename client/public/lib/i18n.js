/**
 * @module i18n
 * @description Internationalization with async locale loading, browser detection,
 * fallback chains, pluralization, number/date formatting, and RTL support.
 */

const translations = new Map();
let currentLocale = 'en';
let rtlLocales = new Set(['ar', 'he', 'fa', 'ur']);

const DEFAULT_STRINGS = {
  'auth.login': 'Sign in',
  'auth.login.loading': 'Signing in...',
  'auth.register': 'Create account',
  'auth.register.loading': 'Creating...',
  'auth.register.success': 'Account created! Please sign in.',
  'auth.recovery': 'Reset password',
  'auth.recovery.loading': 'Sending...',
  'auth.recovery.success': 'If that email exists, a recovery link has been sent.',
  'auth.noAccount': "Don't have an account? ",
  'auth.hasAccount': 'Already have an account? ',
  'auth.createLink': 'Create one',
  'auth.signinLink': 'Sign in',
  'auth.backToSignin': 'Back to sign in',
  'auth.error.invalidCredentials': 'Invalid email or password.',
  'auth.error.emailTaken': 'Email is already registered.',
  'auth.error.registrationDisabled': 'Registration is disabled.',
  'auth.error.unknown': 'An error occurred. Please try again.',

  'dashboard.title': 'Dashboard',
  'dashboard.myProjects': 'My projects',
  'dashboard.newFile': 'New file',
  'dashboard.createFile': 'Create a new design file',
  'dashboard.signOut': 'Sign out',
  'dashboard.noTeams': 'No teams found.',
  'dashboard.noFiles': 'No files yet.',
  'dashboard.error.loadFailed': 'Failed to load dashboard.',

  'workspace.untitled': 'Untitled file',
  'workspace.save': 'Save',
  'workspace.canvas.empty': 'Canvas workspace',
  'workspace.canvas.emptyDesc': 'Drawing tools, layers, and inspector will appear here',
  'workspace.layers': 'Layers',
  'workspace.assets': 'Assets',
  'workspace.design': 'Design',

  'tool.select': 'Select',
  'tool.frame': 'Frame',
  'tool.rect': 'Rectangle',
  'tool.circle': 'Circle',
  'tool.text': 'Text',
  'tool.pen': 'Pen',

  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.search': 'Search',
  'common.noResults': 'No results found.',
  'common.accessDenied': 'Access denied.',
  'common.notFound': 'Not found.',
};

translations.set('en', DEFAULT_STRINGS);

const loadedLocales = new Set(['en']);
const loadingPromises = new Map();

export function setLocale(locale) {
  currentLocale = locale;
  document.documentElement.setAttribute('dir', isRTL(locale) ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', locale);
}

export function registerTranslations(locale, messages) {
  const existing = translations.get(locale) || {};
  translations.set(locale, { ...existing, ...messages });
  loadedLocales.add(locale);
}

export async function loadLocale(locale, url) {
  if (loadedLocales.has(locale)) return translations.get(locale);
  if (loadingPromises.has(locale)) return loadingPromises.get(locale);

  const promise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const messages = await response.json();
      registerTranslations(locale, messages);
      return messages;
    } catch (err) {
      console.error(`[i18n] Failed to load locale ${locale}:`, err);
      return null;
    } finally {
      loadingPromises.delete(locale);
    }
  })();

  loadingPromises.set(locale, promise);
  return promise;
}

export function detectBrowserLocale() {
  const stored = typeof localStorage !== 'undefined' && localStorage.getItem('penpot-locale');
  if (stored && translations.has(stored)) return stored;

  const browserLangs = navigator?.languages || [navigator?.language || 'en'];
  for (const lang of browserLangs) {
    if (translations.has(lang)) return lang;
    const base = lang.split('-')[0];
    if (translations.has(base)) return base;
    for (const registered of translations.keys()) {
      if (registered.startsWith(base + '-')) return registered;
      if (registered === base) return registered;
    }
  }
  return 'en';
}

export async function autoDetectAndInit() {
  const locale = detectBrowserLocale();
  if (locale !== 'en' && !loadedLocales.has(locale)) {
    const base = locale.split('-')[0];
    if (!loadedLocales.has(base)) {
      await loadLocale(base, `/locales/${base}.json`);
    }
    if (locale !== base && !loadedLocales.has(locale)) {
      await loadLocale(locale, `/locales/${locale}.json`).catch(() => {});
    }
  }
  setLocale(locale);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('penpot-locale', locale);
  }
  return locale;
}

export async function initLocale(preferenceLocale) {
  const locale = preferenceLocale || detectBrowserLocale();
  if (locale !== 'en' && !loadedLocales.has(locale)) {
    try {
      await loadLocale(locale, `/locales/${locale}.json`);
    } catch {}
  }
  setLocale(locale);
  return locale;
}

export function t(key, params = {}) {
  const localeStrings = translations.get(currentLocale) || {};
  let text = localeStrings[key];

  if (text == null) {
    const base = currentLocale.split('-')[0];
    if (base !== currentLocale) {
      text = translations.get(base)?.[key];
    }
  }

  if (text == null) {
    text = translations.get('en')?.[key] || key;
  }

  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }

  return text;
}

export function tp(key, count, params = {}) {
  const n = typeof count === 'number' ? count : 0;
  const form = n === 0 ? 'zero' : n === 1 ? 'one' : 'other';
  const pluralKey = `${key}.${form}`;
  const result = t(pluralKey, { ...params, count: String(n) });
  if (result !== pluralKey) return result;
  return t(key, { ...params, count: String(n) });
}

export function formatNumber(num, options = {}) {
  try {
    return new Intl.NumberFormat(currentLocale, options).format(num);
  } catch {
    return String(num);
  }
}

export function formatDate(date, options = {}) {
  try {
    return new Intl.DateTimeFormat(currentLocale, options).format(date);
  } catch {
    return String(date);
  }
}

export function formatRelativeTime(date) {
  try {
    const rtf = new Intl.RelativeTimeFormat(currentLocale, { numeric: 'auto' });
    const diff = (date.getTime() - Date.now()) / 1000;
    if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
    if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  } catch {
    return formatDate(date);
  }
}

export function getCurrentLocale() { return currentLocale; }

export function getAvailableLocales() { return [...translations.keys()]; }

export function isRTL(locale) {
  const l = locale || currentLocale;
  return rtlLocales.has(l) || rtlLocales.has(l.split('-')[0]);
}

export function addRTLLocale(locale) { rtlLocales.add(locale); }