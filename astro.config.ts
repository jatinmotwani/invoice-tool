import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

// `site` is needed at config time (canonical URLs, sitemap), before astro:env is available.
const SITE_URL = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  // /invoice-without-gst -> invoice-without-gst.html; Cloudflare Pages serves it without a trailing slash.
  build: { format: 'file' },
  trailingSlash: 'never',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
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
