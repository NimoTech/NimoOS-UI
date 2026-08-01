<!--
  SP8-P5b Task 8 —— 「已收录文件」页,第 1 刀:骨架 + 过滤条 + 表头 meta + 错误
  横幅 + 骨架屏 + 空态。1:1 移植自 Vue2 蓝本 `NimoOS-UI` (main@7a6ee6b7)
  `src/views/AI/Knowledge/IndexedFilesView.vue`(826 行,`git show main:` 读取,
  治理文件 §1:工作树是旧分支不可信)。

  🔴 本文件三刀叠加(T8→T9→T10),物理上不能并发。**本刀范围严格是蓝本
  `:1-142` 的模板 + 对应脚本**,范围外的东西(:143 起的 ready 态表格+分页+
  文件详情+批量动作条+整库重建弹窗等)一个字都没有搬,故意留到 T9/T10:
    - `pageState === 'ready'` 分支(表格主体、分页、行详情展开)—— T9/T10
    - `selectedCount`/`overExplicitCap`/`rebuildRow`/`rebuildSelected`/
      `openRebuildAllConfirm`/`doRebuildAll` 等动作条与确认弹窗 —— T9/T10
    - `expSet`/`doneSet`(展开行 / 绿色闪烁反馈)—— T9/T10 才用到
    - `EXPLICIT_REBUILD_CAP`(动作条专用上限,本刀错误横幅只用到
      `FILTER_REBUILD_CAP`)—— T9/T10
  本刀范围内(骨架容器 / 过滤条 7 件 / 表头 meta / 错误横幅 / 骨架屏 / 空态)
  的 DOM 是完整的,不留半个标签、不留 TODO、不留「T9 补」的空壳。

  结构对照(蓝本行区间 → 本文件):
    :1-5     .k-view / .k-scroll / .k-scroll-inner 骨架容器
    :6-57    过滤条 7 件(Root 下拉 / 路径前缀 / 类型前缀 / 状态下拉 /
             仅看失败 / 清除按钮 —— 6 个可见控件,7 是任务书口径含清除按钮)
    :60-90   表头 meta:{n} indexed files + statusSuffix · isAnyIndexing 时的
             「自动刷新 · 30s」· 排序下拉 + 升降序按钮
    :93-103  错误横幅(K14 / K19,见下)
    :106-132 骨架屏(k-ftable 假表头 + 8 行 k-skel 占位)
    :135-142 空态(含 N10 的 .k-empty-btn)

  【K13】删掉蓝本 `selTick`/`expTick`/`doneTick`(Vue2 侦测不到 Set 变更才要的
  强制刷新土办法,Vue3 `ref` 整体替换即触发,不需要)。本刀只用到 `selSet`
  (`_applyFilter` 里清空);`expSet`/`doneSet` 是 T9/T10 的东西,本刀不声明。

  【N10】蓝本 `:139` 的 `.k-empty-btn` 是蓝本自身的未定义类(`git grep
  k-empty-btn main` 只命中这一行模板,`knowledge.scss` 里根本没有这条规则)。
  类名照抄,渲染成无样式按钮,与 Vue2 一致 —— **不进 `knowledgeStyles.test.ts`
  白名单**(它不是 scss 类)。

  【N12】`statusViewLocal` 与 `onStatusViewChange` 承接蓝本 `:496-501`(读)/
  `:658-664`(写)的 `active` ↔ `alive` 反向映射 —— 蓝本自带注释「原型写
  active,API 要 alive」。UI 三值 `active`/`tombstoned`/`all`,API 侧
  `tombstoned` 字段三值 `alive`/`tombstoned`/`all`。**两个方向都照抄,不许
  "统一成一个名字"。**

  【K14】rebuild-all 400 分支(`errorBanner` truthy)不回显后端 `detail` ——
  警示条只留 `400 Bad Request` + 蓝本自带那行 i18n 解释(`aiKbRebuildCapHint`)。
  🔴 设置 `errorBanner` 为非空值的 `doRebuildAll()`(蓝本 :791-808,对应确认弹窗
  `:356-381`)是 T9/T10 的范围,本刀不声明该函数 —— 但 `errorBanner` 这个
  local ref 本身、以及它的展示分支(:93-103)在本刀范围内,故本刀先把展示
  逻辑做对:即便将来 T9/T10 把后端 `detail` 塞进 `errorBanner.value`,这个分支
  也绝不会把它渲染出来。

  【K19】加载错误横幅(`storeError` truthy、`errorBanner` falsy 分支)不回显
  `e.message`(蓝本原文 `{{ storeError }}`,而 `storeError` 就是
  `loadIndexedFiles` catch 里 `s.error = e.message`,knowledgeStore.ts:459),
  改用固定 `aiKbLoadErrorBody`,与 P5a `loadRoots`/`aiKbOpFailed` 同一模具。

  【filters 仍在 store 里】`store.indexedFiles.filters.xxx` —— P5a 治理文件 §5
  已定「照抄」,不把 filters 搬进组件本地状态。

  【_applyFilter 语义】四件事,一件都不能少:offset 归零 + 清选择(selSet)+
  清 errorBanner + 重载(refresh() = 先 loadIndexedFiles 后 startIndexedPolling)。
  `clearFilters()` 复位六个筛选字段后直接调用 `_applyFilter()`(蓝本原文把
  offset 归零/清选择/清错误横幅/重载这四行在 `clearFilters` 里又抄了一遍——
  与 `_applyFilter` 逐字相同,机械去重,不是行为改动)。

  【生命周期】`onMounted` → `refresh()`(先 `loadIndexedFiles`,后
  `startIndexedPolling`),对应蓝本 `created()`。`onUnmounted` → 停轮询,对应
  蓝本 `beforeDestroy()`——虽然任务书的生命周期小节只点名了 created 半边,
  但本刀已经在挂载时可能启动 30 秒轮询(`isAnyIndexing` 为真时),
  `startIndexedPolling` 的定时器句柄是 knowledgeStore.ts 里的**模块级**变量
  (跨 Pinia 实例共享),不停轮询会让一个测试挂载启动的定时器持续存活并触发
  `startIndexedPolling` 自己的守卫(`if (indexedPollTimer) return`),污染
  后续测试/挂载——与 T5(M-4)同一教训,故补上这个必要的生命周期对称,不算
  「提前搬 T9/T10 的东西」。

  【颜色】附录 B 已核实本文件模板零内联色字面量,不需要 §B.0 的 color-mix
  映射;守卫缺口③(color-guard 不扫模板 `style=`)仍然存在,测试文件里补了
  照 T5 同款的定向断言。

  ══════════════════════════════════════════════════════════════════════
  SP8-P5b Task 9 —— 第 2 刀:表头行 + 文件行 · 行内详情面板 · 分页
  (蓝本 :146-317)。本刀落地了 T8 留的占位注释那一段。

  结构对照(蓝本行区间 → 本文件):
    :148-165 表头行(全选复选框 + 7 个列标题)
    :168-259 文件行:三组属性态(data-selected/data-status/data-done)·
             statusBadgeMap 四态徽标(N14)· 路径单元格(errhint/zerohint)·
             类型标签(simplifyMime + Legacy)· 大小/时间 · 向量数
             (data-zero)· 重建按钮(三种 title)· 展开按钮(data-open)
    :261-293 行内详情面板:5 个字段格(tombstoned_at 条件出现)+ last_error 条
    :298-317 分页:currentPage/pageCount/pageFrom/pageTo 四个计算 · 每页条数
             4 档 · 上下页禁用条件

  【N14,🔴 最容易翻车】`statusBadgeMap` 的 `en` 字段蓝本是一物两用(:191 的
  `title` 用未翻译原始英文,:197 的徽标文字用 `$t()` 翻译后的中文,靠"英文原
  串即 i18n key"的巧合)。New-UI 键名是 aiKb*,巧合不成立,故拆成两个字段
  `en`(只给 title)与 `key`(只给徽标文字),不合并。K20:`indexing` 的键
  `aiKbStatusIndexing` 两档同填英文 `Indexing`(Vue2 语言包本来就没有这个
  键,回落显示英文原串,New-UI 逐字复现这个观感)。`badgeFor()` 查不到时的
  兜底(蓝本 :190/:194):data-s 回落 'ok'、title/文字回落 file.status 原串、
  icon 回落 'check'。

  【N13】`.k-status-badge-cn`(蓝本 :197)是蓝本自身的未定义类(`git grep
  k-status-badge-cn main` 只命中这一行模板,`knowledge.scss` 里没有这条规
  则)。类名照抄,**不进** `knowledgeStyles.test.ts` 白名单(它不是 scss
  类),与 N10 同处理。

  【tomb glyph】KIcon 的 `tomb` glyph 在本文件模板里没有字面量
  `name="tomb"`,只经 `statusBadgeMap.tombstoned.icon` 动态取到(治理 §1.2
  已核实存在,不要因为 grep 不到字面量就去改 KIcon.vue——它在零改动清单里)。

  【K13,expSet】`toggleExpand` 用 `expSet = ref(new Set())`,写时整体替换,
  不引入蓝本的 `expTick`(Vue2 侦测不到 Set 变更才需要的强制刷新土办法,
  Vue3 ref 替换即触发)。

  【doneSet 本刀只读不写】`doneSet` 声明为空 `ref(new Set())`,`data-done`
  绑定它但本刀代码从不写入——`_flashDone`(蓝本 :811-823,重建成功后的绿色
  闪烁反馈)整体留给 T10。测试对 `data-done` 的"真"侧覆盖走 T8 已确立的
  `(w.vm as unknown as {...}).xxx` 直接读写 `<script setup>` 内部 ref 的技巧
  (与 errorBanner 同一手法),不是新增功能入口。

  【rebuildRow 本刀是文档化占位】按钮的禁用条件 / 三种 title / 图标切换是本
  刀范围(蓝本 :225-244,DOM 完整),但 `@click` 处理函数体的完整实现(store
  派发 + toast + startIndexedPolling + `_flashDone`,蓝本 :760-770)要求写
  `doneSet`——上一条已说明本刀 `doneSet` 只读不写,所以这个函数体留空占位,
  T10 直接替换函数体即可,不改按钮 DOM、不改调用点。这是本刀唯一一处"声明
  但函数体留空"的偏离,报告里会重点说明。

  【多选复选框:read+write 都在本刀】`selSet` 是 T8 已声明的 ref,本刀补
  `toggleRow`/`toggleAll`/`selectablePageIds`/`allSelected`/`someSelected`
  (含 indeterminate 的 watch)——这几个是自包含的纯 Set 操作,不依赖任何
  HTTP 派发或 T10 才有的东西(与 rebuildRow 不同),所以照 K13 的
  `toggleExpand` 同等对待,本刀落地真实读写,不留占位。`selectedCount` /
  `overExplicitCap` / `rebuildSelected` / 底部动作条 / 整库重建确认弹窗 才是
  T10 的"多选"范围(依赖批量重建的 HTTP 派发)。

  【本刀依然不做的(留给 T10)】`EXPLICIT_REBUILD_CAP`、`selectedCount`、
  `overExplicitCap`、`rebuildSelected`、`openRebuildAllConfirm`、
  `doRebuildAll`、`showRebuildAllConfirm`、底部动作条(`.k-files-actionbar`)、
  整库重建确认弹窗、`_flashDone`(见上)、30 秒轮询在重建动作里的
  `startIndexedPolling()` 调用、路由反转。
  ══════════════════════════════════════════════════════════════════════
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, type IndexedFile } from '../stores/knowledgeStore'
import { anyIndexing } from '../util/indexedFiles'
import { fmtBytes, fmtRel, fmtAbs, simplifyMime, topSegment } from '../util/indexedFilesView'

const { t } = useI18n()
const store = useKnowledgeStore()

/** 蓝本 :393 —— 本刀错误横幅用得到的那个上限。`EXPLICIT_REBUILD_CAP`(蓝本
 * :392,批量重建按钮专用)本刀不声明,T9/T10 的动作条才用到。 */
const FILTER_REBUILD_CAP = 10000

/** K13 —— 本刀只用到 selSet(`_applyFilter` 清空)。 */
const selSet = ref<Set<string>>(new Set())

/** 蓝本 data() 的 `errorBanner`(:465)—— rebuild-all 400 分支的错误横幅,
 * 见文件头注释【K14】。 */
const errorBanner = ref<string | null>(null)

/** T9:K13,展开行——见文件头注释【K13,expSet】。 */
const expSet = ref<Set<string>>(new Set())

/** T9:蓝本 doneSet(:457)—— 本刀只读不写,见文件头注释【doneSet 本刀只读
 * 不写】。 */
const doneSet = ref<Set<string>>(new Set())

/** T9:蓝本 `ref="selectAllRef"`(:155)—— 命令式设置 checkbox 的
 * indeterminate(HTML 没有声明式 indeterminate attribute)。 */
const selectAllRef = ref<HTMLInputElement | null>(null)

// ── computed(蓝本对应 computed 段,本刀范围用到的那些)──

const total = computed<number>(() => store.indexedFiles.total)

/** T9:蓝本 files(:475)—— 直接别名 store 的文件数组,减少模板里重复写
 * `store.indexedFiles.files`。 */
const files = computed<IndexedFile[]>(() => store.indexedFiles.files)
const storeError = computed<string | null>(() => store.indexedFiles.error)

/** 蓝本 pageState —— loading 优先于 empty,empty 判据是 total === 0。 */
const pageState = computed<'loading' | 'empty' | 'ready'>(() => {
  if (store.indexedFiles.loading) return 'loading'
  if (total.value === 0) return 'empty'
  return 'ready'
})

/** 蓝本 isAnyIndexing —— 复用 P5a 零改动清单里的 `anyIndexing`。 */
const isAnyIndexing = computed<boolean>(() => anyIndexing(store.indexedFiles.files))

/** N12(读方向)—— API `tombstoned` 字段的 `alive` 映射回 UI 的 `active`,
 * 其余两值原样透传。 */
const statusViewLocal = computed<'active' | 'tombstoned' | 'all'>(() => {
  const tv = store.indexedFiles.filters.tombstoned
  if (tv === 'alive') return 'active'
  if (tv === 'tombstoned') return 'tombstoned'
  return 'all'
})

/** 蓝本 statusSuffix —— 非「仅未删除」时在文件计数后缀括注当前状态视图。 */
const statusSuffix = computed<string>(() => {
  const v = statusViewLocal.value
  if (v === 'tombstoned') return ' (' + t('aiKbStatusRemoved') + ')'
  if (v === 'all') return ' (' + t('aiKbAll') + ')'
  return ''
})

/** 蓝本 filtersDirty —— 六个条件,一个都不能少:path_prefix / mime_prefix /
 * has_error 任一非空真值,或 tombstoned/sort/order 任一偏离默认值。 */
const filtersDirty = computed<boolean>(() => {
  const f = store.indexedFiles.filters
  return !!(
    f.path_prefix ||
    f.mime_prefix ||
    f.has_error ||
    f.tombstoned !== 'alive' ||
    f.sort !== 'indexed_at' ||
    f.order !== 'desc'
  )
})

/** 蓝本 derivedRoots —— best-effort:从当前页已加载文件的路径首段派生,不是
 * 服务端权威 Root 列表(蓝本原注释如此)。 */
const derivedRoots = computed<string[]>(() => {
  const segs = new Set<string>()
  store.indexedFiles.files.forEach((f) => {
    const path = f.paths && f.paths[0] ? f.paths[0].path : null
    const seg = topSegment(path)
    if (seg) segs.add(seg)
  })
  return Array.from(segs).sort()
})

/** 蓝本 rootSelect —— 从 `path_prefix` 反推 Root 下拉应显示的值:只有当
 * `path_prefix` 形如 `/<seg>/` 且 `<seg>` 确实在 `derivedRoots` 里才回显该
 * 段,否则一律回落 `'all'`(含用户手打路径前缀、或该 Root 已不在当前页数据里
 * 的情况)。 */
const rootSelect = computed<string>(() => {
  const pp = store.indexedFiles.filters.path_prefix
  if (!pp) return 'all'
  const m = pp.match(/^\/([^/]+)\/$/)
  if (m && derivedRoots.value.includes(m[1])) return m[1]
  return 'all'
})

// ── T9:statusBadgeMap(N14)—— 见文件头注释【N14】。`en` 只给 :title(原始
// 英文,不翻译),`key` 只给徽标文字(i18n 键,渲染中文)。蓝本 :573-580。 ──

interface StatusBadgeEntry {
  en: string
  key: string
  icon: string
  cls: string
}
const statusBadgeMap: Record<string, StatusBadgeEntry> = {
  ok: { en: 'Indexed', key: 'aiKbStatusIndexed', icon: 'check', cls: 'ok' },
  indexing: { en: 'Indexing', key: 'aiKbStatusIndexing', icon: 'spinner', cls: 'indexing' },
  error: { en: 'Error', key: 'aiKbStatusError', icon: 'x', cls: 'error' },
  tombstoned: { en: 'Removed', key: 'aiKbStatusRemoved', icon: 'tomb', cls: 'tombstoned' },
}

/** 蓝本 :190/:194 的兜底分支——查不到时返回 `null`,调用处的三元表达式各自
 * 回落 data-s='ok' / title=file.status / icon='check' / 文字=file.status。 */
function badgeFor(status: string | undefined): StatusBadgeEntry | null {
  return status ? (statusBadgeMap[status] ?? null) : null
}

/** T9:`knowledgeStore.ts`(零改动文件)里 `IndexedFile.indexed_at` /
 * `tombstoned_at` 的类型标注是 `string`,但 fixture / 真机实际给的是毫秒
 * 时间戳 `number`(与 `fmtRel`/`fmtAbs` 的形参类型一致)——这是既有类型标注
 * 的疏漏,本刀不改 store,用这个转换点吸收类型差,避免在模板里到处写
 * `as` 断言。 */
function ms(v: unknown): number | null | undefined {
  return v as number | null | undefined
}

/** 蓝本 filePath(:610-612)—— 只取 `paths[0].path`,没有则 `'—'`。 */
function filePath(file: IndexedFile): string {
  return file.paths && file.paths[0] ? file.paths[0].path : '—'
}

/** 蓝本 fileModalityKeys(:614-616)。 */
function fileModalityKeys(file: IndexedFile): string[] {
  return Object.keys(file.modalities_done || {})
}

// ── T9:多选(read+write,见文件头注释【多选复选框:read+write 都在本刀】)──

/** 蓝本 selectablePageIds(:533-536)—— 当前页可选行(非 tombstoned)。 */
const selectablePageIds = computed<string[]>(() =>
  files.value.filter((f) => f.status !== 'tombstoned').map((f) => f.file_id),
)
const allSelected = computed<boolean>(() => {
  const ids = selectablePageIds.value
  return ids.length > 0 && ids.every((id) => selSet.value.has(id))
})
const someSelected = computed<boolean>(() =>
  selectablePageIds.value.some((id) => selSet.value.has(id)),
)

// ── T9:分页(蓝本 :519-530)—— 四个计算,边界写法逐字照抄:pageCount 用
// Math.max(1, …) 兜底至少 1 页;pageTo 用 Math.min 钳到 total,不会超出。 ──

const currentPage = computed<number>(() => {
  const f = store.indexedFiles.filters
  return f.limit > 0 ? Math.floor(f.offset / f.limit) : 0
})
const pageCount = computed<number>(() =>
  Math.max(1, Math.ceil(total.value / store.indexedFiles.filters.limit)),
)
const pageFrom = computed<number>(() =>
  total.value === 0 ? 0 : store.indexedFiles.filters.offset + 1,
)
const pageTo = computed<number>(() =>
  Math.min(store.indexedFiles.filters.offset + store.indexedFiles.filters.limit, total.value),
)

// ── T9:indeterminate watch(蓝本 :583-592)—— HTML checkbox 没有声明式
// indeterminate attribute,只能命令式设置。 ──

watch(someSelected, (val) => {
  const cb = selectAllRef.value
  if (cb) cb.indeterminate = val && !allSelected.value
})
watch(allSelected, () => {
  const cb = selectAllRef.value
  if (cb) cb.indeterminate = someSelected.value && !allSelected.value
})

// ── lifecycle ──

/** 蓝本 refresh() —— 先加载,加载完成后再决定要不要起 30s 轮询
 * (`startIndexedPolling` 内部会看 `isAnyIndexing` 自行判断)。 */
async function refresh(): Promise<void> {
  await store.loadIndexedFiles()
  store.startIndexedPolling()
}

onMounted(() => {
  refresh()
})

/** 蓝本 beforeDestroy() —— 见文件头注释,停轮询防止 store 模块级定时器句柄
 * 泄漏到下一个挂载实例。 */
onUnmounted(() => {
  store.stopIndexedPolling()
})

// ── filter actions(全部落到 `_applyFilter`:offset 归零 + 清选择 + 清错误
// 横幅 + 重载,一件都不能少)──

function _applyFilter(): void {
  store.indexedFiles.filters.offset = 0
  selSet.value = new Set()
  errorBanner.value = null
  refresh()
}

function onPathPrefixInput(e: Event): void {
  store.indexedFiles.filters.path_prefix = (e.target as HTMLInputElement).value
  _applyFilter()
}

function clearPathPrefix(): void {
  store.indexedFiles.filters.path_prefix = ''
  _applyFilter()
}

function onMimePrefixInput(e: Event): void {
  store.indexedFiles.filters.mime_prefix = (e.target as HTMLInputElement).value
  _applyFilter()
}

function clearMimePrefix(): void {
  store.indexedFiles.filters.mime_prefix = ''
  _applyFilter()
}

function setLegacyDoc(): void {
  store.indexedFiles.filters.mime_prefix = 'application/legacy-office/'
  _applyFilter()
}

/** N12(写方向)—— UI `active` 映射回 API 的 `alive`,其余两值原样透传。 */
function onStatusViewChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  store.indexedFiles.filters.tombstoned = v === 'active' ? 'alive' : v
  _applyFilter()
}

function onHasErrorChange(e: Event): void {
  store.indexedFiles.filters.has_error = (e.target as HTMLInputElement).checked
  _applyFilter()
}

function onRootSelectChange(e: Event): void {
  const seg = (e.target as HTMLSelectElement).value
  store.indexedFiles.filters.path_prefix = seg === 'all' ? '' : '/' + seg + '/'
  _applyFilter()
}

function onSortChange(e: Event): void {
  store.indexedFiles.filters.sort = (e.target as HTMLSelectElement).value
  _applyFilter()
}

function toggleSortDir(): void {
  store.indexedFiles.filters.order = store.indexedFiles.filters.order === 'asc' ? 'desc' : 'asc'
  _applyFilter()
}

/** 蓝本 clearFilters —— 复位六个筛选字段,再走与 `_applyFilter` 完全相同的
 * 四件事(见文件头注释,机械去重,非行为改动)。 */
function clearFilters(): void {
  const f = store.indexedFiles.filters
  f.path_prefix = ''
  f.mime_prefix = ''
  f.has_error = false
  f.tombstoned = 'alive'
  f.sort = 'indexed_at'
  f.order = 'desc'
  _applyFilter()
}

/** 蓝本 dismissBanner —— 同时清本地 errorBanner 与 store 侧的加载错误。 */
function dismissBanner(): void {
  errorBanner.value = null
  store.indexedFiles.error = null
}

// ── T9:多选(蓝本 :730-748)—— 见文件头注释【多选复选框:read+write 都在
// 本刀】,自包含纯 Set 操作,不依赖任何 T10 才有的东西。 ──

function toggleRow(fileId: string): void {
  const s = new Set(selSet.value)
  if (s.has(fileId)) s.delete(fileId)
  else s.add(fileId)
  selSet.value = s
}

function toggleAll(): void {
  const ids = selectablePageIds.value
  const s = new Set(selSet.value)
  if (allSelected.value) {
    ids.forEach((id) => s.delete(id))
  } else {
    ids.forEach((id) => s.add(id))
  }
  selSet.value = s
}

// ── T9:展开(蓝本 :751-757)—— K13:expSet 整体替换,不用 expTick。 ──

function toggleExpand(fileId: string): void {
  const s = new Set(expSet.value)
  if (s.has(fileId)) s.delete(fileId)
  else s.add(fileId)
  expSet.value = s
}

// ── T9:单行重建按钮——文档化占位,见文件头注释【rebuildRow 本刀是文档化
// 占位】。按钮 DOM(禁用条件/三种 title/图标切换)本刀完整落地,@click 的
// 函数体留给 T10(需要 store 派发 + toast + `_flashDone` 写 doneSet)。 ──

function rebuildRow(_fileId: string): void {
  // T10 补全:store.reindexIndexedByIds([_fileId], 'rebuild row') + toast +
  // startIndexedPolling + _flashDone([_fileId])(蓝本 :760-770)。
}

// ── T9:分页(蓝本 :718-727,onPageSizeChange 见 :691-697)──

function prevPage(): void {
  const f = store.indexedFiles.filters
  f.offset = Math.max(0, f.offset - f.limit)
  refresh()
}

function nextPage(): void {
  const f = store.indexedFiles.filters
  f.offset = f.offset + f.limit
  refresh()
}

/** 蓝本 onPageSizeChange(:691-697)—— 注意与 `_applyFilter` 不同:不清
 * `errorBanner`,只清选择 + 归零 offset + 重载,四件事里少一件。照抄不补
 * 齐(N9 同族的"照抄不许统一"判据:这不是要修的错误行为,是蓝本本来的
 * 写法)。 */
function onPageSizeChange(e: Event): void {
  store.indexedFiles.filters.limit = Number((e.target as HTMLSelectElement).value)
  store.indexedFiles.filters.offset = 0
  selSet.value = new Set()
  refresh()
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <!-- ---- filter bar(蓝本 :6-57)---- -->
        <div class="k-filter-bar">
          <!-- Root convenience select(best-effort,derivedRoots 见上)-->
          <div class="k-filt">
            <label class="k-filt-label">{{ t('aiKbRoot') }}</label>
            <select class="k-filt-select" :value="rootSelect" @change="onRootSelectChange">
              <option value="all">{{ t('aiKbAll') }}</option>
              <option v-for="seg in derivedRoots" :key="seg" :value="seg">{{ seg }}</option>
            </select>
          </div>
          <!-- Path prefix free-text(authoritative)-->
          <div class="k-filt k-filt-grow">
            <label class="k-filt-label">{{ t('aiKbPathPrefix') }}</label>
            <div class="k-filt-input">
              <KIcon name="folder" :size="13" color="var(--text-tertiary)" />
              <input
                :value="store.indexedFiles.filters.path_prefix"
                @input="onPathPrefixInput"
                placeholder="/DATA/Wiki/ …"
              />
              <button
                v-if="store.indexedFiles.filters.path_prefix"
                class="k-filt-clear"
                @click="clearPathPrefix"
              >
                <KIcon name="x" :size="9" />
              </button>
            </div>
          </div>
          <!-- Type prefix -->
          <div class="k-filt k-filt-grow">
            <label class="k-filt-label">{{ t('aiKbTypePrefix') }}</label>
            <div class="k-filt-input">
              <KIcon name="file" :size="13" color="var(--text-tertiary)" />
              <input
                :value="store.indexedFiles.filters.mime_prefix"
                @input="onMimePrefixInput"
                placeholder="application/legacy-office/ …"
              />
              <button
                v-if="store.indexedFiles.filters.mime_prefix"
                class="k-filt-clear"
                @click="clearMimePrefix"
              >
                <KIcon name="x" :size="9" />
              </button>
              <button v-else class="k-filt-chip" :title="t('aiKbLegacyDocTip')" @click="setLegacyDoc">
                {{ t('aiKbLegacyDoc') }}
              </button>
            </div>
          </div>
          <!-- Status tombstoned select(N12)-->
          <div class="k-filt">
            <label class="k-filt-label">{{ t('aiKbStatus') }}</label>
            <!-- N12: Prototype shows "active" but API expects "alive" for alive rows -->
            <select class="k-filt-select" :value="statusViewLocal" @change="onStatusViewChange">
              <option value="active">{{ t('aiKbStatusActive') }}</option>
              <option value="tombstoned">{{ t('aiKbStatusRemoved') }}</option>
              <option value="all">{{ t('aiKbAll') }}</option>
            </select>
          </div>
          <!-- Failed only checkbox -->
          <label class="k-filt-check" :data-on="String(store.indexedFiles.filters.has_error)">
            <input
              type="checkbox"
              class="k-row-check"
              :checked="store.indexedFiles.filters.has_error"
              @change="onHasErrorChange"
            />
            {{ t('aiKbFailedOnly') }}
          </label>
          <!-- Reset filters -->
          <button class="k-btn ghost" :disabled="!filtersDirty" @click="clearFilters">
            <KIcon name="x" :size="12" /> {{ t('aiKbClear') }}
          </button>
        </div>

        <!-- ---- table head meta(蓝本 :60-90)---- -->
        <div class="k-files-meta">
          <div class="k-files-count">
            <template v-if="pageState === 'ready' || pageState === 'empty'">
              {{ t('aiKbNIndexedFiles', { n: total.toLocaleString() }) }}{{ statusSuffix }}
            </template>
            <span v-else class="k-skel" style="display: inline-block; width: 160px; height: 12px" />
          </div>
          <div class="k-files-tools">
            <span v-if="isAnyIndexing" class="k-poll" :title="t('aiKbPollTip')">
              <KIcon name="spinner" :size="12" /> {{ t('aiKbPolling') }}
            </span>
            <div class="k-sort">
              <KIcon name="sort" :size="12" color="var(--text-tertiary)" />
              <select
                class="k-filt-select"
                :value="store.indexedFiles.filters.sort"
                @change="onSortChange"
              >
                <option value="indexed_at">{{ t('aiKbSortIndexTime') }}</option>
                <option value="size">{{ t('aiKbColSize') }}</option>
                <option value="vector_count">{{ t('aiKbSortVectorCount') }}</option>
              </select>
              <button
                class="k-sort-dir"
                @click="toggleSortDir"
                :title="store.indexedFiles.filters.order === 'asc' ? t('aiKbSortAsc') : t('aiKbSortDesc')"
              >
                <span
                  :style="{
                    display: 'inline-flex',
                    transform: store.indexedFiles.filters.order === 'asc' ? 'rotate(180deg)' : 'none',
                  }"
                >
                  <KIcon name="arrowDown" :size="13" />
                </span>
              </button>
            </div>
            <!-- Demo state switcher from prototype is REMOVED — states driven by real store -->
          </div>
        </div>

        <!-- ---- error banner(蓝本 :93-103,K14/K19 见文件头注释)---- -->
        <div v-if="storeError || errorBanner" class="k-banner" data-tone="warn" style="margin: 0">
          <span class="k-banner-icon"><KIcon name="danger" :size="13" /></span>
          <!-- K14: 不回显 errorBanner 里可能存的后端 detail,只留固定文案 -->
          <span v-if="errorBanner">
            <b>400 Bad Request</b>
            <br />
            <span style="color: var(--text-tertiary)">
              {{ t('aiKbRebuildCapHint', { cap: FILTER_REBUILD_CAP.toLocaleString() }) }}
            </span>
          </span>
          <!-- K19: 不回显 storeError(= e.message),改固定 aiKbLoadErrorBody -->
          <span v-else>
            <b>{{ t('aiKbLoadErrorLabel') }}</b> {{ t('aiKbLoadErrorBody') }}
          </span>
          <button class="k-banner-close" @click="dismissBanner">{{ t('aiKbClose') }}</button>
        </div>

        <!-- ---- loading skeleton(蓝本 :106-132)---- -->
        <template v-if="pageState === 'loading'">
          <div class="k-ftable">
            <!-- head disabled -->
            <div class="k-frow-f k-frow-fhead">
              <input type="checkbox" class="k-row-check" disabled />
              <span>{{ t('aiKbStatus') }}</span>
              <span>{{ t('aiKbColPath') }}</span>
              <span>{{ t('aiKbColType') }}</span>
              <span>{{ t('aiKbColSize') }}</span>
              <span>{{ t('aiKbStatusIndexed') }}</span>
              <span class="k-frow-num">{{ t('aiKbColVectors') }}</span>
              <span>{{ t('aiKbColAction') }}</span>
              <span />
            </div>
            <div v-for="i in 8" :key="i" class="k-frow-f k-frow-skel">
              <span class="k-skel" style="width: 16px; height: 16px" />
              <span class="k-skel" style="width: 70px; height: 20px" />
              <span class="k-skel" style="width: 70%; height: 13px" />
              <span class="k-skel" style="width: 44px; height: 18px" />
              <span class="k-skel" style="width: 48px; height: 12px" />
              <span class="k-skel" style="width: 60px; height: 12px" />
              <span class="k-skel" style="width: 40px; height: 12px" />
              <span class="k-skel" style="width: 64px; height: 26px" />
              <span />
            </div>
          </div>
        </template>

        <!-- ---- empty(蓝本 :135-142,N10 见文件头注释)---- -->
        <div v-else-if="pageState === 'empty'" class="k-empty">
          <div class="k-empty-illust"><KIcon name="layers" :size="34" /></div>
          <div class="k-empty-title">{{ t('aiKbNoMatchTitle') }}</div>
          <div class="k-empty-sub">{{ t('aiKbNoMatchSub') }}</div>
          <button v-if="filtersDirty" class="k-empty-btn" @click="clearFilters">
            <KIcon name="x" :size="13" /> {{ t('aiKbClearFilters') }}
          </button>
        </div>

        <!-- ---- ready: table + pager(蓝本 :146-317,T9)---- -->
        <template v-else-if="pageState === 'ready'">
          <div class="k-ftable">
            <!-- table header(蓝本 :148-165)-->
            <div class="k-frow-f k-frow-fhead">
              <input
                type="checkbox"
                class="k-row-check"
                ref="selectAllRef"
                :checked="allSelected"
                :disabled="selectablePageIds.length === 0"
                @change="toggleAll"
                :title="t('aiKbSelectAllTip')"
              />
              <span>{{ t('aiKbStatus') }}</span>
              <span>{{ t('aiKbColPath') }}</span>
              <span>{{ t('aiKbColType') }}</span>
              <span>{{ t('aiKbColSize') }}</span>
              <span>{{ t('aiKbStatusIndexed') }}</span>
              <span class="k-frow-num">{{ t('aiKbColVectors') }}</span>
              <span>{{ t('aiKbColAction') }}</span>
              <span />
            </div>

            <!-- file rows(蓝本 :168-259)-->
            <template v-for="file in files" :key="file.file_id">
              <!-- row(Vue3 编译器要求 v-for 的 key 放在 template 标签上,单个
              key 覆盖这一组的 row + 可选 detail 两个兄弟节点,蓝本的
              `:key="file.file_id + '-row'"`/`'-detail'` 两个独立 key 是 Vue2
              写法,搬进 Vue3 会编译报错,故按 Vue3 语法调整,不是行为改动)-->
              <div
                class="k-frow-f"
                :data-selected="selSet.has(file.file_id)"
                :data-status="file.status"
                :data-done="doneSet.has(file.file_id)"
              >
                <input
                  type="checkbox"
                  class="k-row-check"
                  :checked="selSet.has(file.file_id)"
                  :disabled="file.status === 'tombstoned'"
                  @change="toggleRow(file.file_id)"
                  :title="file.status === 'tombstoned' ? t('aiKbTombstonedNoSelect') : ''"
                />
                <!-- status badge(N14:见文件头注释)-->
                <span class="k-frow-status">
                  <span
                    class="k-status-badge"
                    :data-s="badgeFor(file.status) ? badgeFor(file.status)!.cls : 'ok'"
                    :title="badgeFor(file.status) ? badgeFor(file.status)!.en : file.status"
                  >
                    <KIcon
                      :name="badgeFor(file.status) ? badgeFor(file.status)!.icon : 'check'"
                      :size="11"
                    />
                    <span class="k-status-badge-cn">{{
                      badgeFor(file.status) ? t(badgeFor(file.status)!.key) : file.status
                    }}</span>
                  </span>
                </span>
                <!-- path cell -->
                <span class="k-frow-pathcell">
                  <span class="k-frow-pathtxt" :title="filePath(file)">{{ filePath(file) }}</span>
                  <span
                    v-if="file.status === 'error' && file.last_error"
                    class="k-frow-errhint"
                    :title="file.last_error"
                  >
                    <KIcon name="danger" :size="10" /> {{ file.last_error }}
                  </span>
                  <span
                    v-if="file.status === 'ok' && file.vector_count === 0"
                    class="k-frow-zerohint"
                    :title="t('aiKbZeroVecTip')"
                    >{{ t('aiKbZeroVec') }}</span
                  >
                </span>
                <!-- type tag -->
                <span>
                  <span
                    class="k-type-tag"
                    :data-kind="simplifyMime(file.mime).kind"
                    :title="file.mime"
                  >
                    {{ simplifyMime(file.mime).label
                    }}<span v-if="simplifyMime(file.mime).legacy" class="k-type-legacy">{{
                      t('aiKbLegacy')
                    }}</span>
                  </span>
                </span>
                <!-- size -->
                <span class="k-frow-num" :title="(file.size || 0).toLocaleString() + ' bytes'">{{
                  fmtBytes(file.size)
                }}</span>
                <!-- indexed time -->
                <span class="k-frow-time" :title="fmtAbs(ms(file.indexed_at))">{{
                  fmtRel(ms(file.indexed_at))
                }}</span>
                <!-- vector count -->
                <span class="k-frow-num k-frow-vec" :data-zero="file.vector_count === 0">
                  {{ (file.vector_count || 0).toLocaleString() }}
                </span>
                <!-- rebuild button(文档化占位,见文件头注释)-->
                <span class="k-frow-rebuild">
                  <button
                    class="k-btn outline k-rebuild-btn"
                    :disabled="file.status !== 'ok' && file.status !== 'error'"
                    @click="rebuildRow(file.file_id)"
                    :title="
                      file.status === 'indexing'
                        ? t('aiKbRebuilding')
                        : file.status === 'tombstoned'
                          ? t('aiKbTombstonedTip')
                          : t('aiKbRebuildRowTip')
                    "
                  >
                    <template v-if="file.status === 'indexing'">
                      <KIcon name="spinner" :size="11" /> {{ t('aiKbRebuilding') }}
                    </template>
                    <template v-else>
                      <KIcon name="refresh" :size="11" /> {{ t('aiKbRebuild') }}
                    </template>
                  </button>
                </span>
                <!-- expand toggle -->
                <button
                  class="k-frow-expand"
                  :data-open="expSet.has(file.file_id)"
                  @click="toggleExpand(file.file_id)"
                  :title="t('aiKbMore')"
                >
                  <KIcon name="chevDown" :size="13" />
                </button>
              </div>
              <!-- expanded detail panel(蓝本 :261-293)-->
              <div v-if="expSet.has(file.file_id)" class="k-file-detail">
                <div class="k-fd-grid">
                  <div class="k-fd-item">
                    <div class="k-fd-k">parser_version</div>
                    <div class="k-fd-v mono">{{ file.parser_version || '—' }}</div>
                  </div>
                  <div class="k-fd-item">
                    <div class="k-fd-k">modalities_done</div>
                    <div class="k-fd-v">
                      <span v-if="fileModalityKeys(file).length" class="k-fd-mods">
                        <span v-for="m in fileModalityKeys(file)" :key="m" class="k-fd-mod">{{
                          m
                        }}</span>
                      </span>
                      <span v-else style="color: var(--text-quaternary)">—</span>
                    </div>
                  </div>
                  <div class="k-fd-item k-fd-wide">
                    <div class="k-fd-k">sha256_full</div>
                    <div class="k-fd-v mono k-fd-sha" :title="file.sha256_full">
                      {{ file.sha256_full || '—' }}
                    </div>
                  </div>
                  <div v-if="file.tombstoned_at" class="k-fd-item">
                    <div class="k-fd-k">tombstoned_at</div>
                    <div class="k-fd-v mono" :title="fmtAbs(ms(file.tombstoned_at))">
                      {{ fmtAbs(ms(file.tombstoned_at)) }}
                    </div>
                  </div>
                  <div class="k-fd-item k-fd-wide">
                    <div class="k-fd-k">mime</div>
                    <div class="k-fd-v mono">{{ file.mime || '—' }}</div>
                  </div>
                </div>
                <div v-if="file.last_error" class="k-fd-error">
                  <KIcon name="danger" :size="12" />
                  <span><b>last_error:</b> {{ file.last_error }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- ---- pagination(蓝本 :298-317)---- -->
          <div class="k-pager">
            <div class="k-pager-info">
              {{ t('aiKbShowingRange', { from: pageFrom, to: pageTo, total: total.toLocaleString() }) }}
            </div>
            <div class="k-pager-ctrls">
              <div class="k-pager-size">
                <span>{{ t('aiKbPerPage') }}</span>
                <select
                  class="k-filt-select"
                  :value="store.indexedFiles.filters.limit"
                  @change="onPageSizeChange"
                >
                  <option v-for="n in [50, 100, 200, 500]" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              <button class="k-btn outline" :disabled="currentPage === 0" @click="prevPage">
                <KIcon name="chevLeft" :size="13" /> {{ t('aiKbPagerPrev') }}
              </button>
              <span class="k-pager-page">{{ currentPage + 1 }} / {{ pageCount }}</span>
              <button
                class="k-btn outline"
                :disabled="currentPage >= pageCount - 1"
                @click="nextPage"
              >
                {{ t('aiKbPagerNext') }} <KIcon name="chev" :size="13" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
