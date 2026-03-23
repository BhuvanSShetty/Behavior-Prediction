import { useWebSocket } from '../hooks/useWebSocket'

const ALERT_META = {
  ADDICTION_ALERT:         { label: 'Addiction Risk',    color: 'border-red-800/50 bg-red-950/30',    dot: 'bg-red-500',    text: 'text-red-300'    },
  PLAYTIME_LIMIT_EXCEEDED: { label: 'Playtime Exceeded', color: 'border-amber-800/50 bg-amber-950/30', dot: 'bg-amber-500',  text: 'text-amber-300'  },
  NIGHT_GAMING_ALERT:      { label: 'Night Gaming',      color: 'border-brand-800/50 bg-brand-950/30', dot: 'bg-brand-400',  text: 'text-brand-300'  },
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
        <div className="card text-center py-16">
          <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">No alerts yet</p>
          <p className="text-slate-600 text-xs mt-1">Alerts appear here in real time when triggered</p>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map(alert => {
          const meta = ALERT_META[alert.type] || { label: alert.type, color: 'border-slate-700 bg-slate-900', dot: 'bg-slate-500', text: 'text-slate-300' }
          return (
            <div key={alert.id} className={`card border ${meta.color} flex items-start gap-4`}>
              <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 pulse-dot ${meta.dot}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <p className={`text-sm font-medium ${meta.text}`}>{meta.label}</p>
                  <span className="text-xs text-slate-600">{new Date(alert.id).toLocaleTimeString()}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  {alert.type === 'ADDICTION_ALERT' && (
                    <>
                      <p>Daily play time: <span className="text-slate-200">{alert.dailyTotalTime} min</span></p>
                      <p>Trend: <span className="text-slate-200">{alert.trend >= 0 ? '+' : ''}{alert.trend} min</span></p>
                    </>
                  )}
                  {alert.type === 'PLAYTIME_LIMIT_EXCEEDED' && (
                    <>
                      <p>Played: <span className="text-slate-200">{alert.dailyTotalTime} min</span></p>
                      <p>Limit: <span className="text-slate-200">{alert.limit} min</span></p>
                    </>
                  )}
                  {alert.type === 'NIGHT_GAMING_ALERT' && (
                    <p>Session started at: <span className="text-slate-200">{new Date(alert.startedAt).toLocaleTimeString()}</span></p>
                  )}
                </div>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="text-slate-600 hover:text-slate-400 text-xl leading-none flex-shrink-0">×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
