import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../lib/clerk'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { EmptyState, Panel, StatCard, input } from '../components/ui'

const fmtMoney = (n) => `INR ${Math.abs(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function OpsAnalyticsPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [workstations, setWorkstations] = useState([])
  const [auditRows, setAuditRows] = useState([])
  const [salesRows, setSalesRows] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [activeBusiness, setActiveBusiness] = useState('')

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    async function load() {
      if (!supabase) {
        setLoading(false)
        return
      }

      setLoading(true)
      setStatus('')
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
        const { data: memberRows, error: memberError } = await supabase
          .from('business_members')
          .select('business_id, businesses(name)')

        if (memberError) throw memberError

        const businessMap = new Map()
        ;(memberRows || []).forEach(row => {
          businessMap.set(row.business_id, {
            id: row.business_id,
            name: row.businesses?.name || row.business_id,
          })
        })
        const bizRows = [...businessMap.values()]
        setBusinesses(bizRows)
        const selectedBusiness = activeBusiness || bizRows[0]?.id || ''
        setActiveBusiness(selectedBusiness)

        const [wsRes, auditRes, salesRes] = await Promise.all([
          supabase
            .from('workstation_devices')
            .select('*')
            .order('updated_at', { ascending: false }),
          supabase
            .from('workstation_audit_logs')
            .select('*')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false })
            .limit(150),
          supabase
            .from('sales')
            .select('business_id, total, sale_date, workstation_id, workstation_code, branch_name, sold_by, is_void')
            .eq('is_void', false)
            .gte('sale_date', thirtyDaysAgo.slice(0, 10))
            .order('sale_date', { ascending: false })
            .limit(500),
        ])

        if (wsRes.error) throw wsRes.error
        if (auditRes.error) throw auditRes.error
        if (salesRes.error) throw salesRes.error

        setWorkstations(wsRes.data || [])
        setAuditRows(auditRes.data || [])
        setSalesRows(salesRes.data || [])
      } catch (error) {
        setStatus(error.message || 'Failed to load ops analytics')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [activeBusiness, isLoaded, isSignedIn])

  const filteredWorkstations = useMemo(
    () => workstations.filter(item => !activeBusiness || item.business_id === activeBusiness),
    [workstations, activeBusiness]
  )
  const filteredAudit = useMemo(
    () => auditRows.filter(item => !activeBusiness || item.business_id === activeBusiness),
    [auditRows, activeBusiness]
  )
  const filteredSales = useMemo(
    () => salesRows.filter(item => !activeBusiness || item.business_id === activeBusiness),
    [salesRows, activeBusiness]
  )

  const totals = useMemo(() => {
    const branchMap = new Map()
    const workstationMap = new Map()

    for (const row of filteredSales) {
      const branchName = row.branch_name || 'No branch'
      const workstationKey = row.workstation_id || row.workstation_code || 'UNSET'
      const workstationName = row.workstation_code || 'UNSET'
      const total = Number(row.total || 0)

      if (!branchMap.has(branchName)) branchMap.set(branchName, { branch: branchName, sales: 0, txns: 0 })
      const branch = branchMap.get(branchName)
      branch.sales += total
      branch.txns += 1

      if (!workstationMap.has(workstationKey)) {
        workstationMap.set(workstationKey, {
          id: workstationKey,
          workstation: workstationName,
          branch: branchName,
          sales: 0,
          txns: 0,
        })
      }
      const workstation = workstationMap.get(workstationKey)
      workstation.sales += total
      workstation.txns += 1
    }

    return {
      totalSales: filteredSales.reduce((sum, row) => sum + Number(row.total || 0), 0),
      totalTxns: filteredSales.length,
      branchRows: [...branchMap.values()].sort((a, b) => b.sales - a.sales),
      workstationRows: [...workstationMap.values()].sort((a, b) => b.sales - a.sales),
      totalAudit: filteredAudit.length,
    }
  }, [filteredAudit, filteredSales])

  return (
    <AppShell
      title='Ops Analytics'
      subtitle='Branch and workstation performance from synced desktop terminal activity.'
      actions={
        <div style={{ minWidth: 240 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Business</label>
          <select value={activeBusiness} onChange={e => setActiveBusiness(e.target.value)} style={input}>
            {businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      }
    >

        {!clerkEnabled ? (
          <Panel>{clerkOrFallbackMessage()}</Panel>
        ) : !hasSupabaseConfig ? (
          <Panel>Supabase configuration is required for ops analytics.</Panel>
        ) : !isLoaded ? (
          <Panel>Loading Clerk session...</Panel>
        ) : !isSignedIn ? (
          <Panel>Sign in from the Login page to view ops analytics.</Panel>
        ) : status ? (
          <Panel>{status}</Panel>
        ) : loading ? (
          <Panel>Loading ops analytics…</Panel>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
              <StatCard label='30-Day Sales' value={fmtMoney(totals.totalSales)} accent='#2FBF8F' />
              <StatCard label='30-Day Transactions' value={String(totals.totalTxns)} accent='var(--balance-pink)' />
              <StatCard label='Tracked Workstations' value={String(filteredWorkstations.length)} />
              <StatCard label='Terminal Events' value={String(totals.totalAudit)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
              <Panel title='Branch Performance'>
                {totals.branchRows.length === 0 ? (
                  <EmptyState>No branch-tagged sales synced yet.</EmptyState>
                ) : (
                  totals.branchRows.map(item => (
                    <MetricRow
                      key={item.branch}
                      title={item.branch}
                      subtitle={`${item.txns} sale${item.txns === 1 ? '' : 's'}`}
                      value={fmtMoney(item.sales)}
                      ratio={totals.totalSales > 0 ? item.sales / totals.totalSales : 0}
                    />
                  ))
                )}
              </Panel>

              <Panel title='Workstation Performance'>
                {totals.workstationRows.length === 0 ? (
                  <EmptyState>No workstation-tagged sales synced yet.</EmptyState>
                ) : (
                  totals.workstationRows.map(item => (
                    <MetricRow
                      key={item.id}
                      title={item.workstation}
                      subtitle={`${item.branch} · ${item.txns} sale${item.txns === 1 ? '' : 's'}`}
                      value={fmtMoney(item.sales)}
                      ratio={totals.totalSales > 0 ? item.sales / totals.totalSales : 0}
                    />
                  ))
                )}
              </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 18 }}>
              <Panel title='Registered Workstations'>
                {filteredWorkstations.length === 0 ? (
                  <EmptyState>No workstations synced yet.</EmptyState>
                ) : (
                  filteredWorkstations.map(item => (
                    <div key={item.id} style={listRow}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.code} · {item.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.branch_name || 'No branch'}</div>
                      </div>
                      <div style={{ fontSize: 12, color: item.is_active ? '#2FBF8F' : 'var(--text-muted)' }}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  ))
                )}
              </Panel>

              <Panel title='Recent Terminal Audit Feed'>
                {filteredAudit.length === 0 ? (
                  <EmptyState>No terminal audit events synced yet.</EmptyState>
                ) : (
                  filteredAudit.slice(0, 20).map(item => (
                    <div key={item.id} style={listRow}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.event_type}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {(item.workstation_code || 'UNSET')} · {item.branch_name || 'No branch'}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
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

function MetricRow({ title, subtitle, value, ratio }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
        </div>
        <div style={{ fontWeight: 700 }}>{value}</div>
      </div>
      <div style={{ height: 8, background: 'var(--midnight-ink)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
        <div style={{ height: '100%', width: `${Math.max(4, Math.round((ratio || 0) * 100))}%`, background: 'linear-gradient(90deg, var(--royal-violet), var(--balance-pink))' }} />
      </div>
    </div>
  )
}

const listRow = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--panel-border)' }
