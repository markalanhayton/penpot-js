'use strict';
/**
 * @module config
 * @description Application configuration module — mirrors `app.config` from the Clojure backend.
 *
 * Reads all `PENPOT_*` environment variables with the same naming convention used
 * by the original backend. Feature flags follow the `enable-<flag>` / `disable-<flag>`
 * format parsed from `PENPOT_FLAGS`.
 *
 * @example
 * import { config, flagEnabled } from './config/index.js';
 *
 * console.log(config.database.path); // 'penpot.sqlite'
 * console.log(config.http.port);     // 6060
 * console.log(flagEnabled('registration')); // true
 */

import 'dotenv/config';

/**
 * Read an environment variable with optional type coercion.
 *
 * @template T
 * @param {string} key - Environment variable name (e.g. `'PENPOT_HTTP_PORT'`).
 * @param {T} defaultValue - Default value when the variable is unset; also determines
 *   the return type (`number` → numeric parse, `boolean` → `'true'|'1'` check, otherwise `string`).
 * @returns {T} The parsed environment value or `defaultValue`.
 */
const env = (key, defaultValue) => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  if (typeof defaultValue === 'number') return Number(value);
  if (typeof defaultValue === 'boolean') return value === 'true' || value === '1';
  return value;
};

/**
 * Parsed feature flags derived from `PENPOT_FLAGS`.
 *
 * Format: `"enable-mcp disable-registration"` → `{ mcp: true, registration: false }`.
 * Prefix `enable-` sets the flag to `true`; `disable-` sets it to `false`.
 * Hyphens are converted to underscores for JS compatibility.
 *
 * @type {Record<string, boolean>}
 */
const flags = (process.env.PENPOT_FLAGS || '')
  .split(/\s+/)
  .filter(Boolean)
  .reduce((acc, flag) => {
    if (flag.startsWith('enable-')) acc[flag.slice(7).replace(/-/g, '_')] = true;
    if (flag.startsWith('disable-')) acc[flag.slice(8).replace(/-/g, '_')] = false;
    return acc;
  }, {});

/**
 * Default feature flags — mirrors `common.flags/default-flags`.
 *
 * When `PENPOT_FLAGS` contains `disable-<flag>` the default is overridden to `false`;
 * `enable-<flag>` overrides to `true`. Absent flags retain their default value.
 *
 * @type {Record<string, boolean>}
 */
const defaultFlags = {
  registration: true,
  login_with_password: true,
  login_with_oidc: false,
  login_with_google: false,
  login_with_github: false,
  login_with_gitlab: false,
  oidc_registration: false,
  export_file_v3: true,
  frontend_svgo: true,
  exporter_svgo: true,
  backend_svgo: true,
  backend_api_doc: true,
  backend_openapi_doc: true,
  backend_worker: true,
  secure_session_cookies: true,
  email_verification: true,
  onboarding: true,
  dashboard_templates_section: true,
  google_fonts_provider: true,
  component_thumbnails: true,
  render_wasm_dpr: true,
  feature_render_wasm: true,
  token_color: true,
  token_shadow: true,
  inspect_styles: true,
  feature_fdata_objects_map: true,
  token_import_from_library: true,
  access_tokens: true,
  webhooks: true,
  smtp: true,
  mcp: true,
  telemetry: false,
  quotes: true,
  file_migrations: true,
  fdata: false,
};

/** @type {Record<string, boolean>} Merged defaults + env overrides. */
export const mergedFlags = { ...defaultFlags, ...flags };

/**
 * Public URI for the running instance. Auto-detected from `PENPOT_PUBLIC_URI`.
 * When the URI uses plain HTTP (not localhost), `secure_session_cookies` is disabled.
 *
 * @type {string}
 */
const publicUri = env('PENPOT_PUBLIC_URI', 'http://localhost:3449');
const isHttp = publicUri.startsWith('http://');
if (isHttp && publicUri.indexOf('localhost') < 0) {
  mergedFlags.secure_session_cookies = false;
}

/**
 * Frozen application configuration object.
 *
 * Grouped by subsystem to mirror the Clojure backend's `app.config` structure.
 * All values are resolved from `PENPOT_*` environment variables at module-load time.
 *
 * @typedef {object} AppConfig
 * @property {object}           database                 - SQLite database configuration.
 * @property {string}           database.path            - Path to the SQLite database file (`:memory:` for in-memory).
 * @property {object}           http                     - HTTP server configuration.
 * @property {string}           http.host                - Bind address.
 * @property {number}           http.port                - Bind port.
 * @property {number}           http.maxBodySize         - Maximum request body size in bytes.
 * @property {object}           auth                     - Authentication configuration.
 * @property {string}           auth.secretKey           - Secret used for JWE token encryption.
 * @property {string}           auth.cookieName          - Name of the auth cookie.
 * @property {number}           auth.cookieMaxAge        - Cookie max-age in seconds (default 7 days).
 * @property {number}           auth.sessionRenewalAge   - Session renewal threshold in seconds.
 * @property {string}           publicUri                - Public-facing URI of the instance.
 * @property {string}           host                     - Hostname of the instance.
 * @property {string}           tenant                   - Tenant identifier (default `'default'`).
 * @property {Record<string,boolean>} flags              - Feature flags map.
 * @property {object}           storage                  - Asset storage configuration.
 * @property {string}           storage.backend          - Storage backend (`'fs'` or `'s3'`).
 * @property {string}           storage.fsDirectory      - Directory for filesystem storage.
 * @property {object}           storage.s3              - S3-compatible storage configuration (MinIO, AWS, etc.).
 * @property {string}           storage.s3.bucket         - S3 bucket name.
 * @property {string}           storage.s3.region        - S3 region (default `'us-east-1'`).
 * @property {string}           storage.s3.endpoint       - Custom S3 endpoint URL (for MinIO or other compatible servers).
 * @property {string}           storage.s3.prefix         - Key prefix for all objects (default `''`).
 * @property {string}           storage.s3.accessKey     - Access key ID (or MinIO root user).
 * @property {string}           storage.s3.secretKey     - Secret access key (or MinIO root password).
 * @property {boolean}          storage.s3.pathStyle     - Use path-style access (required for MinIO).
 * @property {object}           smtp                     - SMTP configuration.
 * @property {boolean}          smtp.enabled             - Whether SMTP sending is enabled.
 * @property {string}           smtp.host                - SMTP server hostname.
 * @property {number}           smtp.port                - SMTP server port.
 * @property {string}           smtp.username            - SMTP auth username.
 * @property {string}           smtp.password            - SMTP auth password.
 * @property {string}           smtp.defaultFrom         - Default `From` address.
 * @property {string}           smtp.defaultReplyTo      - Default `Reply-To` address.
 * @property {boolean}          smtp.ssl                 - Use SSL for SMTP connection.
 * @property {boolean}          smtp.tls                 - Use TLS (STARTTLS) for SMTP connection.
 * @property {object}           email                    - Email filtering configuration.
 * @property {string}           email.whitelist          - Comma-separated list of allowed email domains (takes priority over blacklist).
 * @property {string}           email.blacklist          - Comma-separated list of blocked email domains.
 * @property {boolean}          email.blockDisposable    - Block known disposable email domains.
 * @property {object}           ldap                     - LDAP configuration.
 * @property {boolean}          ldap.enabled             - Whether LDAP authentication is enabled.
 * @property {string}           ldap.host                - LDAP server hostname.
 * @property {number}           ldap.port                - LDAP server port.
 * @property {boolean}          ldap.ssl                 - Use LDAPS (SSL).
 * @property {boolean}          ldap.starttls             - Use STARTTLS.
 * @property {string}           ldap.baseDn              - Base DN for LDAP searches.
 * @property {string}           ldap.bindDn              - Bind DN for authenticated searches.
 * @property {string}           ldap.bindPassword        - Bind password.
 * @property {string}           ldap.attrsUsername       - Attribute for username lookup.
 * @property {string}           ldap.attrsEmail          - Attribute for email lookup.
 * @property {string}           ldap.attrsFullname       - Attribute for full name lookup.
 * @property {string}           ldap.attrsPhoto          - Attribute for photo lookup.
 * @property {string}           ldap.userQuery           - LDAP filter template for user search.
 * @property {object}           oidc                     - OpenID Connect configuration.
 * @property {string}           oidc.clientId           - OAuth2 client ID.
 * @property {string}           oidc.clientSecret       - OAuth2 client secret.
 * @property {string}           oidc.baseUri            - IdP base URI for auto-discovery.
 * @property {string}           oidc.authUri            - Override authorization endpoint.
 * @property {string}           oidc.tokenUri           - Override token endpoint.
 * @property {string}           oidc.userUri            - Override userinfo endpoint.
 * @property {string}           oidc.scopes             - OAuth scopes (default: 'openid profile email').
 * @property {string}           oidc.roles              - Required roles for access.
 * @property {string}           oidc.rolesAttr          - Attribute path for roles in user info.
 * @property {string}           oidc.emailAttr          - Attribute path for email.
 * @property {string}           oidc.nameAttr           - Attribute path for display name.
 * @property {string}           oidc.userInfoSource      - 'auto', 'token', or 'userinfo'.
 * @property {object}           google                  - Google OAuth configuration.
 * @property {string}           google.clientId         - Google OAuth client ID.
 * @property {string}           google.clientSecret     - Google OAuth client secret.
 * @property {object}           github                  - GitHub OAuth configuration.
 * @property {string}           github.clientId         - GitHub OAuth client ID.
 * @property {string}           github.clientSecret      - GitHub OAuth client secret.
 * @property {object}           gitlab                  - GitLab OAuth configuration.
 * @property {string}           gitlab.clientId         - GitLab OAuth client ID.
 * @property {string}           gitlab.clientSecret     - GitLab OAuth client secret.
 * @property {string}           gitlab.baseUri          - GitLab base URI.
 * @property {object}           media                    - Media/asset configuration.
 * @property {number}           media.maxFileSize        - Maximum upload file size in bytes.
 * @property {object}           font                     - Font configuration.
 * @property {number}           font.maxFileSize         - Maximum font file size in bytes.
 * @property {string}           initialProjectSkey       - Shared key for initial project access.
 */

/** @type {AppConfig} */
export const config = Object.freeze({
  database: {
    path: env('PENPOT_DATABASE_PATH', 'penpot.sqlite'),
  },
  http: {
    host: env('PENPOT_HTTP_HOST', '0.0.0.0'),
    port: env('PENPOT_HTTP_PORT', 6060),
    maxBodySize: env('PENPOT_HTTP_MAX_BODY_SIZE', 350 * 1024 * 1024),
  },
  auth: {
    secretKey: env('PENPOT_SECRET_KEY', 'penpot-dev-secret-key-change-me'),
    cookieName: env('PENPOT_AUTH_TOKEN_COOKIE_NAME', 'auth-token'),
    cookieMaxAge: env('PENPOT_AUTH_TOKEN_COOKIE_MAX_AGE', 7 * 24 * 3600),
    sessionRenewalAge: env('PENPOT_AUTH_SESSION_RENEWAL_AGE', 6 * 3600),
  },
   publicUri,
  exporterUri: env('PENPOT_EXPORTER_URI', 'http://localhost:6061'),
  host: env('PENPOT_HOST', 'localhost'),
  tenant: env('PENPOT_TENANT', 'default'),
  corsOrigin: env('PENPOT_CORS_ORIGIN', '*'),
  flags: mergedFlags,
  storage: {
    backend: env('PENPOT_STORAGE_BACKEND', 'fs'),
    fsDirectory: env('PENPOT_STORAGE_FS_DIRECTORY', 'assets'),
    s3: {
      bucket: env('PENPOT_STORAGE_S3_BUCKET', ''),
      region: env('PENPOT_STORAGE_S3_REGION', 'us-east-1'),
      endpoint: env('PENPOT_STORAGE_S3_ENDPOINT', ''),
      prefix: env('PENPOT_STORAGE_S3_PREFIX', ''),
      accessKey: env('PENPOT_STORAGE_S3_ACCESS_KEY', ''),
      secretKey: env('PENPOT_STORAGE_S3_SECRET_KEY', ''),
      pathStyle: env('PENPOT_STORAGE_S3_PATH_STYLE', false),
    },
  },
   smtp: {
     enabled: env('PENPOT_SMTP_ENABLED', false),
     host: env('PENPOT_SMTP_HOST', ''),
     port: env('PENPOT_SMTP_PORT', 587),
     username: env('PENPOT_SMTP_USERNAME', ''),
     password: env('PENPOT_SMTP_PASSWORD', ''),
     defaultFrom: env('PENPOT_SMTP_DEFAULT_FROM', 'Penpot <no-reply@example.com>'),
     defaultReplyTo: env('PENPOT_SMTP_DEFAULT_REPLY_TO', 'Penpot <no-reply@example.com>'),
     ssl: env('PENPOT_SMTP_SSL', false),
     tls: env('PENPOT_SMTP_TLS', false),
   },
   email: {
     whitelist: env('PENPOT_EMAIL_WHITELIST', ''),
     blacklist: env('PENPOT_EMAIL_BLACKLIST', ''),
     blockDisposable: env('PENPOT_EMAIL_BLOCK_DISPOSABLE', false),
   },
  ldap: {
    enabled: env('PENPOT_LDAP_ENABLED', false),
    host: env('PENPOT_LDAP_HOST', ''),
    port: env('PENPOT_LDAP_PORT', 389),
    ssl: env('PENPOT_LDAP_SSL', false),
    starttls: env('PENPOT_LDAP_STARTTLS', false),
    baseDn: env('PENPOT_LDAP_BASE_DN', ''),
    bindDn: env('PENPOT_LDAP_BIND_DN', ''),
    bindPassword: env('PENPOT_LDAP_BIND_PASSWORD', ''),
    attrsUsername: env('PENPOT_LDAP_ATTRS_USERNAME', 'uid'),
    attrsEmail: env('PENPOT_LDAP_ATTRS_EMAIL', 'mail'),
    attrsFullname: env('PENPOT_LDAP_ATTRS_FULLNAME', 'cn'),
    attrsPhoto: env('PENPOT_LDAP_ATTRS_PHOTO', 'jpegPhoto'),
    userQuery: env('PENPOT_LDAP_USER_QUERY', '(|(uid=:username)(mail=:username))'),
  },
  oidc: {
    clientId: env('PENPOT_OIDC_CLIENT_ID', ''),
    clientSecret: env('PENPOT_OIDC_CLIENT_SECRET', ''),
    baseUri: env('PENPOT_OIDC_BASE_URI', ''),
    authUri: env('PENPOT_OIDC_AUTH_URI', ''),
    tokenUri: env('PENPOT_OIDC_TOKEN_URI', ''),
    userUri: env('PENPOT_OIDC_USER_URI', ''),
    scopes: env('PENPOT_OIDC_SCOPES', 'openid profile email'),
    roles: env('PENPOT_OIDC_ROLES', ''),
    rolesAttr: env('PENPOT_OIDC_ROLES_ATTR', 'roles'),
    emailAttr: env('PENPOT_OIDC_EMAIL_ATTR', 'email'),
    nameAttr: env('PENPOT_OIDC_NAME_ATTR', 'name'),
    userInfoSource: env('PENPOT_OIDC_USER_INFO_SOURCE', 'auto'),
  },
  google: {
    clientId: env('PENPOT_GOOGLE_CLIENT_ID', ''),
    clientSecret: env('PENPOT_GOOGLE_CLIENT_SECRET', ''),
  },
  github: {
    clientId: env('PENPOT_GITHUB_CLIENT_ID', ''),
    clientSecret: env('PENPOT_GITHUB_CLIENT_SECRET', ''),
  },
  gitlab: {
    clientId: env('PENPOT_GITLAB_CLIENT_ID', ''),
    clientSecret: env('PENPOT_GITLAB_CLIENT_SECRET', ''),
    baseUri: env('PENPOT_GITLAB_BASE_URI', 'https://gitlab.com'),
  },
  media: {
    maxFileSize: env('PENPOT_MEDIA_MAX_FILE_SIZE', 30 * 1024 * 1024),
  },
  font: {
    maxFileSize: env('PENPOT_FONT_MAX_FILE_SIZE', 30 * 1024 * 1024),
  },
  telemetry: {
    enabled: env('PENPOT_TELEMETRY_ENABLED', false),
    uri: env('PENPOT_TELEMETRY_URI', 'https://telemetry.penpot.app/'),
    referer: env('PENPOT_TELEMETRY_REFERER', ''),
  },
  initialProjectSkey: env('PENPOT_INITIAL_PROJECT_SKEY', 'initial-project'),
  templatesPath: env('PENPOT_TEMPLATES_PATH', ''),
  frontendDir: env('PENPOT_FRONTEND_DIR', ''),
});

/**
 * Check whether a feature flag is enabled.
 *
 * Accepts both hyphenated (`'login-with-password'`) and underscored (`'login_with_password'`)
 * forms — hyphens are normalised to underscores before lookup.
 *
 * @param {string} name - Feature flag name (e.g. `'registration'`, `'login-with-password'`).
 * @returns {boolean} `true` if the flag is enabled, `false` otherwise.
 *
 * @example
 * flagEnabled('registration');        // true
 * flagEnabled('login-with-password'); // true
 * flagEnabled('mcp');                 // true
 */
export function flagEnabled(name) {
  return !!mergedFlags[name.replace(/-/g, '_')];
}