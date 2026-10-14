import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'

export default function NotificationBell() {
  const [notes, setNotes] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    fetchNotes()
    const interval = setInterval(fetchNotes, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function fetchNotes() {
    try {
      const { data } = await api.get('/notifications')
      setNotes(data)
    } catch {}
  }

  async function markAll() {
    await api.patch('/notifications/read-all')
    setNotes(n => n.map(x => ({ ...x, is_read: 1 })))
  }

  const unread = notes.filter(n => !n.is_read).length

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="relative p-1">
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white text-gray-800 rounded shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            <button onClick={markAll} className="text-xs text-blue-600 hover:underline">Mark all read</button>
          </div>
          {notes.length === 0 && <p className="text-sm text-gray-500 p-4">No notifications</p>}
          {notes.map(n => (
            <div key={n.id} className={`px-4 py-2 text-sm border-b ${n.is_read ? 'bg-white' : 'bg-blue-50'}`}>
              {n.message}
              <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
