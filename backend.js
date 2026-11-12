// Live catalogue: talks to the Vercel functions in /api (shared database, admin sessions,
// photo storage). When those functions don't exist (e.g. a preview), the app keeps
// working and saves changes on this device only.

import { CONFIG } from './config.js';
import { WATCHES } from './watches.js';
import { kvGet, kvSet } from './dom.js';

const KEYS = { local: 'bw.catalog', cache: 'bw.catalogCache', overrides: 'bw.overrides' };

export const DEFAULT_VISUAL = {
  shape: 'round', dialColor: '#141417', dialPattern: 'crosshair', bezelType: 'smooth-steel',
  caseColor: '#E4E4E7', strapType: 'leather', strapColor: '#1C1917', indexColor: '#D4AF37', hasCyclops: false,
};

export const SAMPLE_IDS = new Set(WATCHES.map((w) => w.id));

// Watch type: a normal everyday watch, a classic, or a vintage piece.
export const KINDS = ['normal', 'classic', 'vintage'];
export function kindForYear(year) {
  const y = Number(year) || 0;
  if (y && y <= 1996) return 'vintage';
  if (y && y <= 2009) return 'classic';
  return 'normal';
}

const net = { online: false, db: false, auth: false, push: false, token: '' };
const coded = (code) => Object.assign(new Error(code), { code });

export const isOnline = () => net.online;
export const hasDatabase = () => net.online && net.db;
export const authConfigured = () => net.auth;
export const hasPush = () => net.push;
export const canPublish = () => hasDatabase() && Boolean(net.token);

async function call(path, { method = 'GET', body, auth = false, timeoutMs = 15000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && net.token) headers.Authorization = `Bearer ${net.token}`;
    const res = await fetch(path, {
      method, headers, signal: ctl.signal, cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const isJson = (res.headers.get('content-type') || '').includes('json');
    const data = isJson ? await res.json().catch(() => null) : null;
    return { status: res.status, ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- connection ---------- */
export async function initBackend() {
  try {
    const r = await call('/api/config', { timeoutMs: 6000 });
    if (r.ok && r.data && r.data.ok === true) {
      net.online = true;
      net.db = Boolean(r.data.db);
      net.auth = Boolean(r.data.auth);
      net.push = Boolean(r.data.push);
      if (r.data.whatsapp) CONFIG.whatsappNumber = r.data.whatsapp;
      if (r.data.telegram) CONFIG.telegramUsername = r.data.telegram;
    }
  } catch { /* no server functions here: preview mode */ }
  return { online: net.online, db: net.db, auth: net.auth };
}

/* ---------- watch records ---------- */
export function normalizeWatch(w) {
  const given = Math.round(Number(w.priceNgn));
  const fromUsd = Math.round(((Number(w.priceUsd) || 0) * CONFIG.usdToNgn) / 50000) * 50000;
  const { priceUsd, ...rest } = w;
  return {
    ...rest,
    priceNgn: given > 0 ? given : fromUsd,
    image: w.image || '',
    kind: KINDS.includes(w.kind) ? w.kind : kindForYear(w.year),
    conditions: Array.isArray(w.conditions) ? w.conditions : [],
    highlights: Array.isArray(w.highlights) ? w.highlights : [],
    notes: w.notes || '',
    visual: { ...DEFAULT_VISUAL, ...(w.visual && typeof w.visual === 'object' ? w.visual : {}) },
  };
}

export const sampleCatalog = () => WATCHES.map(normalizeWatch);

async function localOrSample() {
  const local = await kvGet(KEYS.local);
  if (Array.isArray(local)) return { list: local.map(normalizeWatch), source: 'device' };
  const overrides = await kvGet(KEYS.overrides); // older versions kept photo/status edits here
  const list = sampleCatalog();
  if (overrides && typeof overrides === 'object') {
    list.forEach((w, i) => {
      const o = overrides[w.id];
      if (o) list[i] = { ...w, status: o.status || w.status, image: o.image !== undefined ? o.image : w.image };
    });
  }
  return { list, source: 'sample' };
}

/* ---------- loading & saving ---------- */
export async function loadCatalog() {
  if (!hasDatabase()) return localOrSample();
  try {
    const r = await call('/api/catalog');
    if (r.ok && r.data && r.data.ok) {
      const saved = Array.isArray(r.data.watches);
      const list = saved ? r.data.watches.map(normalizeWatch) : sampleCatalog();
      kvSet(KEYS.cache, list);
      return { list, source: saved ? 'live' : 'sample' };
    }
  } catch { /* fall through to the last copy this browser saw */ }
  const cached = await kvGet(KEYS.cache);
  if (Array.isArray(cached)) return { list: cached.map(normalizeWatch), source: 'cache' };
  return { list: [], source: 'error' };
}

// Quietly fetches the latest live catalogue; returns null when nothing new is available.
export async function refreshRemote() {
  if (!hasDatabase()) return null;
  try {
    const r = await call('/api/catalog', { timeoutMs: 10000 });
    if (r.ok && r.data && r.data.ok && Array.isArray(r.data.watches)) {
      const list = r.data.watches.map(normalizeWatch);
      kvSet(KEYS.cache, list);
      return list;
    }
  } catch { /* try again next time */ }
  return null;
}

export async function saveCatalog(list) {
  if (hasDatabase()) {
    if (!net.token) throw coded('AUTH');
    let r;
    try {
      r = await call('/api/catalog', { method: 'PUT', body: { watches: list }, auth: true, timeoutMs: 30000 });
    } catch {
      throw coded('SAVE');
    }
    if (r.status === 401) throw coded('AUTH');
    if (!r.ok) throw coded('SAVE');
    kvSet(KEYS.cache, list);
    return 'live';
  }
  if (!(await kvSet(KEYS.local, list))) throw coded('SAVE');
  return 'device';
}

/* ---------- admin session ---------- */
export async function login(passcode) {
  let r;
  try {
    r = await call('/api/login', { method: 'POST', body: { passcode } });
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (r.ok && r.data && r.data.token) {
    net.token = r.data.token;
    return { ok: true, token: r.data.token };
  }
  if (r.status === 429) return { ok: false, reason: 'locked', retryAfter: (r.data && r.data.retryAfter) || 60 };
  if (r.status === 503) return { ok: false, reason: 'notset' };
  if (r.status === 401) return { ok: false, reason: 'wrong' };
  return { ok: false, reason: 'error' };
}

export async function resumeSession(token) {
  if (!token || !net.online) return false;
  net.token = token;
  try {
    const r = await call('/api/login', { auth: true, timeoutMs: 8000 });
    if (r.ok && r.data && r.data.ok) return true;
  } catch { /* treat as signed out */ }
  net.token = '';
  return false;
}

export const logout = () => { net.token = ''; };

/* ---------- photo upload (shrinks the picture first so it loads fast on phones) ---------- */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(coded('NOT_IMAGE')); };
    img.src = url;
  });
}

async function shrink(file, maxChars = 850000) {
  const img = await loadImage(file);
  let longest = 1400;
  let quality = 0.86;
  for (let i = 0; i < 6; i += 1) {
    const scale = Math.min(1, longest / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= maxChars) return dataUrl;
    quality = Math.max(0.5, quality - 0.1);
    longest = Math.round(longest * 0.85);
  }
  throw coded('TOO_LARGE');
}

export async function uploadPhotoFile(file) {
  if (!net.token) throw coded('AUTH');
  const data = await shrink(file);
  const r = await call('/api/photo', { method: 'POST', body: { data }, auth: true, timeoutMs: 60000 });
  if (r.status === 401) throw coded('AUTH');
  if (!r.ok || !r.data || !r.data.url) throw coded('UPLOAD');
  return r.data.url;
}

// Buyer photos for the Sell / Trade form: no sign-in, kept 30 days. Returns a full link the merchant can open.
export async function uploadSellPhoto(file) {
  const data = await shrink(file, 600000);
  const r = await call('/api/photo', { method: 'POST', body: { data, kind: 'sell' }, timeoutMs: 60000 });
  if (!r.ok || !r.data || !r.data.url) throw coded('UPLOAD');
  return new URL(r.data.url, window.location.origin).href;
}

/* ---------- merchant inbox: every order and request is saved for the merchant ---------- */
// entry: { kind: 'order' | 'sell' | 'partner', ticket, title, contact, country, text }
// Never throws: buyers can always continue in WhatsApp / Telegram even if saving fails.
export async function sendInbox(entry) {
  if (!hasDatabase()) return { saved: false, pushed: false };
  try {
    const r = await call('/api/inbox', { method: 'POST', body: entry, timeoutMs: 15000 });
    return { saved: Boolean(r.ok && r.data && r.data.ok), pushed: Boolean(r.data && r.data.pushed) };
  } catch {
    return { saved: false, pushed: false };
  }
}

export async function loadInbox() {
  if (!net.token) throw coded('AUTH');
  let r;
  try {
    r = await call('/api/inbox', { auth: true });
  } catch {
    throw coded('LOAD');
  }
  if (r.status === 401) throw coded('AUTH');
  if (!r.ok || !r.data || !Array.isArray(r.data.items)) throw coded('LOAD');
  return r.data.items;
}

export async function markInbox(id, done) {
  const r = await call('/api/inbox', { method: 'PUT', body: { id, done }, auth: true });
  if (r.status === 401) throw coded('AUTH');
  if (!r.ok) throw coded('SAVE');
}

export async function deleteInbox(id) {
  const r = await call(`/api/inbox?id=${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
  if (r.status === 401) throw coded('AUTH');
  if (!r.ok) throw coded('SAVE');
}
