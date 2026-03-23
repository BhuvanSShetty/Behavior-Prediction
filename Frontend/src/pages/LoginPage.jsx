import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate            = useNavigate()
  const [mode,    setMode]  = useState('login')   // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [form,    setForm]    = useState({
    name: '', email: '', password: '', role: 'parent', ageGroup: '13-15'
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = mode === 'login'
        ? await login(form.email, form.password)
        : await register(form)
      navigate(user.role === 'parent' ? '/dashboard' : '/history')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
            </svg>
          </div>
          <span className="text-xl font-semibold text-slate-100">Gaming Monitor</span>
        </div>

        <div className="card">
          {/* Mode tabs */}
          <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize
                  ${mode === m ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Full name</label>
                <input className="input" placeholder="Bhuvan Shetty" value={form.name}
                  onChange={e => set('name', e.target.value)} required />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
              <input className="input" type="email" placeholder="you@gmail.com" value={form.email}
                onChange={e => set('email', e.target.value)} required />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password}
                onChange={e => set('password', e.target.value)} required />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">I am a</label>
                  <div className="flex gap-2">
                    {['parent','child'].map(r => (
                      <button type="button" key={r} onClick={() => set('role', r)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize
                          ${form.role === r
                            ? 'bg-brand-600/20 border-brand-500 text-brand-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {form.role === 'child' && (
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Age group</label>
                    <select className="input" value={form.ageGroup} onChange={e => set('ageGroup', e.target.value)}>
                      <option value="10-12">10–12</option>
                      <option value="13-15">13–15</option>
                      <option value="16-18">16–18</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Gaming Behavior Detection System
        </p>
      </div>
    </div>
  )
}
