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
  🔴 设置 `errorBanner` 为非空值的 `doRebuildAll()`(蓝本 :791-809,对应确认弹窗
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
  SP8-P5b Task 10 —— 第 3 刀(收官):重建三入口 + 双上限 + K7 确认弹窗 +
  底部粘性动作条 + 轮询收口 + 路由反转。**至此蓝本 826 行全部落地,本文件
  再无占位、无空函数体、无 TODO。**

  结构对照(蓝本行区间 → 本文件):
    :322-353 底部粘性动作条(`.k-files-actionbar` + `data-active`)
    :355-381 整库重建确认弹窗(K7 改 reka 原语,见下)
    :392     `EXPLICIT_REBUILD_CAP = 500`(前端硬拦)
    :464     `showRebuildAllConfirm` 本地开关
    :484-485 `selectedCount` / `overExplicitCap`
    :760-770 `rebuildRow`(T9 留的空占位,本刀补全)
    :772-784 `rebuildSelected`
    :786-789 `openRebuildAllConfirm`
    :791-809 `doRebuildAll`(注意:函数自身的 `},` 在 :809,:808 只是内层
             catch 的闭合 —— T8 报告写的 :791-808 差 1 行,已一并订正上面
             【K14】那段的行号引用)
    :811-823 `_flashDone`(2200 ms 绿闪)

  【双上限,蓝本 :392-393 / 治理 §4.4】两个常量语义不同,不许混用:
    - `EXPLICIT_REBUILD_CAP = 500` —— 后端 `MAX_REINDEX_FILE_IDS`
      (`service_reindex.py:26`,判据 `len < 1 || len > 500`)。
      **前端硬拦**:`overExplicitCap` = `selectedCount > 500` →「重建选中」
      按钮禁用 + 动作条出警告;`rebuildSelected` 里再判一次直接 return
      (双保险,蓝本 :773 就有这一行,不是多余)。
      🔴 判据是严格大于:500 个可以发,501 个才拦。
    - `FILTER_REBUILD_CAP = 10000` —— 后端 `MAX_REINDEX_BY_FILTER`
      (`service_files.py:205`,判据 `n > 10000`)。
      **前端只警告不拦**:弹窗里内嵌超限横幅(`total > 10000` 时),
      按钮照样能点,真拦在后端 → 400 走 K14 的警示条。
      🔴 同样是严格大于:10000 不出横幅,10001 才出。

  【K7,🔴 SP8 已在这上面爆过三次】整库重建确认弹窗改用 reka 原语
  `DialogRoot > DialogPortal to=".knowledge-app" defer > DialogOverlay
  .k-modal-bg > DialogContent .k-modal`,不许裸 `<div class="k-modal-bg">`
  手搓、不许 `Teleport to="body"`。结构逐字照 T5 在 `QueueView.vue:559-583`
  落的样板(含 reka a11y 必需的 `VisuallyHidden > DialogTitle` 与
  `:aria-describedby="undefined"`)。蓝本 :356 的「点遮罩关闭」/ :357 的
  `@click.stop`「点弹窗内不关闭」由 DialogContent 的 pointerDownOutside 提供
  等价行为(T5 已为这条机制单独写过用例,本刀同款覆盖)。
  视觉 DOM 仍是蓝本的 `.k-confirm-body` / `.k-confirm-summary` /
  `.k-modal-foot > .right` 结构;K17 的 `.k-modal-head` 等 4 类本期不搬,
  蓝本这个弹窗本来也没用到它们。

  【K14,真实入口到齐】本刀补上 `doRebuildAll`,`errorBanner` 第一次有了真实
  写入口。**按 T8 的既定设计,catch 里照蓝本 :805-807 把后端 detail 取出来存
  进 `errorBanner`(值不变),K14 的保证点在渲染层**——:625-640 那个分支只渲染
  固定的 `400 Bad Request` + `aiKbRebuildCapHint`,后端 detail 一个字都不出现。
  这样那条反向断言才是真的端到端(400 带 detail → DOM 不含 detail),而不是
  只测一个手工塞进 ref 的字符串。

  【K5】`rebuildRow` / `rebuildSelected` 的 catch 不回显 `e.message`
  (蓝本 :768 / :782 是 `$t('Rebuild failed') + ': ' + e.message`),改固定
  `aiKbRebuildFailed`,无第二句可拼故不留 `': '` 前缀 —— 与 T5 在
  `QueueView.vue` 里 bulkCancel/cancelOne 等 catch 分支同一模具。

  【属性态,附录 D §D.3 + 治理 §12 E-9】`.k-files-actionbar` 的
  `:data-active="selectedCount > 0"` **不套 `String()`**——蓝本 :323 原文就
  没套(附录 D §D.3 那一行明确标 ❌ 不套;E-9 已读 Vue 3 `patchAttr` 源码实证
  `data-*` 非特殊布尔属性、`false` 照样渲染成 `"false"`,套不套渲染完全一致,
  故按 E-9 的裁定「逐处照抄蓝本」)。
  🔴 本刀 brief §4 那句「套 String(),照抄蓝本」自相矛盾(蓝本没套),已按
  权威源(附录 D + 治理 §12 E-9 + 蓝本原文)照抄不套,报告里已申报。

  【_flashDone 的 setTimeout 不做卸载清理】蓝本 :817-822 没有清理,照抄。
  2200 ms 后回调只是把一个 `ref` 换成新的 `Set`,组件已卸载时这个写入不触发
  任何渲染、不持有 DOM 引用,不是「可复现的错误行为」,故不属于该修的逻辑
  (治理 §2 判据)。测试里用 fake timers 在受控范围内推进。

  【轮询收口】三个重建入口成功后各调一次 `store.startIndexedPolling()`
  (蓝本 :764 / :780 / :803)。`onMounted → refresh()`(内含
  `startIndexedPolling`)与 `onUnmounted → stopIndexedPolling()` **T8 已经
  落地且完整**(见上方【生命周期】段),本刀零改动。
  ══════════════════════════════════════════════════════════════════════
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
// T10:K7 —— 确认弹窗用 reka 原语,结构照 T5 的 QueueView.vue 样板。
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from 'reka-ui'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, type IndexedFile } from '../stores/knowledgeStore'
import { anyIndexing } from '../util/indexedFiles'
import { fmtBytes, fmtRel, fmtAbs, simplifyMime, topSegment } from '../util/indexedFilesView'

const { t } = useI18n()
const store = useKnowledgeStore()

/** 蓝本 :393 —— filter 模式的上限,**前端只警告不拦**(真拦在后端,超限返 400
 * 走 K14 的警示条)。两处用到:弹窗内嵌超限横幅的判据、K14 警示条的文案参数。
 * 后端常量 `MAX_REINDEX_BY_FILTER = 10000`(`service_files.py:205`,判据
 * `n > 10000` —— 严格大于,10000 不触发)。 */
const FILTER_REBUILD_CAP = 10000

/** T10:蓝本 :392 —— 显式 file_ids 模式的上限,**前端硬拦**(按钮禁用 + 动作条
 * 警告 + `rebuildSelected` 里再 return 一次)。后端常量
 * `MAX_REINDEX_FILE_IDS = 500`(`service_reindex.py:26`,判据
 * `len(file_ids) < 1 || len(file_ids) > 500` —— 严格大于,500 个可以发)。 */
const EXPLICIT_REBUILD_CAP = 500

/** K13 —— 本刀只用到 selSet(`_applyFilter` 清空)。 */
const selSet = ref<Set<string>>(new Set())

/** 蓝本 data() 的 `errorBanner`(:465)—— rebuild-all 400 分支的错误横幅,
 * 见文件头注释【K14】。 */
const errorBanner = ref<string | null>(null)

/** T9:K13,展开行——见文件头注释【K13,expSet】。 */
const expSet = ref<Set<string>>(new Set())

/** T9 声明、T10 写入:蓝本 doneSet(:457)—— 重建成功后的 2200 ms 绿闪集合,
 * 写入口是本刀补上的 `_flashDone`(蓝本 :811-823)。 */
const doneSet = ref<Set<string>>(new Set())

/** T10:蓝本 data() 的 `showRebuildAllConfirm`(:464)—— 整库重建确认弹窗开关,
 * 页面级瞬态,组件本地 ref(治理 §5)。 */
const showRebuildAllConfirm = ref(false)

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

/** T10:蓝本 selectedCount(:484)/ overExplicitCap(:485)—— 判据是**严格大于**
 * `EXPLICIT_REBUILD_CAP`:选 500 个不算超限(后端 `len > 500` 才 400),
 * 501 个才超。 */
const selectedCount = computed<number>(() => selSet.value.size)
const overExplicitCap = computed<boolean>(() => selectedCount.value > EXPLICIT_REBUILD_CAP)

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

// ── T10:重建三入口(蓝本 :760-809)+ 绿闪(:811-823)。T9 留的 `rebuildRow`
// 空占位在此补全,按钮 DOM 与调用点一个字都没动。 ──

/** 后端 `POST /v1/parser/files/reindex` 的成功响应体形状(fixture
 * `p5b-fixtures/reindex-one.http` 实测:
 * `{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}`)。
 * store 的 `reindexIndexedByIds`/`reindexIndexedByFilter` 返回 `unknown`
 * (零改动文件),这里做一次收窄:蓝本三处只读 `res.queued`。 */
type ReindexResult = { queued?: number }

/**
 * 蓝本 rebuildRow(:760-770)—— 单行强制重建:
 *   ① `reindexIndexedByIds([fileId], 'rebuild row')`(store 内部会跟着重载列表)
 *   ② toast「已入队 {n} 个任务」,n 取响应体的 `queued`
 *   ③ `startIndexedPolling()` —— 刚入队的行会变 indexing,起 30 秒轮询盯着
 *   ④ `_flashDone([fileId])` —— 2200 ms 绿闪
 * catch 走 K5:固定 `aiKbRebuildFailed`,不回显 `e.message`(蓝本 :768 拼了
 * `': ' + e.message`,见文件头注释【K5】)。
 */
async function rebuildRow(fileId: string): Promise<void> {
  try {
    const res = (await store.reindexIndexedByIds([fileId], 'rebuild row')) as ReindexResult
    store.toast(t('aiKbQueuedNJobs', { n: res.queued }))
    store.startIndexedPolling()
    // brief green-flash
    _flashDone([fileId])
  } catch {
    store.toast(t('aiKbRebuildFailed'))
  }
}

/**
 * 蓝本 rebuildSelected(:772-784)—— 批量重建当前选中行。
 * 🔴 首行的 `if (selectedCount === 0 || overExplicitCap) return` 是蓝本 :773
 * 原文,与按钮的 `:disabled` 条件重复但**不是冗余**:键盘/程序化调用绕过
 * disabled 时它是唯一的拦。照抄。
 * 成功后清空选择(蓝本 :778,不清会让动作条一直显示旧计数)。
 */
async function rebuildSelected(): Promise<void> {
  if (selectedCount.value === 0 || overExplicitCap.value) return
  const ids = Array.from(selSet.value)
  try {
    const res = (await store.reindexIndexedByIds(ids, 'rebuild selected')) as ReindexResult
    store.toast(t('aiKbQueuedNJobs', { n: res.queued }))
    selSet.value = new Set()
    store.startIndexedPolling()
  } catch {
    store.toast(t('aiKbRebuildFailed'))
  }
}

/** 蓝本 openRebuildAllConfirm(:786-789)—— `total === 0` 直接 return(按钮此时
 * 也是 disabled,同 rebuildSelected 那条双保险)。 */
function openRebuildAllConfirm(): void {
  if (total.value === 0) return
  showRebuildAllConfirm.value = true
}

/**
 * 蓝本 doRebuildAll(:791-809)—— 按当前筛选整批重建。
 * 🔴 `filterObj` 只带**真值/非默认**的字段,四条判据逐字照抄蓝本 :796-799:
 *   `path_prefix` / `mime_prefix` / `has_error` 各自 truthy 才带;
 *   `tombstoned` 要 **truthy 且 `!== 'all'`** 才带 —— `'all'` 意为「不限」,
 *   带上去反而会把「不限」编码成一个具体的筛选值。
 * catch:照蓝本 :805-807 取后端 detail 存进 `errorBanner`,渲染层按 K14 不回显
 * (见文件头注释【K14,真实入口到齐】)。
 */
async function doRebuildAll(): Promise<void> {
  showRebuildAllConfirm.value = false
  // Build filter object from active, non-paging filters
  const f = store.indexedFiles.filters
  const filterObj: Record<string, unknown> = {}
  if (f.path_prefix) filterObj.path_prefix = f.path_prefix
  if (f.mime_prefix) filterObj.mime_prefix = f.mime_prefix
  if (f.has_error) filterObj.has_error = f.has_error
  if (f.tombstoned && f.tombstoned !== 'all') filterObj.tombstoned = f.tombstoned
  try {
    const res = (await store.reindexIndexedByFilter(
      filterObj,
      'rebuild all matching',
    )) as ReindexResult
    store.toast(t('aiKbQueuedNJobs', { n: res.queued }))
    store.startIndexedPolling()
  } catch (e) {
    const detail =
      (e as { response?: { data?: { detail?: string } } } | undefined)?.response?.data?.detail ||
      (e as Error | undefined)?.message ||
      String(e)
    errorBanner.value = detail
  }
}

/**
 * 蓝本 _flashDone(:811-823)—— 重建入队后给该行 2200 ms 的绿闪(`data-done`
 * 驱动 scss 的 `@keyframes row-done`)。K13:`doneSet` 整体替换,不用 doneTick。
 * 蓝本没有卸载清理,照抄(见文件头注释【_flashDone 的 setTimeout 不做卸载清理】)。
 */
function _flashDone(ids: string[]): void {
  const d = new Set(doneSet.value)
  ids.forEach((id) => d.add(id))
  doneSet.value = d
  setTimeout(() => {
    const d2 = new Set(doneSet.value)
    ids.forEach((id) => d2.delete(id))
    doneSet.value = d2
  }, 2200)
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

    <!-- ---- sticky bottom action bar(蓝本 :322-353)---- -->
    <!-- data-active 不套 String():蓝本 :323 原文没套,附录 D §D.3 标 ❌ 不套,
    治理 §12 E-9 裁定「逐处照抄蓝本」(Vue 3 下 data-* 的 false 照样渲染成
    "false",套不套渲染一致)。见文件头注释【属性态】。 -->
    <div class="k-files-actionbar" :data-active="selectedCount > 0">
      <div class="k-ab-inner">
        <div class="k-ab-info">
          <template v-if="selectedCount > 0">
            {{ t('aiKbNSelected', { n: selectedCount }) }}
            <span v-if="overExplicitCap" class="k-ab-warn">
              <KIcon name="danger" :size="11" />
              {{ t('aiKbOverExplicitCap', { cap: EXPLICIT_REBUILD_CAP }) }}
            </span>
          </template>
          <span v-else style="color: var(--text-tertiary)">{{ t('aiKbSelectFilesHint') }}</span>
        </div>
        <div class="k-ab-actions">
          <!-- Rebuild matching: replaces prototype's "rebuild entire root", uses current filters -->
          <button
            class="k-btn outline"
            :disabled="total === 0"
            :title="
              total === 0
                ? t('aiKbNoMatchTitle')
                : t('aiKbRebuildAllTip', { n: total.toLocaleString() })
            "
            @click="openRebuildAllConfirm"
          >
            <KIcon name="drive" :size="13" /> {{ t('aiKbRebuildAllInRoot') }}
          </button>
          <button
            class="k-btn primary"
            :disabled="selectedCount === 0 || overExplicitCap"
            @click="rebuildSelected"
          >
            <KIcon name="refresh" :size="13" /> {{ t('aiKbRebuildSelectedN', { n: selectedCount }) }}
          </button>
        </div>
      </div>
    </div>

    <!-- ---- rebuild-all-matching confirm modal(蓝本 :355-381)---- -->
    <!-- K7:reka Dialog 原语,portal 到知识库容器;蓝本的「点遮罩关闭 /
    点弹窗内不关闭」由 DialogContent 的 pointerDownOutside 等价提供。
    结构逐字照 T5 的 QueueView.vue:559-583 样板。 -->
    <DialogRoot :open="showRebuildAllConfirm" @update:open="showRebuildAllConfirm = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent
            class="k-modal"
            style="width: min(460px, 100%)"
            :aria-describedby="undefined"
          >
            <VisuallyHidden as-child
              ><DialogTitle>{{ t('aiKbRebuildAllTitle') }}</DialogTitle></VisuallyHidden
            >
            <div class="k-confirm-body">
              <div class="k-confirm-icon"><KIcon name="refresh" :size="26" /></div>
              <div class="k-confirm-title">{{ t('aiKbRebuildAllTitle') }}</div>
              <div class="k-confirm-summary">
                {{ t('aiKbRebuildAllBody1', { n: total.toLocaleString() }) }}<br />
                {{ t('aiKbRebuildAllBody2') }}
              </div>
              <!-- 内嵌超限横幅:FILTER_REBUILD_CAP 前端只警告不拦,判据严格大于 -->
              <div
                v-if="total > FILTER_REBUILD_CAP"
                class="k-banner"
                data-tone="warn"
                style="margin: 0"
              >
                <span class="k-banner-icon"><KIcon name="danger" :size="13" /></span>
                <span>
                  {{
                    t('aiKbRebuildAllOverCap', {
                      n: total.toLocaleString(),
                      cap: FILTER_REBUILD_CAP.toLocaleString(),
                    })
                  }}
                </span>
              </div>
            </div>
            <div class="k-modal-foot">
              <div class="right" style="margin-left: auto">
                <button class="k-btn ghost" @click="showRebuildAllConfirm = false">
                  {{ t('aiKbCancel') }}
                </button>
                <button class="k-btn danger" @click="doRebuildAll">
                  <KIcon name="refresh" :size="12" />
                  {{ t('aiKbConfirmRebuildN', { n: total.toLocaleString() }) }}
                </button>
              </div>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
