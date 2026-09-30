import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { clerkEnabled, clerkOrFallbackMessage, useAuth } from '../lib/clerk'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { EmptyState, Panel, StatCard } from '../components/ui'

const EVENT_TYPES = ['CRASH', 'ERROR', 'SYNC_FAIL', 'MYINVOIS_FAIL', 'HEALTH']

const severityColor = (severity) => {
  if (!severity) return 'var(--text-muted)'
  const s = String(severity).toUpperCase()
  if (s === 'CRITICAL') return 'var(--alert-coral)'
  if (s === 'ERROR') return 'var(--alert-coral)'
  if (s === 'WARN' || s === 'WARNING') return 'var(--balance-pink)'
  if (s === 'INFO') return 'var(--lilac-mist)'
  return 'var(--text-muted)'
}

const eventTypeColor = (type) => {
  if (!type) return 'var(--text-muted)'
  const t = String(type).toUpperCase()
  if (t === 'CRASH') return 'var(--alert-coral)'
  if (t === 'ERROR') return 'var(--alert-coral)'
  if (t === 'SYNC_FAIL') return 'var(--balance-pink)'
  if (t === 'MYINVOIS_FAIL') return 'var(--balance-pink)'
  if (t === 'HEALTH') return '#2FBF8F'
  return 'var(--text-muted)'
}

export default function HealthPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [events, setEvents] = useState([])
  const [weekEvents, setWeekEvents] = useState([])

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
        const since = new Date(Date.now() - 7 * 86400000).toISOString()
        // Table = latest 100 (all time). Counts = a SEPARATE 7-day-bounded query
        // (capped at 5000) so the summary cards are not silently limited to
        // whatever happened to fall inside the most recent 100 rows.
        const [recent, week] = await Promise.all([
          supabase
            .from('app_telemetry')
            .select('business_id, device_id, app_version, platform, event_type, scope, severity, message, occurred_at')
            .order('occurred_at', { ascending: false })
            .limit(100),
          supabase
            .from('app_telemetry')
            .select('event_type, occurred_at')
            .gte('occurred_at', since)
            .limit(5000),
        ])
        if (recent.error) throw recent.error
        if (week.error) throw week.error
        setEvents(recent.data || [])
        setWeekEvents(week.data || [])
      } catch (err) {
        setStatus(err.message || 'Failed to load telemetry data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isLoaded, isSignedIn])

  // Counts come from the dedicated 7-day query (weekEvents) — NOT capped by the
  // 100-row recent-events table. Unknown event types are intentionally skipped.
  const countByType = useMemo(() => {
    const counts = {}
    for (const type of EVENT_TYPES) counts[type] = 0
    for (const e of weekEvents) {
      const t = (e.event_type || '').toUpperCase()
      if (t in counts) counts[t] += 1
    }
    return counts
  }, [weekEvents])

  const byVersion = useMemo(() => {
    const map = new Map()
    for (const e of events) {
      const ver = e.app_version || 'Unknown'
      if (!map.has(ver)) map.set(ver, { version: ver, total: 0, errors: 0 })
      const row = map.get(ver)
      row.total += 1
      const t = (e.event_type || '').toUpperCase()
      if (t === 'CRASH' || t === 'ERROR' || t === 'SYNC_FAIL' || t === 'MYINVOIS_FAIL') row.errors += 1
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8)
  }, [events])

  return (
    <AppShell
      title='Health & Telemetry'
      subtitle='Desktop crash reports, sync failures, and integration health from connected devices.'
    >
      {!clerkEnabled ? (
        <Panel>{clerkOrFallbackMessage()}</Panel>
      ) : !hasSupabaseConfig ? (
        <Panel>Supabase configuration is required to view telemetry data.</Panel>
      ) : !isLoaded ? (
        <Panel>Loading Clerk session...</Panel>
      ) : !isSignedIn ? (
        <Panel>Sign in from the Login page to view telemetry.</Panel>
      ) : status ? (
        <Panel>{status}</Panel>
      ) : loading ? (
        <Panel>Loading telemetry data…</Panel>
      ) : (
        <>
          {/* Summary cards — counts by event type in last 7 days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <StatCard label='Crashes (7d)' value={String(countByType.CRASH ?? 0)} accent='var(--alert-coral)' />
            <StatCard label='Errors (7d)' value={String(countByType.ERROR ?? 0)} accent='var(--alert-coral)' />
            <StatCard label='Sync Failures (7d)' value={String(countByType.SYNC_FAIL ?? 0)} accent='var(--balance-pink)' />
            <StatCard label='MyInvois Failures (7d)' value={String(countByType.MYINVOIS_FAIL ?? 0)} accent='var(--balance-pink)' />
            <StatCard label='Health Pings (7d)' value={String(countByType.HEALTH ?? 0)} accent='#2FBF8F' />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18, marginBottom: 20, alignItems: 'start' }}>
            {/* Recent events table */}
            <Panel title='Recent Events' subtitle='Latest 100 telemetry events from all connected devices, sorted by time.'>
              {events.length === 0 ? (
                <EmptyState>No telemetry events found. Events will appear here once desktop clients start reporting.</EmptyState>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        {['Time', 'Type', 'Severity', 'Scope', 'Version', 'Platform', 'Device', 'Message'].map(h => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e, i) => (
                        <tr key={`${e.device_id || 'd'}-${e.occurred_at || 't'}-${i}`}>
                          <td style={td}>
                            <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                              {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : '—'}
                            </span>
                          </td>
                          <td style={td}>
                            <span style={{ color: eventTypeColor(e.event_type), fontWeight: 600, fontSize: 11 }}>
                              {e.event_type || '—'}
                            </span>
                          </td>
                          <td style={td}>
                            <span style={{ color: severityColor(e.severity), fontSize: 11 }}>
                              {e.severity || '—'}
                            </span>
                          </td>
                          <td style={td}><span style={{ fontSize: 11 }}>{e.scope || '—'}</span></td>
                          <td style={td}><span style={{ fontSize: 11 }}>{e.app_version || '—'}</span></td>
                          <td style={td}><span style={{ fontSize: 11 }}>{e.platform || '—'}</span></td>
                          <td style={td}>
                            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }} title={e.device_id || ''}>
                              {e.device_id ? `${e.device_id.slice(0, 8)}…` : '—'}
                            </span>
                          </td>
                          <td style={{ ...td, maxWidth: 240 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.message || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* By app version rollup */}
            <Panel title='By App Version' subtitle='Event counts across all time for the most active versions.'>
              {byVersion.length === 0 ? (
                <EmptyState>No version data yet.</EmptyState>
              ) : (
                byVersion.map(row => (
                  <div key={row.version} style={versionRow}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.version}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {row.total} event{row.total !== 1 ? 's' : ''}
                      {row.errors > 0 ? (
                        <span style={{ color: 'var(--alert-coral)', marginLeft: 6 }}>· {row.errors} error{row.errors !== 1 ? 's' : ''}</span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 6, height: 4, background: 'var(--midnight-ink)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(4, Math.round((row.total / (byVersion[0]?.total || 1)) * 100))}%`,
                        background: row.errors > 0 ? 'linear-gradient(90deg, var(--alert-coral), var(--alert-coral))' : 'linear-gradient(90deg, var(--royal-violet), var(--balance-pink))',
                      }} />
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
const th = { textAlign: 'left', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--panel-border)', whiteSpace: 'nowrap' }
const td = { padding: '8px 8px', fontSize: 13, borderBottom: '1px solid var(--panel-border)', verticalAlign: 'top' }
const versionRow = { padding: '10px 0', borderBottom: '1px solid var(--panel-border)' }
