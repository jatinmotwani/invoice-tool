# Plan

Status: **PROPOSED, waiting for the owner's OK.** Once approved, tick off tasks here as they land.

Each task is sized for one ~1 hr session. It ends with `npm run check` green and a single commit.
Estimate: about 41 sessions (M0 4, M1 7, M2 12, M3 13, M4 5).

## Workflow
- Work happens on a branch, with one PR per milestone into `main`. Cloudflare Pages deploys `main` as production and every other branch as a preview.
- The site sends `noindex` until the `SITE_INDEXABLE=true` flag is set at launch (T4.5), so search engines can't index a half-built site. Preview `*.pages.dev` URLs never get indexed.
- Content is drafted by Claude and fact-checked by the owner. Every tax or legal claim either cites a source or carries a `TODO(verify)`.

## Architecture
```
src/lib/invoice/   pure domain: money, format, words, currencies, states, gstin, tax-mode,
                   totals, fy, numbering, upi, tds, sac, schema, view-model
src/lib/db/        Dexie schema + migrations, repositories, backup import/export
src/components/
  editor/          React island (client:load on tool pages only)
  preview/         InvoicePreview.tsx: pure render of the view-model; SSR-only (0 JS) on profession pages
  pdf/             InvoicePdf.tsx: lazy chunk, same view-model
src/content/       professions/, guides/ (content collections with zod schemas)
public/            _headers (CSP etc.), fonts/ (PDF font subset + OFL licence), og/
scripts/           check-budget.mjs, check-seo.mjs
tests/e2e/         Playwright
```

## M0: Scaffold, CI, deploy
- [ ] **T0.1 Scaffold.**
  - Astro 7 + React + Tailwind 4 + TS strict.
  - `astro:env` schema for the config vars, plus `.env.example`.
  - Base layout: `lang="en-IN"`, title/description/canonical props, placeholders for GSC and Bing verification meta tags, system font stack.
  - Placeholder home page and custom 404.
  - Vitest wired up. The first real test covers the half-up rounding helper.
- [ ] **T0.2 Lint + CI.**
  - Lint/format setup (see decision 1 below).
  - `.nvmrc`.
  - GitHub Actions workflow: `npm ci`, then `npm run check`.
  - SessionStart hook in `.claude/settings.json` that runs `npm ci`, so fresh cloud sessions can run the checks.
- [ ] **T0.3 Quality gates.**
  - Playwright projects: Pixel 7 + Desktop Chrome. A smoke test runs against the built site.
  - `check-budget.mjs`: gzips every JS file a page loads eagerly (island + renderer + static imports, excluding dynamic chunks). Fails over 50 KB on content pages or 150 KB on tool pages.
  - LHCI mobile assertions: LCP ≤ 2000 ms, CLS ≤ 0.05, TBT ≤ 200 ms. TBT stands in for INP because lab runs can't measure INP; field INP comes from CF Web Analytics.
  - All of the above added to CI.
- [ ] **T0.4 Security + deploy.**
  - `_headers`: CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`.
  - Spike: confirm a trivial React island hydrates under a strict CSP with no `unsafe-inline`. Use Astro's built-in CSP hashing if v7 supports it; otherwise write a post-build hash step.
  - `robots.txt`.
  - The `SITE_INDEXABLE` noindex switch.
  - Cloudflare Pages via Git integration. The owner connects the repo once; Claude supplies the exact build settings.
  - CF Web Analytics through Pages auto-injection, so no token lives in the repo. The CSP allows only its beacon.

## M1: Domain library (pure, fully unit-tested)
- [ ] **T1.1 Money + formatting.**
  - Types for paise/minor units, basis points and milli-quantities.
  - BigInt multiply/divide with half-up rounding.
  - INR formatting with en-IN grouping; foreign-currency formatting with en-US grouping.
  - Dates as `DD MMM YYYY`.
  - Currency table: code, symbol, major/minor unit names, minor digits.
- [ ] **T1.2 Amount in words.**
  - INR in the Indian system (lakh/crore, paise); other currencies in the international system with the correct units.
  - Required cases: 0, 0.50, 99.99, 1,00,000, 1,23,45,678.50, 10 crore+, USD cents. Also singular/plural forms.
- [ ] **T1.3 States + GSTIN.**
  - State/UT code table with a flag for UTs without a legislature (source cited).
  - GSTIN regex and mod-36 checksum. Decode to state + PAN + entity number; normalise input.
  - PAN regex.
- [ ] **T1.4 Tax-mode resolver + input schema.**
  - Versioned zod `InvoiceInput`.
  - Resolver returns mode, title, tax kinds, place of supply, endorsement and LUT visibility.
  - Manual place-of-supply override.
  - Table-driven tests: all 5 modes, UTGST UTs, unregistered supplier + foreign client.
- [ ] **T1.5 Totals + view-model.**
  - Line amount = qty × rate − discount.
  - Rate groups. CGST and SGST/UTGST each computed on the taxable value; IGST.
  - Optional round-off, TDS (base excludes GST), advance, net receivable, INR equivalent.
  - `buildInvoiceView()` returns every formatted string the renderers need.
  - Reconciliation tests: every total equals the sum of its parts.
- [ ] **T1.6 FY + numbering.**
  - Financial year from a date.
  - Series template with an FY token (`INV/26-27/001`); next number keeps the zero padding; rollover on a new FY.
  - Validation: ≤ 16 chars, allowed charset; duplicate detection within the FY.
  - Tests around the 31 Mar / 1 Apr boundary.
- [ ] **T1.7 UPI, TDS, terms, SAC.**
  - UPI URI builder (encoding, 2-dp amount, INR only) and the ₹1 lakh warning flag.
  - TDS presets.
  - Due date from payment terms.
  - SAC seed list.
  - Coverage of `src/lib/invoice` ≥ 95%.

## M2: Editor, preview, PDF, persistence
- [ ] **T2.1 Dexie DB.** Schema v1 (profile, clients, invoices, counters, settings), migration harness, `storage.persist()`, repositories. Tests use fake-indexeddb.
- [ ] **T2.2 Editor shell.**
  - Island on `/`: Edit/Preview tabs on mobile, split view on desktop.
  - Reducer-based state; debounced autosave of drafts.
  - The server-rendered default must be the same size as the hydrated editor, so there's no layout shift (CLS).
- [ ] **T2.3 Profile + client forms.** GSTIN auto-fills state and PAN. Registered toggle, country select, and a live badge showing the tax mode.
- [ ] **T2.4 Line items.** SAC picker (datalist + free text), qty, unit, rate, discount, GST rate per line. Keyboard add/remove. Notes/terms and due-date terms.
- [ ] **T2.5 HTML preview (template A).** Renders from the view-model. Print CSS (A4 `@page`) and the Print action.
- [ ] **T2.6 PDF.**
  - react-pdf document that mirrors template A, behind a lazy `import()`.
  - Noto Sans Regular/Bold subset (Latin + ₹), A4, selectable text.
  - Confirm the lazy chunk stays out of the budget and works under the CSP (yoga may need `wasm-unsafe-eval`).
- [ ] **T2.7 Export + LUT.**
  - Currency, SWIFT/IBAN/routing, exchange rate + source/date, and the INR equivalent.
  - LUT ARN + FY and the endorsement. LUT stays hidden when the supplier is unregistered.
- [ ] **T2.8 Payments.** Bank + UPI, QR code (lazy-loaded `qrcode`) in both preview and PDF, ₹1 lakh warning, TDS and advance lines.
- [ ] **T2.9 Branding.**
  - Logo resized on a canvas to ≤ 200 KB PNG/JPEG. react-pdf can't embed WebP.
  - Signature image, template B, accent colour, footer toggle.
- [ ] **T2.10 Actions.** Numbering + duplicate warning. Share via Web Share with the PDF file; fallback is download + a `wa.me` link. Duplicate, New.
- [ ] **T2.11 Backup.** JSON export/import (zod-validated, versioned, merge or replace). Nudge every 5 invoices; show the last-backup date.
- [ ] **T2.12 E2E.** All three situations on mobile + desktop. Budget check on `/`.

## M3: SEO
- [ ] **T3.1 SEO infrastructure.**
  - `<Seo>` component that fails the build when a title or description is over its limit.
  - Breadcrumb UI + BreadcrumbList. JSON-LD for WebSite, Organization, SoftwareApplication and FAQPage.
  - Hand-rolled `sitemap.xml` endpoint.
  - `robots.txt` that allows search and AI crawlers.
  - `check-seo.mjs` over dist: exactly one H1, canonical present, titles unique, 600–1500 words, valid JSON-LD, internal links resolve.
- [ ] **T3.2 Home page.** Tool page template with editor presets, plus the `/` content.
- [ ] **T3.3** `/invoice-without-gst`
- [ ] **T3.4** `/gst-invoice-generator`
- [ ] **T3.5** `/export-invoice-lut`
- [ ] **T3.6 Professions (first page).** Collection schema, page template, and a sample invoice through the SSR preview (0 JS). First page: photographer (advance + balance).
- [ ] **T3.7** video-editor, content-writer
- [ ] **T3.8** graphic-designer, web-developer, plus the `/invoice-format` hub
- [ ] **T3.9** `/tds-calculator`: vanilla TS that reuses the domain lib.
- [ ] **T3.10** `/amount-in-words`
- [ ] **T3.11 TDS guide.** Guide layout (author box, last updated, sources, reviewedBy, Article JSON-LD) and the TDS guide itself.
- [ ] **T3.12 Foreign-clients guide.** The guide plus the `/guides` hub.
- [ ] **T3.13 Final SEO pass.**
  - One OG image per page type, generated once with a Playwright script and committed.
  - Internal-link audit.
  - Lighthouse run over all pages.

## M4: History, support, legal, launch
- [ ] **T4.1 History.** Draft/Sent/Paid are stored; Overdue is derived. Filters, mark sent/paid.
- [ ] **T4.2 Reminders.**
  - Polite and firm reminder text.
  - Google Calendar URL and `.ics` generator (pure functions + tests).
- [ ] **T4.3 Support card.**
  - UPI intent link on mobile, QR on desktop.
  - Shows at most once per 5 downloads; plus a footer link.
  - Never blocks or delays a download.
- [ ] **T4.4 Legal pages.**
  - Privacy, Terms, About, Contact, and the not-tax-advice disclaimer.
  - The Privacy page explains that WhatsApp and Calendar links are user-initiated and leave the device.
- [ ] **T4.5 Launch.**
  - Flip `SITE_INDEXABLE`.
  - GSC + Bing verification.
  - `docs/LAUNCH.md` checklist (sitemap submission etc.).
  - Final CSP, performance and accessibility audit.

## Proposed M5 (after launch, only if approved)
The remaining SEO-section items:
- Micro-tools: `/gst-calculator`, `/upi-qr-generator`, `/gstin-validator`. These are cheap because the domain lib already exists.
- Guides: GST registration, invoice numbering rules, MSME 45-day rule.

## Dependencies
- **Implied by the spec:** astro, @astrojs/react, react, react-dom, typescript (pinned 6.x), tailwindcss, @tailwindcss/vite, dexie, @react-pdf/renderer, qrcode, zod, vitest, @playwright/test, @lhci/cli.
- **Need the owner's OK:**
  - @astrojs/check (typechecks `.astro` files)
  - @types/react, @types/react-dom, @types/qrcode
  - The lint/format set (decision 1)
  - fake-indexeddb (dev; tests Dexie migrations in Node)
  - @axe-core/playwright (dev; automated accessibility checks in e2e)
- **Assets:** Noto Sans TTF subset with its OFL licence, committed. It's subset once with `pyftsubset`, a local tool that isn't a project dependency.
- **Deliberately not added:** @astrojs/sitemap (hand-rolled), dexie-react-hooks, form/date/icon libraries (icons are inline SVG).

## Risks and mitigations
- **150 KB JS budget on tool pages.** React + react-dom is about 60 KB gz and Dexie about 30 KB gz. Mitigations: lazy-load `qrcode`, use `zod/mini` on the client, and measure every commit from T0.3.
- **Strict CSP vs Astro's inline hydration script and react-pdf's WASM layout engine.** Spiked in T0.4 and T2.6.
- **Lighthouse can't measure INP.** Gate on TBT in the lab and watch INP in the field with CF Web Analytics.
- **Layout shift when saved data loads from IndexedDB.** The SSR default must match the hydrated editor's size (T2.2).
- **Browser storage eviction, especially on iOS.** Mitigations: `storage.persist()`, the backup nudge, and an honest "data lives on this device" message.

## Tax/legal items to verify (default: coded as `TODO(verify)`)
- **Rule 46 endorsement text** (CGST Rules, cbic-gst.gov.in). From memory, the rule says "SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX", with "… ON PAYMENT OF INTEGRATED TAX" for the IGST route. That means:
  - The brief's wording is a shortened form.
  - EXPORT_IGST probably needs its own endorsement too.

  Check this against the official text before coding.
- **State code 25** (Daman & Diu before the 2020 merger into code 26). Should the decoder accept it, and should it be treated as a UTGST UT?
- **GST rate presets beyond the 18% default.** Only add them once a CBIC notification is cited; until then the rate field is free input.
- **Income-tax Act 2025.** The Section 393(1) mapping and the 10% / 2% rates need an incometax.gov.in citation.
- **UPI cap.** The ₹1 lakh P2P limit and its wording need an npci.org.in citation.
- **SAC seed codes and descriptions.** Check against the CBIC SAC list.
- **Place of supply.** Domestic services use the client's state (IGST Act s.12(2)), with a manual override. Special place-of-supply rules (events, immovable property) are out of scope and get an FAQ answer.
