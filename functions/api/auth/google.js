import { generateToken, json } from '../_lib.js';

export async function onRequestPost({ request, env }) {
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
