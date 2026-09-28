# CLAUDE.md

Free, no-signup invoice tool for Indian freelancers. Static site, all data stays in the browser.
Spec: `docs/SPEC.md` (source of truth). Plan and task list: `docs/PLAN.md`.

## Current milestone

**M2 (editor).** M0 and M1 are done. Still waiting on the owner: the one-time Cloudflare Pages setup (`docs/DEPLOY.md`) and the tax fact review (`docs/VERIFY.md`). Next task: see `docs/PLAN.md`.

## Stack

- Astro 7 (static output) with a single React 19 island (`@astrojs/react`) for the editor. Content pages ship zero JS.
- TypeScript strict. Pin TS 6.x because `@astrojs/check` doesn't support TS 7 yet.
- Tailwind 4 (`@tailwindcss/vite`), system font stack for the UI.
- Dexie 4 (IndexedDB), zod 4, qrcode.
- @react-pdf/renderer 4, loaded with a dynamic `import()` only on the first PDF action. The Noto Sans subset font (includes ₹) is fetched only then.
- Vitest (domain), Playwright (e2e, mobile + desktop), Lighthouse CI (mobile).
- Hosting: Cloudflare Pages (`docs/DEPLOY.md`). CSP comes from Astro's `security.csp` (a hashed `<meta>` tag); other security headers are in `public/_headers`. Cloudflare Web Analytics is the only third-party script.
- CSP rules: no inline `style=""` attributes (set dynamic styles through the CSSOM), no Shiki, no third-party hosts beyond the analytics beacon.
- Node ≥ 22.12.

## Commands (created in M0)

```
npm run dev          # local dev server
npm run build        # static build -> dist/
npm run typecheck    # astro check + tsc --noEmit
npm run lint         # lint + format check
npm test             # vitest + coverage thresholds (domain)
npm run check        # typecheck + lint + test + build: the "green" gate for every commit
npm run test:e2e     # playwright (needs a build)
npm run budget       # JS size budget check over dist/
npm run lhci         # lighthouse CI (mobile) over dist/
npm run serve        # serve dist/ like Cloudflare Pages (clean URLs, 404, _headers)
```

In cloud sessions the SessionStart hook sets `PW_CHROMIUM_EXECUTABLE` and `CHROME_PATH` to the pre-installed Chromium.

## Conventions

- **Every task ends green** (`npm run check`) and gets its own commit. Keep tasks small enough to finish in one session.
- **Ask before adding any dependency** that isn't in SPEC.md or already approved in PLAN.md.
- **Tax/legal:** never invent rates, section numbers, codes or wording. Cite an official source (cbic-gst.gov.in, incometax.gov.in, npci.org.in) in a comment or frontmatter, or mark it `TODO(verify)`.
- **Money:** integer paise, or integer minor units for foreign currency. Never use floats for money. Tax rates are basis points. Quantities are integer thousandths. Multiply with BigInt, then use the one shared half-up rounding helper.
- **Dates:** store as `YYYY-MM-DD` calendar strings. Display as `DD MMM YYYY` using our own month table, not Intl month names, which vary by ICU version ("Sep" vs "Sept"). The financial year runs Apr–Mar.
- **Domain logic** goes in `src/lib/invoice`: pure functions, no DOM or Dexie imports, fully unit-tested.
- **One view-model** (`buildInvoiceView`) feeds the HTML preview, the PDF and print. Never recompute numbers in a renderer.
- **Privacy:** invoice data never goes into a network request, URL or analytics. No cookies.
- **Content pages:** static HTML, one H1, title ≤ 60 chars, description ≤ 155. Content must never depend on JS. Micro-tools use small vanilla `<script>`s, not React.
- **Config:** use `astro:env` (`BRAND_NAME`, `SITE_URL`, `DONATION_UPI_VPA`, `DONATION_PAYEE_NAME`, `CONTACT_EMAIL`) with defaults in `.env.example`. Never hard-code the brand.
- **Accessibility:** every input has a label, tap targets are ≥ 44 px, contrast meets AA, and everything works by keyboard.
