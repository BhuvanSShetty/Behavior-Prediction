import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '../components/Sidebar'
import { AlertPanel } from '../components/AlertToast'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user } = useAuth()
  const isParent = user?.role === 'parent'
  const { alerts, dismissAlert, connected } = useWebSocket(isParent)
  const location = useLocation()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface relative">
      <main className="flex-1 overflow-hidden flex flex-col relative bg-surface-low">
        {/* Ambient Static Dots Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0 mix-blend-screen opacity-60"></div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="h-full overflow-auto flex-1 focus:outline-none pb-24 relative z-10"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Sidebar connected={isParent ? connected : false} />
      {isParent && <AlertPanel alerts={alerts} onDismiss={dismissAlert} />}
    </div>
  )
}
