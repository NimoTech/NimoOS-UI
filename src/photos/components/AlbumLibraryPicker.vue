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
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosAlbums } from '../stores/albums'
import { useTimelineStore } from '../stores/timeline'
import { useToast } from '../../stores/toast'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ open: boolean; albumId: string | number; albumName: string }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'added', count: number): void
}>()

const { t } = useI18n()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const toast = useToast()

// 选中集合直接存 flat 里给出的原始 id(与 flat 同源,类型天然一致,无需归一);
// 提交时原样传给 addAssetsToAlbum,不做类型转换。
const selected = ref<Set<string | number>>(new Set())
const adding = ref(false)
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
const existingIds = computed(() => new Set(albums.assetsOf(props.albumId).map((p) => String(p.id))))

function isExisting(p: Photo): boolean {
  return existingIds.value.has(String(p.id))
}
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
      adding.value = false
      if (timeline.months.length === 0) void timeline.fetchTimeline()
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

async function confirmAdd(): Promise<void> {
  if (selected.value.size === 0 || adding.value) return
  adding.value = true
  const ids = Array.from(selected.value)
  const count = ids.length
  try {
    await albums.addAssetsToAlbum(props.albumId, ids)
    toast.show(t('photosAlbumAddedToast', { count, name: props.albumName }))
    emit('added', count)
    closeNow()
  } catch (e) {
    console.error('[album-library-picker] addAssetsToAlbum', e)
    toast.show(t('photosAlbumAddFailed'))
    // 失败不关闭面板;已选中项保留(selected 不清空);adding 复位由 finally 处理。
  } finally {
    adding.value = false
  }
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
          <div class="lib-picker-title">{{ t('photosAlbumPickerTitle', { name: albumName }) }}</div>
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

      <div class="lib-picker-body">
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
              <span>{{ t('photosAlbumPickerAlready') }}</span>
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
          :disabled="selected.size === 0 || adding"
          @click="confirmAdd"
        >
          {{ adding ? t('photosAlbumPickerAdding') : t('photosAlbumPickerAdd', { count: selected.size }) }}
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
