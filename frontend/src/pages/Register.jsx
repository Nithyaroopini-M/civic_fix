import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = [
  'Roads Department',
  'Sanitation Department',
  'Drainage Department',
]

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user', ward: '' })
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post('/auth/register', form)
      login(data.token, data.user)
      navigate(data.user.role === 'worker' ? '/worker' : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-700 mb-1">🏙 CivicFix</h1>
        <p className="text-gray-500 text-sm mb-6">Create your account</p>
        {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Full Name"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input className="w-full border rounded px-3 py-2 text-sm" type="email" placeholder="Email"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input className="w-full border rounded px-3 py-2 text-sm" type="password" placeholder="Password"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <select className="w-full border rounded px-3 py-2 text-sm"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value, ward: '' }))}>
            <option value="user">User (Citizen)</option>
            <option value="worker">Field Worker</option>
          </select>

          {/* Worker gets a department dropdown */}
          {form.role === 'worker' && (
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={form.ward}
              onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
              required
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          <button className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 font-medium">Create Account</button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">
          Have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
