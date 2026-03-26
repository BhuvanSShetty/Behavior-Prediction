import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { AlertPanel } from '../components/AlertToast'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user } = useAuth()
  const isParent = user?.role === 'parent'
  const { alerts, dismissAlert, connected } = useWebSocket(isParent)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar connected={isParent ? connected : false} />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
      {isParent && <AlertPanel alerts={alerts} onDismiss={dismissAlert} />}
    </div>
  )
}
