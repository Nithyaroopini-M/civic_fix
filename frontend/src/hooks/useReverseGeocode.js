import { useState, useEffect } from 'react'

const cache = {}

// Returns a human-readable place name for a lat/lng using Nominatim
export function useReverseGeocode(lat, lng) {
  const [place, setPlace] = useState(null)

  useEffect(() => {
    if (!lat || !lng) return
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    if (cache[key]) { setPlace(cache[key]); return }

    const controller = new AbortController()
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
    )
      .then(r => r.json())
      .then(d => {
        const addr = d.address || {}
        const label = [
          addr.road || addr.pedestrian || addr.footway,
          addr.suburb || addr.neighbourhood || addr.village,
          addr.city || addr.town || addr.county,
        ].filter(Boolean).join(', ') || d.display_name?.split(',').slice(0, 2).join(',') || null
        cache[key] = label
        setPlace(label)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [lat, lng])

  return place
}
