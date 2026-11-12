// GET  /api/photo?id=abc123…   serves a stored watch photo (cached for a year)
// POST /api/photo { data: "data:image/jpeg;base64,…" }                admin only, kept for good → { url }
// POST /api/photo { data: "…", kind: "sell" }                         buyers (Sell / Trade form): small, limited
//                                                                     per visitor, and deleted after 30 days → { url }
const crypto = require('crypto');
const { KEYS, db, dbReady, send, readBody, clientIp, isAdmin, underLimit } = require('./_lib');

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_BASE64 = 900000; // keeps each photo inside the database's 1 MB request limit
const MAX_BASE64_BUYER = 650000;
const BUYER_UPLOADS_PER_HOUR = 12;
const BUYER_KEEP_SECONDS = 30 * 86400;

module.exports = async (req, res) => {
  if (!dbReady()) return send(res, 503, { ok: false, error: 'db_not_configured' });

  try {
    if (req.method === 'GET') {
      const id = String((req.query && req.query.id) || '');
      if (!/^[a-f0-9]{8,32}$/.test(id)) return send(res, 400, { ok: false, error: 'bad_id' });
      const stored = await db(['GET', KEYS.photo + id]);
      if (!stored) return send(res, 404, { ok: false, error: 'not_found' });
      const sep = stored.indexOf('|');
      const mime = stored.slice(0, sep);
      res.statusCode = 200;
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(Buffer.from(stored.slice(sep + 1), 'base64'));
    }

    if (req.method === 'POST') {
      const body = readBody(req);
      const admin = isAdmin(req);
      const buyer = !admin && body.kind === 'sell';
      if (!admin && !buyer) return send(res, 401, { ok: false, error: 'unauthorized' });

      const match = DATA_URL.exec(String(body.data || ''));
      if (!match) return send(res, 400, { ok: false, error: 'bad_image' });
      if (match[2].length > (buyer ? MAX_BASE64_BUYER : MAX_BASE64)) return send(res, 413, { ok: false, error: 'too_large' });

      if (buyer && !(await underLimit(KEYS.upload + clientIp(req), BUYER_UPLOADS_PER_HOUR, 3600))) {
        return send(res, 429, { ok: false, error: 'too_many' });
      }

      const id = crypto.randomBytes(8).toString('hex');
      const value = `${match[1]}|${match[2]}`;
      if (buyer) await db(['SET', KEYS.photo + id, value, 'EX', BUYER_KEEP_SECONDS]);
      else await db(['SET', KEYS.photo + id, value]);
      return send(res, 200, { ok: true, url: `/api/photo?id=${id}` });
    }

    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch {
    return send(res, 500, { ok: false, error: 'server_error' });
  }
};
