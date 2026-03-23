import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import LoginPage     from './pages/LoginPage'
import Layout        from './pages/Layout'
import DashboardPage from './pages/DashboardPage'
import ChildrenPage  from './pages/ChildrenPage'
import AlertsPage    from './pages/AlertsPage'
import HistoryPage   from './pages/HistoryPage'

// Guard — redirects to login if not authenticated
const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'parent' ? '/dashboard' : '/history'} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Parent routes */}
          <Route path="/" element={
            <PrivateRoute role="parent">
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="children"  element={<ChildrenPage />} />
            <Route path="alerts"    element={<AlertsPage />} />
          </Route>

          {/* Child routes */}
          <Route path="/" element={
            <PrivateRoute role="child">
              <Layout />
            </PrivateRoute>
          }>
            <Route path="history" element={<HistoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
