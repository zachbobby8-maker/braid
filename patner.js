// Store owners: tell the merchant what you stock and want to sell through Braid Watches.
import { $, t, toast, createOverlay } from './dom.js';
import { buildPartnerMessage, chatLinks, copyText, ticketCode } from './merchant.js';
import { guessCountry } from './markets.js';
import { sendCopy } from './inbox.js';

export function initPartner({ onClose } = {}) {
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
      store: $('ptStore').value.trim(),
      owner: $('ptOwner').value.trim(),
      where: `${$('ptCity').value.trim()}, ${t(`market.${$('ptCountry').value}`)}`,
      stockLabel: t(`partner.stockOpt.${$('ptStock').value}`),
      volumeLabel: t(`partner.volOpt.${$('ptVolume').value}`),
      contact: $('ptContact').value.trim(),
      note: $('ptMessage').value.trim(),
    }, ticket);

    sendCopy($('ptInboxNote'), {
      kind: 'partner', ticket, title: $('ptStore').value.trim(), contact: $('ptContact').value.trim(), country: $('ptCountry').value, text: message,
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

  $('ptTg').addEventListener('click', async () => {
    if (await copyText(message)) toast(t('toast.tgCopied'));
  });
  $('ptCopy').addEventListener('click', async () => {
    toast(t((await copyText(message)) ? 'toast.copied' : 'toast.copyFailed'));
  });
  $('ptAnother').addEventListener('click', () => { reset(); $('ptStore').focus(); });
  $('ptClose').addEventListener('click', () => overlay.close());

  return {
    open() { reset(); overlay.open($('ptStore')); },
    close: overlay.close,
    isOpen: overlay.isOpen,
  };
}

