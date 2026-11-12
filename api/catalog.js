// GET /api/catalog → { watches: [...] | null }  public, always fresh
// PUT /api/catalog { watches: [...] }            admin only, replaces the whole catalogue
const { KEYS, db, dbReady, send, readBody, isAdmin, cleanWatch, photoIds } = require('./_lib');

const MAX_WATCHES = 200;

async function readStored() {
  const raw = await db(['GET', KEYS.catalog]);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.watches) ? data : null;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (!dbReady()) return send(res, 503, { ok: false, error: 'db_not_configured' });

  try {
    if (req.method === 'GET') {
      const stored = await readStored();
      return send(res, 200, { ok: true, watches: stored ? stored.watches : null, updatedAt: stored ? stored.updatedAt : null });
    }

    if (req.method === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, { ok: false, error: 'unauthorized' });
      const incoming = readBody(req).watches;
      if (!Array.isArray(incoming) || incoming.length > MAX_WATCHES) return send(res, 400, { ok: false, error: 'bad_catalog' });

      const seen = new Set();
      const watches = [];
      incoming.forEach((w) => {
        const clean = cleanWatch(w || {});
        if (clean && !seen.has(clean.id)) { seen.add(clean.id); watches.push(clean); }
      });

      const payload = JSON.stringify({ watches, updatedAt: new Date().toISOString() });
      if (payload.length > 900000) return send(res, 413, { ok: false, error: 'too_large' });

      const previous = await readStored();
      await db(['SET', KEYS.catalog, payload]);

      // Tidy up: delete uploaded photos that no watch uses any more.
      try {
        const keep = photoIds(watches);
        const stale = [...photoIds(previous ? previous.watches : [])].filter((id) => !keep.has(id));
        for (const id of stale) await db(['DEL', KEYS.photo + id]);
      } catch { /* cleanup is best effort */ }

      return send(res, 200, { ok: true, count: watches.length });
    }

    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch {
    return send(res, 500, { ok: false, error: 'server_error' });
  }
};

