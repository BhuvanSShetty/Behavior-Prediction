import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { StateBadge, RiskBar } from '../components/StateBadge'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// Format decimal minutes to "X min Y sec" or just "X sec"
const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '0s'
  const mins = Math.floor(minutes)
  const secs = Math.round((minutes - mins) * 60)
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

const StatCard = ({ label, value, sub, accent }) => (
  <div className="card">
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`text-2xl font-semibold font-mono ${accent || 'text-slate-100'}`}>{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
)

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [children,   setChildren]   = useState([])
  const [selected,   setSelected]   = useState(null)
  const [dashboard,  setDashboard]  = useState(null)
  const [barData,    setBarData]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const { sessionUpdate } = useWebSocket()

  useEffect(() => {
    if (authLoading || user?.role !== 'parent') return
    api.getChildren().then(r => {
      setChildren(r.data)
      if (r.data.length > 0) setSelected(r.data[0]._id)
    }).catch(() => {})
  }, [authLoading, user])

  useEffect(() => {
    if (authLoading || user?.role !== 'parent') return
    if (!selected) return
    setLoading(true)
    api.getDashboard(selected)
      .then(r => setDashboard(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selected, authLoading, user])

  useEffect(() => {
    if (authLoading || user?.role !== 'parent') return
    if (!selected) return
    api.getDashboardWeekly(selected)
      .then(r => setBarData(r.data?.dailyBreakdown || []))
      .catch(() => {})
  }, [selected, authLoading, user])

  // Refresh dashboard when WS pushes a session update for selected child
  useEffect(() => {
    if (authLoading || user?.role !== 'parent') return
    if (sessionUpdate?.userId === selected) {
      api.getDashboard(selected).then(r => setDashboard(r.data)).catch(() => {})
      api.getDashboardWeekly(selected).then(r => setBarData(r.data?.dailyBreakdown || [])).catch(() => {})
    }
  }, [sessionUpdate, selected, authLoading, user])

  const riskColor = (risk) => risk >= 70 ? 'text-red-400' : risk >= 40 ? 'text-amber-400' : 'text-emerald-400'
  const trendColor = (t) => t > 0 ? 'text-red-400' : 'text-emerald-400'

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</p>
        </div>
        {/* Child selector */}
        {children.length > 1 && (
          <select className="input w-auto text-sm" value={selected || ''} onChange={e => setSelected(e.target.value)}>
            {children.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {children.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">No children linked yet.</p>
          <p className="text-slate-600 text-xs mt-1">Go to Children → Link Child to get started.</p>
        </div>
      )}

      {dashboard && !loading && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Play time today" value={formatDuration(dashboard.todayPlayTime)} sub={`${dashboard.sessionCount} sessions`} />
            <StatCard label="Addiction risk"  value={`${dashboard.addictionRisk}/100`}
              sub={<StateBadge state={dashboard.state} />}
              accent={riskColor(dashboard.addictionRisk)} />
            <StatCard label="Weekly trend"    value={`${dashboard.trend >= 0 ? '+' : ''}${formatDuration(Math.abs(dashboard.trend))}`}
              accent={trendColor(dashboard.trend)} sub="vs oldest day this week" />
            <StatCard label="Night sessions"  value={dashboard.nightSessions}
              accent={dashboard.nightSessions > 0 ? 'text-brand-400' : 'text-slate-100'}
              sub="12AM – 4AM" />
          </div>

          {/* Risk bar */}
          <div className="card">
            <p className="text-xs text-slate-500 mb-3">Addiction risk score</p>
            <RiskBar value={dashboard.addictionRisk} />
          </div>

          {/* Bar chart */}
          <div className="card">
            <p className="text-sm font-medium text-slate-300 mb-4">Play time this week</p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} barSize={28}>
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit=" m" width={40} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(v) => [formatDuration(v), 'Play time']}
                  />
                  <Bar dataKey="min" radius={[4,4,0,0]}>
                    {barData.map((d, i) => (
                      <Cell key={i} fill={i === barData.length-1 ? '#6366f1' : '#1e293b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
                No playtime data available for this week.
              </div>
            )}
          </div>

          {/* Active alerts */}
          {(dashboard.alerts?.addictionAlert || dashboard.alerts?.nightGamingAlert || dashboard.alerts?.playtimeLimitExceeded) && (
            <div className="card space-y-2">
              <p className="text-sm font-medium text-slate-300 mb-3">Active alerts</p>
              {dashboard.alerts.addictionAlert && (
                <div className="flex items-center gap-3 p-3 bg-red-950/40 border border-red-800/50 rounded-xl">
                  <div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" />
                  <p className="text-sm text-red-300">High addiction risk detected</p>
                </div>
              )}
              {dashboard.alerts.playtimeLimitExceeded && (
                <div className="flex items-center gap-3 p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl">
                  <div className="w-2 h-2 bg-amber-500 rounded-full pulse-dot" />
                  <p className="text-sm text-amber-300">Daily playtime limit exceeded</p>
                </div>
              )}
              {dashboard.alerts.nightGamingAlert && (
                <div className="flex items-center gap-3 p-3 bg-brand-950/40 border border-brand-800/50 rounded-xl">
                  <div className="w-2 h-2 bg-brand-400 rounded-full pulse-dot" />
                  <p className="text-sm text-brand-300">Night gaming detected</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
