// ── helpers ──────────────────────────────────────────────────────────────────

const toHex = arr => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: toHex(new Uint8Array(bits)), salt: toHex(salt) };
}

async function verifyPassword(password, storedHash, storedSalt) {
  const salt = new Uint8Array(storedSalt.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return toHex(new Uint8Array(bits)) === storedHash;
}

function generateToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function getSession(request, db) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;
  const now = new Date().toISOString();
  return db.prepare(
    'SELECT s.user_id AS id, u.email, u.username, u.is_admin AS isAdmin, u.plan, u.plan_tier AS planTier ' +
    'FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?'
  ).bind(token, now).first();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function mapUser(u) {
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

// ── route handlers ────────────────────────────────────────────────────────────

async function handleAuthSignup(request, env) {
  try {
    const { email, username, password } = await request.json();
    if (!email || !username || !password) return json({ ok: false, error: 'Missing fields.' }, 400);
    if (password.length < 8) return json({ ok: false, error: 'Password must be at least 8 characters.' }, 400);
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return json({ ok: false, error: 'Invalid username.' }, 400);

    const norm = email.toLowerCase().trim();
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(norm, username).first();
    if (existing) return json({ ok: false, error: 'Email or username already taken.' }, 409);

    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO users (id, email, username, password_hash, salt, plan, is_admin, provider, joined_at) VALUES (?, ?, ?, ?, ?, 'free', 0, 'email', ?)"
    ).bind(id, norm, username, hash, salt, now).run();

    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, id, expires).run();

    return json({ ok: true, session: { token, userId: id, email: norm, username, isAdmin: false } });
  } catch (e) {
    return json({ ok: false, error: 'Server error.' }, 500);
  }
}

async function handleAuthLogin(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return json({ ok: false, error: 'Missing fields.' }, 400);

    const norm = email.toLowerCase().trim();
    const user = await env.DB.prepare(
      "SELECT id, email, username, password_hash, salt, is_admin FROM users WHERE email = ? AND provider = 'email'"
    ).bind(norm).first();

    if (!user || !user.password_hash) return json({ ok: false, error: 'Incorrect email or password.' }, 401);

    const ok = await verifyPassword(password, user.password_hash, user.salt);
    if (!ok) return json({ ok: false, error: 'Incorrect email or password.' }, 401);

    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expires).run();

    return json({ ok: true, session: { token, userId: user.id, email: user.email, username: user.username, isAdmin: !!user.is_admin } });
  } catch (e) {
    return json({ ok: false, error: 'Server error.' }, 500);
  }
}

async function handleAuthGoogle(request, env) {
  try {
    const { email, username, googleId, profilePic } = await request.json();
    if (!email || !googleId) return json({ ok: false, error: 'Missing fields.' }, 400);

    const norm = email.toLowerCase().trim();
    let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(norm).first();

    if (!user) {
      let base = (username || norm.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) || 'user';
      let uname = base;
      let counter = 1;
      while (await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(uname).first()) {
        uname = base + counter++;
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO users (id, email, username, profile_pic, plan, is_admin, provider, google_id, joined_at) VALUES (?, ?, ?, ?, 'free', 0, 'google', ?, ?)"
      ).bind(id, norm, uname, profilePic || null, googleId, now).run();
      user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    } else if (profilePic && !user.profile_pic) {
      await env.DB.prepare('UPDATE users SET profile_pic = ? WHERE id = ?').bind(profilePic, user.id).run();
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expires).run();

    return json({ ok: true, session: { token, userId: user.id, email: user.email, username: user.username, isAdmin: !!user.is_admin } });
  } catch (e) {
    return json({ ok: false, error: 'Server error.' }, 500);
  }
}

async function handleAuthLogout(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}

async function handleAdminUsers(request, env) {
  const session = await getSession(request, env.DB);
  if (!session || !session.isAdmin) return json({ ok: false, error: 'Forbidden.' }, 403);

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY joined_at DESC').all();
    return json(results.map(mapUser));
  }

  if (request.method === 'POST') {
    try {
      const { email, username, plan, planTier } = await request.json();
      if (!email || !username) return json({ ok: false, error: 'email and username are required.' }, 400);
      const norm = email.toLowerCase().trim();
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(norm).first();
      if (existing) return json({ ok: false, error: 'Email already exists.' }, 409);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const isPro = plan === 'pro';
      await env.DB.prepare(
        "INSERT INTO users (id, email, username, plan, plan_tier, plan_started_at, is_admin, provider, joined_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'email', ?)"
      ).bind(id, norm, username, plan || 'free', planTier || null, isPro ? now : null, now).run();
      const newUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      return json({ ok: true, user: mapUser(newUser) });
    } catch (e) {
      return json({ ok: false, error: 'Server error.' }, 500);
    }
  }

  return json({ ok: false, error: 'Method not allowed.' }, 405);
}

async function handleAdminUsersById(request, env, userId) {
  const session = await getSession(request, env.DB);
  if (!session || !session.isAdmin) return json({ ok: false, error: 'Forbidden.' }, 403);

  if (request.method === 'GET') {
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    if (!user) return json({ ok: false, error: 'Not found.' }, 404);
    return json(mapUser(user));
  }

  if (request.method === 'PATCH') {
    try {
      const body = await request.json();
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
      if (!user) return json({ ok: false, error: 'Not found.' }, 404);

      const updates = [];
      const values = [];

      if (body.plan !== undefined)          { updates.push('plan = ?');           values.push(body.plan); }
      if (body.planTier !== undefined)      { updates.push('plan_tier = ?');      values.push(body.planTier || null); }
      if (body.planStartedAt !== undefined) { updates.push('plan_started_at = ?'); values.push(body.planStartedAt || null); }
      if (body.username !== undefined)      { updates.push('username = ?');       values.push(body.username); }
      if (body.bio !== undefined)           { updates.push('bio = ?');            values.push(body.bio); }
      if (body.profilePic !== undefined)    { updates.push('profile_pic = ?');    values.push(body.profilePic || null); }
      if (body.xp !== undefined)            { updates.push('xp = ?');             values.push(body.xp); }

      if (body.password) {
        const { hash, salt } = await hashPassword(body.password);
        updates.push('password_hash = ?'); values.push(hash);
        updates.push('salt = ?');          values.push(salt);
      }

      if (updates.length > 0) {
        values.push(userId);
        await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
      }

      const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
      return json({ ok: true, user: mapUser(updated) });
    } catch (e) {
      return json({ ok: false, error: 'Server error.' }, 500);
    }
  }

  if (request.method === 'DELETE') {
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    if (!user) return json({ ok: false, error: 'Not found.' }, 404);
    if (user.is_admin) return json({ ok: false, error: 'Cannot delete the admin account.' }, 403);
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Method not allowed.' }, 405);
}

async function handleUserMe(request, env) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.id).first();
  if (!user) return json({ ok: false, error: 'Not found.' }, 404);
  return json({ ok: true, user: mapUser(user) });
}

async function handleUserCancelSubscription(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
  const session = await getSession(request, env.DB);
  if (!session) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.id).first();
  if (!user) return json({ ok: false, error: 'Not found.' }, 404);
  if (user.plan !== 'pro') return json({ ok: false, error: 'No active Pro subscription to cancel.' }, 400);
  await env.DB.prepare("UPDATE users SET plan = 'free', plan_tier = NULL, plan_started_at = NULL WHERE id = ?").bind(session.id).run();
  return json({ ok: true });
}

// ── main entry point ──────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/auth/signup')               return handleAuthSignup(request, env);
      if (path === '/api/auth/login')                return handleAuthLogin(request, env);
      if (path === '/api/auth/google')               return handleAuthGoogle(request, env);
      if (path === '/api/auth/logout')               return handleAuthLogout(request, env);
      if (path === '/api/user/me')                   return handleUserMe(request, env);
      if (path === '/api/user/subscription/cancel')  return handleUserCancelSubscription(request, env);
      if (path === '/api/admin/users')               return handleAdminUsers(request, env);

      const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (adminUserMatch) return handleAdminUsersById(request, env, adminUserMatch[1]);
    } catch (e) {
      return json({ ok: false, error: 'Server error.' }, 500);
    }

    return env.ASSETS.fetch(request);
  }
};
