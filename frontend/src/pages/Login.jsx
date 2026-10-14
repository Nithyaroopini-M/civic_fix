import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post('/auth/login', form)
      login(data.token, data.user)
      const routes = { user: '/dashboard', worker: '/worker' }
      navigate(routes[data.user.role] || '/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-700 mb-1">🏙 CivicFix</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to continue</p>
        {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full border rounded px-3 py-2 text-sm" type="email" placeholder="Email"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input className="w-full border rounded px-3 py-2 text-sm" type="password" placeholder="Password"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 font-medium">Sign In</button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">
          No account? <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  )
}
