import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Sidebar from './Sidebar'
import { useBusinessStatus } from '../lib/businessGate'
import { clerkEnabled, clerkOrFallbackMessage } from '../lib/clerk'

// The single gate every real dashboard page goes through: no Clerk session ->
// /register, a session with no business yet -> /onboarding, otherwise the
// Sidebar + the page's own content. Nothing dashboard-shaped renders before
// both checks pass — a business that's never signed in has nothing for a
// CFO dashboard to show anyway.
export default function Protected({ children }) {
  const router = useRouter()
  const { isLoaded, isSignedIn, loading, hasBusiness } = useBusinessStatus()
  const ready = clerkEnabled && isLoaded && isSignedIn && !loading && hasBusiness === true

  useEffect(() => {
    if (!clerkEnabled || !isLoaded) return
    if (!isSignedIn) { router.replace('/register'); return }
    if (!loading && hasBusiness === false) router.replace('/onboarding')
  }, [isLoaded, isSignedIn, loading, hasBusiness, router])

  if (!clerkEnabled) return <BrandLoader message={clerkOrFallbackMessage()} />
  if (!ready) return <BrandLoader message="Loading your workspace…" />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  )
}

export function BrandLoader({ message }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, background: 'var(--bg)',
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--balance-pink)',
            animation: 'debbit-pulse 1.1s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{message}</div>
      <style jsx>{`
        @keyframes debbit-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
