/** WCAG 2 relative luminance / contrast helpers for the accent colour picker. */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new RangeError(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x ?? '0', 16));
  return 0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
}

/** Contrast ratio against white (text on white, and white text on the accent in the Modern header). */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/** AA for normal text. */
export const AA = 4.5;
