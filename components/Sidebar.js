import { useRouter } from 'next/router'
import Link from 'next/link'
import { clerkEnabled, useAuth, useClerk } from '../lib/clerk'

const NAV = [
  { href: '/dashboard', label: 'CFO Overview' },
  { href: '/ops', label: 'Ops Analytics' },
  { href: '/shifts', label: 'Shifts' },
  { href: '/admin', label: 'Admin' },
  { href: '/health', label: 'Health' },
  { href: '/support', label: 'Support' },
]

const LOGGED_OUT_NAV = [
  { href: '/login', label: 'Login' },
  { href: '/register', label: 'Register' },
]

export default function Sidebar() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const clerk = useClerk()
  const nav = isSignedIn ? NAV : [...NAV, ...LOGGED_OUT_NAV]
  return (
    <div style={{
      width: 220, flexShrink: 0, background: 'var(--midnight-ink)',
      borderRight: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column',
      minHeight: '100vh', padding: '24px 0',
    }}>
      <div style={{ padding: '0 20px 22px', borderBottom: '1px solid var(--panel-border)' }}>
        <img src="/debbit-logo-white.png" alt="debbit" style={{ height: 22, width: 'auto', display: 'block' }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '.02em' }}>CFO Dashboard</div>
      </div>
      <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ href, label }) => {
          const active = router.pathname === href
          return (
            <Link key={href} href={href} style={{
              position: 'relative',
              display: 'flex', alignItems: 'center',
              padding: '9px 14px',
              borderRadius: 8,
              background: active ? 'rgba(224,139,176,0.10)' : 'transparent',
              color: active ? 'var(--paper-white)' : 'var(--text-muted)',
              fontWeight: active ? 600 : 400,
              fontSize: 13.5, textDecoration: 'none',
              transition: 'background .15s, color .15s',
            }}>
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 16, borderRadius: 2, background: 'var(--balance-pink)',
                }} />
              )}
              {label}
            </Link>
          )
        })}
      </nav>
      <div style={{ marginTop: 'auto' }}>
        {isSignedIn ? (
          <div style={{ padding: '0 12px 12px' }}>
            <a
              href='/downloads/debbit-os-setup-windows.exe'
              style={{
                display: 'block', width: '100%', padding: '9px 14px', borderRadius: 8, textAlign: 'left',
                background: 'var(--balance-pink)', color: 'var(--debbit-purple)', fontWeight: 600,
                fontSize: 13.5, fontFamily: 'var(--font-body)', textDecoration: 'none', boxSizing: 'border-box',
              }}
            >
              Download debbit OS
            </a>
          </div>
        ) : null}
        {clerkEnabled && isSignedIn ? (
          <div style={{ padding: '0 12px 12px' }}>
            <button
              onClick={() => clerk.signOut(() => router.push('/login'))}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, textAlign: 'left',
                background: 'transparent', border: '1px solid var(--panel-border)', color: 'var(--text-muted)',
                fontSize: 13.5, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--panel-border)', fontSize: 11, color: 'var(--text-muted)' }}>
          Synced via Supabase
        </div>
      </div>
    </div>
  )
}
