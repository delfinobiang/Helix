// Shared utilities for Helix Pages Functions

const toHex = arr => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: toHex(new Uint8Array(bits)), salt: toHex(salt) };
}

export async function verifyPassword(password, storedHash, storedSalt) {
  const salt = new Uint8Array(storedSalt.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return toHex(new Uint8Array(bits)) === storedHash;
}

export function generateToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function getSession(request, db) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;
  const now = new Date().toISOString();
  return db.prepare(
    'SELECT s.user_id AS id, u.email, u.username, u.is_admin AS isAdmin, u.plan, u.plan_tier AS planTier ' +
    'FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?'
  ).bind(token, now).first();
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function mapUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    profilePic: u.profile_pic || null,
    bio: u.bio || '',
    plan: u.plan || 'free',
    planTier: u.plan_tier || null,
    planStartedAt: u.plan_started_at || null,
    isAdmin: !!u.is_admin,
    provider: u.provider || 'email',
    joinedAt: u.joined_at,
    xp: u.xp || 0,
  };
}
