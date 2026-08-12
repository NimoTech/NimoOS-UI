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
//  6) SP15-P2a final review, finding 4 — an excluded tile is inert while selecting.
//     Vue 2 :167 wires `restoreOne` onto the excluded tiles unconditionally, so in
//     selection mode every tile on the page toggles a checkmark except an excluded one,
//     which silently writes to the server instead. The user taps expecting selection and
//     gets an unconfirmed restore with no toast and no undo. Excluded assets are not
//     removal candidates — the only thing selection leads to here is "remove from view",
//     which they are already out of — so they are neither selectable nor restorable while
//     selecting: the click is a no-op. This is one of Vue 2's own defects being fixed and
//     registered rather than copied, per this branch's porting rule.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import SmartViewSidePanel from '../photos/components/SmartViewSidePanel.vue'
import SmartViewActivityFeed from '../photos/components/SmartViewActivityFeed.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import { usePhotosSmartViews, type DeletedSmartView } from '../photos/stores/smartViews'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useToast } from '../stores/toast'
import { isConflict } from '../photos/util/httpErrors'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { relTime } from '../photos/util/relTime'
// SP15-P2c Task 6: reused, not re-implemented. Despite the name this is a plain photo
// comparator keyed off a string mode (util/albumView.ts:74) -- its 'taken' branch is
// byte-for-byte the comparator Vue2 writes inline here as `sortedByMode` (33b05636
// :577-587). Task 7 fold-in, finding (e): the fallback branch does not return the list
// "untouched" -- albumView.ts:88 returns `[...photos]`, a fresh shallow copy. The *order* is
// untouched (exactly what Vue2 means by 'score': its own comment there says "the order as it
// stands", because the backend already returns match_score DESC), the *reference* is not.
// Writing a second copy of the same two branches on this page is what the ruling against
// duplicated TS (phase ruling: option B on sharing) exists to prevent.
import { sortAlbumPhotos } from '../photos/util/albumView'
import { formatMB } from '../photos/util/formatBytes'
import type { Photo } from '../photos/util/assetToPhoto'
import { useFixedMenuPosition } from '../photos/composables/useFixedMenuPosition'

const route = useRoute()
const router = useRouter()
const store = usePhotosSmartViews()
const albums = usePhotosAlbums()
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
  void store.loadExcluded(svId.value)
})
watch(() => route.params.id, (raw) => {
  if (raw === undefined) return // 已离开本路由(同 PhotosPersonDetail.vue 的既有先例)
  // SP15-P2a: everything the manual actions hold is keyed to the id we are leaving, so it all
  // resets here. `edit`/`selectedIds` are the pair with a write consequence —
  // removeSelected() reads svId.value at call time, so a selection carried across an :id
  // change would send view A's asset ids to view B's remove endpoint, under a bar counting
  // photos that are no longer on screen. `pickerOpen` is the same story from the other side
  // (its already-in set comes from the previous view's members) and `excludedOpen` is the
  // cosmetic remainder of the same rule. Vue 2 could not hit any of this — its detail
  // component was v-if'd and remounted per view.
  //
  // Task 7 fold-in, finding (a): `sortBy`/`density` (added by Task 6) are deliberately NOT in
  // this list, so the comment above no longer claims "nothing on screen may come from the old
  // id" -- that was true before Task 6 and stopped being the rule this watcher enforces.
  // Sort order and grid density are display preferences, not write-consequential state: unlike
  // `selected`/`pickerOpen`, nothing downstream reads them keyed to a specific view id, so
  // carrying them across a navigation cannot mislabel or misdirect a request the way a stale
  // selection can. PhotosAlbumDetail.vue's own route-id watcher (Task 3/4, the sibling this
  // page is being brought in line with) already sets this precedent -- it resets
  // `selected`/`titleEditing`/`titleDraft`/`edit`/`pickerOpen` but leaves its own `sortBy`
  // untouched too. Treating "the user prefers date-taken order at compact density" as a
  // per-session preference that survives switching views is the deliberate, matching choice
  // here, not an oversight.
  edit.value = false
  selectedIds.value = []
  pickerOpen.value = false
  excludedOpen.value = false
  void store.loadDetail(String(raw))
  void store.loadExcluded(String(raw))
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

// ── T7 wiring, shrunk by SP15-P2c Task 8 (structure spec T7) ────────────────────
// SP15-P2c Task 8, ported from Vue2 NimoOS-UI 33b05636 PhotosSmartViewDetail.vue:26-30 +
// :700-710 ("用户追加需求" -- a deliberate product decision, not an oversight): the
// "Add condition" entry (button + popover) is deleted along with the four Vue2 methods
// that only served it, and this repo's equivalents inside the now-deleted, formerly
// separate condition-editor component (see task-8-report.md for the exact names on both
// sides). The function that translated the editor's "add" emit into a store call went
// with it -- it had no other caller. `removeCond` survives (Vue2 keeps "existing
// condition, click to remove") and is now called directly from this page's own template
// instead of via the deleted component's "remove" emit.
//
// The `if (store.patchBusy) return` guard is net-new versus Vue2 (Vue2's removeCond has no
// reentry guard at :697-701) and was already reviewed/tested when it lived inside
// the deleted condition-editor component -- kept here rather than silently dropped when folding the
// component back in, per this repo's "port visually, fix logic, don't regress" convention.
// It is technically redundant with store.updateSmartView's own `if (patchBusy.value) return`
// (smartViews.ts:246) -- both guards no-op a concurrent call -- but removing it would also
// mean losing the `data-busy` visual affordance's justification, so it stays as
// belt-and-suspenders documentation of intent, not dead code.
async function removeCond(cond: string): Promise<void> {
  if (store.patchBusy) return
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, { conds: s.conds.filter((c) => c !== cond) })
  } catch (e) {
    console.error('[photos-smartviews] removeCond', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}

// ── T8 wiring: right rail (threshold/settings toggles) -> store.updateSmartView
// (structure spec T8) ─────────────────────────────────────────────────────────
// SmartViewSidePanel doesn't touch the store itself -- it only keeps local draft/debounce
// state and derived values, and emits a single unified `patch`; this translates that into
// store.updateSmartView(id, patch). No extra .then(loadDetail) needed, same reasoning as
// removeCond: §7e-2's byId(id) makes the `sv` computed follow along once the store's array
// entry updates, so SmartViewSidePanel's `sv` prop picks up the new value immediately.
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

// ── SP15-P2c Task 6: sort capsule + density pair (target :49-90) ─────────────────────────
// New construction: this page never had either control. Both are display-only preferences --
// they change what the two grids show and in what order, and send nothing to the backend
// (Vue2's own note at :457-459).
//
// 'score' is the identity ordering: the backend already returns matches by match_score DESC,
// so the mode exists to name the default rather than to reorder anything.
type SvSortBy = 'score' | 'taken'
const sortBy = ref<SvSortBy>('score')
const sortMenuOpen = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)
// Enum values match PhotosAlbumDetail.vue's (Vue2 spells the first one 'comfort'). The two
// detail pages have to agree: the value is never visible, and a split would mean two
// spellings of the same `data-active` test and the same `.density` rules.
const density = ref<'comfortable' | 'compact'>('comfortable')

// Two options here, against the album page's three -- a smart view has no manual order and no
// separate "date added" (target :56-67).
const sortOptions = computed(() => [
  { id: 'score' as SvSortBy, label: t('photosSortScore') },
  { id: 'taken' as SvSortBy, label: t('photosAlbumSortTaken') },
])
const currentSortLabel = computed(() => sortOptions.value.find((s) => s.id === sortBy.value)?.label ?? '')
function pickSort(s: SvSortBy): void {
  sortBy.value = s
  sortMenuOpen.value = false
}

// The display order for each grid. The store's arrays stay untouched: `viewAssetIds` looks ids
// up rather than reading positions. Task 9 hands the lightbox these two computeds (not the raw
// store arrays) at the template call sites below, so its navigation order matches what each
// grid is showing.
const matchedSet = computed(() => sortAlbumPhotos(store.matchedAssets, sortBy.value))
const recentSet = computed(() => sortAlbumPhotos(store.recentAssets, sortBy.value))

// ── more menu (spec 8, 9) / delete confirmation: one mousedown listener + one keydown listener ──
// Task 7: the Export button/menu is gone -- `exportOpen`/`exportBtnRef`/`exportMenuRef` went
// with it (ZIP is now the unified menu's third entry; "Save as static album" is a deleted
// capability, see `exportAlbumAction`'s own removal note below). `moreWrapRef` is renamed
// `morePopRef` and `moreBtnRef` is new, matching PhotosAlbumDetail.vue's own naming (Task 5):
// `morePopRef` wraps both the trigger button and the menu for click-outside purposes,
// `moreBtnRef` exists solely to hand the button's rect to `useFixedMenuPosition` -- neither
// replaces the other.
const moreOpen = ref(false)
const confirmDeleteOpen = ref(false)
// SP15-P2b Task 8: smart album -> regular album, the reverse of Task 7's
// AlbumConvertToSmartDialog. Inline in this file rather than a new component (Vue2 inlines
// its lb-confirm-* version too, and this page already owns a confirmation of the same
// shape for delete).
const convertToAlbumOpen = ref(false)
const convertingToAlbum = ref(false)
const convertError = ref('')
const morePopRef = ref<HTMLElement | null>(null)
const moreBtnRef = ref<HTMLElement | null>(null)

// Task 7 (T1): pins the unified menu to the viewport via the trigger button's rect, so it no
// longer clips against .sv-detail-side's own overflow-y:auto once the menu grew to five
// entries (the same fix Task 5 already applied to PhotosAlbumDetail.vue's own more menu).
const { menuStyle } = useFixedMenuPosition(moreOpen, moreBtnRef)

function toggleMoreMenu(): void {
  moreOpen.value = !moreOpen.value
}

function onDocumentMouseDown(e: MouseEvent): void {
  const target = e.target as Node
  if (moreOpen.value) {
    const w = morePopRef.value
    if (w && !w.contains(target)) moreOpen.value = false
  }
  // SP15-P2c Task 6: the sort menu closes on an outside click the same way (Vue2 :545-548
  // adds its own click-outside for exactly this popup).
  if (sortMenuOpen.value) {
    const s = sortMenuRef.value
    if (s && !s.contains(target)) sortMenuOpen.value = false
  }
}

// Hard constraint: when multiple overlays are open, one Escape must close them all -- four
// independent ifs (five before Task 7 removed the export menu's own), no early return
// (deletion-check 8: adding `return` inside the first if turns that test red). SP15-P2b Task 8 adds convertToAlbumOpen: this branch routes through
// closeConvertToAlbum() rather than setting the flag directly, or Escape could dismiss the
// dialog mid-flight while the Cancel button's own guard refuses to (closeConvertToAlbum
// defined below).
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (moreOpen.value) moreOpen.value = false
  if (confirmDeleteOpen.value) confirmDeleteOpen.value = false
  if (convertToAlbumOpen.value) closeConvertToAlbum()
  // SP15-P2c Task 6. Vue2 gives the sort popup a click-outside but no Escape; PhotosAlbumDetail
  // .vue:539 already closes its own sort menu on Escape, and a popup that ignores the key its
  // three neighbours on this same page answer reads as broken. Registered deviation, added as
  // a fifth independent `if` so it does not disturb the "one Escape closes everything" rule.
  if (sortMenuOpen.value) sortMenuOpen.value = false
}

const anyOverlayOpen = computed(() => moreOpen.value || confirmDeleteOpen.value || convertToAlbumOpen.value || sortMenuOpen.value)
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
  // Task 7: this used to close the export menu (`exportOpen`); ZIP is now the unified menu's
  // third entry, so it closes that one instead.
  moreOpen.value = false
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

// Task 7: `exportAlbumAction` ("Save as static album" / sv-export-album) is deleted, not
// re-homed into the unified menu. This is an empirically-verified capability removal, not a
// guess: the Vue2 target's own final state (933a7d3a comment restated at 33b05636
// :184-189) records that Vue2 killed the identical button ("Save as static Album 子项整体
// 删除", i.e. "the Save as static Album entry is deleted entirely") in the same commit range
// that produced the five-entry menu, keeping only the backend
// endpoint (`photosService.exportSmartViewAlbum`) as a capability with no frontend caller.
// This page's Convert entry (`askConvertToAlbum` below) already does the equivalent job --
// freezing the current matches into a regular album -- so nothing reachable through the UI is
// lost. `store.exportAlbum` (smartViews.ts) and `service.photos.exportSmartViewAlbum` are left
// untouched, mirroring Vue2's own choice to keep the backend capability while dropping the
// frontend trigger; both become currently-unused exports of their respective modules, which is
// fine for a store action returned from its public API object (no unused-local warning) and is
// the exact shape Vue2's own history leaves behind.

// ── more menu: rename / duplicate / delete / convert / ZIP (spec 8, 9) ──────────────
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
    // SP15-P2b Task 5: smart albums now live inside Albums (Tasks 3/4), so a deleted
    // smart view's owner list is the Albums page, not this now-Moments-only route.
    void router.push('/photos/albums')
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

// SP15-P2b Task 8 (Vue2 939a7d3a diff's askConvertToAlbum/closeConvertToAlbum/
// doConvertToAlbum): the reverse of Task 7's convertFromAlbum. Freezes the current matches
// into a regular album and drops the smart view's conditions/live-updating -- not dressed up
// as reversible.
function askConvertToAlbum(): void {
  moreOpen.value = false
  convertError.value = ''
  convertToAlbumOpen.value = true
}

function closeConvertToAlbum(): void {
  // No dismissal mid-flight, or the user loses track of whether the request landed --
  // same guard as AlbumConvertToSmartDialog.vue's close() for the forward direction.
  if (convertingToAlbum.value) return
  convertToAlbumOpen.value = false
}

async function doConvertToAlbum(): Promise<void> {
  const s = sv.value
  if (!s || convertingToAlbum.value) return
  convertingToAlbum.value = true
  convertError.value = ''
  try {
    const album = await albums.convertFromSmartView(s.id)
    convertToAlbumOpen.value = false
    toast.show(t('photosSvConvertedToAlbum'))
    // Vue2 :631-647 emits to its host, which closes the panel, refetches both lists and
    // opens the new album. Here the destination is a real route that loads the album
    // itself, and the smart view no longer exists server-side -- no refetch needed.
    void router.push('/photos/albums/' + String(album.id))
  } catch (e) {
    console.error('[photos-smartviews] convertToAlbum', e)
    // Inline, not a toast: this answers the button just pressed, so it belongs next to it
    // and must not time out (same call as doConvertToAlbum's sibling AlbumConvertToSmartDialog
    // .vue). A 409 reuses the album pages' existing duplicate-name wording.
    convertError.value = isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumConvertFailed')
  } finally {
    // Cleared even on failure -- the dialog stays open precisely so retry is one click.
    convertingToAlbum.value = false
  }
}

// ── 两段照片网格(结构规格 10)─────────────────────────────────────────────────
// The lightbox's browsing range is scoped to this smart view's full match set (not the whole
// library). Both grids share this one handler, but SP15-P2c Task 9 (target 33b05636 :96/:107
// `onTileClick(p, list)`) stopped always forwarding `store.matchedAssets`: each grid now passes
// in *its own* currently-sorted display order (`recentSet`/`matchedSet`, already run through
// sortBy) from the template's v-for scope, and this just forwards it on to `lb.openAt`. E8's
// finding: once Task 6 added the Sort capsule, the grid re-orders on sortBy but the lightbox
// kept getting the unsorted store array, so "next" in the lightbox jumped to a photo that was
// not adjacent on screen -- this signature change is that fix.
// No fourth arg (query) => no OCR highlighting, matching Vue2.
function onTileClick(p: Photo, list: Photo[]): void {
  // Vue2 :456-459 (onTileClick): selection mode suppresses the lightbox — a tap either
  // selects or opens, never both. This has to come first, before the "New" badge is
  // optimistically cleared: selecting a recently-added photo must not mark it as seen.
  if (edit.value) {
    toggleSelect(String(p.id))
    return
  }
  const r = store.recentAssets.find((x) => String(x.id) === String(p.id))
  // 就地改 recentAssets 里那个元素的属性(不是替换数组/新建对象):店内乐观清除,提前隐藏
  // "New" 角标——真实浏览记录由 lb.openAt 内部的 recordView 之类的动作在后端异步落地,
  // 这里只是即时反馈,刻意写注释说明这处直接改 store ref 元素属性是有意为之。
  if (r && r.isNew) r.isNew = false
  // The third arg is startMs (only meaningful for isVideo), not an index -- openAt computes the
  // index itself from the photo's position in `list` (useLightbox.ts's photoIndexById), so this
  // stays 0 unchanged from before this task.
  lb.openAt(p, list, 0)
}

// ── SP15-P2a: manual asset actions (Vue2 :456-534) ───────────────────────────────────────
// A smart view's membership is generated from its conditions; these four actions are the
// annotations layered on top of it — pin a photo the conditions missed, remove one (which
// either unpins it or flags it excluded), and put an excluded one back.
const pickerOpen = ref(false)
// SP15-P2c Task 6 -- state decision, registered as the brief asks. P2a's `selecting` is REUSED
// and renamed `edit` rather than a second flag being added beside it. Vue2 made the identical
// call and said so at :449-451 ("behaviour unchanged, only the name and the entry point"): the
// flag Edit/Done drives is the same one that suppresses the lightbox, draws the tile checkmarks
// and gates the bottom bar. A separate `edit` alongside `selecting` would be two names for one mode, and
// every predicate on this page (onTileClick, the route watcher, removeSelected,
// onExcludedTileClick, both grids' `data-selected`) would have to pick one and stay right
// about it forever. The button's copy changes with the name -- photosPersonSelect/photosCancel
// give way to photosAlbumEdit/photosAlbumDone -- and both old keys keep other consumers
// (PersonAssetGrid.vue:124 and PhotosMomentDetail.vue:648; photosCancel has 38 more), so
// neither is orphaned by this rename.
const edit = ref(false)
const selectedIds = ref<string[]>([])
const excludedOpen = ref(false)

// Target :319-322: the bar's own label covers the empty case, which is why the bar can appear
// before anything is picked.
const selectHint = computed(() => (
  selectedIds.value.length
    ? t('photosSelectedCount', { count: selectedIds.value.length })
    : t('photosSvClickToSelect')
))

// The ids the picker must show as already-in. Normalising with String() here is load-bearing:
// asset ids arrive from the API as numbers on some paths while timeline photo ids are strings,
// and a mismatch silently un-dims every tile. Same correction as PhotosAlbums.vue:163.
const viewAssetIds = computed(() => new Set(store.matchedAssets.map((p) => String(p.id))))

function toggleEdit(): void {
  edit.value = !edit.value
  if (!edit.value) selectedIds.value = []
  // Task 7 fold-in, finding (b): keyboard-activating this button (Space/Enter on a focused
  // element) fires a `click` but no `mousedown` -- the event onDocumentMouseDown listens for
  // to close the sort menu. Without this, entering edit mode that way leaves `sortMenuOpen`
  // true while the template unmounts the sort capsule (`v-if="!edit"`), and the popup
  // reappears the moment edit mode is left again, with no visible trigger for it. Sort has no
  // meaning in edit mode either way, so it is safe to always close it here, entering or leaving.
  sortMenuOpen.value = false
}

function toggleSelect(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}

// Vue2 :516-534 (onPickPhotos). The store action already refetches this view's statistics,
// so only the asset grids are reloaded here. Both refreshes are needed: a pinned photo joins
// the matched grid, and pinning one that was previously excluded takes it out of the
// excluded band.
async function onPickPhotos(assetIds: Array<string | number>): Promise<void> {
  const id = svId.value
  const ids = assetIds.map(String)
  try {
    const n = await store.pinAssets(id, ids)
    // `null` means the store dropped the call because another write was still in flight —
    // nothing was sent, so nothing is reported and the picker keeps the user's selection
    // (final review, finding 5: this used to toast "已钉住 0 张到此视图" and close).
    if (n === null) return
    toast.show(t('photosSvPinnedNToView', { n }))
    pickerOpen.value = false
    await Promise.all([store.loadDetail(id), store.loadExcluded(id)])
  } catch (e) {
    console.error('[photos-smartviews] pinAssets', e)
    // The picker deliberately stays open on failure — the user still has their selection
    // and can retry without picking everything again (Vue2 rethrows from its handler to get
    // the same effect, its picker closing itself only on a resolved confirm).
    toast.show(t('photosSvAddFailed'), 2500, 'danger')
  }
}

// Vue2 :470-488 (removeSelected).
async function removeSelected(): Promise<void> {
  const id = svId.value
  const ids = selectedIds.value.slice()
  if (!ids.length) return
  try {
    const r = await store.removeAssets(id, ids)
    // Dropped because another write was in flight — nothing was sent, so the selection stays
    // and nothing is claimed (final review, finding 5).
    if (r === null) return
    // Removal is tiered on the backend — a pinned row is deleted, an automatically matched
    // one is flagged excluded — so the confirmation counts both (Vue2 :474).
    toast.show(t('photosSvRemovedNFromView', { n: r.unpinned + r.excluded }))
    // Cleared on success only, as in Vue2 :486: after a failure the selection is exactly
    // what the user needs in order to press the button again.
    edit.value = false
    selectedIds.value = []
    await Promise.all([store.loadDetail(id), store.loadExcluded(id)])
  } catch (e) {
    console.error('[photos-smartviews] removeAssets', e)
    toast.show(t('photosSvRemoveFailed'), 2500, 'danger')
  }
}

// Vue2 :493-503 (restoreOne). Clicking an excluded tile is the whole gesture — there is no
// separate confirm, which is why the band stays collapsed until asked for.
//
// Selection mode makes the tile inert instead (deviation 6 in the file header): Vue 2 fires
// the restore regardless, so the one tile on the page that does not toggle a checkmark
// silently writes to the server instead.
async function onExcludedTileClick(id: string): Promise<void> {
  if (edit.value) return
  const svid = svId.value
  try {
    const n = await store.restoreAssets(svid, [id])
    // Dropped because another write was in flight — nothing was sent, so there is nothing to
    // refetch (final review, finding 5).
    if (n === null) return
    await Promise.all([store.loadDetail(svid), store.loadExcluded(svid)])
  } catch (e) {
    console.error('[photos-smartviews] restoreAssets', e)
    toast.show(t('photosSvRestoreFailed'), 2500, 'danger')
  }
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
            @click="router.push('/photos/albums')"
          >{{ t('photosAlbumBack') }}</button>
        </div>

        <!-- 门控③:正常内容 -->
        <template v-else>
          <div class="sv-detail-bar">
            <!-- Deviation from Vue 2, registered. 939a7d3a:PhotosSmartViewDetail.vue:5 still
                 labels this button "All Smart Views" even though #112 made its @back return to
                 the Albums list -- Vue 2 shipped a button whose label lies about where it goes.
                 A misleading label is a user-visible defect rather than a styling choice, so
                 this port keeps Vue 2's destination and fixes the label, reusing the album
                 detail page's existing photosAlbumBack (PhotosAlbumDetail.vue:433) rather than
                 adding a key. photosSvAllSmartViews is deleted in the same commit. -->
            <button
              type="button" class="sv-back-btn" data-test="sv-detail-back"
              @click="router.push('/photos/albums')"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              {{ t('photosAlbumBack') }}
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

              <!-- SP15-P2c Task 8: "Add condition" button + popover deleted here (ported from
                   Vue2 NimoOS-UI 33b05636 PhotosSmartViewDetail.vue:26-30, "用户追加需求") --
                   only the removable chips survive. This used to mount a dedicated
                   condition-editor component; once `add` was gone it was down to a
                   bare v-for with no local state, so it folded back in here (see
                   task-8-report.md for the reasoning). -->
              <div class="sv-header-conds" data-test="sv-header-conds">
                <span
                  v-for="c in sv.conds" :key="c" class="sv-cond sv-cond-removable" data-test="sv-cond-chip"
                  :data-busy="store.patchBusy" :title="t('photosSvRemoveC', { c })" @click="removeCond(c)"
                >
                  {{ c }}
                  <span class="sv-cond-x">
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </span>
                </span>
              </div>

              <div class="sv-header-stats">
                <span><b data-test="sv-stat-count">{{ fmtNum(sv.count) }}</b> {{ t('photosSvPhotosCount') }}</span>
                <span v-if="newCount > 0" data-test="sv-stat-delta"><b class="delta">+{{ newCount }}</b> {{ t('photosSvThisWeek') }}</span>
                <span>{{ t('photosSvMedianMatch') }} <b data-test="sv-stat-median">{{ median }}%</b></span>
                <span>{{ t('photosStorage') }} <b data-test="sv-stat-storage">{{ storageText }}</b></span>
              </div>
            </div>

            <!-- SP15-P2c Task 6 (target :49-90). The row reads: Sort label -> capsule ->
                 separator -> Pause/Resume -> Edit/Done -> separator -> density. Sort and
                 density render outside edit mode only; Pause and Edit are unconditional, so in
                 edit mode those two are all that is left and Edit is how you get back out. Each
                 separator is inside the `v-if` of the group it parts, so neither can be left
                 dangling. P2a's separate Add photos and Select buttons are gone: Select's job
                 is now Edit/Done, and Add photos moved into the edit-mode bar at the bottom of
                 this file (target :318-333).
                 PARKED, NOT KEPT: Refine in Search, the Export menu and the "..." menu all sit
                 at the END of this row until Task 7 gives them their target home in the sidebar
                 (.sv-side-actions) and folds Export's two items into the "..." menu. Removing
                 them here would leave rename/duplicate/convert/delete/export unreachable for a
                 whole task -- the same call Task 3 made on the album page's own "..." menu,
                 which Task 5 then moved. Everything before them is already in the target's
                 order, so Task 7 only has to lift them out. -->
            <div class="sv-actions">
              <template v-if="!edit">
                <span class="group">{{ t('photosAlbumSort') }}</span>
                <div ref="sortMenuRef" class="sv-sort-wrap">
                  <button type="button" class="order-pill" data-test="sv-sort-btn" @click.stop="sortMenuOpen = !sortMenuOpen">
                    {{ currentSortLabel }}
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  <div v-if="sortMenuOpen" class="sv-sort-menu" data-test="sv-sort-menu">
                    <!-- Target :57-68 marks the active option with a check glyph and holds the
                         labels in line with a same-width spacer when there is none. -->
                    <button
                      v-for="s in sortOptions" :key="s.id"
                      type="button" class="sv-sort-item" data-test="sv-sort-item"
                      :data-sort-id="s.id" :data-active="s.id === sortBy"
                      @click="pickSort(s.id)"
                    >
                      <svg v-if="s.id === sortBy" class="sv-sort-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      <span v-else class="sv-sort-check" />
                      <span class="lbl">{{ s.label }}</span>
                    </button>
                  </div>
                </div>
                <div class="album-detail-actions-sep" />
              </template>

              <button type="button" class="sv-action-btn" data-test="sv-action-pause" @click="togglePaused">
                <svg v-if="paused" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                {{ t(paused ? 'photosSvResume' : 'photosSvPause') }}
              </button>
              <button
                type="button" class="sv-action-btn" data-test="sv-edit-toggle"
                :data-open="edit" @click="toggleEdit"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                {{ edit ? t('photosAlbumDone') : t('photosAlbumEdit') }}
              </button>

              <template v-if="!edit">
                <div class="album-detail-actions-sep" />
                <div class="density">
                  <button
                    type="button" data-test="sv-density-comfortable"
                    :data-active="density === 'comfortable'" :title="t('photosDensityComfortable')"
                    @click="density = 'comfortable'"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
                  </button>
                  <button
                    type="button" data-test="sv-density-compact"
                    :data-active="density === 'compact'" :title="t('photosDensityCompact')"
                    @click="density = 'compact'"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /><rect x="3" y="19" width="6" height="2" /><rect x="11" y="19" width="6" height="2" /></svg>
                  </button>
                </div>
              </template>

              <!-- Task 7: Refine in Search and the "..." menu are no longer in this row --
                   both moved to the new `.sv-side-actions` container at the top of
                   `aside.sv-detail-side` (target 33b05636 :127-225; see that container's own
                   comment for the full trail). Task 6 parked them here only because the
                   fixed-position composable did not exist yet at that point. -->
            </div>
          </div>

          <!-- "Recently added" band: rendered only while newCount > 0. Its tiles read
               `recentSet` -- store.recentAssets in the order the Sort capsule currently asks
               for (SP15-P2c Task 6). -->
          <template v-if="newCount > 0">
            <div class="sv-section-head" data-test="sv-recent-head">
              {{ t('photosSvRecentlyAdded') }} <span class="pill">{{ t('photosSvNNewThisWeek', { n: newCount }) }}</span>
            </div>
            <div class="sv-grid-photos sv-grid-photos-recent" :class="{ 'is-compact': density === 'compact' }" data-test="sv-recent-grid">
              <div
                v-for="p in recentSet" :key="p.id" class="tile" :class="{ recent: p.isNew }"
                :data-selected="edit && selectedIds.includes(String(p.id))"
                data-test="sv-recent-tile" @click="onTileClick(p, recentSet)"
              >
                <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                <div v-if="p.isNew" class="new-tag">{{ t('photosSvNew') }}</div>
                <!-- SP15-P2a (Vue2 :146-147): pin badge on the right, selection check on the
                     left, so the two never collide on the same tile. Both grids carry both. -->
                <div v-if="p.pinned" class="sv-pin-tag" data-test="sv-pin-tag">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
                </div>
                <div v-if="edit && selectedIds.includes(String(p.id))" class="sv-tile-check">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
            </div>
          </template>

          <!-- "All matches" band: tiles read `matchedSet` -- store.matchedAssets in the order
               the Sort capsule currently asks for (SP15-P2c Task 6). -->
          <div class="sv-section-head" data-test="sv-all-head">
            {{ t('photosSvAllMatches') }} <span class="pill">{{ fmtNum(sv.count) }}</span>
          </div>
          <div class="sv-grid-photos" :class="{ 'is-compact': density === 'compact' }" data-test="sv-all-grid">
            <div
              v-for="p in matchedSet" :key="p.id" class="tile"
              :data-selected="edit && selectedIds.includes(String(p.id))"
              data-test="sv-all-tile" @click="onTileClick(p, matchedSet)"
            >
              <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
              <div v-if="p.pinned" class="sv-pin-tag" data-test="sv-pin-tag">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
              </div>
              <div v-if="edit && selectedIds.includes(String(p.id))" class="sv-tile-check">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
          </div>

          <!-- SP15-P2a 「已排除」分节(Vue2 :161-172):整块只在有排除项时出现,且默认折叠——
               它是过去决定的记录,不是这个视图的内容。点一张即恢复,没有二次确认。 -->
          <template v-if="store.excluded.length">
            <div
              class="sv-section-head sv-excluded-head" data-test="sv-excluded-head"
              @click="excludedOpen = !excludedOpen"
            >
              {{ t('photosSvExcludedN', { n: store.excluded.length }) }}
              <span class="pill">{{ excludedOpen ? t('photosSvHide') : t('photosSvShow') }}</span>
            </div>
            <div v-if="excludedOpen" class="sv-grid-photos sv-excluded-grid" data-test="sv-excluded-grid">
              <div
                v-for="p in store.excluded" :key="p.id" class="tile"
                :data-inert="edit" data-test="sv-excluded-tile"
                @click="onExcludedTileClick(String(p.id))"
              >
                <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                <div class="sv-restore-hint">{{ t('photosSvRestore') }}</div>
              </div>
            </div>
          </template>
          </div>

          <!-- T8 兑现:右栏(阈值滑块 / 设置开关 / 统计四格 / 匹配分布)+ 活动流。 -->
          <aside class="sv-detail-side" data-test="sv-side-mount">
            <!-- Task 7 (target 33b05636 :127-225). The "..." menu's target home -- moved here
                 from the header's .sv-actions, where Task 6 parked it unchanged (mounting it
                 in this overflow-y:auto sidebar before the fixed-position composable existed
                 would have reproduced the exact clipping bug that composable fixes; see
                 PhotosAlbumDetail.vue's own identical note, Task 5, which this container's
                 structure matches on purpose -- the point of this task is that the two detail
                 pages end up the same).

                 The five entries are the target's full set, in its order: Rename / Duplicate /
                 Download as ZIP / Convert / Delete. Unlike PhotosAlbumDetail.vue's own copy of
                 this menu, THIS page's entries call THIS page's existing backends, not the
                 album page's (brief's own warning, verified against each): Duplicate is
                 `store.duplicateSmartView` (smartViews.ts:342, no-ops on re-entry rather than
                 throwing -- not albums.ts's `duplicateAlbum`), Download as ZIP is this page's
                 own `downloadZip` (POST + Authorization header, not JWT-exempt -- not
                 `exportAlbumZipUrl`'s GET+token navigation), and Convert goes the opposite
                 direction from the album page's (smart view -> regular album, via
                 `askConvertToAlbum`/`albums.convertFromSmartView`, not regular -> smart via
                 `AlbumConvertToSmartDialog`). "Save as static album" does NOT reappear as a
                 sixth entry -- see `exportAlbumAction`'s own removal note above the more-menu
                 handlers for why that capability is deleted rather than folded in.

                 The menu itself is position:fixed via `menuStyle` (T1's useFixedMenuPosition
                 bound to `moreBtnRef`'s rect); `morePopRef` still wraps both the button and the
                 menu for click-outside dismissal (onDocumentMouseDown above) -- the composable
                 only computes coordinates, it does not touch open/close. Vue2 wraps this same
                 menu in <transition name="sv-menu"> (33b05636 :78) -- kept here.

                 Correction (whole-branch review, Important 4): this note used to justify the
                 asymmetry with PhotosAlbumDetail.vue by claiming the target's album page carries
                 no such transition. That claim was factually wrong -- 33b05636
                 src/views/Photos/PhotosAlbumDetail.vue:223/:278 wraps its own menu in exactly
                 the same <transition name="sv-menu">. The album page has since been given the
                 wrapper and the two .sv-menu-* rules, so the two menus now animate identically
                 and there is no asymmetry left to justify. -->
            <div class="sv-side-actions">
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

              <div ref="morePopRef" class="sv-more-wrap">
                <button
                  ref="moreBtnRef" type="button" class="sv-action-btn sv-action-btn-icon" data-test="sv-more-toggle"
                  :data-open="moreOpen" @click="toggleMoreMenu"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                </button>
                <Transition name="sv-menu">
                <div v-if="moreOpen" class="sv-export-menu sv-more-menu" data-test="sv-more-menu" :style="menuStyle">
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
                  <!-- Task 7: the Export section's ZIP item (sv-export-zip) folds in here as
                       the menu's third entry, between Duplicate and Convert -- the target's own
                       order. Same handler (`downloadZip`), same copy, new data-test. -->
                  <button type="button" class="sv-export-item" data-test="sv-more-zip" @click="downloadZip">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosFavExport') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvNPhotosMbMb', { n: fmtNum(sv.count), mb: fmtNum(Math.round(sv.count * 3.2)) }) }}</div>
                    </div>
                  </button>
                  <!-- SP15-P2b Task 8 (Vue2 939a7d3a diff): grouped with rename/duplicate/zip
                       above the destructive separator, not beside Delete -- this is not a
                       destructive action, it freezes the current matches into a regular
                       album. -->
                  <button type="button" class="sv-export-item" data-test="sv-more-convert" @click="askConvertToAlbum">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M12 11v6M9 14h6" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
                    <div>
                      <!-- Task 7 review fix: the target shortened both this title and Delete's
                           below specifically so the two "matching" detail pages' menus read the
                           same (33b05636 :143-147's own comment on the change). This entry used
                           `photosSvConvertToAlbum` ("转为普通相册"), the long form Task 8 wrote
                           before this page had a sibling to match against -- the album page's
                           own Convert entry (Task 5) already reuses `photosAlbumMenuConvert`
                           ("转换", the target's exact short copy), so this switches to the same
                           key rather than coining a new SV-specific one. The confirm dialog's
                           own submit button (further down this file) still reads
                           `photosSvConvertToAlbum` unchanged -- that button predates this task,
                           is not one of the two rows the reviewer flagged, and the target itself
                           gives it the same short "Convert" copy too, so revisiting it is a
                           separate, larger cleanup outside this fix's scope. -->
                      <div class="sv-export-title">{{ t('photosAlbumMenuConvert') }}</div>
                      <!-- Desc intentionally NOT realigned to the target's shorter
                           "停止自动更新,固化当前照片": `photosSvConvertToAlbumHint`
                           ("停止自动更新，固化当前已匹配的照片") is semantically identical and
                           was a deliberate registration back in SP15-P2b (this page's Convert
                           entry existed before this task). Only the two titles were shortened
                           in the target's own commit for cross-page parity; the descs were
                           left alone there too ("Vue2 :119-123 三处内联的那个珊瑚红字面量" note
                           below shows Vue2 continuing to carry its own full desc copy
                           unchanged). Realigning this desc now would be scope creep onto a
                           different task's registered decision for a wording difference with
                           no user-visible parity gap -- recorded here rather than changed. -->
                      <div class="sv-export-desc">{{ t('photosSvConvertToAlbumHint') }}</div>
                    </div>
                  </button>
                  <div class="sv-export-sep" />
                  <!-- Vue2 :119-123 三处内联的那个珊瑚红字面量全部改 --remove-fg 家族(见样式块)。 -->
                  <button type="button" class="sv-export-item sv-export-item-danger" data-test="sv-more-delete" @click="openDeleteConfirm">
                    <div class="sv-export-icon sv-export-icon-danger"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
                    <div>
                      <!-- Task 7 review fix: same reasoning as Convert above -- the target
                           shortened this to plain "Delete" ("删除") for cross-page parity.
                           `photosDelete` already carries exactly that copy and is already the
                           key this page's own delete-confirmation button uses (below), so no
                           new key is needed; `photosSvDeleteSmartView` ("删除智能视图") lost its
                           last consumer here and Task 11's orphan sweep removed it. -->
                      <div class="sv-export-title">{{ t('photosDelete') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvPhotosStayLibrary') }}</div>
                    </div>
                  </button>
                </div>
                </Transition>
              </div>
            </div>

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

    <!-- Edit-mode bottom bar (target :318-333). SP15-P2c Task 6 reshapes P2a's version into the
         target's three elements — hint, Remove, Add photos — and re-gates it on `edit` alone
         instead of `edit && selectedIds.length`. The gate has to change: the bar now carries
         the hint line that speaks for the empty selection, and Add photos, which would be
         unreachable in a smart view with nothing selected otherwise. What used to keep an empty
         Remove request impossible is now the button's own `disabled` (plus removeSelected's own
         early return), which is where the album page puts it too.
         `&& sv` guards the same hole PhotosAlbumDetail.vue:1005 does: this bar is a sibling of
         .photos-layout, outside the `v-else` that requires a smart view, so without it the bar
         would float over the not-found state if the view vanished without the id changing. -->
    <div v-if="edit && sv" class="sv-select-bar" data-test="sv-select-bar">
      <span class="group">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        {{ selectHint }}
      </span>
      <button
        type="button" class="sv-action-btn" data-test="sv-remove-selected"
        :disabled="!selectedIds.length || store.assetBusy" @click="removeSelected"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        {{ t('photosSvRemoveFromView') }}
      </button>
      <button type="button" class="sv-action-btn" data-test="sv-add-photos" @click="pickerOpen = true">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
        {{ t('photosSvAddPhotos') }}
      </button>
    </div>

    <!-- SP15-P2a library picker (Vue2 :283-291). Title reuses photosAlbumPickerTitle --
         Vue2 already feeds one string to two pickers.
         submit-label: Vue2 :288 passes this picker a static `$t('Add selected')`, not the
         count-bearing `Add ({count})` the two album pages use. The first version passed the
         album pages' count function here and cited PhotosLibraryPicker deviation b -- but
         that deviation is about keeping the album pages' existing consumers unchanged, and
         says nothing about which form a **new** consumer should use (final review, finding
         3). Reverted to the static label, reusing P1's existing photosMoAddSelected (the
         same Vue2 copy, no new key); the two album pages still pass the function. -->
    <PhotosLibraryPicker
      v-model:open="pickerOpen"
      :title="t('photosAlbumPickerTitle', { name: sv?.name ?? '' })"
      :existing-ids="viewAssetIds"
      :existing-label="t('photosSvAlreadyInView')"
      :submit-label="t('photosMoAddSelected')"
      :submitting="store.assetBusy"
      @confirm="onPickPhotos"
    />

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

    <!-- SP15-P2b Task 8: convert-to-album confirmation -- same sv-confirm-* visual idiom as
         the delete confirmation above. The copy spells out all three consequences (updates
         stop, members are fixed, theme and conditions are removed), not dressed up as
         reversible.
         Final fix wave: the submit button carries `.primary`, not `.danger` and not the bare
         base class. Vue2 uses its filled primary CTA here (`trash-btn-cta`,
         939a7d3a:photos.scss:2203-2213 -- filled accent, light text, weight 600), while the
         delete dialog above uses the danger variant. With neither modifier the button rendered
         as a ghost pixel-identical to the Cancel beside it, with no hover feedback at all.
         The icon disc likewise takes `.accent`: Vue2 :298 tints this album glyph with
         var(--accent-hi) and only the delete dialog's trash glyph (:279) is red. -->
    <Transition name="sv-confirm">
    <div v-if="convertToAlbumOpen" class="sv-confirm-scrim" data-test="sv-convert-confirm" @click.self="closeConvertToAlbum">
      <div class="sv-confirm-panel">
        <div class="sv-confirm-icon accent"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M12 11v6M9 14h6" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
        <div class="sv-confirm-title">{{ t('photosSvConvertToAlbumTitle', { name: sv?.name }) }}</div>
        <div class="sv-confirm-body">{{ t('photosSvConvertToAlbumBody', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div v-if="convertError" class="sv-confirm-error" data-test="sv-convert-error">{{ convertError }}</div>
        <div class="sv-confirm-foot">
          <button type="button" class="sv-confirm-cancel" data-test="sv-convert-cancel" :disabled="convertingToAlbum" @click="closeConvertToAlbum">{{ t('photosCancel') }}</button>
          <button type="button" class="sv-confirm-ok primary" data-test="sv-convert-ok" :disabled="convertingToAlbum" @click="doConvertToAlbum">
            {{ convertingToAlbum ? t('photosAlbumConverting') : t('photosSvConvertToAlbum') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
  </AreaShell>
</template>

<style scoped>
/* height(不是 min-height):这一屏封顶,只有内层滚动容器滚 —— 同源修复,理由与 Vue2
   出处见 src/views/Photos.vue 同一规则处的注释。 */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
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

/* SP15-P2c Task 8: chip styles moved in from the deleted condition-editor component
   (only the removable-chip half survives -- the add button / popover rules were dropped
   with the capability, not kept as dead selectors). Vue2 base .sv-cond
   (photos-smartview.scss:96-102 base + :253 header override) has no `:hover` rule of its
   own; the hover below is scss:255-282's `.sv-cond-removable`. */
.sv-cond {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--chip-bg-hi);
  color: var(--fg-muted);
  font-size: 11.5px;
}
.sv-cond-removable {
  gap: 4px;
  cursor: pointer;
  padding-right: 6px;
  transition: background 0.12s, color 0.12s, padding 0.12s;
}
.sv-cond-x {
  width: 14px; height: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--fg) 6%, transparent);
  color: var(--fg-faint);
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 0.14s, transform 0.14s, background 0.12s;
}
/* Vue2's hardcoded coral-red literal maps to the --remove-fg family, matching this file's
   existing precedent (.sv-export-item-danger etc.). */
.sv-cond-removable:hover {
  background: color-mix(in srgb, var(--remove-fg) 14%, transparent);
  color: var(--remove-fg);
}
.sv-cond-removable:hover .sv-cond-x {
  opacity: 1;
  transform: scale(1);
  background: color-mix(in srgb, var(--remove-fg) 22%, transparent);
  color: var(--remove-fg);
}
.sv-cond-removable[data-busy="true"] { cursor: not-allowed; opacity: 0.6; }

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
/* Task 11 (c): the `.sv-action-btn-primary` pair that used to live here is gone. Task 7 folded
   this page's Export button into the unified "..." menu, and that button was the class's only
   consumer -- no element on this page carries it any more. The identical filled-accent variant
   still lives on PhotosMomentDetail.vue (:933-934), including its compound-selector hover and
   the cssCascade regression that guards it; look there for the reasoning that used to sit here. */

/* ── Task 7: sidebar top action row -- rule body restated from PhotosAlbumDetail.vue's own
   `.sv-side-actions` (Task 5; scoped styles do not cross SFCs in this repo). flex-wrap lets a
   narrow sidebar keep both buttons on their own line if needed. margin-bottom keeps the same
   24px rhythm as .sv-side-section below it. ── */
.sv-side-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.sv-more-wrap { position: relative; }

/* ── SP15-P2c Task 6: sort capsule, separators, density pair ──
   Rule bodies restated from PhotosAlbumDetail.vue's own (:1161-1176), which Task 3 in turn
   restated from Vue2 photos.scss (:3458-3475 .group / .order-pill, :285-288 .density) and
   photos-smartview.scss (.album-detail-actions-sep). Scoped styles do not cross SFCs in this
   repo, so this duplication is the phase's KEEP-THE-DUPLICATION ruling, not a missed
   extraction -- and it is what makes the two detail pages render the same row. */
.group { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
.sv-actions .order-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
  font: inherit; font-size: 12px; cursor: pointer;
}
.sv-actions .order-pill:hover { background: var(--chip-bg-hi); color: var(--fg); }
.album-detail-actions-sep { width: 1px; height: 18px; background: var(--divider); flex-shrink: 0; }

.density { display: inline-flex; gap: 2px; background: var(--chip-bg); border-radius: 8px; padding: 3px; }
.density button {
  width: 28px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 5px; background: transparent; color: var(--fg-muted); cursor: pointer;
}
.density button:hover { color: var(--fg); }
.density button[data-active="true"] { background: var(--chip-bg-hi); color: var(--fg); }

/* Sort popup. Vue2 photos.scss:3122-3153 (.albums-sort-menu / .albums-sort-item): a flex row
   per item so the check glyph and the label line up, and the active row carries --accent-soft.
   `.sv-sort-check` is the fixed-width slot the glyph sits in -- rendered as an empty span when
   the option is not the active one, which is how the target keeps every label at the same x
   (its own version writes `style="width:12px;display:inline-block"` inline). Vue2 tints the
   glyph with --accent-hi, a token this repo does not have (global convention: no --accent-hi);
   --accent-text is the pair this file's own .sv-export-icon already uses against --accent-soft. */
.sv-sort-wrap { position: relative; }
/* Task 11 (a): min-width is the target's 240px (photos.scss:3126), not the 180px written here first. */
.sv-sort-menu {
  position: absolute; top: calc(100% + 4px); right: 0; min-width: 240px; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.sv-sort-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 8px 10px;
  background: transparent; border: 0; border-radius: 8px; color: var(--fg);
  font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.sv-sort-item:hover { background: var(--chip-bg-hi); }
.sv-sort-item[data-active="true"] { background: var(--accent-soft); }
.sv-sort-item .sv-sort-check { width: 12px; flex-shrink: 0; color: var(--accent-text); }
.sv-sort-item .lbl { display: block; font-weight: 500; }

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
/* fix round 1:复合选择器 (0,3,0) 稳赢基类 `.sv-export-item:hover` 的 (0,2,0),不靠书写顺序。 */
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
/* SP15-P2c Task 6, compact density (Vue2 photos-smartview.scss:557-559): the only change is
   the auto-fill minimum, 180px down to 120px, so more thumbnails fit per row. Both grids on
   this page take the modifier; the excluded band deliberately does not, exactly as in the
   target. */
.sv-grid-photos.is-compact { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
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
/* ── SP15-P2a: selection, pin badge, excluded band, selection bar ── */
/* Selected tile (Vue2 photos.scss:329-333, the global `.photos-root .tile[data-selected]`
   rule its grids inherit). The wash over the photo is Vue2's flat accent literal at 20%,
   restated as a mix of the accent token so it follows the theme. */
.sv-grid-photos .tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }
.sv-grid-photos .tile[data-selected="true"]::before {
  content: ""; position: absolute; inset: 0; z-index: 2;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}
/* Pin badge (scss:683-692). Background is --overlay-bg — the constant-dark-badge token
   PhotosTrash.vue's .trash-tile-countdown/.trash-tile-select already use for "fixed dark
   badge over an unpredictable photo" — instead of Vue2's literal half-opaque black. */
.sv-pin-tag {
  position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--overlay-bg); backdrop-filter: blur(6px);
  display: inline-flex; align-items: center; justify-content: center; z-index: 3;
  color: #fff; /* theme-exception: badge glyph sits on unpredictable photo content inside a
    fixed dark badge — same reasoning as PhotosMomentDetail.vue's own .sv-pin-tag. */
}
/* Selection check (scss:693-701): left side, so it never collides with the pin badge on the
   right — Vue2's own placement rule. */
.sv-tile-check {
  position: absolute; top: 6px; left: 6px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--accent); display: inline-flex; align-items: center; justify-content: center; z-index: 4;
  color: var(--on-accent); /* --on-accent's one legal use: icon sits on a solid --accent fill. */
}

/* Excluded band (scss:704-721): the tiles are dimmed and the Restore hint only surfaces on
   hover, which is what keeps a record of past decisions from reading as part of the view. */
.sv-excluded-head { cursor: pointer; user-select: none; }
.sv-excluded-head:hover { color: var(--fg); }
.sv-excluded-grid .tile { opacity: 0.7; transition: opacity 0.15s ease; }
.sv-excluded-grid .tile:hover { opacity: 1; }
.sv-excluded-grid .tile .sv-restore-hint {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 4px 0; z-index: 3;
  text-align: center; font-size: 10.5px; font-weight: 600;
  color: #fff; /* theme-exception: label sits on unpredictable photo content inside a fixed
    dark strip — same reasoning as .sv-pin-tag above. */
  background: var(--overlay-bg); backdrop-filter: blur(4px);
  opacity: 0; transition: opacity 0.15s ease;
}
.sv-excluded-grid .tile:hover .sv-restore-hint { opacity: 1; }
/* Final review, finding 4 (deviation 6): while selecting, an excluded tile does nothing.
   The affordance has to say so too — otherwise the Restore hint still invites a click that
   is now deliberately ignored, which reads as the page being broken rather than as the tile
   being out of scope. Compound selector, so it beats the plain .tile:hover rule above
   without depending on source order. */
.sv-excluded-grid .tile[data-inert="true"] { cursor: default; }
.sv-excluded-grid .tile[data-inert="true"]:hover .sv-restore-hint { opacity: 0; }

/* Selection bar (scss:724-745): fixed pill, same idiom as this file's own .sv-toast
   (--popup-bg/--card-border/--card-shadow-hi/--blur). */
.sv-select-bar {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 150;
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 14px;
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur);
}
.sv-select-bar span { font-size: 13px; font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }

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
/* 底色订正(真机截图:整条右栏在玻璃壳上显示成一块黑板)。原先按 T6 的映射走
   `--surface-1` → `--panel-bg-solid`,援引的先例是 PlaceDetailPanel —— 但那条先例是
   **功能性**的:它压在 PlacesMap 的画布上,半透会把地图网格点透上来(P6b 真机验收反馈)。
   本栏底下没有地图、只有区域壳,不透明实底就只剩"与自己所在的区域不一致"这一个效果:
   同区常驻侧栏 PhotosSidebar:119 / PlacesRail:200 / PhotoInfoPanel:175 / PersonPlacesTab:188
   全是 `var(--panel-bg)`。改用玻璃底,与它们一致。
   `--panel-bg-solid` 的消费方白名单见 views/__tests__/photosGlassSurfaces.test.ts。 */
.sv-detail-side {
  border-left: 1px solid var(--divider); background: var(--panel-bg);
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
/* SP15-P2b final fix wave: the base disc is red because the only dialog that had one was the
   delete confirmation. Vue2 differentiates deliberately -- 939a7d3a:PhotosSmartViewDetail.vue
   :279 tints the delete dialog's trash glyph red, :298 tints the convert dialog's album glyph
   with var(--accent-hi) -- so a non-destructive action must not wear the delete colour. Reuses
   the --accent-soft/--accent-text pair the .sv-export-icon discs on this same page already use. */
.sv-confirm-icon.accent { background: var(--accent-soft); color: var(--accent-text); }
.sv-confirm-title { font-size: 16px; font-weight: 600; }
.sv-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
/* SP15-P2b Task 8: inline failure message next to the convert confirmation's submit button
   (not a toast -- it answers the button just pressed, same reasoning as
   AlbumConvertToSmartDialog.vue's own .convert-error). */
.sv-confirm-error { margin-top: 8px; font-size: 12px; color: var(--remove-fg); line-height: 1.4; }
.sv-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.sv-confirm-cancel, .sv-confirm-ok {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--card-border); background: transparent;
  color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
/* :not(:disabled) for the same reason as the .primary hover below -- Cancel is disabled while
   the conversion is in flight and must not light up under the cursor then. */
.sv-confirm-cancel:hover:not(:disabled) { background: var(--chip-bg-hi); }
.sv-confirm-ok.danger {
  border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent);
  color: var(--remove-fg); background: color-mix(in srgb, var(--remove-fg) 10%, transparent);
}
.sv-confirm-ok.danger:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
/* SP15-P2b final fix wave: filled primary CTA for a non-destructive confirmation, standing in
   for Vue2's `trash-btn-cta` (939a7d3a:photos.scss:2203-2213 -- filled accent gradient, light
   text, weight 600; the gradient's literals are replaced by the --accent token per this repo's
   colour rule). Without a modifier this button inherited the base ghost look and was
   indistinguishable from the Cancel next to it. The hover mirrors the filled-accent variant on
   PhotosMomentDetail.vue:934. Both selectors below are two-class compounds (0,2,0), so they outrank the
   shared `.sv-confirm-cancel, .sv-confirm-ok` base (0,1,0) structurally, not by source order. */
.sv-confirm-ok.primary { background: var(--accent); color: var(--on-accent); border: 0; font-weight: 600; }
/* :not(:disabled) rather than a later :disabled override -- CSS applies :hover to disabled
   buttons too, and the mid-flight state must not brighten under the cursor. */
.sv-confirm-ok.primary:hover:not(:disabled) { filter: brightness(1.08); }
/* Both buttons are disabled while the conversion is in flight (the delete dialog above never
   disables either), so this pair only ever shows up on the convert confirmation. */
.sv-confirm-cancel:disabled, .sv-confirm-ok:disabled { opacity: 0.6; cursor: not-allowed; }
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
