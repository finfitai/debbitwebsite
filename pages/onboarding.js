import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Sidebar from '../components/Sidebar'
import { clerkEnabled, clerkOrFallbackMessage, useAuth, useUser } from '../lib/clerk'
import { acceptTenantInvite, bootstrapOwnerRegistration, getInviteByToken, hasSupabaseConfig, supabase, useClerkSupabaseClient } from '../lib/supabase'
import { EqualsMark } from '../components/ui'

const card = { background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, padding: 26 }

const COUNTRY_OPTIONS = [
  { code: 'MY', currency: 'MYR', tax: 'MY_SST_6', label: 'Malaysia' },
  { code: 'IN', currency: 'INR', tax: 'IN_GST_18', label: 'India' },
  { code: 'SA', currency: 'SAR', tax: 'KSA_VAT_15', label: 'Saudi Arabia' },
  { code: 'AE', currency: 'AED', tax: 'UAE_VAT_5', label: 'UAE' },
  { code: 'ID', currency: 'IDR', tax: 'ID_PPN_11', label: 'Indonesia' },
]

// Matches supabase's business_type enum exactly (001_core_schema.sql). The
// desktop wizard layers a richer "industry_profile" concept on top of this
// (Construction/Logistics/etc, driving module visibility) that only exists
// locally — not synced to the cloud — so isn't reproduced here; every web
// signup gets this plain business_type and can refine further once they
// open the desktop app.
const BUSINESS_TYPE_OPTIONS = [
  { value: 'RETAIL', label: 'Retail / Shop' },
  { value: 'FOOD_BEVERAGE', label: 'Food & Beverage' },
  { value: 'WHOLESALE', label: 'Wholesale / Distribution' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'SERVICE', label: 'Service (incl. construction, logistics)' },
]

function getDraftDefaults() {
  const firstCountry = COUNTRY_OPTIONS[0]
  return {
    fullName: '',
    email: '',
    businessName: '',
    legalName: '',
    registrationNo: '',
    phone: '',
    country: firstCountry.code,
    currency: firstCountry.currency,
    taxRegime: firstCountry.tax,
    businessType: 'RETAIL',
  }
}

// Carries continuity from the debbit.org marketing site's qualifying quiz
// (country/industry/pain-point) into this wizard via query params, so
// "start free trial" on the website doesn't drop the visitor back into a
// blank form after they've already told us this. ?country=MY&industry=retail
const WEBSITE_INDUSTRY_TO_BUSINESS_TYPE = {
  retail: 'RETAIL',
  fnb: 'FOOD_BEVERAGE',
  distribution: 'WHOLESALE',
  services: 'SERVICE',
  manufacturing: 'MANUFACTURING',
}

const STEPS = ['Business', 'Desktop login']

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const clerkSupabase = useClerkSupabaseClient()
  const [form, setForm] = useState(getDraftDefaults)
  const [step, setStep] = useState(0)
  const [message, setMessage] = useState('')
  const [invite, setInvite] = useState(null)
  const [busy, setBusy] = useState(false)
  const [trialEndsAt, setTrialEndsAt] = useState(null)
  const [done, setDone] = useState(false)
  // Desktop password. Without a staff_accounts login, there is no way for the
  // desktop app to ever discover this business: it only knows how to sign in
  // via email+password (see ipc/staffAccounts.js's app:auth:password:sign_in),
  // and Clerk sign-up alone never creates one. A signup that completed
  // without this would be a trial the owner can never actually open the app
  // with — so this wizard can't be finished without it.
  const [desktopPw, setDesktopPw] = useState({ pw: '', confirm: '' })

  const selectedCountry = useMemo(
    () => COUNTRY_OPTIONS.find(item => item.code === form.country) || COUNTRY_OPTIONS[0],
    [form.country]
  )

  // This wizard only makes sense for a signed-in Clerk user — bounce back to
  // sign-up/sign-in, carrying the same query params (invite_token etc) along.
  useEffect(() => {
    if (!clerkEnabled || !isLoaded || isSignedIn) return
    const qs = new URLSearchParams()
    Object.entries(router.query).forEach(([key, value]) => {
      if (typeof value === 'string') qs.set(key, value)
    })
    const query = qs.toString()
    router.replace(`/register${query ? `?${query}` : ''}`)
  }, [clerkEnabled, isLoaded, isSignedIn, router])

  useEffect(() => {
    async function loadInvite() {
      const inviteToken = router.query.invite_token
      if (!inviteToken || Array.isArray(inviteToken) || !supabase) return
      const { data, error } = await getInviteByToken(inviteToken)
      if (error) {
        setMessage(error.message)
        return
      }
      const nextInvite = Array.isArray(data) ? data[0] : data
      setInvite(nextInvite || null)
      if (nextInvite?.email) setForm(current => ({ ...current, email: nextInvite.email }))
    }
    loadInvite()
  }, [router.query.invite_token])

  useEffect(() => {
    if (!router.isReady) return
    const { country, industry } = router.query
    const countryCode = typeof country === 'string' ? country.toUpperCase() : null
    const businessType = typeof industry === 'string' ? WEBSITE_INDUSTRY_TO_BUSINESS_TYPE[industry.toLowerCase()] : null
    const matchedCountry = countryCode ? COUNTRY_OPTIONS.find(item => item.code === countryCode) : null
    if (!matchedCountry && !businessType) return
    setForm(current => ({
      ...current,
      ...(matchedCountry ? { country: matchedCountry.code, currency: matchedCountry.currency, taxRegime: matchedCountry.tax } : {}),
      ...(businessType ? { businessType } : {}),
    }))
  }, [router.isReady, router.query.country, router.query.industry])

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setForm(current => ({ ...current, email: user.primaryEmailAddress.emailAddress }))
    }
    if (user?.fullName) {
      setForm(current => ({ ...current, fullName: user.fullName || current.fullName }))
    }
  }, [user])

  function updateField(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  // Country, currency and tax regime travel together — a plain updateField('country', ...)
  // would leave currency/taxRegime stuck at whatever they were (the Malaysia defaults,
  // unless the website-quiz query params set them), creating a business whose country
  // doesn't match its currency/tax regime.
  function selectCountry(code) {
    const next = COUNTRY_OPTIONS.find(item => item.code === code) || COUNTRY_OPTIONS[0]
    setForm(current => ({ ...current, country: next.code, currency: next.currency, taxRegime: next.tax }))
  }

  function goToDesktopStep() {
    if (!form.businessName.trim()) { setMessage('Business name is required'); return }
    setMessage('')
    setStep(1)
  }

  // Creates the business + trial, THEN creates the staff_accounts MASTER
  // login the desktop app signs in with (see owner-desktop-login's header
  // comment — Clerk sign-up alone never creates one). No partial state is
  // exposed in the UI: either both succeed, or the form stays up with an
  // error and nothing to skip past. bootstrap_owner_registration and
  // owner-desktop-login are both idempotent, so re-submitting after a
  // failure (e.g. the first call succeeded, the second didn't) safely
  // finishes whichever part didn't complete rather than erroring or
  // duplicating anything.
  async function completeSignup() {
    if (!isSignedIn) {
      setMessage('Sign in first, then complete business setup.')
      return
    }
    if (!clerkSupabase) {
      setMessage('Supabase is not configured.')
      return
    }
    setMessage('')
    if (desktopPw.pw.length < 8) { setMessage('Desktop password must be at least 8 characters'); return }
    if (desktopPw.pw !== desktopPw.confirm) { setMessage('Desktop passwords do not match'); return }

    setBusy(true)
    try {
      const { data: businessId, error } = await bootstrapOwnerRegistration(clerkSupabase, {
        p_business_name: form.businessName.trim(),
        p_legal_name: form.legalName.trim() || null,
        p_registration_no: form.registrationNo.trim() || null,
        p_phone: form.phone.trim() || null,
        p_country: form.country,
        p_currency: form.currency,
        p_tax_regime: form.taxRegime,
        p_business_type: form.businessType,
        p_full_name: form.fullName.trim(),
        // Fallback for when Clerk's session token doesn't carry an email claim
        // (requires a dashboard "Customize session token" change the SQL side
        // can't assume is done) — sourced from Clerk's own verified useUser(),
        // not just echoed from the form field.
        p_email: user?.primaryEmailAddress?.emailAddress || form.email.trim() || null,
      })
      if (error) {
        setMessage(error.message)
        return
      }

      const token = await getToken()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/owner-desktop-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ business_id: businessId, password: desktopPw.pw }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) {
        setMessage(`Your business was created, but the desktop login could not be — ${j.error || `HTTP ${res.status}`}. Submit again to finish setting it up.`)
        return
      }

      // Fetch the trial end date the RPC just set, so the success message
      // can show a concrete date rather than just "success".
      const { data: biz } = await clerkSupabase.from('businesses').select('trial_ends_at').eq('id', businessId).maybeSingle()
      if (biz?.trial_ends_at) setTrialEndsAt(biz.trial_ends_at)
      setDone(true)
      setTimeout(() => router.replace('/dashboard'), 1600)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function completeInviteAcceptance() {
    if (!isSignedIn) {
      setMessage('Sign in first, then accept the invite.')
      return
    }
    if (!invite?.invite_token) {
      setMessage('No active invite found.')
      return
    }
    if (!clerkSupabase) {
      setMessage('Supabase is not configured.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error, data } = await acceptTenantInvite(clerkSupabase, {
        p_invite_token: invite.invite_token,
        p_full_name: form.fullName.trim(),
        p_phone: form.phone.trim() || null,
      })
      if (error) {
        setMessage(error.message)
        return
      }
      const accepted = Array.isArray(data) ? data[0] : data
      setMessage(`Invite accepted. Joined ${accepted?.business_name || 'the business'} as ${accepted?.role || invite.role}.`)
      setForm(getDraftDefaults())
      setTimeout(() => router.replace('/dashboard'), 800)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const isInvite = Boolean(invite?.invite_token)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px 36px' }}>
        <div style={{ maxWidth: 1080 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <EqualsMark />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--balance-pink)' }}>
              {isInvite ? 'Team invite' : `Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
            </span>
          </div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)' }}>
            {isInvite ? 'Join your team' : step === 0 ? 'Tell us about your business' : 'Set your desktop password'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
            {isInvite
              ? 'Accept the staff invite and join the business.'
              : step === 0
                ? 'A couple of details, then one password for the desktop app and you are done.'
                : 'debbit OS signs in with this password, not your Google/email account. Install the desktop app any time and use it there.'}
          </p>

          {!clerkEnabled ? (
            <div style={card}>{clerkOrFallbackMessage()}</div>
          ) : !hasSupabaseConfig ? (
            <div style={card}>Supabase configuration is required for tenant bootstrap.</div>
          ) : !isSignedIn ? (
            <div style={card}>Taking you to sign in…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 20 }}>
              <section style={card}>
                {done ? (
                  <>
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--paper-white)' }}>
                      You're all set
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(47,191,143,0.12)', border: '1px solid rgba(47,191,143,0.35)', fontSize: 13, color: 'var(--paper-white)' }}>
                      {message}
                      {trialEndsAt ? (
                        <div style={{ marginTop: 5, color: 'var(--text-muted)' }}>
                          Trial ends {new Date(trialEndsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. You can add a card any time from Upgrade.
                        </div>
                      ) : null}
                      <div style={{ marginTop: 10, color: 'var(--text-muted)' }}>
                        Install debbit OS and sign in with {user?.primaryEmailAddress?.emailAddress} and the desktop password you just set.
                      </div>
                    </div>
                  </>
                ) : isInvite ? (
                  <>
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--paper-white)' }}>Invite summary</div>
                    <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
                      <div><b style={{ color: 'var(--paper-white)' }}>Identity:</b> Clerk session for the owner/admin.</div>
                      <div><b style={{ color: 'var(--paper-white)' }}>Membership:</b> a new `business_members` row on the inviting business.</div>
                    </div>
                    <input style={input} type='text' placeholder='Your full name' value={form.fullName} onChange={e => updateField('fullName', e.target.value)} />
                    <input style={{ ...input, marginTop: 10 }} type='text' placeholder='Phone (optional)' value={form.phone} onChange={e => updateField('phone', e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                      <button style={button} disabled={busy} onClick={completeInviteAcceptance}>{busy ? 'Joining…' : 'Accept invite'}</button>
                      <button style={secondaryButton} disabled={busy} onClick={() => setInvite(null)}>Register my own business instead</button>
                    </div>
                    {message ? (
                      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(244,117,107,0.1)', border: '1px solid rgba(244,117,107,0.3)', fontSize: 13, color: '#f8a29b' }}>
                        {message}
                      </div>
                    ) : null}
                  </>
                ) : step === 0 ? (
                  <>
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--paper-white)' }}>Your business</div>
                    <input style={input} type='text' placeholder='Owner full name' value={form.fullName} onChange={e => updateField('fullName', e.target.value)} />
                    <input style={{ ...input, marginTop: 10 }} type='text' placeholder='Business name' value={form.businessName} onChange={e => updateField('businessName', e.target.value)} />
                    <input style={{ ...input, marginTop: 10 }} type='text' placeholder='Business phone (optional)' value={form.phone} onChange={e => updateField('phone', e.target.value)} />
                    <select style={{ ...input, marginTop: 10 }} value={form.country} onChange={e => selectCountry(e.target.value)}>
                      {COUNTRY_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
                    </select>
                    <select style={{ ...input, marginTop: 10 }} value={form.businessType} onChange={e => updateField('businessType', e.target.value)}>
                      {BUSINESS_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                      <button style={button} onClick={goToDesktopStep}>Continue</button>
                    </div>
                    {message ? (
                      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(244,117,107,0.1)', border: '1px solid rgba(244,117,107,0.3)', fontSize: 13, color: '#f8a29b' }}>
                        {message}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--paper-white)' }}>Desktop login</div>
                    <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
                      <div><b style={{ color: 'var(--paper-white)' }}>Trial:</b> 1-month full access, starts the moment setup completes.</div>
                      <div><b style={{ color: 'var(--paper-white)' }}>Desktop login:</b> the password below — debbit OS signs in with it, not Google/email.</div>
                    </div>
                    <input style={input} type='password' placeholder='Desktop password (min 8 characters)' value={desktopPw.pw}
                      onChange={e => setDesktopPw(current => ({ ...current, pw: e.target.value }))} autoFocus />
                    <input style={{ ...input, marginTop: 10 }} type='password' placeholder='Confirm desktop password' value={desktopPw.confirm}
                      onChange={e => setDesktopPw(current => ({ ...current, confirm: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') completeSignup() }} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                      <button style={secondaryButton} disabled={busy} onClick={() => setStep(0)}>Back</button>
                      <button style={button} disabled={busy} onClick={completeSignup}>{busy ? 'Setting up…' : 'Start free trial'}</button>
                    </div>
                    {message ? (
                      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(244,117,107,0.1)', border: '1px solid rgba(244,117,107,0.3)', fontSize: 13, color: '#f8a29b' }}>
                        {message}
                      </div>
                    ) : null}
                  </>
                )}
              </section>

              <section style={card}>
                {!done && !isInvite ? (
                  <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--panel-border)', background: 'var(--midnight-ink)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--balance-pink)', marginBottom: 8 }}>Localization preview</div>
                    <div className="font-display tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: 'var(--paper-white)' }}>{selectedCountry.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{form.currency} · {form.taxRegime}</div>
                  </div>
                ) : null}
                {invite && !done ? (
                  <div style={{ marginTop: !isInvite ? 12 : 0, padding: 14, border: '1px solid var(--panel-border)', borderRadius: 12, background: 'var(--midnight-ink)', fontSize: 12, color: 'var(--text-muted)' }}>
                    Invite detected for <b style={{ color: 'var(--paper-white)' }}>{invite.business_name || invite.business_id}</b> as <b style={{ color: 'var(--paper-white)' }}>{invite.role}</b>.
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const input = {
  width: '100%', padding: '11px 13px', borderRadius: 9, fontSize: 13.5,
  border: '1px solid var(--panel-border)', background: 'var(--midnight-ink)', color: 'var(--paper-white)',
  fontFamily: 'var(--font-body)',
}
const button = {
  padding: '10px 18px', borderRadius: 9, background: 'var(--balance-pink)', color: 'var(--debbit-purple)',
  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13.5, fontFamily: 'var(--font-body)',
}
const secondaryButton = { ...button, background: 'transparent', color: 'var(--paper-white)', border: '1px solid var(--panel-border)' }
