import { ref, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { buildSearchView } from './buildSearchView'
import { deriveDegrade } from './degrade'
import type { DegradeState, SearchView } from './types'

// Lifecycle of search requests. Component only manages rendering, does not touch requests.
//
// ⚠️ stale guard (local epoch, not extracted to common guard): user changes query and searches again,
//    earlier request may arrive later. Without guard → old result overwrites new / old request's failure
//    sets already-successful UI to error state. reset() also increments epoch, invalidating in-flight results
//    (must not write to panel after closing).
// ⚠️ on failure, **do not write view** —— spec §7.8 bottom line: when AI is unreachable, show
//    "search service unavailable + retry", never degrade to what looks like "no results found".

export type SearchState = 'idle' | 'searching' | 'done' | 'error'

export function useSearchQuery(): {
  query: Ref<string>
  state: Ref<SearchState>
  view: Ref<SearchView | null>
  degrade: Ref<DegradeState | null>
  errorDetail: Ref<string>
  run: () => Promise<void>
  reset: () => void
} {
  const query = ref('')
  const state = ref<SearchState>('idle')
  const view = ref<SearchView | null>(null)
  const degrade = ref<DegradeState | null>(null)
  const errorDetail = ref('')
  let epoch = 0

  async function run(): Promise<void> {
    const q = query.value.trim()
    if (!q) return
    const mine = ++epoch
    state.value = 'searching'
    errorDetail.value = ''
    try {
      const agg = await service.search.agentTool(q)
      if (mine !== epoch) return
      const v = buildSearchView(agg, q)
      view.value = v
      degrade.value = deriveDegrade(agg, v.total)
      state.value = 'done'
    } catch (e) {
      if (mine !== epoch) return
      errorDetail.value = e instanceof Error ? e.message : String(e)
      state.value = 'error'
    }
  }

  function reset(): void {
    epoch++
    state.value = 'idle'
    view.value = null
    degrade.value = null
    errorDetail.value = ''
  }

  return { query, state, view, degrade, errorDetail, run, reset }
}
