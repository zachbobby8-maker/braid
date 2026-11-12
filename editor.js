// Admin watch editor: one form to add a new listing or change / delete an existing one.
// The caller decides where the result is saved (live database or this device).

import { $, t, createOverlay, labelAsButton } from './dom.js';
import { DEFAULT_VISUAL, kindForYear } from './backend.js';
import { initLook } from './editor-look.js';
import { uploadPhoto, checkImageLink } from './ai-photos.js';

const CONDITIONS = ['box', 'unpolished', 'serviced', 'originalDial'];
const TEXT_FIELDS = {
  brand: 'editBrand', model: 'editModel', ref: 'editRef', movement: 'editMovement',
  caliber: 'editCaliber', caseSize: 'editCase', rate: 'editRate',
};

const digits = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;
const fmtInput = (n) => (n ? n.toLocaleString('en-NG') : '');
const pad = (n) => String(n).padStart(2, '0');

// Availability is a group of three radio tiles (Available / On hold / Sold).
const STATUS_RADIOS = '#editForm input[name="editStatus"]';
const setStatus = (value) => document.querySelectorAll(STATUS_RADIOS).forEach((r) => { r.checked = r.value === value; });
const readStatus = () => document.querySelector(`${STATUS_RADIOS}:checked`)?.value || 'available';

// ISO time -> value for <input type="datetime-local"> in the admin's own time zone.
function toLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initEditor({ onSave, onDelete, onClose, onAuthLost }) {
  let editing = null;
  let confirming = false;
  let confirmTimer = 0;
  let busy = false;
  let photo = '';
  let photoBusy = false;
  let kindTouched = false;
  let listedStart = '';
  const look = initLook();

  const overlay = createOverlay($('editBackdrop'), $('editModal'), { onClose: () => { resetConfirm(); if (onClose) onClose(); } });

  function setDeleteLabel() {
    $('editDeleteLabel').textContent = t(confirming ? 'editor.deleteSure' : 'editor.delete');
  }

  function resetConfirm() {
    confirming = false;
    clearTimeout(confirmTimer);
    setDeleteLabel();
  }

  function showPhoto(url) {
    photo = url || '';
    const img = $('editPhotoImg');
    if (photo) {
      img.alt = t('editor.photoPreviewAlt');
      img.src = photo;
    } else {
      img.removeAttribute('src');
    }
    img.hidden = !photo;
    $('editPhotoEmpty').hidden = Boolean(photo);
    $('editPhotoRemove').hidden = !photo;
  }

  async function runPhoto(task, errorKey) {
    if (photoBusy) return;
    photoBusy = true;
    $('editSave').disabled = true;
    $('editPhotoStatus').textContent = t('editor.photoWorking');
    try {
      showPhoto(await task());
      $('editPhotoStatus').textContent = t('editor.photoReady');
    } catch (err) {
      if (err && err.code === 'AUTH' && onAuthLost) onAuthLost();
      $('editPhotoStatus').textContent = t(errorKey);
    } finally {
      photoBusy = false;
      $('editSave').disabled = false;
    }
  }

  function useLink() {
    const raw = $('editPhotoLink').value.trim();
    if (!raw) {
      $('editPhotoStatus').textContent = t('tools.linkEmpty');
      $('editPhotoLink').focus();
      return;
    }
    runPhoto(async () => {
      const url = await checkImageLink(raw);
      $('editPhotoLink').value = '';
      return url;
    }, 'tools.linkBad');
  }

  function fill(w) {
    $('editTitle').textContent = t(editing ? 'editor.titleEdit' : 'editor.titleNew');
    Object.entries(TEXT_FIELDS).forEach(([key, id]) => { $(id).value = w[key] || ''; });
    $('editYear').value = w.year || '';
    $('editPrice').value = fmtInput(w.priceNgn);
    setStatus(w.status || 'available');
    $('editTier').value = w.tier || 'collector';
    kindTouched = Boolean(editing && editing.kind);
    $('editKind').value = w.kind || kindForYear(w.year);
    listedStart = toLocalInput(w.listedAt || new Date());
    $('editListed').value = listedStart;
    look.set(w.visual || DEFAULT_VISUAL);
    $('editHighlights').value = (w.highlights || []).join('\n');
    $('editNotes').value = w.notes || '';
    $('editFeatured').checked = Boolean(w.featured);
    showPhoto(w.image);
    $('editPhotoLink').value = '';
    $('editPhotoStatus').textContent = '';
    document.querySelectorAll('#editForm input[name="cond"]').forEach((box) => {
      box.checked = (w.conditions || []).includes(box.value);
    });
    $('editError').textContent = '';
    $('editDelete').hidden = !editing;
    resetConfirm();
  }

  function openNew() {
    editing = null;
    fill({ year: new Date().getFullYear(), movement: 'Automatic', status: 'available', tier: 'collector' });
    overlay.open($('editBrand'));
  }

  function openEdit(watch) {
    editing = watch;
    fill(watch);
    overlay.open($('editBrand'));
  }

  function fail(key, focusId) {
    $('editError').textContent = t(key);
    $(focusId).focus();
  }

  async function submit(e) {
    e.preventDefault();
    if (busy || photoBusy) return;
    const brand = $('editBrand').value.trim();
    const model = $('editModel').value.trim();
    const price = digits($('editPrice').value);
    const year = digits($('editYear').value);
    if (!brand) return fail('editor.errBrand', 'editBrand');
    if (!model) return fail('editor.errModel', 'editModel');
    if (year < 1800 || year > 2100) return fail('editor.errYear', 'editYear');
    if (!price) return fail('editor.errPrice', 'editPrice');

    let listedAt = editing ? editing.listedAt : new Date().toISOString();
    const listedVal = $('editListed').value;
    if (listedVal && listedVal !== listedStart) {
      const when = new Date(listedVal);
      if (Number.isNaN(when.getTime())) return fail('extra.errListed', 'editListed');
      listedAt = when.toISOString();
    }

    const watch = {
      ...(editing || {}),
      id: editing ? editing.id : `bw-${Date.now().toString(36)}`,
      brand,
      model,
      ref: $('editRef').value.trim(),
      year,
      priceNgn: price,
      movement: $('editMovement').value.trim(),
      caliber: $('editCaliber').value.trim(),
      caseSize: $('editCase').value.trim(),
      rate: $('editRate').value.trim(),
      status: readStatus(),
      tier: $('editTier').value,
      kind: $('editKind').value,
      featured: $('editFeatured').checked,
      conditions: CONDITIONS.filter((c) => document.querySelector(`#editForm input[name="cond"][value="${c}"]`)?.checked),
      highlights: $('editHighlights').value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8),
      notes: $('editNotes').value.trim(),
      image: photo,
      listedAt,
      visual: { ...DEFAULT_VISUAL, ...(editing ? editing.visual : {}), ...look.get() },
    };

    busy = true;
    $('editSave').disabled = true;
    try {
      await onSave(watch, !editing);
      overlay.close();
    } finally {
      busy = false;
      $('editSave').disabled = false;
    }
  }

  async function remove() {
    if (!editing || busy) return;
    if (!confirming) {
      confirming = true;
      setDeleteLabel();
      confirmTimer = setTimeout(resetConfirm, 4000);
      return;
    }
    busy = true;
    try {
      await onDelete(editing.id);
      overlay.close();
    } finally {
      busy = false;
    }
  }

  $('editForm').addEventListener('submit', submit);
  $('editDelete').addEventListener('click', remove);
  $('editClose').addEventListener('click', () => overlay.close());
  $('editCancel').addEventListener('click', () => overlay.close());
  $('editPrice').addEventListener('blur', (e) => { e.target.value = fmtInput(digits(e.target.value)); });
  $('editKind').addEventListener('change', () => { kindTouched = true; });
  $('editYear').addEventListener('input', (e) => {
    const y = digits(e.target.value);
    if (!kindTouched && y >= 1800 && y <= 2100) $('editKind').value = kindForYear(y);
  });
  labelAsButton($('editPhotoLabel'), $('editPhotoFile'));
  $('editPhotoFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) runPhoto(() => uploadPhoto(file), 'editor.photoError');
  });
  $('editPhotoUseLink').addEventListener('click', useLink);
  $('editPhotoLink').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); useLink(); }
  });
  $('editPhotoRemove').addEventListener('click', () => {
    showPhoto('');
    $('editPhotoStatus').textContent = '';
  });

  return { openNew, openEdit, isOpen: overlay.isOpen };
}
