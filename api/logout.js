const { setCookie, sameOrigin, json } = require('./_lib');

module.exports = (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false }); }
  if (!sameOrigin(req)) return json(res, 403, { ok: false });
  setCookie(res, '', 0);
  return json(res, 200, { ok: true });
};
