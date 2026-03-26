export const StateBadge = ({ state }) => {
  const map = {
    Normal:     'badge-normal',
    Addicted:   'badge-addicted',
    Frustrated: 'badge-frustrated',
    Unknown:    'badge-unknown',
  }
  return (
    <span className={`badge ${map[state] || 'badge-unknown'}`}>
      {state || 'Unknown'}
    </span>
  )
}

export const RiskBar = ({ value }) => {
  const color = value >= 70 ? 'bg-red-500' : value >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-surface-variant/50 rounded-full h-1.5 overflow-hidden shadow-inner flex items-center">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold font-mono text-slate-400 w-8 text-right block">{value}</span>
    </div>
  )
}
