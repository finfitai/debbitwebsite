module.exports = {
  // The marketing homepage (public/index.html, with its scripts, styles,
  // translations and logos in public/site and public/brand; plain static files,
  // no build step of its own) is served at '/' via this rewrite rather than a page, since the dashboard
  // app's own pages need the real Next.js router for everything else.
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      // Proxies the Windows installer from Vercel Blob storage so the
      // download URL (and the save-as filename, which browsers take from
      // the last path segment when there's no Content-Disposition override)
      // stays on debbit.org instead of exposing the blob storage domain.
      { source: '/downloads/debbit-os-setup-windows.exe', destination: 'https://iegnplnlwt8lufvf.public.blob.vercel-storage.com/debbit-os-setup-windows.exe' },
    ]
  },

  async headers() {
    return [
      // Catch-all: the dashboard app's strict CSP (no unsafe-eval, no wildcard
      // script-src) applies everywhere by default.
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://clerk.browser.convex.cloud https://*.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.clerk.accounts.dev https://challenges.cloudflare.com wss://*.supabase.co; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob:; frame-ancestors 'none'",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // '/' only: the homepage (public/index.html + public/site/*) loads its own
      // scripts from 'self', Google Fonts, and the cal.com booking popup. No
      // unsafe-eval and no inline scripts. Declared AFTER the catch-all on
      // purpose: Next.js resolves a header key from the LAST matching rule, so
      // '/' gets this policy while every other route keeps the strict one above.
      {
        source: '/',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' https://app.cal.com https://cal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.cal.com; font-src 'self' https://fonts.gstatic.com https://app.cal.com https://cal.com; img-src 'self' data: blob: https:; connect-src 'self' https://app.cal.com https://cal.com https://*.cal.com; frame-src https://app.cal.com https://cal.com; worker-src 'self' blob:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ]
  },
}
