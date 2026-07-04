// ============================================================
// imageCompress — downscale + re-encode an image File in the browser
// ============================================================
// Phone cameras produce large photos (3–10 MB). On a weak mobile
// connection — or against a bucket file-size limit — uploading those
// raw often fails/times out, which surfaces to the applicant as a
// generic "Submission failed". Re-drawing the image onto a canvas
// scaled to a sane max dimension and exporting JPEG shrinks it to a
// few hundred KB, so uploads are fast and reliable.
//
// Fails SOFT: if anything goes wrong (non-image, decode failure e.g.
// an undecodable HEIC, no canvas), it returns the ORIGINAL file so the
// upload still proceeds.

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const img = await loadImage(await readAsDataURL(file));
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    // Already small (dimensions fit AND under ~1MB) → leave it alone.
    if (scale === 1 && file.size < 1_000_000) return file;

    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file; // no gain → keep original

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
