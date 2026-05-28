'use strict';
/**
 * @module auth/index
 * @description Authentication utilities re-exported for convenience.
 */

export { derivePassword as hashPassword, verifyPassword, isNoPasswordSet } from './password.js';
export { createToken as generateToken, verifyToken, createSessionToken, createRegistrationToken, createPasswordRecoveryToken, createVerifyEmailToken } from './tokens.js';
import { createSessionToken } from './tokens.js';

export async function createSession(pool, profileId) {
  const sessionId = crypto.randomUUID();
  const token = await createSessionToken(profileId, sessionId);

  pool.run(
    `INSERT INTO http_session (id, profile_id, created_at) VALUES (?, ?, ?)`,
    [sessionId, profileId, new Date().toISOString()]
  );

  return { token, sessionId };
}

export function stripPrivateAttrs(profile) {
  if (!profile) return profile;
  const { password, ...safe } = profile;
  return safe;
}