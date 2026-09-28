import { pdf } from '@react-pdf/renderer';
import type { InvoiceView } from '../../lib/invoice/view';
import { qrShape } from '../../lib/qr';
import type { Appearance } from '../preview/InvoicePreview';
import { InvoicePdf } from './InvoicePdf';

/** Loaded with a dynamic import on the first PDF action, so react-pdf never weighs on page load. */
export async function renderInvoicePdf(view: InvoiceView, appearance: Appearance): Promise<Blob> {
  const qr = view.upi ? qrShape(view.upi.uri) : null;
  return pdf(<InvoicePdf view={view} appearance={appearance} qr={qr} />).toBlob();
}

export function pdfFileName(view: InvoiceView): string {
  const number = (view.meta.find((m) => m.label === 'Invoice No.')?.value ?? 'invoice').replace(
    /[^A-Za-z0-9-]+/g,
    '-',
  );
  return `${view.title.replace(/\s+/g, '-')}-${number}.pdf`;
}
