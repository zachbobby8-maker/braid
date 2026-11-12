// Where we deliver, which ways of paying each country gets, and approximate local prices.
// Prices are always set in Naira. The local amount is only a guide; the merchant confirms the final figure in chat.
import { CONFIG } from './config.js';

export const COUNTRIES = ['NG', 'ZA', 'KE', 'GH'];

const INFO = {
  NG: { currency: 'NGN', locale: 'en-NG', zones: ['Africa/Lagos'] },
  ZA: { currency: 'ZAR', locale: 'en-ZA', zones: ['Africa/Johannesburg'] },
  KE: { currency: 'KES', locale: 'en-KE', zones: ['Africa/Nairobi'] },
  GH: { currency: 'GHS', locale: 'en-GH', zones: ['Africa/Accra'] },
};

// Delivery choices per country (labels live in locales as delivery.<key>).
export const DELIVERY = {
  NG: ['lagos', 'nigeria', 'viewing', 'video'],
  ZA: ['za', 'video'],
  KE: ['ke', 'video'],
  GH: ['gh', 'video'],
};

// Ways to pay per country, best-known first (labels live in locales as pay.method.<key>).
export const PAY_METHODS = {
  NG: ['escrow', 'bank', 'card', 'mobile', 'crypto', 'cash', 'trade'],
  ZA: ['escrow', 'bank', 'card', 'crypto', 'trade'],
  KE: ['mobile', 'bank', 'escrow', 'card', 'crypto', 'trade'],
  GH: ['mobile', 'bank', 'escrow', 'card', 'crypto', 'trade'],
};

// Mobile money is called something different in each country.
export const payKey = (method, country) => (method === 'mobile' ? `mobile.${country}` : method);

export function guessCountry() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return COUNTRIES.find((cc) => INFO[cc].zones.includes(zone)) || 'NG';
  } catch {
    return 'NG';
  }
}

// "" for Nigeria (already in Naira) or when no rate is set.
export function localPrice(priceNgn, country) {
  const info = INFO[country];
  const naira = Number(priceNgn);
  if (!info || info.currency === 'NGN' || !Number.isFinite(naira)) return '';
  const perUnit = Number(CONFIG.ngnPer && CONFIG.ngnPer[info.currency]);
  if (!perUnit) return '';
  const amount = Math.round(naira / perUnit);
  try {
    return new Intl.NumberFormat(info.locale, { style: 'currency', currency: info.currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${info.currency} ${amount.toLocaleString('en-US')}`;
  }
}

