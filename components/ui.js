import Link from 'next/link'

// The pink "=" — per the brand book, "extracted from the logo as a standalone
// graphic device: divider, bullet, 'before = after' connector, watermark".
export function EqualsMark({ size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: size * 0.22, verticalAlign: 'middle' }}>
      <span style={{ width: size, height: size * 0.2, borderRadius: 2, background: 'var(--balance-pink)' }} />
      <span style={{ width: size, height: size * 0.2, borderRadius: 2, background: 'var(--balance-pink)' }} />
    </span>
  )
}

export function Panel({ title, subtitle, children, tone = 'default' }) {
  const border = tone === 'accent' ? 'rgba(224,139,176,0.28)' : 'var(--panel-border)'
  const bg = tone === 'accent'
    ? 'linear-gradient(180deg, #3f1a5c, #2a0f40)'
    : 'var(--panel)'
  return (
    <section style={{ background: bg, border: `1px solid ${border}`, borderRadius: 18, padding: 20, boxShadow: '0 18px 48px rgba(0,0,0,0.24)' }}>
      {title ? <div className="font-display" style={{ fontSize: 15, fontWeight: 600, marginBottom: subtitle ? 4 : 14, color: 'var(--paper-white)' }}>{title}</div> : null}
      {subtitle ? <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>{subtitle}</div> : null}
      {children}
    </section>
  )
}

export function StatCard({ label, value, accent = 'var(--paper-white)', subtext }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{label}</div>
      <div className="font-display tabular-nums" style={{ fontSize: 26, fontWeight: 600, color: accent }}>{value}</div>
      {subtext ? <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{subtext}</div> : null}
    </div>
  )
}

export function EmptyState({ children }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{children}</div>
}

// tone: 'accent' (pink, primary highlight), 'success' (profit green,
// functional-only per the brand book), 'danger' (alert coral, functional-only).
export function InfoStrip({ children, tone = 'accent' }) {
  const palette = tone === 'success'
    ? { bg: 'rgba(47,191,143,0.1)', border: 'rgba(47,191,143,0.3)', color: '#7fe0c4' }
    : tone === 'danger'
      ? { bg: 'rgba(244,117,107,0.1)', border: 'rgba(244,117,107,0.3)', color: '#f8a29b' }
      : { bg: 'rgba(224,139,176,0.1)', border: 'rgba(224,139,176,0.3)', color: 'var(--balance-pink)' }
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, fontSize: 13, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

export function PrimaryButton(props) {
  return <button {...props} style={{ ...primaryButton, ...(props.style || {}) }} />
}

export function SecondaryButton(props) {
  return <button {...props} style={{ ...secondaryButton, ...(props.style || {}) }} />
}

export function InlineLink({ href, children }) {
  return <Link href={href} style={{ color: 'var(--balance-pink)', textDecoration: 'none' }}>{children}</Link>
}

export const input = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 9,
  border: '1px solid var(--panel-border)',
  background: 'var(--midnight-ink)',
  color: 'var(--paper-white)',
  fontFamily: 'var(--font-body)',
  fontSize: 13.5,
}

export const miniInput = { ...input, padding: '7px 9px', fontSize: 12 }
export const primaryButton = { padding: '10px 16px', borderRadius: 9, background: 'var(--balance-pink)', color: 'var(--debbit-purple)', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-body)' }
export const secondaryButton = { ...primaryButton, background: 'transparent', border: '1px solid var(--panel-border)', color: 'var(--paper-white)' }
export const table = { width: '100%', borderCollapse: 'collapse' }
export const th = { textAlign: 'left', padding: '10px 8px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--panel-border)' }
export const td = { padding: '10px 8px', fontSize: 13, borderBottom: '1px solid var(--panel-border)', verticalAlign: 'top', color: 'var(--paper-white)' }
