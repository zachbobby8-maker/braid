// ─────────────────────────────────────────────────────────────
// BRAID WATCHES — inventory
//
// SAMPLE WATCHES. They only show until you add your own: tap "Staff login",
// then "Add a watch", and use "Remove all sample watches" when you are ready.
// Your real watches live in the database, not in this file.
// The old dollar prices below are converted to Naira automatically (see config.js).
//
//  image      → paste a photo URL (or a file path such as "images/bw-01.jpg").
//               Leave "" to show the built-in illustration.
//  status     → "available" | "hold" | "sold"
//  tier       → "daily" | "collector" | "vault" | "neo" | "other"
//  kind       → "normal" | "classic" | "vintage" (optional, guessed from the year)
//  listedAt   → ISO time with the Lagos offset (+01:00)
//  conditions → any of: "box", "unpolished", "serviced", "originalDial"
//  featured   → true makes the card wider in the grid
//  visual     → only used for the illustration when there is no photo
//
// These listings are sample data: replace with your real pieces.
// ─────────────────────────────────────────────────────────────

export const WATCHES = [
  {
    id: 'bw-01', brand: 'Rolex', model: "Datejust 16014 'Linen Dial'", year: 1984, ref: '16014',
    movement: 'Automatic', caliber: 'Cal. 3035', priceUsd: 7400, status: 'available',
    listedAt: '2026-11-12T09:15:00+01:00', tier: 'vault', featured: true, image: '',
    caseSize: '36mm steel · 18k white gold bezel', rate: '+1 s/d · 294°',
    conditions: ['unpolished', 'serviced', 'originalDial'],
    highlights: ['Fluted white-gold bezel', 'Jubilee 62510H bracelet', 'Open 6/9 date wheel'],
    notes: 'A crisp fluted bezel over a finely textured silver linen dial. The quickset Cal. 3035 is running at chronometer spec after its 2026 service.',
    visual: { shape: 'round', dialColor: '#D8D5CC', dialPattern: 'linen', bezelType: 'fluted', caseColor: '#D4D4D8', strapType: 'jubilee', strapColor: '#A1A1AA', indexColor: '#27272A', hasCyclops: true },
  },
  {
    id: 'bw-02', brand: 'Cartier', model: 'Must de Cartier Tank Vermeil', year: 1988, ref: '590005',
    movement: 'Quartz', caliber: 'Quartz · fresh cell', priceUsd: 1450, status: 'available',
    listedAt: '2026-11-12T08:42:00+01:00', tier: 'daily', image: '',
    caseSize: '23.5 × 30.5mm vermeil', rate: 'Regulated · +0.2 s/d',
    conditions: ['box', 'originalDial'],
    highlights: ['Gold-plated sterling silver', 'Sapphire cabochon crown', 'Roman numeral dial'],
    notes: 'The Neo-Classical Tank in 925 silver with 20 microns of 18k yellow gold. Cream Roman dial with blued steel sword hands, on its original buckle.',
    visual: { shape: 'tank', dialColor: '#F5F0E1', dialPattern: 'roman', bezelType: 'gold-tank', caseColor: '#D4AF37', strapType: 'leather', strapColor: '#3B1E14', indexColor: '#18181B', hasCyclops: false },
  },
  {
    id: 'bw-03', brand: 'Universal Genève', model: 'Polerouter Jet', year: 1961, ref: '20355-2',
    movement: 'Micro-rotor automatic', caliber: 'Cal. 215', priceUsd: 3900, status: 'hold',
    listedAt: '2026-11-11T19:20:00+01:00', tier: 'collector', image: '',
    caseSize: '34.5mm stainless steel', rate: '+4 s/d · 276°',
    conditions: ['originalDial'],
    highlights: ['Gérald Genta design', 'Micro-rotor movement', 'Twisted lyre lugs'],
    notes: 'An early Genta design made for SAS polar flights. Signed crosshair dial and the patented micro-rotor Cal. 215, which keeps the case beautifully slim.',
    visual: { shape: 'round', dialColor: '#141417', dialPattern: 'crosshair', bezelType: 'smooth-steel', caseColor: '#E4E4E7', strapType: 'leather', strapColor: '#1C1917', indexColor: '#D4AF37', hasCyclops: false },
  },
  {
    id: 'bw-04', brand: 'Seiko', model: "'Pogue' 6139-6002 Chronograph", year: 1974, ref: '6139-6002',
    movement: 'Automatic chronograph', caliber: 'Cal. 6139B', priceUsd: 1150, status: 'available',
    listedAt: '2026-11-11T16:05:00+01:00', tier: 'daily', image: '',
    caseSize: '41mm cushion steel', rate: '+6 s/d · crisp reset',
    conditions: ['serviced', 'originalDial'],
    highlights: ['First automatic chrono in space', 'Pepsi bezel', 'Sunburst yellow dial'],
    notes: 'The golden sunburst dial that Col. William Pogue wore in orbit. Snaps cleanly back to zero, and the 6139B has been fully serviced.',
    visual: { shape: 'cushion', dialColor: '#EAB308', dialPattern: 'chrono-single', bezelType: 'pepsi', caseColor: '#D4D4D8', strapType: 'oyster', strapColor: '#A1A1AA', indexColor: '#18181B', hasCyclops: false },
  },
  {
    id: 'bw-05', brand: 'Omega', model: 'Seamaster Genève Sunburst', year: 1966, ref: '166.020',
    movement: 'Automatic', caliber: 'Cal. 562', priceUsd: 890, status: 'available',
    listedAt: '2026-11-11T11:30:00+01:00', tier: 'daily', image: '',
    caseSize: '34.5mm gold-capped', rate: '+3 s/d · 282°',
    conditions: ['unpolished', 'originalDial'],
    highlights: ['Gold-capped lugs', 'Hippocampus caseback', 'Signed crown'],
    notes: 'The classic gateway Omega: a monocoque case with a sunburst dial that shifts from champagne to silver. Cal. 562 is regulated and swan-neck adjusted.',
    visual: { shape: 'round', dialColor: '#EFECE6', dialPattern: 'sunburst', bezelType: 'smooth-gold', caseColor: '#D4AF37', strapType: 'leather', strapColor: '#4A2511', indexColor: '#B48A28', hasCyclops: false },
  },
  {
    id: 'bw-06', brand: 'Tudor', model: 'Prince Oysterdate Submariner', year: 1989, ref: '79090',
    movement: 'Automatic', caliber: 'Cal. 2824-2', priceUsd: 4900, status: 'sold',
    listedAt: '2026-11-10T21:10:00+01:00', tier: 'collector', image: '',
    caseSize: '40mm Oyster case', rate: '+2 s/d · pressure tested',
    conditions: ['box', 'originalDial'],
    highlights: ['Rolex-signed crown', 'Tritium dial', 'Folded Oyster bracelet'],
    notes: 'The 40mm Submariner silhouette on a Rolex-made Oyster case, with a creamy tritium dial and a softly faded bidirectional bezel. Sold. Ask for similar pieces.',
    visual: { shape: 'round', dialColor: '#18181B', dialPattern: 'diver', bezelType: 'diver-black', caseColor: '#D4D4D8', strapType: 'oyster', strapColor: '#A1A1AA', indexColor: '#FDE68A', hasCyclops: true },
  },
  {
    id: 'bw-07', brand: 'Rolex', model: "Explorer I 'Frog Foot'", year: 1972, ref: '1016',
    movement: 'Automatic', caliber: 'Cal. 1570', priceUsd: 12900, status: 'available',
    listedAt: '2026-11-10T14:48:00+01:00', tier: 'vault', image: '',
    caseSize: '36mm stainless steel', rate: '+1 s/d · 290°',
    conditions: ['box', 'unpolished', 'originalDial'],
    highlights: ['Frog-foot coronet dial', 'Even pumpkin patina', 'Sharp, unpolished lugs'],
    notes: 'A collector-grade 1016 with the sought-after matte 3-6-9 dial and a warm, even patina on the tritium. Full set with box and papers.',
    visual: { shape: 'round', dialColor: '#121215', dialPattern: 'explorer', bezelType: 'smooth-steel', caseColor: '#E4E4E7', strapType: 'oyster', strapColor: '#A1A1AA', indexColor: '#FCD34D', hasCyclops: false },
  },
  {
    id: 'bw-08', brand: 'King Seiko', model: '45KS Hi-Beat Chronometer', year: 1970, ref: '45-7001',
    movement: 'Manual wind', caliber: 'Cal. 4500A · 36,000 bph', priceUsd: 980, status: 'available',
    listedAt: '2026-11-10T10:12:00+01:00', tier: 'daily', image: '',
    caseSize: '36.5mm Grammar of Design', rate: '+2 s/d · 36,000 bph',
    conditions: ['serviced', 'originalDial'],
    highlights: ['Hi-beat 36,000 bph', 'Intact gold medallion', 'Razor case lines'],
    notes: 'Taro Tanaka’s Grammar of Design in mirror-polished flat planes, powered by the manual-wind hi-beat Cal. 4500A. Quietly one of Japan’s best vintage dress watches.',
    visual: { shape: 'round', dialColor: '#F4F4F5', dialPattern: 'sunburst', bezelType: 'smooth-steel', caseColor: '#E4E4E7', strapType: 'leather', strapColor: '#18181B', indexColor: '#27272A', hasCyclops: false },
  },
  {
    id: 'bw-09', brand: 'Omega', model: 'Speedmaster Reduced', year: 1991, ref: '3510.50',
    movement: 'Automatic chronograph', caliber: 'Cal. 1164', priceUsd: 3200, status: 'available',
    listedAt: '2026-11-09T17:25:00+01:00', tier: 'collector', image: '',
    caseSize: '39mm stainless steel', rate: '+3 s/d · 301°',
    conditions: ['box', 'serviced'],
    highlights: ['Black tachymeter bezel', 'Hesalite-style crystal', 'Box & papers'],
    notes: 'The Moonwatch look in an easy-wearing 39mm automatic. Clean dial, even lume and a freshly serviced Cal. 1164.',
    visual: { shape: 'round', dialColor: '#141417', dialPattern: 'chrono-single', bezelType: 'tacho', caseColor: '#E4E4E7', strapType: 'oyster', strapColor: '#A1A1AA', indexColor: '#F4F4F5', hasCyclops: false },
  },
  {
    id: 'bw-10', brand: 'Heuer', model: 'Autavia 2446 Chronograph', year: 1969, ref: '2446',
    movement: 'Automatic chronograph', caliber: 'Cal. 11 Chrono-Matic', priceUsd: 5200, status: 'available',
    listedAt: '2026-11-09T12:40:00+01:00', tier: 'collector', featured: true, image: '',
    caseSize: '40mm steel', rate: '+5 s/d · 268°',
    conditions: ['unpolished', 'originalDial'],
    highlights: ['Pre-TAG era signature', 'Three-register layout', 'Crown on the left'],
    notes: 'A motorsport chronograph from the Chrono-Matic era, with the crown on the left, a tri-register dial and strong lume. Pure 1969 racing heritage.',
    visual: { shape: 'round', dialColor: '#2A2A30', dialPattern: 'chrono-tri', bezelType: 'tacho', caseColor: '#D4D4D8', strapType: 'leather', strapColor: '#1C1917', indexColor: '#E4E4E7', hasCyclops: false },
  },
  {
    id: 'bw-11', brand: 'Patek Philippe', model: 'Calatrava 3796', year: 1982, ref: '3796',
    movement: 'Manual wind', caliber: 'Cal. 12-400', priceUsd: 9800, status: 'hold',
    listedAt: '2026-11-08T15:00:00+01:00', tier: 'vault', image: '',
    caseSize: '31mm 18k yellow gold', rate: '+2 s/d · 281°',
    conditions: ['box', 'unpolished', 'originalDial'],
    highlights: ['18k yellow gold', 'Ultra-thin 2.5mm movement', 'Extract from the Archives'],
    notes: 'The dress watch other dress watches are measured against. Slim gold case, hand-wound Cal. 12-400 and a pristine cream dial. An inquiry is active.',
    visual: { shape: 'round', dialColor: '#F1EBDC', dialPattern: 'sunburst', bezelType: 'smooth-gold', caseColor: '#D4AF37', strapType: 'leather', strapColor: '#2A1810', indexColor: '#7C5C12', hasCyclops: false },
  },
  {
    id: 'bw-12', brand: 'Longines', model: 'Flagship Automatic', year: 1967, ref: '8217-2',
    movement: 'Automatic', caliber: 'Cal. 340', priceUsd: 720, status: 'available',
    listedAt: '2026-11-08T09:35:00+01:00', tier: 'daily', image: '',
    caseSize: '35mm stainless steel', rate: '+6 s/d · 270°',
    conditions: ['serviced', 'originalDial'],
    highlights: ['Winged-hourglass dial', 'Applied baton markers', 'Fresh strap'],
    notes: 'Honest vintage Swiss craftsmanship at an entry price: a silver sunburst dial with applied markers and a smooth, serviced Cal. 340.',
    visual: { shape: 'round', dialColor: '#E9E5DA', dialPattern: 'sunburst', bezelType: 'smooth-steel', caseColor: '#D4D4D8', strapType: 'leather', strapColor: '#5B3A22', indexColor: '#27272A', hasCyclops: false },
  },
  {
    id: 'bw-13', brand: 'Ikepod', model: 'Hourglass by Marc Newson', year: 1999, ref: 'HG-01',
    movement: 'Automatic', caliber: 'ETA 2892-A2', priceUsd: 2400, status: 'available',
    listedAt: '2026-11-07T18:10:00+01:00', tier: 'neo', image: '',
    caseSize: '42mm brushed steel', rate: '+3 s/d · 284°',
    conditions: ['box', 'originalDial'],
    highlights: ['Marc Newson design', 'Sculptural case', 'Numbered edition'],
    notes: 'Industrial-design icon from the late 90s: a porthole-shaped case and a minimalist dial that nobody else in the room will be wearing.',
    visual: { shape: 'cushion', dialColor: '#E8E8EA', dialPattern: 'plain', bezelType: 'smooth-steel', caseColor: '#C9C9CE', strapType: 'leather', strapColor: '#18181B', indexColor: '#27272A', hasCyclops: false },
  },
  {
    id: 'bw-14', brand: 'Alain Silberstein', model: 'Krono Bauhaus', year: 1997, ref: 'KB-38',
    movement: 'Automatic chronograph', caliber: 'Valjoux 7750', priceUsd: 3600, status: 'available',
    listedAt: '2026-11-07T13:20:00+01:00', tier: 'neo', image: '',
    caseSize: '38mm steel', rate: '+4 s/d · 290°',
    conditions: ['box', 'serviced'],
    highlights: ['Bauhaus colour hands', 'Geometric case', 'Valjoux 7750'],
    notes: 'Playful, geometric and instantly recognisable. Primary-colour hands over a Bauhaus-inspired dial, running on the dependable Valjoux 7750.',
    visual: { shape: 'round', dialColor: '#F4F4F2', dialPattern: 'chrono-tri', bezelType: 'smooth-steel', caseColor: '#D4D4D8', strapType: 'leather', strapColor: '#1D4ED8', indexColor: '#DC2626', hasCyclops: false },
  },
];

