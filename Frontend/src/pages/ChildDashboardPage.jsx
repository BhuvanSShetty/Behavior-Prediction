import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { StateBadge } from '../components/StateBadge'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

// Format decimal minutes to "X min Y sec" or just "X sec"
const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '0 sec'
  const mins = Math.floor(minutes)
  const secs = Math.round((minutes - mins) * 60)
  if (mins === 0) return `${secs} sec`
  if (secs === 0) return `${mins} min`
  return `${mins} min ${secs} sec`
}

const istDayKey = (dateInput) => {
  const parts = new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata'
  }).formatToParts(new Date(dateInput))

  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export default function ChildDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalToday: 0,
    totalWeek: 0,
    sessionsToday: 0,
    latestState: null
  })

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const { data } = await api.getSessions()
      setSessions(data)
      calculateStats(data)
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    const parts = new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Kolkata'
    }).formatToParts(new Date())

    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value

    const todayIST = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
    const weekAgoIST = new Date(todayIST.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayKeyIST = istDayKey(todayIST)

    const todaySessions = data.filter(s => {
      const sessionDate = new Date(s.raw?.start || s.createdAt)
      return istDayKey(sessionDate) === todayKeyIST
    })

    const weekSessions = data.filter(s => {
      const sessionDate = new Date(s.raw?.start || s.createdAt)
      return sessionDate >= weekAgoIST
    })

    const totalToday = todaySessions.reduce((sum, s) => sum + (s.raw?.duration || 0), 0)
    const totalWeek = weekSessions.reduce((sum, s) => sum + (s.raw?.duration || 0), 0)
    const latest = data[0]

    setStats({
      totalToday,
      totalWeek,
      sessionsToday: todaySessions.length,
      latestState: latest?.prediction?.state || 'unknown'
    })
  }

  const getRiskLevel = (state) => {
    const levels = {
      'normal': { label: 'Normal', color: 'emerald', icon: '✓' },
      'addicted': { label: 'Addicted', color: 'red', icon: '⚠' },
      'frustrated': { label: 'Frustrated', color: 'amber', icon: '!' },
      'unknown': { label: 'Unknown', color: 'slate', icon: '?' }
    }
    return levels[state] || levels['unknown']
  }

  const risk = getRiskLevel(stats.latestState)

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">
            Hey {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })}
          </p>
        </div>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today's playtime */}
        <div className="card-glass border-white/5 hover:border-white/10 transition-colors flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">Today's playtime</p>
              <p className="text-4xl font-bold text-white mt-3 tracking-tight">{formatDuration(stats.totalToday)}</p>
            </div>
            <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center text-brand-400 text-xl border border-brand-500/20">
              🎮
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-white/5">
            <p className="text-sm text-slate-500 font-medium">
              This week: <span className="text-slate-300 ml-1">{formatDuration(stats.totalWeek)}</span>
            </p>
          </div>
        </div>

        {/* Sessions today */}
        <div className="card-glass border-white/5 hover:border-white/10 transition-colors flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">Sessions today</p>
              <p className="text-4xl font-bold text-white mt-3 tracking-tight">{stats.sessionsToday}</p>
              <p className="text-sm text-slate-500 mt-1 font-medium">active sessions</p>
            </div>
            <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-400 text-xl border border-emerald-500/20">
              📊
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-white/5">
            <p className="text-sm text-slate-500 font-medium">
              Avg: <span className="text-slate-300 ml-1">
                {stats.sessionsToday > 0 ? formatDuration(stats.totalToday / stats.sessionsToday) : '0s'} / session
              </span>
            </p>
          </div>
        </div>

        {/* Current status */}
        <div className={`card-glass border-white/5 hover:border-white/10 transition-colors overflow-hidden relative flex flex-col`}>
          <div className={`absolute inset-0 bg-${risk.color}-500/5 mix-blend-overlay pointer-events-none`} />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div>
              <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">Your status</p>
              <div className="mt-4">
                <StateBadge state={stats.latestState} />
              </div>
              <p className="text-sm text-slate-500 mt-3 font-medium">Based on latest session</p>
            </div>
            <div className={`w-12 h-12 bg-${risk.color}-600/20 rounded-xl flex items-center justify-center text-${risk.color}-400 text-xl border border-${risk.color}-500/20`}>
              {risk.icon}
            </div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <button 
          onClick={() => navigate('/history')}
          className="card-glass w-full text-left border-white/5 hover:border-white/10 hover:bg-surface-variant/40 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-bold tracking-wider uppercase mb-2">View all sessions</p>
              <p className="text-xl text-white font-semibold group-hover:text-brand-300 transition-colors">
                {sessions.length} total sessions
              </p>
              <p className="text-sm text-slate-500 mt-1">See detailed history</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-variant/50 flex items-center justify-center group-hover:bg-brand-600/20 transition-colors">
              <span className="text-xl text-slate-400 group-hover:text-brand-400 group-hover:translate-x-1 transition-all">→</span>
            </div>
          </div>
        </button>

        <button 
          onClick={() => {}} 
          className="card-glass w-full text-left border-white/5 hover:border-white/10 hover:bg-surface-variant/40 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-bold tracking-wider uppercase mb-2">Gaming tips</p>
              <p className="text-xl text-white font-semibold group-hover:text-emerald-300 transition-colors">
                Stay healthy
              </p>
              <p className="text-sm text-slate-500 mt-1">Get recommendations</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-variant/50 flex items-center justify-center group-hover:bg-emerald-600/20 transition-colors">
              <span className="text-xl text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all">→</span>
            </div>
          </div>
        </button>
      </div>

      {/* Recent session preview */}
      {!loading && sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-3">Recent activity</h2>
          <div className="space-y-2">
            {sessions.slice(0, 3).map((s, idx) => {
              const startTime = new Date(s.raw?.start || s.createdAt)
              const endTime = new Date(s.raw?.end || new Date().toISOString())
              return (
                <div key={s._id} className="card-glass p-5 flex items-center justify-between hover:border-surface-variant/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-variant/50 flex items-center justify-center text-sm font-mono text-brand-300 shadow-inner shadow-white/5">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-100">
                        {startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {' '}
                        <span className="text-slate-500 font-normal mx-1">to</span>
                        {' '}
                        {endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5 font-medium">
                        {formatDuration(s.raw?.duration || 0)}
                      </p>
                    </div>
                  </div>
                  <StateBadge state={s.prediction?.state} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="card text-center py-16 border-dashed border-slate-700">
          <p className="text-5xl mb-4">🎮</p>
          <p className="text-slate-300 font-medium mb-1">No sessions yet</p>
          <p className="text-slate-600 text-sm">Start logging your gaming sessions to see your stats here!</p>
        </div>
      )}
    </div>
  )
}
