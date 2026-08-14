<script setup lang="ts">
// SP7-P7a-T5: SmartViewCreateDialog.vue —— 智能视图创建弹窗(本期最大的单个组件)。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewsView.vue:42-182(模板)、
// :359-436(方法,含 SV_QUICK_TEMPLATES/inferChips 已被 T1 抽到 smartViewSuggest.ts)、
// photos-smartview.scss:659-1013 + 574-605(.sv-toggle-row/.sv-switch,brief 读区间
// 没盖到,回源核实际定义补读)移植。宿主挂载点:PhotosSmartViews.vue(T4)。
//
// 常驻挂载 + prop 显隐(本组件不会因 v-if 卸载重建),因此一切"打开时应重置/联动"的逻辑
// 必须挂在 `watch(() => props.open)`,不能用 onMounted(本区第三次同型「持久挂载坑」——
// 前两次是 P2 的 isMoving 自隐与视频 startMs 锚点)。
//
// ── 回源核对与偏离登记(逐条见 task-5-report.md,这里只留代码旁必须就近可见的几条)──
//
// 1) `.sv-modal-icon` 尺寸:brief 结构规格第 2 条写"28×28",回源 scss:690-691 实际是
//    32×32——以真源为准,brief 这条记错了。
// 2) `.sv-modal-icon` 背景由 Vue2 的写死紫渐变
//    (linear-gradient(135deg, var(--accent), var(--accent-hi)))改成 var(--accent) 实底后,
//    前景满足"背景确为 --accent 饱和实底"的条件,合法使用 --on-accent(brief 控制器补充
//    2 点名的那处)。
// 3) `--on-accent` 在本组件其实还合法用于两处,不止 brief 说的"唯一"(fix round 1 · I3
//    评审逐处核实,实现不用改,只改了论证依据——原注释误引了本分支不存在的文件):
//    a) `.sv-switch[data-on="true"]::after`(开关滑块在 data-on=true 时同样叠在
//       var(--accent) 实底上)——`role="switch"` 是本分支第一次使用(grep 全仓只命中
//       这两行),没有分支内先例;这里 `--on-accent` 的合法性由紧邻的
//       `.sv-switch[data-on="true"] { background: var(--accent) }` 自证(实底、不是
//       渐变/半透明),不依赖任何外部先例。
//    b) `.sv-btn-primary`(background: var(--accent); color: var(--on-accent))——
//       与本仓既有 primary 按钮先例同构:`ClusterActionDialog.vue:320`、
//       `MergeReviewDialog.vue:262`(这两个文件在本分支真实存在,已核实)。
//    brief Step1 那句"其余压照片的元素本组件没有"实际是在说"没有其余压在照片/渐变之上
//    需要 theme-exception 钉死浅色的前景"——本组件确实没有任何元素叠在照片(仅
//    `.sv-preview-grid img` 是纯图,无覆盖文字)或渐变之上,这条没问题;但把该句解读成
//    "全组件只允许一处 --on-accent"过窄,不构成词面上的矛盾,只是该句本身未穷举。
//    已在报告里登记这条与 brief 的出入。
// 4) 窄屏断点:brief 写"Vue2 零 @media,≤768px 是偏离新增"——回源 scss:1018-1022 实际
//    已有 `@media (max-width: 760px)`(改 grid-template-columns:1fr + .sv-modal-side 的
//    border-left→border-top),brief 这条也记错了(不是偏离,是 1:1 移植;只是断点数字
//    对齐本仓同类文件 PhotosSmartViews.vue 已用的 768,而不是 Vue2 字面的 760,这一点是
//    真正的偏离,已登记)。brief 建议再加的 `.sv-modal` 宽度 min(100% - 24px, …)覆盖是
//    多余的——Vue2 的 max-width:100% + 外层 scrim 的 40px/24px padding 已经让弹窗在窄屏下
//    天然收缩,不需要额外覆盖,故未添加。
// 5) `--text-1/2/3/4` 四档映射(brief 的 token 映射表只给了 --surface/--line/scrim/
//    投影,没提文字四档):这里取 --fg / --fg-muted / --fg-faint / --fg-subtle(按深色
//    主题不透明度从高到低排列,--fg-faint 已有既有先例 PersonPlacesTab.vue:201 等),
//    text-1→fg,text-2→fg-muted,text-3→fg-faint,text-4→fg-subtle。
// 6) `--font-display`(Vue2 用于预览计数大字号)本仓没有对应 token,纯排版选择、非颜色,
//    直接省略、继承 --font,不新增 token。
// 7) fix round 1 · M1(此前未申报的偏离,补登记):**Esc 关闭这个浮层是 net-new**——
//    Vue2 这个弹窗完全没有 Esc 处理。document 级监听 + watch(open) 挂/摘的写法照
//    `AlbumPickerDialog.vue`(该文件在本分支真实存在)的既有范式,但"给这个弹窗加 Esc"
//    这件事本身在 Vue2 找不到对应,是本任务主动补的浮层可用性基线(同 Global Constraints
//    §「浮层 Esc 一律 document 级监听」的通例要求),不是照搬,已补测试用例钉住。
//
// 详见 task-5-report.md 的完整节点清点表 + 删码验证 + i18n 回源结论。
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosSmartViews } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import { inferChips, SV_QUICK_TEMPLATES, type QuickTemplate } from '../util/smartViewSuggest'
import PhotosThreshSlider from './PhotosThreshSlider.vue'

const props = withDefaults(defineProps<{
  open: boolean
  // SP15-P2b Task 4 (Vue2 939a7d3a:PhotosSmartAlbumCreate.vue:232-240). Embedded mode is
  // what the Albums page's "Let Nimo draft it" fill option renders in place of its own
  // footer -- the panel body *is* the smart form, instead of opening a second modal.
  embedded?: boolean
  initialName?: string
}>(), { embedded: false, initialName: '' })
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'created', id: string): void
  // Embedded mode only: the host closes its whole panel. Vue2 :322/:325 emits the same
  // 'close' event for every dismissal path (this dialog also has a v-model :open contract
  // for its standalone mount, which Vue2's embedded-only component never had -- 'close' is
  // net-new to carry the "close the whole host panel" meaning 'update:open' can't).
  (e: 'close'): void
}>()

const { t, locale } = useI18n()
const store = usePhotosSmartViews()
const toast = useToast()

// BCP-47 转换(本仓既定写法,照 SmartViewCard.vue:38 等既有先例):本仓 locale 标识是
// 'zh_cn'/'en_us'(下划线),裸传 toLocaleString 会抛 RangeError。
const localeTag = computed(() => locale.value.replace('_', '-'))

interface Draft {
  name: string
  desc: string
  customChip: string
  chips: string[]
  thresh: number
  live: boolean
  includeVideos: boolean
}

// 照 Vue2 _emptyDraft :359-365 逐字段核对:默认阈值 80、live 默认 true。
function emptyDraft(): Draft {
  return { name: '', desc: '', customChip: '', chips: [], thresh: 80, live: true, includeVideos: false }
}

const draft = reactive<Draft>(emptyDraft())
const nameInputRef = ref<HTMLInputElement | null>(null)
// SP15-P2b final fix wave: in embedded mode the name field does not exist (`v-if="!embedded"`
// -- the host panel owns the name), so focusing nameInputRef focused nothing at all and the
// fused create panel opened with no cursor anywhere. The description is the first field the
// user actually fills in there, so it takes the focus instead.
const descInputRef = ref<HTMLTextAreaElement | null>(null)

const templates: readonly QuickTemplate[] = SV_QUICK_TEMPLATES

// 照 Vue2 suggestedChips computed :308-310。
const suggestedChips = computed(() => inferChips(draft.desc).filter((c) => !draft.chips.includes(c)))

// 照 Vue2 threshMuted computed :315-318(连注释一起照搬):空表单不算"阈值失效"，滑块
// 保持可拖动。
const threshMuted = computed(
  () => !store.preview.thresholdActive && (draft.chips.length > 0 || draft.desc.trim().length > 0),
)

// SP15-P2b Task 4 (Vue2 PhotosSmartAlbumCreate.vue :271-273): embedded mode reads the
// host's Album name field live rather than copying it into the draft on open. Vue2
// :237-239 explains why -- a one-time seed leaves the user stuck if they pick the nimo
// option before typing a name: the host field keeps being the single source of truth.
const effectiveName = computed(() => (props.embedded ? props.initialName : draft.name).trim())

// 照 Vue2 canSubmit computed :319-322,name 判据换成 effectiveName(Task 4)。
const canSubmit = computed(
  () => effectiveName.value.length > 0 && (draft.chips.length > 0 || draft.desc.trim().length > 0),
)

// 照 Vue2 refreshPreview 的调用形态,description 在送出前 trim(Vue2 :372 在 store 方法
// 内部 trim,这里同样在唯一的触发口处理,不在每个调用点各自 trim)。
function triggerPreview(): void {
  store.refreshPreview({
    conds: [...draft.chips],
    description: draft.desc.trim(),
    threshold: draft.thresh,
    includeVideos: draft.includeVideos,
  })
}

// SP15-P2b Task 4 review fix round 1 · Important: this was a single embedded/standalone
// branch duplicated in two places (here and inline in confirm()'s success handler). The
// duplication is what let the Cancel path go untested -- the two copies could drift
// independently, and one review pass only exercised confirm()'s copy. One function, both
// callers route through it now.
//
// Vue2 :325 onScrimClick: in embedded mode the host panel owns dismissal -- it has the
// scrim, the Cancel button and the Escape handler. Emitting update:open from here would
// close the smart form while leaving the host panel open around an empty hole, so embedded
// mode asks the host to close everything instead.
function dismiss(): void {
  if (props.embedded) {
    emit('close')
  } else {
    emit('update:open', false)
  }
}

// SP15-P2b Task 4: the host panel owns the scrim in embedded mode (it has no scrim of
// its own to click through to), so a self-click on this component's own root must be a
// no-op there. Standalone mode is unchanged: click.self on the scrim closes as before.
function onRootClick(): void {
  if (!props.embedded) dismiss()
}

// 浮层 Esc 走 document 级监听 + watch(open) 挂/摘(P4 血泪，AlbumPickerDialog.vue 既有
// 范式)。本组件只有一层浮层，没有"多浮层同开"的早退顾虑。
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  dismiss()
}

// 控制器补充 1 的核心:open 变真时重置 draft + 聚焦 + refreshPreview，必须挂在
// watch(() => props.open) 而不是 onMounted——本组件是常驻挂载、靠 v-if 显隐，onMounted
// 只在组件创建时跑一次，第二次打开不会重新触发。
// 关闭时（控制器补充 3 的路径 ①，store 已加 cancelPreview）：清掉尚未触发的防抖定时器 +
// 让已在途的响应作废，避免关闭后姗姗来迟的响应覆盖下一次打开的预览。
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      Object.assign(draft, emptyDraft())
      // SP15-P2b Task 4: Escape belongs to the host in embedded mode -- the host's own
      // document keydown handler (PhotosAlbums.vue) closes the whole panel. Attaching this
      // listener too would fire twice / race which one wins. The unconditional
      // removeEventListener calls below and in onUnmounted stay unconditional on purpose
      // (removing a listener that was never added is a no-op; guarding the removal would
      // leak if `embedded` changed mid-life -- the right general rule to keep this file
      // consistent with, even though withDefaults' static default makes it moot here).
      if (!props.embedded) document.addEventListener('keydown', onDocumentKeydown)
      void nextTick(() => (props.embedded ? descInputRef.value : nameInputRef.value)?.focus())
      triggerPreview()
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
      store.cancelPreview()
    }
  },
  { immediate: true },
)
// fix round 1 · M7:组件真的被卸载时(如离开路由,宿主 v-if 掉整个页面),弹窗若还开着
// 且已排好的 300ms 防抖预览请求尚未触发/尚在途,不清的话会成为孤儿请求照常发出
// (Vue2 靠整页 beforeDestroy 里的 clearTimeout 兜住,New-UI 这里补同等效果)。
onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  store.cancelPreview()
})

// 照 Vue2 addChip :392-397。
function addChip(c: string): void {
  const v = (c || '').trim()
  if (!v || draft.chips.includes(v)) return
  draft.chips.push(v)
  triggerPreview()
}

// 照 Vue2 removeChip :398-401。
function removeChip(c: string): void {
  draft.chips = draft.chips.filter((x) => x !== c)
  triggerPreview()
}

// 照 Vue2 addCustom :402-406(含"调两次 refreshPreview"这个字面行为——addChip 内部一次、
// 这里再一次；由于 store.refreshPreview 只是重置防抖定时器，调两次无害，照搬不去重）。
function addCustom(): void {
  addChip(draft.customChip)
  draft.customChip = ''
  triggerPreview()
}

// 照 Vue2 onChipKey :407-412：只有逗号触发（回车走模板的 @keydown.enter.prevent 单独绑定）。
function onChipKey(e: KeyboardEvent): void {
  if (e.key === ',') {
    e.preventDefault()
    addCustom()
  }
}

// fix round 1 · I1:阈值滑块抽成 PhotosThreshSlider.vue(T8/T14 复用),它 emit 的是
// 已经转成 number 的值,这里不再自己从 Event 里取 target.value。
function onThreshInput(v: number): void {
  draft.thresh = v
  triggerPreview()
}

// 照 Vue2 :127:live 开关变更不触发 refreshPreview（确认过不是漏写，照搬不补）。
function toggleLive(): void {
  draft.live = !draft.live
}

// 照 Vue2 :134:includeVideos 开关变更触发 refreshPreview。
function toggleIncludeVideos(): void {
  draft.includeVideos = !draft.includeVideos
  triggerPreview()
}

// 照 Vue2 useTemplate :413-419，但 desc 推断改用 T1 的 descEn（英文原文）而不是 descKey
// （i18n 键名）——POOL 的 kw 是英文关键词，拿键名/中文译文匹配恒不中，这是 T1 已查实的
// 关键契约，不是随意选择。
function useTemplate(row: QuickTemplate): void {
  draft.name = t(row.labelKey)
  draft.desc = t(row.descKey)
  draft.thresh = row.thresh
  draft.chips = inferChips(row.descEn).slice(0, 4)
  triggerPreview()
}

// 照 Vue2 confirmCreate :420-436,但两处刻意不照搬(均已登记):
//  1) id 生成/传递已下沉到 store.createSmartView（T2 fix round 1 · C1），这里不再自己
//     拼 'sv-' + Date.now().toString(36)。
//  2) 失败时 Vue2 是未处理的 rejection（弹窗照关、界面无提示）；这里 catch → toast 且
//     弹窗不关，让用户看得到失败、能重试（同 AlbumPickerDialog.vue submitCreate 的既定
//     处理原则）。
// description 的 `|| undefined` 照搬 Vue2 :431（后端 omitempty 语义，空描述不传字段）。
async function confirm(): Promise<void> {
  if (!canSubmit.value || store.createBusy) return
  try {
    const created = await store.createSmartView({
      name: effectiveName.value,
      description: draft.desc.trim() || undefined,
      conds: [...draft.chips],
      threshold: draft.thresh,
      live: draft.live,
      includeVideos: draft.includeVideos,
    })
    if (created) {
      emit('created', created.id)
      // Routes through the same dismiss() the Cancel button and Escape use -- see its
      // definition above for why this decision must not be duplicated inline here.
      dismiss()
    }
  } catch (e) {
    console.error('[smart-view-create-dialog] confirm', e)
    // 复用既有通用键，本任务不新增 i18n 键（brief 硬约束）。
    toast.show(t('photosAlbumCreateFailed'))
  }
}

// 缩略图一律走共享包生成器，不手拼 URL；智能视图口径固定 'large'(照 Vue2
// `size=large` 查询参数 / SmartViewCard.vue 的既有先例)。
function thumbUrl(seed: string): string {
  return service.photos.thumbnailUrl(seed, 'large')
}
</script>

<template>
  <Transition name="sv-modal">
    <div
      v-if="open"
      :class="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      :data-test="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      @click.self="onRootClick"
    >
      <div class="sv-modal" :class="{ 'sv-modal-embedded': embedded }" :role="embedded ? undefined : 'dialog'" :aria-label="embedded ? undefined : t('photosSvNewSmartView')">
        <div v-if="!embedded" class="sv-modal-head">
          <div class="sv-modal-icon">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          </div>
          <div class="sv-modal-head-text">
            <div class="sv-modal-title">{{ t('photosSvNewSmartView') }}</div>
            <div class="sv-modal-sub">{{ t('photosSvSavedSearchKeepsItself') }}</div>
          </div>
          <button type="button" class="icon-btn" data-test="sv-close-btn" :aria-label="t('photosClose')" @click="dismiss">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="sv-modal-body">
          <div class="sv-modal-form">
            <label v-if="!embedded" class="sv-field">
              <span class="sv-field-label">{{ t('photosSvName') }}</span>
              <input
                ref="nameInputRef"
                v-model="draft.name"
                class="sv-input"
                data-test="sv-name-input"
                :placeholder="t('photosSvEGSaraTokyo')"
                @keydown.enter.prevent="confirm"
              >
            </label>

            <label class="sv-field">
              <span class="sv-field-label">
                {{ t('photosSvNimoMatch') }}
                <span class="sv-field-hint">{{ t('photosSvDescribePlainEnglishConditions') }}</span>
              </span>
              <textarea
                ref="descInputRef"
                v-model="draft.desc"
                class="sv-input sv-textarea"
                data-test="sv-desc-textarea"
                :placeholder="t('photosSvSunsetsSaraOurTokyo')"
                @input="triggerPreview"
              />
            </label>

            <div v-if="suggestedChips.length > 0" class="sv-suggest">
              <div class="sv-suggest-head">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
                {{ t('photosSvNimoSuggests') }}
              </div>
              <div class="sv-suggest-row">
                <button
                  v-for="c in suggestedChips" :key="c" type="button" class="sv-suggest-chip"
                  @click="addChip(c)"
                >
                  + {{ c }}
                </button>
              </div>
            </div>

            <div class="sv-field">
              <span class="sv-field-label">{{ t('photosSvConditions') }}</span>
              <div class="sv-chip-bin" :data-empty="draft.chips.length === 0">
                <span v-for="c in draft.chips" :key="c" class="sv-chip-item">
                  {{ c }}
                  <button
                    type="button" class="sv-chip-x" :aria-label="t('photosSvRemoveCondition')"
                    @click="removeChip(c)"
                  >
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </span>
                <input
                  v-model="draft.customChip"
                  class="sv-chip-input"
                  data-test="sv-chip-input"
                  :placeholder="draft.chips.length ? t('photosSvAddAnother') : t('photosSvTypeConditionEG')"
                  @keydown.enter.prevent="addCustom"
                  @keydown="onChipKey"
                >
              </div>
              <div v-if="draft.chips.length === 0" class="sv-field-hint sv-hint-spaced">
                {{ t('photosSvPressEnterAddPick', { enter: 'Enter' }) }}
              </div>
            </div>

            <div class="sv-field">
              <span class="sv-field-label">
                {{ t('photosSvQualityThreshold') }}
                <span class="sv-thresh-val">&ge; {{ draft.thresh }}%</span>
              </span>
              <PhotosThreshSlider :value="draft.thresh" @input="onThreshInput" />
              <div v-if="threshMuted" class="sv-field-hint sv-hint-spaced">
                {{ t('photosSvCurrentConditionsMatchExactly') }}
              </div>
            </div>

            <div class="sv-toggles">
              <label class="sv-toggle-row sv-toggle-clickable">
                <div class="label">
                  {{ t('photosSvKeepLive') }}
                  <div class="desc">{{ t('photosSvAutoAddMatchesPhotos') }}</div>
                </div>
                <div
                  class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-live"
                  :aria-checked="draft.live" :aria-label="t('photosSvKeepLive')" :data-on="draft.live"
                  @click.prevent="toggleLive" @keydown.enter.prevent="toggleLive" @keydown.space.prevent="toggleLive"
                />
              </label>
              <label class="sv-toggle-row sv-toggle-clickable">
                <div class="label">
                  {{ t('photosSvIncludeVideos') }}
                  <div class="desc">{{ t('photosSvMatchAgainstVideoKeyframes') }}</div>
                </div>
                <div
                  class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-videos"
                  :aria-checked="draft.includeVideos" :aria-label="t('photosSvIncludeVideos')" :data-on="draft.includeVideos"
                  @click.prevent="toggleIncludeVideos" @keydown.enter.prevent="toggleIncludeVideos" @keydown.space.prevent="toggleIncludeVideos"
                />
              </label>
            </div>
          </div>

          <aside class="sv-modal-side">
            <div class="sv-preview-head">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
              {{ t('photosSvLivePreview') }}
            </div>
            <div class="sv-preview-count">
              <b>~{{ store.preview.count.toLocaleString(localeTag) }}</b>
              <span>{{ t('photosSvCandidatesThreshold') }}</span>
            </div>
            <div class="sv-preview-grid">
              <img v-for="s in store.preview.seeds" :key="s" :src="thumbUrl(s)" alt="" loading="lazy">
            </div>
            <div v-if="draft.thresh > 88" class="sv-preview-help">
              {{ t('photosSvStrictOnlyHighestConfidence') }}
            </div>
            <div v-else-if="draft.thresh < 65" class="sv-preview-help">
              {{ t('photosSvLooseExpectSomeFalse') }}
            </div>
            <div v-else class="sv-preview-help">
              {{ t('photosSvBalancedHealthyMixCertainty') }}
            </div>

            <div class="sv-templates">
              <div class="sv-templates-head">{{ t('photosSvStartTemplate') }}</div>
              <button
                v-for="row in templates" :key="row.labelKey" type="button" class="sv-template-row"
                @click="useTemplate(row)"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
                <div>
                  <div class="t-label">{{ t(row.labelKey) }}</div>
                  <div class="t-desc">{{ t(row.descKey) }}</div>
                </div>
              </button>
            </div>
          </aside>
        </div>

        <div class="sv-modal-foot">
          <button type="button" class="sv-btn-ghost" @click="dismiss">
            {{ t('photosCancel') }}
          </button>
          <button
            type="button" class="sv-btn-primary" data-test="sv-confirm-btn"
            :disabled="!canSubmit || store.createBusy" @click="confirm"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
            {{ embedded ? t('photosSvCreateSmartAlbum') : t('photosSvCreateSmartView') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* token 映射(brief 结构规格第 7 条 + 本组件自行补的 --text-N 四档,理由见文件头注释 5):
   --surface-1→--popup-bg / --surface-2→--chip-bg / --surface-3→--chip-bg-hi;
   --line→--card-border;--text-1→--fg / --text-2→--fg-muted / --text-3→--fg-faint /
   --text-4→--fg-subtle;--accent-hi(文字/图标色)→--accent-text;scrim 用 Dialog.vue 的
   --overlay-bg/--overlay-blur;投影一律 --card-shadow-hi;Vue2 半透明 accent 描边/底色
   (本仓无该 alpha 通道 token,Global Constraints §33)按三档 accent-soft 家族就近取
   (低→--accent-soft,中→--accent-soft-2,高→--accent-soft-bd)。 */
.sv-modal-scrim {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  -webkit-backdrop-filter: var(--overlay-blur);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}
.sv-modal {
  width: 820px;
  max-width: 100%;
  max-height: calc(100vh - 80px);
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: var(--card-shadow-hi);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* SP15-P2b Task 4 embedded mode (Vue2 photos-smartview.scss's `.sv-modal-embed-host` /
   `.sv-modal.sv-modal-embedded` -- this file names the wrapper class `.sv-embed-host`
   instead, a cosmetic naming difference registered here, not a structural one; the
   modifier class on .sv-modal itself keeps Vue2's literal name).
   This wrapper removes itself from the box model so the host panel's flex column hands
   the remaining height straight to .sv-modal, instead of this style-less div being sized
   by its content and then clipped. */
.sv-embed-host { display: contents; }
/* Strip only the standalone chrome (fixed width, radius, border, shadow, viewport-relative
   max-height) -- the host already provides those. The flex column and overflow:hidden stay,
   because .sv-modal-body / .sv-modal-form / .sv-modal-side rely on them for their own
   scrolling; without flex:1;min-height:0 a short viewport clips the submit button out of
   reach. */
.sv-modal.sv-modal-embedded {
  width: auto;
  max-width: none;
  max-height: none;
  flex: 1 1 auto;
  min-height: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.sv-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--line);
}
/* 偏离登记(文件头注释 1):Vue2 scss:690-691 是 32×32,不是 brief 写的 28×28——照真源。 */
.sv-modal-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 唯一登记为"deliberate icon 改法"的 --on-accent 用法(文件头注释 2)。 */
  background: var(--accent);
  color: var(--on-accent);
  box-shadow: var(--card-shadow-hi);
}
.sv-modal-head-text { flex: 1; min-width: 0; }
.sv-modal-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-1); }
.sv-modal-sub { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
/* Vue2 全局 .icon-btn(32×32,见 photos.scss)在本仓不存在(scoped 孤岛),照本弹窗其余
   26-28px 尺度的按钮定一份等价 scoped 版本(同 PlaceSpotDialog.vue:257 的既有先例)。 */
.icon-btn {
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-4);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: var(--surface-2); color: var(--text-1); }

.sv-modal-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.sv-modal-form {
  overflow-y: auto;
  padding: 18px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sv-modal-side {
  overflow-y: auto;
  padding: 18px 18px 22px;
  border-left: 1px solid var(--line);
  background: var(--surface-2);
}

.sv-field { display: flex; flex-direction: column; gap: 6px; }
.sv-field-label { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; font-weight: 500; color: var(--text-2); }
.sv-field-hint { font-size: 10.5px; color: var(--text-4); font-weight: 400; }
/* Vue2 内联 style="margin-top:6px"(:103/:116)→ 具名类,逐属性对照,不是裸字面量丢弃。 */
.sv-hint-spaced { margin-top: 6px; }
.sv-input {
  width: 100%;
  padding: 9px 11px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.sv-input:focus { border-color: var(--accent); background: var(--surface-1); }
.sv-textarea { min-height: 60px; resize: vertical; line-height: 1.45; font-size: 12.5px; }

.sv-suggest {
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-2);
  border-radius: 10px;
  padding: 10px 12px;
}
.sv-suggest-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-hi);
  margin-bottom: 8px;
}
.sv-suggest-row { display: flex; flex-wrap: wrap; gap: 5px; }
.sv-suggest-chip {
  padding: 4px 10px;
  border-radius: 99px;
  background: var(--surface-1);
  border: 1px dashed var(--accent-soft-bd);
  color: var(--text-1);
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.12s;
}
.sv-suggest-chip:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-hi); }

.sv-chip-bin {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 7px 8px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-height: 38px;
  transition: border-color 0.15s;
}
.sv-chip-bin:focus-within { border-color: var(--accent); background: var(--surface-1); }
.sv-chip-bin[data-empty="true"] { padding: 0; background: transparent; border: 0; }
.sv-chip-bin[data-empty="true"] .sv-chip-input {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 11px;
}
.sv-chip-bin[data-empty="true"]:focus-within .sv-chip-input { border-color: var(--accent); background: var(--surface-1); }
.sv-chip-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 9px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
  border-radius: 99px;
  color: var(--accent-hi);
  font-size: 11.5px;
  font-weight: 500;
}
.sv-chip-x {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 0;
  background: var(--accent-soft-2);
  color: var(--accent-hi);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
}
.sv-chip-x:hover { background: var(--accent-soft-bd); }
.sv-chip-input {
  flex: 1;
  min-width: 140px;
  background: transparent;
  border: 0;
  color: var(--text-1);
  font: inherit;
  font-size: 12.5px;
  outline: none;
  padding: 4px 6px;
}

.sv-thresh-val { margin-left: auto; color: var(--accent-hi); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 13px; }
/* fix round 1 · I1:.sv-slider/.sv-slider-marks 的真实样式已下沉到
   PhotosThreshSlider.vue(scoped 但作用于该组件自己渲染的元素,不需要在这里重复)。 */

.sv-toggles { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 2px 12px; }
.sv-toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12.5px;
  color: var(--text-2);
}
.sv-toggle-row:last-child { border-bottom: 0; }
.sv-toggle-row .label { flex: 1; color: var(--text-1); }
.sv-toggle-row .desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.sv-toggle-clickable { cursor: pointer; user-select: none; }
/* fix round 1 · M1(SmartViewSidePanel.vue task-8 评审同批发现,控制器授权连本文件
   一起补):Vue2 的 `.sv-switch` 有两份规则叠级联——本区 scss 读取区间没盖到
   `photos.scss:2819-2820` 的低优先级裸 `.sv-switch`,它声明了 `transition: background
   0.15s` 与 `::after` 的投影,未被高优先级的 `photos-smartview.scss:584-600` 覆盖,照样
   合并生效。补齐这两条,与 SmartViewSidePanel.vue 保持一致。 */
.sv-switch {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--surface-3);
  border-radius: 99px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.sv-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-1);
  transition: all 0.2s;
  /* 投影是纯粗黑阴影,用 color-mix 复刻 Vue2 原值(纯黑、约 30% 不透明度的投影),不写
     字面颜色函数,同 SmartViewSidePanel.vue 已立的先例。 */
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
/* --on-accent 合法用法之二(文件头注释 3a,fix round 1 · I3 已去掉不存在的外部引用):
   滑块叠在紧邻这条 [data-on="true"] 实底(var(--accent),非渐变/半透明)之上,合法性
   由这条背景声明自证——role="switch" 是本分支第一次使用,没有分支内先例可引。 */
.sv-switch[data-on="true"]::after { left: 16px; background: var(--on-accent); }

.sv-preview-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-hi);
  margin-bottom: 8px;
}
.sv-preview-count { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; }
.sv-preview-count b { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--text-1); }
.sv-preview-count span { font-size: 11.5px; color: var(--text-3); }
.sv-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  margin-bottom: 10px;
  border-radius: 8px;
  overflow: hidden;
}
.sv-preview-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.sv-preview-help {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.5;
  padding: 8px 10px;
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.sv-templates { margin-top: 18px; }
.sv-templates-head {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  margin-bottom: 8px;
}
.sv-template-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 4px;
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s;
}
.sv-template-row:hover { border-color: var(--accent); background: var(--accent-soft); }
/* fix round 1 · I2:Vue2 :164 给这 5 个模板行的 sparkles 图标显式传了
   color="var(--accent-hi)"(Vue2 PhotosIcon.vue 把 color prop 落到 :stroke)——是 accent
   色,不是继承 .sv-template-row 自己的 color:var(--text-1)(前景白/深)。之前误用
   stroke="currentColor" 让图标继承了容器的前景色而不是 accent,同文件另两处 sparkles
   (.sv-suggest-head/.sv-preview-head)之所以碰巧对,是因为那两条规则自己的 color 就是
   --accent-text,唯独这里的容器 color 是 --fg,currentColor 刚好继承错。Vue2 hover 态
   (scss:955-958)只改 border-color/background,不改图标色,故 hover 态也应保持 accent——
   这里直接给 svg 定死 color,不随容器 hover 变化,天然覆盖两态。 */
.sv-template-row svg { margin-top: 2px; flex-shrink: 0; color: var(--accent-hi); }
.sv-template-row .t-label { font-size: 12px; font-weight: 500; }
.sv-template-row .t-desc { font-size: 10.5px; color: var(--text-3); margin-top: 1px; line-height: 1.35; }

.sv-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--line);
  background: var(--surface-1);
}
.sv-btn-ghost {
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.sv-btn-ghost:hover { background: var(--surface-3); }
/* --on-accent 合法用法之三(文件头注释 3b):同本仓既有 primary 按钮先例
   ClusterActionDialog.vue:320 / MergeReviewDialog.vue:262。 */
.sv-btn-primary {
  height: 36px;
  padding: 0 18px;
  border-radius: 9px;
  background: var(--accent);
  border: 0;
  color: var(--on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: var(--card-shadow-hi);
  transition: transform 0.12s, box-shadow 0.15s, opacity 0.15s;
}
.sv-btn-primary:hover { background: var(--accent); }
.sv-btn-primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.sv-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }

.sv-modal-enter-active, .sv-modal-leave-active { transition: opacity 0.18s ease; }
.sv-modal-enter-active .sv-modal, .sv-modal-leave-active .sv-modal {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease;
}
.sv-modal-enter-from, .sv-modal-leave-to { opacity: 0; }
.sv-modal-enter-from .sv-modal, .sv-modal-leave-to .sv-modal { transform: translateY(8px) scale(0.98); opacity: 0; }

/* 窄屏(文件头注释 4):Vue2 真实已有 @media (max-width: 760px)(scss:1018-1022,不是
   brief 说的"零 @media"),这里 1:1 搬运两条真实变化(单列 + 側栏 border 换边),断点
   数字对齐本仓同类文件 PhotosSmartViews.vue 已用的 768(与 Vue2 字面 760 的出入已登记)。 */
@media (max-width: 768px) {
  .sv-modal-body { grid-template-columns: 1fr; }
  .sv-modal-side { border-left: 0; border-top: 1px solid var(--line); }
}
</style>
