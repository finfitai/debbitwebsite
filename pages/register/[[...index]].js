import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import AuthShell from '../../components/AuthShell'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../../lib/clerk'
import { SignUp } from '@clerk/nextjs'
import { clerkAppearance } from '../../components/clerkAppearance'

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
    <AuthShell
      eyebrow="Start your free trial"
      title="Create your account"
      subtitle="Sign up with Google or email — a full month of access, no card required to start."
    >
      {!clerkEnabled ? (
        <div style={card}>{clerkOrFallbackMessage()}</div>
      ) : isSignedIn ? (
        <div style={card}>Taking you to business setup…</div>
      ) : (
        <section style={{ ...card, minHeight: 480, background: '#3a1552' }}>
          <SignUp routing='path' path='/register' signInUrl='/login' afterSignUpUrl={onboardingUrl} appearance={clerkAppearance} />
        </section>
      )}
    </AuthShell>
  )
}
