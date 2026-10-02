import '../styles/globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { useEffect } from 'react'
import { poppins, inter } from '../lib/fonts'

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
      {/* The variable classes below only need to exist somewhere in the
          rendered tree so next/font emits the @font-face rules into the
          build's CSS — font-family lookups elsewhere use the literal
          "Poppins"/"Inter" names directly (see globals.css), since
          @font-face registration is global and not scoped to this div. */}
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
