/** Parse '#rrggbb' (or '#rgb'). Returns null when invalid. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function isValidHex(hex: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(hex);
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const BLACK = '#000000';
const WHITE = '#ffffff';

/** Black or white, whichever contrasts more with the chip colour. */
export function textOn(hex: string): typeof BLACK | typeof WHITE {
  return contrastRatio(hex, BLACK) >= contrastRatio(hex, WHITE) ? BLACK : WHITE;
}

/** Chips this close to the page background need a border to stay visible. */
export function needsBorder(hex: string, background: string): boolean {
  return contrastRatio(hex, background) < 1.6;
}
