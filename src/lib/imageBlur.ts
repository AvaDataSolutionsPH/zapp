// ============================================================
// Phase E — client-side blur detection for donut-crate photos
// ============================================================
// A no-AI, no-API sharpness heuristic: downscale the image, convert to
// grayscale, run a Laplacian convolution, and take the variance of the result.
// Sharp photos have high edge energy → high variance; blurry photos smear edges
// → low variance. Used at Beginning / Ending crate capture to warn the store to
// re-take an out-of-focus shot (donut counting relies on clear photos).
//
// Best-effort: any failure (unsupported file, canvas blocked) resolves to a
// non-blurry result so capture is never hard-blocked by a detector error.

export interface BlurResult {
  variance: number;
  isBlurry: boolean;
}

// Tuned conservatively — only clearly out-of-focus shots trip it, to avoid
// false positives on legitimately-busy photos in production.
export const BLUR_VARIANCE_THRESHOLD = 60;

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Estimate blur for an image file. Only processes images; non-images resolve to
 * a non-blurry result. Never rejects — swallows its own errors.
 */
export async function estimateBlur(file: File): Promise<BlurResult> {
  const notBlurry: BlurResult = { variance: Infinity, isBlurry: false };
  if (!file.type.startsWith('image/')) return notBlurry;

  try {
    const img = await loadBitmap(file);

    // Downscale to a fixed working size — fast + resolution-independent.
    const W = 256;
    const H = Math.max(1, Math.round((img.height / img.width) * W));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return notBlurry;
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    // Grayscale (luma).
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Laplacian (4-neighbour) over the interior, accumulate mean + variance.
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const lap =
          gray[i - 1] + gray[i + 1] + gray[i - W] + gray[i + W] - 4 * gray[i];
        sum += lap;
        sumSq += lap * lap;
        n++;
      }
    }
    if (n === 0) return notBlurry;
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return { variance, isBlurry: variance < BLUR_VARIANCE_THRESHOLD };
  } catch {
    return notBlurry;
  }
}

/**
 * Check a batch of files; returns true if ANY image looks blurry. Used to warn
 * on a multi-photo crate upload.
 */
export async function anyBlurry(files: File[]): Promise<boolean> {
  const results = await Promise.all(files.map((f) => estimateBlur(f)));
  return results.some((r) => r.isBlurry);
}
