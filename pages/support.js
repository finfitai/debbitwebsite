import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../lib/clerk'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { Panel, StatCard, InfoStrip, input, primaryButton } from '../components/ui'

export default function SupportPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [tickets, setTickets] = useState([])
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [severity, setSeverity] = useState('normal')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState({ openTickets: 0, urgentTickets: 0, activeWorkstations: 0, recentAudit: 0 })

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    async function load() {
      if (!supabase) return
      const [ticketRes, wsRes, auditRes] = await Promise.all([
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('workstation_devices').select('id,is_active'),
        supabase.from('workstation_audit_logs').select('id').order('created_at', { ascending: false }).limit(25),
      ])
      const nextTickets = ticketRes.data || []
      setTickets(nextTickets)
      setSummary({
        openTickets: nextTickets.filter(ticket => ticket.status === 'open').length,
        urgentTickets: nextTickets.filter(ticket => ticket.severity === 'urgent').length,
        activeWorkstations: (wsRes.data || []).filter(row => row.is_active).length,
        recentAudit: (auditRes.data || []).length,
      })
    }
    load()
  }, [isLoaded, isSignedIn])

  async function createTicket() {
    if (!subject?.trim() || !details?.trim()) {
      setMessage('Subject and details are required.')
      return
    }
    if (!supabase) return
    setLoading(true)
    try {
      // TODO: attach business_id once available from Clerk user metadata or a prop
      const { error } = await supabase.from('support_tickets').insert({
        subject,
        details,
        severity,
        source: 'dashboard',
        status: 'open',
      })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Support ticket created.')
        setSubject('')
        setDetails('')
        setSeverity('normal')
        setTimeout(() => setMessage(''), 3000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell
      title='Support & Ops'
      subtitle='Owner-facing support desk for incidents, onboarding issues, integration escalations, and system trust checks.'
      maxWidth={1160}
    >

        {!clerkEnabled ? (
          <Panel>{clerkOrFallbackMessage()}</Panel>
        ) : !hasSupabaseConfig ? (
          <Panel>Supabase configuration is required for support workflow.</Panel>
        ) : !isLoaded ? (
          <Panel>Loading Clerk session...</Panel>
        ) : !isSignedIn ? (
          <Panel>Sign in from the Login page to create or review support tickets.</Panel>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 18 }}>
              <StatCard label='Open Tickets' value={String(summary.openTickets)} accent='var(--balance-pink)' subtext='Current support queue' />
              <StatCard label='Urgent Tickets' value={String(summary.urgentTickets)} accent={summary.urgentTickets > 0 ? 'var(--alert-coral)' : '#2FBF8F'} subtext='Needs immediate review' />
              <StatCard label='Active Workstations' value={String(summary.activeWorkstations)} subtext='Synced device footprint' />
              <StatCard label='Recent Audit Events' value={String(summary.recentAudit)} subtext='Latest operator activity received' />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18 }}>
            <Panel title='Create Ticket'>
              <div style={{ display: 'grid', gap: 12 }}>
                <input style={input} value={subject} onChange={e => setSubject(e.target.value)} placeholder='Short subject' />
                <select style={input} value={severity} onChange={e => setSeverity(e.target.value)}>
                  <option value='low'>Low</option>
                  <option value='normal'>Normal</option>
                  <option value='high'>High</option>
                  <option value='urgent'>Urgent</option>
                </select>
                <textarea style={{ ...input, minHeight: 140 }} value={details} onChange={e => setDetails(e.target.value)} placeholder='Describe the issue, sync state, customer impact, and attempted fixes.' />
                <button style={primaryButton} onClick={createTicket} disabled={loading || !subject?.trim()}>Create Ticket</button>
                {message ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{message}</div> : null}
                <InfoStrip>Include whether the issue affects sales, sync, onboarding, payroll, or printing. That shortens triage time materially.</InfoStrip>
              </div>
            </Panel>

            <Panel title='Recent Tickets'>
              {tickets.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No support tickets yet.</div>
              ) : (
                tickets.map(ticket => (
                  <div key={ticket.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--panel-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong style={{ color: 'var(--paper-white)' }}>{ticket.subject}</strong>
                      <span style={{ color: ticket.severity === 'urgent' ? 'var(--alert-coral)' : ticket.severity === 'high' ? 'var(--balance-pink)' : 'var(--text-muted)', fontSize: 12 }}>
                        {ticket.severity}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{ticket.status} · {new Date(ticket.created_at).toLocaleString()}</div>
                    {ticket.details ? <div style={{ color: 'var(--paper-white)', fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>{ticket.details}</div> : null}
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
