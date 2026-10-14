import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const u = localStorage.getItem('cf_user')
    if (t && u) { setToken(t); setUser(JSON.parse(u)) }
    setLoading(false)
  }, [])

  function login(token, user) {
    localStorage.setItem('cf_token', token)
    localStorage.setItem('cf_user', JSON.stringify(user))
    setToken(token); setUser(user)
  }

  function logout() {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_user')
    setToken(null); setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
