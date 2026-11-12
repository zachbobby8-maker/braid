// Shared DOM helpers: translation, escaping, toast, and accessible dialogs.

// Text lookup. The platform provides window.miniappI18n; when the app runs on its own
// (for example on Vercel) we fall back to reading locales/en.json ourselves.
let fallbackStrings = null;

export const t = (key, values) => {
  if (window.miniappI18n) return window.miniappI18n.t(key, values) ?? key;
  const raw = fallbackStrings && fallbackStrings[key];
  if (typeof raw !== 'string') return key;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (values && values[name] != null ? String(values[name]) : m));
};

export async function initI18nFallback() {
  if (window.miniappI18n) return;
  try {
    const res = await fetch('./locales/en.json');
    const flat = {};
    const walk = (obj, prefix) => {
      Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (v && typeof v === 'object') walk(v, `${prefix}${k}.`);
        else flat[`${prefix}${k}`] = v;
      });
    };
    walk(await res.json(), '');
    fallbackStrings = flat;
    document.querySelectorAll('[data-i18n]').forEach((el) => { if (flat[el.dataset.i18n]) el.textContent = flat[el.dataset.i18n]; });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { if (flat[el.dataset.i18nPlaceholder]) el.placeholder = flat[el.dataset.i18nPlaceholder]; });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => { if (flat[el.dataset.i18nAriaLabel]) el.setAttribute('aria-label', flat[el.dataset.i18nAriaLabel]); });
  } catch { /* the English text already in the page is used */ }
}

// Small key/value storage: platform storage when available, otherwise this browser's localStorage.
export async function kvGet(key) {
  try {
    const store = window.miniappsAI?.storage;
    const raw = store ? await store.getItem(key) : localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function kvSet(key, value, options) {
  try {
    const raw = JSON.stringify(value);
    if (window.miniappsAI?.storage) await window.miniappsAI.storage.setItem(key, raw, options);
    else localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export async function kvRemove(key) {
  try {
    if (window.miniappsAI?.storage) await window.miniappsAI.storage.removeItem(key);
    else localStorage.removeItem(key);
  } catch { /* nothing to remove */ }
}

export const $ = (id) => document.getElementById(id);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer = 0;
export function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// Lets a <label> styled as a button be used with Enter / Space.
export function labelAsButton(label, input) {
  label.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
}

let openCount = 0;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function createOverlay(backdrop, dialog, { onClose } = {}) {
  let lastFocus = null;
  const isOpen = () => !backdrop.hidden;

  function open(focusEl) {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    dialog.scrollTop = 0;
    (focusEl || dialog).focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    backdrop.hidden = true;
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
    lastFocus = null;
    if (onClose) onClose();
  }

  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden]'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  return { open, close, isOpen };
}
