// Checkout fields inside the watch drawer: country, delivery, payment method and the order steps.
// main.js owns the drawer and the merchant hand-off; this module only fills and reads these fields.
import { $, t, esc } from './dom.js';
import { COUNTRIES, DELIVERY, PAY_METHODS, payKey, localPrice, guessCountry } from './markets.js';
import { fmtPrice } from './merchant.js';

export function initCheckout() {
  const country = $('buyerCountry');
  const delivery = $('deliveryMode');

  const code = () => (COUNTRIES.includes(country.value) ? country.value : 'NG');
  const selectedPay = () => document.querySelector('#payOptions input[name="pay"]:checked')?.value || '';

  function fillDelivery(keep) {
    const list = DELIVERY[code()];
    delivery.innerHTML = list.map((key) => `<option value="${esc(key)}">${esc(t(`delivery.${key}`))}</option>`).join('');
    delivery.value = list.includes(keep) ? keep : list[0];
  }

  function fillPay(keep) {
    const cc = code();
    const list = PAY_METHODS[cc];
    const pick = list.includes(keep) ? keep : list[0];
    $('payOptions').innerHTML = list.map((method) => {
      const key = payKey(method, cc);
      return `<label class="pay-opt"><input type="radio" name="pay" value="${esc(method)}"${method === pick ? ' checked' : ''}>`
        + `<span class="pay-opt__box"><strong>${esc(t(`pay.method.${key}`))}</strong><small>${esc(t(`pay.hint.${key}`))}</small></span></label>`;
    }).join('');
  }

  function fillAmount(watch) {
    $('payAmount').textContent = fmtPrice(watch.priceNgn);
    const local = localPrice(watch.priceNgn, code());
    $('payLocal').hidden = !local;
    $('payLocal').textContent = local ? t('pay.local', { amount: local }) : '';
  }

  const fillCityHint = () => { $('buyerLocation').placeholder = t(`form.cityPh.${code()}`); };

  let current = null;

  country.addEventListener('change', () => {
    fillDelivery(delivery.value);
    fillPay(selectedPay());
    fillCityHint();
    if (current) fillAmount(current);
  });

  return {
    // Called each time a watch is opened. `saved` holds the buyer's last choices on this device.
    prepare(watch, saved = {}) {
      current = watch;
      country.value = COUNTRIES.includes(saved.country) ? saved.country : guessCountry();
      fillDelivery(saved.delivery);
      fillPay(saved.pay);
      fillCityHint();
      fillAmount(watch);
      $('payBlock').hidden = watch.status === 'sold';
    },

    read(watch) {
      const cc = code();
      const pay = $('payBlock').hidden ? '' : selectedPay();
      return {
        country: cc,
        countryLabel: t(`market.${cc}`),
        delivery: delivery.value,
        deliveryLabel: t(`delivery.${delivery.value}`),
        pay,
        payLabel: pay ? t(`pay.method.${payKey(pay, cc)}`) : '',
        localAmount: localPrice(watch.priceNgn, cc),
      };
    },

    // Shows the four order steps under the sent message (not for sold watches, which are only enquiries).
    showSteps(order) {
      $('orderSteps').hidden = !order.pay;
      $('stepPay').textContent = order.pay ? t('order.s3t', { method: order.payLabel }) : '';
      $('stepShip').textContent = t('order.s4t', { place: order.countryLabel });
    },
  };
}
