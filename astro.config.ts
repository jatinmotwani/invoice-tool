import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

// `site` is needed at config time (canonical URLs, sitemap), before astro:env is available.
const SITE_URL = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  // /invoice-without-gst -> invoice-without-gst.html; Cloudflare Pages serves it without a trailing slash.
  // Inline the (small) Tailwind CSS: removes the only render-blocking request. The CSP hashes it.
  build: { format: 'file', inlineStylesheets: 'always' },
  trailingSlash: 'never',
  integrations: [react()],
  // Shiki emits inline styles, which the strict CSP forbids; guides don't need code highlighting.
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [tailwindcss()],
    // react-pdf's chunk (~440 KB gz) is expected: it loads only when a PDF is made. Page JS is budgeted separately.
    build: { chunkSizeWarningLimit: 1600 },
  },
  // Strict CSP as a <meta> tag with hashes for every script/style Astro emits (no 'unsafe-inline').
  // frame-ancestors can't be set from <meta>; it lives in public/_headers with the other security headers.
  // The only third party is the Cloudflare Web Analytics beacon (auto-injected by Cloudflare Pages).
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        // data: lets react-pdf's WASM loader fetch its inlined binary (no network access involved).
        "connect-src 'self' data: https://cloudflareinsights.com",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // 'wasm-unsafe-eval' lets react-pdf's layout engine (yoga, WebAssembly) compile. It does not allow JS eval.
      scriptDirective: {
        resources: ["'self'", "'wasm-unsafe-eval'", 'https://static.cloudflareinsights.com'],
      },
      styleDirective: { resources: ["'self'"] },
    },
  },
  env: {
    schema: {
      BRAND_NAME: envField.string({ context: 'client', access: 'public', default: 'YourBrand' }),
      SITE_URL: envField.string({
        context: 'server',
        access: 'public',
        url: true,
        default: 'https://example.com',
      }),
      CONTACT_EMAIL: envField.string({ context: 'server', access: 'public', default: 'hello@example.com' }),
      DONATION_UPI_VPA: envField.string({ context: 'client', access: 'public', default: '' }),
      DONATION_PAYEE_NAME: envField.string({ context: 'client', access: 'public', default: '' }),
      // Keep the site out of search indexes until launch (T4.5).
      SITE_INDEXABLE: envField.boolean({ context: 'server', access: 'public', default: false }),
      // Search-engine ownership verification tokens (meta tags render only when set).
      GOOGLE_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
      BING_SITE_VERIFICATION: envField.string({ context: 'server', access: 'public', optional: true }),
    },
  },
});
