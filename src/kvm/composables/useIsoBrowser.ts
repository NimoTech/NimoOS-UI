import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { isIsoFile } from '../util/isoMatch'

/**
 * ISO 选择器自定义区(本地文件浏览)数据层。照 Vue2 OSSelector.vue
 * fetchCustomDir(:304-321)/ navigateCustomUp(:323-326)。
 *
 * 改正确(已申报,非照抄):Vue2 的 fetchCustomDir 没有任何过期守卫——用户快速点两层
 * 目录(比如先点 A、又点 A 的子目录 A/B)时,若 A 的响应比 A/B 的响应更晚落定,会把
 * customPath/customItems 覆盖回 A 的内容,造成"路径显示是 A/B、列表内容却是 A 的"错位。
 * 这里用代际计数器(每次 fetch() 自增 gen,写 state 前比对 myGen === gen)修正:只有
 * 最新一次发起的 fetch 的响应才允许写 state,更早发起、更晚落定的响应被安静丢弃。
 *
 * 两层守卫分工(硬约束 3 的 Task 4 纪律,逐条说清承重/纵深防御):
 * - `alive`(dispose 守卫):承重。dispose() 之后到达的任何响应——不管它是不是
 *   当时最新的一次 fetch——都不再写 state,这是"组件已经不存在了"这件事本身的处理。
 *   对应用例:「dispose 后落定不写 state」,dispose() 全程没有发起新 fetch,gen
 *   完全没变化,纯粹靠 alive 挡下写入。
 * - `gen`(乱序守卫):承重,与 alive 是两件独立的事,互不替代。即使组件还活着
 *   (没调用 dispose),后发起的 fetch 也必须赢过先发起、后落定的 fetch——这是
 *   "两次请求都合法在途,但只认最新一次"的处理。对应用例:「后到先得」,那条用例
 *   全程没有调用 dispose(),纯粹靠 gen 挡下 A(先发起、后落定)覆盖 B(后发起、先落定)
 *   的结果。
 * 两者都是承重机制而非纵深防御——各自有独立的测试用例只覆盖自己那一层,删掉任一层
 * 都会让对应的那条用例翻红(变异验证见 task-6-report.md)。
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
      if (!alive || myGen !== gen) return // dispose 守卫 / 乱序守卫:不是最新一次或已卸载
      const content = res.content ?? []
      // 照 Vue2 fetchCustomDir(:310-313):只保留目录与 .iso 文件。
      items.value = content.filter((item) => item.is_dir || isIsoFile(item.name))
      path.value = p
    } catch (e) {
      // ⚠️ 有意照抄 Vue2(:316-317,只 console.warn):失败时保留原 path 与 items 不变——
      // 用户点进一个没权限的目录时,停在原地比清空列表好。不是吞错疏漏,是有意的降级策略。
      console.warn('[useIsoBrowser] fetch failed:', e instanceof Error ? e.message : e)
    } finally {
      // 同样要过 alive/gen 双守卫:一次过期的 fetch 不该在自己的 finally 里把 isLoading
      // 掰回 false,可能正踩在一个更新的 fetch 仍在途、isLoading 应该保持 true 的窗口上。
      if (alive && myGen === gen) isLoading.value = false
    }
  }

  // 照 Vue2 navigateCustomUp(:323-326):按路径分段退到父目录;根目录退化为根目录本身
  // (split('/').slice(0,-1).join('/') 对 '/' 算出空串,用 || '/' 兜底)。
  async function up(): Promise<void> {
    const parent = path.value.split('/').slice(0, -1).join('/') || '/'
    await fetch(parent)
  }

  function dispose(): void {
    alive = false
  }

  return { path, items, isLoading, fetch, up, dispose }
}
