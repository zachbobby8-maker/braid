// Merchant hand-off: formatting, order / partner messages, chat deep-links, clipboard.
import { CONFIG } from './config.js';

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

// rows: [label, value] pairs, or [separator] single-item rows
function formatRows(rows) {
  const pairs = rows.filter((r) => r.length === 2);
  const width = Math.max(0, ...pairs.map((r) => r[0].length));
  return rows.map((r) => (r.length === 2 ? `${r[0].padEnd(width)} : ${r[1]}` : r[0])).join('\n');
}

const RULE = '────────────────────────';

// buyer: { name, country label, delivery label, location, note, payLabel, localAmount }
export function buildDossier(t, watch, buyer, ticket) {
  const amount = buyer.localAmount ? `${fmtPrice(watch.priceNgn)} (≈ ${buyer.localAmount})` : fmtPrice(watch.priceNgn);
  return formatRows([
    [t('dossier.heading')],
    [RULE],
    [t('dossier.inquiry'), ticket],
    [t('dossier.piece'), `${watch.brand} ${watch.model} (${watch.year})`],
    [t('dossier.type'), t(`kind.${watch.kind || 'normal'}`)],
    [t('dossier.watchId'), watch.id],
    [t('dossier.ref'), `${watch.ref} · ${watch.caliber}`],
    [t('dossier.price'), amount],
    [t('dossier.listed'), fmtDateTime(watch.listedAt)],
    [t('dossier.status'), t(`status.${watch.status}`)],
    ...(buyer.payLabel ? [[t('dossier.payment'), buyer.payLabel]] : []),
    [RULE],
    [t('dossier.client'), buyer.name],
    ...(buyer.contact ? [[t('dossier.contact'), buyer.contact]] : []),
    [t('dossier.country'), buyer.countryLabel],
    [t('dossier.delivery'), buyer.deliveryLabel],
    [t('dossier.address'), buyer.location],
    [t('dossier.note'), buyer.note || t('dossier.defaultNote')],
  ]);
}

export function buildSellMessage(t, data, ticket) {
  return formatRows([
    [t('sellmsg.heading')],
    [RULE],
    [t('sellmsg.request'), ticket],
    [t('sellmsg.piece'), data.model],
    [t('sellmsg.ref'), data.ref],
    [t('sellmsg.condition'), data.conditionLabel],
    [t('sellmsg.wants'), data.intentLabel],
    [t('sellmsg.asking'), data.price],
    [t('sellmsg.contact'), data.contact],
    [t('sellmsg.photos'), data.photoUrls.length ? data.photoUrls.join('\n  ') : t('sellmsg.noPhotos')],
  ]);
}

// A store owner introducing their shop to the merchant.
export function buildPartnerMessage(t, data, ticket) {
  return formatRows([
    [t('partnermsg.heading')],
    [RULE],
    [t('partnermsg.request'), ticket],
    [t('partnermsg.store'), data.store],
    [t('partnermsg.owner'), data.owner],
    [t('partnermsg.where'), data.where],
    [t('partnermsg.stock'), data.stockLabel],
    [t('partnermsg.volume'), data.volumeLabel],
    [t('partnermsg.contact'), data.contact],
    [t('partnermsg.note'), data.note || t('partnermsg.noNote')],
  ]);
}

export function chatLinks(text) {
  const enc = encodeURIComponent(text);
  const wa = `https://wa.me/${CONFIG.whatsappNumber || ''}?text=${enc}`;
  const tg = CONFIG.telegramUsername
    ? `https://t.me/${CONFIG.telegramUsername}`
    : `https://t.me/share/url?url=%20&text=${enc}`;
  return { wa, tg };
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy copy */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
