/**
 * @module i18n
 * @description Internationalization stub. Supports string lookup with parameter interpolation.
 * Defaults to English. Load locale files to add translations.
 */

const translations = new Map();
let currentLocale = 'en';

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

export function setLocale(locale) {
  currentLocale = locale;
}

export function registerTranslations(locale, messages) {
  const existing = translations.get(locale) || {};
  translations.set(locale, { ...existing, ...messages });
}

export function t(key, params = {}) {
  const localeStrings = translations.get(currentLocale) || {};
  let text = localeStrings[key] || translations.get('en')?.[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

export function getCurrentLocale() {
  return currentLocale;
}

export function getAvailableLocales() {
  return [...translations.keys()];
}