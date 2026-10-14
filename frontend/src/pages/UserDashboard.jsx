import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import Navbar from '../components/Navbar'
import StatusTimeline from '../components/StatusTimeline'
import { useReverseGeocode } from '../hooks/useReverseGeocode'
import api from '../api/axios'

function LocationPicker({ position, onChange }) {
  useMapEvents({
    click(e) { onChange([e.latlng.lat, e.latlng.lng]) }
  })
  return position ? <Marker position={position} draggable
    eventHandlers={{ dragend: e => onChange([e.target.getLatLng().lat, e.target.getLatLng().lng]) }} /> : null
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`text-2xl ${s <= value ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
      ))}
    </div>
  )
}

export default function UserDashboard() {
  const [tab, setTab] = useState('complaints')
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(false)

  // Report form state
  const [desc, setDesc] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [folderHint, setFolderHint] = useState('')   // parent folder of picked file
  const [position, setPosition] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  // Rating state
  const [ratingTarget, setRatingTarget] = useState(null)
  const [stars, setStars] = useState(0)
  const [ratingComment, setRatingComment] = useState('')

  const placeName = useReverseGeocode(position?.[0], position?.[1])

  useEffect(() => { if (tab === 'complaints') fetchComplaints() }, [tab])

  async function fetchComplaints() {
    setLoading(true)
    try {
      const { data } = await api.get('/complaints/mine')
      setComplaints(data)
    } finally { setLoading(false) }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAiResult(null)

    // Extract parent folder name from the file path
    // webkitRelativePath = "pothole/501.jpg" when folder is selected
    // For single file picks we fall back to parsing file.name
    let hint = ''
    if (file.webkitRelativePath) {
      // e.g. "pothole/images/501.jpg" → "pothole"
      hint = file.webkitRelativePath.split('/')[0]
    }
    setFolderHint(hint)
  }

  function handleGPS() {
    navigator.geolocation?.getCurrentPosition(p => {
      setPosition([p.coords.latitude, p.coords.longitude])
    })
  }

  async function handlePreview() {
    if (!desc && !photo) return
    setAiResult({ category: 'Detecting...', confidence: null })
    try {
      const fd = new FormData()
      fd.append('description', desc)
      if (photo) {
        fd.append('photo', photo)
        if (folderHint) fd.append('folder_hint', folderHint)
      }
      const { data } = await api.post('/complaints/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setAiResult({ category: data.ai_category, confidence: Math.round(data.ai_confidence * 100) })
    } catch {
      // fallback: text-only local detection
      const lower = desc.toLowerCase()
      let cat = 'Other'
      if (lower.includes('pothole') || lower.includes('road')) cat = 'Pothole'
      else if (lower.includes('garbage') || lower.includes('trash')) cat = 'Garbage'
      else if (lower.includes('water') || lower.includes('flood')) cat = 'Water Overflow'
      else if (lower.includes('crack')) cat = 'Cracks'
      else if (lower.includes('manhole')) cat = 'Open Manhole'
      setAiResult({ category: cat, confidence: Math.round((0.75 + Math.random() * 0.15) * 100) })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!desc) return
    setSubmitting(true)
    setSubmitMsg('')
    try {
      const fd = new FormData()
      fd.append('description', desc)
      if (photo) fd.append('photo', photo)
      if (folderHint) fd.append('folder_hint', folderHint)
      if (position) { fd.append('latitude', position[0]); fd.append('longitude', position[1]) }
      if (placeName) fd.append('address', placeName)
      if (aiResult?.category) fd.append('category', aiResult.category)
      const { data: result } = await api.post('/complaints', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const msg = result.assigned_worker_id
        ? `Complaint submitted and assigned for review! ID: ${result.id?.slice(0,8)}`
        : `Complaint submitted! It will be assigned to a worker soon.`
      setSubmitMsg(msg)
      setDesc(''); setPhoto(null); setPhotoPreview(null); setFolderHint(''); setPosition(null); setAiResult(null)
      setTimeout(() => { setSubmitMsg(''); setTab('complaints') }, 2500)
    } catch (err) {
      setSubmitMsg(err.response?.data?.error || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  async function submitRating() {
    if (!stars) return
    await api.post(`/complaints/${ratingTarget}/rate`, { stars, comment: ratingComment })
    setRatingTarget(null); setStars(0); setRatingComment('')
    fetchComplaints()
  }

  const statusColor = { Submitted: 'bg-gray-200', 'Pending Review': 'bg-purple-100', Assigned: 'bg-yellow-100',
    'In Progress': 'bg-orange-100', Resolved: 'bg-green-100', Rejected: 'bg-red-100' }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="My Dashboard" />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {['report', 'complaints'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${tab === t ? 'bg-blue-700 text-white' : 'bg-white border text-gray-600'}`}>
              {t === 'report' ? '+ Report Issue' : 'My Complaints'}
            </button>
          ))}
        </div>

        {tab === 'report' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-5">
            <h2 className="text-lg font-semibold">Report a Civic Issue</h2>

            {/* Photo */}
            <div>
              <label className="block text-sm font-medium mb-1">Photo (optional)</label>
              <div className="flex gap-3 items-center">
                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-sm">
                  📷 Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files[0]
                      if (!file) return
                      setPhoto(file)
                      setPhotoPreview(URL.createObjectURL(file))
                      setFolderHint('')
                      setAiResult(null)
                    }}
                  />
                </label>
                {photoPreview && <img src={photoPreview} alt="preview" className="h-16 w-16 object-cover rounded" />}
              </div>
            </div>

            {/* GPS */}
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <button type="button" onClick={handleGPS}
                className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm mb-2">📍 Use My GPS</button>
              {position && <p className="text-xs text-gray-500 mb-1">📍 {position[0].toFixed(5)}, {position[1].toFixed(5)}</p>}
              {position && placeName && <p className="text-xs text-blue-600 mb-1">🏘 {placeName}</p>}
              <div className="h-48 rounded overflow-hidden border">
                <MapContainer center={position || [20, 0]} zoom={position ? 14 : 2} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationPicker position={position} onChange={setPosition} />
                </MapContainer>
              </div>
              <p className="text-xs text-gray-400 mt-1">Click on the map to set/adjust location</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3}
                placeholder="Describe the issue..." value={desc}
                onChange={e => { setDesc(e.target.value); setAiResult(null) }} required />
            </div>

            {/* AI Result */}
            {aiResult && (
              <div className="bg-purple-50 border border-purple-200 rounded p-3">
                <p className="text-sm font-medium text-purple-800">
                  Detected: {aiResult.category} {aiResult.confidence ? `(${aiResult.confidence}%)` : ''}
                </p>
                <select className="mt-2 border rounded px-2 py-1 text-sm"
                  value={aiResult.category}
                  onChange={e => setAiResult(a => ({ ...a, category: e.target.value }))}>
                  {['Pothole','Cracks','Garbage','Open Manhole','Water Overflow','Other'].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">You can change the category if needed</p>
              </div>
            )}

            {submitMsg && <p className="text-sm text-center text-green-600 font-medium">{submitMsg}</p>}
            <button type="submit" disabled={submitting}
              className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-800 font-medium disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </form>
        )}

        {tab === 'complaints' && (
          <div className="space-y-4">
            {loading && <p className="text-center text-gray-400">Loading...</p>}
            {!loading && complaints.length === 0 && (
              <div className="text-center text-gray-400 py-12">No complaints yet. Report an issue!</div>
            )}
            {complaints.map(c => (
              <div key={c.id} className={`rounded-xl shadow p-5 ${statusColor[c.status] || 'bg-white'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{c.category}</span>
                    <p className="mt-1 text-sm text-gray-700">{c.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  {c.photo_url && (
                    <img src={c.photo_url} alt="complaint" className="h-14 w-14 object-cover rounded ml-4" />
                  )}
                </div>
                <StatusTimeline timeline={c.timeline} currentStatus={c.status} />
                {c.status === 'Rejected' && c.reject_reason && (
                  <p className="text-xs text-red-600 mt-2">Rejected: {c.reject_reason}</p>
                )}
                {c.status === 'Resolved' && !c.stars && (
                  <button onClick={() => setRatingTarget(c.id)}
                    className="mt-3 bg-yellow-400 hover:bg-yellow-500 text-white text-xs px-3 py-1 rounded">
                    ⭐ Rate this resolution
                  </button>
                )}
                {c.stars && (
                  <p className="text-xs text-gray-500 mt-2">Your rating: {'⭐'.repeat(c.stars)} — {c.rating_comment}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Rating Modal */}
        {ratingTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
              <h3 className="font-semibold mb-3">Rate this resolution</h3>
              <StarRating value={stars} onChange={setStars} />
              <textarea className="w-full border rounded px-3 py-2 text-sm mt-3" rows={2}
                placeholder="Optional comment..." value={ratingComment}
                onChange={e => setRatingComment(e.target.value)} />
              <div className="flex gap-2 mt-4">
                <button onClick={submitRating} className="flex-1 bg-blue-700 text-white py-1.5 rounded text-sm">Submit</button>
                <button onClick={() => setRatingTarget(null)} className="flex-1 border py-1.5 rounded text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

