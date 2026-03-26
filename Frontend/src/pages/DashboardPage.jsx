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
  <div className="card-glass flex flex-col justify-between min-h-[140px]">
    <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">{label}</p>
    <div className="mt-auto">
      <p className={`text-4xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
      {sub && <div className="mt-3 text-sm font-medium text-slate-500">{sub}</div>}
    </div>
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
          <h1 className="text-2xl font-semibold text-slate-100">Hi, {user?.name?.split(' ')[0] || 'there'}</h1>
          <p className="text-sm text-slate-400 mt-1">{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</p>
        </div>
        {/* Child selector */}
        {children.length > 1 && (
          <select className="input w-auto text-sm" value={selected || ''} onChange={e => setSelected(e.target.value)}>
            {children.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {children.length === 0 && (
        <div className="card-glass text-center py-20 border-dashed border-surface-variant/50">
          <p className="text-slate-400 text-sm font-medium">No children linked yet.</p>
          <p className="text-slate-500 text-xs mt-2">Go to Children → Link Child to get started.</p>
        </div>
      )}

      {dashboard && !loading && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <StatCard label="Play time today" value={formatDuration(dashboard.todayPlayTime)} sub={`${dashboard.sessionCount} sessions`} />
            <StatCard label="Addiction risk"  value={`${dashboard.addictionRisk}/100`}
              sub="Risk from latest session"
              accent={riskColor(dashboard.addictionRisk)} />
            <StatCard label="Predicted state" value={dashboard.state || 'Unknown'}
              sub={<StateBadge state={dashboard.state} />} />
            <StatCard label="Weekly trend"    value={`${dashboard.trend >= 0 ? '+' : ''}${formatDuration(Math.abs(dashboard.trend))}`}
              accent={trendColor(dashboard.trend)} sub="vs oldest day this week" />
            <StatCard label="Night sessions"  value={dashboard.nightSessions}
              accent={dashboard.nightSessions > 0 ? 'text-brand-400' : 'text-slate-100'}
              sub="12AM – 4AM" />
          </div>

          {/* Risk bar */}
          <div className="card-glass mt-6">
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-4">Addiction risk score</p>
            <RiskBar value={dashboard.addictionRisk} />
          </div>

          {/* Bar chart */}
          <div className="card-glass mt-6">
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-6">Play time this week</p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} barSize={36} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickMargin={8} unit="m" width={50} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ 
                      backgroundColor: '#09090b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
                    }}
                    itemStyle={{ color: '#f8fafc', fontWeight: 600, fontSize: '14px', padding: 0 }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px', paddingBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}
                    formatter={(v) => [formatDuration(v), 'Play time']}
                  />
                  <Bar dataKey="min" radius={[6,6,0,0]}>
                    {barData.map((d, i) => (
                      <Cell key={i} fill={i === barData.length-1 ? '#4f46e5' : '#222a3d'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm font-medium">
                No playtime data available for this week.
              </div>
            )}
          </div>

          {/* Active alerts */}
          {(dashboard.alerts?.addictionAlert || dashboard.alerts?.nightGamingAlert || dashboard.alerts?.playtimeLimitExceeded) && (
            <div className="card-glass mt-6 space-y-3">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-4">Active alerts</p>
              {dashboard.alerts.addictionAlert && (
                <div className="flex items-center gap-4 p-4 bg-red-950/20 border border-red-500/20 rounded-xl">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full pulse-dot flex-shrink-0" />
                  <p className="text-sm font-medium text-red-300">High addiction risk detected</p>
                </div>
              )}
              {dashboard.alerts.playtimeLimitExceeded && (
                <div className="flex items-center gap-4 p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full pulse-dot flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-300">Daily playtime limit exceeded</p>
                </div>
              )}
              {dashboard.alerts.nightGamingAlert && (
                <div className="flex items-center gap-4 p-4 bg-brand-950/20 border border-brand-500/20 rounded-xl">
                  <div className="w-2.5 h-2.5 bg-brand-400 rounded-full pulse-dot flex-shrink-0" />
                  <p className="text-sm font-medium text-brand-300">Night gaming detected</p>
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
