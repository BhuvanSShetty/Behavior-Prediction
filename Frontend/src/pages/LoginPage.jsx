import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
      navigate(user.role === 'parent' ? '/dashboard' : '/')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="min-h-screen bg-surface-low text-slate-100 flex p-4 sm:p-8 relative overflow-hidden"
    >
      {/* Ambient background spotlight */}
      <motion.div 
        className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-900/10 rounded-full blur-[120px] pointer-events-none"
        animate={{ 
          opacity: [0.3, 0.6, 0.3], 
          scale: [0.9, 1.1, 0.9],
          x: [0, 50, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute bottom-[-10%] right-[30%] w-[500px] h-[500px] bg-white-[0.02] rounded-full blur-[100px] pointer-events-none"
        animate={{ 
          opacity: [0.1, 0.3, 0.1], 
          y: [0, -30, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Subtle animated background grid pattern */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none animate-grid-drift" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      {/* Moving Glowing "Snakes" (Data Pulses) along the Grid */}
      <motion.div
        className="absolute h-[2px] w-[250px] bg-gradient-to-r from-transparent via-white/50 to-white blur-[1px] top-[160px] pointer-events-none shadow-[0_0_15px_rgba(255,255,255,1)]"
        animate={{ x: [-300, 2000] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: 0.5 }}
      />
      <motion.div
        className="absolute h-[2px] w-[350px] bg-gradient-to-r from-transparent via-brand-400/80 to-brand-200 blur-[1px] top-[416px] pointer-events-none shadow-[0_0_20px_rgba(255,255,255,0.6)]"
        animate={{ x: [-400, 2000] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear', delay: 2 }}
      />
      <motion.div
        className="absolute w-[2px] h-[300px] bg-gradient-to-b from-transparent via-slate-400/50 to-white blur-[1px] left-[256px] pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.8)]"
        animate={{ y: [-400, 1500] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear', delay: 1 }}
      />
      <motion.div
        className="absolute h-[2px] w-[150px] bg-gradient-to-l from-transparent via-zinc-400/80 to-zinc-200 blur-[1px] bottom-[288px] pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.6)]"
        animate={{ x: [2000, -300] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear', delay: 3 }}
      />

      {/* Decorative side branding with 3D abstract Hero Image */}
      <div className="hidden lg:flex w-[40%] flex-col justify-end relative rounded-3xl overflow-hidden p-12 border border-surface-variant/50 shadow-2xl shadow-black">
        {/* Render Image */}
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105" style={{ backgroundImage: "url('/hero-bg.png')" }} />
        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        <div className="relative z-10 max-w-sm">
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">BehaveTrack</h1>
          <p className="mt-4 text-slate-300 leading-relaxed font-medium">
            Next-generation real-time behavioral insights and health monitoring for digital wellness.
          </p>
        </div>
      </div>

      {/* Login panel */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 space-y-12">
        {/* Mobile Logo Header */}
        <div className="lg:hidden flex flex-col items-center mt-[-4rem]">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg shadow-black/50 mb-4 backdrop-blur-md">
            <svg className="w-6 h-6 text-brand-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.58 16.09l-1.09-7.66C20.18 6.53 18.61 5 16.7 5H7.3C5.39 5 3.82 6.53 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.38 2.53-2.91zM8 11H6v2H5v-2H3v-1h2V8h1v2h2v1zm7.5 3c-.83 0-1.5-.67-1.5-1.5S14.67 11 15.5 11s1.5.67 1.5 1.5S16.33 14 15.5 14zm-1.5-3.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">BehaveTrack</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Behavior Detection System</p>
        </div>

        <motion.div layout className="w-full max-w-md bg-surface p-8 sm:p-10 rounded-[2rem] border border-surface-variant relative shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          {/* Mode tabs */}
          <motion.div layout className="flex bg-surface-variant/30 backdrop-blur-md rounded-xl p-1 mb-6 border border-white/5">
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all capitalize
                  ${mode === m ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </motion.div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <AnimatePresence initial={false} mode="sync">
              {mode === 'register' && (
                <motion.div
                  key="fullname"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <label className="text-xs text-slate-400 mb-1.5 block">Full name</label>
                  <input className="input" placeholder="Enter full name" value={form.name}
                    onChange={e => set('name', e.target.value)} required />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout key="email">
              <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
              <input className="input" type="email" placeholder="you@gmail.com" value={form.email}
                onChange={e => set('email', e.target.value)} required />
            </motion.div>

            <motion.div layout key="password">
              <label className="text-xs text-slate-400 mb-1.5 block">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password}
                onChange={e => set('password', e.target.value)} required />
            </motion.div>

            <AnimatePresence initial={false} mode="sync">
              {mode === 'register' && (
                <motion.div
                  key="role-options"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1.5 block">I am a</label>
                      <div className="flex gap-2">
                        {['parent','child'].map(r => (
                          <button type="button" key={r} onClick={() => set('role', r)}
                            className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all capitalize
                              ${form.role === r
                                ? 'bg-brand-600/20 border-brand-500 text-brand-300 shadow-[inset_0_0_12px_rgba(99,102,241,0.2)]'
                                : 'bg-surface-low border-surface-variant/50 text-slate-400 hover:border-surface-variant'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence initial={false} mode="sync">
                      {form.role === 'child' && (
                        <motion.div
                          key="age-group"
                          initial={{ height: 0, opacity: 0, marginTop: -4 }}
                          animate={{ height: 'auto', opacity: 1, marginTop: 0 }}
                          exit={{ height: 0, opacity: 0, marginTop: -4 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <label className="text-xs text-slate-400 mb-1.5 block">Age group</label>
                          <select className="input bg-surface text-slate-200" value={form.ageGroup} onChange={e => set('ageGroup', e.target.value)}>
                            <option value="10-12" className="bg-surface text-slate-200">10–12 Years</option>
                            <option value="13-15" className="bg-surface text-slate-200">13–15 Years</option>
                            <option value="16-18" className="bg-surface text-slate-200">16–18 Years</option>
                            <option value="19-24" className="bg-surface text-slate-200">19–24 Years</option>
                            <option value="24+" className="bg-surface text-slate-200">24+ Years</option>
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.p layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 overflow-hidden">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button layout className="btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </motion.button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Gaming Behavior Detection System
        </p>
      </div>
    </motion.div>
  )
}
