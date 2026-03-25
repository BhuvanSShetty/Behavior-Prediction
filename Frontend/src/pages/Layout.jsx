import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { AlertPanel } from '../components/AlertToast'
import { useWebSocket } from '../hooks/useWebSocket'

export default function Layout() {
  const { alerts, dismissAlert } = useWebSocket()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
      <AlertPanel alerts={alerts} onDismiss={dismissAlert} />
    </div>
  )
}
