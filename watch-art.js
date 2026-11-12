// Vector watch illustrations used until a real photo is added to a listing.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function isDark(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return false;
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 90;
}

function strapMarkup(v) {
  if (v.strapType === 'leather') {
    return `
      <rect x="74" y="4" width="52" height="36" rx="4" fill="${v.strapColor}" stroke="#27272A"/>
      <rect x="74" y="160" width="52" height="36" rx="4" fill="${v.strapColor}" stroke="#27272A"/>
      <g stroke="rgba(255,255,255,0.2)" stroke-dasharray="2 2">
        <line x1="79" y1="8" x2="79" y2="36"/><line x1="121" y1="8" x2="121" y2="36"/>
        <line x1="79" y1="164" x2="79" y2="192"/><line x1="121" y1="164" x2="121" y2="192"/>
      </g>`;
  }
  const jubilee = v.strapType === 'jubilee';
  const cols = jubilee ? [86, 95, 105, 114] : [88, 112];
  const rows = jubilee ? [17, 28, 172, 183] : [18, 29, 171, 182];
  return `
    <g fill="${v.strapColor}" stroke="#3F3F46" stroke-width="0.9">
      <rect x="72" y="6" width="56" height="34" rx="3"/>
      <rect x="72" y="160" width="56" height="34" rx="3"/>
      ${cols.map((x) => `<line x1="${x}" y1="6" x2="${x}" y2="40"/><line x1="${x}" y1="160" x2="${x}" y2="194"/>`).join('')}
      ${rows.map((y) => `<line x1="72" y1="${y}" x2="128" y2="${y}"/>`).join('')}
    </g>`;
}

function tankMarkup(watch, v) {
  return `
    ${strapMarkup(v)}
    <rect x="58" y="34" width="84" height="132" rx="8" fill="${v.caseColor}" stroke="#785C12" stroke-width="1.5"/>
    <rect x="64" y="42" width="72" height="116" rx="4" fill="#B69121"/>
    <rect x="142" y="92" width="6" height="16" rx="2" fill="#D4AF37"/>
    <circle cx="149" cy="100" r="4.5" fill="#1D4ED8" stroke="#D4AF37"/>
    <rect x="69" y="48" width="62" height="104" rx="2" fill="${v.dialColor}"/>
    <rect x="78" y="60" width="44" height="80" fill="none" stroke="#18181B" stroke-width="0.9" stroke-dasharray="1.5 1.5"/>
    <g font-family="serif" font-weight="bold" fill="#18181B" text-anchor="middle">
      <text x="100" y="57" font-size="8">XII</text><text x="100" y="149" font-size="8">VI</text>
      <text x="74" y="103" font-size="7">IX</text><text x="126" y="103" font-size="7">III</text>
      <text x="100" y="78" font-size="6" letter-spacing="1">${esc(watch.brand.toUpperCase())}</text>
    </g>
    <line x1="100" y1="100" x2="84" y2="82" stroke="#1E3A8A" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="120" y2="74" stroke="#1E3A8A" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="2.2" fill="#D4AF37"/>
    <path d="M70 50H112L70 104Z" fill="#FFFFFF" fill-opacity="0.12"/>`;
}

function bezelMarkup(v) {
  switch (v.bezelType) {
    case 'fluted':
      return `<circle cx="100" cy="100" r="65" fill="#E4E4E7" stroke="#71717A" stroke-width="1.5"/>
        <circle cx="100" cy="100" r="61" fill="none" stroke="#52525B" stroke-width="4" stroke-dasharray="2.2 2.2"/>`;
    case 'pepsi':
      return `<circle cx="100" cy="100" r="64" fill="#1E3A8A" stroke="#3F3F46" stroke-width="1.5"/>
        <path d="M100 36A64 64 0 0 1 164 100L100 100Z" fill="#B91C1C"/>
        <circle cx="100" cy="100" r="56" fill="${v.dialColor}"/>`;
    case 'diver-black':
      return `<circle cx="100" cy="100" r="65" fill="#18181B" stroke="#52525B" stroke-width="2"/>
        <circle cx="100" cy="100" r="60" fill="none" stroke="#A1A1AA" stroke-width="1.2" stroke-dasharray="1.5 4.8"/>
        <polygon points="100,37 96,44 104,44" fill="#D4AF37"/>`;
    case 'tacho':
      return `<circle cx="100" cy="100" r="65" fill="#18181B" stroke="#52525B" stroke-width="2"/>
        <circle cx="100" cy="100" r="60" fill="none" stroke="#A1A1AA" stroke-width="1.6" stroke-dasharray="1 3.2"/>`;
    case 'smooth-gold':
      return '<circle cx="100" cy="100" r="64" fill="#D4AF37" stroke="#856816" stroke-width="1.5"/>';
    default:
      return `<circle cx="100" cy="100" r="64" fill="${v.caseColor}" stroke="#52525B" stroke-width="1.5"/>`;
  }
}

function dialMarkup(v) {
  const c = v.indexColor;
  switch (v.dialPattern) {
    case 'explorer':
      return `<polygon points="100,52 96,60 104,60" fill="${c}"/>
        <g font-family="sans-serif" font-size="11" font-weight="bold" fill="${c}" text-anchor="middle">
          <text x="136" y="104">3</text><text x="100" y="142">6</text><text x="64" y="104">9</text></g>`;
    case 'diver':
      return `<polygon points="100,52 95,61 105,61" fill="${c}"/>
        ${[[123, 60], [140, 77], [140, 123], [123, 140], [100, 145], [77, 140], [60, 123], [60, 77], [77, 60]]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8" fill="${c}"/>`).join('')}`;
    case 'crosshair':
      return `<g stroke="rgba(212,175,55,0.45)" stroke-width="0.8"><line x1="100" y1="46" x2="100" y2="154"/><line x1="46" y1="100" x2="154" y2="100"/></g>
        <circle cx="100" cy="100" r="38" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="0.7"/>`;
    case 'chrono-single':
      return `<circle cx="100" cy="126" r="14" fill="#18181B" stroke="#3F3F46"/>
        <line x1="100" y1="126" x2="106" y2="117" stroke="#EF4444" stroke-width="1.2"/>`;
    case 'chrono-tri':
      return [[72, 100], [128, 100], [100, 128]].map(([x, y]) => `
        <circle cx="${x}" cy="${y}" r="11" fill="#18181B" stroke="#3F3F46"/>
        <line x1="${x}" y1="${y}" x2="${x + 4}" y2="${y - 7}" stroke="#E4E4E7" stroke-width="1"/>`).join('');
    case 'linen':
      return `<circle cx="100" cy="100" r="53" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="0.6" stroke-dasharray="1 1"/>
        <circle cx="100" cy="100" r="42" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="0.6" stroke-dasharray="1 1"/>`;
    default:
      return '';
  }
}

function markersMarkup(v) {
  if (v.dialPattern === 'diver') return '';
  const explorer = v.dialPattern === 'explorer';
  const tri = v.dialPattern === 'chrono-tri';
  return `<g stroke="${v.indexColor}" stroke-width="2" stroke-linecap="round">
    ${explorer ? '' : '<line x1="100" y1="50" x2="100" y2="58"/><line x1="100" y1="150" x2="100" y2="142"/>'}
    <line x1="125" y1="57" x2="121" y2="63"/><line x1="143" y1="75" x2="137" y2="79"/>
    <line x1="143" y1="125" x2="137" y2="121"/><line x1="125" y1="143" x2="121" y2="137"/>
    <line x1="75" y1="143" x2="79" y2="137"/><line x1="57" y1="125" x2="63" y2="121"/>
    <line x1="57" y1="75" x2="63" y2="79"/><line x1="75" y1="57" x2="79" y2="63"/>
    ${explorer || tri ? '' : '<line x1="50" y1="100" x2="58" y2="100"/>'}
    ${explorer || tri || v.hasCyclops ? '' : '<line x1="150" y1="100" x2="142" y2="100"/>'}
  </g>`;
}

export function watchSVG(watch) {
  const v = watch.visual || {};
  const body = v.shape === 'tank' ? tankMarkup(watch, v) : roundMarkup(watch, v);
  return `<svg viewBox="0 0 200 200" class="watch-art" aria-hidden="true" focusable="false">${body}</svg>`;
}

function roundMarkup(watch, v) {
  const ink = isDark(v.dialColor) ? '#E4E4E7' : '#27272A';
  const chrono = String(v.dialPattern || '').startsWith('chrono');
  const cushion = v.shape === 'cushion'
    ? `<rect x="34" y="30" width="132" height="140" rx="38" fill="${v.caseColor}" stroke="#52525B" stroke-width="1.5"/>` : '';
  const cyclops = v.hasCyclops
    ? `<rect x="133" y="94" width="13" height="12" rx="2.5" fill="#FAFAFA" stroke="#71717A"/>
       <text x="139.5" y="103" text-anchor="middle" font-family="monospace" font-size="8" font-weight="bold" fill="#18181B">12</text>` : '';
  const caliberText = chrono ? '' : `<text x="100" y="130" text-anchor="middle" font-family="monospace" font-size="4.6" letter-spacing="0.6" fill="${ink}" opacity="0.75">${esc(String(watch.caliber).toUpperCase().slice(0, 22))}</text>`;
  return `
    ${strapMarkup(v)}
    ${cushion}
    <path d="M68 42L74 32H126L132 42Z" fill="${v.caseColor}"/>
    <path d="M68 158L74 168H126L132 158Z" fill="${v.caseColor}"/>
    <rect x="163" y="92" width="7" height="16" rx="2" fill="${v.caseColor}" stroke="#52525B"/>
    ${bezelMarkup(v)}
    <circle cx="100" cy="100" r="55" fill="${v.dialColor}" stroke="#3F3F46"/>
    ${dialMarkup(v)}
    ${markersMarkup(v)}
    ${cyclops}
    <text x="100" y="76" text-anchor="middle" font-family="sans-serif" font-size="6.2" font-weight="bold" letter-spacing="1.2" fill="${ink}">${esc(watch.brand.toUpperCase())}</text>
    ${caliberText}
    <line x1="100" y1="100" x2="81" y2="83" stroke="${v.indexColor}" stroke-width="3.2" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="124" y2="72" stroke="${v.indexColor}" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="100" y1="108" x2="100" y2="52" stroke="#D4AF37" stroke-width="1" stroke-linecap="round" class="second-hand-sweep"/>
    <circle cx="100" cy="100" r="3" fill="#D4AF37" stroke="#18181B" stroke-width="0.8"/>
    <path d="M56 84C62 62 82 48 106 46C86 56 68 68 56 84Z" fill="#FFFFFF" fill-opacity="0.14"/>
    <path d="M45 100A55 55 0 0 1 100 45" fill="none" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="1.1" stroke-linecap="round"/>`;
}
