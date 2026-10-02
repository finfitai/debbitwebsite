import { EqualsMark } from './ui'
import { BrandConstellation, LockKeyIcon, RocketIcon, CheckBadgeIcon } from './icons'

const FEATURES = [
  { Icon: CheckBadgeIcon, text: 'Real-time books — revenue, cash and runway in one place' },
  { Icon: LockKeyIcon, text: 'Works offline on the shop floor, syncs the moment you\'re online' },
  { Icon: RocketIcon, text: 'e-Invoicing, payroll and inventory built in, not bolted on' },
]

// The ONLY thing a signed-out visitor sees — no sidebar, no nav links to
// pages that would be empty for them anyway. Two-column on wide screens: the
// auth card on the left, a branded panel on the right so the screen doesn't
// feel like a bare form.
export default function AuthShell({ eyebrow, title, subtitle, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex' }}>
      <div style={{ flex: '1 1 480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 440, width: '100%' }}>
          <a href="/" style={{ display: 'inline-block', marginBottom: 32 }}>
            <img src="/debbit-logo-white.png" alt="debbit" style={{ height: 24, width: 'auto', display: 'block' }} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <EqualsMark />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--balance-pink)' }}>
              {eyebrow}
            </span>
          </div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)' }}>{title}</h1>
          {subtitle ? <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 14.5, lineHeight: 1.6 }}>{subtitle}</p> : null}
          {children}
        </div>
      </div>

      <div style={{
        flex: '1 1 480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, background: 'linear-gradient(165deg, var(--debbit-purple) 0%, var(--royal-violet) 60%, var(--midnight-ink) 100%)',
        position: 'relative', overflow: 'hidden',
      }} className="debbit-auth-visual">
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9 }}>
          <BrandConstellation width={480} height={480} />
        </div>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <div className="font-display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--paper-white)', marginBottom: 20, lineHeight: 1.3 }}>
            Your books. Balanced. Automatically.
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            {FEATURES.map(({ Icon, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(224,139,176,0.15)', color: 'var(--balance-pink)',
                }}>
                  <Icon size={19} />
                </span>
                <span style={{ color: 'var(--lilac-mist)', fontSize: 13.5, lineHeight: 1.55, paddingTop: 7 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 920px) {
          /* The panel's own inline style sets display:flex — only an
             !important stylesheet rule can override an inline style. */
          :global(.debbit-auth-visual) { display: none !important; }
        }
      `}</style>
    </div>
  )
}
