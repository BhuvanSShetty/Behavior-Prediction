import { useState, useEffect } from 'react'
import { api } from '../utils/api'


export default function ChildrenPage() {
  const [children, setChildren] = useState([])
  const [childId,  setChildId]  = useState('')
  const [limit,    setLimit]    = useState(120)
  const [selected, setSelected] = useState(null)
  const [msg,      setMsg]      = useState('')
  const [error,    setError]    = useState('')

  const load = () => api.getChildren().then(r => setChildren(r.data)).catch(() => {})

  useEffect(() => { load() }, [])

  const link = async () => {
    setMsg(''); setError('')
    try {
      await api.linkChild(childId.trim())
      setMsg('Child linked successfully ✓')
      setChildId('')
      load()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to link')
    }
  }

  const saveControls = async (id) => {
    try {
      await api.updateControls(id, { dailyLimitMinutes: Number(limit) })
      setMsg('Controls updated ✓')
      setSelected(null)
    } catch {
      setError('Failed to update')
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-8 pb-24 mt-4">
        {/* Page Header */}
        <div className="border-b border-surface-variant/50 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Children Management</h1>
          <p className="text-sm text-slate-400">Link child accounts and configure automated behavioral boundaries.</p>
        </div>

        {/* Link child */}
        <div className="card-glass w-full">
          <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-5">Link a new account</p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-xl">
            <input className="input flex-1" placeholder="Enter Child's User ID" value={childId}
              onChange={e => setChildId(e.target.value)} />
            <button className="btn-primary sm:w-auto w-full px-6" onClick={link}>Link Child</button>
          </div>
          {msg   && <p className="text-emerald-400 text-sm font-medium mt-4 bg-emerald-950/30 py-2 px-3 rounded-xl border border-emerald-500/20 inline-block">{msg}</p>}
          {error && <p className="text-red-400 text-sm font-medium mt-4 bg-red-950/30 py-2 px-3 rounded-xl border border-red-500/20 inline-block">{error}</p>}
          <p className="text-xs text-slate-500 mt-4 leading-relaxed max-w-xl">
            Ask the child to share their unique User ID found in their profile menu, or use their registered email address to pair their device.
          </p>
        </div>

        {/* Children list */}
        <div className="space-y-4 w-full pt-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Linked Accounts ({children.length})</h2>
        {children.length === 0 && (
          <div className="card-glass text-center py-16 border border-dashed border-surface-variant/50">
            <p className="text-slate-400 font-medium">No children linked yet</p>
          </div>
        )}
        {children.map(c => (
          <div key={c._id} className="card-glass transition-all hover:border-surface-variant/80">
            <div className="flex items-start sm:items-center flex-col sm:flex-row gap-5">
              <div className="w-14 h-14 flex-shrink-0 rounded-2xl bg-brand-600/20 flex items-center justify-center text-brand-300 text-xl font-bold border border-brand-500/20 shadow-inner">
                {c.name[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-slate-100">{c.name}</p>
                <p className="text-sm text-slate-400 mt-0.5">{c.email} <span className="mx-2 text-slate-600">•</span> Age {c.ageGroup}</p>
              </div>
              <button onClick={() => setSelected(selected === c._id ? null : c._id)}
                className="btn-ghost text-sm px-5">
                {selected === c._id ? 'Close' : 'Set limits'}
              </button>
            </div>

            {selected === c._id && (
              <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                <div className="bg-surface-low/50 p-5 rounded-2xl border border-surface-variant/30">
                  <label className="text-sm font-medium text-slate-300 mb-3 block">Daily limit (minutes)</label>
                  <div className="flex gap-4">
                    <input type="number" className="input w-32 text-lg text-center font-mono placeholder:font-sans" value={limit} min={10} max={480}
                      onChange={e => setLimit(e.target.value)} />
                    <button className="btn-primary" onClick={() => saveControls(c._id)}>
                      Save changes
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">Limits automatically block long gaming sessions and generate alerts.</p>
                </div>
              </div>
            )}
          </div>
        ))}
        </div>
      </div>
    </div>
  )
}
