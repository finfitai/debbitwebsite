import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Sidebar from '../components/Sidebar'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../lib/clerk'
import { clerkAppearance } from '../components/clerkAppearance'
import { EqualsMark } from '../components/ui'
import { SignIn } from '@clerk/nextjs'

const card = { background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, padding: 26 }

export default function LoginPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const inviteToken = router.query.invite_token
    router.replace(inviteToken ? { pathname: '/register', query: router.query } : '/dashboard')
  }, [isLoaded, isSignedIn, router])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px 36px' }}>
        <div style={{ maxWidth: 1080 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <EqualsMark />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--balance-pink)' }}>Cloud login</span>
          </div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
            Clerk handles owner and admin web identity. Desktop staff stay on offline PIN auth.
          </p>

          {!clerkEnabled ? (
            <div style={card}>{clerkOrFallbackMessage()}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 20 }}>
              <section style={{ ...card, minHeight: 540, background: '#3a1552' }}>
                <SignIn routing='path' path='/login' signUpUrl='/register' afterSignInUrl='/dashboard' afterSignUpUrl='/register' appearance={clerkAppearance} />
              </section>

              <section style={card}>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--paper-white)' }}>Session policy</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                  Clerk is the identity provider for the dashboard. Supabase still holds tenant data and RLS; the desktop app still uses local PINs for staff offline use.
                </div>
                <div style={{ marginTop: 16 }}>
                  <Link href='/register' style={{ color: 'var(--balance-pink)', textDecoration: 'none', fontWeight: 600, fontSize: 13.5 }}>
                    New owner or invited staff? Register here.
                  </Link>
                </div>
                {router.query.invite_token ? (
                  <div style={{ marginTop: 16, padding: 14, border: '1px solid var(--panel-border)', borderRadius: 12, background: 'var(--midnight-ink)', fontSize: 12, color: 'var(--text-muted)' }}>
                    Invite token detected. Sign in with the invited email, then continue to registration for invite acceptance.
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
