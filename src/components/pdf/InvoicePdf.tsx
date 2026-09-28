import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { InvoiceView } from '../../lib/invoice/view';
import type { QrShape } from '../../lib/qr';
import type { Appearance } from '../preview/InvoicePreview';

// Noto Sans subset (Latin + ₹ € £ …), self-hosted. react-pdf subsets it again, so the PDF only embeds used glyphs.
Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: '/fonts/NotoSans-Regular-subset.ttf', fontWeight: 400 },
    { src: '/fonts/NotoSans-Bold-subset.ttf', fontWeight: 700 },
  ],
});
// Never hyphenate words (GSTINs, amounts, names).
Font.registerHyphenationCallback((word) => [word]);

const SLATE_500 = '#64748b';
const SLATE_700 = '#334155';
const SLATE_900 = '#0f172a';
const RULE = '#e2e8f0';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Noto Sans',
    fontSize: 9,
    color: SLATE_700,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    lineHeight: 1.35,
  },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 7, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' },
  name: { fontSize: 11, fontWeight: 700, color: SLATE_900, marginTop: 2 },
  muted: { color: SLATE_500 },
  strong: { color: SLATE_900, fontWeight: 700 },
  fieldRow: { flexDirection: 'row', marginTop: 1 },
  fieldLabel: { color: SLATE_500, marginRight: 6 },
  th: { fontWeight: 700, color: SLATE_900, paddingVertical: 4, paddingRight: 4 },
  td: { paddingVertical: 4, paddingRight: 4 },
  right: { textAlign: 'right' },
  box: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 3, padding: 6, marginTop: 12 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: SLATE_500,
  },
});

function Fields({ fields, align = 'left' }: { fields: InvoiceView['meta']; align?: 'left' | 'right' }) {
  return (
    <View>
      {fields.map((f) => (
        <View key={f.label} style={[s.fieldRow, align === 'right' ? { justifyContent: 'flex-end' } : {}]}>
          <Text style={s.fieldLabel}>{f.label}</Text>
          <Text style={s.strong}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Party({ party, accent }: { party: InvoiceView['supplier']; accent: string }) {
  return (
    <View>
      <Text style={[s.label, { color: accent }]}>{party.heading}</Text>
      <Text style={s.name}>{party.name || '—'}</Text>
      {party.addressLines.map((l, i) => (
        <Text key={i}>{l}</Text>
      ))}
      <View style={{ marginTop: 2 }}>
        <Fields fields={party.fields} />
      </View>
    </View>
  );
}

interface Props {
  view: InvoiceView;
  appearance: Appearance;
  qr: QrShape | null;
}

/** A4 PDF of the invoice. Like the HTML preview, it only lays out the view-model. */
export function InvoicePdf({ view, appearance, qr }: Props) {
  const accent = appearance.accent;
  const modern = appearance.template === 'modern';
  const { columns } = view;

  // Column widths (percent); description takes the rest.
  const cols: { key: string; label: string; width: number; right?: boolean }[] = [
    { key: 'index', label: '#', width: 4 },
    ...(columns.sac ? [{ key: 'sac', label: 'SAC', width: 10 }] : []),
    { key: 'qty', label: 'Qty', width: 13, right: true },
    { key: 'rate', label: 'Rate', width: 13, right: true },
    ...(columns.discount ? [{ key: 'discount', label: 'Discount', width: 11, right: true }] : []),
    ...(columns.gstRate ? [{ key: 'gstRate', label: 'GST', width: 7, right: true }] : []),
    { key: 'amount', label: view.moneyHeader, width: 15, right: true },
  ];
  const descWidth = 100 - cols.reduce((a, c) => a + c.width, 0);
  const cell = (item: InvoiceView['items'][number], key: string): string =>
    key === 'qty' ? `${item.qty} ${item.unit}` : String(item[key as keyof typeof item] ?? '');

  return (
    <Document
      title={`${view.title} ${view.meta[0]?.value ?? ''}`}
      author={view.supplier.name}
      creator={view.footerCredit ?? ''}
      producer=""
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View
          style={
            modern
              ? {
                  backgroundColor: accent,
                  marginHorizontal: -40,
                  marginTop: -36,
                  paddingHorizontal: 40,
                  paddingVertical: 18,
                  marginBottom: 16,
                }
              : { marginBottom: 16 }
          }
        >
          <View style={[s.between, { alignItems: 'center' }]}>
            <View style={[s.row, { alignItems: 'center' }]}>
              {appearance.logo ? (
                <Image
                  src={appearance.logo}
                  style={{ maxHeight: 40, maxWidth: 110, objectFit: 'contain', marginRight: 8 }}
                />
              ) : null}
              {modern ? (
                <Text style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{view.supplier.name}</Text>
              ) : null}
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: modern ? '#ffffff' : accent,
              }}
            >
              {view.title}
            </Text>
          </View>
        </View>

        {/* Parties + meta */}
        <View style={s.between}>
          <View style={{ width: '55%' }}>
            <Party party={view.supplier} accent={accent} />
          </View>
          <View style={{ width: '42%' }}>
            <Fields fields={view.meta} align="right" />
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <Party party={view.client} accent={accent} />
        </View>

        {/* Items */}
        <View style={{ marginTop: 14 }}>
          <View
            style={[
              s.row,
              modern
                ? { backgroundColor: '#f1f5f9' }
                : { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: accent },
            ]}
            fixed
          >
            <Text style={[s.th, { width: `${cols[0]?.width}%` }]}>#</Text>
            <Text style={[s.th, { width: `${descWidth}%` }]}>Description</Text>
            {cols.slice(1).map((c) => (
              <Text key={c.key} style={[s.th, { width: `${c.width}%` }, c.right ? s.right : {}]}>
                {c.label}
              </Text>
            ))}
          </View>
          {view.items.map((item) => (
            <View
              key={item.index}
              style={[s.row, { borderBottomWidth: 0.5, borderColor: RULE }]}
              wrap={false}
            >
              <Text style={[s.td, s.muted, { width: `${cols[0]?.width}%` }]}>{item.index}</Text>
              <Text style={[s.td, { width: `${descWidth}%`, color: SLATE_900 }]}>
                {item.description || '—'}
              </Text>
              {cols.slice(1).map((c) => (
                <Text
                  key={c.key}
                  style={[
                    s.td,
                    { width: `${c.width}%` },
                    c.right ? s.right : {},
                    c.key === 'amount' ? s.strong : {},
                  ]}
                >
                  {cell(item, c.key)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {/* Words + totals */}
        <View style={[s.between, { marginTop: 12 }]} wrap={false}>
          <View style={{ width: '50%', paddingRight: 12 }}>
            <Text style={s.muted}>Amount in words</Text>
            <Text style={s.strong}>{view.amountInWords}</Text>
            {view.inrEquivalent ? <Text style={{ marginTop: 6 }}>{view.inrEquivalent}</Text> : null}
          </View>
          <View style={{ width: '45%' }}>
            {view.summary.map((row) => {
              const big = row.kind === 'total' || row.kind === 'net';
              return (
                <View
                  key={row.label}
                  style={[
                    s.between,
                    { paddingVertical: 2 },
                    big ? { borderTopWidth: 1.5, borderColor: accent, marginTop: 2, paddingTop: 4 } : {},
                  ]}
                >
                  <Text style={big ? [s.strong, { fontSize: 11 }] : {}}>{row.label}</Text>
                  <Text style={big ? [s.strong, { fontSize: 11 }] : { color: SLATE_900 }}>{row.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {view.lut || view.endorsement ? (
          <View style={s.box} wrap={false}>
            {view.lut ? <Text style={[s.strong, { fontSize: 8 }]}>{view.lut}</Text> : null}
            {view.endorsement ? <Text style={[s.strong, { fontSize: 8 }]}>{view.endorsement}</Text> : null}
          </View>
        ) : null}

        {/* Payment */}
        {view.bank.length > 0 || view.upi ? (
          <View style={[s.between, { marginTop: 14 }]} wrap={false}>
            <View style={{ width: '60%' }}>
              {view.bank.length > 0 ? (
                <>
                  <Text style={[s.label, { color: accent, marginBottom: 2 }]}>Bank details</Text>
                  <Fields fields={view.bank} />
                </>
              ) : null}
            </View>
            {view.upi && qr ? (
              <View style={{ width: '35%', alignItems: 'flex-end' }}>
                <Svg width={84} height={84} viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`}>
                  <Path d={qr.path} fill="#000000" transform="translate(4 4)" />
                </Svg>
                <Text style={[s.strong, { marginTop: 2 }]}>Scan to pay with UPI</Text>
                <Text>{view.upi.vpa}</Text>
                {view.upi.amount ? <Text>{view.upi.amount}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {view.notes.length > 0 ? (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={[s.label, { color: accent, marginBottom: 2 }]}>Notes</Text>
            {view.notes.map((n, i) => (
              <Text key={i}>{n}</Text>
            ))}
          </View>
        ) : null}

        {/* Signature */}
        <View style={{ marginTop: 20, alignItems: 'flex-end' }} wrap={false}>
          <View style={{ width: 170, alignItems: 'center' }}>
            <Text>For {view.signatory.forName || '—'}</Text>
            <View style={{ height: 44, justifyContent: 'center' }}>
              {appearance.signature ? (
                <Image
                  src={appearance.signature}
                  style={{ maxHeight: 40, maxWidth: 150, objectFit: 'contain' }}
                />
              ) : null}
            </View>
            <Text
              style={{
                borderTopWidth: 0.75,
                borderColor: '#94a3b8',
                paddingTop: 2,
                width: '100%',
                textAlign: 'center',
              }}
            >
              {view.signatory.label}
            </Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{view.footerCredit ?? ''}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ''
            }
          />
        </View>
      </Page>
    </Document>
  );
}
