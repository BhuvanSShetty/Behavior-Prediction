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
      <div className="grid grid-cols-3 gap-4">
        {/* Today's playtime */}
        <div className="card border border-slate-700 hover:border-slate-600 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">Today's playtime</p>
              <p className="text-3xl font-bold text-slate-100 mt-2">{formatDuration(stats.totalToday)}</p>
              <p className="text-xs text-slate-500 mt-1"></p>
            </div>
            <div className="w-10 h-10 bg-brand-600/20 rounded-lg flex items-center justify-center text-brand-400 text-lg">
              🎮
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-600">
              This week: <span className="text-slate-300 font-medium">{formatDuration(stats.totalWeek)}</span>
            </p>
          </div>
        </div>

        {/* Sessions today */}
        <div className="card border border-slate-700 hover:border-slate-600 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">Sessions today</p>
              <p className="text-3xl font-bold text-slate-100 mt-2">{stats.sessionsToday}</p>
              <p className="text-xs text-slate-500 mt-1">active sessions</p>
            </div>
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center text-emerald-400 text-lg">
              📊
            </div>
          </div>
          <div className="pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-600">
              Avg: <span className="text-slate-300 font-medium">
                {stats.sessionsToday > 0 ? formatDuration(stats.totalToday / stats.sessionsToday) : '0s'}/session
              </span>
            </p>
          </div>
        </div>

        {/* Current status */}
        <div className={`card border border-slate-700 hover:border-slate-600 transition-colors bg-${risk.color}-950/20`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">Your status</p>
              <div className="mt-2">
                <StateBadge state={stats.latestState} />
              </div>
              <p className="text-xs text-slate-500 mt-2">Based on latest session</p>
            </div>
            <div className={`w-10 h-10 bg-${risk.color}-600/20 rounded-lg flex items-center justify-center text-${risk.color}-400 text-lg`}>
              {risk.icon}
            </div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => navigate('/history')}
          className="card border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all group cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="text-left">
              <p className="text-xs text-slate-500 font-medium uppercase">View all sessions</p>
              <p className="text-slate-300 font-medium mt-2 group-hover:text-slate-100">
                {sessions.length} total sessions
              </p>
              <p className="text-xs text-slate-600 mt-1">See detailed history</p>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>

        <button 
          onClick={() => {}} 
          className="card border border-slate-700 hover:border-slate-600 hover:bg-slate-800/50 transition-all group cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="text-left">
              <p className="text-xs text-slate-500 font-medium uppercase">Gaming tips</p>
              <p className="text-slate-300 font-medium mt-2 group-hover:text-slate-100">
                Stay healthy
              </p>
              <p className="text-xs text-slate-600 mt-1">Get recommendations</p>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
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
                <div key={s._id} className="card p-3 flex items-center justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-400">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm text-slate-200">
                        {startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {' '}
                        <span className="text-slate-600">to</span>
                        {' '}
                        {endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-slate-500">
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
