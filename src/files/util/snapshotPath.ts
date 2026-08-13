// Pure path functions for snapshot browsing in the Files area. Ported verbatim from Vue2
// NimoOS-UI/src/service/snapshot.js (6 functions) and components/filebrowser/snapshotBrowse.js (3) —
// decision logic, return shapes, and fail-safe direction all unchanged; only TS types added. These
// functions know nothing about "volumes" (except the two lookup functions that explicitly take
// volumes) and work purely on path segments, so every mount point is treated alike.

export interface SnapshotBrowseInfo {
  mount: string
  snapshotName: string
  /** Path relative to the snapshot root; empty string when browsing the snapshot's own root */
  relPath: string
}

export interface SnapshotVolumeLike {
  volume_uuid?: string
  mount?: string
  supported?: boolean
  [k: string]: unknown
}

export interface VolumesState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  volumes: SnapshotVolumeLike[]
}

/** Name of the read-only subvolume directory under every snapshot-capable mount point —
 *  "enter a snapshot" and "detect we're inside a snapshot" share this one constant, so they can't drift. */
export const SNAPSHOTS_DIR_NAME = '.snapshots'

const stripTrailingSlash = (p: string | undefined | null): string => (p || '').replace(/\/+$/, '')

export function snapshotBrowsePath(mount: string, snapshotName: string): string {
  return `${mount}/${SNAPSHOTS_DIR_NAME}/${snapshotName}`
}

// Segment matching (not includes substring matching): a regular directory whose name merely contains
// ".snapshots" text is never misidentified. With multiple ".snapshots" segments, take the leftmost —
// the outer one is the mount boundary; inner ones are real ordinary data directories inside the snapshot.
export function parseSnapshotBrowsePath(absPath: string | null | undefined): SnapshotBrowseInfo | null {
  if (!absPath || typeof absPath !== 'string') return null
  const clean = stripTrailingSlash(absPath)
  if (!clean) return null
  const segments = clean.split('/')
  const idx = segments.indexOf(SNAPSHOTS_DIR_NAME)
  if (idx === -1) return null
  const mount = segments.slice(0, idx).join('/')
  // Empty mount means the path starts directly with "/.snapshots" (or has no leading slash at all) — no real mount point in front
  if (!mount) return null
  const snapshotName = segments[idx + 1]
  if (!snapshotName) return null // ".../.snapshots" itself: no snapshot selected yet
  return { mount, snapshotName, relPath: segments.slice(idx + 2).join('/') }
}

export function liveVolumePath(mount: string, relPath: string): string {
  return relPath ? `${mount}/${relPath}` : mount
}

// Mirrors ParseName in the backend NimoOS-LocalStorage service/snapshot/naming.go, but only extracts the
// "when was it taken" the banner needs; **deliberately does not validate** the type segment against the known-type
// table — when browsing into a snapshot dir of an unrecognized type (or one reconciled to unknown), we should
// still show the real time rather than a blank. Never throws.
export function parseSnapshotName(name: string | null | undefined): { createdAt: Date } | null {
  if (!name || typeof name !== 'string') return null
  const tsPart = name.split('_')[0]
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(tsPart)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const createdAt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)))
  if (Number.isNaN(createdAt.getTime())) return null
  return { createdAt }
}

/** Human-readable time for the banner. Falls back to the raw name when unparseable (no throw, no blank). */
export function formatSnapshotBannerTime(name: string): string {
  const parsed = parseSnapshotName(name)
  return parsed ? parsed.createdAt.toLocaleString() : name
}

// For the entry button: given only the Files area's arbitrary currentPath (possibly several levels deep
// under a mount point), find which volume it belongs to — longest mount-prefix match. Note that when
// clean !== mount, the `${mount}/` prefix is required, otherwise "/DATAX" would be judged as belonging to "/DATA".
export function findVolumeForPath(volumes: SnapshotVolumeLike[], path: string): SnapshotVolumeLike | null {
  if (!path || typeof path !== 'string' || !Array.isArray(volumes)) return null
  const clean = stripTrailingSlash(path)
  let best: SnapshotVolumeLike | null = null
  for (const v of volumes) {
    const mount = stripTrailingSlash(v.mount)
    if (!mount) continue
    if (clean !== mount && !clean.startsWith(`${mount}/`)) continue
    if (!best || mount.length > stripTrailingSlash(best.mount).length) best = v
  }
  return best
}

/** For restore: the exact mount point is already known; exact-match the volume_uuid (tolerating trailing slashes). */
export function findVolumeUuidForMount(volumes: SnapshotVolumeLike[], mount: string): string | null {
  const hit = (volumes || []).find((v) => stripTrailingSlash(v.mount) === stripTrailingSlash(mount))
  return hit && hit.volume_uuid ? hit.volume_uuid : null
}

// Review fix (Critical 1, round 2): the `<mount>/.snapshots` container directory itself — parseSnapshotBrowsePath
// deliberately returns null for it (".snapshots itself: no snapshot selected yet"; that semantic must not change,
// restore orchestration and others depend on it), but that means with shouldGuardSnapshotView alone this level is
// not locked at all: with no parsed result it's judged "not a snapshot view", and the write toolbar, context menu,
// and time-machine entry chip all pop up together. The container directory is usually still writable, so users
// could create junk files inside the snapshot namespace or hit raw filesystem errors operating on read-only subvolumes.
//
// Round 1's isSnapshotsContainerPath(absPath, volumes) rolled its own `volumes.some(...)` check,
// which is always false while volumes is empty (idle/loading/error) — a real probe on recheck confirmed the
// `.snapshots` container directory leaks the lock in all three states, and error is ensureVolumes()'s terminal
// state for the session (this device 404s on all of /v2/snapshot/*), so the leak persists for the whole session.
// The original function also ignored supported entirely, so it conversely mis-locked ordinary directories that
// happen to be named .snapshots on supported:false volumes.
//
// This round writes no second three-state check: do pure path parsing only (knows nothing about "volumes",
// same responsibility boundary as parseSnapshotBrowsePath), synthesize a SnapshotBrowseInfo with snapshotName:'',
// and hand it to the single gate function shouldGuardSnapshotView below, reusing the same idle/loading/error/
// ready+supported logic — idle/loading/error stay locked automatically, the confirmed supported:false exemption is
// inherited too, and the two paths (with a snapshot name vs the container itself) can no longer diverge in
// fail-safe direction.
export function parseSnapshotsContainerPath(absPath: string | null | undefined): SnapshotBrowseInfo | null {
  if (!absPath || typeof absPath !== 'string') return null
  const clean = stripTrailingSlash(absPath)
  if (!clean) return null
  const segments = clean.split('/')
  if (segments.length < 2 || segments[segments.length - 1] !== SNAPSHOTS_DIR_NAME) return null
  const mount = segments.slice(0, -1).join('/')
  // Empty mount means the path is literally "/.snapshots" (no real leading mount point) —
  // stays consistent with the same rule in parseSnapshotBrowsePath: no match.
  if (!mount) return null
  return { mount, snapshotName: '', relPath: '' }
}

// Final gate for the read-only lock, sitting in front of parseSnapshotBrowsePath.
//
// The fail-safe direction is a **deliberate product decision, not an oversight**: unless a resolved volume
// list positively says "this mount point is confirmed supported: false", stay locked. A false lock merely
// makes an ordinary directory that happens to be named ".snapshots" briefly show as read-only (annoying);
// a missed lock sends write requests at a genuinely read-only btrfs snapshot and the user gets a raw
// filesystem error (worse). So idle / loading / error / mount point absent from the list — all four stay locked.
export function shouldGuardSnapshotView(
  parsed: SnapshotBrowseInfo | null,
  state: VolumesState | null | undefined,
): boolean {
  if (!parsed) return false
  if (!state || state.status !== 'ready') return true
  const match = (state.volumes || []).find((v) => stripTrailingSlash(v.mount) === stripTrailingSlash(parsed.mount))
  if (match && match.supported === false) return false
  return true
}

/** The part of the current path relative to the volume root — the time machine uses it to decide which
 *  directory the card shows and where to land after entering a snapshot.
 *  Returns an empty string (falling back to the volume root) when the path isn't under that mount; no guessing. */
export function relPathUnderMount(mount: string, absPath: string): string {
  const m = stripTrailingSlash(mount)
  const p = stripTrailingSlash(absPath)
  if (!m || !p) return ''
  if (p === m) return ''
  if (!p.startsWith(`${m}/`)) return ''
  return p.slice(m.length + 1)
}

/** Where "exit snapshot" should land: the same-named directory on the live volume; back to the volume root if it no longer exists there. */
export async function resolveExitTarget(
  info: SnapshotBrowseInfo | null,
  dirExists: (p: string) => Promise<boolean>,
): Promise<string | null> {
  if (!info) return null
  const target = liveVolumePath(info.mount, info.relPath)
  const exists = await dirExists(target)
  return exists ? target : info.mount
}
