import { create } from 'qrcode';

export interface QrShape {
  /** Modules per side (without quiet zone). */
  size: number;
  /** SVG path of dark modules in module units; horizontal runs merged. Works in HTML <svg> and react-pdf <Svg>. */
  path: string;
}

export function qrShape(text: string): QrShape {
  const { size, data } = create(text, { errorCorrectionLevel: 'M' }).modules;
  let path = '';
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      path += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return { size, path };
}
