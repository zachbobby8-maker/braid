// Admin sign-in. On the live site the passcode is checked by the server (ADMIN_PASSCODE on Vercel)
// and the server hands back a session; in a preview without a server the passcode in config.js is used.
// A session is remembered only if the owner asks.

import { CONFIG } from './config.js';
import { $, t, createOverlay, kvGet, kvSet, kvRemove } from './dom.js';
import * as backend from './backend.js';

const SESSION_KEY = 'bw.adminSession';
const MAX_TRIES = 5;
const LOCK_MS = 30000;

// Tiny fingerprint so changing the preview passcode signs out remembered devices.
function fingerprint(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `v1-${h.toString(36)}`;
}

export function initAdminAuth({ onChange }) {
  const serverMode = () => backend.isOnline();
  const available = () => (serverMode() ? backend.authConfigured() : Boolean(CONFIG.adminPasscode));

  let signedIn = false;
  let fails = 0;
  let lockedUntil = 0;
  let lockTimer = 0;
  let token = '';

  const overlay = createOverlay($('loginBackdrop'), $('loginModal'), {
    onClose: () => {
      $('loginPass').value = '';
      $('loginError').textContent = '';
    },
  });

  function showError(key, values) {
    $('loginError').textContent = key ? t(key, values) : '';
  }

  function tickLock() {
    const left = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(lockTimer);
      lockedUntil = 0;
      fails = 0;
      $('loginSubmit').disabled = false;
      showError('');
      return;
    }
    showError('login.locked', { s: left });
  }

  function lock(ms = LOCK_MS) {
    lockedUntil = Date.now() + ms;
    $('loginSubmit').disabled = true;
    clearInterval(lockTimer);
    lockTimer = setInterval(tickLock, 1000);
    tickLock();
  }

  async function remember(on) {
    if (!on) { await kvRemove(SESSION_KEY); return; }
    const value = serverMode() ? { mode: 'server', token } : { mode: 'local', fp: fingerprint(CONFIG.adminPasscode) };
    await kvSet(SESSION_KEY, value, { sync: false });
  }

  function open() {
    if (signedIn) { onChange(true); return; }
    $('loginRemember').checked = false;
    showError(available() ? '' : (serverMode() ? 'login.notset' : 'login.off'));
    $('loginSubmit').disabled = !available() || Date.now() < lockedUntil;
    overlay.open($('loginPass'));
    if (Date.now() < lockedUntil) tickLock();
  }

  async function restore() {
    if (!available()) return false;
    const saved = await kvGet(SESSION_KEY);
    signedIn = false;
    if (saved && serverMode() && saved.mode === 'server') {
      token = saved.token || '';
      signedIn = await backend.resumeSession(token);
    } else if (saved && !serverMode() && saved.mode === 'local') {
      signedIn = saved.fp === fingerprint(CONFIG.adminPasscode);
    }
    if (saved && !signedIn) await kvRemove(SESSION_KEY);
    return signedIn;
  }

  async function signOut() {
    signedIn = false;
    token = '';
    backend.logout();
    await kvRemove(SESSION_KEY);
    onChange(false);
  }

  async function finish() {
    fails = 0;
    signedIn = true;
    await remember($('loginRemember').checked);
    overlay.close();
    onChange(true);
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!available()) { showError(serverMode() ? 'login.notset' : 'login.off'); return; }
    if (Date.now() < lockedUntil) return;
    const typed = $('loginPass').value;
    if (!typed) { showError('login.empty'); $('loginPass').focus(); return; }

    if (serverMode()) {
      $('loginSubmit').disabled = true;
      showError('login.checking');
      const result = await backend.login(typed);
      $('loginSubmit').disabled = false;
      if (result.ok) { token = result.token; await finish(); return; }
      $('loginPass').value = '';
      $('loginPass').focus();
      if (result.reason === 'locked') lock(Math.min(result.retryAfter, 900) * 1000);
      else if (result.reason === 'wrong') showError('login.wrongShort');
      else showError(result.reason === 'notset' ? 'login.notset' : 'login.error');
      return;
    }

    if (typed !== CONFIG.adminPasscode) {
      fails += 1;
      $('loginPass').value = '';
      $('loginPass').focus();
      if (fails >= MAX_TRIES) lock();
      else showError('login.wrong', { n: MAX_TRIES - fails });
      return;
    }
    await finish();
  });

  $('loginClose').addEventListener('click', () => overlay.close());

  return { open, signOut, restore, isSignedIn: () => signedIn };
}

