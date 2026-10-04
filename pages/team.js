import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { useAuth } from '../lib/clerk'
import { supabaseAnonKey, supabaseUrl, useClerkSupabaseClient } from '../lib/supabase'
import { EmptyState, Panel, input, primaryButton } from '../components/ui'

// Everyone who signs in to the debbit desktop app is created HERE — never in the app. Each person gets an email + password
// that works on any computer; switching a login off here cuts that person off on every computer at once.
const ROLES = [
  ['SALES', 'Sales'], ['POS', 'Cashier (POS)'], ['PURCHASE', 'Purchasing'],
  ['INVENTORY', 'Inventory'], ['HR', 'HR & payroll'], ['ACCOUNTANT', 'Accountant'],
]
const roleLabel = (r) => (r === 'MASTER' ? 'Owner' : (ROLES.find(([k]) => k === r)?.[1] ?? r))

export default function TeamPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const clerkSupabase = useClerkSupabaseClient()
  const [businessId, setBusinessId] = useState(null)
  const [rows, setRows] = useState(null)
  const [message, setMessage] = useState(null) // { ok, text }
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ role: 'SALES', full_name: '', email: '', password: '' })

  const call = useCallback(async (body) => {
    const token = await getToken()
    const res = await fetch(`${supabaseUrl}/functions/v1/staff-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, 'x-clerk-token': token },
      body: JSON.stringify({ business_id: businessId, ...body }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j.ok) throw new Error(j.error || `Request failed (${res.status})`)
    return j
  }, [getToken, businessId])

  const load = useCallback(async () => {
    try { setRows((await call({ action: 'list' })).data || []) } catch (e) { setRows([]); setMessage({ ok: false, text: e.message }) }
  }, [call])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !clerkSupabase) return
    clerkSupabase.from('businesses').select('id').limit(1).then(({ data }) => setBusinessId(data?.[0]?.id ?? null))
  }, [isLoaded, isSignedIn, clerkSupabase])
  useEffect(() => { if (businessId) void load() }, [businessId, load])

  async function act(body, done) {
    setMessage(null); setBusy(true)
    try { await call(body); setMessage({ ok: true, text: done }); await load(); return true } catch (e) { setMessage({ ok: false, text: e.message }); return false } finally { setBusy(false) }
  }

  async function add(e) {
    e.preventDefault()
    if (form.password.length < 8) { setMessage({ ok: false, text: 'The password must be at least 8 characters.' }); return }
    const ok = await act({ action: 'create', ...form, email: form.email.trim().toLowerCase(), full_name: form.full_name.trim() }, `${form.full_name.trim()} can now sign in to debbit OS with ${form.email.trim()}.`)
    if (ok) setForm({ role: 'SALES', full_name: '', email: '', password: '' })
  }

  function resetPassword(r) {
    const pw = window.prompt(`New password for ${r.full_name} (at least 8 characters)`)
    if (pw == null) return
    if (pw.length < 8) { setMessage({ ok: false, text: 'The password must be at least 8 characters.' }); return }
    void act({ action: 'update', auth_user_id: r.auth_user_id, password: pw }, `Password changed for ${r.full_name}.`)
  }

  const th = { textAlign: 'left', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 10px' }
  const td = { padding: '10px', borderTop: '1px solid var(--panel-border)', fontSize: 13.5 }
  const small = { ...primaryButton, padding: '6px 12px', fontSize: 12.5 }

  return (
    <AppShell title="Team logins" subtitle="Add the people who use debbit OS and choose what each of them can do. Each person signs in to the desktop app with their own email and password, on any computer — nothing is set up on the computer itself.">
      <div style={{ display: 'grid', gap: 18 }}>
        {message && <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--panel-border)', color: message.ok ? '#2FBF8F' : 'var(--alert-coral)' }}>{message.text}</div>}

        <Panel title="Add a person">
          <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, alignItems: 'end' }}>
            <select style={input} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} aria-label="Role">
              {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input style={input} placeholder="Full name" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            <input style={input} type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input style={input} type="password" autoComplete="new-password" placeholder="Password (8+ characters)" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            <button type="submit" disabled={busy || !businessId} style={primaryButton}>{busy ? 'Adding…' : 'Add login'}</button>
          </form>
        </Panel>

        <Panel title="Who can sign in">
          {rows === null ? <EmptyState>Loading…</EmptyState> : rows.length === 0 ? <EmptyState>No logins yet.</EmptyState> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Status</th><th style={th} /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.auth_user_id}>
                      <td style={td}>{r.full_name}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{r.email}</td>
                      <td style={td}>
                        {r.role === 'MASTER' ? 'Owner' : (
                          <select style={{ ...input, padding: '6px 8px' }} value={r.role} disabled={busy} aria-label={`Role for ${r.full_name}`}
                            onChange={(e) => void act({ action: 'update', auth_user_id: r.auth_user_id, role: e.target.value }, `${r.full_name} is now ${roleLabel(e.target.value)}.`)}>
                            {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        )}
                      </td>
                      <td style={{ ...td, color: r.is_active ? '#2FBF8F' : 'var(--alert-coral)' }}>{r.is_active ? 'Active' : 'Switched off'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {r.role !== 'MASTER' && (
                          <>
                            <button type="button" style={small} disabled={busy} onClick={() => resetPassword(r)}>Reset password</button>{' '}
                            <button type="button" style={small} disabled={busy}
                              onClick={() => void act({ action: 'update', auth_user_id: r.auth_user_id, is_active: !r.is_active }, r.is_active ? `${r.full_name} is switched off on every computer.` : `${r.full_name} can sign in again.`)}>
                              {r.is_active ? 'Switch off' : 'Switch on'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  )
}
