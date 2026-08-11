import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

// Anthropic's vision models resize any image above roughly this long edge
// down to it before looking at it, so sending more than this buys nothing.
// Small phone photos / thumbnails / low-scale PDF renders, though, arrive
// *below* this, and every extra pixel of a shaky signature or faint stamp
// matters for legibility — so we upscale up to it, never past it.
const TARGET_LONG_EDGE = 1600;
const MAX_UPSCALE_FACTOR = 4;

/** Prepare a page image for handwriting transcription: upscale small/low-res
 * images so fine strokes have enough pixels to read, and stretch contrast on
 * washed-out scans (faint photocopies, low-contrast phone photos) so faint
 * ink stands out from the page. Leaves already-good images essentially
 * untouched. Always returns a lossless PNG so this step doesn't introduce
 * its own compression artifacts on top of a hard-to-read source. */
export async function preprocessForVision(buffer: Buffer): Promise<Buffer> {
  let image;
  try {
    image = await loadImage(buffer);
  } catch {
    // Formats Skia can't decode (rare BMP/TIFF variants) fall through to the
    // original bytes rather than failing the whole request — the caller
    // sends them as-is, same best-effort behavior as before this module
    // existed.
    return buffer;
  }
  const { width, height } = image;
  if (!width || !height) return buffer;

  const longEdge = Math.max(width, height);
  const scale =
    longEdge < TARGET_LONG_EDGE
      ? Math.min(TARGET_LONG_EDGE / longEdge, MAX_UPSCALE_FACTOR)
      : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = createCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  stretchContrast(ctx, targetWidth, targetHeight);

  return canvas.toBuffer("image/png");
}

/** Percentile-clipped auto-levels: find the luminance values that bound the
 * middle 99% of pixels and linearly stretch that range to full black/white.
 * Skipped when the image already has a wide range (a crisp scan), so this
 * only kicks in for genuinely washed-out sources instead of adding noise or
 * clipping to already-well-exposed photos. */
function stretchContrast(ctx: SKRSContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[lum]++;
  }

  const totalPixels = width * height;
  const lowClipCount = totalPixels * 0.005;
  const highClipCount = totalPixels * 0.005;

  let low = 0;
  let cumulative = 0;
  for (; low < 255; low++) {
    cumulative += histogram[low];
    if (cumulative >= lowClipCount) break;
  }

  let high = 255;
  cumulative = 0;
  for (; high > 0; high--) {
    cumulative += histogram[high];
    if (cumulative >= highClipCount) break;
  }

  const range = high - low;
  if (range <= 0 || range >= 200) return;

  const scale = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp((data[i] - low) * scale);
    data[i + 1] = clamp((data[i + 1] - low) * scale);
    data[i + 2] = clamp((data[i + 2] - low) * scale);
  }
  ctx.putImageData(imageData, 0, 0);
}

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
