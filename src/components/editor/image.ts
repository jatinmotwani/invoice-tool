/**
 * Resize an uploaded image on the device and return a PNG or JPEG data URL under `maxBytes`.
 * react-pdf embeds only PNG/JPEG, so WebP inputs are converted. Nothing is uploaded anywhere.
 */
export async function resizeImage(
  file: File,
  { maxWidth, maxHeight, maxBytes }: { maxWidth: number; maxHeight: number; maxBytes: number },
): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use a PNG, JPG or WebP image.');
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const bytes = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser can’t process images.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // PNG keeps transparency (logos, signatures); fall back to JPEG on white if it's too big.
    const png = canvas.toDataURL('image/png');
    if (bytes(png) <= maxBytes) return png;
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const fctx = flat.getContext('2d');
    if (!fctx) throw new Error('Your browser can’t process images.');
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(canvas, 0, 0);
    const jpeg = flat.toDataURL('image/jpeg', 0.85);
    if (bytes(jpeg) <= maxBytes) return jpeg;
    scale *= 0.75;
  }
  throw new Error('That image is too large. Try a smaller one.');
}
