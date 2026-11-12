// Start-up safety: one slow or broken part must never keep the whole vault from opening.

// Resolves with `fallback` if the work fails or takes longer than `ms`.
export function withTimeout(work, ms, fallback) {
  let timer = 0;
  const limit = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  return Promise.race([Promise.resolve(work).catch(() => fallback), limit]).finally(() => clearTimeout(timer));
}

// Stand-in for a feature that failed to start: every method exists and does nothing.
const IDLE = new Proxy({}, { get: (_target, prop) => (prop === 'then' ? undefined : () => undefined) });

export function safeInit(name, init) {
  try {
    return init();
  } catch (err) {
    console.error(`[braid] ${name} could not start`, err);
    return IDLE;
  }
}

// addEventListener by element id that skips a missing element instead of stopping everything after it.
export function on(id, type, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(type, handler);
  else console.error(`[braid] missing element #${id}`);
}

export const markReady = () => window.braidBoot?.ok?.();
export const markFailed = (detail) => window.braidBoot?.fail?.(detail);
