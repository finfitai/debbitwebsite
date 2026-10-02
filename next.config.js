module.exports = {
  // The marketing homepage (public/index.html — a self-contained Artifact-style
  // bundle: React+Babel-standalone loaded at runtime, no build step of its own)
  // is served at '/' via this rewrite rather than a page, since the dashboard
  // app's own pages need the real Next.js router for everything else.
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://clerk.browser.convex.cloud https://*.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.clerk.accounts.dev https://challenges.cloudflare.com wss://*.supabase.co; frame-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'",
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
      // '/' only: the marketing bundle needs unsafe-eval (runtime Babel) and a
      // wide script-src (unpkg.com for React, app.cal.com for the demo-booking
      // embed). This entry is declared AFTER the catch-all on purpose — Next.js
      // resolves a header key from the LAST matching rule, so '/' ends up with
      // this permissive policy while every other route keeps the strict one
      // above. Do not reorder this without keeping that in mind.
      {
        source: '/',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob: *; frame-src blob: *;",
          },
        ],
      },
    ]
  },
}
