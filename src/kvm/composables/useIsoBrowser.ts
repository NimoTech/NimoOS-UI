import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { isIsoFile } from '../util/isoMatch'

/**
 * Data layer for the ISO selector's custom section (local file browsing). Mirrors Vue2
 * OSSelector.vue fetchCustomDir(:304-321) / navigateCustomUp(:323-326).
 *
 * Correctness fix (declared deviation, not a straight port): Vue2's fetchCustomDir has no
 * staleness guard at all -- when the user quickly clicks two directory levels (e.g. A first,
 * then its subdirectory A/B), if A's response settles later than A/B's, it overwrites
 * customPath/customItems back to A's content, producing a mismatch where the path shows A/B
 * but the list shows A. Fixed here with a generation counter (each fetch() increments gen,
 * and myGen === gen is checked before writing state): only the response of the most recently
 * issued fetch may write state; responses issued earlier but settling later are silently dropped.
 *
 * Division of labor between the two guards (Task 4 discipline of hard constraint 3, spelling
 * out load-bearing vs defense-in-depth per item):
 * - `alive` (dispose guard): load-bearing. Any response arriving after dispose() -- whether
 *   or not it belongs to the latest fetch at the time -- no longer writes state; this handles
 *   the fact that "the component no longer exists".
 *   Corresponding test case: "after dispose, response does not write state" -- dispose() issues no new fetch,
 *   gen never changes, and the write is blocked purely by alive.
 * - `gen` (out-of-order guard): load-bearing, and an independent concern from alive; neither
 *   replaces the other. Even while the component is still alive (no dispose called), a later
 *   fetch must win over an earlier-issued, later-settling fetch -- this handles "both requests
 *   are legitimately in flight, but only the latest counts". Corresponding test case:
 *   "last one wins" -- that case never calls dispose(), relying purely on gen to stop A
 *   (issued first, settled later) from overwriting B's (issued later, settled first) result.
 * Both are load-bearing mechanisms, not defense-in-depth -- each has its own dedicated test
 * case covering only its layer; deleting either layer turns the corresponding case red
 * (mutation-verified).
 */
export function useIsoBrowser(): {
  path: Ref<string>
  items: Ref<FolderEntry[]>
  isLoading: Ref<boolean>
  fetch(path: string): Promise<void>
  up(): Promise<void>
  dispose(): void
} {
  const path: Ref<string> = ref('/')
  const items: Ref<FolderEntry[]> = ref([])
  const isLoading = ref(false)

  let alive = true
  let gen = 0

  async function fetch(p: string): Promise<void> {
    const myGen = ++gen
    isLoading.value = true
    try {
      const res = await service.folder.getList(p)
      if (!alive || myGen !== gen) return // dispose guard / out-of-order guard: not latest fetch or component unmounted
      const content = res.content ?? []
      // Mirrors Vue2 fetchCustomDir (:310-313): keep only directories and .iso files.
      items.value = content.filter((item) => item.is_dir || isIsoFile(item.name))
      path.value = p
    } catch (e) {
      // ⚠️ Deliberately mirrors Vue2 (:316-317, console.warn only): on failure, keep original
      // path and items unchanged — when user navigates to a permission-denied directory,
      // staying in place is better than clearing the list. Not error suppression; intentional
      // degradation strategy.
      console.warn('[useIsoBrowser] fetch failed:', e instanceof Error ? e.message : e)
    } finally {
      // Also guard with alive/gen dual check: a stale fetch should not reset isLoading to false
      // in its own finally, might be stepping on a window where a newer fetch is still in flight
      // and isLoading should stay true.
      if (alive && myGen === gen) isLoading.value = false
    }
  }

  // Mirrors Vue2 navigateCustomUp (:323-326): navigate up by path segments to parent directory;
  // root directory degrades to itself (split('/').slice(0,-1).join('/') produces empty string
  // for '/', use || '/' as fallback).
  async function up(): Promise<void> {
    const parent = path.value.split('/').slice(0, -1).join('/') || '/'
    await fetch(parent)
  }

  function dispose(): void {
    alive = false
  }

  return { path, items, isLoading, fetch, up, dispose }
}
