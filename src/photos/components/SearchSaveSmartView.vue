<script setup lang="ts">
// SP7-P7a-T14: SearchSaveSmartView.vue —— 搜索页「保存为智能视图」弹层(D12 真建接线)。
// 结构对应 Vue2 PhotosSearchView.vue:159-210(模板,不含 :153-158 的触发按钮 .save-smart——
// 那颗按钮不归本任务,交接给 T16,见文件尾交接注释)、:798-804(openSave 的重置逻辑)、
// :806-812(confirmSave,但 Vue2 那版是假的——只置本地 state + toast,零 store/service
// 调用;D12 要求本任务把它接成真的 createSmartView 调用)。样式对应 photos.scss:2795-2815
// (.save-pop* 全组,已逐条核对)+ C5 裁定的 .sv-switch/.sv-btn-ghost/.sv-btn-primary(取
// photos-smartview.scss 优先级更高的那份,与 T5/T8 的既有实现保持一致数值,不抄
// photos.scss:2817-2825 那份被压制的值)。
//
// 持久挂载 + prop 显隐(不像 T13 靠宿主 v-if 重新挂载复位内部 state)——C13 裁定的刻意
// 差异:本组件与 T5 的 SmartViewCreateDialog 同款,靠 watch(() => props.open) 复位,
// 不是 onMounted(持久挂载坑,同 T5 文件头注释)。
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePhotosSmartViews } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import PhotosThreshSlider from './PhotosThreshSlider.vue'

const props = defineProps<{
  open: boolean
  query: string
  conditions: string[]
  defaultName: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved', id: string): void
}>()

const { t } = useI18n()
const store = usePhotosSmartViews()
const toast = useToast()

const name = ref('')
// 默认阈值 75(照 Vue2 openSave :801),与 T5 创建弹窗的默认 80 不同——已逐字核对,不是
// 抄错(brief 结构规格第 6 条已明写这条差异)。
const thresh = ref(75)
const live = ref(true)
const nameInputRef = ref<HTMLInputElement | null>(null)

function close(): void {
  emit('update:open', false)
}

// 浮层 Esc 走 document 级监听 + watch(open) 挂/摘(Global Constraints「浮层 Esc 一律
// document 级监听」)。本组件不在 onDocKeydown 里做任何早退判断,也不调用
// stopPropagation——搜索页可能同时开着一个筛选弹层与本弹层,两者的监听器各自独立处理
// 同一次 Escape 按键,互不干扰(P5-T10 教训:早退/阻断会让另一层收不到事件)。
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  close()
}

// 控制器补充(C13):open 变真时重置 name/thresh/live + 聚焦,必须挂在
// watch(() => props.open),不能用 onMounted——本组件常驻挂载、靠 prop 显隐,onMounted
// 只在组件创建时跑一次。
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      name.value = props.defaultName
      thresh.value = 75
      live.value = true
      document.addEventListener('keydown', onDocKeydown)
      void nextTick(() => {
        nameInputRef.value?.focus()
        nameInputRef.value?.select()
      })
    } else {
      document.removeEventListener('keydown', onDocKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
})

function onThreshInput(v: number): void {
  thresh.value = v
}

function toggleLive(): void {
  live.value = !live.value
}

// D12 真建(C8):Vue2 confirmSave(:806-812)只置 saved=true + 写一个全仓再没人读的
// savedSv + 弹"已保存"toast,零 store/service 调用——这颗按钮在 Vue2 里是假的。这里真调
// createSmartView,并且必须自己包 try/catch(store.createSmartView 失败时是 throw,brief
// 结构规格 7 给的代码片段漏了这一层)。
//
// description: props.query 的映射依据(brief 结构规格 7 已给出推断,这里复述):Vue2 的
// savedSv 里存的是 { query, filters },而后端 createSmartView 的语义是"conds 为空时用
// description 作语义兜底"(Vue2 PhotosSmartViewsView.vue:426 注释)。把原始查询词放进
// description 是这两套契约之间唯一站得住的映射。
//
// createBusy 命中返回 null 的边界(C8 登记):primary 按钮已经
// `:disabled="!name.trim() || store.createBusy"`,这条路径基本不可达,不加额外 UI,仅在
// 这里注释登记——与 T5/T6 同型边界处理口径一致。
async function confirm(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed || store.createBusy) return
  try {
    const created = await store.createSmartView({
      name: trimmed,
      description: props.query,
      conds: [...props.conditions],
      threshold: thresh.value,
      live: live.value,
      includeVideos: false,
    })
    if (created) {
      emit('saved', created.id)
      emit('update:open', false)
    }
  } catch (e) {
    console.error('[search-save-smart-view] confirm', e)
    // 复用既有通用键(同 T5 SmartViewCreateDialog.vue 的既定选择),本任务不新增 i18n 键。
    toast.show(t('photosAlbumCreateFailed'))
  }
}
</script>

<template>
  <Transition name="save-pop">
    <div v-if="open" class="save-pop" data-test="ssv-root">
      <div class="save-pop-head">
        <div class="save-pop-icon">
          <svg
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
        </div>
        <div class="save-pop-head-text">
          <div class="save-pop-title">{{ t('photosSearchSaveSmartView') }}</div>
          <div class="save-pop-sub">{{ t('photosSvSavedSearchKeepsItself') }}</div>
        </div>
        <button
          type="button" class="icon-btn" data-test="ssv-close-btn" :aria-label="t('photosClose')"
          @click="close"
        >
          <svg
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div class="save-pop-body">
        <label class="save-pop-field">
          <span class="save-pop-label">{{ t('photosSvName') }}</span>
          <!-- 偏离登记:brief 结构规格第 40 条字面要求名称输入框再绑一个
               @keydown.esc.prevent="close"(照搬 Vue2 :793)。这里不重复绑——本组件已有
               document 级 Esc 监听器(Global Constraints 的硬约束,Vue2 本身没有这层),
               keydown 默认从 input 冒泡到 document,再绑一份内联的会让同一次按键触发两次
               close()/两次 emit('update:open', false)。同 T5 SmartViewCreateDialog.vue 的
               既定做法(它的名称输入框也只绑 keydown.enter,不重复绑 esc)。 -->
          <input
            ref="nameInputRef" v-model="name" class="save-pop-input" data-test="ssv-name-input"
            :placeholder="t('photosSvEGSaraTokyo')" @keydown.enter.prevent="confirm"
          >
        </label>

        <div class="save-pop-field">
          <span class="save-pop-label">{{ t('photosSvConditions') }}</span>
          <div class="save-pop-conds">
            <span v-for="c in conditions" :key="c" class="save-pop-cond">{{ c }}</span>
            <span v-if="conditions.length === 0" class="save-pop-conds-empty">
              {{ t('photosSearchNoActiveFiltersSaves') }}
            </span>
          </div>
        </div>

        <div class="save-pop-field">
          <span class="save-pop-label save-pop-thresh-label">
            {{ t('photosSvQualityThreshold') }}
            <span class="save-pop-thresh-val">&ge; {{ thresh }}%</span>
          </span>
          <PhotosThreshSlider :value="thresh" @input="onThreshInput" />
        </div>

        <label class="save-pop-toggle">
          <div class="save-pop-toggle-text">
            <div class="save-pop-toggle-label">{{ t('photosSvKeepLive') }}</div>
            <div class="save-pop-toggle-desc">{{ t('photosSvAutoAddMatchesPhotos') }}</div>
          </div>
          <div
            class="sv-switch" role="switch" tabindex="0" data-test="ssv-switch-live"
            :aria-checked="live" :aria-label="t('photosSvKeepLive')" :data-on="live"
            @click.prevent="toggleLive" @keydown.enter.prevent="toggleLive" @keydown.space.prevent="toggleLive"
          />
        </label>
      </div>

      <div class="save-pop-foot">
        <button type="button" class="sv-btn-ghost" data-test="ssv-cancel-btn" @click="close">
          {{ t('photosCancel') }}
        </button>
        <button
          type="button" class="sv-btn-primary" data-test="ssv-confirm-btn"
          :disabled="!name.trim() || store.createBusy" @click="confirm"
        >
          <svg
            viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          {{ t('photosSvCreateSmartView') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* token 映射(同 T5/T12/T13 既定表,不重复展开每一条):--surface-1→--popup-bg;
   --line→--card-border;--text-1/2/3/4→--fg/--fg-muted/--fg-faint/--fg-subtle;
   --surface-2→--chip-bg;--accent-hi→--accent-text;半透明 accent 描边(0.3 阿尔法)就近取
   --accent-soft-bd(本仓无逐分量 accent-rgb token,Global Constraints §33)。投影统一走
   --card-shadow-hi(本仓"不透明浮动面板"的既定组合,先例见 PhotosFilterPopover.vue/
   SearchDatePopover.vue/SmartViewCreateDialog.vue 头部注释——不复刻 Vue2 那条额外的
   0 0 0 1px 极淡 accent 描边,这三个先例都统一省略了这层,不是本任务新的偏离)。 */
.save-pop {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 360px;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  box-shadow: var(--card-shadow-hi);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.save-pop-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--card-border);
}
/* C11:28×28、border-radius:9px(不是 T5 .sv-modal-icon 的 32×32——两处尺寸独立核实,
   不能互相套用)。Vue2 原背景是写死的紫色渐变,改成 --accent 实底后前景满足"背景确为
   --accent 饱和实底"的条件,--on-accent 合法(同 T5 对 .sv-modal-icon 的既定处理口径)。 */
.save-pop-icon {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
  flex-shrink: 0;
}
.save-pop-head-text {
  flex: 1;
}
.save-pop-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg);
}
.save-pop-sub {
  font-size: 11px;
  color: var(--fg-faint);
  margin-top: 1px;
}
/* Vue2 全局 .icon-btn 在本仓不存在(scoped 孤岛),照本弹层自己的 28px 尺度定一份等价
   scoped 版本(同 T5 SmartViewCreateDialog.vue 的既有先例,连同其解释一起沿用)。 */
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
  color: var(--fg-subtle);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--chip-bg);
  color: var(--fg);
}

.save-pop-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.save-pop-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.save-pop-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
}
.save-pop-thresh-label {
  display: flex;
  align-items: baseline;
}
.save-pop-thresh-val {
  margin-left: auto;
  color: var(--accent-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
.save-pop-input {
  padding: 8px 10px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 7px;
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.12s, background 0.12s;
}
.save-pop-input:focus {
  border-color: var(--accent);
  background: var(--popup-bg);
}
.save-pop-conds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 7px;
  max-height: 70px;
  overflow-y: auto;
}
.save-pop-cond {
  padding: 2px 9px;
  border-radius: 99px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 500;
}
.save-pop-conds-empty {
  font-size: 11px;
  color: var(--fg-subtle);
}
.save-pop-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  cursor: pointer;
}
.save-pop-toggle-text {
  flex: 1;
}
.save-pop-toggle-label {
  font-size: 12.5px;
  color: var(--fg);
  font-weight: 500;
}
.save-pop-toggle-desc {
  font-size: 11px;
  color: var(--fg-faint);
  margin-top: 1px;
}
.save-pop-foot {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid var(--card-border);
  background: var(--popup-bg);
}

/* C7:Vue2 的 <transition name="save-pop"> 规则,Vue3 类名是 -enter-from 不是 Vue2 的
   -enter(T6 fix round 教训:写成 -enter 会静默失效)。 */
.save-pop-enter-active,
.save-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: top right;
}
.save-pop-enter-from,
.save-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

/* C5 裁定:.sv-switch/.sv-btn-ghost/.sv-btn-primary 一律照 T5 SmartViewCreateDialog.vue
   已落地的值(photos-smartview.scss 的高优先级 `.photos-root .sv-*` 那份,不是
   photos.scss:2817-2825 被压制的那份)。含 T8 的 M1 修复:.sv-switch 的 transition:
   background 0.15s 与 ::after 的投影——两者出自 photos.scss:2819-2820 的低优先级裸规则,
   未被高优先级规则声明覆盖,照样合并进级联生效。 */
.sv-switch {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--chip-bg-hi);
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
  background: var(--fg);
  transition: all 0.2s;
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
.sv-switch[data-on="true"]::after { left: 16px; background: var(--on-accent); }

.sv-btn-ghost {
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.sv-btn-ghost:hover { background: var(--chip-bg-hi); }
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
</style>
