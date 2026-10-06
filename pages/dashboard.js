import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import Protected from '../components/Protected'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../lib/clerk'
import { hasSupabaseConfig, useClerkSupabaseClient } from '../lib/supabase'
import { money, monthLabel } from '../lib/format'
import { chooseAccessibleBusiness } from '../lib/businessSelection.mjs'

async function fetchGlSum(client, businessId, { category, entryType, monthOffset = 0 }) {
  if (!client || !businessId) return 0
  const date = new Date()
  date.setMonth(date.getMonth() + monthOffset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const from = `${year}-${month}-01`
  const to = `${year}-${month}-31`

  const { data, error } = await client
    .from('gl_entries')
    .select('amount, gl_accounts!inner(category)')
    .eq('entry_type', entryType)
    .eq('business_id', businessId)
    .eq('gl_accounts.category', category)
    .gte('entry_date', from)
    .lte('entry_date', to)

  if (error) throw error
  if (!data) return 0
  return data.reduce((sum, row) => sum + (row.amount || 0), 0)
}

async function fetchGlBalance(client, businessId, code, normalSide) {
  if (!client || !businessId) return 0
  const { data: dr, error: drError } = await client.from('gl_entries')
    .select('amount, gl_accounts!inner(code)')
    .eq('entry_type', 'DEBIT')
    .eq('business_id', businessId)
    .eq('gl_accounts.code', code)

  const { data: cr, error: crError } = await client.from('gl_entries')
    .select('amount, gl_accounts!inner(code)')
    .eq('entry_type', 'CREDIT')
    .eq('business_id', businessId)
    .eq('gl_accounts.code', code)

  if (drError) throw drError
  if (crError) throw crError
  const drSum = (dr || []).reduce((sum, row) => sum + (row.amount || 0), 0)
  const crSum = (cr || []).reduce((sum, row) => sum + (row.amount || 0), 0)
  return normalSide === 'DEBIT' ? drSum - crSum : crSum - drSum
}

async function fetchSevenDayRevenue(client, businessId) {
  if (!client || !businessId) return []
  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push(date.toISOString().slice(0, 10))
  }

  const { data, error } = await client.from('sales')
    .select('sale_date, total')
    .gte('sale_date', days[0])
    .lte('sale_date', days[days.length - 1])
    .eq('is_void', false)
    .eq('business_id', businessId)

  if (error) throw error

  const totals = {}
  days.forEach(day => { totals[day] = 0 })
  ;(data || []).forEach(row => {
    totals[row.sale_date] = (totals[row.sale_date] || 0) + (row.total || 0)
  })

  return days.map(day => ({ date: day, total: totals[day] }))
}

async function fetchAnomalies(client, businessId) {
  if (!client || !businessId) return []
  const items = []

  const { data: shifts, error: shiftsError } = await client.from('shift_reconciliations')
    .select('shift_end, variance_sen, employees(full_name)')
    .eq('flagged', true)
    .eq('business_id', businessId)
    .gte('shift_end', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('shift_end', { ascending: false })
    .limit(3)
  if (shiftsError) throw shiftsError

  for (const shift of shifts || []) {
    const variance = ((shift.variance_sen || 0) / 100).toFixed(2)
    const sign = (shift.variance_sen || 0) >= 0 ? '+' : ''
    items.push({
      severity: 'warning',
      title: 'Shift Cash Variance',
      detail: `${shift.employees?.full_name || 'Cashier'} - variance RM ${sign}${variance} on ${shift.shift_end?.slice(0, 10)}`,
      module: 'Shifts',
    })
  }

  const { data: budgets, error: budgetsError } = await client.from('budgets')
    .select('department, category, monthly_limit, spent')
    .filter('spent', 'gte', 0)
    .eq('business_id', businessId)
    .limit(20)
  if (budgetsError) throw budgetsError

  for (const budget of budgets || []) {
    if (!budget.monthly_limit || budget.monthly_limit <= 0) continue
    const pct = (budget.spent / budget.monthly_limit) * 100
    if (pct >= 110) {
      items.push({
        severity: pct >= 130 ? 'danger' : 'warning',
        title: `Budget Overrun - ${budget.department || budget.category || 'Unknown'}`,
        detail: `${pct.toFixed(0)}% of RM ${(budget.monthly_limit || 0).toFixed(2)} limit spent`,
        module: 'Finance',
      })
    }
  }

  const now = Date.now()
  const dateOffset = (offset) => new Date(now + offset * 86400000).toISOString().slice(0, 10)
  const { data: currentWeek, error: currentError } = await client.from('sales')
    .select('total')
    .eq('is_void', false)
    .eq('business_id', businessId)
    .gte('sale_date', dateOffset(-7))
    .lte('sale_date', dateOffset(0))
  if (currentError) throw currentError

  const { data: previousWeek, error: previousError } = await client.from('sales')
    .select('total')
    .eq('is_void', false)
    .eq('business_id', businessId)
    .gte('sale_date', dateOffset(-14))
    .lte('sale_date', dateOffset(-8))
  if (previousError) throw previousError

  const currentTotal = (currentWeek || []).reduce((sum, row) => sum + (row.total || 0), 0)
  const previousTotal = (previousWeek || []).reduce((sum, row) => sum + (row.total || 0), 0)
  if (previousTotal > 0 && currentTotal < previousTotal * 0.8) {
    const drop = (((previousTotal - currentTotal) / previousTotal) * 100).toFixed(0)
    items.push({
      severity: 'warning',
      title: `Revenue Drop ${drop}% vs Prior Week`,
      detail: `Current 7-day: RM ${currentTotal.toFixed(2)} vs prior: RM ${previousTotal.toFixed(2)}`,
      module: 'POS',
    })
  }

  return items
}

function BarChart({ data }) {
  if (!data?.length) return null
  const width = 600
  const height = 120
  const padding = { t: 10, b: 28, l: 4, r: 4 }
  const innerWidth = width - padding.l - padding.r
  const innerHeight = height - padding.t - padding.b
  const maxValue = Math.max(...data.map(item => item.total), 1)
  const barWidth = innerWidth / data.length

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 120, display: 'block' }}>
      {data.map((item, index) => {
        const barHeight = Math.max(2, (item.total / maxValue) * innerHeight)
        const x = padding.l + index * barWidth + barWidth * 0.1
        const y = padding.t + innerHeight - barHeight
        const label = item.date.slice(5)

        return (
          <g key={item.date}>
            <rect x={x} y={y} width={barWidth * 0.8} height={barHeight} fill='#2FBF8F' rx='3' opacity='0.85' />
            <text x={x + barWidth * 0.4} y={height - 5} textAnchor='middle' fontSize='9' fill='#C9B8D9'>{label}</text>
            {item.total > 0 ? (
              <text x={x + barWidth * 0.4} y={y - 3} textAnchor='middle' fontSize='8' fill='#2FBF8F'>
                {Math.round(item.total)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function BillingBanner({ client, businessId }) {
  const { isSignedIn } = useAuth()
  const [billing, setBilling] = useState(null)

  useEffect(() => {
    if (!isSignedIn || !client || !businessId) return
    let cancelled = false
    client
      .from('businesses')
      .select('subscription_status, trial_ends_at')
      .eq('id', businessId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setBilling(data || null) })
    return () => { cancelled = true }
  }, [isSignedIn, client, businessId])

  if (!billing || billing.subscription_status === 'active') return null

  const trialDays = billing.subscription_status === 'trialing' && billing.trial_ends_at
    ? Math.ceil((new Date(billing.trial_ends_at).getTime() - Date.now()) / 86400000)
    : null

  const severe = ['past_due', 'unpaid', 'canceled'].includes(billing.subscription_status) || (trialDays != null && trialDays <= 0)
  const text = billing.subscription_status === 'canceled' ? 'Your subscription was canceled.'
    : billing.subscription_status === 'unpaid' ? 'Your last payment failed.'
    : billing.subscription_status === 'past_due' ? 'Your payment is past due.'
    : trialDays != null && trialDays <= 0 ? 'Your free trial has ended.'
    : trialDays != null ? `${trialDays} day${trialDays === 1 ? '' : 's'} left in your free trial.`
    : null
  if (!text) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '10px 16px', borderRadius: 9, marginBottom: 20, fontSize: 13,
      background: severe ? 'rgba(244,117,107,0.1)' : 'rgba(224,139,176,0.1)',
      border: `1px solid ${severe ? 'rgba(244,117,107,0.3)' : 'rgba(224,139,176,0.3)'}`,
      color: severe ? '#f8a29b' : 'var(--balance-pink)',
    }}>
      <span>{text} Desktop write access locks once the trial or subscription lapses.</span>
      <Link href="/upgrade" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>Upgrade</Link>
    </div>
  )
}

export default function CfoDashboard() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const clerkSupabase = useClerkSupabaseClient()
  const [businessId, setBusinessId] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const loadSequence = useRef(0)
  const [metrics, setMetrics] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [trustSummary, setTrustSummary] = useState({ openTickets: 0, flaggedShifts: 0, recentAudit: 0, liveMode: false })

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !clerkSupabase) {
      setBusinessId(null)
      setBusinesses([])
      return
    }
    let cancelled = false
    clerkSupabase.from('businesses').select('id, name').order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError('Could not securely load your businesses. Please refresh.')
          setBusinesses([])
          setBusinessId(null)
          return
        }
        const accessibleBusinesses = data || []
        setBusinesses(accessibleBusinesses)
        const savedId = typeof window !== 'undefined'
          ? window.localStorage.getItem(`debbit-dashboard-business:${userId}`)
          : null
        const selected = chooseAccessibleBusiness(accessibleBusinesses, savedId)
        setBusinessId(selected?.id || null)
      })
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, clerkSupabase, userId])

  function selectBusiness(nextBusinessId) {
    if (!businesses.some(business => business.id === nextBusinessId)) return
    loadSequence.current += 1
    setBusinessId(nextBusinessId)
    setMetrics(null)
    setRevenueData([])
    setAnomalies([])
    setTrustSummary({ openTickets: 0, flaggedShifts: 0, recentAudit: 0, liveMode: false })
    if (typeof window !== 'undefined' && userId) {
      window.localStorage.setItem(`debbit-dashboard-business:${userId}`, nextBusinessId)
    }
  }

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    if (!clerkSupabase || !isSignedIn || !businessId) {
      setMetrics(null)
      setRevenueData([])
      setAnomalies([])
      setLastRefresh(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [revenue, expenses, cogsExp, cash, ar, ap, days7, anoms, exp1, exp2, ticketsRes, shiftsRes, auditRes] = await Promise.all([
        fetchGlSum(clerkSupabase, businessId, { category: 'REVENUE', entryType: 'CREDIT' }),
        fetchGlSum(clerkSupabase, businessId, { category: 'EXPENSE', entryType: 'DEBIT' }),
        fetchGlSum(clerkSupabase, businessId, { category: 'COGS', entryType: 'DEBIT' }),
        fetchGlBalance(clerkSupabase, businessId, '1100', 'DEBIT'),
        fetchGlBalance(clerkSupabase, businessId, '1200', 'DEBIT'),
        fetchGlBalance(clerkSupabase, businessId, '2100', 'CREDIT'),
        fetchSevenDayRevenue(clerkSupabase, businessId),
        fetchAnomalies(clerkSupabase, businessId),
        fetchGlSum(clerkSupabase, businessId, { category: 'EXPENSE', entryType: 'DEBIT', monthOffset: -1 }),
        fetchGlSum(clerkSupabase, businessId, { category: 'EXPENSE', entryType: 'DEBIT', monthOffset: -2 }),
        clerkSupabase.from('support_tickets').select('id,status').eq('status', 'open').eq('business_id', businessId),
        clerkSupabase.from('shift_reconciliations').select('id').eq('flagged', true).eq('business_id', businessId).limit(50),
        clerkSupabase.from('workstation_audit_logs').select('id').eq('business_id', businessId).order('created_at', { ascending: false }).limit(25),
      ])
      if (sequence !== loadSequence.current) return
      const failedRead = [ticketsRes, shiftsRes, auditRes].find(result => result.error)
      if (failedRead?.error) throw failedRead.error

      const totalExpenses = expenses + cogsExp
      const netProfit = revenue - totalExpenses
      const burnRate = ((totalExpenses + exp1 + exp2) / 3) || totalExpenses
      const runway = burnRate > 0 ? (cash / burnRate).toFixed(1) : null

      setMetrics({
        cash: Math.max(0, cash),
        revenue,
        expenses: totalExpenses,
        netProfit,
        ar: Math.max(0, ar),
        ap: Math.max(0, ap),
        burnRate,
        runway,
      })
      setRevenueData(days7)
      setAnomalies(anoms)
      setTrustSummary({
        openTickets: (ticketsRes.data || []).length,
        flaggedShifts: (shiftsRes.data || []).length,
        recentAudit: (auditRes.data || []).length,
        liveMode: true,
      })
      setLastRefresh(new Date().toLocaleTimeString())
    } catch (err) {
      if (sequence !== loadSequence.current) return
      setError('Failed to load your business data. Check the Clerk–Supabase connection and refresh.')
      setMetrics(null)
      setRevenueData([])
      setAnomalies([])
      setTrustSummary({ openTickets: 0, flaggedShifts: 0, recentAudit: 0, liveMode: false })
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [isSignedIn, clerkSupabase, businessId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <Protected>
      <div style={{ padding: '32px 28px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--paper-white)' }}>CFO Overview</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{monthLabel()} · debbit OS</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {businesses.length > 1 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                Business
                <select aria-label="Select business" value={businessId || ''} onChange={event => selectBusiness(event.target.value)} style={{ padding: '8px 12px', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 9, color: 'var(--paper-white)', fontSize: 13 }}>
                  {businesses.map(business => <option key={business.id} value={business.id}>{business.name || business.id}</option>)}
                </select>
              </label>
            )}
            {lastRefresh ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Refreshed {lastRefresh}</span> : null}
            <button onClick={load} style={{ padding: '8px 16px', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 9, color: 'var(--paper-white)', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
              Refresh
            </button>
          </div>
        </div>

        <BillingBanner client={clerkSupabase} businessId={businessId} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(47,191,143,0.1)', border: '1px solid rgba(47,191,143,0.3)', borderRadius: 9, marginBottom: 24, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2FBF8F', display: 'inline-block', boxShadow: '0 0 6px #2FBF8F' }} />
          <span style={{ color: '#7fe0c4', fontWeight: 600 }}>
            {hasSupabaseConfig ? 'Live data — connected to Supabase' : 'Live data — waiting for Supabase configuration'}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
            {hasSupabaseConfig ? 'SUPABASE_LIVE' : 'CONFIG_REQUIRED'}
          </span>
        </div>

        {error && <div style={{ color: 'var(--alert-coral)', padding: '1rem' }}>{error}</div>}

        {!clerkEnabled ? (
          <EmptyState message={clerkOrFallbackMessage()} />
        ) : !hasSupabaseConfig ? (
          <EmptyState message='Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable the live CFO dashboard.' />
        ) : !isLoaded ? (
          <EmptyState message='Loading Clerk session...' />
        ) : !isSignedIn ? (
          <EmptyState message='Sign in from the Login page to view the CFO dashboard.' />
        ) : loading && !metrics ? (
          <EmptyState message='Loading CFO data...' />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
              <MetricCard label='Open Support Tickets' value={String(trustSummary.openTickets)} sub='Owner support queue' color={trustSummary.openTickets > 0 ? 'var(--alert-coral)' : '#2FBF8F'} />
              <MetricCard label='Flagged Shifts' value={String(trustSummary.flaggedShifts)} sub='Cash-control exceptions' color={trustSummary.flaggedShifts > 0 ? 'var(--alert-coral)' : '#2FBF8F'} />
              <MetricCard label='Recent Audit Events' value={String(trustSummary.recentAudit)} sub='Latest operator activity' color='var(--balance-pink)' />
              <MetricCard label='Cloud Mode' value={trustSummary.liveMode ? 'Live' : 'Pending'} sub='Hosted data plane state' color={trustSummary.liveMode ? '#2FBF8F' : 'var(--alert-coral)'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
              <MetricCard label='Net Cash Position' value={money(metrics?.cash)} sub='Current balance' color='#2FBF8F' />
              <MetricCard label='Monthly Revenue' value={money(metrics?.revenue)} sub='This period' />
              <MetricCard label='Monthly Expenses' value={money(metrics?.expenses)} sub='COGS + OpEx' color='var(--alert-coral)' />
              <MetricCard label='Net Profit' value={money(metrics?.netProfit)} sub={(metrics?.netProfit || 0) >= 0 ? 'Profitable' : 'Loss period'} color={(metrics?.netProfit || 0) >= 0 ? '#2FBF8F' : 'var(--alert-coral)'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
              <MetricCard label='Monthly Burn Rate' value={money(metrics?.burnRate)} sub='Avg 3-month' color='var(--balance-pink)' />
              <MetricCard label='Outstanding Receivables' value={money(metrics?.ar)} sub='Accounts receivable' />
              <MetricCard label='Outstanding Payables' value={money(metrics?.ap)} sub='Accounts payable' />
              <MetricCard label='Estimated Runway' value={metrics?.runway ? `${metrics.runway} months` : 'Infinite'} sub='At current burn' color={metrics?.runway && parseFloat(metrics.runway) < 3 ? 'var(--alert-coral)' : '#2FBF8F'} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Smart Alerts</span>
                {anomalies.length > 0 ? (
                  <span style={{ background: 'var(--alert-coral)', color: 'var(--debbit-purple)', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    {anomalies.length} Pending
                  </span>
                ) : null}
              </div>
              {anomalies.length === 0 ? (
                <div style={{ padding: 16, background: 'rgba(47,191,143,0.1)', border: '1px solid rgba(47,191,143,0.3)', borderRadius: 9, color: '#7fe0c4', fontSize: 13 }}>
                  No anomalies detected. All systems normal.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {anomalies.map((item, index) => <AnomalyCard key={index} item={item} />)}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 14 }}>
                7-Day Revenue Trend
              </div>
              <BarChart data={revenueData} />
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(224,139,176,0.1)', border: '1px solid rgba(224,139,176,0.3)', color: 'var(--balance-pink)', fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}>
              Trust signal: this dashboard now surfaces financial state together with support ticket count, flagged shifts, and recent audit activity so owners can judge both performance and operational trust from one place.
            </div>
          </>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          {hasSupabaseConfig
            ? 'Real-time data synced from debbit OS offline app via Supabase · Auto-refreshes every 30s'
            : 'Waiting for Supabase configuration before loading live CFO metrics'}
        </div>
      </div>
    </Protected>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      <div className="font-display tabular-nums" style={{ fontSize: 22, fontWeight: 600, color: color || 'var(--paper-white)', lineHeight: 1.2 }}>{value ?? '-'}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div> : null}
    </div>
  )
}

const severityBorder = { danger: 'var(--alert-coral)', warning: 'var(--balance-pink)', info: 'var(--lilac-mist)' }

function AnomalyCard({ item }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      padding: '14px 16px',
      background: 'var(--panel)',
      borderRadius: 9,
      border: '1px solid var(--panel-border)',
      borderLeft: `3px solid ${severityBorder[item.severity] || 'var(--balance-pink)'}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--paper-white)', marginBottom: 3 }}>{item.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.detail}</div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginTop: 4, fontStyle: 'italic' }}>
        Open {item.module} in app
      </span>
    </div>
  )
}

function EmptyState({ message }) {
  return <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>{message}</div>
}
