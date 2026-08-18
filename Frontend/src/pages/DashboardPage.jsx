import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { StateBadge, RiskBar } from '../components/StateBadge'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { styles } from '../style'

const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '0s'
  const mins = Math.floor(minutes)
  const secs = Math.round((minutes - mins) * 60)
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

const StatCard = ({ label, value, sub, accent }) => (
  <div className={`${styles.card} flex flex-col justify-between min-h-[140px]`}>
    <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">{label}</p>
    <div className="mt-auto">
      <p className={`text-4xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
      {sub && <div className="mt-3 text-sm font-medium text-slate-500">{sub}</div>}
    </div>
  </div>
)

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const { childId } = useParams() 
  const navigate = useNavigate()
  const [selectedDay, setSelectedDay] = useState(null)
  
  const { sessionUpdate } = useWebSocket()
  const queryClient = useQueryClient()
  const isParent = !authLoading && user?.role === 'parent'

  const { data: childrenResponse } = useQuery({
    queryKey: ['children'],
    queryFn: api.getChildren,
    enabled: isParent
  })
  const children = childrenResponse?.data || []

  useEffect(() => {
    if (children.length > 0 && !childId) {
      navigate(`/dashboard/${children[0]._id}`, { replace: true })
    }
  }, [children, childId, navigate])

  const { data: dashboardResponse, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard', childId],
    queryFn: () => api.getDashboard(childId),
    enabled: isParent && !!childId
  })
  const dashboard = dashboardResponse?.data || null

  const { data: weeklyResponse } = useQuery({
    queryKey: ['dashboardWeekly', childId],
    queryFn: () => api.getDashboardWeekly(childId),
    enabled: isParent && !!childId
  })
  const barData = weeklyResponse?.data?.dailyBreakdown || []

  useEffect(() => {
    if (isParent && sessionUpdate?.userId === childId) {
      queryClient.invalidateQueries({ queryKey: ['dashboard', childId] })
      queryClient.invalidateQueries({ queryKey: ['dashboardWeekly', childId] })
    }
  }, [sessionUpdate, childId, isParent, queryClient])

  const handleChildChange = (e) => {
    setSelectedDay(null)
    navigate(`/dashboard/${e.target.value}`)
  }

  const displayedDashboard = useMemo(() => {
    if (!dashboard) return null;
    
    if (selectedDay && barData.length > 0) {
      const dayData = barData.find(d => d.day === selectedDay);
      if (dayData) {
        return {
          ...dashboard,
          isDaySpecific: true,
          todayPlayTime: dayData.min || dayData.dailyTotalTime || 0,
          sessionCount: dayData.sessions || dayData.sessionsPerDay || 0,
          addictionRisk: dayData.addictionRisk || dashboard.addictionRisk, 
          nightSessions: dayData.nightSessions || dayData.nightCount || 0,
          trend: dayData.trend || 0,
          avgSessionDuration: dayData.avgSessionDuration || 0,
          shortSessionRatio: dayData.shortSessionRatio || 0,
          reopenCount: dayData.reopenCount || 0,
          interSessionGap: dayData.interSessionGap || 0,
        }
      }
    }
    
    return { ...dashboard, isDaySpecific: false };
  }, [dashboard, barData, selectedDay]);

  const loading = dashboardLoading
  const riskColor = (risk) => risk >= 70 ? 'text-red-400' : risk >= 40 ? 'text-amber-400' : 'text-emerald-400'
  const trendColor = (t) => t > 0 ? 'text-red-400' : 'text-emerald-400'

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={styles.heading2}>Hi, {user?.name?.split(' ')[0] || 'there'}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {selectedDay 
              ? `Showing stats for ${selectedDay}` 
              : new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })
            }
          </p>
        </div>
        
        {children.length > 1 && (
          <select 
            className={`${styles.inputField} w-auto text-sm`} 
            value={childId || ''} 
            onChange={handleChildChange}
          >
            {children.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {selectedDay && (
        <button 
          onClick={() => setSelectedDay(null)}
          className="text-sm text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-2"
        >
          ← Back to Weekly Overview
        </button>
      )}

      {children.length === 0 && (
        <div className={`${styles.card} text-center py-20 border-dashed border-surface-variant/50`}>
          <p className="text-slate-400 text-sm font-medium">No children linked yet.</p>
          <p className="text-slate-500 text-xs mt-2">Go to Children → Link Child to get started.</p>
        </div>
      )}

      {displayedDashboard && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <StatCard 
              label={displayedDashboard.isDaySpecific ? `${selectedDay} Play Time` : "Play time today"} 
              value={formatDuration(displayedDashboard.todayPlayTime)} 
              sub={`${displayedDashboard.sessionCount} sessions`} 
            />
            
            <StatCard 
              label={displayedDashboard.isDaySpecific ? "Risk that day" : "Addiction risk"}  
              value={`${displayedDashboard.addictionRisk}/100`}
              sub={displayedDashboard.isDaySpecific ? "" : "Risk from latest session"}
              accent={riskColor(displayedDashboard.addictionRisk)} 
            />
            
            <StatCard 
              label="Predicted state" 
              value={dashboard.state || 'Unknown'}
              sub={<StateBadge state={dashboard.state} />} 
            />
            
            <StatCard 
              label="Weekly trend"    
              value={`${displayedDashboard.trend >= 0 ? '+' : ''}${formatDuration(Math.abs(displayedDashboard.trend))}`}
              accent={trendColor(displayedDashboard.trend)} 
              sub="vs oldest day this week" 
            />
            
            <StatCard 
              label="Night sessions"  
              value={displayedDashboard.nightSessions}
              accent={displayedDashboard.nightSessions > 0 ? 'text-brand-400' : 'text-slate-100'}
              sub="12AM – 4AM" 
            />

            <StatCard 
              label="Avg Session" 
              value={formatDuration(displayedDashboard.avgSessionDuration)} 
            />

            <StatCard 
              label="Short Sessions (<5m)" 
              value={displayedDashboard.shortSessionRatio !== undefined ? `${(displayedDashboard.shortSessionRatio * 100).toFixed(0)}%` : '0%'} 
            />

            <StatCard 
              label="Reopens (<2m gap)" 
              value={displayedDashboard.reopenCount || 0} 
              accent="text-amber-400"
            />

            <StatCard 
              label="Inter-session Gap" 
              value={formatDuration(displayedDashboard.interSessionGap)} 
            />
          </div>

          <div className={`${styles.card} mt-6`}>
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-4">Addiction risk score</p>
            <RiskBar value={dashboard.addictionRisk} />
          </div>

          <div className={`${styles.card} mt-6`}>
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-6">Play time this week</p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={barData} 
                  barSize={36} 
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) setSelectedDay(e.activeLabel)
                  }}
                >
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
                  <Bar 
                    dataKey="min" 
                    radius={[6,6,0,0]}
                    onClick={(data) => {
                      if (data && data.day) setSelectedDay(data.day);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {barData.map((d, i) => (
                      <Cell 
                        key={i} 
                        fill={selectedDay === d.day ? '#6366f1' : (i === barData.length-1 ? '#4f46e5' : '#222a3d')} 
                      />
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

          {(dashboard.alerts?.addictionAlert || dashboard.alerts?.nightGamingAlert || dashboard.alerts?.playtimeLimitExceeded) && (
            <div className={`${styles.card} mt-6 space-y-3`}>
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
          <div className={styles.spinner} />
        </div>
      )}
    </div>
  )
}