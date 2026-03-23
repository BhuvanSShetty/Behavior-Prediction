import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { StateBadge, RiskBar } from '../components/StateBadge'
import { useWebSocket } from '../hooks/useWebSocket'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const StatCard = ({ label, value, sub, accent }) => (
  <div className="card">
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`text-2xl font-semibold font-mono ${accent || 'text-slate-100'}`}>{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
)

export default function DashboardPage() {
  const [children,   setChildren]   = useState([])
  const [selected,   setSelected]   = useState(null)
  const [dashboard,  setDashboard]  = useState(null)
  const [loading,    setLoading]    = useState(false)
  const { sessionUpdate } = useWebSocket()

  useEffect(() => {
    api.getChildren().then(r => {
      setChildren(r.data)
      if (r.data.length > 0) setSelected(r.data[0]._id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    api.getDashboard(selected)
      .then(r => setDashboard(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selected])

  // Refresh dashboard when WS pushes a session update for selected child
  useEffect(() => {
    if (sessionUpdate?.userId === selected) {
      api.getDashboard(selected).then(r => setDashboard(r.data)).catch(() => {})
    }
  }, [sessionUpdate])

  const riskColor = (risk) => risk >= 70 ? 'text-red-400' : risk >= 40 ? 'text-amber-400' : 'text-emerald-400'
  const trendColor = (t) => t > 0 ? 'text-red-400' : 'text-emerald-400'

  // Mock 7-day bar data from trend
  const barData = dashboard ? [
    { day: 'Mon', min: Math.max(10, dashboard.todayPlayTime - 80 - Math.random()*20) },
    { day: 'Tue', min: Math.max(10, dashboard.todayPlayTime - 60 - Math.random()*20) },
    { day: 'Wed', min: Math.max(10, dashboard.todayPlayTime - 45 - Math.random()*15) },
    { day: 'Thu', min: Math.max(10, dashboard.todayPlayTime - 30 - Math.random()*15) },
    { day: 'Fri', min: Math.max(10, dashboard.todayPlayTime - 20 - Math.random()*10) },
    { day: 'Sat', min: Math.max(10, dashboard.todayPlayTime - 10 - Math.random()*10) },
    { day: 'Today', min: dashboard.todayPlayTime },
  ].map(d => ({ ...d, min: Math.round(d.min) })) : []

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
            <StatCard label="Play time today" value={`${dashboard.todayPlayTime} min`} sub={`${dashboard.sessionCount} sessions`} />
            <StatCard label="Addiction risk"  value={`${dashboard.addictionRisk}/100`}
              sub={<StateBadge state={dashboard.state} />}
              accent={riskColor(dashboard.addictionRisk)} />
            <StatCard label="Weekly trend"    value={`${dashboard.trend >= 0 ? '+' : ''}${dashboard.trend} min`}
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
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} barSize={28}>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit=" m" width={40} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(v) => [`${v} min`, 'Play time']}
                />
                <Bar dataKey="min" radius={[4,4,0,0]}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={i === barData.length-1 ? '#6366f1' : '#1e293b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
