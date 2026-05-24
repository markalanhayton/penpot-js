/**
 * @module auth/tokens
 * @description JWE token creation and verification — mirrors `app.tokens`
 * from the Clojure backend.
 *
 * Uses the `jose` library with A256KW/A256GCM encryption (JWE) for all tokens,
 * matching the Clojure backend's JWE-based session and registration tokens.
 * The encryption key is derived from the `PENPOT_SECRET_KEY` environment variable.
 *
 * ### Token types
 *
 * | Issuer (`iss`)            | Purpose                                  | TTL   |
 * |---------------------------|------------------------------------------|-------|
 * | `'authentication'`        | Session cookie (`auth-token`)            | 7d    |
 * | `'prepared-register'`     | Registration email verification          | 7d    |
 * | `'password-recovery'`     | Password reset link                      | 15m   |
 * | `'verify-email'`          | Email address verification                | 15m   |
 */

import { SignJWT, jwtDecrypt, EncryptJWT, importJWK, exportJWK, generateSecret } from 'jose';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

/** @type {CryptoKey|null} Cached JWE key derived from `config.auth.secretKey`. */
let _tokensKey = null;

/**
 * Derive or retrieve the cached JWE encryption key.
 *
 * The key is derived from `PENPOT_SECRET_KEY` by:
 * 1. UTF-8-encoding the secret,
 * 2. Taking the first 32 bytes (or zero-padding if shorter),
 * 3. Base64url-encoding for `jose`'s `importJWK`.
 *
 * @returns {Promise<CryptoKey>} The A256KW encryption key.
 */
async function getTokensKey() {
  if (_tokensKey) return _tokensKey;

  const secret = config.auth.secretKey;
  console.log('[tokens] Deriving key from secret (length:', secret.length, ')');
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  if (keyData.length >= 32) {
    _tokensKey = await importJWK({ k: base64urlEncode(keyData.subarray(0, 32)), kty: 'oct' }, 'A256KW');
  } else {
    const padded = new Uint8Array(32);
    padded.set(keyData);
    _tokensKey = await importJWK({ k: base64urlEncode(padded), kty: 'oct' }, 'A256KW');
  }
  return _tokensKey;
}

/**
 * Base64url-encode a byte buffer (without padding).
 *
 * @param {Uint8Array|Buffer} buffer - Raw bytes.
 * @returns {string} Base64url-encoded string.
 */
function base64urlEncode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

/**
 * Create an encrypted JWE token with arbitrary claims.
 *
 * @param {Record<string, *>} claims - Payload claims (e.g. `{ iss, uid, sid }`).
 * @param {string} [expiresIn='7d'] - Expiration duration (e.g. `'15m'`, `'7d'`).
 *   Pass `null` to omit expiration.
 * @returns {Promise<string>} The encrypted JWE string.
 *
 * @example
 * const token = await createToken({ iss: 'authentication', uid: profileId, sid: sessionId });
 */
export async function createToken(claims, expiresIn = '7d') {
  const key = await getTokensKey();
  const jwt = new EncryptJWT({ ...claims, jti: uuidv4() })
    .setProtectedHeader({ alg: 'A256KW', enc: 'A256GCM' })
    .setIssuer(claims.iss || 'penpot')
    .setAudience('penpot')
    .setIssuedAt();

  if (expiresIn) {
    jwt.setExpirationTime(expiresIn);
  }

  return jwt.encrypt(key);
}

/**
 * Verify and decrypt a JWE token, returning its claims.
 *
 * @param {string} token - The encrypted JWE string.
 * @returns {Promise<{ valid: boolean, claims: Record<string, *>|null }>}
 *   - `valid` — `true` if the token was successfully decrypted and not expired.
 *   - `claims` — The decrypted payload, or `null` if verification failed.
 *
 * @example
 * const { valid, claims } = await verifyToken(cookieToken);
 * if (!valid || claims?.iss !== 'authentication') throw new Error('Invalid session');
 */
export async function verifyToken(token) {
  const key = await getTokensKey();
  try {
    const { payload } = await jwtDecrypt(token, key);
    return { valid: true, claims: payload };
  } catch (err) {
    console.error('[tokens] verifyToken failed:', err.message?.substring(0, 100), 'token_len:', token?.length);
    return { valid: false, claims: null };
  }
}

/**
 * Create an authentication session token (stored in the `auth-token` cookie).
 *
 * @param {string} profileId - The profile UUID of the authenticated user.
 * @param {string} sessionId - The HTTP session UUID.
 * @param {Record<string, *>} [extra={}] - Additional claims to embed.
 * @returns {Promise<string>} The encrypted JWE token string.
 *
 * @example
 * const token = await createSessionToken(profile.id, sessionId);
 */
export async function createSessionToken(profileId, sessionId, extra = {}) {
  return createToken({
    iss: 'authentication',
    aud: 'penpot',
    sid: sessionId,
    uid: profileId,
    ...extra,
  }, `${config.auth.cookieMaxAge}s`);
}

/**
 * Create a registration verification token (emailed to the user).
 *
 * Embeds the raw password hash so the user can complete registration
 * without re-entering credentials — mirrors the Clojure backend's
 * `:prepared-register` token issuer.
 *
 * @param {string} email - The registrant's email address.
 * @param {string} fullname - The registrant's display name.
 * @param {string} password - The plaintext password (will be hashed on `register-profile`).
 * @returns {Promise<string>} The encrypted JWE token string (7-day TTL).
 */
export async function createRegistrationToken(email, fullname, password) {
  return createToken({
    iss: 'prepared-register',
    email,
    fullname,
    password,
  }, '7d');
}

/**
 * Create a password-recovery token.
 *
 * @param {string} profileId - The profile UUID of the user requesting recovery.
 * @returns {Promise<string>} The encrypted JWE token string (15-minute TTL).
 */
export async function createPasswordRecoveryToken(profileId) {
  return createToken({
    iss: 'password-recovery',
    uid: profileId,
  }, '15m');
}

/**
 * Create an email-verification token.
 *
 * @param {string} profileId - The profile UUID whose email is being verified.
 * @returns {Promise<string>} The encrypted JWE token string (15-minute TTL).
 */
export async function createVerifyEmailToken(profileId) {
  return createToken({
    iss: 'verify-email',
    uid: profileId,
  }, '15m');
}