import type { Page } from '@playwright/test';

/**
 * Photo-like test images made in the browser: a lit wall texture with grain, coloured holds with shading
 * and chalk marks, at phone-camera sizes, saved as high-quality JPEG (like a camera original).
 * Deterministic per index.
 */
export async function makeTestImages(page: Page, count: number, size?: { width: number; height: number }): Promise<Buffer[]> {
  const b64: string[] = await page.evaluate(async ({ count, size }) => {
    const out: string[] = [];
    for (let n = 0; n < count; n++) {
      let seed = 1234 + n * 7919;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const portrait = n % 3 === 1;
      const w = size?.width ?? (portrait ? 3024 : 4032);
      const h = size?.height ?? (portrait ? 4032 : 3024);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, w * rnd(), h);
      g.addColorStop(0, `hsl(${30 + rnd() * 40}, 15%, ${55 + rnd() * 20}%)`);
      g.addColorStop(1, `hsl(${200 + rnd() * 40}, 10%, ${25 + rnd() * 20}%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Plywood panel seams.
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 6;
      for (let x = 0; x < w; x += w / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += h / 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // Holds: shaded blobs with a chalky top.
      for (let i = 0; i < 260; i++) {
        const x = rnd() * w, y = rnd() * h, r = 15 + rnd() * 110;
        const hue = Math.floor(rnd() * 360);
        const rg = ctx.createRadialGradient(x - r / 3, y - r / 3, r / 8, x, y, r);
        rg.addColorStop(0, `hsl(${hue}, 70%, 70%)`);
        rg.addColorStop(1, `hsl(${hue}, 70%, 30%)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y - r / 3, r / 2, r / 5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (i % 3 === 0) { ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); }
      }
      // Sensor grain.
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let p = 0; p < d.length; p += 4) {
        const v = (rnd() - 0.5) * 18;
        d[p] += v; d[p + 1] += v; d[p + 2] += v;
      }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out.push(btoa(s));
    }
    return out;
  }, { count, size });
  return b64.map((s) => Buffer.from(s, 'base64'));
}

export interface StoredPhoto { blob: number; thumb: number; width: number; height: number; thumbWidth: number; thumbHeight: number; type: string }

/** Sizes and dimensions of every photo stored in the app's IndexedDB. */
export function storedPhotos(page: Page): Promise<StoredPhoto[]> {
  return page.evaluate(
    () =>
      new Promise<StoredPhoto[]>((resolve, reject) => {
        const open = indexedDB.open('climb-log');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('photos').objectStore('photos').getAll();
          req.onerror = () => reject(req.error);
          req.onsuccess = async () => {
            const rows = req.result as { blob: Blob; thumb: Blob }[];
            resolve(
              await Promise.all(
                rows.map(async (r) => {
                  const [a, b] = await Promise.all([createImageBitmap(r.blob), createImageBitmap(r.thumb)]);
                  return { blob: r.blob.size, thumb: r.thumb.size, width: a.width, height: a.height, thumbWidth: b.width, thumbHeight: b.height, type: r.blob.type };
                }),
              ),
            );
            open.result.close();
          };
        };
      }),
  );
}
