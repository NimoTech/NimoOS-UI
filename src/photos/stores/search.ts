// Ported from the Vue 2 panel's src/store/modules/photos.js:
//   :19-22   (SEARCH_PAGE_LIMIT)
//   :24-27   (smartSearchSeq declaration + doc comment; "any dispatch (including clear) makes in-flight
//             old response void—sequence increment must precede early return branch" sentence verbatim from :655,
//             not in :24-27 doc comment section)
//   :241-259 (state: searchResults/searchQuery/searchFilters/searchOffset/
//             searchExhausted/searchLoadingMore/searchMs/isSearchMode)
//   :365-401 (mutations: SET_SEARCH / SET_SEARCH_LOADING_MORE / APPEND_SEARCH_RESULTS / CLEAR_SEARCH)
//   :654-696 (actions: smartSearch / loadMoreSearchResults / clearSearch)
// searchStateMatchesQuery is a pure function, already landed in util/searchSort.ts by T10, directly reused here without rewriting.
// Follow pattern from stores/places.ts (setup store + direct service connection + __resetForTest).
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
import { searchStateMatchesQuery } from '../util/searchSort'

// Verbatim from Vue2 :19-22 including comment: both homepage size and loadMore increment. Deep pages (offset>0)
// backend contract guarantees all belowCut=true, only falls into "more results" tier (search-cut-tiering design).
export const SEARCH_PAGE_LIMIT = 50

export const usePhotosSearch = defineStore('photosSearch', () => {
  const results = ref<Photo[]>([])
  const query = ref('')
  // filtersPayload pipeline ported verbatim (Vue2 :245 searchFilters, loadMore reuses same copy).
  // Handoff fact (also noted in report): Vue2's only dispatch point PhotosTimeline.vue:652
  // never passes filters (always {}), the 6 filter chips are pure client-side narrowing (PhotosSearchView.vue:395
  // comment clarifies), this pipeline currently has no consumers—T16 should not expect it to handle chip filtering.
  const filtersPayload = ref<Record<string, unknown>>({})
  const offset = ref(0)
  const exhausted = ref(false)
  const loadingMore = ref(false)
  const ms = ref(0)
  const isSearchMode = ref(false)

  // smartSearch/loadMore/clear share the same sequence lock. smartSearchSeq declaration + doc comment
  // is in Vue2 :24-27; the sentence below is verbatim from the comment inside smartSearch action (:655):
  // any dispatch (including clear) makes in-flight old responses void—sequence increment must precede early return branch.
  let searchSeq = 0

  // Follow Vue2 CLEAR_SEARCH's clearSearch action (:392-401 + :694).
  function clear(): void {
    results.value = []
    query.value = ''
    filtersPayload.value = {}
    offset.value = 0
    exhausted.value = false
    loadingMore.value = false
    ms.value = 0
    isSearchMode.value = false
    // Divergence record (new, report E3 / spec 4): Vue2 CLEAR_SEARCH :392-401 has no this line—
    // after clear() if an in-flight smartSearch/loadMore response still exists, Vue2 has nothing to stop it from
    // writing results back. Here we bump seq so any in-flight response's `mine !== searchSeq` check fails
    // and gets discarded. Note this is increment, not reset to 0 (reset to 0 would create alias collision, see __resetForTest).
    searchSeq++
  }

  // Follow Vue2 smartSearch action (:654-671, including catch) + catch branch modification (§7e-12, see below).
  async function smartSearch(q: string, filters: Record<string, unknown> = {}): Promise<void> {
    const trimmed = (q || '').trim()
    // Verbatim from Vue2 :655-657 empty query early return—but in sequence, first fall through to clear() to bump seq.
    // Vue2 source is "first `const seq = ++smartSearchSeq` then check early return", here written as
    // "first early return via clear() (which itself bumps seq) then ++searchSeq"—both approaches are equivalent
    // under the premise "clear() also bumps seq itself" (controller verified this equivalence, see report E3):
    // any empty-query dispatch makes the in-flight old response's seq comparison fail.
    if (!trimmed) { clear(); return }
    const mine = ++searchSeq
    const t0 = performance.now()
    try {
      const res = await service.photos.smartSearch(trimmed, SEARCH_PAGE_LIMIT, 0, filters)
      if (mine !== searchSeq) return // in-flight window: old response void (including being interrupted by updated search or clear())
      const list = ((res as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      results.value = list
      query.value = trimmed
      filtersPayload.value = filters
      ms.value = performance.now() - t0
      offset.value = 0
      exhausted.value = list.length < SEARCH_PAGE_LIMIT
      loadingMore.value = false
      isSearchMode.value = true
    } catch (e) {
      // M5 (review required): console.error must come before seq comparison. Note that relative to Vue2
      // this step is actually alignment (not divergence)—Vue2 :670 already logs unconditionally, and the catch branch
      // has no seq guard at all; the actual divergence relative to Vue2 is the seq guard below itself (see
      // §7e-12). Placing the log before the guard: even if this failure is already stale (superseded by an updated search/clear()),
      // it is still a real backend error that occurred, store discipline requires "every catch must
      // console.error", losing the log = losing diagnostic signal (debugging sporadic backend issues needs exactly this
      // trace). "Avoiding noise" is insufficient to offset this cost.
      console.error('[photos-search] smartSearch', e)
      if (mine !== searchSeq) return // stale: log already printed, but must block state advancement to not overwrite updated search results
      // Divergence record (§7e-12, 12th new Vue2 defect): Vue2 catch branch (:669-671,
      // console.error at :670) on failure only logs, query/isSearchMode/results remain all not
      // updated—next matchesQuery(new term) is always false (searchQuery still holds last successful old term),
      // view stays permanently in "searching" in-flight state because it cannot distinguish "response not yet received" from
      // "received but failed". Here we advance state to "this term searched, zero results", letting view correctly land in empty state
      // instead of permanent loading.
      results.value = []
      query.value = trimmed
      filtersPayload.value = filters
      ms.value = performance.now() - t0
      offset.value = 0
      exhausted.value = true
      loadingMore.value = false
      isSearchMode.value = true
    }
  }

  // Follow Vue2 loadMoreSearchResults action (:677-692) + APPEND_SEARCH_RESULTS mutation (:384-391).
  async function loadMore(): Promise<void> {
    if (loadingMore.value || exhausted.value || !query.value) return
    const capturedQuery = query.value
    // Divergence record (E4, controller decision—fixes real Vue2 race condition, see report): Vue2 :677-692 only has
    // the query-string comparison below (1:1 preserved), no seq guard. Hole: when re-searching same term (result set already swapped
    // by new smartSearch to new homepage, offset reset to 0), query comparison mistakenly passes, old loadMore
    // deep page gets concat into new result set, offset shifts to 50—result set pollution + pagination misalignment. Here we stack
    // a seq lock shared with smartSearch/clear to plug this hole.
    const mine = searchSeq
    const nextOffset = offset.value + SEARCH_PAGE_LIMIT
    loadingMore.value = true
    try {
      const res = await service.photos.smartSearch(
        capturedQuery, SEARCH_PAGE_LIMIT, nextOffset, filtersPayload.value,
      )
      // Verbatim from Vue2 :686 query-string comparison (1:1 preserved).
      if (query.value !== capturedQuery) return
      // Stacked seq guard (E4 new addition, see comment above).
      if (mine !== searchSeq) return
      const raw = ((res as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      // Vue2→Vue3 iron rule: Photo.id is string | number, mixing 1 and '1' in Set fails deduplication,
      // both Set construction and Set lookups must String().
      const seen = new Set(results.value.map(p => String(p.id)))
      const fresh = raw.filter(p => !seen.has(String(p.id)))
      results.value = results.value.concat(fresh)
      offset.value = nextOffset
      // Verbatim from Vue2 :390 dual condition: results.length (= raw, original count of this new page before deduplication)
      // < LIMIT, or after deduplication not a single fresh item (repeated page / index jitter)—to avoid infinite loop repeatedly requesting the same page.
      exhausted.value = raw.length < SEARCH_PAGE_LIMIT || fresh.length === 0
    } catch (e) {
      console.error('[photos-search] loadMore', e)
    } finally {
      // Divergence record (M8, review required—fixes timing defect inherited from Vue2 :691): Vue2 finally unconditionally
      // resets searchLoadingMore. Vue2 relies on button click (narrow window); T15 does
      // infinite scroll = auto-trigger, probability of two loadMore calls colliding in sequence is significantly higher.
      // Timing: loadMore#1 in-flight → user re-searches successfully (resets both offset/loadingMore) →
      // loadMore#2 takes off (in-flight) → loadMore#1's stale response arrives, caught by query/seq
      // guard above—but if here we unconditionally reset, it erases the fact "loadMore#2 still in-flight",
      // allowing one re-entrant request through, and its calculated nextOffset is identical to #2's (offset not yet
      // updated by #2) ⇒ collides to duplicate page ⇒ after deduplication fresh.length===0 ⇒ exhausted set true prematurely,
      // "more to load" disappears from UI. Changed to reset only when `mine === searchSeq`—using same seq guard finally
      // technique from places.ts:241 / usePersonDetail.ts:82.
      // Safety: not "every path of smartSearch/clear will set to false"—stale smartSearch
      // at :71/:90 will early return and not set to false. What actually holds: seq is incremented only by smartSearch and
      // clear(), and "most recent" smartSearch or clear by definition cannot be stale
      // —it lands either on success path (:79) or non-stale catch branch (:103), or
      // clear()'s synchronous immediate set to false, all three explicitly set loadingMore to false. So adding this condition
      // won't leave loadingMore permanently stuck at true.
      if (mine === searchSeq) loadingMore.value = false
    }
  }

  // T10 pure function reuse, not rewritten.
  function matchesQuery(q: string): boolean {
    return searchStateMatchesQuery({ isSearchMode: isSearchMode.value, searchQuery: query.value }, q)
  }

  function __resetForTest(): void {
    results.value = []
    query.value = ''
    filtersPayload.value = {}
    offset.value = 0
    exhausted.value = false
    loadingMore.value = false
    ms.value = 0
    isSearchMode.value = false
    // Intentionally not resetting searchSeq (same reason as places.ts:426-429): if there is still a
    // smartSearch/loadMore request issued before __resetForTest in-flight, resetting seq back to 0
    // would create alias collision between new requests after reset and old requests still in-flight before reset,
    // circumventing the `mine !== searchSeq` check. seq only increments never decrements, naturally ensuring any new request's
    // mine value is strictly greater than all previously issued requests.
  }

  return {
    results, query, filtersPayload, offset, exhausted, loadingMore, ms, isSearchMode,
    matchesQuery, smartSearch, loadMore, clear, __resetForTest,
  }
})
