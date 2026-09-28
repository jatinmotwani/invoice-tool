import type { InvoiceView } from './view';

/** Friendly message to send with the invoice (WhatsApp, email…). */
export function shareMessage(view: InvoiceView): string {
  const number = view.meta.find((m) => m.label === 'Invoice No.')?.value ?? '';
  const due = view.meta.find((m) => m.label === 'Due Date')?.value.replace(/\s*\(.*\)$/, '') ?? '';
  const greeting = view.client.name ? `Hi ${view.client.name},` : 'Hi,';
  const lines = [
    greeting,
    `Please find invoice ${number} for ${view.amountDue}${due ? `, due on ${due}` : ''}.`,
  ];
  if (view.upi) lines.push(`Pay by UPI to ${view.upi.vpa}: ${view.upi.uri}`);
  lines.push('Thank you!', view.supplier.name);
  return lines.filter(Boolean).join('\n');
}

/** https://wa.me/?text=… opens WhatsApp with the message; the user picks the chat. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
