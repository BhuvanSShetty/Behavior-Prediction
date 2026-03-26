const ALERT_META = {
  ADDICTION_ALERT:        { label: 'Addiction Risk',     color: 'border-red-500/20 bg-red-950/40',     dot: 'bg-red-500',   glow: '' },
  PLAYTIME_LIMIT_EXCEEDED:{ label: 'Playtime Exceeded',  color: 'border-amber-500/20 bg-amber-950/40', dot: 'bg-amber-500', glow: '' },
  NIGHT_GAMING_ALERT:     { label: 'Night Gaming',       color: 'border-brand-500/20 bg-brand-950/40', dot: 'bg-brand-400', glow: '' },
}

export const AlertToast = ({ alert, onDismiss }) => {
  const meta = ALERT_META[alert.type] || { label: alert.type, color: 'border-slate-700 bg-slate-900', dot: 'bg-slate-400' }

  const detail = () => {
    if (alert.type === 'ADDICTION_ALERT')         return `Daily: ${alert.dailyTotalTime} min · Risk: ${alert.trend > 0 ? '+' : ''}${alert.trend} trend`
    if (alert.type === 'PLAYTIME_LIMIT_EXCEEDED') return `${alert.dailyTotalTime} min played · Limit: ${alert.limit} min`
    if (alert.type === 'NIGHT_GAMING_ALERT')      return `Session started at ${new Date(alert.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
    return ''
  }

  return (
    <div className={`slide-in flex items-start gap-4 p-4 rounded-xl border ${meta.color} shadow-lg max-w-sm`}>
      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 pulse-dot ${meta.dot} ${meta.glow || ''}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-100">{meta.label}</p>
        <p className="text-xs font-medium text-slate-400 mt-1">{detail()}</p>
      </div>
      <button onClick={() => onDismiss(alert.id)} className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition-colors leading-none flex-shrink-0">
        ×
      </button>
    </div>
  )
}

export const AlertPanel = ({ alerts, onDismiss }) => {
  if (!alerts.length) return null
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
      {alerts.map(a => <AlertToast key={a.id} alert={a} onDismiss={onDismiss} />)}
    </div>
  )
}
