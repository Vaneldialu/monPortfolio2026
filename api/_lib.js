// Utilitaires partagés (le préfixe "_" empêche Vercel d'en faire une route).
const crypto = require('crypto');

const COOKIE = 'vd_admin';
const MAX_AGE = 8 * 60 * 60; // session de 8 h

function secret() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length >= 16) return s;
  // Repli : dérivé du mot de passe (reste secret côté serveur).
  return crypto.createHash('sha256').update('vd-session:' + (process.env.ADMIN_PASSWORD || '')).digest('hex');
}
function sign(v) { return crypto.createHmac('sha256', secret()).update(v).digest('base64url'); }

function makeToken() {
  const v = (Math.floor(Date.now() / 1000) + MAX_AGE) + '.' + crypto.randomBytes(8).toString('hex');
  return v + '.' + sign(v);
}
function verifyToken(t) {
  if (!t || !process.env.ADMIN_PASSWORD) return false;
  const p = String(t).split('.');
  if (p.length !== 3) return false;
  const a = Buffer.from(p[2]);
  const b = Buffer.from(sign(p[0] + '.' + p[1]));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(p[0]) > Date.now() / 1000;
}
function cookies(header) {
  const out = {};
  String(header || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = c.slice(i + 1).trim();
  });
  return out;
}
const isAuthed = (req) => verifyToken(cookies(req.headers.cookie)[COOKIE]);

function setCookie(res, value, maxAge) {
  res.setHeader('Set-Cookie', COOKIE + '=' + value + '; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=' + maxAge);
}
// Protection CSRF : la requête doit venir de la page elle-même.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return false;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function body(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  try { return JSON.parse(b || '{}'); } catch (e) { return {}; }
}

module.exports = { COOKIE, MAX_AGE, makeToken, isAuthed, setCookie, sameOrigin, json, body };
