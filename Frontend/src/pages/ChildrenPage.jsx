import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { StateBadge } from '../components/StateBadge'

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
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">Children</h1>

      {/* Link child */}
      <div className="card">
        <p className="text-sm font-medium text-slate-300 mb-4">Link a child account</p>
        <div className="flex gap-3">
          <input className="input flex-1" placeholder="Child's user ID" value={childId}
            onChange={e => setChildId(e.target.value)} />
          <button className="btn-primary px-5" onClick={link}>Link</button>
        </div>
        {msg   && <p className="text-emerald-400 text-xs mt-3">{msg}</p>}
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        <p className="text-xs text-slate-600 mt-3">
          Ask the child to share their user ID from their profile or register email.
        </p>
      </div>

      {/* Children list */}
      <div className="space-y-3">
        {children.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-slate-500 text-sm">No children linked yet</p>
          </div>
        )}
        {children.map(c => (
          <div key={c._id} className="card">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold">
                {c.name[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-100">{c.name}</p>
                <p className="text-xs text-slate-500">{c.email} · Age {c.ageGroup}</p>
              </div>
              <button onClick={() => setSelected(selected === c._id ? null : c._id)}
                className="btn-ghost text-xs px-3 py-2">
                {selected === c._id ? 'Cancel' : 'Set limits'}
              </button>
            </div>

            {selected === c._id && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Daily limit (minutes)</label>
                  <input type="number" className="input w-48" value={limit} min={10} max={480}
                    onChange={e => setLimit(e.target.value)} />
                </div>
                <button className="btn-primary text-sm" onClick={() => saveControls(c._id)}>
                  Save controls
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
