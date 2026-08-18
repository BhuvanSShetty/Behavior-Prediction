import { useState } from 'react'
import { api } from '../utils/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { styles } from '../style'

export default function ChildrenPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [limit,    setLimit]    = useState(120)
  const [selected, setSelected] = useState(null)
  const [msg,      setMsg]      = useState('')
  const [error,    setError]    = useState('')

  const { data: childrenResponse, isLoading } = useQuery({
    queryKey: ['children'],
    queryFn: api.getChildren
  })

  const children = childrenResponse?.data || []

  const linkMutation = useMutation({
    mutationFn: (id) => api.linkChild(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] })
      setMsg('Child linked successfully ✓')
      setIdentifier('')
    },
    onError: (e) => {
      setError(e.response?.data?.message || 'Failed to link')
    }
  })

  const updateControlsMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateControls(id, data),
    onSuccess: () => {
      setMsg('Controls updated ✓')
      setSelected(null)
    },
    onError: () => {
      setError('Failed to update')
    }
  })

  const link = () => {
    setMsg(''); setError('')
    if (!identifier.trim()) return
    linkMutation.mutate(identifier.trim())
  }

  const saveControls = (id) => {
    setMsg(''); setError('')
    updateControlsMutation.mutate({ id, data: { dailyLimitMinutes: Number(limit) } })
  }

  const handleChildClick = (childId) => {
    navigate(`/dashboard/${childId}`)
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-8 pb-24 mt-4">
        <div className="border-b border-surface-variant/50 pb-6">
          <h1 className={`${styles.heading2} tracking-tight text-white mb-2`}>Children Management</h1>
          <p className="text-sm text-slate-400">Link child accounts and configure automated behavioral boundaries.</p>
        </div>

        <div className={`${styles.card} w-full`}>
          <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-5">Link a new account</p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-xl">
            <input className={`${styles.inputField} flex-1`} placeholder="Enter child's name or email" value={identifier}
              onChange={e => setIdentifier(e.target.value)} />
            <button className={`${styles.buttonPrimary} sm:w-auto px-6`} onClick={link} disabled={linkMutation.isPending}>
              {linkMutation.isPending ? 'Linking...' : 'Link Child'}
            </button>
          </div>
          {msg   && <p className="text-emerald-400 text-sm font-medium mt-4 bg-emerald-950/30 py-2 px-3 rounded-xl border border-emerald-500/20 inline-block">{msg}</p>}
          {error && <p className="text-red-400 text-sm font-medium mt-4 bg-red-950/30 py-2 px-3 rounded-xl border border-red-500/20 inline-block">{error}</p>}
          <p className="text-xs text-slate-500 mt-4 leading-relaxed max-w-xl">
            Enter the child's registered email address (recommended for an exact match) or their full name. If multiple children share the same name, use their email instead.
          </p>
        </div>

        <div className="space-y-4 w-full pt-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Linked Accounts ({children.length})</h2>
        {isLoading && (
          <div className={`${styles.card} text-center py-16 border border-dashed border-surface-variant/50`}>
            <p className="text-slate-400 font-medium">Loading...</p>
          </div>
        )}
        {!isLoading && children.length === 0 && (
          <div className={`${styles.card} text-center py-16 border border-dashed border-surface-variant/50`}>
            <p className="text-slate-400 font-medium">No children linked yet</p>
          </div>
        )}
        {children.map(c => (
          <div key={c._id} className={`${styles.card} transition-all hover:border-surface-variant/80`}>
            <div className="flex items-start sm:items-center flex-col sm:flex-row gap-5">
              
              <div 
                className="flex flex-1 items-center gap-5 cursor-pointer hover:opacity-80 transition-opacity" 
                onClick={() => handleChildClick(c._id)}
                title={`View ${c.name}'s Dashboard`}
              >
                <div className="w-14 h-14 flex-shrink-0 rounded-2xl bg-brand-600/20 flex items-center justify-center text-brand-300 text-xl font-bold border border-brand-500/20 shadow-inner">
                  {c.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-100">{c.name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{c.email} <span className="mx-2 text-slate-600">•</span> Age {c.ageGroup}</p>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(selected === c._id ? null : c._id)
                }}
                className="btn-ghost text-sm px-5"
              >
                {selected === c._id ? 'Close' : 'Set limits'}
              </button>
            </div>

            {selected === c._id && (
              <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                <div className="bg-surface-low/50 p-5 rounded-2xl border border-surface-variant/30">
                  <label className="text-sm font-medium text-slate-300 mb-3 block">Daily limit (minutes)</label>
                  <div className="flex gap-4">
                    <input type="number" className={`${styles.inputField} w-32 text-lg text-center font-mono placeholder:font-sans`} value={limit} min={10} max={480}
                      onChange={e => setLimit(e.target.value)} />
                    <button className={styles.buttonPrimary} onClick={() => saveControls(c._id)} disabled={updateControlsMutation.isPending}>
                      {updateControlsMutation.isPending && updateControlsMutation.variables?.id === c._id ? 'Saving...' : 'Save changes'}
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