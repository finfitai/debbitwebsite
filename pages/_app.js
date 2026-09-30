import '../styles/globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { useEffect } from 'react'
import { Poppins, Inter } from 'next/font/google'

// Self-hosted via next/font (downloaded at build time, served from /_next/static
// — same-origin) rather than a runtime @import from fonts.googleapis.com: the
// app's CSP (next.config.js) only allows style-src 'self' 'unsafe-inline', so
// an external @import would be silently blocked by the browser, and with it
// (depending on how the dev-mode style-loader touches the blocked stylesheet)
// the REST of globals.css along with it. next/font sidesteps this entirely —
// no external request at runtime, no CSP change needed.
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' })

// Force body visible after 3s if Clerk fails to init (e.g. IP-based access, blocked CDN)
function ClerkFoucFix() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (document.body) document.body.style.display = 'block'
    }, 3000)
    return () => clearTimeout(t)
  }, [])
  return null
}

export default function App({ Component, pageProps }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const body = (
    <>
      <ClerkFoucFix />
      <div className={`${poppins.variable} ${inter.variable}`}>
        <Component {...pageProps} />
      </div>
    </>
  )

  // @clerk/clerk-react throws synchronously when publishableKey is missing —
  // during `next build`'s static-page prerendering this isn't a runtime UI
  // concern, it fails the whole build (see lib/clerk.js for the matching
  // useAuth/useUser fallback pages rely on to stay renderable either way).
  if (!publishableKey) return body

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/register"
    >
      {body}
    </ClerkProvider>
  )
}
