import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { useReverseGeocode } from '../hooks/useReverseGeocode'
import api from '../api/axios'

function TaskCard({ t, onUpdate, updating, afterPhoto, setAfterPhoto, note, setNote, showActions, onReview }) {
  const place = useReverseGeocode(t.latitude, t.longitude)
  const priorityBorder = t.priority_score >= 10 ? 'border-l-red-500' : t.priority_score >= 7 ? 'border-l-orange-400' : 'border-l-blue-400'
  const isPendingReview = t.status === 'Pending Review'

  return (
    <div className={`bg-white rounded-xl shadow p-5 border-l-4 ${priorityBorder}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.category}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium
              ${t.status === 'Resolved' ? 'bg-green-100 text-green-700'
              : t.status === 'In Progress' ? 'bg-orange-100 text-orange-700'
              : t.status === 'Pending Review' ? 'bg-purple-100 text-purple-700'
              : t.status === 'Rejected' ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-700'}`}>
              {t.status}
            </span>
            {t.priority_score >= 10 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">🔴 High Priority</span>}
          </div>
          <p className="text-sm mt-2 text-gray-700">{t.description}</p>

          {(t.latitude || t.address) && (
            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
              {(place || t.address) && <p>📍 {place || t.address}</p>}
              {t.latitude && t.longitude && (
                <p className="text-gray-400">{t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}</p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-1">
            Reported: {new Date(t.created_at).toLocaleDateString()}
            {t.resolved_at && <> · Resolved: {new Date(t.resolved_at).toLocaleDateString()}</>}
          </p>
          {t.citizen_name && <p className="text-xs text-gray-400">Citizen: {t.citizen_name}</p>}
        </div>

        <div className="flex flex-col gap-2 ml-4 items-end">
          {t.photo_url && <img src={t.photo_url} alt="before" className="h-14 w-14 object-cover rounded" title="Before" />}
          {t.after_photo_url && <img src={t.after_photo_url} alt="after" className="h-14 w-14 object-cover rounded border-2 border-green-400" title="After" />}
        </div>
      </div>

      {t.latitude && t.longitude && (
        <a href={`https://www.google.com/maps?q=${t.latitude},${t.longitude}`}
          target="_blank" rel="noreferrer"
          className="inline-block mt-2 text-xs text-blue-600 hover:underline">
          🗺 Open in Google Maps
        </a>
      )}

      {!showActions && t.worker_note && (
        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">Note: {t.worker_note}</p>
      )}

      {t.stars && (
        <p className="mt-2 text-xs text-yellow-600">Citizen rating: {'⭐'.repeat(t.stars)} ({t.stars}/5)
          {t.rating_comment && <> — "{t.rating_comment}"</>}
        </p>
      )}

      {/* Review actions for Pending Review tasks */}
      {isPendingReview && onReview && (
        <ReviewPanel taskId={t.id} onReview={onReview} updating={updating} />
      )}

      {/* Update actions for accepted/active tasks */}
      {showActions && !isPendingReview && (
        <div className="mt-4 border-t pt-4 space-y-2">
          <textarea className="w-full border rounded px-3 py-2 text-sm" rows={2}
            placeholder="Add a note (optional)..." value={note[t.id] || ''}
            onChange={e => setNote(n => ({ ...n, [t.id]: e.target.value }))} />

          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded text-xs">
              📷 After Photo
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => setAfterPhoto(a => ({ ...a, [t.id]: e.target.files[0] }))} />
            </label>
            {afterPhoto[t.id] && <span className="text-xs text-green-600">✓ {afterPhoto[t.id].name}</span>}
          </div>

          <div className="flex gap-2">
            <button onClick={() => onUpdate(t.id, 'In Progress')}
              disabled={updating === t.id || t.status === 'In Progress'}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm py-1.5 rounded disabled:opacity-50">
              Mark In Progress
            </button>
            <button onClick={() => onUpdate(t.id, 'Resolved')}
              disabled={updating === t.id}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-1.5 rounded disabled:opacity-50">
              {updating === t.id ? 'Updating...' : 'Mark Resolved ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewPanel({ taskId, onReview, updating }) {
  const [reason, setReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="mt-4 border-t pt-4 space-y-2 bg-purple-50 rounded-b-xl -mx-5 -mb-5 px-5 pb-5">
      <p className="text-xs font-medium text-purple-700">Review this task before accepting</p>
      {showReject && (
        <textarea className="w-full border rounded px-3 py-2 text-sm" rows={2}
          placeholder="Reason for rejection (required)..."
          value={reason} onChange={e => setReason(e.target.value)} />
      )}
      <div className="flex gap-2">
        <button onClick={() => onReview(taskId, 'accept', '')}
          disabled={updating === taskId}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-1.5 rounded disabled:opacity-50">
          ✓ Accept Task
        </button>
        {!showReject
          ? <button onClick={() => setShowReject(true)}
              className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm py-1.5 rounded">
              ✗ Reject
            </button>
          : <button onClick={() => { if (reason.trim()) onReview(taskId, 'reject', reason) }}
              disabled={!reason.trim() || updating === taskId}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-1.5 rounded disabled:opacity-50">
              Confirm Reject
            </button>
        }
      </div>
    </div>
  )
}

export default function WorkerDashboard() {
  const [tab, setTab] = useState('review')
  const [tasks, setTasks] = useState([])
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(null)
  const [afterPhoto, setAfterPhoto] = useState({})
  const [note, setNote] = useState({})

  const pendingReview = tasks.filter(t => t.status === 'Pending Review')
  const activeTasks = tasks.filter(t => t.status !== 'Pending Review')

  useEffect(() => {
    fetchTasks()
    fetchCompleted()
    // poll every 30s for new tasks
    const interval = setInterval(() => { fetchTasks(); fetchCompleted() }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchTasks() {
    setLoading(true)
    try { const { data } = await api.get('/worker/tasks'); setTasks(data) }
    finally { setLoading(false) }
  }

  async function fetchCompleted() {
    try { const { data } = await api.get('/worker/completed'); setCompleted(data) }
    catch {}
  }

  async function handleReview(id, action, reason) {
    setUpdating(id)
    try {
      await api.patch(`/worker/tasks/${id}/review`, { action, reason })
      fetchTasks()
      fetchCompleted()
      // switch to active tab after accepting
      if (action === 'accept') setTab('active')
    } catch (err) {
      alert(err.response?.data?.error || 'Review action failed')
    } finally { setUpdating(null) }
  }

  async function updateStatus(id, status) {
    setUpdating(id)
    try {
      const fd = new FormData()
      fd.append('status', status)
      if (note[id]) fd.append('note', note[id])
      if (afterPhoto[id]) fd.append('after_photo', afterPhoto[id])
      await api.patch(`/worker/tasks/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      fetchTasks()
      fetchCompleted()
    } catch (err) {
      alert(err.response?.data?.error || 'Update failed')
    } finally { setUpdating(null) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Field Worker" />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 flex-wrap items-center">
          <button onClick={() => setTab('review')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 ${tab === 'review' ? 'bg-purple-700 text-white' : 'bg-white border text-gray-600'}`}>
            Review Queue
            {pendingReview.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingReview.length}</span>
            )}
          </button>
          <button onClick={() => setTab('active')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${tab === 'active' ? 'bg-blue-700 text-white' : 'bg-white border text-gray-600'}`}>
            Active Tasks ({activeTasks.length})
          </button>
          <button onClick={() => setTab('completed')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${tab === 'completed' ? 'bg-green-700 text-white' : 'bg-white border text-gray-600'}`}>
            Completed ({completed.length})
          </button>
          <button onClick={() => { fetchTasks(); fetchCompleted() }} disabled={loading}
            className="ml-auto px-3 py-2 rounded-full text-sm bg-white border text-gray-500 hover:bg-gray-50 disabled:opacity-50">
            {loading ? '⟳' : '↻ Refresh'}
          </button>        </div>

        {loading && <p className="text-center text-gray-400">Loading...</p>}

        {tab === 'review' && (
          <div className="space-y-4">
            {!loading && pendingReview.length === 0 && (
              <div className="text-center text-gray-400 py-12">No tasks pending review</div>
            )}
            {pendingReview.map(t => (
              <TaskCard key={t.id} t={t} onUpdate={null} updating={updating}
                afterPhoto={{}} setAfterPhoto={() => {}}
                note={{}} setNote={() => {}} showActions={false} onReview={handleReview} />
            ))}
          </div>
        )}

        {tab === 'active' && (
          <div className="space-y-4">
            {!loading && activeTasks.length === 0 && (
              <div className="text-center text-gray-400 py-12">No active tasks</div>
            )}
            {activeTasks.map(t => (
              <TaskCard key={t.id} t={t} onUpdate={updateStatus} updating={updating}
                afterPhoto={afterPhoto} setAfterPhoto={setAfterPhoto}
                note={note} setNote={setNote} showActions={true} onReview={null} />
            ))}
          </div>
        )}

        {tab === 'completed' && (
          <div className="space-y-4">
            {completed.length === 0 && (
              <div className="text-center text-gray-400 py-12">No completed tasks yet</div>
            )}
            {completed.map(t => (
              <TaskCard key={t.id} t={t} onUpdate={null} updating={null}
                afterPhoto={{}} setAfterPhoto={() => {}}
                note={{}} setNote={() => {}} showActions={false} onReview={null} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
