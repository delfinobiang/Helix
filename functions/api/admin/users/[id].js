import { getSession, mapUser, hashPassword, json } from '../../_lib.js';

export async function onRequest({ request, env, params }) {
  const session = await getSession(request, env.DB);
  if (!session || !session.isAdmin) return json({ ok: false, error: 'Forbidden.' }, 403);

  const userId = params.id;

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

      if (body.plan !== undefined)          { updates.push('plan = ?');             values.push(body.plan); }
      if (body.planTier !== undefined)      { updates.push('plan_tier = ?');        values.push(body.planTier || null); }
      if (body.planStartedAt !== undefined) { updates.push('plan_started_at = ?'); values.push(body.planStartedAt || null); }
      if (body.username !== undefined)      { updates.push('username = ?');         values.push(body.username); }
      if (body.bio !== undefined)           { updates.push('bio = ?');              values.push(body.bio); }
      if (body.profilePic !== undefined)    { updates.push('profile_pic = ?');      values.push(body.profilePic || null); }
      if (body.xp !== undefined)            { updates.push('xp = ?');              values.push(body.xp); }

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
