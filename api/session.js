const { isAuthed, json } = require('./_lib');

module.exports = (req, res) => json(res, 200, { ok: isAuthed(req) });
