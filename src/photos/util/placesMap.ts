// Places-map pure functions: pin geometry, filter/search/group predicates,
// and Go-layout date parsing. Ported from Vue2:
//   views/Photos/PhotosPlacesView.vue:9-21 (MAX_SCALE, tierRadius)
//   views/Photos/PhotosPlacesView.vue:28-62 (declutterPins)
//   views/Photos/PhotosPlacesView.vue:152-186 (visiblePlaces/extraFilterCount)
//   views/Photos/PhotosPlacesView.vue:187-195 (totalPhotos/countries/searched)
//   views/Photos/PhotosPlacesView.vue:196-203 (grouped)
//   views/Photos/PhotosPlacesView.vue:228-278 (visitedDots/pins)
//   views/Photos/PhotosPlacesView.vue:644-660 (splitScaleFor)
//   NimoOS-Photos/service/places.go:76 (Last = Go layout "Jan 2, 2006")
//   NimoOS-Photos/service/places_types.go:5-19 (Place JSON contract, Key is int32)
//
// Deliberate deviations from a literal line-for-line port (all required by the
// task brief, not bugs being introduced silently):
//  1. filterPlaces' `year` branch compares `lastDate`'s calendar year against an
//     injected `now`, instead of Vue2's regex `/202(?:5|6)/.test(p.last)` (which
//     hardcodes the two years the original author happened to ship during).
//  2. Place.last (the backend's human display string) is parsed once into
//     `lastDate: Date | null` by parsePlaceLast(); every date comparison in this
//     module reads that field, never the display string itself.
//  3. regionLabelKey maps continent ids to i18n keys; Vue2 used the backend's
//     already-English `label` field directly. Unknown ids return null so the
//     caller can fall back to the backend label.
//  4. Place.Key is int32 server-side but `activeId`, the synthesized
//     `cluster:${lead.id}` id, and route params are all strings — every
//     "is this the active one" / "find by id" comparison here normalizes both
//     sides with String() before comparing.
//  5. Evaluated M8 (missing from an earlier pass of this log): filterPlaces'
//     `custom` range end is inclusive of the whole end day. Vue2 parses
//     `customEnd` with `new Date('YYYY-MM-DD')`, which is UTC midnight, so any
//     photo taken later that same calendar day (in a non-UTC timezone) gets
//     excluded. Here the end bound is built as local midnight + 'T23:59:59.999',
//     so the entire end day is included. Already covered by existing tests;
//     this note just closes the log-vs-code gap the reviewer flagged.

import { type Cluster, clusterByOverlap } from './placesCluster'
import { project, WORLD_DOTS, type WorldDot } from './worldMap'

/* Highest zoom the map can reach. High enough that clicking a cluster can keep
   splitting it level by level until even same-metro cities pull apart. */
export const MAX_SCALE = 16

export interface Place {
  id: string // normalized id from String(key) (invariant: backend key is int32)
  key: number | string // backend original value, used when calling APIs
  region: string
  country: string
  city: string
  lon: number
  lat: number
  count: number
  recent: boolean
  last: string // backend "Jan 2, 2006" English display string
  lastDate: Date | null // result of parsePlaceLast(last), filtering only looks at this
  trips: number
  home: boolean
  thumbs: string[]
  coverAssetId: string
}

export interface RegionCount { id: string, label: string, count: number }
export interface PlacesStats { cities: number, countries: number, photos: number }

export type TimeFilterId = 'all' | 'year' | 'trip' | 'custom'
export interface PlacesFilter {
  timeFilter: TimeFilterId
  customStart: string // 'YYYY-MM-DD' or ''
  customEnd: string
  minCount: number
  regionFilter: string | null
  recentOnly: boolean
}

export interface Pin {
  id: string
  x: number
  y: number
  r: number
  hitR: number
  count: number
  city: string
  country: string
  thumbs: string[]
  coverAssetId: string
  recent: boolean
  cluster: boolean
  active: boolean
  members?: Place[]
  places?: number
}

// Go time layout "Jan 2, 2006"'s three-letter months (places.go:76 uses exactly
// this layout for Place.Last).
// Not new Date(str): that goes through the host locale parser, which Safari and
// older engines can return Invalid Date for.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const LAST_RE = /^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/

export function parsePlaceLast(last: string | null | undefined): Date | null {
  if (!last)
    return null
  const m = LAST_RE.exec(last.trim())
  if (!m)
    return null
  const mi = MONTHS.findIndex(x => x.toLowerCase() === m[1].toLowerCase())
  if (mi < 0)
    return null
  const day = Number(m[2])
  const year = Number(m[3])
  const d = new Date(year, mi, day)
  // Prevent overflow like 'Feb 31, 2026' rolling over to Mar 3: validate by reading back.
  if (d.getFullYear() !== year || d.getMonth() !== mi || d.getDate() !== day)
    return null
  return d
}

// PhotosPlacesView.vue:12-21. The two thresholds (40/100) are load-bearing beyond this function: they're duplicated
// as literals in the on-map legend (PhotosPlacesView.vue:1032-1039, "< 40 / 40-100 / 100+"). Changing them here
// requires updating the legend too (deviation log 11-③).
export function tierRadius(count: number): number {
  if (count >= 100)
    return 16
  if (count >= 40)
    return 11
  return 7
}

// PhotosPlacesView.vue:28-62. Relaxation pass that nudges pins apart until no two centers sit closer than `minSep`
// (viewBox units). Mutates pins in place. Deterministic: exact overlaps are broken apart along a stable, index-derived
// direction (golden-angle spread).
export function declutterPins(pins: Pin[], minSep: number): void {
  if (pins.length < 2)
    return
  for (let iter = 0; iter < 8; iter++) {
    let moved = false
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i]
        const b = pins[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d >= minSep)
          continue
        if (d < 1e-6) {
          // Perfectly coincident: separate along a fixed angle derived from j.
          const ang = j * 2.399963 // golden-angle spread, stable per index
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          d = 1
        }
        const push = (minSep - d) / 2
        const ux = dx / d
        const uy = dy / d
        a.x -= ux * push
        a.y -= uy * push
        b.x += ux * push
        b.y += uy * push
        moved = true
      }
    }
    if (!moved)
      break
  }
}

// PhotosPlacesView.vue:644-660, parameterized: Vue2 read `this.view.scale` as `lo` directly (component state); here
// it's an injected argument so the function is pure. Binary search for the lowest scale (within 22 steps) at which
// `members` first splits into >= 2 clusters, then nudges just past that threshold so the split is visually obvious
// rather than borderline.
// Review M7: placesMap.test.ts:176-191 verbatim copies the 22-step binary search below, specifically to pin the
// convergence coefficient `hi * 1.04` (review accepted it as the only viable pinning method). When changing the step
// count (22) or switching convergence strategy here, be sure to sync the corresponding section in the test file —
// otherwise that test will silently lose its meaning (no longer actually recomputing the same algorithm), rather
// than turning red to alert you.
export function splitScaleFor(members: Place[], currentScale: number): number {
  if (!members || members.length < 2)
    return MAX_SCALE
  const projected = members.map(m => ({ ...m, ...project(m.lon, m.lat) }))
  if (clusterByOverlap(projected, MAX_SCALE, tierRadius).length < 2)
    return MAX_SCALE
  let lo = currentScale
  let hi = MAX_SCALE
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (clusterByOverlap(projected, mid, tierRadius).length >= 2)
      hi = mid
    else
      lo = mid
  }
  return Math.min(MAX_SCALE, hi * 1.04)
}

// PhotosPlacesView.vue:235-278.
export function buildPins(places: Place[], scale: number, activeId: string | null): Pin[] {
  const projected = places.map(p => ({ ...p, ...project(p.lon, p.lat) }))
  // At full zoom every city must be its own clickable pin — even if two bubbles still physically overlap, we never
  // leave an un-splittable cluster behind. Below max we cluster by overlap as usual.
  const atMax = scale >= MAX_SCALE
  const clusters: Cluster<typeof projected[number]>[] = atMax
    ? projected.map(p => ({ x: p.x, y: p.y, count: p.count, members: [p], lead: p }))
    : clusterByOverlap(projected, scale, tierRadius)
  // Invisible, screen-constant click target so small pins stay easy to hit.
  const hitR = 9 / scale
  const out: Pin[] = clusters.map((cl) => {
    const r = tierRadius(cl.count) / scale
    if (cl.members.length === 1) {
      const m = cl.members[0]
      return {
        ...m,
        x: cl.x,
        y: cl.y,
        r,
        hitR: Math.max(r, hitR),
        cluster: false,
        active: String(m.id) === String(activeId),
      }
    }
    return {
      id: `cluster:${cl.lead.id}`,
      x: cl.x,
      y: cl.y,
      r,
      hitR: Math.max(r, hitR),
      count: cl.count,
      city: cl.lead.city,
      country: cl.lead.country,
      thumbs: cl.lead.thumbs,
      coverAssetId: cl.lead.coverAssetId,
      recent: cl.members.some(m => m.recent),
      members: cl.members,
      places: cl.members.length,
      cluster: true,
      active: cl.members.some(m => String(m.id) === String(activeId)),
    }
  })
  // Pull overlapping pins apart at full zoom so each keeps a clickable spot.
  if (atMax)
    declutterPins(out, (2 * tierRadius(0) + 4) / scale)
  return out
}

// PhotosPlacesView.vue:228-234. Deliberately O(dots × places) full scan, no spatial index (deviation log 11-①).
export function visitedDots(places: Place[]): Array<WorldDot & { visited: boolean }> {
  return WORLD_DOTS.map(d => ({
    ...d,
    visited: places.some(p => Math.abs(p.lon - d.lon) < 3.5 && Math.abs(p.lat - d.lat) < 3.5),
  }))
}

// PhotosPlacesView.vue:152-175 (order preserved), with year/custom rewritten
// per deviation log 1/2 above.
export function filterPlaces(places: Place[], f: PlacesFilter, now: Date = new Date()): Place[] {
  let arr = places
  if (f.timeFilter === 'trip') {
    arr = arr.filter(p => p.recent)
  }
  else if (f.timeFilter === 'year') {
    const year = now.getFullYear()
    arr = arr.filter(p => p.lastDate !== null && p.lastDate.getFullYear() === year)
  }
  else if (f.timeFilter === 'custom' && f.customStart && f.customEnd) {
    const start = new Date(`${f.customStart}T00:00:00`).getTime()
    const end = new Date(`${f.customEnd}T23:59:59.999`).getTime()
    arr = arr.filter((p) => {
      if (p.lastDate === null)
        return false
      const t = p.lastDate.getTime()
      return t >= start && t <= end
    })
  }
  if (f.minCount > 0)
    arr = arr.filter(p => p.count >= f.minCount)
  if (f.regionFilter)
    arr = arr.filter(p => p.region === f.regionFilter)
  if (f.recentOnly)
    arr = arr.filter(p => p.recent)
  return arr
}

// PhotosPlacesView.vue:189-195.
export function searchPlaces(places: Place[], query: string): Place[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return places
  return places.filter(p => p.city.toLowerCase().includes(q) || p.country.toLowerCase().includes(q))
}

// PhotosPlacesView.vue:196-203.
export function groupByRegion(places: Place[]): Record<string, Place[]> {
  const byRegion: Record<string, Place[]> = {}
  places.forEach((p) => {
    (byRegion[p.region] ||= []).push(p)
  })
  Object.values(byRegion).forEach(arr => arr.sort((a, b) => b.count - a.count))
  return byRegion
}

const REGION_LABEL_KEYS: Record<string, string> = {
  asia: 'photosPlacesRegionAsia',
  americas: 'photosPlacesRegionAmericas',
  europe: 'photosPlacesRegionEurope',
  africa: 'photosPlacesRegionAfrica',
  oceania: 'photosPlacesRegionOceania',
  antarctica: 'photosPlacesRegionAntarctica',
}

// Unknown id returns null, caller falls back to backend label (deviation log 3).
export function regionLabelKey(id: string): string | null {
  return REGION_LABEL_KEYS[id] ?? null
}

// PhotosPlacesView.vue:187.
export function countPhotos(places: Place[]): number {
  return places.reduce((s, p) => s + p.count, 0)
}

// PhotosPlacesView.vue:188.
export function countCountries(places: Place[]): number {
  return new Set(places.map(p => p.country)).size
}

// PhotosPlacesView.vue:177-186.
export function extraFilterCount(f: PlacesFilter): number {
  let n = 0
  if (f.minCount > 0)
    n++
  if (f.regionFilter)
    n++
  if (f.recentOnly)
    n++
  return n
}

// PhotosPlacesView.vue:1129, deviation log 16 (user decision 2026-07-31 pre-flight).
// Vue2 hardcodes `° N`/`° E`: spots in southern/western hemisphere show wrong direction (latitude -33.87° renders as
// "33.869° N" instead of "S"). Here the direction letter is chosen by sign, format (three decimals, `° `, ` · `
// separator) verbatim matches Vue2, only the direction letter is corrected. Direction letters (N/S/E/W) are
// intentionally NOT i18n'd — they are geographic universal notation (cartographic standard abbreviations), not
// natural language text needing translation; all languages' maps/GPS contexts use these four Latin letters. Putting
// them in i18n would only ask translators to invent "translations" for "N", which is pointless.
export function formatSpotCoords(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ''
  const ns = lat < 0 ? 'S' : 'N'
  const ew = lon < 0 ? 'W' : 'E'
  return `${Math.abs(lat).toFixed(3)}° ${ns} · ${Math.abs(lon).toFixed(3)}° ${ew}`
}

export function toPlace(raw: unknown): Place {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(r.key),
    key: r.key as number | string,
    region: (r.region as string) ?? '',
    country: (r.country as string) ?? '',
    city: (r.city as string) ?? '',
    lon: (r.lon as number) ?? 0,
    lat: (r.lat as number) ?? 0,
    count: (r.count as number) ?? 0,
    recent: Boolean(r.recent),
    last: (r.last as string) ?? '',
    lastDate: parsePlaceLast(r.last as string | null | undefined),
    trips: (r.trips as number) ?? 0,
    home: Boolean(r.home),
    thumbs: (r.thumbs as string[] | null | undefined) ?? [],
    coverAssetId: (r.coverAssetId as string | undefined) ?? '',
  }
}
