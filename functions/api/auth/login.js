import { verifyPassword, generateToken, json } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return json({ ok: false, error: 'Missing fields.' }, 400);

    const norm = email.toLowerCase().trim();
    const user = await env.DB.prepare(
      "SELECT id, email, username, password_hash, salt, is_admin FROM users WHERE email = ? AND provider = 'email'"
    ).bind(norm).first();

    if (!user || !user.password_hash) {
      return json({ ok: false, error: 'Incorrect email or password.' }, 401);
    }

    const ok = await verifyPassword(password, user.password_hash, user.salt);
    if (!ok) return json({ ok: false, error: 'Incorrect email or password.' }, 401);

    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(token, user.id, expires).run();

    return json({
      ok: true,
      session: { token, userId: user.id, email: user.email, username: user.username, isAdmin: !!user.is_admin }
    });
  } catch (e) {
    return json({ ok: false, error: 'Server error.' }, 500);
  }
}
