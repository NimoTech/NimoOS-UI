import { ref, watch, onScopeDispose, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { snapshotBrowsePath } from '../util/snapshotPath'
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

// Extracts HTTP status from thrown errors. Same logic as statusOf in files/util/snapshotRestore.ts:
// the shared package's unwrap() throws Error & {code} (from envelope success field);
// axios throws network 4xx with status in response.status — must handle both cases.
function statusOf(e: unknown): number | undefined {
  const withCode = e as { code?: number; response?: { status?: number } } | undefined
  return withCode?.code ?? withCode?.response?.status
}

// "What this folder looked like at that moment" on the card: snapshot content is a plain
// read-only directory, so use the file grid's existing list API to read <snapshot root>/<current relative path>.
// Only fetch for **currently visible** cards (the card deck window shows 5+2 cards);
// results are cached by snapshot name — scrolling back and forth won't repeat requests;
// when switching volumes or directories the cache is completely invalidated and re-fetched.
export function useDeckPreview(opts: {
  mountPoint: () => string
  relPath: () => string
  visibleNames: () => string[]
}): { previews: Ref<Record<string, DeckPreview>> } {
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

  async function fetchOne(name: string, myEpoch: number) {
    const dir = opts.relPath()
      ? `${snapshotBrowsePath(opts.mountPoint(), name)}/${opts.relPath()}`
      : snapshotBrowsePath(opts.mountPoint(), name)
    previews.value = { ...previews.value, [name]: { status: 'loading', entries: [], total: 0 } }
    try {
      const data = await service.folder.getList(dir)
      if (disposed || myEpoch !== epoch) return // stale response/unmounted: discard entire result, don't write state
      const content = ((data as { content?: FileEntry[] })?.content ?? [])
        .filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name))
      const entries = sortLikeFiles(content).slice(0, MAX_TILES)
      previews.value = { ...previews.value, [name]: { status: 'ready', entries, total: content.length } }
    } catch (e) {
      if (disposed || myEpoch !== epoch) return
      // 404 = folder didn't exist at that time (card should speak plain English);
      // everything else is failed, silently fall back to text-only card.
      const status = statusOf(e)
      previews.value = {
        ...previews.value,
        [name]: { status: status === 404 ? 'missing' : 'failed', entries: [], total: 0 },
      }
    }
  }

  watch(
    () => [opts.mountPoint(), opts.relPath(), opts.visibleNames().join('|')].join('::'),
    () => {
      const key = `${opts.mountPoint()}::${opts.relPath()}`
      // Switching volumes or directories invalidates all cached directory content and
      // supersedes any in-flight old requests
      if (key !== cacheKey) { cacheKey = key; previews.value = {}; epoch += 1 }
      if (!opts.mountPoint()) return
      for (const name of opts.visibleNames()) {
        const cached = previews.value[name]
        // A `failed` entry means the request blew up -- usually a blip. It used to
        // count as "already fetched" and the card stayed a text card for as long as
        // it remained visible, even after the network came back. `missing` (404) is
        // a stable fact about that snapshot and is never retried.
        if (!cached || cached.status === 'failed') fetchOne(name, epoch)
      }
    },
    { immediate: true },
  )

  return { previews }
}
