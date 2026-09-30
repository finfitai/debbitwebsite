import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { useRouter } from 'next/router'
import { SignIn, useAuth, useUser } from '@clerk/nextjs'
import { clerkEnabled, clerkOrFallbackMessage } from '../lib/clerk'
import { clerkAppearance } from '../components/clerkAppearance'
import { EqualsMark } from '../components/ui'

const card = { background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, padding: 26 }

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

export default function DesktopLinkPage() {
  if (!clerkEnabled) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '40px 36px' }}>
          <div style={{ maxWidth: 980 }}>
            <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)' }}>Desktop link</h1>
            <div style={card}>{clerkOrFallbackMessage()}</div>
          </div>
        </main>
      </div>
    )
  }

  const router = useRouter()
  const { isLoaded, isSignedIn, getToken, sessionId } = useAuth()
  const { user } = useUser()
  const [status, setStatus] = useState('Waiting for Clerk session…')
  const [error, setError] = useState('')
  const submittedRef = useRef(false)

  const bridgePort = useMemo(() => firstQueryValue(router.query.bridge_port), [router.query.bridge_port])
  const bridgeNonce = useMemo(() => firstQueryValue(router.query.bridge_nonce), [router.query.bridge_nonce])
  const businessId = useMemo(() => firstQueryValue(router.query.business_id), [router.query.business_id])

  useEffect(() => {
    if (!clerkEnabled || !isLoaded || !isSignedIn || !bridgePort || !bridgeNonce || submittedRef.current) return
    let cancelled = false

    async function submitToDesktop() {
      try {
        setStatus('Generating secure Clerk session token…')
        const token = await getToken()
        if (!token) throw new Error('Unable to generate Clerk session token')
        if (cancelled) return

        const email = user?.primaryEmailAddress?.emailAddress || ''
        const userId = user?.id || ''
        if (!userId) throw new Error('Signed-in Clerk user id not available')

        const form = document.createElement('form')
        form.method = 'POST'
        form.action = `http://127.0.0.1:${bridgePort}/desktop-link/${bridgeNonce}`
        form.style.display = 'none'

        const fields = {
          token,
          user_id: userId,
          email,
          session_id: sessionId || '',
          business_id: businessId || '',
        }

        Object.entries(fields).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = value || ''
          form.appendChild(input)
        })

        document.body.appendChild(form)
        submittedRef.current = true
        setStatus('Sending verified Clerk session to the local debbit desktop bridge…')
        form.submit()
      } catch (err) {
        if (cancelled) return
        setError(err.message || 'Desktop link failed')
      }
    }

    submitToDesktop()
    return () => {
      cancelled = true
    }
  }, [bridgeNonce, bridgePort, businessId, clerkEnabled, getToken, isLoaded, isSignedIn, sessionId, user])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px 36px' }}>
        <div style={{ maxWidth: 980 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <EqualsMark />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--balance-pink)' }}>Desktop link</span>
          </div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)' }}>Link your desktop app</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
            This page links a signed-in Clerk owner/admin session to a local debbit OS desktop instance.
          </p>

          {!clerkEnabled ? (
            <div style={card}>{clerkOrFallbackMessage()}</div>
          ) : !bridgePort || !bridgeNonce ? (
            <div style={card}>
              Open this page from the desktop app so the browser receives the one-time local bridge parameters.
            </div>
          ) : !isLoaded ? (
            <div style={card}>Loading Clerk session…</div>
          ) : !isSignedIn ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 20 }}>
              <section style={{ ...card, minHeight: 520, background: '#3a1552' }}>
                <SignIn routing='path' path='/desktop-link' afterSignInUrl={router.asPath} appearance={clerkAppearance} />
              </section>
              <section style={card}>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--paper-white)' }}>How this works</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                  Sign in with Clerk here. Once authenticated, this page will generate a Clerk session token and send it to the local debbit desktop bridge running on your machine.
                </div>
              </section>
            </div>
          ) : (
            <div style={card}>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--paper-white)' }}>Linking desktop</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{status}</div>
              {error ? <div style={{ marginTop: 16, color: 'var(--alert-coral)', fontSize: 13 }}>{error}</div> : null}
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                Bridge: localhost:{bridgePort} · Clerk user: {user?.id || 'unknown'}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
