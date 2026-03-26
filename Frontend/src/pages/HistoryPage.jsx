import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { StateBadge, RiskBar } from '../components/StateBadge'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// Format decimal minutes to "X min Y sec" or just "X sec"
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

export default function HistoryPage() {
  const { user }                = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.getSessions()
      .then(r => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fmt = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })

  // Group sessions by date
  const grouped = sessions.reduce((acc, s) => {
    const date = fmtDate(s.raw?.start || s.createdAt)
    if (!acc[date]) acc[date] = []
    acc[date].push(s)
    return acc
  }, {})

  // Process data for the 7-day BarChart securely locked to Asia/Kolkata timezone
  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    last7Days.push({
      dateStr: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' })
    })
  }

  const barData = last7Days.map(dInfo => {
    const daySessions = sessions.filter(s => {
      const sDate = new Date(s.raw?.start || s.createdAt)
      return sDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) === dInfo.dateStr
    })
    return { 
      day: dInfo.dayName, 
      min: daySessions.reduce((sum, s) => sum + (s.raw?.duration || 0), 0)
    }
  })

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Hi, {user?.name?.split(' ')[0] || 'there'}</h1>
          <p className="text-sm text-slate-400 mt-1">{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', timeZone:'Asia/Kolkata' })}</p>
        </div>
      </div>

      {/* Summary cards */}
      {sessions.length > 0 && (() => {
        const todayStr = fmtDate(new Date());
        const todaySessions = sessions.filter(s => fmtDate(s.raw?.start || s.createdAt) === todayStr);
        const todaySessionCount = todaySessions.length;
        const todayMins = todaySessions.reduce((sum, s) => sum + (s.raw?.duration || 0), 0)
        
        const latestInfo = sessions[0]
        const trend = latestInfo?.features?.trend || 0
        const trendColor = trend > 0 ? 'text-red-400' : 'text-emerald-400'

        return (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Playtime Today" value={formatDuration(todayMins)} sub={`${todaySessionCount} sessions logged today`} />
              
              <StatCard label="Weekly trend" value={`${trend >= 0 ? '+' : ''}${formatDuration(Math.abs(trend))}`}
                accent={trendColor} sub="vs oldest day this week" />
              
              <div className="card-glass flex flex-col justify-between min-h-[140px]">
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">Latest state</p>
                <div className="mt-auto items-start flex flex-col pb-2">
                  <span className="text-sm font-medium text-slate-500 mb-2">AI Behavioral Prediction</span>
                  <div className="flex items-center gap-3">
                    <StateBadge state={latestInfo?.prediction?.state || 'Unknown'} />
                    {latestInfo?.prediction?.confidence && (
                      <span className="text-xs font-bold text-slate-400 bg-surface-variant/50 px-2.5 py-1 rounded-md shadow-inner">
                        {Math.round(latestInfo.prediction.confidence * 100)}% Match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Bar Chart */}
            {barData.length > 0 && (
              <div className="card-glass mt-6">
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-6">Historical Playtime</p>
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
              </div>
            )}
          </div>
        )
      })()}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="card-glass text-center py-24 border border-dashed border-surface-variant/50">
          <div className="w-16 h-16 bg-surface-variant/50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
            📋
          </div>
          <p className="text-slate-300 font-medium text-lg">No sessions yet</p>
          <p className="text-slate-500 text-sm mt-2">Sessions appear here after they're logged by the mobile app.</p>
        </div>
      )}

      {/* Grouped session list (Today only) */}
      {Object.entries(grouped)
        .filter(([date]) => date === fmtDate(new Date()))
        .map(([date, group]) => (
        <div key={date} className="mt-8 pt-4">
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-sm font-bold text-brand-300 uppercase tracking-widest">Today's Sessions</h2>
            <div className="h-px bg-surface-variant/30 flex-1"></div>
          </div>
          <div className="space-y-4">
            {group.map(s => (
              <div key={s._id} className="card-glass hover:border-surface-variant/80 transition-all transform hover:-translate-y-0.5">
                <div className="flex items-start gap-5">
                  {/* Duration rect */}
                  <div className="w-16 h-16 rounded-2xl bg-surface-variant/40 flex flex-col items-center justify-center flex-shrink-0 shadow-inner shadow-white/5 border border-white/5">
                    <span className="text-sm font-bold font-mono text-brand-400">{formatDuration(s.raw?.duration)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-base font-semibold text-slate-100 flex items-center gap-2">
                        {fmt(s.raw?.start)} <span className="text-slate-500 font-normal text-sm">to</span> {fmt(s.raw?.end)}
                      </p>
                      <StateBadge state={s.prediction?.state} />
                    </div>

                    <div className="mt-4">
                      <RiskBar value={s.prediction?.addictionRisk || 0} />
                    </div>

                    {/* Feature highlights */}
                    <div className="flex gap-4 mt-4 flex-wrap bg-surface-low/50 p-3 rounded-xl border border-surface-variant/30">
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        Daily total <span className="text-slate-200 ml-1">{Math.round(s.features?.dailyTotalTime || 0)} min</span>
                      </span>
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        Sessions today <span className="text-slate-200 ml-1">{s.features?.sessionsPerDay}</span>
                      </span>
                      {s.features?.nightCount > 0 && (
                        <span className="text-xs font-medium text-brand-400 bg-brand-900/20 px-2 py-0.5 rounded-md border border-brand-500/20">Night session</span>
                      )}
                      {s.alerts?.playtimeLimitExceeded && (
                        <span className="text-xs font-medium text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded-md border border-amber-500/20">Limit exceeded</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confidence */}
                {s.prediction?.confidence > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>AI Confidence</span>
                    <span className="px-2 py-1 rounded-md bg-surface-variant/30 text-slate-300 shadow-inner">{Math.round(s.prediction.confidence * 100)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
