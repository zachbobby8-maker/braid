// Admin photo tools: upload, paste a link, generate with AI (one watch or all missing), or go back to the illustration.
// main.js owns the catalogue; this module only asks it to save a new image address.

import { $, t, toast, labelAsButton } from './dom.js';
import { copyText } from './merchant.js';
import { generatePhoto, uploadPhoto, checkImageLink } from './ai-photos.js';

const PHOTO_COST = 10; // approximate credits per AI photo

export function initAdminPhotos({ state, findWatch, allWatches, patchWatch, setImages, render, refreshActive, onAuthLost }) {
  const missingPhotos = () => allWatches().filter((w) => !w.image);

  async function setImage(id, url) {
    await patchWatch(id, { image: url });
    render();
    refreshActive();
  }

  async function runPhotoTask(task) {
    const id = state.active;
    if (!id || state.busy) return;
    state.busy = true;
    $('aiPhotoBtn').disabled = true;
    $('clearPhotoBtn').disabled = true;
    refreshActive();
    $('toolStatus').textContent = t('tools.working');
    try {
      const url = await task(findWatch(id));
      await setImage(id, url);
      $('toolStatus').textContent = t('tools.done');
    } catch (err) {
      if (err && err.code === 'AUTH') onAuthLost();
      $('toolStatus').textContent = t('tools.error');
    } finally {
      state.busy = false;
      $('aiPhotoBtn').disabled = false;
      $('clearPhotoBtn').disabled = false;
      refreshActive();
    }
  }

  async function onLinkSubmit(e) {
    e.preventDefault();
    const id = state.active;
    const input = $('photoLink');
    const raw = input.value.trim();
    if (!id) return;
    if (!raw) { $('toolStatus').textContent = t('tools.linkEmpty'); input.focus(); return; }
    $('linkBtn').disabled = true;
    $('toolStatus').textContent = t('tools.linkChecking');
    try {
      const url = await checkImageLink(raw);
      await setImage(id, url);
      input.value = '';
      $('toolStatus').textContent = t('tools.linkDone');
    } catch {
      $('toolStatus').textContent = t('tools.linkBad');
    } finally {
      $('linkBtn').disabled = false;
    }
  }

  function syncBulkLabel() {
    const n = missingPhotos().length;
    $('genAllBtn').disabled = state.busy && !state.bulk;
    $('genAllLabel').textContent = state.bulk
      ? t('admin.genStop')
      : t(n ? 'admin.genAll' : 'admin.genAllNone', { n: n * PHOTO_COST });
  }

  async function generateAll() {
    if (state.bulk) { state.stopBulk = true; return; }
    if (state.busy) return;
    const queue = missingPhotos();
    if (!queue.length) { toast(t('admin.genAllNone')); return; }
    state.bulk = true;
    state.busy = true;
    state.stopBulk = false;
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < queue.length && !state.stopBulk; i += 1) {
      $('genAllStatus').textContent = t('admin.genProgress', { done: i + 1, total: queue.length });
      syncBulkLabel();
      try {
        const url = await generatePhoto(queue[i]);
        await patchWatch(queue[i].id, { image: url });
        ok += 1;
        render();
        refreshActive();
      } catch {
        fail += 1;
      }
    }
    state.bulk = false;
    state.busy = false;
    state.stopBulk = false;
    $('genAllStatus').textContent = t('admin.genDone', { ok, fail });
    render();
    refreshActive();
  }

  /* ---------- carry photos made in the preview over to the live site, as a list of links ---------- */
  const linkBox = $('linksBox');
  const isLink = (v) => typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 800;

  function openLinks(prefill) {
    linkBox.hidden = false;
    $('linksText').value = prefill;
    $('linksText').focus();
    if (prefill) $('linksText').select();
  }

  async function copyLinks() {
    const map = {};
    state.watches.forEach((w) => { if (isLink(w.image)) map[w.id] = w.image; });
    if (!Object.keys(map).length) { toast(t('admin.linksNone')); return; }
    const json = JSON.stringify(map);
    if (await copyText(json)) toast(t('admin.linksCopied'));
    else openLinks(json);
  }

  async function applyLinks() {
    let map = null;
    try { map = JSON.parse($('linksText').value.trim()); } catch { /* handled below */ }
    const clean = {};
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      Object.keys(map).forEach((id) => { if (isLink(map[id])) clean[id] = map[id]; });
    }
    if (!Object.keys(clean).length) { toast(t('admin.linksBad')); return; }
    $('linksApply').disabled = true;
    try {
      const n = await setImages(clean);
      if (n) { linkBox.hidden = true; toast(t('admin.linksApplied', { n })); } else toast(t('admin.linksNoMatch'));
    } finally {
      $('linksApply').disabled = false;
    }
  }

  $('copyLinksBtn').addEventListener('click', copyLinks);
  $('pasteLinksBtn').addEventListener('click', () => openLinks(''));
  $('linksApply').addEventListener('click', applyLinks);
  $('linksCancel').addEventListener('click', () => { linkBox.hidden = true; });

  $('linkForm').addEventListener('submit', onLinkSubmit);
  $('aiPhotoBtn').addEventListener('click', () => runPhotoTask((w) => generatePhoto(w)));
  labelAsButton($('uploadLabel'), $('photoFile'));
  $('photoFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) runPhotoTask(() => uploadPhoto(file));
  });
  $('copyImgBtn').addEventListener('click', async () => {
    const w = state.active && findWatch(state.active);
    if (!w || !w.image) { toast(t('tools.noImage')); return; }
    toast(t((await copyText(w.image)) ? 'toast.urlCopied' : 'toast.copyFailed'));
  });
  $('clearPhotoBtn').addEventListener('click', () => {
    if (state.active) setImage(state.active, '');
  });
  $('genAllBtn').addEventListener('click', generateAll);

  return { syncBulkLabel };
}
