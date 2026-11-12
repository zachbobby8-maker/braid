// Photo workflow: generate a studio photo with AI, or upload your own.
// With the live database connected, uploads are stored there so every buyer sees them.
import { hasDatabase, uploadPhotoFile, uploadSellPhoto } from './backend.js';

const IMAGE_MODEL_ID = 'b44969fb-941d-48e8-9c91-22793ad080ca'; // FLUX.2 Flash

function sdk() {
  if (!window.miniappsAI) throw new Error('SDK_UNAVAILABLE');
  return window.miniappsAI;
}

function buildPrompt(watch) {
  const details = (watch.highlights || []).slice(0, 3).join(', ');
  return [
    `Macro studio product photograph of a vintage ${watch.year} ${watch.brand} ${watch.model} wristwatch`,
    watch.caseSize ? `case: ${watch.caseSize}` : '',
    details,
    'shot straight on, dial in razor-sharp focus, fine brushed metal and crystal reflections',
    'seamless dark obsidian backdrop, soft diffused key light with a warm gold rim light',
    'luxury auction catalogue photography, photorealistic, high detail, no text, no watermark, no hands',
  ].filter(Boolean).join(', ');
}

export async function generatePhoto(watch) {
  const ai = sdk();
  const result = await ai.callStructured({
    modelId: IMAGE_MODEL_ID,
    input: { prompt: buildPrompt(watch), image_size: 'square_hd', output_format: 'jpeg', num_images: 1 },
    outputMediaPersistence: 'durable',
    timeoutMs: 120000,
  });
  const assets = ai.extractMediaAssets(result, { kind: 'image' });
  if (!assets.length || !assets[0].publicUrl) throw new Error('NO_IMAGE');
  return assets[0].publicUrl;
}

export async function uploadPhoto(file) {
  if (hasDatabase()) return uploadPhotoFile(file);
  const uploaded = await sdk().uploadFile(file, { persistence: 'durable' });
  return uploaded.publicUrl;
}

export async function uploadPhotos(files) {
  if (hasDatabase()) {
    const results = await Promise.allSettled(files.map((f) => uploadSellPhoto(f)));
    const urls = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (!urls.length) throw new Error('UPLOAD');
    return urls;
  }
  const uploaded = await sdk().uploadFiles(files, { persistence: 'durable' });
  return uploaded.map((u) => u.publicUrl).filter(Boolean);
}

// Confirms a pasted link really loads as a picture before it is saved.
export function checkImageLink(raw) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(String(raw).trim());
    } catch {
      reject(new Error('BAD_URL'));
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      reject(new Error('BAD_URL'));
      return;
    }
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), 15000);
    img.onload = () => { clearTimeout(timer); resolve(url.href); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('NOT_IMAGE')); };
    img.src = url.href;
  });
}
