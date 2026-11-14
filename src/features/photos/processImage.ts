import type { PhotoInput } from '../../db/photos';
import {
  PHOTO_MAX_BYTES, PHOTO_MAX_EDGE, PHOTO_QUALITY, THUMB_MAX_BYTES, THUMB_MAX_EDGE, THUMB_QUALITY, encodeWithin, fitWithin,
} from '../../domain/photos';

type Source = ImageBitmap | HTMLImageElement;

/** Decode a camera or library file, respecting EXIF orientation. HEIC decodes where the browser can show it. */
async function decode(file: Blob): Promise<{ source: Source; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // Older Safari: fall back to an <img>, which applies EXIF orientation itself.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function draw(source: CanvasImageSource, width: number, height: number, maxEdge: number): HTMLCanvasElement {
  const size = fitWithin(width, height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the photo');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the photo'))), 'image/jpeg', quality));

/**
 * Downscale a photo for storage: at most 1280 px on the long edge as JPEG (~0.7, lower if needed to stay under
 * 300 KB), plus a 160 px thumbnail (under 15 KB). Runs outside any IndexedDB transaction.
 */
export async function processImage(file: Blob): Promise<PhotoInput> {
  const img = await decode(file);
  try {
    const full = draw(img.source, img.width, img.height, PHOTO_MAX_EDGE);
    // The thumbnail is drawn from the downscaled copy: a smaller step looks sharper than one from 4000 px.
    const small = draw(full, full.width, full.height, THUMB_MAX_EDGE);
    const [blob, thumb] = await Promise.all([
      encodeWithin((q) => toJpeg(full, q), PHOTO_QUALITY, PHOTO_MAX_BYTES),
      encodeWithin((q) => toJpeg(small, q), THUMB_QUALITY, THUMB_MAX_BYTES),
    ]);
    return { blob, thumb };
  } finally {
    img.close();
  }
}
