const { isAuthed, sameOrigin, json, body } = require('./_lib');

const API = 'https://api.github.com';
const BLOCK = /(<script type="application\/json" id="content">)([\s\S]*?)(<\/script>)/;

async function gh(path, opts) {
  opts = opts || {};
  const r = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'portfolio-admin',
      'Content-Type': 'application/json'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await r.text();
  let data = text;
  try { data = JSON.parse(text); } catch (e) { /* texte brut */ }
  if (!r.ok) { const err = new Error('GitHub ' + r.status); err.status = r.status; err.data = data; throw err; }
  return data;
}

function validContent(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return 'Contenu invalide.';
  if (!c.meta || typeof c.meta !== 'object') return 'Section « meta » manquante.';
  if (typeof c.meta.firstName !== 'string' || typeof c.meta.lastName !== 'string') return 'Nom manquant.';
  if (typeof c.meta.photo === 'string' && c.meta.photo.indexOf('data:') === 0) return 'Photo non préparée.';
  if (JSON.stringify(c).length > 300000) return 'Contenu trop volumineux.';
  return null;
}

function validUpload(u) {
  if (!u) return { ok: true, file: null };
  if (typeof u.path !== 'string' || !/^images\/photo-\d{10,15}\.(png|jpg|webp)$/.test(u.path)) return { ok: false };
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(u.dataUrl || ''));
  if (!m) return { ok: false };
  const ext = u.path.split('.').pop();
  const want = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[m[1]];
  if (ext !== want) return { ok: false };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3.5 * 1024 * 1024) return { ok: false, big: true };
  const head = buf.subarray(0, 12);
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isJpg = head[0] === 0xff && head[1] === 0xd8;
  const isWebp = head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP';
  if (!(isPng || isJpg || isWebp)) return { ok: false };
  return { ok: true, file: { path: u.path, base64: m[2] } };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { ok: false }); }
  if (!sameOrigin(req)) return json(res, 403, { ok: false });
  if (!isAuthed(req)) return json(res, 401, { ok: false, error: 'Session expirée.' });

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!process.env.GITHUB_TOKEN || !repo) {
    return json(res, 500, { ok: false, error: 'GITHUB_TOKEN ou GITHUB_REPO n\'est pas défini sur Vercel.' });
  }

  const b = body(req);
  const bad = validContent(b.content);
  if (bad) return json(res, 400, { ok: false, error: bad });
  const up = validUpload(b.upload);
  if (!up.ok) return json(res, up.big ? 413 : 400, { ok: false, error: up.big ? 'Image trop lourde.' : 'Image invalide.' });

  try {
    const ref = await gh('/repos/' + repo + '/git/ref/heads/' + branch);
    const headSha = ref.object.sha;
    const commit = await gh('/repos/' + repo + '/git/commits/' + headSha);
    const file = await gh('/repos/' + repo + '/contents/index.html?ref=' + headSha);
    const html = Buffer.from(file.content, 'base64').toString('utf8');
    if (!BLOCK.test(html)) return json(res, 500, { ok: false, error: 'Bloc de contenu introuvable dans index.html.' });

    const data = JSON.stringify(b.content, null, 1).replace(/</g, '\\u003c');
    const next = html.replace(BLOCK, (all, open, old, close) => open + data + close);
    if (next === html && !up.file) return json(res, 200, { ok: true, unchanged: true });

    const tree = [{ path: 'index.html', mode: '100644', type: 'blob', content: next }];
    if (up.file) {
      const blob = await gh('/repos/' + repo + '/git/blobs', { method: 'POST', body: { content: up.file.base64, encoding: 'base64' } });
      tree.push({ path: up.file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const newTree = await gh('/repos/' + repo + '/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree } });
    const newCommit = await gh('/repos/' + repo + '/git/commits', {
      method: 'POST',
      body: { message: 'Mise à jour du portfolio depuis l\'espace admin', tree: newTree.sha, parents: [headSha] }
    });
    await gh('/repos/' + repo + '/git/refs/heads/' + branch, { method: 'PATCH', body: { sha: newCommit.sha, force: false } });
    return json(res, 200, { ok: true, commit: newCommit.sha.slice(0, 7) });
  } catch (e) {
    if (e.status === 422) return json(res, 409, { ok: false, error: 'Le dépôt a changé pendant l\'enregistrement. Réessayez.' });
    if (e.status === 401 || e.status === 403) return json(res, 502, { ok: false, error: 'Jeton GitHub invalide ou sans droit d\'écriture sur le dépôt.' });
    if (e.status === 404) return json(res, 502, { ok: false, error: 'Dépôt, branche ou fichier index.html introuvable (vérifiez GITHUB_REPO et GITHUB_BRANCH).' });
    return json(res, 502, { ok: false, error: 'GitHub a refusé l\'enregistrement.' });
  }
};
