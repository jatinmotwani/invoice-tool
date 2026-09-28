import { useEffect, useRef, useState } from 'react';
import type { Template } from '../../lib/invoice/profile';
import type { InvoiceView } from '../../lib/invoice/view';
import type { QrShape } from '../../lib/qr';

export interface Appearance {
  template: Template;
  accent: string;
  logo: string;
  signature: string;
}

interface Props {
  view: InvoiceView;
  appearance: Appearance;
  /** Pre-computed QR (static pages). In the editor it is computed lazily from `view.upi`. */
  qr?: QrShape | null | undefined;
}

/** Lazily load the QR encoder only when a UPI link exists. */
function useQr(uri: string | undefined, initial: QrShape | null | undefined): QrShape | null {
  const [shape, setShape] = useState<QrShape | null>(initial ?? null);
  useEffect(() => {
    if (!uri) return;
    let live = true;
    void import('../../lib/qr').then(({ qrShape }) => {
      if (live) setShape(qrShape(uri));
    });
    return () => {
      live = false;
    };
  }, [uri]);
  return uri ? shape : null;
}

export function QrSvg({ shape, label }: { shape: QrShape; label: string }) {
  const q = 4; // quiet zone
  const n = shape.size + q * 2;
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      className="size-28 bg-white"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <path d={shape.path} transform={`translate(${q} ${q})`} fill="#000" />
    </svg>
  );
}

function Fields({ fields }: { fields: InvoiceView['meta'] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      {fields.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-slate-500">{f.label}</dt>
          <dd className="font-medium break-words text-slate-900">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Party({ party }: { party: InvoiceView['supplier'] }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.7rem] font-semibold tracking-wider text-[--accent] uppercase">{party.heading}</p>
      <p className="mt-1 text-base font-semibold break-words text-slate-900">{party.name || '—'}</p>
      {party.addressLines.map((l, i) => (
        <p key={i} className="break-words text-slate-700">
          {l}
        </p>
      ))}
      {party.fields.length > 0 && (
        <div className="mt-1">
          <Fields fields={party.fields} />
        </div>
      )}
    </div>
  );
}

/**
 * The invoice as HTML. Renders only from the view-model (no maths), so it always matches the PDF.
 * The accent colour is a CSS variable set through the CSSOM (inline style attributes are blocked by the CSP).
 */
export default function InvoicePreview({ view, appearance, qr }: Props) {
  const ref = useRef<HTMLElement>(null);
  const qrShape = useQr(view.upi?.uri, qr);

  useEffect(() => {
    ref.current?.style.setProperty('--accent', appearance.accent);
  }, [appearance.accent]);

  const modern = appearance.template === 'modern';
  const { columns } = view;

  return (
    <article
      ref={ref}
      className="invoice-paper @container mx-auto w-full max-w-[794px] bg-white text-[0.8rem] leading-snug text-slate-800 [--accent:#1d4ed8] @xl:text-sm"
      aria-label={`${view.title} ${view.meta[0]?.value ?? ''}`}
    >
      <header
        className={modern ? 'bg-[--accent] px-5 py-5 text-white @xl:px-10' : 'px-5 pt-6 @xl:px-10 @xl:pt-10'}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {appearance.logo && (
              <img
                src={appearance.logo}
                alt=""
                className="max-h-14 max-w-32 object-contain"
                width={128}
                height={56}
              />
            )}
            {modern && <p className="text-lg font-semibold break-words">{view.supplier.name}</p>}
          </div>
          {/* h2: the page's own H1 is the only H1 (SEO); the invoice title sits under it. */}
          <h2
            className={
              modern
                ? 'text-2xl font-bold tracking-wide uppercase'
                : 'text-2xl font-bold tracking-wide text-[--accent] uppercase'
            }
          >
            {view.title}
          </h2>
        </div>
      </header>

      <div className="space-y-5 px-5 py-6 @xl:px-10">
        <div className="grid gap-4 @lg:grid-cols-[1fr_auto]">
          <Party party={view.supplier} />
          <div className="@lg:text-right">
            <Fields fields={view.meta} />
          </div>
        </div>

        <Party party={view.client} />

        <table className="w-full border-collapse">
          <thead>
            <tr className={modern ? 'bg-slate-100 text-left' : 'border-y-2 border-[--accent] text-left'}>
              <th scope="col" className="hidden py-2 pr-2 font-semibold @xl:table-cell">
                #
              </th>
              <th scope="col" className="py-2 pr-2 font-semibold">
                Description
              </th>
              {columns.sac && (
                <th scope="col" className="hidden py-2 pr-2 font-semibold @xl:table-cell">
                  SAC
                </th>
              )}
              <th scope="col" className="hidden py-2 pr-2 text-right font-semibold @xl:table-cell">
                Qty
              </th>
              <th scope="col" className="hidden py-2 pr-2 text-right font-semibold @xl:table-cell">
                Rate
              </th>
              {columns.discount && (
                <th scope="col" className="hidden py-2 pr-2 text-right font-semibold @xl:table-cell">
                  Discount
                </th>
              )}
              {columns.gstRate && (
                <th scope="col" className="hidden py-2 pr-2 text-right font-semibold @xl:table-cell">
                  GST
                </th>
              )}
              <th scope="col" className="py-2 text-right font-semibold whitespace-nowrap">
                {view.moneyHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.items.map((item) => (
              <tr key={item.index} className="border-b border-slate-200 align-top">
                <td className="hidden py-2 pr-2 text-slate-500 @xl:table-cell">{item.index}</td>
                <td className="py-2 pr-2">
                  <p className="break-words whitespace-pre-line">{item.description || '—'}</p>
                  {/* Narrow layout: the other columns collapse into one line under the description. */}
                  <p className="text-slate-500 @xl:hidden">
                    {[
                      `${item.qty} ${item.unit} × ${item.rate}`,
                      item.discount && `less ${item.discount}`,
                      columns.gstRate && `GST ${item.gstRate}`,
                      columns.sac && item.sac && `SAC ${item.sac}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </td>
                {columns.sac && <td className="hidden py-2 pr-2 @xl:table-cell">{item.sac}</td>}
                <td className="hidden py-2 pr-2 text-right whitespace-nowrap @xl:table-cell">
                  {item.qty} {item.unit}
                </td>
                <td className="hidden py-2 pr-2 text-right whitespace-nowrap @xl:table-cell">{item.rate}</td>
                {columns.discount && (
                  <td className="hidden py-2 pr-2 text-right whitespace-nowrap @xl:table-cell">
                    {item.discount}
                  </td>
                )}
                {columns.gstRate && (
                  <td className="hidden py-2 pr-2 text-right whitespace-nowrap @xl:table-cell">
                    {item.gstRate}
                  </td>
                )}
                <td className="py-2 text-right font-medium whitespace-nowrap">{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid gap-5 @lg:grid-cols-[1fr_minmax(220px,auto)]">
          <div className="space-y-3 @lg:order-first">
            <div>
              <p className="text-slate-500">Amount in words</p>
              <p className="font-medium text-slate-900">{view.amountInWords}</p>
            </div>
            {view.inrEquivalent && <p className="text-slate-700">{view.inrEquivalent}</p>}
          </div>
          <table className="w-full border-collapse self-start">
            <tbody>
              {view.summary.map((row) => (
                <tr
                  key={row.label}
                  className={
                    row.kind === 'total' || row.kind === 'net'
                      ? 'border-t-2 border-[--accent] text-base font-bold text-slate-900'
                      : ''
                  }
                >
                  <th scope="row" className="py-1 pr-4 text-left font-normal">
                    {row.label}
                  </th>
                  <td className="py-1 text-right whitespace-nowrap">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(view.lut || view.endorsement) && (
          <div className="rounded border border-slate-300 p-3 text-[0.7rem] font-semibold tracking-wide text-slate-900 @xl:text-xs">
            {view.lut && <p>{view.lut}</p>}
            {view.endorsement && <p className={view.lut ? 'mt-1' : ''}>{view.endorsement}</p>}
          </div>
        )}

        {(view.bank.length > 0 || view.upi) && (
          <div className="grid gap-4 @lg:grid-cols-[1fr_auto]">
            {view.bank.length > 0 && (
              <div>
                <p className="mb-1 text-[0.7rem] font-semibold tracking-wider text-[--accent] uppercase">
                  Bank details
                </p>
                <Fields fields={view.bank} />
              </div>
            )}
            {view.upi && (
              <div className="flex items-center gap-3 @lg:flex-col @lg:items-end @lg:text-right">
                {qrShape && <QrSvg shape={qrShape} label={`UPI QR code to pay ${view.upi.vpa}`} />}
                <div>
                  <p className="font-semibold text-slate-900">Scan to pay with UPI</p>
                  <p className="text-slate-700">{view.upi.vpa}</p>
                  {view.upi.amount && <p className="text-slate-700">{view.upi.amount}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {view.notes.length > 0 && (
          <div>
            <p className="mb-1 text-[0.7rem] font-semibold tracking-wider text-[--accent] uppercase">Notes</p>
            {view.notes.map((n, i) => (
              <p key={i} className="whitespace-pre-line">
                {n}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <div className="text-center">
            <p className="text-slate-700">For {view.signatory.forName || '—'}</p>
            <div className="flex h-16 items-center justify-center">
              {appearance.signature && (
                <img
                  src={appearance.signature}
                  alt="Signature"
                  className="max-h-14 max-w-40 object-contain"
                  width={160}
                  height={56}
                />
              )}
            </div>
            <p className="border-t border-slate-400 pt-1 text-slate-700">{view.signatory.label}</p>
          </div>
        </div>

        {view.footerCredit && (
          <p className="pt-2 text-center text-[0.7rem] text-slate-500">{view.footerCredit}</p>
        )}
      </div>
    </article>
  );
}
