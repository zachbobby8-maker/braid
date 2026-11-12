// "Sell / Trade Your Watch" flow: details + up to 3 photos -> ready-to-send merchant message.
import { $, t, esc, toast, createOverlay, labelAsButton } from './dom.js';
import { CONFIG } from './config.js';
import { uploadPhotos } from './ai-photos.js';
import { sendCopy } from './inbox.js';

const MAX_PHOTOS = 3;
const MAX_BYTES = 15 * 1024 * 1024;

const ticketCode = (prefix) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
const formatRows = (rows) => {
  const pairs = rows.filter((r) => r.length === 2);
  const width = Math.max(0, ...pairs.map((r) => r[0].length));
  return rows.map((r) => (r.length === 2 ? `${r[0].padEnd(width)} : ${r[1]}` : r[0])).join('\n');
};
const buildSellMessage = (t, data, ticket) => formatRows([
  [t('sellmsg.heading')], ['────────────────────────'], [t('sellmsg.request'), ticket],
  [t('sellmsg.piece'), data.model], [t('sellmsg.ref'), data.ref], [t('sellmsg.condition'), data.conditionLabel],
  [t('sellmsg.wants'), data.intentLabel], [t('sellmsg.asking'), data.price], [t('sellmsg.contact'), data.contact],
  [t('sellmsg.photos'), data.photoUrls.length ? data.photoUrls.join('\n  ') : t('sellmsg.noPhotos')],
]);
const chatLinks = (text) => {
  const enc = encodeURIComponent(text);
  return {
    wa: `https://wa.me/${CONFIG.whatsappNumber || ''}?text=${enc}`,
    tg: CONFIG.telegramUsername ? `https://t.me/${CONFIG.telegramUsername}` : `https://t.me/share/url?url=%20&text=${enc}`,
  };
};
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* use the legacy path below */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

export function initSell({ onClose } = {}) {
  const form = $('sellForm');
  const done = $('sellDone');
  const submit = $('sellSubmit');
  let files = [];
  let message = '';
  let busy = false;

  const overlay = createOverlay($('sellBackdrop'), $('sellModal'), { onClose });

  const setSubmitLabel = (key) => { $('sellSubmitLabel').textContent = t(key); };

  function renderThumbs() {
    $('sellThumbs').innerHTML = files.map((f, i) => `
      <div class="thumb">
        <img src="${esc(f.url)}" alt="${esc(t('sell.photoAlt', { n: i + 1 }))}">
        <button type="button" data-remove="${i}" aria-label="${esc(t('sell.remove'))}">&times;</button>
      </div>`).join('');
    $('sellPhotoNote').textContent = files.length ? t('sell.photosCount', { n: files.length, max: MAX_PHOTOS }) : '';
  }

  function addFiles(list) {
    for (const file of list) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_BYTES) { toast(t('sell.tooBig')); continue; }
      if (files.length >= MAX_PHOTOS) { toast(t('sell.photosMax', { max: MAX_PHOTOS })); break; }
      files.push({ file, url: URL.createObjectURL(file) });
    }
    renderThumbs();
  }

  function reset() {
    files.forEach((f) => URL.revokeObjectURL(f.url));
    files = [];
    message = '';
    form.reset();
    renderThumbs();
    form.hidden = false;
    done.hidden = true;
    $('sellInboxNote').hidden = true;
    submit.disabled = false;
    setSubmitLabel('sell.submit');
  }

  $('sellPhotos').addEventListener('change', (e) => {
    addFiles([...e.target.files]);
    e.target.value = '';
  });
  labelAsButton($('sellDrop'), $('sellPhotos'));

  $('sellThumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const [removed] = files.splice(Number(btn.dataset.remove), 1);
    if (removed) URL.revokeObjectURL(removed.url);
    renderThumbs();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    submit.disabled = true;

    let photoUrls = [];
    let note = t('sell.done.nophotos');
    if (files.length) {
      setSubmitLabel('sell.uploading');
      try {
        photoUrls = await uploadPhotos(files.map((f) => f.file));
        note = t('sell.done.photos', { n: photoUrls.length });
      } catch {
        note = t('sell.done.nolinks');
      }
    }

    const ticket = ticketCode('VAL');
    message = buildSellMessage(t, {
      model: $('sellModel').value.trim(),
      ref: $('sellRef').value.trim(),
      conditionLabel: t(`cond.${$('sellCondition').value}`),
      intentLabel: t(`intent.${$('sellIntent').value}`),
      price: $('sellPrice').value.trim(),
      contact: $('sellContact').value.trim(),
      photoUrls,
    }, ticket);

    sendCopy($('sellInboxNote'), {
      kind: 'sell', ticket, title: $('sellModel').value.trim(), contact: $('sellContact').value.trim(), country: '', text: message,
    });

    const links = chatLinks(message);
    $('sellWa').href = links.wa;
    $('sellTg').href = links.tg;
    $('sellTicket').textContent = `#${ticket}`;
    $('sellSummary').textContent = message;
    $('sellUploadNote').textContent = note;
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ block: 'nearest' });

    busy = false;
    submit.disabled = false;
    setSubmitLabel('sell.submit');
  });

  $('sellTg').addEventListener('click', async () => {
    if (await copyText(message)) toast(t('toast.tgCopied'));
  });
  $('sellCopy').addEventListener('click', async () => {
    toast(t((await copyText(message)) ? 'toast.copied' : 'toast.copyFailed'));
  });
  $('sellAnother').addEventListener('click', () => { reset(); $('sellModel').focus(); });
  $('sellClose').addEventListener('click', () => overlay.close());

  setSubmitLabel('sell.submit');

  return {
    open() { reset(); overlay.open($('sellModel')); },
    close: overlay.close,
    isOpen: overlay.isOpen,
  };
}
