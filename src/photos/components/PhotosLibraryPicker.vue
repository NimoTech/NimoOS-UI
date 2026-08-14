<script setup lang="ts">
// Task 6 (SP7-P4 相册): 「从图库挑照片加入本相册」选择器 —— 被 T7(相册列表页新建相册的
// 「手动挑选照片」)与 T8(相册详情页 Edit 态「添加照片」按钮)共用。结构照 Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumLibraryPicker.vue(142 行)。
//
// 与 T5 AlbumPickerDialog.vue(选相册)的区别:T5 是把一批已知 assetIds 加入某个待选相册;
// 本组件是从整个图库(时间线展平)里挑照片加入一个已知相册——数据源、已选判定、UI 结构都不同。
//
// 铁律:「已在相册中」判定必须 String() 归一值比较——后端资产 id 可能是数字,时间线
// Photo.id 类型是 string | number,不归一就漏判(Vue2 :86-89 直接用 Set(id) 值比较,
// 未考虑跨类型,这里改用 String 归一,同 T2 store 的既有铁律)。
//
// 形态偏离登记(与 T5 同理由,记账):Vue2 用 window.confirm 做「放弃未保存选择」二次确认
// (:112);本仓无 window.confirm 惯例,改为面板内联确认条(discardConfirm 状态),行为语义
// 不变——有未保存选择时点取消先展示确认条,确认后才真正关闭。
//
// ★★★ SP15-P1-T9 · Step 0: generalised away from albums ★★★
// It used to hardcode the album store for both halves of its job — reading which assets are
// already in (`albums.assetsOf(props.albumId)`) and writing the chosen ones back
// (`albums.addAssetsToAlbum`) — plus the success/failure toasts around that write. Moments need
// the same picker against a different collection, so both halves moved out to the caller: the
// caller passes `existingIds` and receives the picked ids on `confirm`. What is left here is the
// picking itself. Vue 2 made this exact change in #79 (ccaccd36, PhotosAlbumLibraryPicker.vue →
// PhotosLibraryPicker.vue).
//
// ✅ Debt paid in SP15-P2a (2026-08-09): this file (previously AlbumLibraryPicker.vue, plus its
// test) is renamed to PhotosLibraryPicker.vue, matching what Vue 2 already did in the same #79
// commit that generalised it. Rename only — every import, test path and the oss manifest were
// updated to follow; props, emits, template and logic are untouched, and the album pages' existing
// tests carry over unchanged as the evidence.
//
// Two shape deviations from Vue 2's #79, both to keep the two album consumers pixel-identical to
// what they render today (the whole point of a refactor step is that nothing visible moves):
//  a) `submitting` is a prop, not local state. Vue 2 kept the busy flag inside the component
//     because it could `await this.$listeners.confirm(...)` — a Vue 2 listener is a plain
//     function and returns the parent's promise. Vue 3's `emit()` discards the handler's return
//     value, so the component cannot know when the parent's write finished; the flag follows the
//     write to the caller. Same rendered result: the button reads "Adding…" and is disabled for
//     exactly as long as the request is in flight.
//  b) `submitLabel` accepts a `(count) => string` as well as a plain string. Vue 2's #79 turned
//     the album button from "Add ({n})" into a static "Add selected", silently dropping the count
//     from a screen that had it. The album pages here keep their count by passing a function;
//     moments pass a plain string, exactly Vue 2's "Add selected".
// Closing on success also moves to the caller for the same reason as (a): the component can no
// longer tell success from failure. Every caller closes on success and leaves the panel open on
// failure — which is Vue 2's observable behaviour, kept intact.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useTimelineStore } from '../stores/timeline'
import { bucketKey } from '../util/timelineBuckets'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{
  open: boolean
  title: string
  /** Ids already in the target collection, String()-normalised by the caller (see the iron rule
   *  above — the caller owns the collection, so it owns the normalisation of its own ids). */
  existingIds: Set<string>
  existingLabel: string
  submitLabel: string | ((count: number) => string)
  submitting?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', ids: Array<string | number>): void
}>()

const { t } = useI18n()
const timeline = useTimelineStore()

// 选中集合直接存 flat 里给出的原始 id(与 flat 同源,类型天然一致,无需归一);
// 提交时原样传给 addAssetsToAlbum,不做类型转换。
// [T9] The ids are now handed to the caller unconverted instead — whatever type it wants is its
// own business. Both album paths still pass them straight to addAssetsToAlbum, so not one byte
// of the request body changed.
const selected = ref<Set<string | number>>(new Set())
const discardConfirm = ref(false)
// The scrolling list itself — needed to answer "can the user scroll at all?"
// (see fillViewport below). Declared here, ahead of the open-watch that reaches it.
const bodyRef = ref<HTMLElement | null>(null)

// 照 Vue2 flat computed(:73-85):展平所有月份的照片,按 takenAt 降序。时间线本身已有
// allPhotos 展平 computed(timeline.ts:61),这里复用它再排序,不重写展平逻辑。
const flat = computed<Photo[]>(() => {
  const out = timeline.allPhotos.slice()
  out.sort((a, b) => {
    const ta = a.takenAt ? Date.parse(String(a.takenAt)) : 0
    const tb = b.takenAt ? Date.parse(String(b.takenAt)) : 0
    return tb - ta
  })
  return out
})

// 铁律:String 归一的 Set 值比较——相册资产 id 与时间线照片 id 类型可能不一致。
// [T9] Only the consuming half of that normalisation is still here; the producing half (String()
// while building the Set) moved to whoever owns the target collection. Each caller's test asserts
// its own half — a numeric album asset id has to reach this component as '5'.
function isExisting(p: Photo): boolean {
  return props.existingIds.has(String(p.id))
}

// submitLabel may be a function of the selected count (both album paths: "Add (2)") or a fixed
// string (moments: "Add selected") — see deviation (b) in the header.
const submitText = computed(() =>
  typeof props.submitLabel === 'function' ? props.submitLabel(selected.value.size) : props.submitLabel,
)
function isSelected(p: Photo): boolean {
  return selected.value.has(p.id)
}
function thumb(id: string | number): string {
  return service.photos.thumbnailUrl(id, 'small')
}

function toggle(p: Photo): void {
  if (isExisting(p)) return
  const next = new Set(selected.value)
  if (next.has(p.id)) next.delete(p.id)
  else next.add(p.id)
  selected.value = next
}

function closeNow(): void {
  emit('update:open', false)
}

// 点取消 / 点遮罩:有未保存选择 → 先出确认条;无选择 → 直接关闭。
function attemptClose(): void {
  if (selected.value.size > 0) {
    discardConfirm.value = true
  } else {
    closeNow()
  }
}
function cancelDiscard(): void {
  discardConfirm.value = false
}
function confirmDiscard(): void {
  discardConfirm.value = false
  closeNow()
}

// Esc 分层,document 级监听(不用模板 @keydown.esc)—— 同 T5 AlbumPickerDialog.vue 与
// PhotoLightbox.vue:119-139 的既有范式:模板绑定的 keydown 依赖真实 DOM 焦点,用户从触发
// 按钮打开面板、不点面板内部直接按 Esc 时事件到不了面板内的元素。确认条展开时 Esc 只收起
// 确认条(不强制关闭面板——放弃选择必须显式点确认按钮,同 attemptClose 的安全语义一致)。
//
// 终审必修 1(统一防御):本组件目前没有被灯箱层叠挂载,但同一份「document 先冒泡关面板、
// 原生 keydown 默认继续冒泡到 window」的风险与 AlbumPickerDialog.vue 完全一致——未来一旦
// 有宿主把它叠在灯箱之上打开(同款用法迟早出现),同样会把灯箱一起误关。这里同步补上
// stopPropagation,不等真的踩到才修。
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (discardConfirm.value) {
    cancelDiscard()
    return
  }
  attemptClose()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      selected.value = new Set()
      discardConfirm.value = false
      // Task 8b (owner ruling): in bucket mode `months` arriving does not mean any photos
      // are in hand yet -- this grid reads timeline.allPhotos (via `flat` above), so
      // without this the picker would open on an empty grid even though the directory says
      // the library isn't empty. Load the newest few months up front; fetchNewestBuckets is
      // a no-op outside bucket mode, so legacy behaviour is unchanged. Scrolling to the
      // bottom (onListScroll below) pages in earlier months as the user asks for them.
      //
      // fetchNewestBuckets must wait for fetchTimeline to resolve first when the latter is
      // needed -- firing both in parallel would read bucketMode before the probe that sets
      // it has had a chance to run, silently no-op'ing on every fresh mount.
      const needsTimeline = timeline.months.length === 0
      void (async () => {
        if (needsTimeline) await timeline.fetchTimeline()
        await timeline.fetchNewestBuckets(3)
        // Whole-branch review fix (minor 12): paging used to happen ONLY on a
        // `scroll` event, so a library whose three newest months fit inside the
        // panel never fired one and every earlier month was unreachable — the
        // picker looked like the library ended three months ago. If the list does
        // not overflow there is nothing for the user to scroll, so keep pulling
        // months in until it does (or until the library runs out).
        await fillViewport()
      })()
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

// Task 8b (owner ruling, second half): in bucket mode this grid only ever holds the
// already-loaded buckets. Scrolling near the bottom fetches the next unloaded dated bucket
// so the user can keep paging back through the library instead of the whole thing being
// pulled down at once. `loadingMore` caps it to one in-flight bucket load at a time --
// fetchBucket already dedupes per key, but without this guard one scroll gesture could kick
// off requests for a dozen different buckets before the first one lands.
let loadingMore = false
// Returns false when there was nothing to page in (no unloaded dated bucket left,
// or a load is already in flight), so callers can stop asking.
async function pageInNextBucket(): Promise<boolean> {
  if (loadingMore) return false
  const next = timeline.buckets.find(
    (b) => !(b.year === 0 && b.month === 0) && !timeline.bucketAssets.has(bucketKey(b)),
  )
  if (!next) return false
  loadingMore = true
  try {
    await timeline.fetchBucket(bucketKey(next))
  } finally {
    loadingMore = false
  }
  return true
}

async function onListScroll(e: Event): Promise<void> {
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight > 200) return
  await pageInNextBucket()
}

// A panel that cannot scroll gives the user no way to ask for more (minor 12).
// Capped so a run of months that add no tiles (all-video months on a photo-only
// list, an empty bucket) cannot turn into an unbounded walk back through the
// library — the user can still scroll for the rest.
const MAX_AUTO_FILL_PAGES = 10
async function fillViewport(): Promise<void> {
  for (let i = 0; i < MAX_AUTO_FILL_PAGES; i++) {
    await nextTick()
    const el = bodyRef.value
    if (!el) return
    // Not laid out (clientHeight 0 — a closed/hidden panel, and everything in
    // jsdom): whether it overflows is unknowable, so decide nothing.
    if (el.clientHeight === 0) return
    if (el.scrollHeight > el.clientHeight) return // scrollable now: the user drives
    if (!(await pageInNextBucket())) return // nothing left to page in
  }
}

// Handing over the picked ids is where this component's job ends: the write, the success and
// failure toasts and the closing all belong to the caller (see the Step 0 note in the header).
// Neither `selected` nor `open` is touched here — on a failed write the caller leaves the panel
// up, and the user's selection is still sitting in it, ready to resubmit.
function confirmAdd(): void {
  if (selected.value.size === 0 || props.submitting) return
  emit('confirm', Array.from(selected.value))
}
</script>

<template>
  <div
    v-if="open"
    class="picker-scrim"
    data-test="lib-picker-overlay"
    @click.self="attemptClose"
  >
    <div class="picker-modal">
      <div class="picker-head">
        <div class="picker-head-text">
          <div class="picker-title">{{ title }}</div>
          <div class="picker-sub">{{ t('photosSelectedCount', { count: selected.size }) }}</div>
        </div>
        <button
          type="button"
          class="picker-close"
          data-test="lib-picker-close"
          :aria-label="t('photosCancel')"
          @click="attemptClose"
        >&#215;</button>
      </div>

      <div ref="bodyRef" class="picker-body" @scroll="onListScroll">
        <div v-if="flat.length === 0" class="picker-empty" data-test="lib-picker-empty">
          {{ t('photosAlbumPickerEmpty') }}
        </div>
        <div v-else class="picker-grid">
          <div
            v-for="p in flat"
            :key="p.id"
            class="picker-tile"
            data-test="lib-picker-tile"
            :data-asset-id="p.id"
            :data-selected="isSelected(p)"
            :data-disabled="isExisting(p)"
            @click="toggle(p)"
          >
            <img :src="thumb(p.id)" alt="">
            <div v-if="isExisting(p)" class="picker-already" data-test="lib-picker-already">
              <span class="picker-already-icon">&#10003;</span>
              <span>{{ existingLabel }}</span>
            </div>
            <div v-else-if="isSelected(p)" class="picker-tile-check" data-test="lib-picker-selected-check">&#10003;</div>
          </div>
        </div>
      </div>

      <div v-if="!discardConfirm" class="picker-foot">
        <button type="button" class="albums-btn-ghost" data-test="lib-picker-cancel" @click="attemptClose">
          {{ t('photosCancel') }}
        </button>
        <button
          type="button"
          class="albums-btn-cta"
          data-test="lib-picker-add"
          :disabled="selected.size === 0 || submitting"
          @click="confirmAdd"
        >
          {{ submitting ? t('photosAlbumPickerAdding') : submitText }}
        </button>
      </div>
      <div v-else class="picker-discard" data-test="lib-picker-discard-bar">
        <div class="picker-discard-text">{{ t('photosAlbumPickerDiscard') }}</div>
        <div class="picker-discard-actions">
          <button type="button" class="albums-btn-ghost" data-test="lib-picker-discard-cancel" @click="cancelDiscard">
            {{ t('photosCancel') }}
          </button>
          <button type="button" class="albums-btn-cta" data-test="lib-picker-discard-confirm" @click="confirmDiscard">
            {{ t('photosAlbumPickerDiscardConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Task 7(两 picker 类名工程):scrim/modal/head/title/sub/body/empty/grid/tile(+[data-selected]/
   [data-disabled]/嵌套 img)/tile-check/foot 与已导入的全局 parity 样式表
   (src/photos/styles/vue2-parity/photos.scss:4277-4341 `.picker-*`,裸顶层选择器,不挂
   `.photos-root` 前缀——这批是 Vue2 原生 class 名,已用 class-collision-guard.test.ts 钉死
   零跨区冲突)逐字同名——全部删除本地重复声明,直接让 parity 接管。foot 的两个按钮同样直接
   复用 parity 已有的 `.albums-btn-ghost`/`.albums-btn-cta`(Vue2 源 PhotosLibraryPicker.vue
   :40/:42 就是这两个 class,PhotosAlbums.vue 的 New Album 弹层同一套复用先例),不再各自维护
   一份等价的 ghost/cta 按钮样式。 */

/* 头部文字容器——Vue2 是行内 style="flex:1;min-width:0" 的无 class div(:6),parity 自然
   没有对应选择器,这里补一个类名只为可读性,规则原样保留。 */
.picker-head-text { flex: 1 1 auto; min-width: 0; }

/* 头部 X 关闭按钮——Vue2 用全站通用 .icon-btn + photos-icon 组件(:10-12),本仓这批弹层
   一贯改用更小的 24px 专属关闭按钮类而不复用 .icon-btn(同 AlbumPickerDialog.vue
   `.album-picker-close`、MergeReviewDialog.vue `.mrd-close`、ClusterActionDialog.vue
   `.cad-close` 的既有范式),parity 无对应选择器可比对。 */
.picker-close {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.picker-close:hover { background: var(--surface-3); color: var(--text-1); }

/* 瓦片内的 <img> 不再单独挂 class——parity 的 .picker-tile 内嵌 `img { … }`(SCSS 嵌套编译为
   `.picker-tile img`)本就对任意 img 子元素生效,同 Vue2 原生 <img>(:28,同样无 class)。
   「已在相册中」的变暗效果也交给 parity 的 .picker-tile[data-disabled="true"]{opacity:.4;
   pointer-events:none}(作用于整个瓦片,含下面的徽标覆盖层),不再局部只暗淡 img 一处——这样
   与 Vue2 实际渲染(整瓦片一起变暗)更贴合,也去掉了原来 img 专属的 is-dimmed 局部规则。 */

/* 「已在相册中」提示——Vue2(:29-31)与 parity(.picker-tile-existing)都只是右上角一个
   18px 圆形图标徽标,悬停靠原生 title 属性文字提示。本组件是有意的功能增补:existingLabel
   文案常驻可见(而非仅悬停可见),覆盖整个瓦片——这是已有测试锁定的行为(
   PhotosLibraryPicker.test.ts 断言 tile.text() 包含 existingLabel 原文),不能收敛成
   parity 的纯图标徽标。因此不复用 parity 的 `.picker-tile-existing` 这个名字(语义/尺寸都
   不同,同名会与 parity 规则打架),改用不冲突的 `.picker-already` 系列,保留原有视觉。 */
/* Fix-2 item 6 (owner acceptance, 2026-08-13): `color` used to be `var(--text-1)` -- a
   *parity*-scoped token that correctly flips dark under `.photos-root.is-light`, sitting on
   `--overlay-bg`, a *global* token that stays a dark tint in both of New-UI's own themes
   (theme.css:274/408, both a translucent dark navy/warm fill, deliberately invariant since a
   tile-covering scrim needs to read against unpredictable photo pixels underneath, not the
   app's own theme). In photos light mode the pairing was dark-on-dark: the background stayed
   dark (correctly) but the text went dark too (incorrectly, chasing the private is-light flip
   the background doesn't follow). Pinned to a literal white instead, matching this repo's own
   established convention for exactly this shape (thumbnail-overlay text needs constant
   contrast regardless of theme -- same call PhotosTrash.vue's `.tile-fav`/`.tile-vid` badges
   and PhotosSmartViewDetail.vue's `.sv-toast` already make, each with their own
   theme-exception comment). */
.picker-already {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: var(--overlay-bg);
  color: #fff; /* theme-exception: overlays unpredictable photo pixels, same as --overlay-bg above */
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  padding: 0 4px;
}
.picker-already-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  /* Vue2 勾选图标是 color="white"—— 改用 --on-accent(atop 纯色 accent 填充的可读前景色
     语义 token),而不是写死颜色字面量。 */
  color: var(--on-accent);
  font-size: 11px;
  line-height: 1;
}

/* .picker-tile-check(选中态右上角勾选徽标)与 parity 的 .picker-tile-check 同名同义
   (Vue2 :32-34 就是同一个 class)—— 本地覆盖已删除,位置/尺寸/背景色全交给 parity。 */

.picker-discard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--line);
  flex: 0 0 auto;
}
.picker-discard-text { font-size: 12.5px; color: var(--text-1); flex: 1 1 auto; min-width: 0; }
.picker-discard-actions { display: flex; gap: 8px; flex: 0 0 auto; }
</style>
