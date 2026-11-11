/**
 * OWNER 11 Nov (Finance Verticals tab screenshot): every photo upload ended in "Upload failed".
 *
 * WHY: the tab read the picked file straight into a base64 data URL and posted it, allowing files up to
 * 4 MB. The API's JSON body limit is 256 kb, so the request body was dropped before the handler ran and
 * the browser only ever saw a generic failure. A phone photo is 2-4 MB, so this failed on EVERY real
 * photo; the merchant-logo validator also caps a stored logo at ~300 KB of image.
 *
 * This shrinks the picture IN THE BROWSER first (longest side <= maxPx, JPEG) so an ordinary camera photo
 * becomes 40-90 KB: it fits the body limit, fits the stored-logo cap, and still looks sharp on a card.
 * If canvas is unavailable for any reason the original data URL is returned, never a broken upload.
 */
export async function downscaleImage(file: File, maxPx = 512, quality = 0.85): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(new Error('Could not read that file'));
    fr.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode that image'));
      el.src = raw;
    });
    const scale = Math.min(1, maxPx / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || maxPx) * scale));
    const h = Math.max(1, Math.round((img.height || maxPx) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black, when flattened to JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', quality);
    // Guard: a re-encode can occasionally be larger (already tiny source). Keep whichever is smaller.
    return out.length < raw.length ? out : raw;
  } catch {
    return raw;
  }
}
