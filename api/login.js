const crypto = require('crypto');
const { MAX_AGE, makeToken, setCookie, sameOrigin, json, body } = require('./_lib');

// Limitation basique des essais (par instance serveur, au mieux).
const fails = new Map();

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false }); }
  if (!sameOrigin(req)) return json(res, 403, { ok: false });
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return json(res, 500, { ok: false, error: 'ADMIN_PASSWORD n\'est pas défini sur Vercel.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnu';
  const now = Date.now();
  const rec = fails.get(ip) || { n: 0, until: 0 };
  if (rec.until > now) return json(res, 429, { ok: false });

  const pw = typeof body(req).password === 'string' ? body(req).password : '';
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (crypto.timingSafeEqual(a, b)) {
    fails.delete(ip);
    setCookie(res, makeToken(), MAX_AGE);
    return json(res, 200, { ok: true });
  }
  rec.n += 1;
  if (rec.n >= 5) { rec.until = now + 15 * 60 * 1000; rec.n = 0; }
  fails.set(ip, rec);
  await new Promise((r) => setTimeout(r, 700));
  return json(res, 401, { ok: false });
};
