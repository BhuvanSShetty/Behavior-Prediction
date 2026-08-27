import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider, useAuth } from './context/AuthContext'
import { styles } from './style'

import LoginPage          from './pages/LoginPage'
import Layout             from './pages/Layout'
import DashboardPage      from './pages/DashboardPage'
import ChildrenPage       from './pages/ChildrenPage'
import AlertsPage         from './pages/AlertsPage'
import HistoryPage        from './pages/HistoryPage'
import ChildDashboardPage from './pages/ChildDashboardPage'

// Guard — redirects to login if not authenticated
const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className={styles.fullScreenLoader}>
      <div className={styles.spinner} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'parent' ? '/dashboard' : '/history'} replace />
  return children
}

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
            <Route index element={<ChildDashboardPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
  )
}
