// Ported verbatim (logic unchanged, types added) from Vue2 NimoOS-UI
// src/store/modules/photos.js:75-76 (MONTH_NAMES), :92-115 (format helpers),
// :117-189 (assetToPhoto), :215-219 (groupToMonth), and
// src/utils/countryFromCoords.js (countryFromCoords).

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatBitrate(bps: number | undefined): string | null {
  if (!bps) return null
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} kbps`
  return `${bps} bps`
}

function formatFrameRate(fps: number | undefined): string | null {
  if (!fps) return null
  if (Math.abs(fps - Math.round(fps)) < 0.01) return `${Math.round(fps)} fps`
  return `${fps.toFixed(2)} fps`
}

// Offline reverse-geocoding limited to country granularity, ported from
// src/utils/countryFromCoords.js. Coverage: ~200 sovereign states, bbox lookup,
// smallest containing bbox wins on overlap (small countries over enclosing large ones).
const COUNTRIES: [string, [number, number, number, number]][] = [
  ['China', [73.5, 18.1, 134.8, 53.6]],
  ['Japan', [122.9, 24.0, 153.9, 45.6]],
  ['South Korea', [126.0, 33.1, 129.6, 38.6]],
  ['North Korea', [124.2, 37.7, 130.7, 43.0]],
  ['Mongolia', [87.7, 41.6, 119.9, 52.1]],
  ['Taiwan', [119.5, 21.9, 122.0, 25.3]],
  ['Hong Kong', [113.8, 22.2, 114.4, 22.6]],
  ['Macau', [113.5, 22.0, 113.6, 22.25]],
  ['India', [68.1, 6.7, 97.4, 35.7]],
  ['Pakistan', [60.9, 23.6, 77.0, 37.1]],
  ['Bangladesh', [88.0, 20.7, 92.7, 26.6]],
  ['Sri Lanka', [79.5, 5.9, 81.9, 9.9]],
  ['Nepal', [80.0, 26.3, 88.2, 30.4]],
  ['Bhutan', [88.7, 26.7, 92.1, 28.3]],
  ['Maldives', [72.0, -0.7, 73.8, 7.1]],
  ['Afghanistan', [60.5, 29.4, 74.9, 38.5]],
  ['Iran', [44.0, 25.1, 63.3, 39.8]],
  ['Iraq', [38.8, 29.1, 48.6, 37.4]],
  ['Syria', [35.7, 32.3, 42.4, 37.3]],
  ['Lebanon', [35.1, 33.1, 36.6, 34.7]],
  ['Jordan', [34.9, 29.2, 39.3, 33.4]],
  ['Israel', [34.3, 29.5, 35.9, 33.3]],
  ['Palestine', [34.2, 31.2, 35.6, 32.6]],
  ['Saudi Arabia', [34.5, 16.4, 55.7, 32.2]],
  ['Yemen', [42.6, 12.1, 54.5, 19.0]],
  ['Oman', [52.0, 16.6, 59.8, 26.4]],
  ['UAE', [51.6, 22.6, 56.4, 26.1]],
  ['Qatar', [50.7, 24.5, 51.6, 26.2]],
  ['Bahrain', [50.4, 25.8, 50.7, 26.3]],
  ['Kuwait', [46.6, 28.5, 48.4, 30.1]],
  ['Turkey', [25.7, 35.8, 44.8, 42.1]],
  ['Cyprus', [32.3, 34.5, 34.6, 35.7]],
  ['Armenia', [43.4, 38.8, 46.6, 41.3]],
  ['Azerbaijan', [44.7, 38.4, 50.4, 41.9]],
  ['Georgia', [40.0, 41.0, 46.7, 43.6]],
  ['Kazakhstan', [46.5, 40.6, 87.3, 55.4]],
  ['Uzbekistan', [55.9, 37.2, 73.1, 45.6]],
  ['Turkmenistan', [52.4, 35.1, 66.7, 42.8]],
  ['Kyrgyzstan', [69.3, 39.2, 80.3, 43.3]],
  ['Tajikistan', [67.4, 36.7, 75.2, 41.0]],
  ['Vietnam', [102.1, 8.4, 109.5, 23.4]],
  ['Laos', [100.1, 13.9, 107.7, 22.5]],
  ['Cambodia', [102.3, 10.4, 107.6, 14.7]],
  ['Thailand', [97.3, 5.6, 105.7, 20.5]],
  ['Myanmar', [92.2, 9.6, 101.2, 28.5]],
  ['Malaysia', [99.6, 0.9, 119.3, 7.4]],
  ['Singapore', [103.6, 1.1, 104.1, 1.5]],
  ['Brunei', [114.0, 4.0, 115.4, 5.1]],
  ['Indonesia', [95.0, -11.0, 141.0, 6.1]],
  ['Timor-Leste', [124.0, -9.5, 127.4, -8.1]],
  ['Philippines', [116.9, 4.6, 126.6, 21.1]],
  ['United Kingdom', [-8.7, 49.9, 1.8, 60.9]],
  ['Ireland', [-10.5, 51.4, -6.0, 55.4]],
  ['Iceland', [-24.5, 63.4, -13.5, 66.6]],
  ['Norway', [4.6, 58.0, 31.1, 71.2]],
  ['Sweden', [11.0, 55.3, 24.2, 69.1]],
  ['Finland', [20.6, 59.8, 31.6, 70.1]],
  ['Denmark', [8.1, 54.6, 15.2, 57.8]],
  ['Estonia', [21.8, 57.5, 28.2, 59.7]],
  ['Latvia', [20.9, 55.6, 28.2, 58.1]],
  ['Lithuania', [20.9, 53.9, 26.8, 56.5]],
  ['Poland', [14.1, 49.0, 24.2, 54.9]],
  ['Germany', [5.9, 47.3, 15.0, 55.1]],
  ['Netherlands', [3.4, 50.8, 7.2, 53.6]],
  ['Belgium', [2.5, 49.5, 6.4, 51.5]],
  ['Luxembourg', [5.7, 49.4, 6.5, 50.2]],
  ['France', [-5.2, 41.3, 9.6, 51.1]],
  ['Monaco', [7.4, 43.7, 7.5, 43.8]],
  ['Switzerland', [5.9, 45.8, 10.5, 47.8]],
  ['Liechtenstein', [9.5, 47.0, 9.6, 47.3]],
  ['Austria', [9.5, 46.4, 17.2, 49.0]],
  ['Czech Republic', [12.1, 48.5, 18.9, 51.1]],
  ['Slovakia', [16.8, 47.7, 22.6, 49.6]],
  ['Hungary', [16.1, 45.7, 22.9, 48.6]],
  ['Slovenia', [13.4, 45.4, 16.6, 46.9]],
  ['Croatia', [13.5, 42.4, 19.4, 46.5]],
  ['Bosnia & Herzegovina', [15.7, 42.6, 19.6, 45.3]],
  ['Serbia', [18.8, 42.2, 23.0, 46.2]],
  ['Montenegro', [18.4, 41.9, 20.4, 43.6]],
  ['Kosovo', [20.0, 41.9, 21.8, 43.3]],
  ['North Macedonia', [20.5, 40.9, 23.0, 42.4]],
  ['Albania', [19.3, 39.6, 21.1, 42.7]],
  ['Greece', [19.4, 34.8, 28.3, 41.7]],
  ['Italy', [6.6, 35.5, 18.5, 47.1]],
  ['Vatican City', [12.4, 41.9, 12.5, 41.9]],
  ['San Marino', [12.4, 43.9, 12.5, 44.0]],
  ['Malta', [14.2, 35.8, 14.6, 36.1]],
  ['Spain', [-9.4, 35.9, 4.4, 43.8]],
  ['Portugal', [-9.5, 36.9, -6.2, 42.2]],
  ['Andorra', [1.4, 42.4, 1.8, 42.7]],
  ['Romania', [20.3, 43.6, 29.7, 48.3]],
  ['Bulgaria', [22.4, 41.2, 28.6, 44.2]],
  ['Moldova', [26.6, 45.5, 30.2, 48.5]],
  ['Ukraine', [22.1, 44.4, 40.2, 52.4]],
  ['Belarus', [23.2, 51.3, 32.8, 56.2]],
  ['Russia', [19.6, 41.2, 180.0, 81.9]],
  ['Egypt', [24.7, 21.7, 36.9, 31.7]],
  ['Libya', [9.4, 19.5, 25.2, 33.2]],
  ['Tunisia', [7.5, 30.2, 11.6, 37.6]],
  ['Algeria', [-8.7, 19.1, 12.0, 37.1]],
  ['Morocco', [-13.2, 27.7, -1.0, 35.9]],
  ['Western Sahara', [-17.1, 20.8, -8.7, 27.7]],
  ['Mauritania', [-17.1, 14.7, -4.8, 27.3]],
  ['Mali', [-12.2, 10.2, 4.3, 24.9]],
  ['Niger', [0.2, 11.7, 16.0, 23.5]],
  ['Chad', [13.5, 7.4, 24.0, 23.5]],
  ['Sudan', [21.8, 8.7, 38.6, 22.2]],
  ['South Sudan', [24.1, 3.5, 35.9, 12.2]],
  ['Eritrea', [36.4, 12.4, 43.1, 18.0]],
  ['Djibouti', [41.8, 10.9, 43.4, 12.7]],
  ['Ethiopia', [33.0, 3.4, 48.0, 14.9]],
  ['Somalia', [40.9, -1.7, 51.4, 12.0]],
  ['Kenya', [33.9, -4.7, 41.9, 5.5]],
  ['Uganda', [29.6, -1.5, 35.0, 4.2]],
  ['Rwanda', [28.9, -2.8, 30.9, -1.0]],
  ['Burundi', [29.0, -4.5, 30.8, -2.3]],
  ['Tanzania', [29.3, -11.7, 40.4, -1.0]],
  ['Senegal', [-17.5, 12.3, -11.3, 16.7]],
  ['Gambia', [-16.8, 13.1, -13.8, 13.8]],
  ['Guinea-Bissau', [-16.7, 10.9, -13.6, 12.7]],
  ['Guinea', [-15.1, 7.2, -7.6, 12.7]],
  ['Sierra Leone', [-13.3, 6.9, -10.3, 10.0]],
  ['Liberia', [-11.5, 4.4, -7.4, 8.5]],
  ['Ivory Coast', [-8.6, 4.4, -2.5, 10.7]],
  ['Burkina Faso', [-5.5, 9.4, 2.4, 15.1]],
  ['Ghana', [-3.3, 4.7, 1.2, 11.2]],
  ['Togo', [-0.1, 6.1, 1.8, 11.1]],
  ['Benin', [0.8, 6.2, 3.8, 12.4]],
  ['Nigeria', [2.7, 4.3, 14.7, 13.9]],
  ['Cameroon', [8.5, 1.6, 16.2, 13.1]],
  ['Central African Rep.', [14.4, 2.2, 27.5, 11.0]],
  ['Equatorial Guinea', [9.3, 0.9, 11.3, 3.8]],
  ['Gabon', [8.7, -3.9, 14.5, 2.3]],
  ['Republic of the Congo', [11.1, -5.1, 18.6, 3.7]],
  ['DR Congo', [12.2, -13.5, 31.3, 5.4]],
  ['Angola', [11.7, -18.0, 24.1, -4.4]],
  ['Zambia', [21.9, -18.1, 33.7, -8.2]],
  ['Malawi', [32.7, -17.1, 35.9, -9.4]],
  ['Mozambique', [30.2, -26.9, 40.8, -10.5]],
  ['Zimbabwe', [25.2, -22.4, 33.1, -15.6]],
  ['Botswana', [19.9, -26.9, 29.4, -17.8]],
  ['Namibia', [11.7, -28.9, 25.3, -16.9]],
  ['South Africa', [16.5, -34.8, 32.9, -22.1]],
  ['Lesotho', [27.0, -30.6, 29.5, -28.6]],
  ['Eswatini', [30.8, -27.3, 32.1, -25.7]],
  ['Madagascar', [43.2, -25.6, 50.5, -12.0]],
  ['Mauritius', [57.3, -20.5, 57.8, -20.0]],
  ['Seychelles', [55.2, -5.0, 56.0, -4.3]],
  ['Comoros', [43.2, -12.4, 44.5, -11.4]],
  ['Cape Verde', [-25.4, 14.8, -22.7, 17.2]],
  ['São Tomé & Príncipe', [6.4, -0.0, 7.5, 1.7]],
  ['Canada', [-141.0, 60.0, -52.6, 83.1]],
  ['Canada', [-141.0, 49.0, -95.0, 60.0]],
  ['Canada', [-130.0, 48.0, -114.0, 49.5]],
  ['Canada', [-95.0, 49.0, -52.6, 60.0]],
  ['Canada', [-90.0, 45.0, -52.6, 49.0]],
  ['Canada', [-82.5, 41.6, -52.6, 45.0]],
  ['United States', [-125.0, 24.4, -66.9, 49.4]],
  ['Alaska', [-180.0, 51.2, -129.9, 71.4]],
  ['Hawaii', [-160.3, 18.9, -154.8, 22.2]],
  ['Mexico', [-118.4, 14.5, -86.7, 32.7]],
  ['Guatemala', [-92.2, 13.7, -88.2, 17.8]],
  ['Belize', [-89.2, 15.9, -88.1, 18.5]],
  ['El Salvador', [-90.1, 13.1, -87.7, 14.4]],
  ['Honduras', [-89.4, 12.9, -83.1, 16.5]],
  ['Nicaragua', [-87.7, 10.7, -83.2, 15.0]],
  ['Costa Rica', [-85.9, 8.0, -82.5, 11.2]],
  ['Panama', [-83.0, 7.2, -77.1, 9.6]],
  ['Cuba', [-85.0, 19.8, -74.1, 23.3]],
  ['Jamaica', [-78.4, 17.7, -76.2, 18.5]],
  ['Haiti', [-74.5, 18.0, -71.6, 20.1]],
  ['Dominican Republic', [-72.0, 17.4, -68.3, 19.9]],
  ['Puerto Rico', [-67.3, 17.9, -65.2, 18.6]],
  ['Bahamas', [-79.0, 20.9, -72.7, 27.3]],
  ['Trinidad & Tobago', [-61.9, 10.0, -60.4, 11.4]],
  ['Barbados', [-59.7, 13.0, -59.4, 13.4]],
  ['Colombia', [-79.0, -4.2, -66.9, 12.5]],
  ['Venezuela', [-73.4, 0.7, -59.8, 12.2]],
  ['Guyana', [-61.4, 1.2, -56.5, 8.6]],
  ['Suriname', [-58.1, 1.8, -54.0, 6.0]],
  ['French Guiana', [-54.6, 2.1, -51.6, 5.8]],
  ['Brazil', [-74.0, -33.8, -34.7, 5.3]],
  ['Ecuador', [-81.1, -5.0, -75.2, 1.5]],
  ['Peru', [-81.4, -18.4, -68.7, -0.0]],
  ['Bolivia', [-69.7, -22.9, -57.5, -9.7]],
  ['Paraguay', [-62.7, -27.6, -54.3, -19.3]],
  ['Uruguay', [-58.4, -34.9, -53.1, -30.1]],
  ['Argentina', [-73.6, -55.1, -53.6, -21.8]],
  ['Chile', [-75.6, -55.9, -66.4, -17.5]],
  ['Australia', [113.1, -43.7, 153.7, -10.7]],
  ['New Zealand', [166.4, -47.3, 178.6, -34.4]],
  ['Papua New Guinea', [140.8, -11.7, 156.0, -1.3]],
  ['Fiji', [177.3, -19.3, 180.2, -16.0]],
  ['Solomon Islands', [155.5, -11.9, 167.0, -6.6]],
  ['Vanuatu', [166.5, -20.3, 170.3, -13.1]],
  ['New Caledonia', [163.6, -22.7, 168.1, -19.5]],
  ['Samoa', [-172.8, -14.1, -171.4, -13.4]],
  ['Tonga', [-176.2, -22.4, -173.7, -15.4]],
  ['Micronesia', [137.3, 1.0, 163.0, 10.1]],
  ['Marshall Islands', [160.8, 4.5, 172.0, 14.7]],
  ['Palau', [131.1, 2.8, 134.7, 8.1]],
  ['Kiribati', [-179.4, -11.5, 176.9, 4.7]],
  ['Tuvalu', [176.0, -9.0, 179.9, -5.7]],
  ['Nauru', [166.9, -0.6, 167.0, -0.5]],
]

const AREAS = COUNTRIES.map(([, [w, s, e, n]]) => (e - w) * (n - s))

function countryFromCoords(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (lat == null || lon == null) return null
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  let bestIdx = -1
  let bestArea = Infinity
  for (let i = 0; i < COUNTRIES.length; i++) {
    const [, [w, s, e, n]] = COUNTRIES[i]
    if (lon < w || lon > e || lat < s || lat > n) continue
    if (AREAS[i] < bestArea) {
      bestArea = AREAS[i]
      bestIdx = i
    }
  }
  return bestIdx >= 0 ? COUNTRIES[bestIdx][0] : null
}

export interface Photo {
  id: string | number
  title: string | number
  file: string
  date: string
  time: string
  takenAt: string | number | null
  indexedAt: string | number | null
  mimeType: string
  fileSize: number
  isVideo: boolean
  hasOcr: boolean
  isNew: boolean
  isLivePhoto: boolean
  livePhotoVideoId: string | number | null
  duration: string | null
  durationMs: number
  fav: boolean
  status: string | number | undefined
  filePath: string
  width: number | null
  height: number | null
  dim: string | null
  size: string
  latitude: number | null
  longitude: number | null
  coords: string | null
  place: string | null
  camera: string | null
  iso: number | null
  shutter: number | string | null
  aperture: number | string | null
  focal: number | string | null
  orientation: number | string | null
  videoCodec: string | null
  audioCodec: string | null
  frameRate: string | null
  bitRate: string | null
  rotation: number
  matchScore: number | null
  matchedBy: string | null
  belowCut: boolean
  tags: unknown[]
  scene: unknown
  faces: unknown[]
}

export function assetToPhoto(asset: Record<string, unknown>): Photo {
  const takenAt = asset.takenAt as string | number | undefined
  const d = takenAt ? new Date(takenAt) : null
  const mimeType = (asset.mimeType as string) || ''
  const isVideo = mimeType.startsWith('video/')
  const make = asset.make as string | undefined
  const model = asset.model as string | undefined
  const cameraStr = [make, model].filter(Boolean).join(' · ') || null
  const durationMs = asset.durationMs as number | undefined
  const latitude = asset.latitude as number | null | undefined
  const longitude = asset.longitude as number | null | undefined
  const fileSize = asset.fileSize as number | undefined
  const width = asset.width as number | undefined
  const height = asset.height as number | undefined
  const matchScore = asset.matchScore

  return {
    id: asset.id as string | number,
    title: asset.originalName
      ? String(asset.originalName).replace(/\.[^/.]+$/, '')
      : (asset.id as string | number),
    file: (asset.originalName as string) || '',
    date: d ? d.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
    time: d ? d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    // ISO original — used for accurate grouping/sorting (don't parse the localized `date`)
    takenAt: (takenAt as string | number | undefined) || null,
    indexedAt: (asset.indexedAt as string | number | undefined) || null,
    mimeType,
    fileSize: fileSize || 0,
    isVideo,
    // OCR recognized text in this asset — the third media category (Photos/OCR/Videos).
    hasOcr: !!asset.hasOcr,
    // Smart View per-user annotation: matched but never opened by this user.
    // Drives the dismissible "New" tag on the Recently-added grid.
    isNew: !!asset.isNew,
    isLivePhoto: !!asset.livePhotoVideoId,
    livePhotoVideoId: (asset.livePhotoVideoId as string | number | undefined) || null,
    duration: durationMs ? formatDuration(durationMs) : null,
    durationMs: durationMs || 0,
    fav: false,
    status: asset.status as string | number | undefined,
    filePath: (asset.filePath as string) || '',
    // shared dimensions
    width: width || null,
    height: height || null,
    dim: (width && height) ? `${width} × ${height}` : null,
    size: formatSize(fileSize),
    // GPS
    latitude: latitude != null ? latitude : null,
    longitude: longitude != null ? longitude : null,
    coords: (latitude != null && longitude != null && (latitude || longitude))
      ? `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
      : null,
    place: (asset.placeName as string | undefined) || countryFromCoords(latitude, longitude),
    // image-only
    camera: cameraStr,
    iso: (asset.iso as number | undefined) || null,
    shutter: (asset.shutterSpeed as number | string | undefined) || null,
    aperture: (asset.aperture as number | string | undefined) || null,
    focal: (asset.focalLength as number | string | undefined) || null,
    orientation: (asset.orientation as number | string | undefined) || null,
    // video-only
    videoCodec: (asset.videoCodec as string | undefined) || null,
    audioCodec: (asset.audioCodec as string | undefined) || null,
    frameRate: formatFrameRate(asset.frameRate as number | undefined),
    bitRate: formatBitrate(asset.bitRate as number | undefined),
    rotation: (asset.rotation as number | undefined) || 0,
    // Semantic-search similarity in [0,1]; only present on SmartSearch results.
    matchScore: typeof matchScore === 'number' ? matchScore : null,
    // Search-hit source: 'ocr' (text match, matchScore is a fixed 1.0, not a real
    // similarity) or 'semantic' (CLIP embedding match). Null on older backends that
    // don't send this yet — treated as semantic by callers.
    matchedBy: (asset.matchedBy as string | undefined) || null,
    // Search-result tiering: true once the asset falls below the adaptive
    // relevance cut computed by the backend (semantic long-tail). Best-match
    // tier assets omit the field on the wire — default false covers both that
    // case and older backends that don't send it at all (all results treated
    // as best matches, per spec §4).
    belowCut: !!asset.belowCut,
    // AI placeholders
    tags: [],
    scene: null,
    // Named persons detected in the asset; currently populated only by the
    // favorites listing (backend attaches them there), empty elsewhere.
    faces: Array.isArray(asset.faces) ? asset.faces : [],
  }
}

export interface Month {
  key: string
  title: string
  loc: string
  photos: Photo[]
}

export function groupToMonth(g: { year: number; month: number; assets?: unknown[] }): Month {
  const key = g.month === 0 ? 'unknown' : `${g.year}-${String(g.month).padStart(2, '0')}`
  const title = g.month === 0 ? 'Unknown Date' : `${MONTH_NAMES[g.month - 1]} ${g.year}`
  return {
    key,
    title,
    loc: '',
    photos: (g.assets || []).map(a => assetToPhoto(a as Record<string, unknown>)),
  }
}
