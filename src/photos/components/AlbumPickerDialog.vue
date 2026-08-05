<script setup lang="ts">
// Task 5 (SP7-P4 相册): 「加入相册」选择器 —— 被三处宿主复用(时间线批量工具栏 / 收藏视图 /
// 灯箱顶栏,T9 接线)。结构照 Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:1040-1065
// 的相册选择覆盖层(遮罩+面板+列表+「+ New Album」行),行为照 :582-607(onBatchAlbum/
// pickAlbum/createAndPickAlbum)。
//
// 形态偏离登记(范围收口,brief 明确要求):Vue2 用 window.prompt 收集新相册名;本仓无
// prompt 惯例且窄屏体验差,改为面板内联输入行(回车提交/Esc 收起),行为语义不变。
//
// 关键与 Vue2 的语义差异(brief 明确、非疏漏):失败路径不关闭面板 —— Vue2 的
// createAndPickAlbum 只 console.error 吞掉异常,本组件改为 toast 失败文案且保持面板打开
// (含新建输入行保留内容),这样用户能看到失败原因并重试,而不是静默无反应。
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosAlbums } from '../stores/albums'
import { albumToView } from '../util/albumView'
import { isConflict } from '../util/httpErrors'
import { useToast } from '../../stores/toast'

const props = defineProps<{ open: boolean; assetIds: Array<string | number> }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'added', albumId: string | number, count: number): void
}>()

const { t } = useI18n()
const albums = usePhotosAlbums()
const toast = useToast()

const creating = ref(false)
const newName = ref('')
const newInputRef = ref<HTMLInputElement | null>(null)

// 终审必修 2:重入守卫。`creating` 只是「输入行是否展开」的显示标志,不是 in-flight 守卫——
// 两个独立的异步入口各自需要一个:`adding` 挡 pick()(连点同一相册项重复 addAssetsToAlbum),
// `submitting` 挡 submitCreate()(连按回车重复 createAlbum)。刻意不共用同一个 ref——
// submitCreate 成功后会内部调用 pick(),若两者共享一个标志,submitCreate 置位后 pick() 的
// 守卫会把这次内部调用也一并挡掉(createAlbum 成功了却漏掉紧跟着的 addAssetsToAlbum,
// 现有「创建后加入」流程会被自己的重入守卫误伤)。这是本期第三次出现的同类 bug(T7
// PhotosAlbums.vue `creating`、T10 PhotosFavorites.vue `saveAlbumSaving` 均已补过守卫),
// 四个新建入口里本组件是最后一个补齐的。
const adding = ref(false)
const submitting = ref(false)

// 铁律:id 比较一律 String() 归一,禁对象引用 ===。
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

const views = computed(() => albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))))
// assetIds 为空时不但已有相册项要 disabled(brief 明确要求),「+ 新建相册」入口也同样
// disabled——否则 createAlbum 这个有持久副作用的操作会执行(真建了个相册),但紧接着的
// pick() 被这同一个 canSubmit 短路掉,用户对着还在的输入行毫无反馈(评审 Minor 2)。
const canSubmit = computed(() => props.assetIds.length > 0)

function thumb(cover: string | number): string {
  return service.photos.thumbnailUrl(cover, 'small')
}

function close(): void {
  emit('update:open', false)
}

// Esc 分层,document 级监听(不用模板 @keydown.esc)—— 评审指出的功能性 bug:模板绑定的
// keydown 依赖真实 DOM 焦点落在 overlay/input 上,但用户从面板外的触发按钮打开面板、不点
// 面板内部直接按 Esc 时,焦点还停在触发按钮上,事件永远到不了 overlay,面板就关不掉;第一次
// Esc 收起输入行后 input 被 v-else 卸载、焦点回落到 body,第二次 Esc 同样断链。照
// PhotosSidebar.vue:22-27 / PhotoLightbox.vue:119-140 的既有范式改为 document 监听,
// 由 watch(open) 负责挂/摘,onUnmounted 兜底摘干净。
//
// 终审必修 1:本组件常被灯箱(T9)在其顶栏「加入相册」按钮打开,灯箱自己在 window 上挂了
// 一个 keydown(PhotoLightbox.vue:144)。原生 keydown 默认冒泡(bubbles:true),冒泡顺序是
// document 先于 window——不加 stopPropagation 的话,这里关完面板,同一次 Esc 接着冒泡到
// window 又把灯箱也关了(T9 设计明确「灯箱本身不关闭」,PhotoLightbox.vue:51-52 注释)。
// 在 document 阶段挡住,不让它继续冒泡到 window 即可。
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (creating.value) cancelCreate()
  else close()
}

// 照 Vue2 onBatchAlbum:584 —— 打开前刷新相册列表;Vue2 未 await 不阻塞渲染,这里同样。
// immediate:true——宿主(T9)可能把本组件常驻挂载、只切换 open prop,也可能在已 open===true
// 时才挂载;两种情况都要在"可见"这一刻刷新列表,不只是 false→true 的那一次变化。
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void albums.fetchAlbums()
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      creating.value = false
      newName.value = ''
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

async function pick(albumId: string | number): Promise<void> {
  if (!canSubmit.value || adding.value) return
  adding.value = true
  const view = views.value.find((v) => sameId(v.id, albumId))
  const name = view?.title ?? t('photosAlbumUntitled')
  const count = props.assetIds.length
  try {
    await albums.addAssetsToAlbum(albumId, props.assetIds)
    emit('added', albumId, count)
    toast.show(t('photosAlbumAddedToast', { count, name }))
    close()
  } catch {
    toast.show(t('photosAlbumAddFailed'))
    // 面板保持打开——不 close()。
  } finally {
    adding.value = false
  }
}

function startCreate(): void {
  creating.value = true
  newName.value = ''
  void nextTick(() => newInputRef.value?.focus())
}

function cancelCreate(): void {
  creating.value = false
}

async function submitCreate(): Promise<void> {
  const name = newName.value.trim()
  if (!name || submitting.value) return
  submitting.value = true
  try {
    const created = await albums.createAlbum(name)
    await pick(created.id as string | number)
    // pick 成功会自己 close();若 pick 内部失败(addAssetsToAlbum 抛错),pick 已经
    // toast 了失败文案且不关面板——这里不重复处理,创建本身是成功的。pick() 内部用的是
    // 独立的 `adding` 守卫,不受这里 `submitting` 已置位影响,两次真实网络调用都会照常发生。
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumCreateFailed'))
    // 面板不关,输入行保留内容(newName 不清空)。
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="alb-picker-overlay"
    data-test="album-picker-overlay"
    @click.self="close"
  >
    <div class="alb-picker-panel">
      <div class="alb-picker-head">
        <span class="alb-picker-title-text">{{ t('photosAddToAlbumTitle') }}</span>
        <button type="button" class="alb-picker-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <div class="alb-picker-body">
        <div v-if="views.length === 0" class="alb-picker-empty" data-test="album-picker-empty">
          {{ t('photosAddToAlbumEmpty') }}
        </div>

        <button
          v-for="v in views"
          :key="v.id"
          type="button"
          class="alb-picker-item"
          data-test="album-picker-item"
          :disabled="!canSubmit"
          @click="pick(v.id)"
        >
          <span v-if="v.cover" class="alb-picker-cover">
            <img :src="thumb(v.cover)" alt="">
          </span>
          <span v-else class="alb-picker-cover alb-picker-cover-empty" data-test="album-picker-cover-empty"></span>
          <span class="alb-picker-info">
            <span class="alb-picker-item-title">{{ v.title }}</span>
            <span class="alb-picker-item-count">{{ t('photosItemsCount', { count: v.count }) }}</span>
          </span>
        </button>

        <button
          v-if="!creating"
          type="button"
          class="alb-picker-item alb-picker-new"
          data-test="album-picker-new"
          :disabled="!canSubmit"
          @click="startCreate"
        >
          {{ t('photosAddToAlbumNew') }}
        </button>
        <div v-else class="alb-picker-new-row">
          <input
            ref="newInputRef"
            v-model="newName"
            type="text"
            class="alb-picker-new-input"
            data-test="album-picker-new-input"
            @keydown.enter="submitCreate"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alb-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 230;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

/* P2 血泪:面板底色须用 --popup-bg,不用 --card-bg(深色主题下 --card-bg 近透明,叠在暗底
   上会看穿)。 */
.alb-picker-panel {
  width: 340px;
  max-width: 100%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--card-shadow-hi);
  overflow: hidden;
}

.alb-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--divider);
  flex: 0 0 auto;
}
.alb-picker-title-text { font-size: 14.5px; font-weight: 600; color: var(--fg); }
.alb-picker-close {
  width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.alb-picker-close:hover { background: var(--chip-bg-hi); color: var(--fg); }

.alb-picker-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px; }

.alb-picker-empty { padding: 20px 8px; color: var(--fg-muted); font-size: 12.5px; text-align: center; }

.alb-picker-item {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 8px; border: 0; border-radius: 10px; background: transparent;
  color: var(--fg); font: inherit; text-align: left; cursor: pointer;
}
.alb-picker-item:hover { background: var(--chip-bg-hi); }
.alb-picker-item:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.alb-picker-cover {
  flex: 0 0 auto; width: 40px; height: 40px; border-radius: 8px; overflow: hidden;
  border: 1px solid var(--card-border); background: var(--chip-bg);
}
.alb-picker-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.alb-picker-cover-empty { background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); }

.alb-picker-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.alb-picker-item-title { font-size: 13px; font-weight: 500; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alb-picker-item-count { font-size: 11px; color: var(--fg-muted); }

.alb-picker-new { color: var(--accent-text); font-size: 13px; font-weight: 500; }

.alb-picker-new-row { padding: 8px; }
.alb-picker-new-input {
  width: 100%; height: 34px; padding: 0 10px; border-radius: 8px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
  font: inherit; font-size: 13px;
}
.alb-picker-new-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
