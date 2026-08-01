import { getSession, mapUser, json } from '../_lib.js';

export async function onRequest({ request, env }) {
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
