import { useRouter } from 'next/router'
import Link from 'next/link'
import { useClerk } from '../lib/clerk'

// Only ever rendered inside components/Protected.js's gated branch — a
// signed-in owner/admin who has already finished onboarding — so there's no
// signed-out or pre-onboarding state to branch on here any more.
const NAV = [
  { href: '/dashboard', label: 'CFO Overview' },
  { href: '/ops', label: 'Ops Analytics' },
  { href: '/shifts', label: 'Shifts' },
  { href: '/team', label: 'Team' },
  { href: '/admin', label: 'Admin' },
  { href: '/health', label: 'Health' },
  { href: '/support', label: 'Support' },
]

export default function Sidebar() {
  const router = useRouter()
  const clerk = useClerk()
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
        {NAV.map(({ href, label }) => {
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
        <div style={{ padding: '0 12px 12px' }}>
          <a
            href='/downloads/debbit-os-setup-windows.exe'
            style={{
              display: 'block', width: '100%', padding: '9px 14px', borderRadius: 8, textAlign: 'left',
              background: 'var(--balance-pink)', color: 'var(--debbit-purple)', fontWeight: 600,
              fontSize: 13.5, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', textDecoration: 'none', boxSizing: 'border-box',
            }}
          >
            Download debbit OS
          </a>
        </div>
        <div style={{ padding: '0 12px 12px' }}>
          <button
            onClick={() => clerk.signOut(() => router.push('/login'))}
            style={{
              width: '100%', padding: '9px 14px', borderRadius: 8, textAlign: 'left',
              background: 'transparent', border: '1px solid var(--panel-border)', color: 'var(--text-muted)',
              fontSize: 13.5, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--panel-border)', fontSize: 11, color: 'var(--text-muted)' }}>
          Synced via Supabase
        </div>
      </div>
    </div>
  )
}
