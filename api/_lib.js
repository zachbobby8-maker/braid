// Shared helpers for the Vercel serverless functions in /api.
// Files starting with "_" are never exposed as public URLs by Vercel.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   ADMIN_PASSCODE      required  the password for "Staff login"
//   WHATSAPP_NUMBER     optional  digits only with country code, e.g. 2348012345678
//   TELEGRAM_USERNAME   optional  without the @
//   ADMIN_SECRET        optional  any long random text (signs login sessions)
// Database (added automatically when you connect Upstash Redis / Vercel KV):
//   KV_REST_API_URL + KV_REST_API_TOKEN   or   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const crypto = require('crypto');

const KEYS = { catalog: 'bw:catalog', photo: 'bw:photo:', fail: 'bw:fail:', upload: 'bw:up:' };
const TOKEN_DAYS = 30;
const TIERS = ['daily', 'collector', 'vault', 'neo', 'other'];
const KINDS = ['normal', 'classic', 'vintage'];
const STATUSES = ['available', 'hold', 'sold'];
const CONDITIONS = ['box', 'unpolished', 'serviced', 'originalDial'];

/* ---------- database (Upstash Redis over REST, no packages needed) ---------- */
function dbCreds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  return { url: url.replace(/\/$/, ''), token };
}

function dbReady() {
  const { url, token } = dbCreds();
  return Boolean(url && token);
}

async function db(command) {
  const { url, token } = dbCreds();
  if (!url || !token) throw Object.assign(new Error('db_not_configured'), { code: 'db_not_configured' });
  // Give up after 8 seconds so the site gets a quick, clear error instead of waiting for Vercel to cut the request off.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `db_http_${res.status}`);
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- responses & request helpers ---------- */
function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', headers['Cache-Control'] || 'no-store');
  Object.keys(headers).forEach((k) => res.setHeader(k, headers[k]));
  res.end(JSON.stringify(body));
}

function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return {}; }
  }
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return typeof b === 'object' ? b : {};
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* ---------- admin sessions: signed, expiring tokens (no server state) ---------- */
const passcode = () => String(process.env.ADMIN_PASSCODE || '');

function secret() {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
  return crypto.createHash('sha256').update(`${passcode()}|${dbCreds().token}`).digest('hex');
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');
const passTag = () => crypto.createHash('sha256').update(passcode()).digest('hex').slice(0, 10);

function makeToken() {
  const exp = Date.now() + TOKEN_DAYS * 86400000;
  const body = b64(JSON.stringify({ exp, p: passTag() }));
  return { token: `${body}.${sign(body)}`, expiresAt: exp };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function isAdmin(req) {
  if (!passcode()) return false;
  const header = String(req.headers.authorization || '');
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const [body, sig] = raw.split('.');
  if (!body || !sig || !safeEqual(sig, sign(body))) return false;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return data.exp > Date.now() && data.p === passTag();
  } catch {
    return false;
  }
}

function passcodeMatches(typed) {
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(typed), h(passcode()));
}

/* ---------- sign-in rate limit (Redis when available, memory otherwise) ---------- */
const memory = new Map();
const MAX_FAILS = 8;
const WINDOW_SEC = 900;

async function failState(ip) {
  if (dbReady()) {
    const key = KEYS.fail + ip;
    const n = Number(await db(['GET', key])) || 0;
    const ttl = n ? Number(await db(['TTL', key])) : 0;
    return { blocked: n >= MAX_FAILS, retryAfter: Math.max(ttl, 1) };
  }
  const rec = memory.get(ip);
  if (!rec || rec.until < Date.now()) return { blocked: false, retryAfter: 1 };
  return { blocked: rec.n >= MAX_FAILS, retryAfter: Math.ceil((rec.until - Date.now()) / 1000) };
}

async function addFail(ip) {
  if (dbReady()) {
    const key = KEYS.fail + ip;
    const n = await db(['INCR', key]);
    if (n === 1) await db(['EXPIRE', key, WINDOW_SEC]);
    return;
  }
  const rec = memory.get(ip);
  if (!rec || rec.until < Date.now()) memory.set(ip, { n: 1, until: Date.now() + WINDOW_SEC * 1000 });
  else rec.n += 1;
}

async function clearFails(ip) {
  if (dbReady()) await db(['DEL', KEYS.fail + ip]);
  else memory.delete(ip);
}

// Generic counter limit (needs the database): true while the caller is still under the limit.
async function underLimit(key, max, windowSec) {
  const n = await db(['INCR', key]);
  if (n === 1) await db(['EXPIRE', key, windowSec]);
  return n <= max;
}

/* ---------- catalogue validation ---------- */
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function cleanImage(v) {
  const s = text(v, 800);
  return /^(https?:\/\/|\/api\/photo\?id=|images\/)/i.test(s) ? s : '';
}

function cleanVisual(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  Object.keys(v).slice(0, 14).forEach((k) => {
    const val = v[k];
    if (typeof val === 'boolean') out[k] = val;
    else if (typeof val === 'string' && /^[#a-zA-Z0-9-]{1,24}$/.test(val)) out[k] = val;
  });
  return out;
}

function cleanWatch(w) {
  const kindForYear = (y) => (y && y <= 1996 ? 'vintage' : y && y <= 2009 ? 'classic' : 'normal');
  const id = text(w && w.id, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(id)) return null;
  const listed = new Date(w.listedAt);
  return {
    id,
    brand: text(w.brand, 60),
    model: text(w.model, 100),
    year: Math.min(2100, Math.max(1800, Math.round(Number(w.year)) || new Date().getFullYear())),
    ref: text(w.ref, 40),
    movement: text(w.movement, 60),
    caliber: text(w.caliber, 60),
    caseSize: text(w.caseSize, 80),
    rate: text(w.rate, 60),
    priceNgn: Math.min(1e12, Math.max(0, Math.round(Number(w.priceNgn)) || 0)),
    status: STATUSES.includes(w.status) ? w.status : 'available',
    tier: TIERS.includes(w.tier) ? w.tier : 'collector',
    kind: KINDS.includes(w.kind) ? w.kind : kindForYear(Math.round(Number(w.year)) || 0),
    featured: Boolean(w.featured),
    listedAt: Number.isNaN(listed.getTime()) ? new Date().toISOString() : listed.toISOString(),
    image: cleanImage(w.image),
    conditions: (Array.isArray(w.conditions) ? w.conditions : []).filter((c) => CONDITIONS.includes(c)),
    highlights: (Array.isArray(w.highlights) ? w.highlights : []).slice(0, 8).map((h) => text(h, 120)).filter(Boolean),
    notes: text(w.notes, 1200),
    visual: cleanVisual(w.visual),
  };
}

const photoIds = (list) => {
  const ids = new Set();
  (list || []).forEach((w) => {
    const m = /^\/api\/photo\?id=([a-f0-9]{8,32})/.exec((w && w.image) || '');
    if (m) ids.add(m[1]);
  });
  return ids;
};

module.exports = {
  KEYS, db, dbReady, send, readBody, clientIp, passcode, makeToken, isAdmin, passcodeMatches,
  failState, addFail, clearFails, underLimit, cleanWatch, photoIds,
};
