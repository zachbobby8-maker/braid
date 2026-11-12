// "Sell / Trade Your Watch" flow: details + up to 3 photos -> ready-to-send merchant message.
import { $, t, esc, toast, createOverlay, labelAsButton } from './dom.js';
import { buildSellMessage, chatLinks, copyText, ticketCode } from './merchant.js';
import { uploadPhotos } from './ai-photos.js';
import { sendCopy } from './inbox.js';

const MAX_PHOTOS = 3;
const MAX_BYTES = 15 * 1024 * 1024;

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

