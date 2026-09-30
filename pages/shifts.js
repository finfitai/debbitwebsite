import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../lib/clerk'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

const fmt = (sen) => (sen != null ? `RM ${(sen / 100).toFixed(2)}` : '-')

const varianceColor = (sen) => {
  if (sen == null) return 'var(--text-muted)'
  const abs = Math.abs(sen)
  if (abs > 2000) return 'var(--alert-coral)'
  if (abs > 500) return 'var(--balance-pink)'
  return '#2FBF8F'
}

export default function Dashboard() {
  const { isLoaded, isSignedIn } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('flagged')
  const [lastRefresh, setLastRefresh] = useState(null)

  async function fetchShifts() {
    if (!supabase || !isSignedIn) {
      setRows([])
      setLoading(false)
      setLastRefresh(null)
      return
    }

    setLoading(true)
    let query = supabase
      .from('shift_reconciliations')
      .select('*, employees(name)')
      .order('shift_start', { ascending: false })
      .limit(100)

    if (filter === 'flagged') query = query.eq('flagged', true)

    const { data, error } = await query
    if (!error) setRows(data || [])
    setLoading(false)
    setLastRefresh(new Date().toLocaleTimeString())
  }

  useEffect(() => { fetchShifts() }, [filter, isSignedIn])
  useEffect(() => {
    const timer = setInterval(fetchShifts, 30000)
    return () => clearInterval(timer)
  }, [filter, isSignedIn])

  const flaggedCount = rows.filter(row => row.flagged).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '32px 24px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--paper-white)' }}>debbit OS - CFO Dashboard</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Shift Reconciliation · Variance Alerts
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {lastRefresh ? `Refreshed ${lastRefresh}` : ''}
            </span>
            <button
              onClick={fetchShifts}
              style={{ padding: '8px 16px', background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 9, color: 'var(--paper-white)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)' }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label='Total Shifts' value={rows.length} color='#2FBF8F' />
          <StatCard label='Flagged Variances' value={flaggedCount} color='var(--balance-pink)' />
          <StatCard
            label='Largest Variance'
            value={rows.length ? fmt(Math.max(...rows.map(row => Math.abs(row.variance_sen || 0)))) : '-'}
            color='var(--alert-coral)'
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['flagged', 'all'].map(value => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                padding: '7px 18px',
                borderRadius: 9,
                border: '1px solid',
                borderColor: filter === value ? 'var(--balance-pink)' : 'var(--panel-border)',
                background: filter === value ? 'rgba(224,139,176,0.1)' : 'transparent',
                color: filter === value ? 'var(--balance-pink)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                fontWeight: filter === value ? 600 : 400,
              }}
            >
              {value === 'flagged' ? 'Flagged Only' : 'All Shifts'}
            </button>
          ))}
        </div>

        {!clerkEnabled ? (
          <EmptyState message={clerkOrFallbackMessage()} />
        ) : !hasSupabaseConfig ? (
          <EmptyState message='Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to load live dashboard data.' />
        ) : !isLoaded ? (
          <EmptyState message='Loading Clerk session...' />
        ) : !isSignedIn ? (
          <EmptyState message='Sign in from the Login page to view shift analytics.' />
        ) : loading ? (
          <EmptyState message='Loading shifts...' />
        ) : rows.length === 0 ? (
          <EmptyState message={filter === 'flagged' ? 'No flagged variances. All shifts reconciled cleanly.' : 'No completed shifts yet.'} />
        ) : (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                  {['Date', 'Cashier', 'Shift Start', 'Shift End', 'Declared', 'Expected', 'Variance', 'Status'].map(header => (
                    <th key={header} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: index < rows.length - 1 ? '1px solid var(--panel-border)' : 'none',
                      background: row.flagged ? 'rgba(224,139,176,0.04)' : 'transparent',
                    }}
                  >
                    <td style={td}>{row.shift_start ? row.shift_start.slice(0, 10) : '-'}</td>
                    <td style={td}>{row.employees?.name || row.cashier_id?.slice(0, 8) || 'Unknown'}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{row.shift_start ? row.shift_start.slice(11, 16) : '-'}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{row.shift_end ? row.shift_end.slice(11, 16) : '-'}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-body)' }} className="tabular-nums">{fmt(row.declared_amount_sen)}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-body)' }} className="tabular-nums">{fmt(row.expected_amount_sen)}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-body)', color: varianceColor(row.variance_sen), fontWeight: 600 }} className="tabular-nums">
                      {row.variance_sen != null ? `${row.variance_sen >= 0 ? '+' : ''}${(row.variance_sen / 100).toFixed(2)}` : '-'}
                    </td>
                    <td style={td}>
                      {row.shift_end == null ? (
                        <span style={{ color: '#2FBF8F', fontSize: 12 }}>Open</span>
                      ) : row.flagged ? (
                        <span style={{ color: 'var(--balance-pink)', fontSize: 12, fontWeight: 600 }}>Flagged</span>
                      ) : (
                        <span style={{ color: '#2FBF8F', fontSize: 12 }}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          {hasSupabaseConfig
            ? 'Flagged = variance > RM 5.00 · Auto-refreshes every 30s · Data synced from debbit OS via Supabase'
            : 'Waiting for Supabase configuration'}
        </div>
      </div>
    </div>
  )
}

const td = { padding: '11px 16px', fontSize: 13, color: 'var(--paper-white)' }

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      <div className="font-display tabular-nums" style={{ fontSize: 26, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

function EmptyState({ message }) {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{message}</div>
}
