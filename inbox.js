// Merchant inbox (admin only): every order, valuation request and store message the site received.
// Also exports sendCopy(), which the buyer forms call to leave a copy on the merchant's desk.
import { $, t, esc, toast, createOverlay } from './dom.js';
import * as backend from './backend.js';
import { copyText, fmtDateTime } from './merchant.js';

const KINDS = ['order', 'sell', 'partner'];
const DIAL = { NG: '234', ZA: '27', KE: '254', GH: '233' };
const POLL_MS = 60000;
const OPEN_FIRST = 5;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const HANDLE = /(?:^|[\s,;])@([A-Za-z][A-Za-z0-9_]{3,31})\b/;

// Buyer side: saves a copy of the message on the merchant's desk and tells the buyer.
export async function sendCopy(noteEl, entry) {
  if (!backend.hasDatabase()) { noteEl.hidden = true; return false; }
  noteEl.dataset.ticket = entry.ticket;
  noteEl.hidden = false;
  noteEl.classList.remove('is-ok', 'is-warn');
  noteEl.textContent = t('inbox.sending');
  const res = await backend.sendInbox(entry);
  if (noteEl.dataset.ticket !== entry.ticket) return res.saved;
  noteEl.classList.toggle('is-ok', res.saved);
  noteEl.classList.toggle('is-warn', !res.saved);
  noteEl.textContent = t(res.saved ? 'inbox.sent' : 'inbox.sendFailed');
  return res.saved;
}

// Works out how the merchant can answer: WhatsApp for phone numbers, Telegram for @handles, email for addresses.
function replyLinks(contact, country) {
  const raw = String(contact || '').trim();
  const links = [];
  const mail = raw.match(EMAIL);
  const handle = raw.match(HANDLE);
  const rest = raw.replace(EMAIL, ' ').replace(/@\w+/g, ' ');
  let digits = rest.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 15) {
    if (/^\s*0/.test(rest) && DIAL[country]) digits = DIAL[country] + digits.slice(1);
    links.push({ type: 'wa', href: `https://wa.me/${digits}` });
  }
  if (handle) links.push({ type: 'tg', href: `https://t.me/${handle[1]}` });
  if (mail) links.push({ type: 'mail', href: `mailto:${mail[0]}` });
  return links;
}

const linkify = (text) => esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);

const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';

function modalMarkup() {
  return `
    <div class="modal inbox" id="inboxModal" role="dialog" aria-modal="true" aria-labelledby="inboxTitle" tabindex="-1">
      <div class="modal__bar">
        <div>
          <p class="eyebrow">${esc(t('inbox.eyebrow'))}</p>
          <h2 id="inboxTitle">${esc(t('inbox.title'))}</h2>
        </div>
        <button type="button" class="icon-btn" id="inboxClose" aria-label="${esc(t('a11y.close'))}">${CLOSE_ICON}</button>
      </div>
      <div class="modal__body">
        <div class="inbox__tools">
          <label class="check"><input type="checkbox" id="inboxShowDone"><span>${esc(t('inbox.showDone'))}</span></label>
          <button type="button" class="btn btn--outline btn--sm" id="inboxRefresh">${esc(t('inbox.refresh'))}</button>
        </div>
        <p class="mono-note" id="inboxStatus" role="status"></p>
        <p class="inbox__empty" id="inboxEmpty" hidden></p>
        <ul class="inbox__list" id="inboxList"></ul>
      </div>
    </div>`;
}

export function initInbox({ onAuthLost }) {
  const btn = $('inboxBtn');
  const badge = $('inboxCount');
  let overlay = null;
  let items = null;
  let known = null;
  let loading = false;
  let showDone = false;
  let confirmId = '';
  let confirmTimer = 0;
  let pollTimer = 0;

  const unread = () => (items || []).filter((i) => !i.done).length;
  const setStatus = (key) => { const el = $('inboxStatus'); if (el) el.textContent = key ? t(key) : ''; };

  function setBadge() {
    const n = unread();
    badge.hidden = n === 0;
    badge.textContent = String(n);
  }

  function itemHTML(it, open) {
    const kind = KINDS.includes(it.kind) ? it.kind : 'order';
    const reply = replyLinks(it.contact, it.country).map((l) => {
      const style = l.type === 'wa' ? 'btn--wa' : l.type === 'tg' ? 'btn--tg' : 'btn--outline';
      return `<a class="btn ${style} btn--sm" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(t(`inbox.reply.${l.type}`))}</a>`;
    }).join('');
    const meta = [
      it.contact ? t('inbox.contact', { contact: it.contact }) : t('inbox.noContact'),
      it.country ? t(`market.${it.country}`) : '',
      it.ticket ? `#${it.ticket}` : '',
    ].filter(Boolean).join(' · ');
    const id = esc(it.id);
    return `
      <li class="inbox__item ${it.done ? 'is-done' : 'is-new'}">
        <div class="inbox__head">
          <span class="inbox__kind inbox__kind--${kind}">${esc(t(`inbox.kind.${kind}`))}</span>
          <strong class="inbox__title">${esc(it.title || t(`inbox.kind.${kind}`))}</strong>
          <span class="inbox__flag">${esc(t(it.done ? 'inbox.handled' : 'inbox.new'))}</span>
        </div>
        <p class="inbox__meta">${esc(fmtDateTime(it.at))}</p>
        <p class="inbox__meta">${esc(meta)}</p>
        <details${open ? ' open' : ''}>
          <summary>${esc(t('inbox.read'))}</summary>
          <pre class="packet">${linkify(it.text || '')}</pre>
        </details>
        <div class="inbox__actions">
          ${reply}
          <button type="button" class="btn btn--outline btn--sm" data-act="copy" data-id="${id}">${esc(t('inbox.copy'))}</button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="${it.done ? 'reopen' : 'done'}" data-id="${id}">${esc(t(it.done ? 'inbox.reopen' : 'inbox.done'))}</button>
          <button type="button" class="btn btn--ghost btn--sm btn--danger" data-act="delete" data-id="${id}">${esc(t(confirmId === it.id ? 'inbox.deleteSure' : 'inbox.delete'))}</button>
        </div>
      </li>`;
  }

  function render() {
    if (!overlay) return;
    const rows = (items || []).filter((i) => showDone || !i.done);
    const empty = $('inboxEmpty');
    empty.hidden = items === null || rows.length > 0;
    empty.textContent = t(items && items.length ? 'inbox.emptyNew' : 'inbox.empty');
    let opened = 0;
    $('inboxList').innerHTML = rows.map((it) => itemHTML(it, !it.done && opened++ < OPEN_FIRST)).join('');
  }

  function failed(err) {
    if (err && err.code === 'AUTH') { onAuthLost(); return; }
    toast(t('inbox.actionFailed'));
  }

  async function refresh(quiet) {
    if (loading || !backend.hasDatabase()) return;
    loading = true;
    if (!quiet) setStatus('inbox.loading');
    try {
      const list = await backend.loadInbox();
      items = list.filter((i) => i && typeof i.id === 'string');
      const n = unread();
      if (known !== null && n > known) toast(t('inbox.newToast'));
      known = n;
      setStatus('');
      setBadge();
      render();
    } catch (err) {
      if (err && err.code === 'AUTH') onAuthLost();
      else if (!quiet) setStatus('inbox.error');
    } finally {
      loading = false;
    }
  }

  async function setDone(it, done) {
    it.done = done;
    render();
    setBadge();
    try {
      await backend.markInbox(it.id, done);
    } catch (err) {
      it.done = !done;
      render();
      setBadge();
      failed(err);
    }
  }

  async function remove(it) {
    if (confirmId !== it.id) {
      confirmId = it.id;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { confirmId = ''; render(); }, 4000);
      render();
      $('inboxList').querySelector(`[data-act="delete"][data-id="${CSS.escape(it.id)}"]`)?.focus();
      return;
    }
    clearTimeout(confirmTimer);
    confirmId = '';
    try {
      await backend.deleteInbox(it.id);
      items = items.filter((i) => i.id !== it.id);
      known = unread();
      render();
      setBadge();
      toast(t('inbox.deleted'));
    } catch (err) {
      render();
      failed(err);
    }
  }

  async function onAction(e) {
    const el = e.target.closest('[data-act]');
    const it = el && (items || []).find((i) => i.id === el.dataset.id);
    if (!it) return;
    const act = el.dataset.act;
    if (act === 'copy') toast(t((await copyText(it.text)) ? 'toast.copied' : 'toast.copyFailed'));
    else if (act === 'done' || act === 'reopen') await setDone(it, act === 'done');
    else if (act === 'delete') await remove(it);
  }

  function build() {
    const backdrop = document.createElement('div');
    backdrop.className = 'overlay overlay--center';
    backdrop.id = 'inboxBackdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = modalMarkup();
    document.body.appendChild(backdrop);
    overlay = createOverlay(backdrop, $('inboxModal'));
    $('inboxClose').addEventListener('click', () => overlay.close());
    $('inboxRefresh').addEventListener('click', () => refresh(false));
    $('inboxShowDone').addEventListener('change', (e) => { showDone = e.target.checked; render(); });
    $('inboxList').addEventListener('click', onAction);
  }

  function open() {
    if (!overlay) build();
    overlay.open($('inboxClose'));
    if (!backend.hasDatabase()) {
      setStatus('inbox.needDb');
      $('inboxEmpty').hidden = true;
      $('inboxList').innerHTML = '';
      return;
    }
    setStatus('');
    render();
    refresh(false);
  }

  // Called when an admin signs in or out: starts or stops checking for new messages.
  function watch(on) {
    clearInterval(pollTimer);
    if (!on) {
      items = null;
      known = null;
      badge.hidden = true;
      if (overlay && overlay.isOpen()) overlay.close();
      return;
    }
    if (!backend.hasDatabase()) return;
    refresh(true);
    pollTimer = setInterval(() => { if (!document.hidden) refresh(true); }, POLL_MS);
  }

  btn.addEventListener('click', open);

  return { open, watch };
}
