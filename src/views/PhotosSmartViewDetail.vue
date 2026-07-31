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
// 统计四格)+ 操作栏三菜单(暂停恢复 / 在搜索中细化[T16 前禁用] / 导出[ZIP 修 401 + 静态
// 相册] / more[重命名/复制/删除])+ 删除确认弹窗 + 两段照片网格(最近添加 / 全部匹配)。
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
//  4) 「在搜索中细化」T6 阶段禁用:搜索路由要 T16 才建,见按钮上的 TODO 注释。
//  5) `smartViewId` 死参数不迁:Vue2 `:520` 的 refineInSearch payload 是
//     `{ q: sv.name, smartViewId: sv.id }`,但全 Vue2 仓库 grep `smartViewId` 只有这一处
//     写入、零消费方(`grep -rn smartViewId NimoOS-UI/src/` 只命中这一行)。T16 接线时只需
//     要 `q`。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
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
    const res = await fetch(url, { headers: { Authorization: localStorage.getItem('access_token') ?? '' } })
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
      onClick: () => { void store.restoreSmartView(result as DeletedSmartView) },
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

              <!-- T7 挂载点:加条件弹层 + 条件 chip 列表(SmartViewConditionEditor)。
                   本任务只留空壳,不渲染 sv.conds。 -->
              <div class="sv-header-conds" data-test="sv-cond-editor-mount" />

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

              <!-- T16 接线点:搜索路由(/photos/search)本期后半才建。届时删掉 disabled +
                   title,接 router.push('/photos/search?q=' + encodeURIComponent(sv.name))。
                   Vue2 :520 的 payload 另带 smartViewId,全仓 grep 零消费方,死参数不迁
                   (见文件头偏离登记 5)。删这个注释时把上面文件头的 photosSvSearchPending
                   键一并从 i18n 里删掉。 -->
              <button
                type="button" class="sv-action-btn" data-test="sv-action-refine" disabled
                :title="t('photosSvSearchPending')"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
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
              </div>

              <div ref="moreWrapRef" style="position:relative">
                <button
                  type="button" class="sv-action-btn sv-action-btn-icon" data-test="sv-more-toggle"
                  :data-open="moreOpen" @click="toggleMoreMenu"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                </button>
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

          <!-- T8 挂载点:右栏(阈值滑块 / 设置开关 / 统计四格 / 匹配分布)+ 活动流。
               本任务只留空壳,不渲染任何内容。 -->
          <aside class="sv-detail-side" data-test="sv-side-mount" />
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

.sv-header-conds { min-height: 4px; }

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
/* 变体自带 :hover(cssCascade 断言胜出选择器归属这条,不是基类 .sv-action-btn:hover)。 */
.sv-action-btn-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.sv-action-btn-primary:hover { background: var(--accent); filter: brightness(1.08); color: var(--on-accent); }

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
/* Vue2 :119-123 三处内联的那个珊瑚红字面量 → --remove-fg 家族。变体自带 :hover(cssCascade 断言)。 */
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--remove-fg); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg); }
.sv-export-item-danger:hover { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); }

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
.sv-grid-photos .tile.recent::after { content: ""; position: absolute; inset: 0; border: 2px solid var(--accent); border-radius: inherit; pointer-events: none; }
.sv-grid-photos .new-tag {
  position: absolute; top: 6px; left: 6px; padding: 2px 7px; border-radius: 99px; background: var(--accent);
  /* --on-accent 唯一合法场景:底色是 var(--accent) 饱和实底。 */
  color: var(--on-accent); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
}

.sv-detail-side { margin: 20px 32px 0; min-height: 4px; }

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

/* ≤768px:侧栏已收抽屉,布局单列(本区既定形态)。 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
