import { CircleMarker, Popup } from 'react-leaflet'
import { useReverseGeocode } from '../hooks/useReverseGeocode'

// Color by priority score
const pinColor = score => score >= 10 ? '#ef4444' : score >= 7 ? '#f97316' : '#3b82f6'

export default function ComplaintMapPin({ pin }) {
  const place = useReverseGeocode(pin.latitude, pin.longitude)

  return (
    <CircleMarker
      center={[pin.latitude, pin.longitude]}
      radius={9}
      color={pinColor(pin.priority_score ?? 0)}
      fillOpacity={0.85}
      weight={2}
    >
      <Popup minWidth={180}>
        <div className="text-sm space-y-1">
          <p className="font-semibold text-gray-800">{pin.category}</p>
          {place
            ? <p className="text-gray-600">📍 {place}</p>
            : <p className="text-gray-400 text-xs">📍 {pin.latitude?.toFixed(5)}, {pin.longitude?.toFixed(5)}</p>
          }
          <p className="text-gray-500 text-xs">{pin.latitude?.toFixed(5)}, {pin.longitude?.toFixed(5)}</p>
          <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium
            ${pin.status === 'Resolved' ? 'bg-green-100 text-green-700'
            : pin.status === 'In Progress' ? 'bg-orange-100 text-orange-700'
            : 'bg-gray-100 text-gray-600'}`}>
            {pin.status}
          </span>
          {pin.priority_score != null && (
            <p className="text-xs text-gray-400">Priority: {pin.priority_score}</p>
          )}
          {pin.description && (
            <p className="text-xs text-gray-500 border-t pt-1 mt-1 line-clamp-2">{pin.description}</p>
          )}
        </div>
      </Popup>
    </CircleMarker>
  )
}
