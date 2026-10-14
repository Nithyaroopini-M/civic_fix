import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell'

export default function Navbar({ title }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow">
      <span className="font-bold text-xl">🏙 CivicFix <span className="text-blue-200 text-sm font-normal ml-2">{title}</span></span>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <span className="text-sm">{user?.name}</span>
        <button onClick={handleLogout} className="bg-blue-900 hover:bg-blue-800 px-3 py-1 rounded text-sm">Logout</button>
      </div>
    </nav>
  )
}
