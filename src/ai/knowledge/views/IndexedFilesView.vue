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
  🔴 设置 `errorBanner` 为非空值的 `doRebuildAll()`(蓝本 :700+,对应确认弹窗
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
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { anyIndexing } from '../util/indexedFiles'
import { topSegment } from '../util/indexedFilesView'

const { t } = useI18n()
const store = useKnowledgeStore()

/** 蓝本 :391 —— 本刀错误横幅用得到的那个上限。`EXPLICIT_REBUILD_CAP`(蓝本
 * :390,批量重建按钮专用)本刀不声明,T9/T10 的动作条才用到。 */
const FILTER_REBUILD_CAP = 10000

/** K13 —— 本刀只用到 selSet(`_applyFilter` 清空)。 */
const selSet = ref<Set<string>>(new Set())

/** 蓝本 data() 的 `errorBanner`(:392)—— rebuild-all 400 分支的错误横幅,
 * 见文件头注释【K14】。 */
const errorBanner = ref<string | null>(null)

// ── computed(蓝本对应 computed 段,本刀范围用到的那些)──

const total = computed<number>(() => store.indexedFiles.total)
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

        <!-- ready 态(表格 + 分页)—— T9/T10 范围,本刀不搬 -->
      </div>
    </div>
  </div>
</template>
