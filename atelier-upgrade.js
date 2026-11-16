import { $, createOverlay, esc, kvGet, kvSet, t, toast } from './dom.js';
import { watchSVG } from './watch-art.js';

const CART_KEY = 'bw.collector.vault';

function cleanCart(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry.id === 'string')
    .map((entry) => ({ id: entry.id, qty: 1 }))
    .slice(0, 24);
}

function watchName(watch) {
  return `${watch?.brand || ''} ${watch?.model || ''}`.trim();
}

export function initAtelier({ getWatches, findWatch, openWatch, formatPrice, getCurrency, onCurrencyChange }) {
  const backdrop = $('atelierVaultBackdrop');
  const drawer = $('atelierVaultDrawer');
  const closeButton = $('atelierVaultClose');
  const list = $('atelierVaultList');
  const empty = $('atelierVaultEmpty');
  const count = $('atelierVaultCount');
  const total = $('atelierVaultTotal');
  const requestButton = $('atelierVaultRequest');
  const featureArt = $('atelierFeatureArt');
  const featureTitle = $('atelierFeatureTitle');
  const featureMeta = $('atelierFeatureMeta');
  const featureOpen = $('atelierFeatureOpen');
  const featureAdd = $('atelierFeatureAdd');
  const currencyButtons = [...document.querySelectorAll('[data-currency]')];

  if (!backdrop || !drawer || !list || !empty || !featureArt) {
    throw new Error('Atelier upgrade markup is incomplete');
  }

  let cart = [];
  let featureId = '';
  let currency = getCurrency?.() === 'USD' ? 'USD' : 'NGN';
  const overlay = createOverlay(backdrop, drawer, { onClose: () => closeButton?.focus({ preventScroll: true }) });

  const watches = () => (getWatches?.() || []).filter((watch) => watch && watch.id);
  const liveWatch = (id) => watches().find((watch) => watch.id === id) || findWatch?.(id);

  function syncCurrency() {
    currencyButtons.forEach((button) => {
      const active = button.dataset.currency === currency;
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderFeature() {
    const available = watches().filter((watch) => watch.status !== 'sold');
    const watch = available.find((item) => item.featured) || available[0] || watches()[0] || null;
    featureId = watch?.id || '';
    featureArt.replaceChildren();

    if (!watch) {
      featureTitle.textContent = t('atelier.notAvailable');
      featureMeta.textContent = '';
      featureOpen.disabled = true;
      featureAdd.disabled = true;
      return;
    }

    featureTitle.textContent = watchName(watch);
    featureMeta.textContent = `${watch.brand || ''} · ${watch.ref || ''} · ${formatPrice(watch.priceNgn)}`;
    featureOpen.disabled = false;
    featureAdd.disabled = watch.status === 'sold';

    if (watch.image) {
      const image = document.createElement('img');
      image.src = watch.image;
      image.alt = watchName(watch);
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        featureArt.replaceChildren(document.createRange().createContextualFragment(watchSVG(watch)));
      }, { once: true });
      featureArt.append(image);
    } else {
      featureArt.append(document.createRange().createContextualFragment(watchSVG(watch)));
    }
  }

  function renderCart() {
    const entries = cart
      .map((entry) => ({ entry, watch: liveWatch(entry.id) }))
      .filter(({ watch }) => watch);
    const itemCount = entries.length;
    count.textContent = String(itemCount);
    empty.hidden = itemCount !== 0;
    list.hidden = itemCount === 0;
    requestButton.disabled = itemCount === 0;

    const totalNgn = entries.reduce((sum, { watch }) => sum + (Number(watch.priceNgn) || 0), 0);
    total.textContent = formatPrice(totalNgn);

    if (!itemCount) {
      list.replaceChildren();
      return;
    }

    list.innerHTML = entries.map(({ watch }) => {
      const name = watchName(watch);
      return `
        <article class="atelier-vault-row">
          <div class="atelier-vault-row__art">${watch.image
            ? `<img src="${esc(watch.image)}" alt="${esc(name)}" loading="lazy">`
            : watchSVG(watch)}
          </div>
          <div class="atelier-vault-row__copy">
            <span class="atelier-vault-row__eyebrow">${esc(t(`tier.${watch.tier || 'other'}`))}</span>
            <h3>${esc(name)}</h3>
            <p>${esc(formatPrice(watch.priceNgn))}</p>
          </div>
          <button type="button" class="atelier-vault-row__remove" data-vault-remove="${esc(watch.id)}" aria-label="${esc(t('atelier.remove', { name }))}">&times;</button>
        </article>`;
    }).join('');
  }

  function refresh() {
    currency = getCurrency?.() === 'USD' ? 'USD' : 'NGN';
    syncCurrency();
    renderFeature();
    renderCart();
  }

  async function persistCart() {
    try {
      await kvSet(CART_KEY, cart);
    } catch {
      toast(t('atelier.saveFailed'));
    }
  }

  async function add(id) {
    const watch = liveWatch(id);
    if (!watch) return;
    if (watch.status === 'sold') {
      toast(t('atelier.sold'));
      return;
    }
    if (cart.some((entry) => entry.id === id)) {
      toast(t('atelier.already', { name: watchName(watch) }));
      open();
      return;
    }
    cart.push({ id, qty: 1 });
    await persistCart();
    renderCart();
    toast(t('atelier.added', { name: watchName(watch) }));
    open();
  }

  async function remove(id) {
    cart = cart.filter((entry) => entry.id !== id);
    await persistCart();
    renderCart();
  }

  function open() {
    overlay.open(closeButton || drawer);
  }

  function close() {
    overlay.close();
  }

  function request() {
    const first = cart.map((entry) => liveWatch(entry.id)).find((watch) => watch && watch.status !== 'sold');
    if (!first) {
      toast(t('atelier.requestEmpty'));
      return;
    }
    close();
    openWatch?.(first.id);
    toast(t('atelier.requestHint'));
  }

  function chooseCurrency(next) {
    const normalized = next === 'USD' ? 'USD' : 'NGN';
    if (normalized === currency) {
      syncCurrency();
      return;
    }
    currency = normalized;
    syncCurrency();
    try {
      onCurrencyChange?.(normalized);
    } catch {
      toast(t('atelier.currencyFailed'));
    }
  }

  document.getElementById('atelierBrowse')?.addEventListener('click', () => {
    document.getElementById('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('atelierVaultBtn')?.addEventListener('click', open);
  document.getElementById('atelierOpenVault')?.addEventListener('click', open);
  closeButton?.addEventListener('click', close);
  requestButton?.addEventListener('click', request);
  featureArt.addEventListener('click', () => { if (featureId) openWatch?.(featureId); });
  featureOpen?.addEventListener('click', () => { if (featureId) openWatch?.(featureId); });
  featureAdd?.addEventListener('click', () => { if (featureId) add(featureId); });
  currencyButtons.forEach((button) => button.addEventListener('click', () => chooseCurrency(button.dataset.currency)));
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  list.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-vault-remove]');
    if (removeButton) remove(removeButton.dataset.vaultRemove);
  });
  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-vault-add]');
    if (addButton) add(addButton.dataset.vaultAdd);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.isOpen()) close(); });

  kvGet(CART_KEY).then((saved) => {
    cart = cleanCart(saved);
    refresh();
  }).catch(() => refresh());
  refresh();

  return { add, open, close, refresh, setCurrency: chooseCurrency };
}
