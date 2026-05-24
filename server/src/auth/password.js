/**
 * @module auth/password
 * @description Password hashing and verification — mirrors `app.auth.password`
 * from the Clojure backend.
 *
 * Uses Argon2id (the OWASP-recommended variant) for all hashing operations.
 * The `verifyPassword` function also checks whether a hash needs rehashing
 * (e.g. if cost parameters change), allowing transparent upgrade of stored hashes.
 */

import * as argon2 from 'argon2';

/**
 * Argon2id parameters matching the Clojure backend's default cost profile.
 *
 * @type {{ type: number, memoryCost: number, timeCost: number, parallelism: number }}
 */
const PASSWORD_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 32768,  // 32 MiB
  timeCost: 3,
  parallelism: 2,
};

/**
 * Derive (hash) a plaintext password using Argon2id.
 *
 * Produces an encoded hash string that includes the salt, algorithm parameters,
 * and version. Compatible with both verification and rehashing checks.
 *
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} An Argon2id encoded hash string.
 *
 * @example
 * const hash = await derivePassword('my-secret');
 * // $argon2id$v=19$m=32768,t=3,p=2$...
 */
export async function derivePassword(password) {
  return argon2.hash(password, PASSWORD_OPTIONS);
}

/**
 * Verify a plaintext password against a stored Argon2 hash.
 *
 * Also checks whether the hash needs rehashing (e.g. if the cost parameters
 * have been increased since the hash was generated), allowing callers to
 * transparently upgrade stored hashes.
 *
 * @param {string} hash - The stored Argon2 hash string.
 * @param {string} password - The plaintext password to verify.
 * @returns {Promise<{ valid: boolean, update: boolean }>}
 *   - `valid` — `true` if the password matches the hash.
 *   - `update` — `true` if the hash should be re-deriving (parameters outdated).
 *
 * @example
 * const { valid, update } = await verifyPassword(storedHash, userInput);
 * if (!valid) throw new Error('Invalid credentials');
 * if (update) {
 *   const newHash = await derivePassword(userInput);
 *   // store newHash
 * }
 */
export async function verifyPassword(hash, password) {
  try {
    const valid = await argon2.verify(hash, password);
    const needsRehash = valid ? await argon2.needsRehash(hash, PASSWORD_OPTIONS) : false;
    return { valid, update: needsRehash };
  } catch {
    return { valid: false, update: false };
  }
}

/**
 * Check whether a profile's password field represents "no password set".
 *
 * In the Clojure backend, accounts created via SSO (or without a password)
 * store the literal string `'!'` as the password hash. This function detects
 * that sentinel value.
 *
 * @param {string|null} passwordHash - The stored password hash string.
 * @returns {boolean} `true` if the account has no password (SSO-only).
 *
 * @example
 * if (isNoPasswordSet(profile.password)) {
 *   throw new Error('This account uses SSO authentication');
 * }
 */
export function isNoPasswordSet(passwordHash) {
  return passwordHash === '!';
}