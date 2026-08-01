<script setup lang="ts">
// SP7-P7a-T6: PhotosSmartViewDetail.vue —— 智能视图详情页外壳(路由 /photos/smart-views/:id)。
// 本期架构关键任务:证明 §7e-2 的核心修复(T2 store 的 byId(id))成立。
//
// ★★★ 与 Vue2 最重要的架构性差异,必须读完才能理解本文件为什么这么短 ★★★
// Vue2 详情页(NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue)把整个 sv 对象当
// **prop** 持有(:285 `props: { sv: { type: Object, required: true } }`),而列表侧
// UPDATE_SMART_VIEW mutation 用 `splice(i, 1, {...})` 换成**新对象**——这意味着编辑/暂停/
// 改名之后,Vue2 详情页手里那份 prop 引用已经过期,界面读不出变化,直到用户重新打开详情页。
// 为了压制这个真 bug,Vue2 搭了一整套本地状态同步机制:本地 `thresh`/`paused`/
// `includeVideos` + `syncingSv` 标志 + 三个 watcher(:288-291、:345-371)——`sv` prop 变化时
// 把新值复制进本地 state,同时用 syncingSv 挡住"复制进本地 state"这个动作反过来触发本地
// watcher 再发一次 PATCH 请求的死循环。
//
// New-UI 走真路由:`sv = computed(() => store.byId(String(route.params.id)))`,每次渲染
// 都从 store 数组现取,数据来源只有一份。**这个 bug 结构性消失**——store 更新数组项之后,
// 任何读 `sv.value` 的地方(包括这个 computed 本身)都会立刻拿到新对象,不需要任何本地
// state 副本、不需要 syncingSv、不需要三个 watcher。`paused` 直接是
// `computed(() => !sv.value?.live)` 的**派生量**,不是本地 state——这是本任务测试套件里
// "§7e-2 主守卫"那条用例专门钉住的行为(直接改 store 里的 sv.live,不重新 mount,pill 文案
// 自动跟着变;删码验证①把 byId 换成本地 ref 缓存一份 sv 对象,这条用例就会变红)。
//
// 本文件范围(task-6-brief.md 结构规格 1-9):壳 + header(标题编辑 / live-paused pill /
// 统计四格)+ 操作栏三菜单(暂停恢复 / 在搜索中细化[T16 已接线,见 refineInSearch] /
// 导出[ZIP 修 401 + 静态相册] / more[重命名/复制/删除])+ 删除确认弹窗 +
// 两段照片网格(最近添加 / 全部匹配)。
// T7(加条件弹层)与 T8(右栏阈值/设置/统计/活动流)只留挂载点,见下方 TODO 注释。
//
// ── 偏离登记(brief 已预先要求登记的几处)──────────────────────────────────────
//  1)「找不到」空态(listLoaded && !sv):Vue2 不存在这个路径——它的详情页只在父组件
//     `v-if="openSv"` 时才渲染,`openSv` 恒是一个真实对象,不可能出现"有 id 但查无此项"。
//     New-UI 是真路由,用户手改地址栏 / 点开旧书签会走到这里,New-UI 新增。
//  2) live/paused pill:Vue2 只有 `role="button"`,无键盘可达性。这里补 `tabindex="0"` +
//     `@keydown.enter`。
//  3) commitTitle 失败:Vue2 `:512-513` 无 catch(乐观地假设 PATCH 总成功)。这里 catch →
//     toast + 保持编辑态(不擅自退出,以免用户以为改名生效了)。
//  4) 「在搜索中细化」T6 阶段曾临时 disabled(搜索路由 /photos/search 那时还没建)。
//     T16 已把搜索路由建好并接线(见下方 refineInSearch),按钮不再 disabled。
//  5) `smartViewId` 死参数不迁:Vue2 `:520` 的 refineInSearch payload 是
//     `{ q: sv.name, smartViewId: sv.id }`,但全 Vue2 仓库 grep `smartViewId` 只有这一处
//     写入、零消费方(`grep -rn smartViewId NimoOS-UI/src/` 只命中这一行)。T16 接线只传
//     `q`,不带这个死参数。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import SmartViewConditionEditor from '../photos/components/SmartViewConditionEditor.vue'
import SmartViewSidePanel from '../photos/components/SmartViewSidePanel.vue'
import SmartViewActivityFeed from '../photos/components/SmartViewActivityFeed.vue'
import { usePhotosSmartViews, type DeletedSmartView } from '../photos/stores/smartViews'
import { useToast } from '../stores/toast'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { relTime } from '../photos/util/relTime'
import { formatMB } from '../photos/util/formatBytes'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
const store = usePhotosSmartViews()
const toast = useToast()
const lb = useLightbox()
const { t, locale } = useI18n()

// 唯一的归一点(铁律:按 id 找对象一律 String() 比较)。
const svId = computed(() => String(route.params.id))
// ★ §7e-2 核心修复:每次渲染都从 store 数组现取,不持有对象引用。
const sv = computed(() => store.byId(svId.value))

function fmtNum(n: number): string {
  return n.toLocaleString(locale.value.replace('_', '-'))
}

// 包一层 ref 而非直接在模板里裸调 Date.now():测试可以在 mount 前用
// vi.useFakeTimers()/setSystemTime 固定这个值,而组件代码本身仍是"就用当前时间"的
// 正常写法(不是 workflow 脚本,允许用 Date.now())。
const now = ref(Date.now())
const lastUpdated = computed(() => (sv.value?.evaluatedAt ? relTime(sv.value.evaluatedAt, now.value, t, locale.value) : '—'))

// ── 加载(结构规格 1)────────────────────────────────────────────────────────
onMounted(async () => {
  if (!store.listLoaded) await store.fetchSmartViews()
  await store.loadDetail(svId.value)
})
watch(() => route.params.id, (raw) => {
  if (raw === undefined) return // 已离开本路由(同 PhotosPersonDetail.vue 的既有先例)
  void store.loadDetail(String(raw))
})

// ── 标题编辑(结构规格 3、8)───────────────────────────────────────────────
const titleEdit = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

function startTitleEdit(): void {
  if (!sv.value) return
  titleDraft.value = sv.value.name
  titleEdit.value = true
  moreOpen.value = false
  void nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}
function cancelTitle(): void {
  titleEdit.value = false
  if (sv.value) titleDraft.value = sv.value.name
}
async function commitTitle(): Promise<void> {
  const s = sv.value
  if (!s) { titleEdit.value = false; return }
  const v = titleDraft.value.trim()
  // 未改动或清空 → 直接退出,不发请求(照 Vue2 :511 的 `if (v && v !== this.sv.name)`)。
  if (!v || v === s.name) {
    titleEdit.value = false
    return
  }
  try {
    await store.updateSmartView(s.id, { name: v })
    toast.show(t('photosSvSmartViewRenamed'))
    // 退出编辑态交给下面的 watch(sv.name):成功后 store 回写新名 → sv.value.name 变化 →
    // watch 触发 → titleEdit = false。失败时 name 不变,watch 不触发,titleEdit 保持 true
    // (偏离登记 3:Vue2 无 catch,这里失败要留在编辑态,不能悄悄退出让用户以为改名生效了)。
  } catch (e) {
    console.error('[photos-smartviews] commitTitle', e)
    toast.show(t('photosSvRenameFailed'))
  }
}
// 删码验证②的主体:去掉这个 watch,「成功后退出编辑态」这条用例会红(名字变了但 titleEdit
// 永远不会被这里置回 false;“未改动”分支不受影响,因为那条路径在 commitTitle 内部就同步
// 退出了,不依赖这个 watch)。
watch(() => sv.value?.name, () => {
  if (titleEdit.value) titleEdit.value = false
})

// ── paused:派生量,不是本地 state(结构规格 8,§7e-2 的最大简化)───────────────
const paused = computed(() => !sv.value?.live)
async function togglePaused(): Promise<void> {
  const s = sv.value
  if (!s) return
  const nextLive = paused.value // paused===true ⇔ 当前 !live,切换即取反 = paused 本身
  try {
    await store.updateSmartView(s.id, { live: nextLive })
  } catch (e) {
    console.error('[photos-smartviews] togglePaused', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}
function onPillKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') void togglePaused()
}

// T16 兑现(结构规格 23):「在搜索中细化」→ 跳到搜索页,用该智能视图的名字作查询词。
// 只传 q——Vue2 :520 的 smartViewId 是全仓零消费方的死参数(见文件头偏离登记 5)。
function refineInSearch(): void {
  const s = sv.value
  if (!s) return
  void router.push({ path: '/photos/search', query: { q: s.name } })
}

// ── T7 接线:条件编辑器 add/remove → store.updateSmartView(结构规格 T7)───────────
// SmartViewConditionEditor 自己不碰 store,只发 add/remove;这里负责把它翻译成
// store.updateSmartView(id, { conds: [...] })。照 Vue2 removeCond/submitCond/
// addCondSuggestion(:445-477)的请求体形状——`conds` 整体替换,不是增量 patch。
// 不需要额外 .then(loadDetail):§7e-2 的 byId(id) 让 sv 计算属性在 store 数组项更新后
// 自动跟着变,SmartViewConditionEditor 的 conds prop 立刻拿到新值。
async function addCond(cond: string): Promise<void> {
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, { conds: [...s.conds, cond] })
  } catch (e) {
    console.error('[photos-smartviews] addCond', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}
async function removeCond(cond: string): Promise<void> {
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, { conds: s.conds.filter((c) => c !== cond) })
  } catch (e) {
    console.error('[photos-smartviews] removeCond', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}

// ── T8 接线:右栏(阈值/设置开关)→ store.updateSmartView(结构规格 T8)─────────────
// SmartViewSidePanel 自己不碰 store,只做本地 draft/debounce + 派生量,只发一个统一的
// `patch` emit;这里负责把它翻译成 store.updateSmartView(id, patch)。不需要额外
// .then(loadDetail):同 addCond/removeCond 的道理,§7e-2 的 byId(id) 让 sv 计算属性在
// store 数组项更新后自动跟着变,SmartViewSidePanel 的 sv prop 立刻拿到新值。
async function onSidePatch(patch: { threshold?: number; live?: boolean; includeVideos?: boolean }): Promise<void> {
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, patch)
  } catch (e) {
    console.error('[photos-smartviews] onSidePatch', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}

// ── header 统计四格(结构规格 3)──────────────────────────────────────────────
const newCount = computed(() => sv.value?.addedThisWeek || 0)
const median = computed(() => sv.value?.median || 0)
const storageText = computed(() => formatMB(sv.value?.storageBytes || 0))

// ── 导出菜单 / more 菜单 / 删除确认:一个 mousedown 监听 + 一个 keydown 监听 ──────
const exportOpen = ref(false)
const moreOpen = ref(false)
const confirmDeleteOpen = ref(false)
const exportBtnRef = ref<HTMLElement | null>(null)
const exportMenuRef = ref<HTMLElement | null>(null)
const moreWrapRef = ref<HTMLElement | null>(null)

// 照搬 Vue2 :75/:99(exportOpen = !exportOpen / moreOpen = !moreOpen)——两个菜单相互独立,
// 不是互斥单选:Vue2 没有"开一个就关另一个"的逻辑,浮层同开是合法状态(本测试套件的
// "先开 export 再开 more,一次 Esc 两者都关"用例正是钉住这一点)。
function toggleExportMenu(): void {
  exportOpen.value = !exportOpen.value
}
function toggleMoreMenu(): void {
  moreOpen.value = !moreOpen.value
}

function onDocumentMouseDown(e: MouseEvent): void {
  const target = e.target as Node
  if (exportOpen.value) {
    const m = exportMenuRef.value, b = exportBtnRef.value
    if (m && !m.contains(target) && b && !b.contains(target)) exportOpen.value = false
  }
  if (moreOpen.value) {
    const w = moreWrapRef.value
    if (w && !w.contains(target)) moreOpen.value = false
  }
}

// 硬约束:多浮层同开时一次 Esc 必须全关——三个 if 各自独立判断,禁止提前 return
// (删码验证⑧:在第一个 if 里加 `return` 会让这条用例变红)。
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (exportOpen.value) exportOpen.value = false
  if (moreOpen.value) moreOpen.value = false
  if (confirmDeleteOpen.value) confirmDeleteOpen.value = false
}

const anyOverlayOpen = computed(() => exportOpen.value || moreOpen.value || confirmDeleteOpen.value)
watch(anyOverlayOpen, (open) => {
  if (open) document.addEventListener('keydown', onDocumentKeydown)
  else document.removeEventListener('keydown', onDocumentKeydown)
})
onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  if (toastTimer) clearTimeout(toastTimer)
})

// ── 导出(结构规格 5、6)──────────────────────────────────────────────────────
interface ExportToast { icon: 'download' | 'plus'; text: string }
const exportToast = ref<ExportToast | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showExportToast(icon: ExportToast['icon'], text: string): void {
  exportToast.value = { icon, text }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { exportToast.value = null }, 2800) // 照搬 Vue2 :499
}

// exportSmartViewUrl 走的 /v1/photos/smart-views/:id/export 不在后端 mediaGetSkip
// 豁免表里(只有 /favorites/export 后缀被豁免),且 Photos 的 JWT 中间件只从
// Authorization 头取 token、没有 query 通路 —— 所以 Vue2 的 window.location.href
// 必然 401(plan Global Constraints §7e-1,已回源实证 NimoOS-Photos/route/router.go)。
// 这里改成带 Authorization 的 fetch + blob 下载。
async function downloadZip(): Promise<void> {
  const s = sv.value
  exportOpen.value = false
  if (!s) return
  try {
    const url = service.photos.exportSmartViewUrl(String(s.id), 'zip')
    // ⚠ 不要加 'Bearer ' 前缀 —— 本仓存的是裸 token:共享包拦截器是
    // `cfg.headers.Authorization = token`(NimoOS-Service/src/http.ts:59-60),token 来自
    // `localStorage.getItem('access_token')`(main.ts:24 的 getToken 回调),全仓 grep 不到
    // 任何 'Bearer' 字面量。后端 `strings.TrimPrefix(auth, "Bearer ")` 对裸 token 是恒等的,
    // 两种都能过,但这里与共享包保持同一口径(删码验证⑤的主体)。
    // fix round 1 · C1(Critical,已回源实证):这个端点 `route/v1/smartviews.go:34` 只注册了
    // `g.POST(...)`,全仓 grep `"/smart-views/:id/export"` 只有这一条、没有 GET 版本——
    // `fetch` 默认 GET 会被 Echo 拒成 405(不是 401,但同样 100% 不通)。必须显式
    // `method: 'POST'`。不需要 body——handler(`smartviews.go:208-215`)优先取 query 的
    // `format`,`exportSmartViewUrl` 已经把 `?format=zip` 拼进 URL 里了。
    const res = await fetch(url, { method: 'POST', headers: { Authorization: localStorage.getItem('access_token') ?? '' } })
    if (!res.ok) throw new Error(`export ${res.status}`)
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `${s.name || 'smart-view'}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href) // 删码验证⑥的主体
    showExportToast('download', t('photosSvPreparingZipNPhotos', { n: fmtNum(s.count) }))
  } catch (e) {
    console.error('[photos-smartviews] downloadZip', e)
    showExportToast('download', t('photosFavExportFailed'))
  }
}

async function exportAlbumAction(): Promise<void> {
  const s = sv.value
  exportOpen.value = false
  if (!s) return
  try {
    await store.exportAlbum(s.id)
    showExportToast('plus', t('photosSvNameSnapshotSavedAlbum', { name: s.name }))
  } catch (e) {
    console.error('[photos-smartviews] exportAlbumAction', e)
    showExportToast('download', t('photosFavExportFailed'))
  }
}

// ── more 菜单:重命名 / 复制 / 删除(结构规格 8、9)───────────────────────────
function openDeleteConfirm(): void {
  moreOpen.value = false
  confirmDeleteOpen.value = true
}
function closeDeleteConfirm(): void { confirmDeleteOpen.value = false }

async function doDelete(): Promise<void> {
  const s = sv.value
  confirmDeleteOpen.value = false
  if (!s) return
  try {
    const result = await store.deleteSmartView(s.id)
    if (!result) return
    void router.push('/photos/smart-views')
    // 撤销键复用 P3 回收站已有的既定「撤销」键(grep 本仓 zh_cn.ts 已确认
    // photosTrashUndo = '撤销' / photosPersonUndo 同值,取前者——两者语义都是通用的
    // "撤销"文案,不新增)。duration 5000 照 P5「5 秒可撤销」的既有口径。
    toast.show(t('photosSvSmartViewNameDeleted', { name: s.name }), 5000, {
      label: t('photosTrashUndo'),
      // fix 波 F3(终审必修项):`void store.restoreSmartView(...)` 把失败 reject 直接吞成
      // 未处理的 promise rejection——store 的 restoreSmartView 失败时是 throw(smartViews.ts
      // :303-304 的 catch 只 console.error 再原样抛出),`void` 调用不接这个 throw,
      // 界面上什么反馈都不会出现。真实时序:用户点删除 → 已被上面 `router.push` 送回
      // 列表页(这条智能视图已从列表 splice 掉)→ 5 秒内点撤销 → 后端失败 → 原实现下
      // 界面毫无反应,这条智能视图就永久从列表消失了(后端其实还在,刷新页面才会重新出现)。
      // 违反 Global Constraints「向上抛出的 action 保持抛出(视图层 catch → toast)」——
      // 同文件 doDelete 自己是 try/catch + 失败 toast,只有这个 undo 回调漏了这层。
      // 文案复用:grep 全仓已确认没有专门的"撤销智能视图失败"键;`photosTrashRestoreFailed`
      // (P3 回收站,PhotosTrash.vue:121/171 同款"撤销恢复失败"场景,duration 同为 4500)
      // 语义完全对得上"恢复/撤销这个动作失败了",复用它,不新增键。
      onClick: () => {
        store.restoreSmartView(result as DeletedSmartView).catch((e: unknown) => {
          console.error('[photos-smartviews] undo delete', e)
          toast.show(t('photosTrashRestoreFailed'), 4500)
        })
      },
    })
  } catch (e) {
    console.error('[photos-smartviews] doDelete', e)
    toast.show(t('photosSvDeleteFailed'))
  }
}

async function duplicateSv(): Promise<void> {
  const s = sv.value
  moreOpen.value = false
  if (!s) return
  try {
    await store.duplicateSmartView(s.id)
    toast.show(t('photosSvDuplicatedNameOpenCopy', { name: s.name }))
  } catch (e) {
    console.error('[photos-smartviews] duplicateSv', e)
    toast.show(t('photosSvDuplicateFailed'))
  }
}

// ── 两段照片网格(结构规格 10)─────────────────────────────────────────────────
// lightbox 的浏览范围限定为该智能视图的**全部匹配**(不是整个图库),两段网格共用同一个
// handler、都传 matchedAssets 全集 —— 照搬 Vue2 openInLightbox :404-408 的
// `this.$emit('open-photo', p, this.matchedAssets)`(两段网格在 Vue2 里也共用这一个方法)。
// 不传第四参(query)⇒ 不激活 OCR 高亮,与 Vue2 一致。
function onTileClick(p: Photo): void {
  const r = store.recentAssets.find((x) => String(x.id) === String(p.id))
  // 就地改 recentAssets 里那个元素的属性(不是替换数组/新建对象):店内乐观清除,提前隐藏
  // "New" 角标——真实浏览记录由 lb.openAt 内部的 recordView 之类的动作在后端异步落地,
  // 这里只是即时反馈,刻意写注释说明这处直接改 store ref 元素属性是有意为之。
  if (r && r.isNew) r.isNew = false
  lb.openAt(p, store.matchedAssets, 0)
}
</script>

<template>
  <AreaShell :title="sv ? sv.name : t('photosSvSmartViews')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- 门控①:列表还没加载完 → 骨架(New-UI 新增,Vue2 没有这层概念) -->
        <div v-if="!store.listLoaded" class="sv-skeleton" data-test="sv-skeleton">
          <div class="sv-skel-bar" />
          <div class="sv-skel-header" />
          <div class="sv-skel-grid">
            <div v-for="i in 12" :key="i" class="sv-skel-tile" />
          </div>
        </div>

        <!-- 门控②:列表加载完了,但 byId 查无此项(偏离登记 1:New-UI 新增路径) -->
        <div v-else-if="!sv" class="sv-not-found" data-test="sv-not-found">
          <div class="sv-not-found-title">{{ t('photosSvNotFound') }}</div>
          <button
            type="button" class="sv-not-found-back" data-test="sv-not-found-back"
            @click="router.push('/photos/smart-views')"
          >{{ t('photosSvAllSmartViews') }}</button>
        </div>

        <!-- 门控③:正常内容 -->
        <template v-else>
          <div class="sv-detail-bar">
            <button type="button" class="sv-back-btn" @click="router.push('/photos/smart-views')">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              {{ t('photosSvAllSmartViews') }}
            </button>
            <div style="flex:1" />
            <span class="sv-last-updated">{{ t('photosSvLastUpdatedTime', { time: lastUpdated }) }}</span>
          </div>

          <!-- fix round 1 · M2:Vue2 :10-11 两层容器(sv-detail-layout grid 1fr/320px +
               sv-detail-main),第一版漏建,`.sv-detail-side` 自创了一个挂在网格下面的空壳
               margin——T8 一填内容就会出现在网格下方而不是右栏,是一次可预见的结构返工。
               本轮补建,aside 内部仍是 T8 的空挂载点,不提前实现内容。 -->
          <div class="sv-detail-layout">
          <div class="sv-detail-main">
          <div class="sv-header">
            <div style="flex:1;min-width:0">
              <h1>
                <span
                  v-if="!titleEdit" class="sv-title" data-test="sv-title-view"
                  :title="t('photosAlbumClickToRename')" @click="startTitleEdit"
                >{{ sv.name }}</span>
                <input
                  v-else ref="titleInputRef" v-model="titleDraft" class="sv-title-input" data-test="sv-title-input"
                  @keydown.enter.prevent="commitTitle" @keydown.esc.prevent="cancelTitle" @blur="commitTitle"
                >
                <span
                  class="live-pill" :class="{ 'paused-pill': paused }" role="button" tabindex="0"
                  data-test="sv-live-pill" :title="t(paused ? 'photosSvResumeAutoUpdates' : 'photosSvPauseAutoUpdates')"
                  @click="togglePaused" @keydown="onPillKeydown"
                ><span class="live-dot" /> {{ t(paused ? 'photosSvPaused' : 'photosSvLive') }}</span>
              </h1>

              <div class="sv-header-conds" data-test="sv-cond-editor-mount">
                <SmartViewConditionEditor
                  :conds="sv.conds" :busy="store.patchBusy"
                  @add="addCond" @remove="removeCond"
                />
              </div>

              <div class="sv-header-stats">
                <span><b data-test="sv-stat-count">{{ fmtNum(sv.count) }}</b> {{ t('photosSvPhotosCount') }}</span>
                <span v-if="newCount > 0" data-test="sv-stat-delta"><b class="delta">+{{ newCount }}</b> {{ t('photosSvThisWeek') }}</span>
                <span>{{ t('photosSvMedianMatch') }} <b data-test="sv-stat-median">{{ median }}%</b></span>
                <span>{{ t('photosStorage') }} <b data-test="sv-stat-storage">{{ storageText }}</b></span>
              </div>
            </div>

            <div class="sv-actions">
              <button type="button" class="sv-action-btn" data-test="sv-action-pause" @click="togglePaused">
                <svg v-if="paused" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                {{ t(paused ? 'photosSvResume' : 'photosSvPause') }}
              </button>

              <!-- T16 兑现:搜索路由(/photos/search)已建,细化跳到搜索页并用该智能视图的
                   名字作查询词。Vue2 :520 的 payload 另带 smartViewId,全仓 grep 零消费方,
                   死参数不迁(见文件头偏离登记 5),这里只传 q。 -->
              <button
                type="button" class="sv-action-btn" data-test="sv-action-refine"
                @click="refineInSearch"
              >
                <!-- fix 波 F7(终审顺带项):放大镜手柄此前是 `M21 21l-4.3-4.3`——全仓孤例,
                     其余 4 处(PhotosSearchBar.vue/PhotosSearch.vue/PlaceCoverPicker.vue ×2)
                     都用 `m20 20-3.5-3.5`(圆圈参数 cx=11 cy=11 r=7 四处本就相同,只有手柄
                     长度不一样)。用户从这个详情页点「在搜索中细化」进搜索页,前后两屏的
                     放大镜手柄长度此前会跳一下——改成统一值。 -->
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                {{ t('photosSvRefineSearch') }}
              </button>

              <div style="position:relative">
                <button
                  ref="exportBtnRef" type="button" class="sv-action-btn sv-action-btn-primary"
                  data-test="sv-export-toggle" data-primary="true" :data-open="exportOpen"
                  @click="toggleExportMenu"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
                  {{ t('photosSvExport') }}
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style="margin-left:2px;opacity:0.85"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
                <Transition name="sv-menu">
                <div v-if="exportOpen" ref="exportMenuRef" class="sv-export-menu" data-test="sv-export-menu">
                  <button type="button" class="sv-export-item" data-test="sv-export-zip" @click="downloadZip">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosFavExport') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvNPhotosMbMb', { n: fmtNum(sv.count), mb: fmtNum(Math.round(sv.count * 3.2)) }) }}</div>
                    </div>
                  </button>
                  <button type="button" class="sv-export-item" data-test="sv-export-album" @click="exportAlbumAction">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvSaveStaticAlbum') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvSnapshotCurrentMatchesStops') }}</div>
                    </div>
                  </button>
                </div>
                </Transition>
              </div>

              <div ref="moreWrapRef" style="position:relative">
                <button
                  type="button" class="sv-action-btn sv-action-btn-icon" data-test="sv-more-toggle"
                  :data-open="moreOpen" @click="toggleMoreMenu"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                </button>
                <Transition name="sv-menu">
                <div v-if="moreOpen" class="sv-export-menu sv-more-menu" data-test="sv-more-menu">
                  <button type="button" class="sv-export-item" data-test="sv-more-rename" @click="startTitleEdit">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvRename') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvChangeSmartViewName') }}</div>
                    </div>
                  </button>
                  <button type="button" class="sv-export-item" data-test="sv-more-duplicate" @click="duplicateSv">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvDuplicate') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvCopyQuerySv') }}</div>
                    </div>
                  </button>
                  <div class="sv-export-sep" />
                  <!-- Vue2 :119-123 三处内联的那个珊瑚红字面量全部改 --remove-fg 家族(见样式块)。 -->
                  <button type="button" class="sv-export-item sv-export-item-danger" data-test="sv-more-delete" @click="openDeleteConfirm">
                    <div class="sv-export-icon sv-export-icon-danger"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvDeleteSmartView') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvPhotosStayLibrary') }}</div>
                    </div>
                  </button>
                </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- 「最近添加」段:仅 newCount > 0 时渲染,tile 走 store.recentAssets -->
          <template v-if="newCount > 0">
            <div class="sv-section-head" data-test="sv-recent-head">
              {{ t('photosSvRecentlyAdded') }} <span class="pill">{{ t('photosSvNNewThisWeek', { n: newCount }) }}</span>
            </div>
            <div class="sv-grid-photos sv-grid-photos-recent" data-test="sv-recent-grid">
              <div
                v-for="p in store.recentAssets" :key="p.id" class="tile" :class="{ recent: p.isNew }"
                data-test="sv-recent-tile" @click="onTileClick(p)"
              >
                <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                <div v-if="p.isNew" class="new-tag">{{ t('photosSvNew') }}</div>
              </div>
            </div>
          </template>

          <!-- 「全部匹配」段:tile 走 store.matchedAssets -->
          <div class="sv-section-head" data-test="sv-all-head">
            {{ t('photosSvAllMatches') }} <span class="pill">{{ fmtNum(sv.count) }}</span>
          </div>
          <div class="sv-grid-photos" data-test="sv-all-grid">
            <div
              v-for="p in store.matchedAssets" :key="p.id" class="tile"
              data-test="sv-all-tile" @click="onTileClick(p)"
            >
              <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
            </div>
          </div>
          </div>

          <!-- T8 兑现:右栏(阈值滑块 / 设置开关 / 统计四格 / 匹配分布)+ 活动流。 -->
          <aside class="sv-detail-side" data-test="sv-side-mount">
            <SmartViewSidePanel :sv="sv" :busy="store.patchBusy" @patch="onSidePatch" />
            <SmartViewActivityFeed :activity="store.activity" />
          </aside>
          </div>
        </template>
      </main>
    </div>

    <!-- 导出结果的页内浮条(结构规格 7):Vue2 这是页内定位的浮条(scss:458-476),与全局
         useToast 的位置不同,信息层级不一样——照 Vue2 自绘,不复用 useToast。 -->
    <transition name="sv-toast-fade">
      <div v-if="exportToast" class="sv-toast" data-test="sv-export-toast">
        <svg v-if="exportToast.icon === 'download'" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        {{ exportToast.text }}
      </div>
    </transition>

    <!-- 删除确认弹窗(结构规格 9,照搬 Vue2 :239-253 的内容与文案;类名不沿用 Vue2 借用
         灯箱的 lb-confirm-* 命名——本仓 PhotoLightbox.vue 已有一份同名但作用域不同的样式,
         这里另起 sv-confirm-* 避免误导读者以为是同一处,视觉 1:1 移植)。 -->
    <Transition name="sv-confirm">
    <div v-if="confirmDeleteOpen" class="sv-confirm-scrim" data-test="sv-confirm-scrim" @click.self="closeDeleteConfirm">
      <div class="sv-confirm-panel">
        <div class="sv-confirm-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
        <div class="sv-confirm-title">{{ t('photosSvDeleteName', { name: sv?.name }) }}</div>
        <div class="sv-confirm-body">{{ t('photosSvSmartViewRemovedStops', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div class="sv-confirm-foot">
          <button type="button" class="sv-confirm-cancel" data-test="sv-confirm-cancel" @click="closeDeleteConfirm">{{ t('photosCancel') }}</button>
          <button type="button" class="sv-confirm-ok danger" data-test="sv-confirm-ok" @click="doDelete">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
            {{ t('photosDelete') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
  </AreaShell>
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── 骨架(New-UI 新增)── */
.sv-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.sv-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.sv-skel-header { height: 90px; border-radius: var(--radius-sm); background: var(--skeleton-bg); }
.sv-skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
.sv-skel-tile { aspect-ratio: 1; border-radius: 6px; background: var(--skeleton-bg); }

/* ── 找不到(偏离登记 1,New-UI 新增)── */
.sv-not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.sv-not-found-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.sv-not-found-back { height: 34px; padding: 0 16px; border-radius: 8px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.sv-not-found-back:hover { background: var(--chip-bg-hi); }

/* ── 顶栏(scss:146-159)── */
.sv-detail-bar { padding: 16px 32px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--divider); }
.sv-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 8px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted); font: inherit; font-size: 12px; cursor: pointer; }
.sv-back-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-last-updated { font-size: 12px; color: var(--fg-muted); }

/* ── header(scss:210-253)── */
.sv-header { padding: 24px 32px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.sv-header h1 { font-family: var(--font-display, var(--font)); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; display: flex; align-items: center; gap: 10px; }
.sv-title { cursor: text; color: var(--fg); }
/* Vue2 :22 内联 style 逐属性对照:font-size:28px(已在 h1 上)/font-weight:600(同)/
   letter-spacing:-0.02em(同)/min-width:300px/background/border/border-radius/padding/
   color/font/outline。 */
.sv-title-input {
  background: var(--chip-bg); border: 1px solid var(--accent); border-radius: 8px;
  padding: 2px 10px; color: var(--fg); font: inherit; font-size: 28px; font-weight: 600;
  letter-spacing: -0.02em; font-family: var(--font-display, var(--font)); outline: none; min-width: 300px;
}
.live-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px 3px 8px; border-radius: 99px;
  background: color-mix(in srgb, var(--success) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  color: var(--success); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  font-family: var(--font); vertical-align: middle; cursor: pointer; transition: filter 0.15s, transform 0.12s;
}
.live-pill:hover { filter: brightness(1.15); }
.live-pill:active { transform: scale(0.96); }
.live-pill .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 6px var(--success); animation: sv-pulse 1.6s infinite; }
.live-pill.paused-pill {
  background: color-mix(in srgb, var(--dem-fg) 15%, transparent);
  border-color: color-mix(in srgb, var(--dem-fg) 32%, transparent);
  color: var(--dem-fg);
}
.live-pill.paused-pill .live-dot { background: var(--dem-fg); box-shadow: 0 0 6px var(--dem-fg); animation: none; }
@keyframes sv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* T7 兑现:Vue2 scss:252 的容器布局(T6 只留了 min-height 占位)。 */
.sv-header-conds { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; align-items: center; min-height: 4px; }

.sv-header-stats { display: flex; gap: 20px; font-size: 12px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.sv-header-stats b { color: var(--fg); font-weight: 600; }
.sv-header-stats .delta { color: var(--success); }

/* ── 操作栏(scss:386-404)── */
.sv-actions { display: flex; gap: 8px; align-items: center; }
.sv-action-btn {
  height: 32px; padding: 0 12px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font: inherit; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
}
.sv-action-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sv-action-btn-icon { padding: 0 10px; min-width: 32px; justify-content: center; }
.sv-action-btn[data-open="true"] { box-shadow: 0 0 0 2px var(--accent-soft); }
/* fix round 1(评审折中方案,控制器裁定):Vue2 `[data-primary="true"]` 是渐变
   `linear-gradient(135deg, accent, accent-hi)`——本仓没有 `--accent-hi`(全局约定 §33),
   改成 `var(--accent)` 实底 + hover `filter: brightness(1.08)`,先例见
   `PhotosPersonDetail.vue:1142`/`ClusterActionDialog.vue:331-332` 等。DOM 上仍保留
   `data-primary="true"` 属性(与 Vue2 一致),但样式选择器改用伴生类
   `.sv-action-btn-primary`,理由见下一条 hover 选择器的注释。 */
.sv-action-btn-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
/* fix round 1(第一版曾用单类 `.sv-action-btn-primary:hover`,被评审判定"更弱"——那与基类
   `.sv-action-btn:hover` 同为 (0,2,0),平局时只靠书写顺序才不被基类的灰底盖成白底白字,
   属于本期"hover 硬约束"明确要防的脆弱写法)。改成复合选择器
   `.sv-action-btn.sv-action-btn-primary:hover`,真实优先级 (0,3,0),结构上稳赢基类的
   (0,2,0),不依赖行序——`cssCascade.ts` 的 `classSpecificity` 按类/伪类计数,算出来正好是 3。 */
.sv-action-btn.sv-action-btn-primary:hover { background: var(--accent); filter: brightness(1.08); color: var(--on-accent); }

/* ── 导出 / more 菜单(scss:407-452)── */
.sv-export-menu {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 280px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 6px;
  box-shadow: var(--card-shadow-hi); z-index: 50; display: flex; flex-direction: column; gap: 1px;
}
.sv-more-menu { min-width: 220px; }
.sv-export-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; background: transparent; border: 0;
  border-radius: 8px; color: var(--fg); text-align: left; cursor: pointer; font: inherit; width: 100%;
}
.sv-export-item:hover { background: var(--chip-bg-hi); }
.sv-export-icon {
  width: 28px; height: 28px; border-radius: 7px; background: var(--accent-soft); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.sv-export-title { font-size: 12.5px; font-weight: 500; line-height: 1.2; }
.sv-export-desc { font-size: 11px; color: var(--fg-muted); margin-top: 3px; line-height: 1.35; }
.sv-export-sep { height: 1px; margin: 4px 6px; background: var(--divider); }
/* Vue2 :119-123 三处内联的那个珊瑚红字面量 → --remove-fg 家族。 */
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--remove-fg); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg); }
/* fix round 1:同上 .sv-action-btn-primary 的道理——复合选择器 (0,3,0) 稳赢基类
   `.sv-export-item:hover` 的 (0,2,0),不靠书写顺序。 */
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); }

/* fix round 1 · I2:Vue2 :79/:102 各包一层 `<transition name="sv-menu">`,规则在
   scss:454-455(opacity 0.14s + translateY(-4px) scale(0.97),140ms 缩放淡入)。
   Vue3 用 `-enter-from`/`-leave-to`(不是 Vue2 的 `-enter`),照本文件已有的
   `.sv-toast-fade-*` 既定写法。 */
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── 两段网格(scss:480-525)── */
.sv-section-head { padding: 18px 32px 8px; display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); }
.sv-section-head .pill { padding: 1px 8px; border-radius: 99px; background: var(--chip-bg); color: var(--fg-muted); text-transform: none; letter-spacing: 0; font-weight: 500; }
.sv-grid-photos { padding: 0 32px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
/* Vue2 :136 内联 `padding-bottom:18px` 只加在"最近添加"段的网格上(全部匹配段没有这条),
   给该段留出与下方"全部匹配"标题的呼吸间距。审计时发现模板已加了这个类但样式块漏写,
   补上——同类漏渲染是本工程最高频缺陷,回源逐条核对时揪出。 */
.sv-grid-photos-recent { padding-bottom: 18px; }
.sv-grid-photos .tile { position: relative; aspect-ratio: 1; cursor: pointer; border-radius: 4px; overflow: hidden; }
.sv-grid-photos .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* fix round 1 · I3:Vue2 scss:506-513 在 accent 边框内侧还叠一圈半透明黑色内阴影,作用是
   在浅色照片上把 accent 环压出对比(纯白照片上单靠 2px accent 边框太容易被背景冲淡)。
   `color-mix(in srgb, black 40%, transparent)` 复刻同样的暗度,不写字面 hex/rgb 函数——
   `black` 关键字加 color-mix 有本仓先例 `PhotosTrash.vue:405`。 */
.sv-grid-photos .tile.recent::after {
  content: ""; position: absolute; inset: 0; border: 2px solid var(--accent); border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, black 40%, transparent);
}
.sv-grid-photos .new-tag {
  position: absolute; top: 6px; left: 6px; padding: 2px 7px; border-radius: 99px; background: var(--accent);
  /* --on-accent 唯一合法场景:底色是 var(--accent) 饱和实底。 */
  color: var(--on-accent); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
}

/* fix round 1 · M2(task-8 评审:T6 挂的账,本任务真正引入了 4 段可滚动内容,现在结账):
   Vue2 scss:161-166(sv-detail-layout)+ :167-172(sv-detail-main)+ :187-194(sv-detail-side
   基础外观)。--line → --divider、--surface-1 → --panel-bg-solid(先例
   PlaceDetailPanel.vue:38/312:同类"内容旁的常驻实底侧栏",不用 --popup-bg——那是浮层专用)。
   **决定:不移植 Vue2 scss:195-209 的 `::-webkit-scrollbar` 滚动条美化(accent 渐变
   thumb / 10px 宽 / accent 6% 轨道),`.sv-detail-main`/`.sv-detail-side` 都只走
   `overflow-y: auto` 交给浏览器默认滚动条。** 理由:本分支惯例是滚动条只隐藏
   (`scrollbar-width: none` / `display: none`)不重画,已有先例
   `PhotosGrid.vue:420`、`PhotoFilmstrip.vue`、`PhotosPersonDetail.vue:1041`;
   `theme.css` 已有全局细滚动条兜底;且 SP5-P6 实证过 Chrome 121+ 一旦元素吃到标准
   `scrollbar-width`/`scrollbar-color`,浏览器就会整体禁用该元素上的
   `::-webkit-scrollbar` 定制族——照搬 Vue2 那套等于引入死代码。 */
.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }
.sv-detail-side {
  border-left: 1px solid var(--divider); background: var(--panel-bg-solid);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}

/* ── 导出结果浮条(scss:458-476)── */
.sv-toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 99px;
  color: var(--fg); font-size: 12.5px; box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur);
  z-index: 300;
}
.sv-toast-fade-enter-active, .sv-toast-fade-leave-active { transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
.sv-toast-fade-enter-from, .sv-toast-fade-leave-to { opacity: 0; transform: translate(-50%, 8px); }

/* ── 删除确认(scss 无独立区块;照 PhotoLightbox.vue 的 .lb-confirm-* 视觉先例,类名
     另起 sv-confirm-* 避免与灯箱同名样式混淆,见模板处注释)── */
.sv-confirm-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 40px 20px;
}
.sv-confirm-panel {
  width: 380px; max-width: 100%; padding: 22px; border-radius: 16px;
  background: var(--popup-bg); border: 1px solid var(--card-border); box-shadow: var(--card-shadow-hi);
  color: var(--fg);
}
.sv-confirm-icon {
  width: 44px; height: 44px; border-radius: 50%; margin-bottom: 10px;
  background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg);
  display: flex; align-items: center; justify-content: center;
}
.sv-confirm-title { font-size: 16px; font-weight: 600; }
.sv-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
.sv-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.sv-confirm-cancel, .sv-confirm-ok {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--card-border); background: transparent;
  color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
.sv-confirm-cancel:hover { background: var(--chip-bg-hi); }
.sv-confirm-ok.danger {
  border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent);
  color: var(--remove-fg); background: color-mix(in srgb, var(--remove-fg) 10%, transparent);
}
.sv-confirm-ok.danger:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
/* fix round 1 · I2:Vue2 :239 包 `<transition name="lb-confirm">`,规则在
   photos.scss:702-707(opacity + scale(0.95),200ms)。类名不沿用 `lb-confirm`(同上方
   scrim/panel 命名理由,避免与 PhotoLightbox.vue 已有的同名 transition 混淆)。 */
.sv-confirm-enter-active, .sv-confirm-leave-active { transition: opacity 0.2s, transform 0.2s; }
.sv-confirm-enter-from, .sv-confirm-leave-to { opacity: 0; transform: scale(0.95); }

/* ≤768px:侧栏已收抽屉,布局单列(本区既定形态);详情页自己的两列(内容/右栏)同样
   塌成单列,右栏排到内容下方。 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--divider); }
}
</style>
