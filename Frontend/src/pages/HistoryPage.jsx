import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { StateBadge, RiskBar } from '../components/StateBadge'
import { useAuth } from '../context/AuthContext'

// Format decimal minutes to "X min Y sec" or just "X sec"
const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '0s'
  const mins = Math.floor(minutes)
  const secs = Math.round((minutes - mins) * 60)
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

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

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">My Sessions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Hey {user?.name} · {sessions.length} sessions logged</p>
        </div>
      </div>

      {/* Summary cards */}
      {sessions.length > 0 && (() => {
        const today = sessions.filter(s => fmtDate(s.raw?.start || s.createdAt) === fmtDate(new Date()))
        const todayTotal = today.reduce((sum, s) => sum + (s.raw?.duration || 0), 0)
        const latest = sessions[0]
        return (
          <div className="grid grid-cols-3 gap-4">
            <div className="card">
              <p className="text-xs text-slate-500 mb-1">Today</p>
              <p className="text-2xl font-semibold font-mono text-slate-100">{formatDuration(todayTotal)} <span className="text-sm text-slate-500"></span></p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500 mb-1">Sessions today</p>
              <p className="text-2xl font-semibold font-mono text-slate-100">{today.length}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500 mb-1">Latest state</p>
              <div className="mt-1"><StateBadge state={latest?.prediction?.state} /></div>
            </div>
          </div>
        )
      })()}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-slate-500 text-sm">No sessions yet</p>
          <p className="text-slate-600 text-xs mt-1">Sessions appear here after they're logged by the mobile app</p>
        </div>
      )}

      {/* Grouped session list */}
      {Object.entries(grouped).map(([date, group]) => (
        <div key={date}>
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">{date}</p>
          <div className="space-y-3">
            {group.map(s => (
              <div key={s._id} className="card hover:border-slate-700 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Duration circle */}
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold font-mono text-slate-100">{formatDuration(s.raw?.duration)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-200">
                        {fmt(s.raw?.start)} – {fmt(s.raw?.end)}
                      </p>
                      <StateBadge state={s.prediction?.state} />
                    </div>

                    <div className="mt-2">
                      <RiskBar value={s.prediction?.addictionRisk || 0} />
                    </div>

                    {/* Feature highlights */}
                    <div className="flex gap-4 mt-2.5 flex-wrap">
                      <span className="text-xs text-slate-500">
                        Daily total <span className="text-slate-300">{Math.round(s.features?.dailyTotalTime || 0)} min</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        Sessions today <span className="text-slate-300">{s.features?.sessionsPerDay}</span>
                      </span>
                      {s.features?.nightCount > 0 && (
                        <span className="text-xs text-brand-400">Night session</span>
                      )}
                      {s.alerts?.playtimeLimitExceeded && (
                        <span className="text-xs text-amber-400">Limit exceeded</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confidence bar */}
                {s.prediction?.confidence > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>Model confidence</span>
                    <span className="font-mono text-slate-300">{Math.round(s.prediction.confidence * 100)}%</span>
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
