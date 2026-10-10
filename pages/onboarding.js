import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { clerkEnabled, clerkOrFallbackMessage, useAuth, useUser } from '../lib/clerk'
import { acceptTenantInvite, bootstrapOwnerRegistration, getInviteByToken, hasSupabaseConfig, supabase, supabaseAnonKey, supabaseUrl, useClerkSupabaseClient } from '../lib/supabase'
import { EqualsMark } from '../components/ui'
import { BUSINESS_TYPE_ICONS, CheckBadgeIcon, LockKeyIcon, RocketIcon } from '../components/icons'
import { BrandLoader } from '../components/Protected'
import { ALL_195_COUNTRIES, getCountryConfig } from '../lib/countries'
import PasswordField from '../components/PasswordField'

const card = { background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, padding: 26 }

// The five markets debbit OS has real e-invoicing/tax-regime support for —
// shown as quick-pick pills. Every other country (lib/countries.js's full
// 195) is reachable from the dropdown right below them, each defaulting to
// a standard tax regime the backend already accepts (see migration 049).
const PINNED_COUNTRY_CODES = ['MY', 'IN', 'SA', 'AE', 'ID']

function countryOption(code) {
  const cfg = getCountryConfig(code)
  if (!cfg) return null
  return { code: code.toUpperCase(), label: cfg.name, flag: cfg.flag, currency: cfg.currency, tax: cfg.default_regime }
}

const PINNED_COUNTRIES = PINNED_COUNTRY_CODES.map(countryOption)
const OTHER_COUNTRIES = ALL_195_COUNTRIES.filter(c => !PINNED_COUNTRY_CODES.includes(c.code))

// Labels/taglines mirror apps/desktop/profiles/*.json exactly (restaurant,
// wholesale, retail, manufacturing, services) — what you pick here is what
// actually changes in the desktop app's nav and chart of accounts the first
// time you sign in there (see ipc/staffAccounts.js's bootstrapBusiness).
const BUSINESS_TYPE_OPTIONS = [
  { value: 'RETAIL', label: 'Retail / Shop', tagline: 'Sell products over the counter' },
  { value: 'FOOD_BEVERAGE', label: 'Restaurant / Café', tagline: 'Menu items, ingredients, fast orders' },
  { value: 'WHOLESALE', label: 'Wholesale / Distribution', tagline: 'Bulk sell-in to other businesses, EDI, pick & pack' },
  { value: 'MANUFACTURING', label: 'Light Manufacturing', tagline: 'Build products from raw materials (BOM)' },
  { value: 'SERVICE', label: 'Services / Professional', tagline: 'Bill for time and services, no stock' },
]

function getDraftDefaults() {
  const firstCountry = PINNED_COUNTRIES[0]
  return {
    fullName: '',
    email: '',
    businessName: '',
    legalName: '',
    registrationNo: '',
    taxId: '',
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

const STEP_LABELS = ['Business', 'Desktop login', 'Done']

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
    () => countryOption(form.country) || PINNED_COUNTRIES[0],
    [form.country]
  )
  const selectedCountryConfig = useMemo(() => getCountryConfig(form.country), [form.country])
  const selectedBusinessType = useMemo(
    () => BUSINESS_TYPE_OPTIONS.find(item => item.value === form.businessType) || BUSINESS_TYPE_OPTIONS[0],
    [form.businessType]
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
    const matchedCountry = countryCode ? countryOption(countryCode) : null
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
    const next = countryOption(code) || PINNED_COUNTRIES[0]
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
        p_tax_id: form.taxId.trim() || null,
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
      const res = await fetch(`${supabaseUrl}/functions/v1/owner-desktop-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
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
      setStep(2)
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
  const SelectedIcon = BUSINESS_TYPE_ICONS[form.businessType]

  if (!clerkEnabled) return <BrandLoader message={clerkOrFallbackMessage()} />
  if (!hasSupabaseConfig) return <BrandLoader message="Supabase configuration is required for tenant bootstrap." />
  if (!isSignedIn) return <BrandLoader message="Taking you to sign in…" />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ padding: '24px 36px 0' }}>
        <img src="/debbit-logo-white.png" alt="debbit" style={{ height: 22, width: 'auto', display: 'block' }} />
      </div>
      <div style={{ padding: '32px 36px 60px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          {!isInvite ? <StepProgress step={step} /> : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <EqualsMark />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--balance-pink)' }}>
              {isInvite ? 'Team invite' : done ? "You're in" : step === 0 ? 'Tell us about your business' : 'Almost there'}
            </span>
          </div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)' }}>
            {isInvite ? 'Join your team' : done ? 'Your business is live' : step === 0 ? 'What kind of business is this?' : 'Set your desktop password'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
            {isInvite
              ? 'Accept the staff invite and join the business.'
              : done
                ? 'Install debbit OS and sign in to start working — everything below is already waiting for you.'
                : step === 0
                  ? 'Pick what you sell — it shapes the modules and chart of accounts debbit OS sets up for you.'
                  : 'debbit OS signs in with this password, not your Google/email account. Install the desktop app any time and use it there.'}
          </p>

          {done ? (
            <DoneScreen
              email={user?.primaryEmailAddress?.emailAddress}
              trialEndsAt={trialEndsAt}
              businessType={selectedBusinessType}
              country={selectedCountry}
              onContinue={() => router.replace('/dashboard')}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 20 }}>
              <section style={card}>
                {isInvite ? (
                  <>
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--paper-white)' }}>Invite summary</div>
                    <input style={input} type='text' placeholder='Your full name' value={form.fullName} onChange={e => updateField('fullName', e.target.value)} />
                    <input style={{ ...input, marginTop: 10 }} type='text' placeholder='Phone (optional)' value={form.phone} onChange={e => updateField('phone', e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                      <button style={button} disabled={busy} onClick={completeInviteAcceptance}>{busy ? 'Joining…' : 'Accept invite'}</button>
                      <button style={secondaryButton} disabled={busy} onClick={() => setInvite(null)}>Register my own business instead</button>
                    </div>
                    {message ? <MessageBox>{message}</MessageBox> : null}
                    <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      You'll get your own account and join the business right away, with whatever access level they've invited you at.
                    </div>
                  </>
                ) : step === 0 ? (
                  <>
                    <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Business type</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 22 }}>
                      {BUSINESS_TYPE_OPTIONS.map(opt => (
                        <BusinessTypeTile key={opt.value} option={opt} active={form.businessType === opt.value} onSelect={() => updateField('businessType', opt.value)} />
                      ))}
                    </div>

                    <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--paper-white)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Country</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {PINNED_COUNTRIES.map(opt => (
                        <CountryPill key={opt.code} option={opt} active={form.country === opt.code} onSelect={() => selectCountry(opt.code)} />
                      ))}
                    </div>
                    <select
                      value={PINNED_COUNTRY_CODES.includes(form.country) ? '' : form.country}
                      onChange={e => { if (e.target.value) selectCountry(e.target.value) }}
                      style={{ ...input, marginBottom: 22, cursor: 'pointer' }}
                    >
                      <option value="" disabled>
                        {PINNED_COUNTRY_CODES.includes(form.country) ? 'Or pick another country…' : `${selectedCountry.flag} ${selectedCountry.label}`}
                      </option>
                      {OTHER_COUNTRIES.map(opt => (
                        <option key={opt.code} value={opt.code}>{opt.flag} {opt.name}</option>
                      ))}
                    </select>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, marginBottom: 10 }}>
                      <input style={input} type='text' placeholder={`${selectedCountryConfig?.reg_label || 'Registration number'} (optional)`} value={form.registrationNo} onChange={e => updateField('registrationNo', e.target.value)} />
                      <input style={input} type='text' placeholder={`${selectedCountryConfig?.tax_label || 'Tax ID'} (optional)`} value={form.taxId} onChange={e => updateField('taxId', e.target.value)} />
                    </div>

                    <input style={input} type='text' placeholder='Owner full name' value={form.fullName} onChange={e => updateField('fullName', e.target.value)} />
                    <input style={{ ...input, marginTop: 10 }} type='text' placeholder='Business name' value={form.businessName} onChange={e => updateField('businessName', e.target.value)} />
                    <input style={{ ...input, marginTop: 10 }} type='text' placeholder='Business phone (optional)' value={form.phone} onChange={e => updateField('phone', e.target.value)} />

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                      <button style={button} onClick={goToDesktopStep}>Continue</button>
                    </div>
                    {message ? <MessageBox>{message}</MessageBox> : null}
                  </>
                ) : (
                  <>
                    <div style={{
                      width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(224,139,176,0.14)', color: 'var(--balance-pink)', marginBottom: 18,
                    }}>
                      <LockKeyIcon size={28} />
                    </div>
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--paper-white)' }}>Desktop login</div>
                    <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
                      <div><b style={{ color: 'var(--paper-white)' }}>Trial:</b> 1-month full access, starts the moment setup completes.</div>
                      <div><b style={{ color: 'var(--paper-white)' }}>Desktop login:</b> the password below — debbit OS signs in with it, not Google/email.</div>
                    </div>
                    <PasswordField style={input} placeholder='Desktop password (min 8 characters)' value={desktopPw.pw}
                      onChange={e => setDesktopPw(current => ({ ...current, pw: e.target.value }))} autoFocus />
                    <PasswordField style={{ ...input, marginTop: 10 }} placeholder='Confirm desktop password' value={desktopPw.confirm}
                      onChange={e => setDesktopPw(current => ({ ...current, confirm: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') completeSignup() }} />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                      <button style={secondaryButton} disabled={busy} onClick={() => setStep(0)}>Back</button>
                      <button style={button} disabled={busy} onClick={completeSignup}>{busy ? 'Setting up…' : 'Start free trial'}</button>
                    </div>
                    {message ? <MessageBox>{message}</MessageBox> : null}
                  </>
                )}
              </section>

              <section style={card}>
                {!isInvite ? (
                  <BusinessPreview businessType={selectedBusinessType} country={selectedCountry} currency={form.currency} taxRegime={form.taxRegime} Icon={SelectedIcon} />
                ) : null}
                {invite ? (
                  <div style={{ marginTop: !isInvite ? 16 : 0, padding: 14, border: '1px solid var(--panel-border)', borderRadius: 12, background: 'var(--midnight-ink)', fontSize: 12, color: 'var(--text-muted)' }}>
                    Invite detected for <b style={{ color: 'var(--paper-white)' }}>{invite.business_name || invite.business_id}</b> as <b style={{ color: 'var(--paper-white)' }}>{invite.role}</b>.
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepProgress({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, maxWidth: 480 }}>
      {STEP_LABELS.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11.5, fontWeight: 700, flexShrink: 0,
              background: i <= step ? 'var(--balance-pink)' : 'var(--midnight-ink)',
              color: i <= step ? 'var(--debbit-purple)' : 'var(--text-muted)',
              border: i <= step ? 'none' : '1px solid var(--panel-border)',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12.5, color: i === step ? 'var(--paper-white)' : 'var(--text-muted)', fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 ? <div style={{ flex: 1, height: 1, background: i < step ? 'var(--balance-pink)' : 'var(--panel-border)', margin: '0 10px' }} /> : null}
        </div>
      ))}
    </div>
  )
}

function BusinessTypeTile({ option, active, onSelect }) {
  const Icon = BUSINESS_TYPE_ICONS[option.value]
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 9, textAlign: 'left',
        padding: '14px 13px', borderRadius: 12, cursor: 'pointer',
        border: `1.5px solid ${active ? 'var(--balance-pink)' : 'var(--panel-border)'}`,
        background: active ? 'rgba(224,139,176,0.12)' : 'var(--midnight-ink)',
        color: 'var(--paper-white)', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        transition: 'border-color .15s, background .15s', boxSizing: 'border-box',
      }}
    >
      <span style={{ color: active ? 'var(--balance-pink)' : 'var(--text-muted)' }}><Icon size={24} /></span>
      <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{option.label}</span>
    </button>
  )
}

function CountryPill({ option, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
        border: `1.5px solid ${active ? 'var(--balance-pink)' : 'var(--panel-border)'}`,
        background: active ? 'rgba(224,139,176,0.12)' : 'var(--midnight-ink)',
        color: active ? 'var(--paper-white)' : 'var(--text-muted)', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontSize: 13,
        fontWeight: active ? 600 : 400,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{option.flag}</span>{option.label}
    </button>
  )
}

function BusinessPreview({ businessType, country, currency, taxRegime, Icon }) {
  const countryConfig = getCountryConfig(country.code)
  const taxRegimeLabel = countryConfig?.regimes?.find(r => r.value === taxRegime)?.label || taxRegime

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(224,139,176,0.14)', color: 'var(--balance-pink)', flexShrink: 0,
        }}>
          {Icon ? <Icon size={26} /> : null}
        </div>
        <div>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600, color: 'var(--paper-white)' }}>{businessType.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{businessType.tagline}</div>
        </div>
      </div>

      <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--panel-border)', background: 'var(--midnight-ink)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--balance-pink)', marginBottom: 8 }}>Localization preview</div>
        <div className="font-display tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: 'var(--paper-white)' }}>
          <span style={{ marginRight: 8 }}>{country.flag}</span>{country.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{currency} · {taxRegimeLabel}</div>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        You'll be the owner with full access from day one, and your chart of accounts is set up automatically for {businessType.label.toLowerCase()} — nothing to configure yourself.
      </div>
    </div>
  )
}

function DoneScreen({ email, trialEndsAt, businessType, country, onContinue }) {
  const Icon = BUSINESS_TYPE_ICONS[businessType.value]
  return (
    <div style={{ ...card, maxWidth: 640, margin: '0 auto', textAlign: 'center', padding: '44px 32px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(224,139,176,0.28) 0%, rgba(224,139,176,0) 70%)',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{ color: 'var(--balance-pink)', marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
          <CheckBadgeIcon size={56} />
        </div>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--paper-white)', marginBottom: 10 }}>
          {country.flag} {businessType.label} — ready to go
        </div>
        {trialEndsAt ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Trial ends {new Date(trialEndsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. You can add a card any time from Upgrade.
          </div>
        ) : null}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 12,
          background: 'var(--midnight-ink)', border: '1px solid var(--panel-border)', textAlign: 'left', marginBottom: 24,
        }}>
          <span style={{ color: 'var(--balance-pink)', flexShrink: 0 }}>{Icon ? <Icon size={24} /> : null}</span>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Install debbit OS and sign in with <b style={{ color: 'var(--paper-white)' }}>{email}</b> and the desktop password you just set.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href='/downloads/debbit-os-setup-windows.exe' style={{ ...buttonLink }}>
            <RocketIcon size={16} />
            <span style={{ marginLeft: 8 }}>Download debbit OS for Windows</span>
          </a>
          <button style={secondaryButton} onClick={onContinue}>Skip to dashboard</button>
        </div>
      </div>
    </div>
  )
}

function MessageBox({ children }) {
  return (
    <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(244,117,107,0.1)', border: '1px solid rgba(244,117,107,0.3)', fontSize: 13, color: '#f8a29b' }}>
      {children}
    </div>
  )
}

const input = {
  width: '100%', padding: '11px 13px', borderRadius: 9, fontSize: 13.5,
  border: '1px solid var(--panel-border)', background: 'var(--midnight-ink)', color: 'var(--paper-white)',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
}
const button = {
  padding: '10px 18px', borderRadius: 9, background: 'var(--balance-pink)', color: 'var(--debbit-purple)',
  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13.5, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
}
const secondaryButton = { ...button, background: 'transparent', color: 'var(--paper-white)', border: '1px solid var(--panel-border)' }
const buttonLink = { ...button, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }
