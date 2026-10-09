import { useEffect } from 'react'
import { useRouter } from 'next/router'
import AuthShell from '../../components/AuthShell'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../../lib/clerk'
import { clerkAppearance } from '../../components/clerkAppearance'
import { SignIn } from '@clerk/nextjs'

const card = { background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, padding: 26 }

export default function LoginPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const inviteToken = router.query.invite_token
    // A returning user with no business yet (shouldn't normally happen, but
    // e.g. a half-finished signup) is caught by /dashboard's own Protected
    // gate and bounced to /onboarding — no need to duplicate that check here.
    router.replace(inviteToken ? { pathname: '/register', query: router.query } : '/dashboard')
  }, [isLoaded, isSignedIn, router])

  return (
    <AuthShell eyebrow="Cloud login" title="Welcome back" subtitle="Sign in to manage your business, invite staff, and check on your trial.">
      {!clerkEnabled ? (
        <div style={card}>{clerkOrFallbackMessage()}</div>
      ) : (
        <>
          <section style={{ ...card, minHeight: 480, background: '#3a1552' }}>
            <SignIn routing='path' path='/login' signUpUrl='/register' afterSignInUrl='/dashboard' afterSignUpUrl='/register' appearance={clerkAppearance} />
          </section>
          <p style={{ margin: '14px 4px 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Forgot your dashboard password? <a href='/forgot-password' style={{ color: 'var(--balance-pink)', fontWeight: 600 }}>Reset it by email</a>.
          </p>
          {router.query.invite_token ? (
            <div style={{ marginTop: 16, padding: 14, border: '1px solid var(--panel-border)', borderRadius: 12, background: 'var(--midnight-ink)', fontSize: 12, color: 'var(--text-muted)' }}>
              Invite token detected. Sign in with the invited email, then continue to registration for invite acceptance.
            </div>
          ) : null}
        </>
      )}
    </AuthShell>
  )
}
