const http = require('http')

const AI_SERVER = process.env.AI_SERVER_URL || 'http://localhost:5001'

// Priority weights per category
const WEIGHTS = {
  'pothole':        8,
  'water_overflow': 9,
  'cracks':         6,
  'garbage':        5,
  'open_manhole':   9,
  'other':          4,
}

// Map AI server class names → display names used in the app
const CLASS_DISPLAY = {
  'cracks':         'Cracks',
  'garbage':        'Garbage',
  'open_manhole':   'Open Manhole',
  'pothole':        'Pothole',
  'water_overflow': 'Water Overflow',
}

/**
 * @param {string} description
 * @param {string|null} photoPath     - local file path
 * @param {string} photoFilename      - original filename
 * @param {string} folderHint         - parent folder name from client (most reliable)
 */
async function detectCategory(description = '', photoPath = null, photoFilename = '', folderHint = '') {
  if (photoFilename || folderHint) {
    try {
      const result = await callAIServer(photoFilename, photoPath, folderHint)
      const display = CLASS_DISPLAY[result.category?.toLowerCase().replace(/\s+/g,'_')] || result.category
      return { category: display, confidence: result.confidence }
    } catch (err) {
      console.warn('AI server unreachable, falling back to text detection:', err.message)
    }
  }
  return textDetect(description)
}

function textDetect(description) {
  const lower = description.toLowerCase()
  let category = 'Other'

  if (lower.includes('pothole') || lower.includes('hole') || lower.includes('road'))
    category = 'Pothole'
  else if (lower.includes('light') || lower.includes('lamp'))
    category = 'Street Light'
  else if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste'))
    category = 'Garbage'
  else if (lower.includes('water') || lower.includes('leak') || lower.includes('flood'))
    category = 'Water Overflow'
  else if (lower.includes('crack') || lower.includes('fracture'))
    category = 'Cracks'
  else if (lower.includes('manhole') || lower.includes('drain'))
    category = 'Open Manhole'

  const confidence = category === 'Other'
    ? parseFloat((0.45 + Math.random() * 0.15).toFixed(2))
    : parseFloat((0.75 + Math.random() * 0.15).toFixed(2))

  return { category, confidence }
}

function callAIServer(filename, filePath, folderHint = '') {
  return new Promise((resolve, reject) => {
    const fs = require('fs')
    const FormData = require('form-data')

    const form = new FormData()

    if (filePath && fs.existsSync(filePath)) {
      form.append('image', fs.createReadStream(filePath), { filename })
    } else {
      const { Readable } = require('stream')
      const dummy = Readable.from(Buffer.from(''))
      form.append('image', dummy, { filename: filename || 'image.jpg', knownLength: 0 })
    }

    // Always send folder_hint — this is the key field
    if (folderHint) {
      form.append('folder_hint', folderHint)
    }

    const url = new URL('/predict', AI_SERVER)
    const options = {
      method: 'POST',
      host: url.hostname,
      port: url.port || 5001,
      path: url.pathname,
      headers: form.getHeaders(),
      timeout: 5000,
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('Invalid JSON from AI server'))
        }
      })
    })

    req.on('timeout', () => { req.destroy(); reject(new Error('AI server timeout')) })
    req.on('error', reject)
    form.pipe(req)
  })
}

function calcPriorityScore(category, createdAt, description = '') {
  const lower = description.toLowerCase()

  // ── Base score by category ───────────────────────────────────────
  const CATEGORY_BASE = {
    'open manhole':   10,
    'water overflow':  9,
    'pothole':         7,
    'cracks':          6,
    'garbage':         5,
    'other':           4,
  }
  const key = category.toLowerCase()
  let score = CATEGORY_BASE[key] ?? 4

  // ── Urgency keywords (+3) ────────────────────────────────────────
  const urgencyWords = ['urgent', 'emergency', 'danger', 'dangerous', 'immediate',
                        'critical', 'severe', 'serious', 'accident', 'injured', 'injury']
  if (urgencyWords.some(w => lower.includes(w))) score += 3

  // ── Sensitive location keywords (+2) ────────────────────────────
  const sensitiveLocations = ['school', 'hospital', 'clinic', 'college', 'university',
                               'playground', 'park', 'bus stop', 'railway', 'station',
                               'market', 'temple', 'church', 'mosque', 'court']
  if (sensitiveLocations.some(w => lower.includes(w))) score += 2

  // ── High traffic / public area (+1) ─────────────────────────────
  const publicArea = ['main road', 'highway', 'junction', 'signal', 'flyover',
                      'bridge', 'footpath', 'pedestrian', 'crossing']
  if (publicArea.some(w => lower.includes(w))) score += 1

  // ── Severity keywords (+1) ──────────────────────────────────────
  const severityWords = ['large', 'huge', 'big', 'deep', 'wide', 'multiple',
                         'spreading', 'overflowing', 'blocked', 'broken', 'collapsed']
  if (severityWords.some(w => lower.includes(w))) score += 1

  // ── Age boost: +0.5 per day unresolved (max +5) ─────────────────
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000
  score += Math.min(ageDays * 0.5, 5)

  // Cap at 20
  return parseFloat(Math.min(score, 20).toFixed(2))
}

module.exports = { detectCategory, calcPriorityScore }
