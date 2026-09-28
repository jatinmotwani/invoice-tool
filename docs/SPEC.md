# Product spec (source of truth)

Original brief from the owner, saved verbatim. Changes to scope need the owner's OK.

---

Build <BRAND>: a free invoice tool for Indian freelancers. No signup, no login, no server-side user data. SEO is the only marketing channel, so page speed and page quality are features.

## Working agreement
- Solo dev, ~1 hr/day. Split work into tasks that finish in one session and end green (typecheck, lint, test, build) with a commit.
- First: save this brief as docs/SPEC.md, create a short CLAUDE.md (stack, commands, conventions, current milestone), then propose a plan. Wait for my OK before coding.
- Low ops: static site on Cloudflare Pages. No backend, DB, auth or cookies. Ask before adding any dependency not listed here.
- Tax/legal accuracy: never invent rates, section numbers or rules. Cite an official source (cbic-gst.gov.in, incometax.gov.in, npci.org.in) in a code comment/frontmatter, or mark TODO(verify) for my review.

## Positioning
"A correct invoice from your phone in 2 minutes — and get paid in full." Three auto-detected situations: (1) not GST-registered, (2) GST-registered with domestic client, (3) foreign client. All data stays in the browser.

## Stack
- Astro (static output, zero JS on content pages) + one React island for the editor; TypeScript strict; Tailwind.
- IndexedDB via Dexie: versioned schema + migrations; request navigator.storage.persist(); JSON backup export/import.
- PDF: @react-pdf/renderer, dynamically imported on first download. A4, selectable text, embedded subset font containing ₹ (U+20B9), e.g. Noto Sans.
- qrcode, zod. Money as integer paise.
- Vitest (domain), Playwright (e2e, mobile + desktop viewports), Lighthouse CI (mobile).
- Cloudflare Web Analytics (cookieless). Meta-tag placeholders for Google Search Console + Bing Webmaster Tools.

## Domain rules: pure functions in src/lib/invoice, fully unit-tested
1. Tax-mode resolver (supplier GSTIN/state, client country/state, LUT flag):
   - NON_GST: title "Invoice", no tax lines, optional PAN, note "Not registered under GST".
   - INTRA: CGST + SGST at half the rate each, each computed on taxable value (never split a rounded total). UTGST replaces SGST for UTs without legislature (codes 04, 26, 31, 35, 38).
   - INTER: IGST.
   - EXPORT_LUT: IGST 0%, place of supply "96 - Other Countries", LUT ARN + FY, endorsement "SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX" (Rule 46; verify wording).
   - EXPORT_IGST: IGST charged (refund route).
   - Unregistered supplier + foreign client: plain "Invoice" in foreign currency; hide LUT option (LUT requires GSTIN).
   - Title "Tax Invoice" for every GST-registered mode.
2. GST rate default 18%, editable per line. Tax per rate group, half-up to paise. Optional round-off to nearest rupee.
3. Invoice number: ≤16 chars, [A-Za-z0-9/-], unique per financial year (Apr–Mar). Default series INV/26-27/001, auto-increment, FY rollover, duplicate warning.
4. GSTIN: regex + mod-36 checksum; derive state code + PAN; auto-fill state. Offline only, no live lookup.
5. Amount in words: INR in Indian system (lakh/crore, paise); foreign currencies in international system with correct major/minor units.
6. Formatting: en-IN grouping for INR, en-US for foreign currency; dates as DD MMM YYYY (unambiguous for foreign clients).
7. Optional lines below total: "Less: TDS" (presets 10% professional, 2% technical, custom; base = taxable value excluding GST) and "Less: Advance received" → "Net receivable". UI label is just "TDS"; content explains 194J → Section 393(1), Income-tax Act 2025, from 1 Apr 2026.
8. UPI QR (INR only): upi://pay?pa=&pn=&am=&cu=INR&tn=<invoice no>, properly encoded. Above ₹1,00,000 warn (P2P UPI daily cap) and point to bank transfer.
9. Export: USD/EUR/GBP/AUD/CAD/SGD/AED, client country, SWIFT/IBAN/routing, manual exchange rate + source/date → INR equivalent printed on invoice.
10. Other fields: due date + terms (on receipt / Net 7/15/30); SAC picker seeded with 998314, 998313, 998391, 998383, 998395, 998361 + free text (TODO(verify) against CBIC SAC list); reverse charge "No" on tax invoices; optional Udyam number + "Payable within 45 days as per MSMED Act, 2006"; signature image or "Authorised Signatory".
11. Out of scope (say so in FAQ): e-invoicing/IRN (only above ₹5 cr turnover), e-way bills, GST return filing.

## MVP features
- Editor, mobile-first: Edit/Preview tabs on mobile, side-by-side on desktop. Saved business profile + clients; line items (description, SAC, qty, unit: hour/day/project/word/month, rate, discount); notes/terms; bank + UPI; logo resized client-side to ≤200 KB; 2 templates + accent colour.
- HTML preview and PDF render from one computed view-model so numbers can never diverge.
- Actions: Download PDF, Print, Share (Web Share API with the PDF → WhatsApp; fallback: download + wa.me link with prefilled message incl. amount and UPI link), Duplicate, New.
- History: Draft/Sent/Paid/Overdue, mark paid, "Copy payment reminder" (polite/firm), "Add reminder" (Google Calendar URL + .ics).
- Backup nudge: data lives only on this device; prompt JSON export every 5 invoices; show last-backup date.
- PDF footer "Made free with <BRAND>": ON by default, one-tap OFF, no guilt copy.
- Support card: after the first successful download, a dismissible non-modal card "Saved you time? Buy me a chai" with ₹49 / ₹99 / ₹199 / custom → UPI intent link on mobile, QR on desktop (VPA + name from env). Max once per 5 downloads, plus a quiet footer link. Never block or delay a download.

## SEO architecture
Every page: static HTML, unique title (≤60 chars) + meta description (≤155), one H1, canonical, breadcrumb, 600–1500 words of genuinely unique content, FAQ, internal links. Tool pages: editor above the fold, content below. Write for a freelancer on a phone: short paragraphs, worked ₹ examples.
- Tool pages (preconfigured editor): /, /invoice-without-gst, /gst-invoice-generator, /export-invoice-lut.
- Profession pages /invoice-format/[slug] (content collection): realistic line items, SAC, typical TDS, pricing unit, profession FAQs, sample invoice rendered as static HTML via the preview component. Start: photographer (advance + balance), video-editor, content-writer, graphic-designer, web-developer. No thin or near-duplicate pages.
- Micro-tools: /tds-calculator (Income-tax Act 2025), /amount-in-words, /gst-calculator, /upi-qr-generator, /gstin-validator (offline decode).
- Guides /guides/[slug] with author box, last-updated date, sources, optional reviewedBy: TDS on freelancer payments (194J → Section 393), invoicing foreign clients (LUT, INR equivalent, FIRA), GST registration for freelancers, invoice numbering rules, MSME 45-day rule.
- Technical: lang="en-IN", sitemap, robots.txt (allow search + AI crawlers), JSON-LD (WebSite + Organization site-wide; SoftwareApplication price 0 on tool pages; BreadcrumbList; Article on guides; FAQPage where FAQs exist). No content that appears only after JS. Hub-and-spoke internal links. Custom 404. One OG image per page type.
- Budgets (Lighthouse CI mobile, fail CI if missed): LCP < 2.0 s, INP < 200 ms, CLS < 0.05; JS ≤ 50 KB gz on content pages, ≤ 150 KB gz on tool pages excluding the lazy PDF chunk; self-hosted fonts; no third-party scripts beyond analytics.
- Privacy/security: strict CSP (self + analytics beacon only); no invoice data in any network request. Privacy, Terms, About, Contact pages; "not tax advice" disclaimer.
- Accessibility: labelled inputs, keyboard support, 44 px tap targets, AA contrast.

## Milestones
M0 Scaffold, CLAUDE.md, CI (typecheck, lint, test, build, Lighthouse), deploy to Cloudflare Pages.
M1 Domain lib + tests: every tax mode incl. UT + export, rounding, words (0, 0.50, 99.99, 1,00,000, 1,23,45,678.50, 10 crore+, USD cents), GSTIN checksum, numbering + FY rollover, UPI URI encoding.
M2 Editor, preview, PDF, persistence, share, UPI QR.
M3 SEO: 4 tool pages, 5 profession pages, TDS calculator, amount-in-words, 2 guides (TDS, foreign clients), sitemap, schema.
M4 History + reminders, support card, legal pages, launch checklist (GSC + Bing verification, sitemap submission).
Backlog (don't build until asked): quotation/proforma/receipt, blank Word/Excel/PDF templates, PWA offline, shareable invoice link (data in URL #fragment + pay button), invoice register CSV/XLSX for CA/GSTR-1, PNG export, Hindi UI, anonymous download counter.

## Non-goals
Accounts, cloud sync, payment processing, goods/inventory, e-invoicing, GST filing, ads, cookie banner.

## Config
BRAND_NAME, SITE_URL, DONATION_UPI_VPA, DONATION_PAYEE_NAME, CONTACT_EMAIL.
