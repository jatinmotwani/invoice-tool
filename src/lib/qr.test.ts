import { create } from 'qrcode';
import { describe, expect, it } from 'vitest';
import { qrShape } from './qr';

describe('qrShape', () => {
  it('encodes exactly the dark modules as merged runs', () => {
    const text = 'upi://pay?pa=asha%40okaxis&pn=Asha%20Rao&am=44000.00&cu=INR&tn=INV%2F26-27%2F001';
    const { size, path } = qrShape(text);
    const { data } = create(text, { errorCorrectionLevel: 'M' }).modules;
    expect(size).toBeGreaterThanOrEqual(21);

    const grid = new Uint8Array(size * size);
    for (const m of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      const [x, y, run] = [Number(m[1]), Number(m[2]), Number(m[3])];
      for (let i = 0; i < run; i++) grid[y * size + x + i] = 1;
    }
    expect([...grid]).toEqual([...data].map((v) => (v ? 1 : 0)));
  });
});
