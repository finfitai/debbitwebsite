import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { clerkEnabled, clerkOrFallbackMessage, useAuth, useUser } from '../lib/clerk'
import { hasSupabaseConfig, useClerkSupabaseClient } from '../lib/supabase'
import { Panel, StatCard, input, miniInput, primaryButton, secondaryButton } from '../components/ui'

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER', 'VIEWER']

export default function AdminPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const supabase = useClerkSupabaseClient()
  const [businesses, setBusinesses] = useState([])
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [activeBusiness, setActiveBusiness] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('CASHIER')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [workstations, setWorkstations] = useState([])
  const [terminalAudit, setTerminalAudit] = useState([])
  const [summary, setSummary] = useState({ activeMembers: 0, pendingInvites: 0, activeWorkstations: 0, auditEvents: 0 })

  const filteredMembers = useMemo(
    () => members.filter(item => !activeBusiness || item.business_id === activeBusiness),
    [members, activeBusiness]
  )
  const filteredInvites = useMemo(
    () => invites.filter(item => !activeBusiness || item.business_id === activeBusiness),
    [invites, activeBusiness]
  )
  const filteredWorkstations = useMemo(
    () => workstations.filter(item => !activeBusiness || item.business_id === activeBusiness),
    [workstations, activeBusiness]
  )
  const filteredTerminalAudit = useMemo(
    () => terminalAudit.filter(item => !activeBusiness || item.business_id === activeBusiness),
    [terminalAudit, activeBusiness]
  )

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    async function load() {
      if (!supabase) return

      const { data: memberRows } = await supabase
        .from('business_members')
        .select('business_id, user_id, role, is_active, joined_at, users(full_name,email), businesses(name)')
        .order('joined_at', { ascending: false })
      setMembers(memberRows || [])

      const businessMap = new Map()
      ;(memberRows || []).forEach(row => {
        businessMap.set(row.business_id, { id: row.business_id, name: row.businesses?.name || row.business_id })
      })
      const bizRows = [...businessMap.values()]
      setBusinesses(bizRows)
      setActiveBusiness(bizRows[0]?.id || '')

      const { data: inviteRows } = await supabase
        .from('tenant_invites')
        .select('*')
        .order('created_at', { ascending: false })
      setInvites(inviteRows || [])

      const { data: workstationRows } = await supabase
        .from('workstation_devices')
        .select('*')
        .order('updated_at', { ascending: false })
      setWorkstations(workstationRows || [])

      const { data: auditRows } = await supabase
        .from('workstation_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25)
      setTerminalAudit(auditRows || [])
      setSummary({
        activeMembers: (memberRows || []).filter(row => row.is_active).length,
        pendingInvites: (inviteRows || []).filter(row => row.status === 'PENDING' || row.status === 'SENT').length,
        activeWorkstations: (workstationRows || []).filter(row => row.is_active).length,
        auditEvents: (auditRows || []).length,
      })
    }
    load()
  }, [isLoaded, isSignedIn])

  async function sendInvite() {
    if (!supabase || !email || !activeBusiness) return
    setBusy(true)
    setStatus('Sending invite…')
    setInviteLink('')
    try {
      const inviteToken = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const { error } = await supabase.from('tenant_invites').insert({
        business_id: activeBusiness,
        email,
        role,
        status: 'SENT',
        invite_token: inviteToken,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      if (error) {
        setStatus(error.message)
        return
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      setInviteLink(`${origin}/register?invite_token=${inviteToken}&email=${encodeURIComponent(email)}`)
      setStatus('Invite recorded. Share the invite link.')
      setEmail('')
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(item, nextRole) {
    if (!supabase) return
    const { error } = await supabase
      .from('business_members')
      .update({ role: nextRole })
      .eq('business_id', item.business_id)
      .eq('user_id', item.user_id)
    setStatus(error ? error.message : 'Role updated.')
  }

  async function toggleMember(item) {
    if (!supabase) return
    const { error } = await supabase
      .from('business_members')
      .update({ is_active: !item.is_active })
      .eq('business_id', item.business_id)
      .eq('user_id', item.user_id)
    setStatus(error ? error.message : 'Membership updated.')
  }

  async function revokeInvite(item) {
    if (!supabase) return
    const { error } = await supabase
      .from('tenant_invites')
      .update({ status: 'REVOKED' })
      .eq('id', item.id)
    if (error) {
      setStatus(error.message)
      return
    }
    setInvites(current => current.map(inv => (inv.id === item.id ? { ...inv, status: 'REVOKED' } : inv)))
    setStatus('Invite revoked.')
  }

  return (
    <AppShell
      title='Tenant Admin'
      subtitle='Invite staff, review memberships, and manage SME roles from the cloud dashboard.'
      maxWidth={1220}
    >

        {!clerkEnabled ? (
          <Panel>{clerkOrFallbackMessage()}</Panel>
        ) : !hasSupabaseConfig ? (
          <Panel>Supabase configuration is required for tenant administration.</Panel>
        ) : !isLoaded ? (
          <Panel>Loading Clerk session...</Panel>
        ) : !isSignedIn ? (
          <Panel>No active session. Sign in from the Login page first.</Panel>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 18 }}>
              <StatCard label='Active Members' value={String(summary.activeMembers)} accent='var(--balance-pink)' subtext='Current member footprint' />
              <StatCard label='Pending Invites' value={String(summary.pendingInvites)} accent={summary.pendingInvites > 0 ? 'var(--alert-coral)' : '#2FBF8F'} subtext='Onboarding still in flight' />
              <StatCard label='Active Workstations' value={String(summary.activeWorkstations)} accent='var(--balance-pink)' subtext='Synced terminal presence' />
              <StatCard label='Recent Audit Events' value={String(summary.auditEvents)} subtext='Latest operational activity' />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18, marginBottom: 18 }}>
              <Panel title='Invite User'>
                <div style={{ display: 'grid', gap: 12 }}>
                  <select value={activeBusiness} onChange={e => setActiveBusiness(e.target.value)} style={input}>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input style={input} type='email' placeholder='staff@business.com' value={email} onChange={e => setEmail(e.target.value)} />
                  <select value={role} onChange={e => setRole(e.target.value)} style={input}>
                    {ROLE_OPTIONS.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <button style={primaryButton} onClick={sendInvite} disabled={busy}>Send Invite</button>
                  {status ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{status}</div> : null}
                  {inviteLink ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Invite link</div>
                      <input style={{ ...input, fontSize: 12 }} readOnly value={inviteLink} onFocus={e => e.target.select()} />
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel title='Readiness Notes'>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(224,139,176,0.1)', border: '1px solid rgba(224,139,176,0.3)', color: 'var(--balance-pink)', fontSize: 13, lineHeight: 1.5 }}>
                  Clerk handles owner/admin identity. Role changes remain scoped per business membership in Supabase. Invites are tracked in `tenant_invites` for onboarding and auditability.
                </div>
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
              <Panel title='Active Members'>
                <table style={table}>
                  <thead><tr>{['User', 'Business', 'Role', 'State', 'Action'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredMembers.map(item => (
                      <tr key={`${item.business_id}-${item.user_id}`}>
                        <td style={td}>
                          <div>{item.users?.full_name || 'Unknown'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.users?.email || item.user_id}</div>
                        </td>
                        <td style={td}>{item.businesses?.name || item.business_id}</td>
                        <td style={td}>
                          <select style={miniInput} value={item.role} onChange={e => changeRole(item, e.target.value)}>
                            {ROLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </td>
                        <td style={td}>{item.is_active ? 'Active' : 'Disabled'}</td>
                        <td style={td}><button style={secondaryButton} onClick={() => toggleMember(item)}>{item.is_active ? 'Disable' : 'Enable'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <Panel title='Recent Invites'>
                {filteredInvites.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No invites recorded yet.</div>
                ) : (
                  filteredInvites.map(item => (
                    <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--panel-border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--paper-white)' }}>{item.email}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.role} · {item.status} · {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : 'No expiry'}</div>
                      {(item.status === 'PENDING' || item.status === 'SENT') ? (
                        <button style={{ ...secondaryButton, marginTop: 8, padding: '7px 10px', fontSize: 12 }} onClick={() => revokeInvite(item)}>Revoke</button>
                      ) : null}
                    </div>
                  ))
                )}
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18, marginTop: 18 }}>
              <Panel title='Registered Workstations'>
                {filteredWorkstations.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No workstation metadata synced yet.</div>
                ) : (
                  filteredWorkstations.map(item => (
                    <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--panel-border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--paper-white)' }}>{item.code} · {item.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {item.branch_name || 'No branch'} · {item.is_active ? 'Active' : 'Inactive'} · updated {item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'}
                      </div>
                    </div>
                  ))
                )}
              </Panel>

              <Panel title='Terminal Audit Feed'>
                {filteredTerminalAudit.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No terminal audit events synced yet.</div>
                ) : (
                  filteredTerminalAudit.map(item => (
                    <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--panel-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ fontWeight: 600, color: 'var(--paper-white)' }}>{item.event_type}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {(item.workstation_code || 'UNSET')} · {item.branch_name || 'No branch'} · {item.entity_type || 'entity'} {item.entity_id || ''}
                      </div>
                    </div>
                  ))
                )}
              </Panel>
            </div>
          </>
        )}
    </AppShell>
  )
}

const table = { width: '100%', borderCollapse: 'collapse' }
const th = { textAlign: 'left', padding: '10px 8px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--panel-border)' }
const td = { padding: '10px 8px', fontSize: 13, borderBottom: '1px solid var(--panel-border)', verticalAlign: 'top', color: 'var(--paper-white)' }
