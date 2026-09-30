import { useRouter } from 'next/router'
import Link from 'next/link'

const NAV = [
  { href: '/dashboard', label: 'CFO Overview' },
  { href: '/ops', label: 'Ops Analytics' },
  { href: '/', label: 'Shifts' },
  { href: '/admin', label: 'Admin' },
  { href: '/health', label: 'Health' },
  { href: '/support', label: 'Support' },
  { href: '/login', label: 'Login' },
  { href: '/register', label: 'Register' },
]

export default function Sidebar() {
  const router = useRouter()
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
      <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid var(--panel-border)', fontSize: 11, color: 'var(--text-muted)' }}>
        Synced via Supabase
      </div>
    </div>
  )
}
