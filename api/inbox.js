// The merchant inbox: every order, valuation request and store-owner message is saved here
// the moment a buyer submits it, so nothing is lost if they never press Send in a chat app.
//
// POST   /api/inbox { kind, ticket, title, contact, country, text }   public (buyers), limited per visitor
// GET    /api/inbox                                                   admin only → { items: [...] }
// PUT    /api/inbox { id, done }                                      admin only, mark handled / reopen
// DELETE /api/inbox?id=…                                              admin only
//
// Optional instant alert to your Telegram (set both in Vercel, then redeploy):
//   TELEGRAM_BOT_TOKEN   from @BotFather
//   TELEGRAM_CHAT_ID     your own chat id (message @userinfobot to see it)
const crypto = require('crypto');
const { db, dbReady, send, readBody, clientIp, isAdmin, underLimit } = require('./_lib');

const LIST = 'bw:inbox';
const LIMIT_KEY = 'bw:in:';
const KINDS = ['order', 'sell', 'partner'];
const COUNTRIES = ['NG', 'ZA', 'KE', 'GH'];
const KEEP = 300;
const PER_HOUR = 15;

const clean = (v, max, keepLines) => String(v == null ? '' : v)
  .replace(keepLines ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g : /[\u0000-\u001f]/g, ' ')
  .trim()
  .slice(0, max);

async function readAll() {
  const rows = (await db(['LRANGE', LIST, 0, KEEP - 1])) || [];
  return rows.map((raw) => {
    try { return { raw, item: JSON.parse(raw) }; } catch { return null; }
  }).filter(Boolean);
}

async function pushToTelegram(item) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctl.signal,
      body: JSON.stringify({
        chat_id: chat,
        text: `NEW ${item.kind.toUpperCase()} · ${item.title}\n\n${item.text}`.slice(0, 3900),
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  if (!dbReady()) return send(res, 503, { ok: false, error: 'db_not_configured' });

  try {
    if (req.method === 'POST') {
      const body = readBody(req);
      const kind = KINDS.includes(body.kind) ? body.kind : '';
      const text = clean(body.text, 4000, true);
      if (!kind || text.length < 10) return send(res, 400, { ok: false, error: 'bad_message' });
      if (!(await underLimit(LIMIT_KEY + clientIp(req), PER_HOUR, 3600))) {
        return send(res, 429, { ok: false, error: 'too_many' });
      }
      const item = {
        id: crypto.randomBytes(6).toString('hex'),
        kind,
        ticket: clean(body.ticket, 20),
        title: clean(body.title, 120),
        contact: clean(body.contact, 120),
        country: COUNTRIES.includes(body.country) ? body.country : '',
        text,
        at: new Date().toISOString(),
        done: false,
      };
      await db(['LPUSH', LIST, JSON.stringify(item)]);
      await db(['LTRIM', LIST, 0, KEEP - 1]);
      const pushed = await pushToTelegram(item);
      return send(res, 200, { ok: true, id: item.id, pushed });
    }

    if (!isAdmin(req)) return send(res, 401, { ok: false, error: 'unauthorized' });

    if (req.method === 'GET') {
      const rows = await readAll();
      return send(res, 200, { ok: true, items: rows.map((r) => r.item) });
    }

    if (req.method === 'PUT') {
      const body = readBody(req);
      const rows = await readAll();
      const found = rows.findIndex((r) => r.item.id === body.id);
      if (found < 0) return send(res, 404, { ok: false, error: 'not_found' });
      const next = { ...rows[found].item, done: Boolean(body.done) };
      // Index in the stored list = index in the unfiltered rows only when every row parsed; look it up safely.
      const all = (await db(['LRANGE', LIST, 0, KEEP - 1])) || [];
      const at = all.indexOf(rows[found].raw);
      if (at < 0) return send(res, 404, { ok: false, error: 'not_found' });
      await db(['LSET', LIST, at, JSON.stringify(next)]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const id = String((req.query && req.query.id) || '');
      const rows = await readAll();
      const found = rows.find((r) => r.item.id === id);
      if (!found) return send(res, 404, { ok: false, error: 'not_found' });
      await db(['LREM', LIST, 1, found.raw]);
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch {
    return send(res, 500, { ok: false, error: 'server_error' });
  }
};

