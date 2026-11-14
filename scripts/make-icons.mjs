// Generates the app icons as PNGs with no image dependencies.
// Design: slate square, three ascending chalk-white "tape" bars.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [0x15, 0x17, 0x1a];
const FG = [0xf2, 0xef, 0xe8];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// safe = fraction of the canvas the artwork may use (maskable icons need ~0.6).
function icon(size, safe) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const pad = (size * (1 - safe)) / 2;
  const inner = size * safe;
  const barW = inner * 0.22;
  const gap = (inner - 3 * barW) / 2;
  const bars = [0.4, 0.65, 0.9].map((h, i) => {
    const x0 = pad + i * (barW + gap);
    return [x0, pad + inner * (1 - h), x0 + barW, pad + inner];
  });
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const on = bars.some(([x0, y0, x1, y1]) => inRoundRect(x + 0.5, y + 0.5, x0, y0, x1, y1, barW * 0.18));
      const c = on ? FG : BG;
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = 'public/icons';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/icon-192.png`, icon(192, 0.7));
writeFileSync(`${out}/icon-512.png`, icon(512, 0.7));
writeFileSync(`${out}/icon-maskable-512.png`, icon(512, 0.55));
writeFileSync(`${out}/apple-touch-icon-180.png`, icon(180, 0.7));
writeFileSync(
  `${out}/favicon.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#15171a"/>` +
    [0.4, 0.65, 0.9]
      .map((h, i) => `<rect x="${15 + i * 26}" y="${15 + 70 * (1 - h)}" width="18" height="${70 * h}" rx="3" fill="#f2efe8"/>`)
      .join('') +
    `</svg>\n`,
);
console.log('icons written to', out);
