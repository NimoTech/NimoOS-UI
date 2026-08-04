import { ref, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { buildSearchView } from './buildSearchView'
import { deriveDegrade } from './degrade'
import type { DegradeState, SearchView } from './types'

// 搜索请求的生命周期。组件只管渲染,不碰请求。
//
// ⚠️ 过期守卫(就地 epoch,不抽公共 guard):用户改词后再搜,先发的请求可能后回来。
//    没有守卫 → 旧结果覆盖新结果 / 旧请求的失败把已经成功的界面打成 error。
//    reset() 同样递增 epoch,让在途结果作废(关掉面板后不许再往里写)。
// ⚠️ 失败时**不写 view** —— spec §7.8 底线:AI 不可达要显示「搜索服务不可用 + 重试」,
//    绝不能退化成一个看起来像「没搜到」的空列表。

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
