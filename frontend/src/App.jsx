import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import UserDashboard from './pages/UserDashboard'
import WorkerDashboard from './pages/WorkerDashboard'

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const routes = { user: '/dashboard', worker: '/worker' }
  return <Navigate to={routes[user.role] || '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard/*" element={
          <PrivateRoute roles={['user']}><UserDashboard /></PrivateRoute>
        } />
        <Route path="/worker/*" element={
          <PrivateRoute roles={['worker']}><WorkerDashboard /></PrivateRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}
