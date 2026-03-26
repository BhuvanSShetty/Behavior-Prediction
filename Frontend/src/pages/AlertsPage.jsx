import { useWebSocket } from '../hooks/useWebSocket'

const ALERT_META = {
  ADDICTION_ALERT:         { label: 'Addiction Risk',    color: 'border-red-500/20 bg-red-950/20',    dot: 'bg-red-500',    text: 'text-red-300',    glow: '' },
  PLAYTIME_LIMIT_EXCEEDED: { label: 'Playtime Exceeded', color: 'border-amber-500/20 bg-amber-950/20', dot: 'bg-amber-500',  text: 'text-amber-300',  glow: '' },
  NIGHT_GAMING_ALERT:      { label: 'Night Gaming',      color: 'border-brand-500/20 bg-brand-950/20', dot: 'bg-brand-400',  text: 'text-brand-300',  glow: '' },
}

export default function AlertsPage() {
  const { alerts, dismissAlert } = useWebSocket()

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Alerts</h1>
        {alerts.length > 0 && (
          <span className="badge bg-red-900/50 text-red-400">{alerts.length} active</span>
        )}
      </div>

      {alerts.length === 0 && (
        <div className="card-glass text-center py-20 border border-dashed border-surface-variant/50">
          <div className="w-16 h-16 bg-surface-variant/40 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-slate-300 font-medium text-lg">No active alerts</p>
          <p className="text-slate-500 text-sm mt-2">When risks are detected, they will appear here in real time.</p>
        </div>
      )}

      <div className="space-y-4 max-w-4xl">
        {alerts.map(alert => {
          const meta = ALERT_META[alert.type] || { label: alert.type, color: 'border-surface-variant/50 bg-surface-low/50', dot: 'bg-slate-500', text: 'text-slate-300', glow: '' }
          return (
            <div key={alert.id} className={`card-glass border ${meta.color} flex items-start gap-5 p-5 hover:border-surface-variant/80 transition-all transform hover:-translate-y-0.5`}>
              <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 pulse-dot ${meta.dot} ${meta.glow}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <p className={`text-base font-semibold ${meta.text}`}>{meta.label}</p>
                  <span className="text-sm font-medium text-slate-500 bg-surface-variant/30 px-3 py-1 rounded-md">{new Date(alert.id).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                </div>
                <div className="mt-3 flex gap-4 text-sm text-slate-400 bg-black/10 p-3 rounded-xl">
                  {alert.type === 'ADDICTION_ALERT' && (
                    <>
                      <p>Daily play time: <span className="text-slate-200 font-medium ml-1">{alert.dailyTotalTime} min</span></p>
                      <p>Trend: <span className="text-slate-200 font-medium ml-1">{alert.trend >= 0 ? '+' : ''}{alert.trend} min</span></p>
                    </>
                  )}
                  {alert.type === 'PLAYTIME_LIMIT_EXCEEDED' && (
                    <>
                      <p>Played: <span className="text-slate-200 font-medium ml-1">{alert.dailyTotalTime} min</span></p>
                      <p>Limit: <span className="text-slate-200 font-medium ml-1">{alert.limit} min</span></p>
                    </>
                  )}
                  {alert.type === 'NIGHT_GAMING_ALERT' && (
                    <p>Session started at: <span className="text-slate-200 font-medium ml-1">{new Date(alert.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span></p>
                  )}
                </div>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-surface-variant/50 hover:text-white transition-colors flex-shrink-0 leading-none">×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
