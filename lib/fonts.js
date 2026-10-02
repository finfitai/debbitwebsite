import { Poppins, Inter } from 'next/font/google'

// Self-hosted via next/font (downloaded at build time, served from /_next/static
// — same-origin) rather than a runtime @import from fonts.googleapis.com: the
// app's CSP (next.config.js) only allows style-src 'self' 'unsafe-inline', so
// an external @import would be silently blocked by the browser, and with it
// (depending on how the dev-mode style-loader touches the blocked stylesheet)
// the REST of globals.css along with it. next/font sidesteps this entirely —
// no external request at runtime, no CSP change needed.
export const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins', display: 'swap' })
export const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' })
