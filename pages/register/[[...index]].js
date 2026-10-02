import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import Sidebar from '../../components/Sidebar'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../../lib/clerk'
import { SignUp } from '@clerk/nextjs'
import { clerkAppearance } from '../../components/clerkAppearance'
import { EqualsMark } from '../../components/ui'

const card = { background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, padding: 26 }

// Plain Clerk sign-up — Google or email, nothing else on this screen. Business
// details, country/tax regime and the desktop password all live on /onboarding,
// which this redirects to once a Clerk session exists (fresh sign-up, or an
// already-signed-in visitor landing here directly). Query params (invite_token,
// the marketing site's ?country=&industry= quiz) are carried straight through.
export default function RegisterPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()

  const onboardingUrl = useMemo(() => {
    const qs = new URLSearchParams()
    Object.entries(router.query).forEach(([key, value]) => {
      if (typeof value === 'string') qs.set(key, value)
    })
    const query = qs.toString()
    return `/onboarding${query ? `?${query}` : ''}`
  }, [router.query])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    router.replace(onboardingUrl)
  }, [isLoaded, isSignedIn, onboardingUrl, router])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px 36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 460, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <EqualsMark />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--balance-pink)' }}>
              Start your free trial
            </span>
          </div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)' }}>
            Your books. Balanced. Automatically.
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15, lineHeight: 1.6 }}>
            Sign up with Google or email — a full month of access, no card required to start.
          </p>

          {!clerkEnabled ? (
            <div style={card}>{clerkOrFallbackMessage()}</div>
          ) : isSignedIn ? (
            <div style={card}>Taking you to business setup…</div>
          ) : (
            <section style={{ ...card, minHeight: 540, background: '#3a1552' }}>
              <SignUp routing='path' path='/register' signInUrl='/login' afterSignUpUrl={onboardingUrl} appearance={clerkAppearance} />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
