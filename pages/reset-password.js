import { useEffect, useState } from 'react'
import AuthShell from '../components/AuthShell'
import PasswordField from '../components/PasswordField'
import { supabaseUrl as SUPABASE_URL, supabaseAnonKey as SUPABASE_ANON } from '../lib/supabase'

// Where the "reset your password" email lands (the link comes from Supabase Auth, started by "Forgot password?" in the debbit app or
// on this site). The link carries a short-lived recovery token in the address after "#"; this page uses it once to set the new
// password, then sends the person back to the app to sign in. Public on purpose: no sign-in is possible when the password is lost.
// Nothing is stored; the token never leaves the browser except in the one request to Supabase.

const input = {
  width: '100%', padding: '11px 13px', borderRadius: 9, fontSize: 13.5,
  border: '1px solid var(--panel-border)', background: 'var(--midnight-ink)', color: 'var(--paper-white)',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
}
const button = {
  padding: '11px 18px', borderRadius: 9, background: 'var(--balance-pink)', color: 'var(--debbit-purple)',
  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13.5, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
}
const MIN = 8

export default function ResetPasswordPage() {
  const [token, setToken] = useState(null)
  const [linkProblem, setLinkProblem] = useState(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''))
    const access = params.get('access_token')
    if (params.get('error') || !access || (params.get('type') && params.get('type') !== 'recovery')) {
      setLinkProblem(params.get('error_code') === 'otp_expired'
        ? 'This reset link has expired. Ask for a new one from the sign-in screen.'
        : 'This reset link is not valid. Ask for a new one from the sign-in screen.')
      return
    }
    setToken(access)
    // Take the token out of the address bar and history right away.
    try { window.history.replaceState(null, '', window.location.pathname) } catch { /* not essential */ }
  }, [])

  async function save(e) {
    e.preventDefault()
    setMessage('')
    if (pw.length < MIN) { setMessage(`Use at least ${MIN} characters.`); return }
    if (pw !== pw2) { setMessage('The two passwords do not match.'); return }
    if (!SUPABASE_URL || !SUPABASE_ANON) { setMessage('This site is not connected to the account service yet.'); return }
    setBusy(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: pw }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(j.msg || j.error_description || (res.status === 401 ? 'This reset link has expired. Ask for a new one from the sign-in screen.' : 'Could not save the new password.'))
      } else {
        setDone(true); setToken(null)
      }
    } catch {
      setMessage("Couldn't reach the server — check your connection and try again.")
    }
    setBusy(false)
  }

  return (
    <AuthShell eyebrow='Account' title='Choose a new password' subtitle={done ? '' : 'Pick a password you have not used before.'}>
      {linkProblem ? (
        <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }} role='alert'>{linkProblem}</div>
      ) : done ? (
        <div role='status' style={{ lineHeight: 1.6 }}>
          <div style={{ marginBottom: 10, color: 'var(--paper-white)', fontWeight: 600 }}>Your password has been changed.</div>
          <div style={{ color: 'var(--text-muted)' }}>Go back to the debbit app and sign in with your new password.</div>
        </div>
      ) : (
        <form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
          <PasswordField style={input} placeholder={`New password (${MIN}+ characters)`} value={pw} onChange={e => setPw(e.target.value)} autoComplete='new-password' autoFocus />
          <PasswordField style={input} placeholder='Confirm new password' value={pw2} onChange={e => setPw2(e.target.value)} autoComplete='new-password' />
          <div role='alert' style={{ minHeight: 18, fontSize: 13, color: 'var(--alert-coral)' }}>{message}</div>
          <button type='submit' style={button} disabled={busy || !token}>{busy ? 'Saving…' : 'Change password'}</button>
        </form>
      )}
    </AuthShell>
  )
}
