import { hashPassword, generateToken, json } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email, username, password } = await request.json();

    if (!email || !username || !password) return json({ ok: false, error: 'Missing fields.' }, 400);
    if (password.length < 8) return json({ ok: false, error: 'Password must be at least 8 characters.' }, 400);
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return json({ ok: false, error: 'Invalid username.' }, 400);

    const norm = email.toLowerCase().trim();

    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? OR username = ?'
    ).bind(norm, username).first();
    if (existing) return json({ ok: false, error: 'Email or username already taken.' }, 409);

    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO users (id, email, username, password_hash, salt, plan, is_admin, provider, joined_at) VALUES (?, ?, ?, ?, ?, 'free', 0, 'email', ?)"
    ).bind(id, norm, username, hash, salt, now).run();

    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(token, id, expires).run();

    return json({ ok: true, session: { token, userId: id, email: norm, username, isAdmin: false } });
  } catch (e) {
    return json({ ok: false, error: 'Server error.' }, 500);
  }
}
