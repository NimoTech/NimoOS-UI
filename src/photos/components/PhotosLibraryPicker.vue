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
import { computed, onUnmounted, ref, watch } from 'vue'
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
async function onListScroll(e: Event): Promise<void> {
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight > 200) return
  if (loadingMore) return
  const next = timeline.buckets.find(
    (b) => !(b.year === 0 && b.month === 0) && !timeline.bucketAssets.has(bucketKey(b)),
  )
  if (!next) return
  loadingMore = true
  try {
    await timeline.fetchBucket(bucketKey(next))
  } finally {
    loadingMore = false
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
    class="lib-picker-overlay"
    data-test="lib-picker-overlay"
    @click.self="attemptClose"
  >
    <div class="lib-picker-panel">
      <div class="lib-picker-head">
        <div class="lib-picker-head-text">
          <div class="lib-picker-title">{{ title }}</div>
          <div class="lib-picker-sub">{{ t('photosSelectedCount', { count: selected.size }) }}</div>
        </div>
        <button
          type="button"
          class="lib-picker-close"
          data-test="lib-picker-close"
          :aria-label="t('photosCancel')"
          @click="attemptClose"
        >&#215;</button>
      </div>

      <div class="lib-picker-body" @scroll="onListScroll">
        <div v-if="flat.length === 0" class="lib-picker-empty" data-test="lib-picker-empty">
          {{ t('photosAlbumPickerEmpty') }}
        </div>
        <div v-else class="lib-picker-grid">
          <div
            v-for="p in flat"
            :key="p.id"
            class="lib-picker-tile"
            data-test="lib-picker-tile"
            :data-asset-id="p.id"
            :data-selected="isSelected(p)"
            :data-disabled="isExisting(p)"
            @click="toggle(p)"
          >
            <img :src="thumb(p.id)" alt="" class="lib-picker-tile-img" :class="{ 'is-dimmed': isExisting(p) }">
            <div v-if="isExisting(p)" class="lib-picker-already" data-test="lib-picker-already">
              <span class="lib-picker-already-icon">&#10003;</span>
              <span>{{ existingLabel }}</span>
            </div>
            <div v-else-if="isSelected(p)" class="lib-picker-check" data-test="lib-picker-selected-check">&#10003;</div>
          </div>
        </div>
      </div>

      <div v-if="!discardConfirm" class="lib-picker-foot">
        <button type="button" class="lib-picker-btn-ghost" data-test="lib-picker-cancel" @click="attemptClose">
          {{ t('photosCancel') }}
        </button>
        <button
          type="button"
          class="lib-picker-btn-cta"
          data-test="lib-picker-add"
          :disabled="selected.size === 0 || submitting"
          @click="confirmAdd"
        >
          {{ submitting ? t('photosAlbumPickerAdding') : submitText }}
        </button>
      </div>
      <div v-else class="lib-picker-discard" data-test="lib-picker-discard-bar">
        <div class="lib-picker-discard-text">{{ t('photosAlbumPickerDiscard') }}</div>
        <div class="lib-picker-discard-actions">
          <button type="button" class="lib-picker-btn-ghost" data-test="lib-picker-discard-cancel" @click="cancelDiscard">
            {{ t('photosCancel') }}
          </button>
          <button type="button" class="lib-picker-btn-cta" data-test="lib-picker-discard-confirm" @click="confirmDiscard">
            {{ t('photosAlbumPickerDiscardConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lib-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 230;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
}

/* P2 血泪(同 T5 沿用):面板底色须用 --popup-bg,不用 --card-bg(深色主题下 --card-bg
   近透明,叠在暗底上会看穿)。 */
.lib-picker-panel {
  width: min(760px, 100%);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--card-shadow-hi);
  overflow: hidden;
}

.lib-picker-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--divider);
  flex: 0 0 auto;
}
.lib-picker-head-text { flex: 1 1 auto; min-width: 0; }
.lib-picker-title { font-size: 14.5px; font-weight: 600; color: var(--fg); }
.lib-picker-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }

/* 头部 X 关闭按钮(评审补漏:Vue2 :10-12 确有,brief 结构清单漏列)—— 写法照
   AlbumPickerDialog.vue 的 .alb-picker-close 既有范式,不引 Vue2 的 photos-icon 组件。 */
.lib-picker-close {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--fg-muted);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lib-picker-close:hover { background: var(--chip-bg-hi); color: var(--fg); }

.lib-picker-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 18px; }
.lib-picker-empty { padding: 48px 8px; color: var(--fg-muted); font-size: 12.5px; text-align: center; }

.lib-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 6px;
}

.lib-picker-tile {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: var(--chip-bg);
  outline: 2px solid transparent;
  transition: outline-color 0.15s ease, transform 0.15s ease;
}
.lib-picker-tile[data-selected="true"] { outline-color: var(--accent); transform: scale(0.96); }
.lib-picker-tile[data-disabled="true"] { cursor: default; }

.lib-picker-tile-img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* 0.4 与 Vue2 photos.scss :4402 的 [data-disabled="true"] { opacity: 0.4 } 保持像素级一致。 */
.lib-picker-tile-img.is-dimmed { opacity: 0.4; }

/* 覆盖标记:满铺半透明遮罩 + 文案。--overlay-bg/--fg 这一组合已在 PhotosGrid.vue 的
   .tile-fav 上验证过(深浅主题都可读),这里沿用而非另造新 token。 */
.lib-picker-already {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: var(--overlay-bg);
  color: var(--fg);
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  padding: 0 4px;
}
.lib-picker-already-icon,
.lib-picker-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  /* Vue2 勾选图标是 color="white"(:30/:33)—— 改用 --on-accent(atop 纯色 accent 填充
     的可读前景色语义 token),而不是写死颜色字面量。 */
  color: var(--on-accent);
  font-size: 11px;
  line-height: 1;
}
.lib-picker-check {
  position: absolute;
  top: 6px;
  right: 6px;
}

.lib-picker-foot {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 12px 18px;
  border-top: 1px solid var(--divider);
  flex: 0 0 auto;
}

.lib-picker-discard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--divider);
  flex: 0 0 auto;
}
.lib-picker-discard-text { font-size: 12.5px; color: var(--fg); flex: 1 1 auto; min-width: 0; }
.lib-picker-discard-actions { display: flex; gap: 8px; flex: 0 0 auto; }

.lib-picker-btn-ghost {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.lib-picker-btn-ghost:hover { background: var(--chip-bg-hi); }

.lib-picker-btn-cta {
  padding: 8px 16px;
  border-radius: 10px;
  border: 0;
  background: var(--accent);
  color: var(--on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.lib-picker-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
