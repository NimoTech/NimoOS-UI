import { ref, watch, onScopeDispose, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { envelopeCodeOf, httpStatusOf, FILE_DOES_NOT_EXIST } from '../util/apiError'
import type { FileEntry } from '../stores/files'

// When the card expands to 3/4 screen, the front card becomes a scrollable file grid.
// Must provide enough items to scroll through — showing only one screen worth means
// two scrolls reaches the bottom. Cap at 200: larger directories are left for
// "enter snapshot" to browse page-by-page; the card is a preview only, not an
// infinite list (no virtual scrolling — thousands of DOM nodes would stall the card animation).
// Excess count is communicated by "+N" at the card's end; total is always the true entry count.
// Note: each cell's thumbnail uses FileThumb's IntersectionObserver lazy loading. The observer
// treats "ancestors with scrollbars trimming off the element" as invisible — so cells not
// scrolled into view in the card will not trigger thumbnail requests.
const MAX_TILES = 200
const HIDDEN = new Set(['lost+found'])

export interface DeckPreview {
  status: 'loading' | 'ready' | 'missing' | 'failed'
  /** Sorted by file grid's default rules, at most MAX_TILES real entries (fed directly to FileThumb) */
  entries: FileEntry[]
  total: number
}

// Matches the default sort in stores/files.ts: folders first, then by name case-insensitive ascending.
// The card previews "what you'll see after entering" — mismatched sort order would make
// users think they entered the wrong directory. Deliberately ignores the user's sort
// preference in the file grid: the card has no sort controls, and following a hidden toggle
// would be confusing. Fixed to the default sort, matching what the file grid shows on first open.
function sortLikeFiles(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (!!a.is_dir !== !!b.is_dir) return a.is_dir ? -1 : 1
    const ka = a.name.toLowerCase(), kb = b.name.toLowerCase()
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

// Whether the folder existed in that snapshot is the most useful thing this composable could
// report -- the card would say so in plain language, and entering the snapshot would land at its
// root instead of composing a path that is not there.
//
// 🔴 The listing endpoint cannot answer it. `service.folder.getList` calls GET /v1/folder, and
// NimoOS core collapses every failure there into one response (route/v1/file.go:399):
//   ctx.JSON(SERVICE_ERROR, Result{ Success: SERVICE_ERROR, Message: "Fail", Data: err.Error() })
// Measured against the production device:
//   GET /v1/folder?path=/DATA/.snapshots/<absent>/Photos
//   -> 500 {"success":500,"message":"Fail","data":"open …: no such file or directory"}
// An absent folder and an unreadable one are indistinguishable, short of pattern-matching a Go
// error string, which this deliberately does not do.
//
// So 'missing' is reported only when a backend actually says so, and the two arms below are the
// two ways that can arrive (a real 404, or FILE_DOES_NOT_EXIST -- which GET /v1/file does send,
// so a sibling endpoint already has the convention). Everything else is 'failed', and the two are
// kept apart rather than merged because their consequences differ: see enterSnapshot, which only
// composes a sub-path for a listing it actually saw succeed.
// Follow-up worth having: /v1/folder returning 60001 the way /v1/file already does would make the
// plain-language card line work; that is a NimoOS core change, not a frontend one.
function isMissing(e: unknown): boolean {
  const envelope = envelopeCodeOf(e)
  // 404 is accepted from either slot because the standard envelope's `success` carries the HTTP
  // status (see util/apiError.ts).
  return envelope === FILE_DOES_NOT_EXIST || envelope === 404 || httpStatusOf(e) === 404
}

// "What this folder looked like at that moment" on the card: snapshot content is a plain
// read-only directory, so use the file grid's existing list API to read <snapshot root>/<current relative path>.
// The caller decides which snapshots are worth a request; today that is just the front card
// (see TimeMachineOverlay's previewNames -- fetching the whole deck window cost up to 7 listings
// per flip for at most two rendered grids). Results are cached by snapshot name, so walking back
// to an already-seen snapshot repeats no request; changing volume or directory invalidates the
// whole cache and supersedes anything still in flight.
export function useDeckPreview(opts: {
  mountPoint: () => string
  relPath: () => string
  visibleNames: () => string[]
}): { previews: Ref<Record<string, DeckPreview>>; ensure: (name: string) => Promise<DeckPreview> } {
  const previews = ref<Record<string, DeckPreview>>({})
  let cacheKey = ''
  // Stale response guard (T9 review Important): when switching directories/volumes, the
  // watch below clears previews and immediately re-fetches for visible snapshots. But
  // **requests from the old directory that are already in flight are not blocked** — if
  // they land after the new request, they silently write old folder content into the
  // current directory's card, with no error/warning. Scrolling won't fix it (the next
  // time with the same name it's treated as "already fetched" by !previews.value[name] and skipped).
  // Increment epoch each time the directory/volume actually changes. Each fetchOne claims
  // the epoch from when it started; before writing previews it confirms its epoch hasn't
  // been superseded. If superseded, the entire result is discarded — same semantics as
  // the epoch guard in snapshotBrowse.ts and volumeRequestUuid in storage/stores/snapshot.ts.
  let epoch = 0
  // Requests still pending after component unmount also shouldn't write previews (same guard covers it, Minor).
  let disposed = false
  onScopeDispose(() => { disposed = true })

  // Deduplicates concurrent asks for the same snapshot: the debounced watch below and an
  // explicit ensure() (see the return value) must not put two listings of the same directory on
  // the wire, and ensure() must be able to await one that is already running.
  // ⚠️ Keyed by epoch AND name, not by name alone. The same snapshot name is requested again
  // after the directory changes, and a bare name key handed that second ask the first ask's
  // promise -- so the NEW directory was never listed, and the card kept showing (or waiting on)
  // the old one. Caught by the "stale response from the old directory" test.
  const inflight = new Map<string, Promise<DeckPreview>>()
  const inflightKey = (name: string, ep: number) => `${ep}::${name}`

  async function fetchOne(name: string, myEpoch: number): Promise<DeckPreview> {
    const dir = opts.relPath()
      ? `${snapshotBrowsePath(opts.mountPoint(), name)}/${opts.relPath()}`
      : snapshotBrowsePath(opts.mountPoint(), name)
    previews.value = { ...previews.value, [name]: { status: 'loading', entries: [], total: 0 } }
    try {
      const data = await service.folder.getList(dir)
      const content = ((data as { content?: FileEntry[] })?.content ?? [])
        .filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name))
      const entries = sortLikeFiles(content).slice(0, MAX_TILES)
      const result: DeckPreview = { status: 'ready', entries, total: content.length }
      // Stale response/unmounted: discard the entire result, don't write state. The value is
      // still handed back to whoever awaited this particular call -- it is the truth about the
      // directory that was asked for, and that caller does its own staleness check (see
      // TimeMachineOverlay's enterSnapshot); what must not happen is it landing in the shared map.
      if (!disposed && myEpoch === epoch) previews.value = { ...previews.value, [name]: result }
      return result
    } catch (e) {
      // "did not exist at that time" gets its own plain-language card; everything else is a
      // failure and gets the quieter "couldn't read it just now" line.
      const result: DeckPreview = { status: isMissing(e) ? 'missing' : 'failed', entries: [], total: 0 }
      if (!disposed && myEpoch === epoch) previews.value = { ...previews.value, [name]: result }
      return result
    }
  }

  function start(name: string): Promise<DeckPreview> {
    const key = inflightKey(name, epoch)
    const running = inflight.get(key)
    if (running) return running
    const p = fetchOne(name, epoch)
    inflight.set(key, p)
    void p.finally(() => { if (inflight.get(key) === p) inflight.delete(key) })
    return p
  }

  // Await a settled answer for one snapshot, reusing the cache or an in-flight request. Exists
  // for decisions that cannot be made on "not known yet" -- entering a snapshot has to know
  // whether the folder existed at that moment, and the listing behind that answer is debounced.
  function ensure(name: string): Promise<DeckPreview> {
    const cached = previews.value[name]
    if (cached && (cached.status === 'ready' || cached.status === 'missing')) return Promise.resolve(cached)
    return start(name)
  }

  watch(
    () => [opts.mountPoint(), opts.relPath(), opts.visibleNames().join('|')].join('::'),
    () => {
      const key = `${opts.mountPoint()}::${opts.relPath()}`
      // Switching volumes or directories invalidates all cached directory content and
      // supersedes any in-flight old requests
      // Superseded requests are dropped from the dedupe table too: they can no longer be
      // reused (their key carries the old epoch) and keeping them would just leak.
      if (key !== cacheKey) { cacheKey = key; previews.value = {}; epoch += 1; inflight.clear() }
      if (!opts.mountPoint()) return
      for (const name of opts.visibleNames()) {
        const cached = previews.value[name]
        // A `failed` entry means the request blew up -- usually a blip. It used to
        // count as "already fetched" and the card stayed a text card for as long as
        // it remained visible, even after the network came back. `missing` is
        // a stable fact about that snapshot and is never retried.
        if (!cached || cached.status === 'failed') void start(name)
      }
    },
    { immediate: true },
  )

  return { previews, ensure }
}
