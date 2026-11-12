// POST /api/login  { passcode }  → { token }   (checks ADMIN_PASSCODE, rate limited)
// GET  /api/login  (Bearer token) → { ok: true } when the saved session is still valid
const {
  send, readBody, clientIp, passcode, makeToken, isAdmin, passcodeMatches, failState, addFail, clearFails,
} = require('./_lib');

module.exports = async (req, res) => {
  if (!passcode()) return send(res, 503, { ok: false, error: 'auth_not_configured' });

  if (req.method === 'GET') {
    return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 401, { ok: false, error: 'unauthorized' });
  }
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });

  const ip = clientIp(req);
  try {
    const state = await failState(ip);
    if (state.blocked) {
      return send(res, 429, { ok: false, error: 'locked', retryAfter: state.retryAfter }, { 'Retry-After': String(state.retryAfter) });
    }
    const typed = String(readBody(req).passcode || '');
    if (!typed || !passcodeMatches(typed)) {
      await addFail(ip);
      return send(res, 401, { ok: false, error: 'wrong_passcode' });
    }
    await clearFails(ip);
    return send(res, 200, { ok: true, ...makeToken() });
  } catch {
    return send(res, 500, { ok: false, error: 'server_error' });
  }
};
