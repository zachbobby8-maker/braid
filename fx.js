// Decorative motion only. Nothing here changes data or text, so if it fails the app still works.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const seen = new Set();
const byId = (id) => document.getElementById(id);

// The big hero watch shows the visitor's real time, with a smooth sweeping second hand.
function startHeroClock() {
  const hour = byId('hwHour');
  const min = byId('hwMin');
  const sec = byId('hwSec');
  const date = byId('hwDate');
  const stage = document.querySelector('.hero__visual');
  if (!hour || !min || !sec || !date || !stage) return;

  let lastDay = -1;
  let visible = true;
  let raf = 0;
  const turn = (el, deg) => el.setAttribute('transform', `rotate(${deg.toFixed(2)} 200 200)`);

  function paint() {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    turn(hour, h * 30);
    turn(min, m * 6);
    turn(sec, (reduceMotion ? Math.floor(s) : s) * 6);
    if (now.getDate() !== lastDay) {
      lastDay = now.getDate();
      date.textContent = String(lastDay);
    }
  }

  paint();
  if (reduceMotion) { setInterval(paint, 1000); return; }

  const frame = () => {
    paint();
    raf = visible ? requestAnimationFrame(frame) : 0;
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(stage);
  }
  raf = requestAnimationFrame(frame);
}

// A soft gold light follows the mouse, and the hero watch drifts a little with it.
function startPointerFx() {
  if (!finePointer) return;
  const ambient = document.querySelector('.ambient');
  const hero = document.querySelector('.hero');
  let queued = false;
  let x = 0;
  let y = 0;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !ambient) return;
    x = e.clientX;
    y = e.clientY;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ambient.style.setProperty('--gx', `${x}px`);
      ambient.style.setProperty('--gy', `${y}px`);
      ambient.classList.add('is-on');
    });
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => ambient && ambient.classList.remove('is-on'));

  if (!hero) return;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    hero.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--px', '0');
    hero.style.setProperty('--py', '0');
  });
}

// Cards lean toward the mouse and carry a spotlight. The grid is rebuilt often, so events are delegated.
function startCardFx(grid) {
  if (finePointer && !reduceMotion) {
    grid.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      card.style.setProperty('--mx', `${px.toFixed(0)}px`);
      card.style.setProperty('--my', `${py.toFixed(0)}px`);
      card.style.setProperty('--ry', `${((px / r.width - 0.5) * 9).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - py / r.height) * 7).toFixed(2)}deg`);
    });
    grid.addEventListener('pointerout', (e) => {
      const card = e.target.closest && e.target.closest('.card');
      if (!card || card.contains(e.relatedTarget)) return;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  // New cards fade up the first time they scroll into view. Cards seen before appear instantly.
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      el.style.setProperty('--d', `${Math.min(n, 8) * 70}ms`);
      n += 1;
      el.classList.remove('fx-wait');
      el.classList.add('fx-rise');
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });

  const decorate = () => {
    grid.querySelectorAll('.card').forEach((card) => {
      const id = card.dataset.id || '';
      if (seen.has(id)) return;
      seen.add(id);
      card.classList.add('fx-wait');
      io.observe(card);
    });
  };
  new MutationObserver(decorate).observe(grid, { childList: true });
  decorate();
}

// Thin gold line at the top of the page showing how far down you are.
function startProgress() {
  const bar = document.querySelector('.progress');
  if (!bar) return;
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');
  };
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}

// The brand ticker is written once in the page; copy it so the loop never shows a gap.
function startTicker() {
  const track = byId('tickerTrack');
  if (!track || track.dataset.ready) return;
  Array.from(track.children).forEach((li) => track.appendChild(li.cloneNode(true)));
  track.dataset.ready = '1';
}

export function initFx() {
  try {
    const grid = byId('grid');
    startHeroClock();
    startPointerFx();
    startProgress();
    startTicker();
    if (grid) startCardFx(grid);
  } catch { /* effects are optional */ }
}
