import React, { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import Protected from '../components/Protected'
import { useAuth } from '../lib/clerk'
import { useRouter } from 'next/router'
import { useClerkSupabaseClient } from '../lib/supabase'
import { EqualsMark } from '../components/ui'

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

const card = {
  background: 'var(--panel)',
  border: '1px solid var(--panel-border)',
  borderRadius: 16,
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  maxWidth: 400,
  margin: '0 auto',
}

const buttonStyle = {
  background: 'var(--balance-pink)',
  color: 'var(--debbit-purple)',
  border: 'none',
  padding: '12px 24px',
  borderRadius: 9,
  fontSize: 15,
  fontWeight: 600,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  cursor: 'pointer',
  marginTop: 24,
  width: '100%',
  transition: 'background 0.2s',
}

const STATUS_LABEL = {
  trialing: 'On free trial',
  active: 'Active subscription',
  past_due: 'Payment past due',
  unpaid: 'Payment failed',
  canceled: 'Canceled',
}

export default function UpgradePage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const clerkSupabase = useClerkSupabaseClient()
  const [business, setBusiness] = useState(null)
  const [loadingBusiness, setLoadingBusiness] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check to see if this is a redirect back from Checkout
    const query = new URLSearchParams(window.location.search)
    if (query.get('success')) {
      console.log('Subscription started! You will receive an email receipt.')
    }
    if (query.get('canceled')) {
      console.log('Checkout canceled — you can try again any time.')
    }
  }, [])

  useEffect(() => {
    if (!isSignedIn || !clerkSupabase) { setLoadingBusiness(false); return }
    let cancelled = false
    clerkSupabase
      .from('businesses')
      .select('id, name, subscription_status, trial_ends_at, current_period_end')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        setBusiness(data || null)
        setLoadingBusiness(false)
      })
    return () => { cancelled = true }
  }, [isSignedIn, clerkSupabase])

  const handleCheckout = async () => {
    if (!isSignedIn) {
      router.push('/login')
      return
    }
    if (!business?.id) {
      setError('No business found for this account — complete setup first.')
      return
    }

    setCheckingOut(true)
    setError('')
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: business.id }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Could not start checkout')
        return
      }
      const stripe = await stripePromise
      if (stripe) {
        const { error: redirectError } = await stripe.redirectToCheckout({ sessionId: data.id })
        if (redirectError) setError(redirectError.message)
      }
    } catch (err) {
      setError(err.message || 'Error during checkout')
    } finally {
      setCheckingOut(false)
    }
  }

  const isActive = business?.subscription_status === 'active'
  const trialDaysLeft = business?.subscription_status === 'trialing' && business?.trial_ends_at
    ? Math.ceil((new Date(business.trial_ends_at).getTime() - Date.now()) / 86400000)
    : null

  return (
    <Protected>
      <main style={{ padding: '48px 28px', display: 'flex', justifyContent: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <EqualsMark />
          </div>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, marginBottom: 8, textAlign: 'center', color: 'var(--paper-white)' }}>
            {isActive ? 'Your subscription' : 'Upgrade to Pro'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, textAlign: 'center' }}>
            {!isLoaded || loadingBusiness
              ? ' '
              : business?.subscription_status
                ? STATUS_LABEL[business.subscription_status] || business.subscription_status
                : 'Unlock the full potential of debbit OS.'}
            {trialDaysLeft != null ? ` — ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left` : ''}
          </p>

          <div style={card}>
            <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: 'var(--paper-white)' }}>debbit OS Pro</h2>
            <div className="font-display tabular-nums" style={{ fontSize: 44, fontWeight: 600, marginBottom: 4, color: 'var(--paper-white)' }}>
              $29<span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 400 }}>/month</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Billed monthly · cancel any time</div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%', color: 'var(--text-muted)', lineHeight: 1.9, fontSize: 14 }}>
              <li>✓ Unlimited cloud syncing</li>
              <li>✓ Advanced reporting tools</li>
              <li>✓ Priority email support</li>
              <li>✓ All future updates</li>
            </ul>

            {error && <div style={{ marginTop: 16, color: 'var(--alert-coral)', fontSize: 13 }}>{error}</div>}

            {isActive ? (
              <div style={{ marginTop: 24, padding: '10px 16px', borderRadius: 9, background: 'rgba(47,191,143,0.12)', border: '1px solid rgba(47,191,143,0.35)', color: '#7fe0c4', fontSize: 14, width: '100%', textAlign: 'center' }}>
                You&apos;re all set — subscription active.
              </div>
            ) : (
              <button
                style={buttonStyle}
                onClick={handleCheckout}
                disabled={checkingOut || loadingBusiness}
                onMouseOver={(e) => e.target.style.background = '#e9a3c3'}
                onMouseOut={(e) => e.target.style.background = 'var(--balance-pink)'}
              >
                {checkingOut ? 'Redirecting…' : 'Subscribe with Stripe'}
              </button>
            )}
          </div>
        </div>
      </main>
    </Protected>
  )
}
