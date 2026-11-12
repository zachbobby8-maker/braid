// "Watch drawing" designer for the Add / Edit form: starting styles, case shape, dial,
// bezel, strap and colours, with a live preview. The result is the same `visual` object
// the sample watches use, so a new listing can look just as detailed.

import { $, t } from './dom.js';
import { watchSVG } from './watch-art.js';
import { DEFAULT_VISUAL } from './backend.js';

export const PRESETS = {
  dress: { shape: 'round', dialColor: '#f1ebdc', dialPattern: 'sunburst', bezelType: 'smooth-gold', caseColor: '#d4af37', strapType: 'leather', strapColor: '#2a1810', indexColor: '#7c5c12', hasCyclops: false },
  steel: { shape: 'round', dialColor: '#f4f4f5', dialPattern: 'sunburst', bezelType: 'smooth-steel', caseColor: '#e4e4e7', strapType: 'leather', strapColor: '#18181b', indexColor: '#27272a', hasCyclops: false },
  diver: { shape: 'round', dialColor: '#18181b', dialPattern: 'diver', bezelType: 'diver-black', caseColor: '#d4d4d8', strapType: 'oyster', strapColor: '#a1a1aa', indexColor: '#fde68a', hasCyclops: true },
  racing: { shape: 'round', dialColor: '#2a2a30', dialPattern: 'chrono-tri', bezelType: 'tacho', caseColor: '#d4d4d8', strapType: 'leather', strapColor: '#1c1917', indexColor: '#e4e4e7', hasCyclops: false },
  tank: { shape: 'tank', dialColor: '#f5f0e1', dialPattern: 'roman', bezelType: 'gold-tank', caseColor: '#d4af37', strapType: 'leather', strapColor: '#3b1e14', indexColor: '#18181b', hasCyclops: false },
  field: { shape: 'round', dialColor: '#121215', dialPattern: 'explorer', bezelType: 'smooth-steel', caseColor: '#e4e4e7', strapType: 'oyster', strapColor: '#a1a1aa', indexColor: '#fcd34d', hasCyclops: false },
};

const SELECTS = [['shape', 'lookShape'], ['dialPattern', 'lookPattern'], ['bezelType', 'lookBezel'], ['strapType', 'lookStrap']];
const COLORS = [['dialColor', 'lookDial'], ['caseColor', 'lookCase'], ['strapColor', 'lookStrapColor'], ['indexColor', 'lookMarks']];

function hex6(value, fallback) {
  const s = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
  return fallback;
}

export function initLook() {
  let current = { ...DEFAULT_VISUAL };
  let presetsDrawn = false;

  function drawPresets() {
    if (presetsDrawn) return;
    presetsDrawn = true;
    const box = $('lookPresets');
    Object.keys(PRESETS).forEach((key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'look__preset';
      b.dataset.preset = key;
      b.textContent = t(`look.preset.${key}`);
      box.appendChild(b);
    });
  }

  function toControls() {
    SELECTS.forEach(([key, id]) => {
      const el = $(id);
      el.value = current[key];
      if (el.value !== current[key]) el.selectedIndex = 0;
    });
    COLORS.forEach(([key, id]) => { $(id).value = hex6(current[key], hex6(DEFAULT_VISUAL[key], '#000000')); });
    $('lookCyclops').checked = Boolean(current.hasCyclops);
  }

  function fromControls() {
    current.shape = $('lookShape').value || 'round';
    const tank = current.shape === 'tank';
    SELECTS.forEach(([key, id]) => {
      if (key === 'shape' || (tank && (key === 'dialPattern' || key === 'bezelType'))) return;
      current[key] = $(id).value;
    });
    COLORS.forEach(([key, id]) => { current[key] = $(id).value; });
    current.hasCyclops = $('lookCyclops').checked;
  }

  function paint() {
    const tank = current.shape === 'tank';
    $('lookPatternField').hidden = tank;
    $('lookBezelField').hidden = tank;
    $('lookMarksField').hidden = tank;
    $('lookCyclopsField').hidden = tank;
    const brand = $('editBrand').value.trim() || t('look.brandFallback');
    $('lookPreview').innerHTML = watchSVG({ brand, visual: current });
  }

  function set(visual) {
    drawPresets();
    current = { ...DEFAULT_VISUAL, ...(visual && typeof visual === 'object' ? visual : {}) };
    toControls();
    paint();
  }

  const onControl = () => { fromControls(); paint(); };
  $('lookSet').addEventListener('input', onControl);
  $('lookSet').addEventListener('change', onControl);
  $('lookPresets').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (btn && PRESETS[btn.dataset.preset]) set(PRESETS[btn.dataset.preset]);
  });
  $('editBrand').addEventListener('input', paint);

  return { set, get: () => ({ ...current }) };
}
