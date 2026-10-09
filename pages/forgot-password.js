import { useState } from 'react'
import Link from 'next/link'
import AuthShell from '../components/AuthShell'
import { clerkEnabled, clerkOrFallbackMessage, useSignIn } from '../lib/clerk'

const field = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--panel-border)', background: 'var(--midnight-ink)',
  color: 'var(--paper-white)', font: 'inherit', boxSizing: 'border-box',
}
const button = {
  border: 0, borderRadius: 10, padding: '12px 18px', background: 'var(--balance-pink)',
  color: 'var(--midnight-ink)', font: 'inherit', fontWeight: 700, cursor: 'pointer',
}

function clerkErrorMessage(error) {
  const first = error?.errors?.[0]
  return first?.longMessage || first?.message || error?.message || 'We could not complete the password reset. Please try again.'
}

export default function ForgotPasswordPage() {
  const { isLoaded, signIn } = useSignIn()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step, setStep] = useState('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function sendCode(event) {
    event.preventDefault()
    if (!isLoaded || !signIn || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await signIn.create({ identifier: email.trim(), strategy: 'reset_password_email_code' })
      const factor = signIn.supportedFirstFactors?.find((item) => item.strategy === 'reset_password_email_code')
      if (!factor) throw new Error('Email password recovery is not enabled for this Clerk application. Enable email code password resets in Clerk settings.')
      await signIn.prepareFirstFactor(factor)
      setStep('code')
      setMessage('If this email can reset a dashboard account, Clerk has sent a verification code.')
    } catch (err) {
      // Keep the response indistinguishable for unknown email addresses and
      // accounts that cannot use password recovery.
      setMessage('If an eligible dashboard account uses that email, Clerk will send a verification code. Check the address and try again if nothing arrives.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    if (!isLoaded || !signIn || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code: code.trim() })
      if (signIn.status !== 'needs_new_password') {
        throw new Error('That code could not be verified. Request a new code and try again.')
      }
      setStep('password')
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function updatePassword(event) {
    event.preventDefault()
    if (!isLoaded || !signIn || busy) return
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      await signIn.resetPassword({ password, signOutOfOtherSessions: true })
      setStep('complete')
      setMessage('Your dashboard password has been reset. Sign in with your new password.')
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password" subtitle="Recover access to your Debbit dashboard using the email address on your Clerk account.">
      {!clerkEnabled ? (
        <div style={{ padding: 18, border: '1px solid var(--panel-border)', borderRadius: 12, color: 'var(--text-muted)' }}>{clerkOrFallbackMessage()}</div>
      ) : (
        <div style={{ padding: 24, border: '1px solid var(--panel-border)', borderRadius: 14, background: '#3a1552' }}>
          {step === 'complete' ? (
            <div>
              <p role="status" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{message}</p>
              <Link href="/login" style={{ ...button, display: 'inline-block', marginTop: 12, textDecoration: 'none' }}>Return to sign in</Link>
            </div>
          ) : step === 'email' ? (
            <form onSubmit={sendCode}>
              <label htmlFor="recovery-email" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Email address</label>
              <input id="recovery-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} style={field} />
              <button type="submit" disabled={!isLoaded || busy} style={{ ...button, marginTop: 18, opacity: busy ? 0.7 : 1 }}>{busy ? 'Sending…' : 'Send recovery code'}</button>
            </form>
          ) : step === 'code' ? (
            <form onSubmit={verifyCode}>
              <p style={{ marginTop: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>Enter the recovery code sent to {email}.</p>
              <label htmlFor="recovery-code" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Verification code</label>
              <input id="recovery-code" name="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} style={field} />
              <button type="submit" disabled={!isLoaded || busy} style={{ ...button, marginTop: 18, opacity: busy ? 0.7 : 1 }}>{busy ? 'Verifying…' : 'Verify code'}</button>
              <button type="button" disabled={busy} onClick={() => { setStep('email'); setCode(''); setError(''); setMessage('') }} style={{ display: 'block', marginTop: 14, border: 0, padding: 0, background: 'transparent', color: 'var(--balance-pink)', cursor: 'pointer', font: 'inherit' }}>Use a different email or request another code</button>
            </form>
          ) : (
            <form onSubmit={updatePassword}>
              <label htmlFor="new-password" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>New password</label>
              <input id="new-password" name="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} style={field} />
              <label htmlFor="confirm-password" style={{ display: 'block', margin: '16px 0 8px', fontSize: 13 }}>Confirm new password</label>
              <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={field} />
              <button type="submit" disabled={!isLoaded || busy} style={{ ...button, marginTop: 18, opacity: busy ? 0.7 : 1 }}>{busy ? 'Updating…' : 'Reset password'}</button>
            </form>
          )}
          {message && step !== 'complete' ? <p role="status" style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>{message}</p> : null}
          {error ? <p role="alert" style={{ color: 'var(--color-danger, #f4756b)', fontSize: 13, lineHeight: 1.5 }}>{error}</p> : null}
          {step !== 'complete' ? <p style={{ margin: '20px 0 0', fontSize: 13 }}><Link href="/login" style={{ color: 'var(--balance-pink)' }}>Back to sign in</Link></p> : null}
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>This resets your dashboard sign-in password. Your separate Debbit Desktop password is managed from the desktop app account setup.</p>
    </AuthShell>
  )
}
