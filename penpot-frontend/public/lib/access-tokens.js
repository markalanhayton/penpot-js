import { cmd } from './rpc.js';

export async function getAccessTokens() {
  try {
    const tokens = await cmd('get-access-tokens');
    return Array.isArray(tokens) ? tokens : [];
  } catch (err) {
    console.error('[access-tokens] get error:', err);
    return [];
  }
}

export async function createAccessToken(name = 'API Token') {
  try {
    const token = await cmd('create-access-token', { name });
    return token;
  } catch (err) {
    console.error('[access-tokens] create error:', err);
    throw err;
  }
}

export async function deleteAccessToken(tokenId) {
  try {
    await cmd('delete-access-token', { id: tokenId });
    return true;
  } catch (err) {
    console.error('[access-tokens] delete error:', err);
    return false;
  }
}

export function maskToken(token) {
  if (!token) return '';
  const str = String(token);
  if (str.length <= 8) return str;
  return str.slice(0, 4) + '...' + str.slice(-4);
}