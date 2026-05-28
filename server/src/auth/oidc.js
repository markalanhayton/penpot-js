'use strict';
/**
 * @module auth/oidc
 * @description OpenID Connect (OIDC) authentication — mirrors `app.auth.oidc`
 * from the Clojure backend.
 *
 * Supports:
 * - Generic OIDC providers (auto-discovery or manual config)
 * - Google, GitHub, GitLab built-in providers
 * - Custom SSO providers from the database
 *
 * ### Flow
 *
 * 1. Frontend calls `get-oidc-redirect-uri` → returns auth URL
 * 2. Browser redirects to IdP → user authenticates
 * 3. IdP redirects back to `/api/auth/oidc/callback?code=...&state=...`
 * 4. Callback handler exchanges code for tokens, gets user info
 * 5. Profile is looked up by email; if found, session is created;
 *    if not found, registration flow is initiated.
 *
 * ### Environment variables
 *
 * | Variable                         | Description                          |
 * |----------------------------------|--------------------------------------|
 * | `PENPOT_OIDC_CLIENT_ID`         | OAuth2 client ID                     |
 * | `PENPOT_OIDC_CLIENT_SECRET`     | OAuth2 client secret                  |
 * | `PENPOT_OIDC_BASE_URI`           | IdP base URI for discovery            |
 * | `PENPOT_OIDC_TOKEN_URI`          | Override token endpoint               |
 * | `PENPOT_OIDC_AUTH_URI`           | Override authorization endpoint       |
 * | `PENPOT_OIDC_USER_URI`           | Override userinfo endpoint             |
 * | `PENPOT_OIDC_SCOPES`             | Scopes (default: openid profile email)|
 * | `PENPOT_OIDC_ROLES`              | Required roles for access              |
 * | `PENPOT_OIDC_EMAIL_ATTR`        | Email attribute name (default: email) |
 * | `PENPOT_OIDC_NAME_ATTR`          | Name attribute name (default: name)   |
 * | `PENPOT_OIDC_USER_INFO_SOURCE`  | 'auto', 'token', or 'userinfo'        |
 * | `PENPOT_GOOGLE_CLIENT_ID`        | Google OAuth client ID                |
 * | `PENPOT_GOOGLE_CLIENT_SECRET`    | Google OAuth client secret            |
 * | `PENPOT_GITHUB_CLIENT_ID`        | GitHub OAuth client ID                |
 * | `PENPOT_GITHUB_CLIENT_SECRET`    | GitHub OAuth client secret            |
 * | `PENPOT_GITLAB_CLIENT_ID`        | GitLab OAuth client ID                |
 * | `PENPOT_GITLAB_CLIENT_SECRET`    | GitLab OAuth client secret            |
 * | `PENPOT_GITLAB_BASE_URI`         | GitLab base URI (default: https://gitlab.com) |
 */

import { config, flagEnabled } from '../config/index.js';
import { createToken, verifyToken } from './tokens.js';
import { rowToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';
import { v4 as uuidv4 } from 'uuid';

/** @type {Map<string, object>} Built-in provider configs, keyed by ID. */
const builtinProviders = new Map();

/**
 * Build and register built-in OIDC providers from environment config.
 */
function registerBuiltinProviders() {
  const publicUri = config.publicUri;
  const callbackPath = '/api/auth/oidc/callback';

  // Generic OIDC
  if (config.oidc?.clientId && config.oidc?.clientSecret) {
    builtinProviders.set('oidc', {
      id: 'oidc',
      type: 'oidc',
      name: 'OIDC',
      clientId: config.oidc.clientId,
      clientSecret: config.oidc.clientSecret,
      authUri: config.oidc.authUri || null,
      tokenUri: config.oidc.tokenUri || null,
      userUri: config.oidc.userUri || null,
      baseUri: config.oidc.baseUri || null,
      scopes: config.oidc.scopes || 'openid profile email',
      roles: config.oidc.roles || null,
      rolesAttr: config.oidc.rolesAttr || 'roles',
      emailAttr: config.oidc.emailAttr || 'email',
      nameAttr: config.oidc.nameAttr || 'name',
      userInfoSource: config.oidc.userInfoSource || 'auto',
      redirectUri: `${publicUri}${callbackPath}`,
    });
  }

  // Google
  if (config.google?.clientId && config.google?.clientSecret) {
    builtinProviders.set('google', {
      id: 'google',
      type: 'google',
      name: 'Google',
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      authUri: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUri: 'https://oauth2.googleapis.com/token',
      userUri: 'https://openidconnect.googleapis.com/v1/userinfo',
      scopes: 'openid profile email',
      redirectUri: `${publicUri}${callbackPath}`,
      pictureAttr: 'picture',
    });
  }

  // GitHub
  if (config.github?.clientId && config.github?.clientSecret) {
    builtinProviders.set('github', {
      id: 'github',
      type: 'github',
      name: 'GitHub',
      clientId: config.github.clientId,
      clientSecret: config.github.clientSecret,
      authUri: 'https://github.com/login/oauth/authorize',
      tokenUri: 'https://github.com/login/oauth/access_token',
      userUri: 'https://api.github.com/user',
      emailUri: 'https://api.github.com/user/emails',
      scopes: 'user:email',
      redirectUri: `${publicUri}${callbackPath}`,
    });
  }

  // GitLab
  if (config.gitlab?.clientId && config.gitlab?.clientSecret) {
    const baseUri = config.gitlab.baseUri || 'https://gitlab.com';
    builtinProviders.set('gitlab', {
      id: 'gitlab',
      type: 'gitlab',
      name: 'GitLab',
      clientId: config.gitlab.clientId,
      clientSecret: config.gitlab.clientSecret,
      authUri: `${baseUri}/oauth/authorize`,
      tokenUri: `${baseUri}/oauth/token`,
      userUri: `${baseUri}/api/v4/user`,
      scopes: 'openid profile email',
      redirectUri: `${publicUri}${callbackPath}`,
    });
  }
}

registerBuiltinProviders();

/**
 * Resolve a provider by ID. Checks built-in providers first, then the
 * database for custom SSO providers.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} providerId - Provider identifier ('google', 'github', 'gitlab', 'oidc', or a UUID).
 * @returns {Promise<object|null>} Provider config object, or null if not found.
 */
async function resolveProvider(pool, providerId) {
  const builtin = builtinProviders.get(providerId);
  if (builtin) return builtin;

  // Look up custom SSO provider from database
  const row = pool.get(
    "SELECT * FROM sso_provider WHERE id = ? AND is_enabled = '1'",
    [providerId]
  );
  if (!row) return null;

  let scopes = 'openid profile email';
  try { scopes = typeof row.scopes === 'string' ? row.scopes : JSON.parse(row.scopes || '[]').join(' '); } catch { /* use default */ }

  let roles = null;
  try { roles = typeof row.roles === 'string' ? row.roles.split(',').map(r => r.trim()) : JSON.parse(row.roles || '[]'); } catch { /* null */ }

  return {
    id: row.id,
    type: row.type || 'oidc',
    name: row.name || 'SSO',
    clientId: row.client_id,
    clientSecret: row.client_secret,
    baseUri: row.base_uri || null,
    authUri: null,
    tokenUri: null,
    userUri: null,
    scopes,
    roles,
    redirectUri: `${config.publicUri}/api/auth/oidc/callback`,
    isCustom: true,
  };
}

/**
 * Perform OIDC discovery to fetch provider endpoints from the well-known config.
 *
 * @param {object} provider - Provider config with `baseUri`.
 * @returns {Promise<object>} Discovered endpoints (authUri, tokenUri, userUri, jwksUri).
 */
async function discoverOidcEndpoints(provider) {
  if (!provider.baseUri) {
    throw new RpcError('validation', 'oidc-discovery-failed', 'OIDC base URI is required for discovery');
  }

  const discoveryUrl = `${provider.baseUri.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new RpcError('validation', 'oidc-discovery-failed', `OIDC discovery failed: ${response.status}`);
  }

  const doc = await response.json();
  return {
    authUri: doc.authorization_endpoint,
    tokenUri: doc.token_endpoint,
    userUri: doc.userinfo_endpoint,
    jwksUri: doc.jwks_uri,
    endSessionUri: doc.end_session_endpoint,
  };
}

/**
 * Exchange an authorization code for access and ID tokens.
 *
 * @param {object} provider - Provider config.
 * @param {string} code - Authorization code from the IdP.
 * @returns {Promise<{ accessToken: string, idToken: string, tokenResponse: object }>}
 */
async function exchangeCodeForTokens(provider, code) {
  const tokenUri = provider.tokenUri || (provider.discoveredEndpoints?.tokenUri);
  if (!tokenUri) {
    throw new RpcError('validation', 'oidc-misconfigured', 'No token endpoint configured');
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    redirect_uri: provider.redirectUri,
  });

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new RpcError('authentication', 'oidc-token-exchange-failed', `Token exchange failed: ${response.status} ${errorBody}`);
  }

  const tokenResponse = await response.json();
  return {
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    tokenResponse,
  };
}

/**
 * Extract user info from the IdP based on the configured source.
 *
 * @param {object} provider - Provider config.
 * @param {string} accessToken - OAuth2 access token.
 * @param {string} [idToken] - OIDC ID token (JWT).
 * @returns {Promise<{ email: string, fullname: string, emailVerified: boolean, picture: string|null, backend: string }>}
 */
async function getUserInfo(provider, accessToken, idToken) {
  let claims = {};
  let userInfo = {};

  // Parse ID token claims if available
  if (idToken) {
    try {
      const parts = idToken.split('.');
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch { /* ID token not parseable */ }
  }

  const source = provider.userInfoSource || 'auto';

  if (source === 'token' && Object.keys(claims).length > 0) {
    return extractUserInfo(provider, claims);
  }

  if (source === 'userinfo' || (source === 'auto' && (!claims.email || !claims.email_verified))) {
    const userUri = provider.userUri || provider.discoveredEndpoints?.userUri;
    if (userUri) {
      const response = await fetch(userUri, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        userInfo = await response.json();
      }
    }
  }

  const merged = { ...claims, ...userInfo };
  return extractUserInfo(provider, merged);
}

/**
 * Extract standardized user info fields from provider-specific data.
 */
function extractUserInfo(provider, data) {
  const emailAttr = provider.emailAttr || 'email';
  const nameAttr = provider.nameAttr || 'name';

  // GitHub-specific: fetch emails endpoint
  const email = data[emailAttr] || data.email || '';
  const fullname = data[nameAttr] || data.name || data.login || '';
  const emailVerified = data.email_verified !== undefined ? data.email_verified : false;
  const picture = data.picture || data.avatar_url || data.image || null;

  return { email: email.toLowerCase().trim(), fullname, emailVerified, picture };
}

/**
 * Build the OAuth2 authorization redirect URI.
 *
 * @param {object} provider - Provider config.
 * @param {string} state - Opaque state token for CSRF protection.
 * @returns {string} Authorization URL to redirect the user to.
 */
function buildAuthRedirectUri(provider, state) {
  const authUri = provider.authUri || provider.discoveredEndpoints?.authUri;
  if (!authUri) {
    throw new RpcError('validation', 'oidc-misconfigured', 'No authorization endpoint configured');
  }

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    response_type: 'code',
    scope: provider.scopes,
    state,
  });

  return `${authUri}?${params.toString()}`;
}

/**
 * Get or discover OIDC endpoints for a provider.
 * If the provider has explicit endpoints, use them. Otherwise, discover from baseUri.
 */
async function prepareProvider(provider) {
  if (provider.authUri && provider.tokenUri) return provider;
  if (!provider.baseUri && !provider.discoveredEndpoints) return provider;

  if (provider.baseUri && !provider.discoveredEndpoints) {
    const endpoints = await discoverOidcEndpoints(provider);
    return {
      ...provider,
      authUri: provider.authUri || endpoints.authUri,
      tokenUri: provider.tokenUri || endpoints.tokenUri,
      userUri: provider.userUri || endpoints.userUri,
      discoveredEndpoints: endpoints,
    };
  }

  return provider;
}

// --- RPC registration ---

export default function registerOidcCommands(register, pool) {

  /**
   * Get the OIDC redirect URI for the given provider.
   * Frontend calls this to initiate the OIDC login flow.
   */
  register('get-oidc-provider', {
    auth: false,
    added: '2.12',
    async handler(params) {
      const { email } = params;
      if (!email) return null;

      const trimmedEmail = (email || '').trim().toLowerCase();
      const domain = trimmedEmail.split('@')[1];

      // Check SSO provider table for a matching domain
      const ssoProvider = pool.get(
        "SELECT * FROM sso_provider WHERE domain = ? AND is_enabled = '1'",
        [domain]
      );

      if (!ssoProvider) return null;
      return { id: ssoProvider.id, name: ssoProvider.name, type: ssoProvider.type || 'oidc' };
    },
  });

  register('get-oidc-auth-uri', {
    auth: false,
    added: '1.15',
    async handler(params) {
      const { provider: providerId, invitationToken } = params;

      if (!providerId) {
        throw new RpcError('validation', 'validation-error', 'Provider ID is required');
      }

      const provider = await resolveProvider(pool, providerId);
      if (!provider) {
        throw new RpcError('not-found', 'provider-not-found', `Provider '${providerId}' not found`);
      }

      // Check feature flag
      const flagMap = {
        'google': 'login-with-google',
        'github': 'login-with-github',
        'gitlab': 'login-with-gitlab',
        'oidc': 'login-with-oidc',
      };
      const flag = flagMap[provider.type] || flagMap[providerId];
      if (flag && !flagEnabled(flag)) {
        throw new RpcError('authorization', 'provider-disabled', `Login with ${provider.name} is disabled`);
      }

      // Discover OIDC endpoints if needed
      const preparedProvider = await prepareProvider(provider);

      // Create state token
      const stateToken = await createToken({
        iss: 'oidc',
        provider: providerId,
        invitationToken: invitationToken || null,
      }, '4h');

      const redirectUri = buildAuthRedirectUri(preparedProvider, stateToken);
      return { redirectUri, state: stateToken };
    },
  });

  register('oidc-callback', {
    auth: false,
    added: '1.15',
    async handler(params) {
      const { code, state, error, errorDescription } = params;

      if (error) {
        throw new RpcError('authentication', 'oidc-auth-failed', errorDescription || error);
      }

      if (!code || !state) {
        throw new RpcError('validation', 'validation-error', 'Missing code or state parameter');
      }

      // Verify state token
      const { valid, claims } = await verifyToken(state);
      if (!valid || claims?.iss !== 'oidc') {
        throw new RpcError('validation', 'invalid-token', 'Invalid or expired OIDC state token');
      }

      const providerId = claims.provider;
      const provider = await resolveProvider(pool, providerId);
      if (!provider) {
        throw new RpcError('not-found', 'provider-not-found', `Provider '${providerId}' not found`);
      }

      const preparedProvider = await prepareProvider(provider);

      // Exchange code for tokens
      const { accessToken, idToken, tokenResponse } = await exchangeCodeForTokens(preparedProvider, code);

      // Get user info
      const userInfo = await getUserInfo(preparedProvider, accessToken, idToken);

      if (!userInfo.email) {
        throw new RpcError('validation', 'oidc-no-email', 'OIDC provider did not return an email address');
      }

      // Look up profile by email
      const profile = pool.get(
        'SELECT * FROM profile WHERE email = ? AND deleted_at IS NULL',
        [userInfo.email]
      );

      if (!profile) {
        // No profile found — check if registration is allowed
        if (!flagEnabled('registration') && !flagEnabled('oidc-registration')) {
          throw new RpcError('authorization', 'registration-disabled', 'Registration is disabled');
        }

        // Create registration token with OIDC info pre-filled
        const registerToken = await createToken({
          iss: 'prepared-register',
          email: userInfo.email,
          fullname: userInfo.fullname,
          authBackend: provider.type,
          emailVerified: userInfo.emailVerified,
          picture: userInfo.picture,
          invitationToken: claims.invitationToken || null,
        }, '48h');

        return {
          type: 'register',
          token: registerToken,
          provider: providerId,
          email: userInfo.email,
          fullname: userInfo.fullname,
          redirectUri: `${config.publicUri}/#/auth/register/validate?token=${encodeURIComponent(registerToken)}&provider=${encodeURIComponent(providerId)}`,
        };
      }

      // Profile found — check if blocked
      if (profile.is_blocked === '1') {
        throw new RpcError('authorization', 'profile-blocked', 'This account has been blocked');
      }

      // Check auth backend compatibility
      if (profile.auth_source && profile.auth_source !== provider.type && profile.auth_source !== 'oidc') {
        if (!userInfo.emailVerified) {
          throw new RpcError('authorization', 'auth-provider-not-allowed', 'This account uses a different authentication method');
        }
      }

      // Activate profile if not yet active
      if (profile.is_active !== '1') {
        pool.run("UPDATE profile SET is_active = '1', modified_at = ? WHERE id = ?", [new Date().toISOString(), profile.id]);
      }

      // Update profile with OIDC provider info
      let props = {};
      try { props = typeof profile.props === 'string' ? JSON.parse(profile.props || '{}') : (profile.props || {}); } catch { props = {}; }
      props[`${provider.type}-email`] = userInfo.email;
      if (userInfo.picture) {
        props[`${provider.type}-picture`] = userInfo.picture;
        pool.run('UPDATE profile SET props = ?, modified_at = ? WHERE id = ?', [JSON.stringify(props), new Date().toISOString(), profile.id]);
      } else {
        pool.run('UPDATE profile SET props = ?, modified_at = ? WHERE id = ?', [JSON.stringify(props), new Date().toISOString(), profile.id]);
      }

      // Create session
      const sessionId = uuidv4();
      const now = new Date().toISOString();
      pool.run(
        'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, profile.id, '', now, now, '1']
      );

      const sessionToken = await createSessionToken(profile.id, sessionId, {
        'sso-provider-id': providerId,
        ...(tokenResponse.sid ? { 'sso-session-id': tokenResponse.sid } : {}),
      });

      return {
        type: 'login',
        profile: rowToCamel(pool.get('SELECT * FROM profile WHERE id = ?', [profile.id])),
        token: sessionToken,
      };
    },
  });
}