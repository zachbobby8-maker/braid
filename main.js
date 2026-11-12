import { CONFIG, isChatConfigured } from './config.js';
import { watchSVG } from './watch-art.js';
import { $, t, esc, toast, createOverlay, initI18nFallback, kvGet, kvSet } from './dom.js';
import { initSell } from './sell.js';
import { initAdminAuth } from './admin-auth.js';
import * as backend from './backend.js';
import { initEditor } from './editor.js';
import { initAdminPhotos } from './admin-photos.js';
import { initCheckout } from './checkout.js';
import { initInbox, sendCopy } from './inbox.js';
import { initFx } from './fx.js';
import { guessCountry } from './markets.js';
import { withTimeout, safeInit, on, markReady, markFailed } from './boot.js';

const CONDITIONS = ['box', 'unpolished', 'serviced', 'originalDial'];
const STATUS_ORDER = ['available', 'hold', 'sold'];
const KEYS = { theme: 'bw.theme', buyer: 'bw.buyer' };
const CLOCK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

const state = {
  cat: 'all', kind: 'all', query: '', availableOnly: false, admin: false, theme: 'vault',
  watches: [], loaded: false, source: 'sample', buyer: {}, active: null, dossier: '', busy: false, bulk: false, stopBulk: false, confirmClear: false,
  loadError: false,
};

/* ---------- small handoff helpers kept here so a partial upload cannot stop the vault ---------- */
export function fmtDateTime(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CONFIG.timeZone, month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${get('month')} ${get('day')}, ${get('year')} • ${get('hour')}:${get('minute')} ${CONFIG.timeZoneLabel}`;
  } catch {
    return d.toUTCString();
  }
}

export const fmtPrice = (n) => `₦${Math.round(Number(n) || 0).toLocaleString('en-NG')}`;
export const ticketCode = (prefix) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

function formatRows(rows) {
  const pairs = rows.filter((r) => r.length === 2);
  const width = Math.max(0, ...pairs.map((r) => r[0].length));
  return rows.map((r) => (r.length === 2 ? `${r[0].padEnd(width)} : ${r[1]}` : r[0])).join('\n');
}

const RULE = '────────────────────────';

function buildDossier(t, watch, buyer, ticket) {
  const amount = buyer.localAmount ? `${fmtPrice(watch.priceNgn)} (≈ ${buyer.localAmount})` : fmtPrice(watch.priceNgn);
  return formatRows([
    [t('dossier.heading')], [RULE],
    [t('dossier.inquiry'), ticket],
    [t('dossier.piece'), `${watch.brand} ${watch.model} (${watch.year})`],
    [t('dossier.type'), t(`kind.${watch.kind || 'normal'}`)],
    [t('dossier.watchId'), watch.id],
    [t('dossier.ref'), `${watch.ref} · ${watch.caliber}`],
    [t('dossier.price'), amount],
    [t('dossier.listed'), fmtDateTime(watch.listedAt)],
    [t('dossier.status'), t(`status.${watch.status}`)],
    ...(buyer.payLabel ? [[t('dossier.payment'), buyer.payLabel]] : []), [RULE],
    [t('dossier.client'), buyer.name], ...(buyer.contact ? [[t('dossier.contact'), buyer.contact]] : []),
    [t('dossier.country'), buyer.countryLabel], [t('dossier.delivery'), buyer.deliveryLabel],
    [t('dossier.address'), buyer.location], [t('dossier.note'), buyer.note || t('dossier.defaultNote')],
  ]);
}

function chatLinks(text) {
  const enc = encodeURIComponent(text);
  return {
    wa: `https://wa.me/${CONFIG.whatsappNumber || ''}?text=${enc}`,
    tg: CONFIG.telegramUsername ? `https://t.me/${CONFIG.telegramUsername}` : `https://t.me/share/url?url=%20&text=${enc}`,
  };
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* use the legacy path below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

/* ---------- storage (theme and buyer details stay on this device) ---------- */
async function load(key, fallback) {
  const value = await kvGet(key);
  return value ?? fallback;
}
const save = (key, value) => kvSet(key, value);

/* ---------- data ---------- */
const allWatches = () => [...state.watches].sort((a, b) => new Date(b.listedAt) - new Date(a.listedAt));
const findWatch = (id) => state.watches.find((w) => w.id === id);

function visibleWatches() {
  const q = state.query.trim().toLowerCase();
  return allWatches().filter((w) => {
    if (state.cat !== 'all' && w.tier !== state.cat) return false;
    if (state.kind !== 'all' && w.kind !== state.kind) return false;
    if (state.availableOnly && w.status !== 'available') return false;
    if (!q) return true;
    return [w.brand, w.model, w.ref, w.caliber, w.movement, w.year, t(`kind.${w.kind}`)].some((v) => String(v).toLowerCase().includes(q));
  });
}

// Saves are queued so quick taps never overwrite each other.
let saveQueue = Promise.resolve();
function persist() {
  saveQueue = saveQueue.then(async () => {
    try {
      const where = await backend.saveCatalog(state.watches);
      toast(t(where === 'live' ? 'toast.savedLive' : 'toast.savedDevice'));
    } catch (err) {
      if (err && err.code === 'AUTH') { toast(t('toast.sessionEnded')); auth.signOut(); }
      else toast(t('toast.saveFailed'));
    }
  });
  return saveQueue;
}

async function patchWatch(id, patch) {
  const i = state.watches.findIndex((w) => w.id === id);
  if (i < 0) return;
  state.watches[i] = { ...state.watches[i], ...patch };
  await persist();
}

/* ---------- artwork ---------- */
function artMarkup(w, alt = '') {
  if (!w.image) return watchSVG(w);
  return `<img src="${esc(w.image)}" alt="${esc(alt)}" loading="lazy" data-photo="${esc(w.id)}">`;
}
function bindFallbacks(root) {
  root.querySelectorAll('img[data-photo]').forEach((img) => {
    img.addEventListener('error', () => {
      const w = findWatch(img.dataset.photo);
      if (w) img.replaceWith(document.createRange().createContextualFragment(watchSVG(w)));
    }, { once: true });
  });
}

/* ---------- catalogue ---------- */
function cardHTML(w) {
  const statusText = esc(t(`status.${w.status}`));
  const pill = state.admin
    ? `<button type="button" class="pill pill--${w.status} is-admin" data-cycle="${esc(w.id)}" title="${esc(t('admin.cycle'))}">${statusText}</button>`
    : `<span class="pill pill--${w.status}">${statusText}</span>`;
  const tags = CONDITIONS.filter((c) => (w.conditions || []).includes(c)).map((c) => `<li class="on">${esc(t(`tag.${c}`))}</li>`).join('');
  return `
    <article class="card${w.featured ? ' card--wide' : ''}${w.status === 'sold' ? ' is-sold' : ''}" data-id="${esc(w.id)}">
      <div class="card__top">${pill}<span class="card__meta">${esc(w.year)} · ${esc(w.movement)}</span></div>
      <div class="card__art">${artMarkup(w)}<span class="kind-tag kind-tag--${esc(w.kind)}">${esc(t(`kind.${w.kind}`))}</span><span class="ref-tag">${esc(t('card.ref', { ref: w.ref }))}</span></div>
      <div class="card__body">
        <div class="card__brandline"><span>${esc(w.brand)}</span><span>${esc(w.caliber)}</span></div>
        <h2 class="card__title"><button type="button" class="card__open" data-open="${esc(w.id)}" aria-label="${esc(t('card.openLabel', { name: `${w.brand} ${w.model}` }))}">${esc(w.model)}</button></h2>
        <p class="card__listed">${CLOCK_ICON}<span>${esc(t('card.listed', { date: fmtDateTime(w.listedAt) }))}</span></p>
        <ul class="mini-matrix">${tags}</ul>
      </div>
      <div class="card__foot">
        <div class="card__price"><small>${esc(t('card.valuation'))}</small><strong>${esc(fmtPrice(w.priceNgn))}</strong></div>
        <span class="card__cta">${esc(t('card.inspect'))} <span aria-hidden="true">&rarr;</span></span>
      </div>
    </article>`;
}

function render() {
  const all = allWatches();
  const list = visibleWatches();
  const grid = $('grid');
  $('loadingState').hidden = state.loaded;
  // One damaged listing must never stop the rest of the vault from showing.
  grid.innerHTML = list.map((w) => {
    try { return cardHTML(w); } catch (err) { console.error('[braid] skipped a watch that could not be drawn', w && w.id, err); return ''; }
  }).join('');
  bindFallbacks(grid);
  grid.hidden = list.length === 0;
  $('emptyVault').hidden = !state.loaded || all.length > 0 || state.loadError;
  $('emptyAdd').hidden = !state.admin;
  $('emptyState').hidden = !state.loaded || list.length > 0 || all.length === 0;
  $('resultCount').textContent = t('results.count', { shown: list.length, total: all.length });
  $('availableCount').textContent = t('results.available', { n: all.filter((w) => w.status === 'available').length });
  photos.syncBulkLabel();
  syncClearSamples();
}

function syncChips() {
  document.querySelectorAll('#categoryFilters .chip').forEach((chip) => {
    const on = chip.dataset.cat === state.cat;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-pressed', String(on));
  });
}

function resetFilters() {
  state.cat = 'all';
  state.kind = 'all';
  state.query = '';
  state.availableOnly = false;
  $('searchInput').value = '';
  $('kindFilter').value = 'all';
  $('availableOnly').checked = false;
  syncChips();
  render();
}

async function cycleStatus(id) {
  const w = findWatch(id);
  if (!w) return;
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(w.status) + 1) % STATUS_ORDER.length];
  await patchWatch(id, { status: next });
  render();
  const btn = document.querySelector(`[data-cycle="${CSS.escape(id)}"]`);
  if (btn) btn.focus();
}

async function setStatusFromDrawer(value) {
  const w = state.active && findWatch(state.active);
  if (!w || !STATUS_ORDER.includes(value) || w.status === value) return;
  await patchWatch(w.id, { status: value });
  render();
  refreshActive();
}

/* ---------- inspection drawer ---------- */
const drawer = createOverlay($('drawerBackdrop'), $('drawer'), { onClose: () => { state.active = null; } });
const checkout = safeInit('checkout', initCheckout);

function fillDrawer(w) {
  const pill = $('drawerStatus');
  pill.className = `pill pill--${w.status}`;
  pill.textContent = t(`status.${w.status}`);
  $('drawerRef').textContent = t('card.ref', { ref: w.ref });
  $('drawerArt').innerHTML = artMarkup(w, `${w.brand} ${w.model}`);
  bindFallbacks($('drawerArt'));
  $('drawerTier').textContent = `${t(`tier.${w.tier}`)} · ${t(`kind.${w.kind}`)}`;
  $('drawerYear').textContent = t('drawer.circa', { year: w.year });
  $('drawerTitle').textContent = `${w.brand} ${w.model}`;
  $('drawerPrice').textContent = fmtPrice(w.priceNgn);
  $('drawerListed').textContent = t('card.listed', { date: fmtDateTime(w.listedAt) });
  $('specRef').textContent = w.ref;
  $('specYear').textContent = w.year;
  $('specMovement').textContent = w.movement;
  $('specCaliber').textContent = w.caliber;
  $('specCase').textContent = w.caseSize;
  $('specRate').textContent = w.rate;
  $('conditionMatrix').innerHTML = CONDITIONS.map((c) => {
    const on = (w.conditions || []).includes(c);
    return `<li class="${on ? 'on' : ''}"><span class="matrix__icon" aria-hidden="true">${on ? '&#10003;' : '&ndash;'}</span><span>${esc(t(`tag.${c}`))}</span><span class="sr-only">${esc(t(on ? 'matrix.yes' : 'matrix.no'))}</span></li>`;
  }).join('');
  $('drawerHighlights').innerHTML = (w.highlights || []).map((h) => `<li>${esc(h)}</li>`).join('');
  $('drawerNotes').textContent = w.notes || '';
  $('adminTools').hidden = !state.admin;
  document.querySelectorAll('#quickStatus input').forEach((r) => { r.checked = r.value === w.status; });
  $('aiPhotoLabel').textContent = t(state.busy ? 'tools.working' : 'tools.ai');
  $('handoffSubmitLabel').textContent = t(w.status === 'sold' ? 'handoff.submitSold' : 'handoff.submit');
}

function openDrawer(id) {
  const w = findWatch(id);
  if (!w) return;
  state.active = id;
  fillDrawer(w);
  $('toolStatus').textContent = '';
  $('photoLink').value = '';
  $('handoffForm').hidden = false;
  $('handoffResult').hidden = true;
  $('buyerName').value = state.buyer.name || '';
  $('buyerLocation').value = state.buyer.location || '';
  $('buyerContact').value = state.buyer.contact || '';
  $('orderInboxNote').hidden = true;
  checkout.prepare(w, state.buyer);
  $('buyerNote').value = '';
  drawer.open($('drawerClose'));
}

function refreshActive() {
  const w = state.active && findWatch(state.active);
  if (w) fillDrawer(w);
}

/* ---------- merchant hand-off ---------- */
function openChat(url) {
  const win = window.open(url, '_blank');
  if (!win) { toast(t('toast.popup')); return; }
  try { win.opener = null; } catch { /* cross-origin window, ignore */ }
}

async function onHandoff(e) {
  e.preventDefault();
  const w = findWatch(state.active);
  if (!w) return;
  const order = checkout.read(w);
  const buyer = {
    ...order,
    name: $('buyerName').value.trim(),
    location: $('buyerLocation').value.trim(),
    contact: $('buyerContact').value.trim(),
    note: $('buyerNote').value.trim(),
  };
  const channel = document.querySelector('input[name="channel"]:checked')?.value || 'whatsapp';
  const ticket = ticketCode('BW');
  state.dossier = buildDossier(t, w, buyer, ticket);
  const links = chatLinks(state.dossier);

  // The merchant's inbox gets its own copy, so the order is never lost if the chat app isn't used.
  sendCopy($('orderInboxNote'), {
    kind: 'order', ticket, title: `${w.brand} ${w.model}`, contact: buyer.contact, country: order.country, text: state.dossier,
  });

  $('ticketId').textContent = `#${ticket}`;
  $('dossierText').textContent = state.dossier;
  checkout.showSteps(order);
  $('waLink').href = links.wa;
  $('tgLink').href = links.tg;
  $('handoffForm').hidden = true;
  $('handoffResult').hidden = false;
  $('handoffResult').scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  state.buyer = {
    name: buyer.name, location: buyer.location, contact: buyer.contact, delivery: order.delivery, country: order.country, pay: order.pay || state.buyer.pay,
  };
  save(KEYS.buyer, state.buyer);

  if (channel === 'whatsapp') {
    openChat(links.wa);
  } else if (channel === 'telegram') {
    openChat(links.tg);
    if (await copyText(state.dossier)) toast(t('toast.tgCopied'));
  } else {
    toast(t((await copyText(state.dossier)) ? 'toast.copied' : 'toast.copyFailed'));
  }
}

// Sets several watch photos at once and saves the catalogue a single time.
async function setImages(map) {
  let changed = 0;
  state.watches = state.watches.map((w) => {
    if (!map[w.id] || map[w.id] === w.image) return w;
    changed += 1;
    return { ...w, image: map[w.id] };
  });
  if (changed) {
    render();
    refreshActive();
    await persist();
  }
  return changed;
}

/* ---------- admin photo tools (upload, link, AI) live in admin-photos.js ---------- */
const photos = safeInit('photos', () => initAdminPhotos({
  state,
  findWatch,
  allWatches,
  patchWatch,
  setImages,
  render,
  refreshActive,
  onAuthLost: () => { toast(t('toast.sessionEnded')); auth.signOut(); },
}));

/* ---------- add, edit and remove watches (admin) ---------- */
let editReturn = '';

async function saveWatch(watch, isNew) {
  const i = state.watches.findIndex((w) => w.id === watch.id);
  if (i >= 0) state.watches[i] = watch;
  else state.watches.push(watch);
  if (isNew) editReturn = watch.id;
  render();
  await persist();
}

async function removeWatch(id) {
  state.watches = state.watches.filter((w) => w.id !== id);
  render();
  await persist();
}

const editor = safeInit('editor', () => initEditor({
  onSave: saveWatch,
  onDelete: removeWatch,
  onAuthLost: () => { toast(t('toast.sessionEnded')); auth.signOut(); },
  onClose: () => { const id = editReturn; editReturn = ''; if (id) openDrawer(id); },
}));

function openEditor(id) {
  const w = id && findWatch(id);
  if (!w) return;
  editReturn = id;
  drawer.close();
  editor.openEdit(w);
}

function syncClearSamples() {
  const n = state.watches.filter((w) => backend.SAMPLE_IDS.has(w.id)).length;
  $('clearSamplesBtn').hidden = !state.admin || n === 0;
  $('clearSamplesLabel').textContent = t(state.confirmClear ? 'admin.clearSure' : 'admin.clearSamples');
}

let clearTimer = 0;
async function clearSamples() {
  if (!state.confirmClear) {
    state.confirmClear = true;
    syncClearSamples();
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => { state.confirmClear = false; syncClearSamples(); }, 4000);
    return;
  }
  clearTimeout(clearTimer);
  state.confirmClear = false;
  state.watches = state.watches.filter((w) => !backend.SAMPLE_IDS.has(w.id));
  render();
  await persist();
}

/* ---------- theme, admin, clock, tabs ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $('themeLabel').textContent = t(state.theme === 'vault' ? 'theme.toLight' : 'theme.toDark');
  $('themeBtn').setAttribute('aria-pressed', String(state.theme === 'archive'));
}

function syncDbNote() {
  const live = backend.hasDatabase();
  const note = $('adminDb');
  note.textContent = t(live ? 'admin.dbLive' : (backend.isOnline() ? 'admin.dbMissing' : 'admin.dbDevice'));
  note.classList.toggle('is-live', live);
  note.classList.toggle('is-warn', !live);
}

function toggleAdmin(force) {
  state.admin = typeof force === 'boolean' ? force : !state.admin;
  $('adminBanner').hidden = !state.admin;
  $('adminWarn').hidden = isChatConfigured();
  syncDbNote();
  $('adminToggle').hidden = state.admin;
  // AI photo generation only exists inside the preview platform, not on a plain Vercel site.
  $('genAllBtn').hidden = !window.miniappsAI;
  $('aiPhotoBtn').hidden = !window.miniappsAI;
  // Photos made with AI in the preview can be carried over to the live site as links.
  $('copyLinksBtn').hidden = !window.miniappsAI;
  $('pasteLinksBtn').hidden = Boolean(window.miniappsAI);
  inbox.watch(state.admin);
  render();
  refreshActive();
}

const auth = safeInit('admin sign-in', () => initAdminAuth({ onChange: (isOn) => toggleAdmin(isOn) }));
const inbox = safeInit('inbox', () => initInbox({ onAuthLost: () => { toast(t('toast.sessionEnded')); auth.signOut(); } }));

const updateClock = () => { $('liveClock').textContent = fmtDateTime(new Date()); };

function setTab(name) {
  $('tabVault').classList.toggle('is-active', name === 'vault');
  $('tabSell').classList.toggle('is-active', name === 'sell');
}

const sell = safeInit('sell form', () => initSell({ onClose: () => setTab('vault') }));
function openSell() { setTab('sell'); sell.open(); }

function buildPartnerMessage(t, data, ticket) {
  return formatRows([
    [t('partnermsg.heading')], [RULE], [t('partnermsg.request'), ticket],
    [t('partnermsg.store'), data.store], [t('partnermsg.owner'), data.owner], [t('partnermsg.where'), data.where],
    [t('partnermsg.stock'), data.stockLabel], [t('partnermsg.volume'), data.volumeLabel],
    [t('partnermsg.contact'), data.contact], [t('partnermsg.note'), data.note || t('partnermsg.noNote')],
  ]);
}

function initPartner({ onClose } = {}) {
  const form = $('ptForm');
  const done = $('ptDone');
  let message = '';
  const overlay = createOverlay($('ptBackdrop'), $('ptModal'), { onClose });

  function reset() {
    message = '';
    form.reset();
    $('ptCountry').value = guessCountry();
    form.hidden = false;
    done.hidden = true;
    $('ptInboxNote').hidden = true;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ticket = ticketCode('STO');
    message = buildPartnerMessage(t, {
      store: $('ptStore').value.trim(), owner: $('ptOwner').value.trim(),
      where: `${$('ptCity').value.trim()}, ${t(`market.${$('ptCountry').value}`)}`,
      stockLabel: t(`partner.stockOpt.${$('ptStock').value}`),
      volumeLabel: t(`partner.volOpt.${$('ptVolume').value}`),
      contact: $('ptContact').value.trim(), note: $('ptMessage').value.trim(),
    }, ticket);
    sendCopy($('ptInboxNote'), {
      kind: 'partner', ticket, title: $('ptStore').value.trim(), contact: $('ptContact').value.trim(),
      country: $('ptCountry').value, text: message,
    });
    const links = chatLinks(message);
    $('ptWa').href = links.wa;
    $('ptTg').href = links.tg;
    $('ptTicket').textContent = `#${ticket}`;
    $('ptSummary').textContent = message;
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ block: 'nearest' });
  });
  $('ptTg').addEventListener('click', async () => { if (await copyText(message)) toast(t('toast.tgCopied')); });
  $('ptCopy').addEventListener('click', async () => { toast(t((await copyText(message)) ? 'toast.copied' : 'toast.copyFailed')); });
  $('ptAnother').addEventListener('click', () => { reset(); $('ptStore').focus(); });
  $('ptClose').addEventListener('click', () => overlay.close());
  return { open() { reset(); overlay.open($('ptStore')); }, close: overlay.close, isOpen: overlay.isOpen };
}

const BRAND_KEYS = [
  'rolex', 'omega', 'cartier', 'patek', 'audemars', 'vacheron', 'jaeger', 'tudor', 'grandSeiko',
  'zenith', 'iwc', 'breguet', 'breitling', 'tagHeuer', 'longines', 'universalGeneve', 'kingSeiko', 'moser',
];

function initBrandBoard() {
  const list = $('brandBoardList');
  if (!list) return;
  list.replaceChildren();
  BRAND_KEYS.forEach((key, index) => {
    const item = document.createElement('li');
    item.className = 'brand-board__item';
    item.style.setProperty('--brand-delay', `${index * 55}ms`);
    const mark = document.createElement('span');
    mark.className = 'brand-board__mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span');
    name.textContent = t(`brands.${key}`);
    item.append(mark, name);
    list.append(item);
  });
}

const partner = safeInit('store form', initPartner);

/* ---------- wiring ---------- */
function wire() {
  on('grid', 'click', (e) => {
    const cycle = e.target.closest('[data-cycle]');
    if (cycle) { cycleStatus(cycle.dataset.cycle); return; }
    const open = e.target.closest('[data-open]');
    if (open) openDrawer(open.dataset.open);
  });

  on('categoryFilters', 'click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    state.cat = chip.dataset.cat;
    syncChips();
    render();
  });
  on('searchInput', 'input', (e) => { state.query = e.target.value; render(); });
  on('kindFilter', 'change', (e) => { state.kind = e.target.value; render(); });
  on('availableOnly', 'change', (e) => { state.availableOnly = e.target.checked; render(); });
  on('resetFilters', 'click', resetFilters);
  on('brandLink', 'click', () => { resetFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  on('tabVault', 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  on('tabSell', 'click', openSell);
  on('footerSell', 'click', openSell);
  on('partnerOpen', 'click', () => partner.open());
  on('footerPartner', 'click', () => partner.open());

  on('themeBtn', 'click', () => {
    state.theme = state.theme === 'vault' ? 'archive' : 'vault';
    applyTheme();
    save(KEYS.theme, state.theme);
  });
  on('adminToggle', 'click', () => auth.open());
  on('adminExit', 'click', () => { auth.signOut(); toast(t('login.signedOut')); });
  on('addWatchBtn', 'click', () => editor.openNew());
  on('emptyAdd', 'click', () => editor.openNew());
  on('clearSamplesBtn', 'click', clearSamples);
  on('editBtn', 'click', () => openEditor(state.active));
  on('quickStatus', 'change', (e) => {
    if (e.target.matches('input[name="quickStatus"]')) setStatusFromDrawer(e.target.value);
  });

  on('drawerClose', 'click', () => drawer.close());
  on('handoffForm', 'submit', onHandoff);
  on('handoffEdit', 'click', () => {
    $('handoffResult').hidden = true;
    $('handoffForm').hidden = false;
    $('buyerName').focus();
  });
  on('tgLink', 'click', async () => {
    if (await copyText(state.dossier)) toast(t('toast.tgCopied'));
  });
  on('copyDossier', 'click', async () => {
    toast(t((await copyText(state.dossier)) ? 'toast.copied' : 'toast.copyFailed'));
  });

}

// Buyers pick up new photos, prices and sold watches without reloading.
async function pollRemote() {
  if (!backend.hasDatabase() || !state.loaded || state.admin || drawer.isOpen() || document.hidden) return;
  const list = await backend.refreshRemote();
  if (list && JSON.stringify(list) !== JSON.stringify(state.watches)) {
    state.watches = list;
    render();
  }
}

async function boot() {
  await withTimeout(initI18nFallback(), 5000);
  wire();
  applyTheme();
  render();
  initFx();
  initBrandBoard();
  updateClock();
  setInterval(updateClock, 30000);

  await withTimeout(backend.initBackend(), 8000);

  // Show the last watches this browser saw straight away, then refresh from the live database.
  const cached = backend.hasDatabase() ? await withTimeout(backend.readCache(), 3000, null) : null;
  if (cached && cached.length) {
    state.watches = cached;
    state.loaded = true;
    render();
    markReady();
  }

  const [theme, buyer, catalog] = await Promise.all([
    withTimeout(load(KEYS.theme, 'vault'), 4000, 'vault'),
    withTimeout(load(KEYS.buyer, {}), 4000, {}),
    withTimeout(backend.loadCatalog(), 20000, { list: [], source: 'error' }),
  ]);
  state.buyer = buyer && typeof buyer === 'object' ? buyer : {};
  state.theme = theme === 'archive' ? 'archive' : 'vault';
  if (catalog.source !== 'error' || !state.watches.length) state.watches = catalog.list;
  state.source = catalog.source;
  state.loadError = catalog.source === 'error' && !state.watches.length;
  state.loaded = true;
  applyTheme();
  render();
  if (state.loadError) markFailed(t('vault.loadError'));
  else markReady();
  if (catalog.source === 'error') toast(t('toast.loadFailed'));

  if (await withTimeout(auth.restore(), 10000, false)) toggleAdmin(true);
  else if (location.hash === '#admin') auth.open();

  setInterval(pollRemote, 45000);
  document.addEventListener('visibilitychange', pollRemote);
}

boot().catch((err) => {
  console.error('[braid] start-up failed', err);
  markFailed((err && err.message) || String(err));
});
