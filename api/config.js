// GET /api/config — public settings the page needs: merchant chat contacts and
// whether the database + admin passcode are connected. Nothing secret is returned.
const { send, dbReady, passcode } = require('./_lib');

module.exports = (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method_not_allowed' });
  return send(
    res,
    200,
    {
      ok: true,
      db: dbReady(),
      auth: Boolean(passcode()),
      push: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      whatsapp: String(process.env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
      telegram: String(process.env.TELEGRAM_USERNAME || '').replace(/^@/, '').trim(),
    },
    { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' },
  );
};

