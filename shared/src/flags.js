export let current = new Set();

export const login = new Set([
  'registration',
  'login',
  'access-tokens',
  'login-with-password',
  'login-with-github',
  'login-with-gitlab',
  'login-with-google',
  'login-with-ldap',
  'login-with-oidc',
  'login-with-custom-sso',
  'oidc-registration',
  'log-invitation-tokens'
]);

export const email = new Set([
  'email-whitelist',
  'email-blacklist',
  'email-verification',
  'log-emails',
  'smtp',
  'smtp-debug'
]);

export const varia = new Set([
  'audit-log',
  'audit-log-archive',
  'audit-log-gc',
  'audit-log-logger',
  'auto-file-snapshot',
  'backend-api-doc',
  'backend-openapi-doc',
  'backend-worker',
  'component-thumbnails',
  'cors',
  'dashboard-templates-section',
  'demo-users',
  'demo-warning',
  'file-schema-validation',
  'soft-file-schema-validation',
  'file-validation',
  'soft-file-validation',
  'frontend-svgo',
  'exporter-svgo',
  'backend-svgo',
  'google-fonts-provider',
  'nrepl-server',
  'urepl-server',
  'prepl-server',
  'onboarding',
  'quotes',
  'soft-quotes',
  'rpc-climit',
  'rpc-rlimit',
  'soft-rpc-rlimit',
  'secure-session-cookies',
  'strict-session-cookies',
  'telemetry',
  'terms-and-privacy-checkbox',
  'tiered-file-data-storage',
  'token-base-font-size',
  'token-combobox',
  'token-color',
  'token-shadow',
  'token-tokenscript',
  'token-import-from-library',
  'token-typography-row',
  'transit-readable-response',
  'user-feedback',
  'v2-migration',
  'webhooks',
  'render-wasm-dpr',
  'render-wasm-info',
  'render-switch',
  'hide-release-modal',
  'subscriptions',
  'subscriptions-old',
  'inspect-styles',
  'perf-logs',
  'sec-fetch-metadata-middleware',
  'client-header-check-middleware',
  'redis-cache',
  'nitrate',
  'mcp',
  'background-blur',
  'stroke-path'
]);

export const allFlags = new Set([...email, ...login, ...varia]);

export const defaultFlags = [
  'enable-registration',
  'enable-login-with-password',
  'enable-export-file-v3',
  'enable-frontend-svgo',
  'enable-exporter-svgo',
  'enable-backend-svgo',
  'enable-backend-api-doc',
  'enable-backend-openapi-doc',
  'enable-backend-worker',
  'enable-secure-session-cookies',
  'enable-email-verification',
  'enable-onboarding',
  'enable-dashboard-templates-section',
  'enable-google-fonts-provider',
  'enable-component-thumbnails',
  'enable-render-wasm-dpr',
  'enable-token-color',
  'enable-token-shadow',
  'enable-inspect-styles',
  'enable-feature-fdata-objects-map',
  'enable-feature-render-wasm',
  'enable-token-import-from-library'
];

export function parse(...flagArrays) {
  const flags = flagArrays.flat();
  const result = new Set();
  for (const item of flags) {
    const sname = String(item);
    if (sname.startsWith('enable-')) {
      result.add(sname.slice(7));
    } else if (sname.startsWith('disable-')) {
      result.delete(sname.slice(8));
    }
  }
  return result;
}