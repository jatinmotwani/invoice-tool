import type { APIRoute } from 'astro';

// Search engines and AI crawlers are all welcome. Pre-launch pages carry a noindex meta tag instead of
// being blocked here, so crawlers can still read it.
export const GET: APIRoute = () =>
  new Response(['User-agent: *', 'Allow: /', ''].join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
