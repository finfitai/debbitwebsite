import Sidebar from './Sidebar'
import { EqualsMark } from './ui'

export default function AppShell({ title, subtitle, actions, children, maxWidth = 1180 }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--paper-white)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 28px 40px' }}>
        <div style={{ maxWidth, margin: '0 auto' }}>
          <section style={{ marginBottom: 24, padding: '24px 26px', border: '1px solid var(--panel-border)', borderRadius: 18, background: 'var(--panel)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 760 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <EqualsMark size={11} />
                  <span style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--balance-pink)' }}>debbit cloud</span>
                </div>
                <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1, margin: 0, color: 'var(--paper-white)' }}>{title}</h1>
                {subtitle ? <p style={{ color: 'var(--text-muted)', margin: '12px 0 0', fontSize: 14, lineHeight: 1.6 }}>{subtitle}</p> : null}
              </div>
              {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div> : null}
            </div>
          </section>
          {children}
        </div>
      </main>
    </div>
  )
}
