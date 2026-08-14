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
//
// fix round 1 · I1(评审查实的漏渲染):Vue2 `mounted()` 里的 `_onDoc`(整体 :819-832,
// 本弹层对应的判据在 :820-822)是 `mousedown` 判据 ——
// `pop && !pop.contains(target) && btn && !btn.contains(target)` 才关,
// `pop` 是 `savePop`(本组件的根节点)、`btn` 是 `saveBtn`(触发按钮,归 T16/C6)。之前只
// 实现了 document 级 Esc,漏了这一半。这里补上:根节点绑 `rootRef`,新增可选 prop
// `ignoreEl`(宿主把 `.save-smart` 触发按钮的 element 传进来,默认 `null`)—— 判据换成
// "自身根容器与 ignoreEl 都不包含 target 才关",与 Vue2 逐字对应;不传 `ignoreEl` 时退化成
// "只判自身容器"(仍然可用,只是点触发按钮那一下也会被判定为"外部"从而误关——这个副作用
// 只在宿主没接 `ignoreEl` 时才会出现,已在报告交接段写明 T16 必须传入)。
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePhotosSmartViews } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import PhotosThreshSlider from './PhotosThreshSlider.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    query: string
    conditions: string[]
    defaultName: string
    ignoreEl?: HTMLElement | null
  }>(),
  { ignoreEl: null },
)

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  // fix 波 F1:多带一个 name 参数——宿主(PhotosSearch.vue)要用它拼「"{name}" 已保存为
  // 智能视图」的成功 toast 文案(照搬 Vue2 confirmSave() 的 saveToast = { name },
  // :806-812),原先只带 id 时宿主拿不到这个名字。
  (e: 'saved', id: string, name: string): void
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
const rootRef = ref<HTMLElement | null>(null)

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

// fix round 1 · I1(fix round 2 · N1 修正标签):点外部 mousedown 关闭(照搬 Vue2 `_onDoc`
// 里保存弹层那半判据——savePop/saveBtn 的 contains 检查,:820-822;people/filterbar 那半
// 判据在 :824-830,不归本组件管)。
// 判据是"根容器与 ignoreEl 都不包含 target"——两次 `contains` 调用都要跑完再做判断,
// 不写成"先查一个、命中就早退"的形态(Global Constraints「onDocMousedown 里禁止早退」,
// P5-T10 真 bug 就是这种早退在多层共享判定函数时漏检第二个分支;本函数虽然只服务
// 一层浮层,仍然按同一纪律写成"两个条件算完再决定",不留下未来被复制到多层场景时的隐患)。
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  const insideRoot = rootRef.value !== null && rootRef.value.contains(target)
  const insideIgnore = props.ignoreEl !== null && props.ignoreEl.contains(target)
  if (!insideRoot && !insideIgnore) close()
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
      document.addEventListener('mousedown', onDocMousedown)
      void nextTick(() => {
        nameInputRef.value?.focus()
        nameInputRef.value?.select()
      })
    } else {
      document.removeEventListener('keydown', onDocKeydown)
      document.removeEventListener('mousedown', onDocMousedown)
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('mousedown', onDocMousedown)
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
// description: props.query.trim() || undefined 的映射依据(brief 结构规格 7 已给出推断,
// 这里复述):Vue2 的 savedSv 里存的是 { query, filters },而后端 createSmartView 的语义是
// "conds 为空时用 description 作语义兜底"(Vue2 PhotosSmartViewsView.vue:426 注释)。把
// 原始查询词放进 description 是这两套契约之间唯一站得住的映射。
//
// fix round 1 · M5:trim + `|| undefined` 不能省——`CreateSmartViewInput.description?`
// 的既定语义是"空描述不传字段"(T5 SmartViewCreateDialog.vue 的 confirm() 同一口径,
// `draft.desc.trim() || undefined`),空查询串下若直传 `props.query` 会变成传一个空字符串
// 字段而不是"不传",与同一个 store 的另一个调用方口径不一致。
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
      description: props.query.trim() || undefined,
      conds: [...props.conditions],
      threshold: thresh.value,
      live: live.value,
      includeVideos: false,
    })
    if (created) {
      emit('saved', created.id, trimmed)
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
    <div v-if="open" ref="rootRef" class="save-pop" data-test="ssv-root">
      <!-- 偏离登记(fix round 1 · M8):这三处 svg 的 `stroke-width="2"` 相对 Vue2
           `PhotosIcon.vue` 的默认值 1.6(`:185`)是加性改动——Vue2 模板里这三处
           `<photos-icon>` 调用都没传 `stroke-width`,走的是默认 1.6。这里沿用 T5
           SmartViewCreateDialog.vue 已确立的同款选择(该文件里同类内联 svg 全部是
           stroke-width="2",不是本任务重新挑的值),按纪律在此登记。 -->
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
          <!-- 偏离登记(fix round 1 · M4 已修正依据 + 自查修正行号):brief 结构规格第 40
               条字面要求名称输入框再绑一个 @keydown.esc.prevent="close"(照搬 Vue2
               :175)。这里不重复绑——但理由不是"Vue2 没有更高层的 Esc 处理"(那个说法
               错了:Vue2 mounted() 里确实挂了 document 级 `_onKey`,赋值+挂载在
               :834-835,只是它的效果是 Esc 关灯箱未开时"退出整个搜索页"`exitSearch()`,
               不是关这个保存弹层)。真正的理由是:本组件
               按 Global Constraints 的硬约束新增了一个专门服务本弹层的 document 级 Esc
               监听器(onDocKeydown),keydown 默认从 input 冒泡到 document,再绑一份内联的
               会让同一次按键触发两次 close()/两次 emit('update:open', false)。同 T5
               SmartViewCreateDialog.vue 的既定做法(它的名称输入框也只绑 keydown.enter,
               不重复绑 esc)。 -->
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
          <!-- 偏离登记(fix round 1 · M8):`tabindex="0"` + `@keydown.enter`/`@keydown.space`
               是加性改动,Vue2 `:198-199` 的 `.sv-switch` 只有 `@click.prevent`,没有键盘
               可达性。沿用 T5 SmartViewCreateDialog.vue 已定的同型加项(该文件同一 fix
               round 里已作为「补 Vue2 的缺」登记过),这里延续同一套 a11y 基线,不是本任务
               新起的决定——但仍按「界面严格 1:1 下加项要登记」的纪律在此写明。 -->
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
  background: var(--surface-1);
  border: 1px solid var(--line);
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
  border-bottom: 1px solid var(--line);
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
  color: var(--text-1);
}
.save-pop-sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}
/* 偏离登记(fix round 1 · M1 已修正措辞,此前误写成"等价"):Vue2 全局 `.icon-btn`
   (`photos.scss:216-223`)真值是 32×32、`color: var(--text-2)`、hover 态
   `background: var(--surface-3); color: var(--text-1)`——不是这里落地的 28×28 /
   `--fg-subtle` / hover `--chip-bg`/`--fg`。本仓没有那个全局类(scoped 孤岛,each 组件
   各自定义一份),这里沿用 T5 SmartViewCreateDialog.vue 已立的先例——按本弹层自己
   28px 的尺度定一份缩小版,不是照抄 Vue2 的 32×32 原值,是一次刻意的尺寸偏离(与本组件
   .save-pop-icon 28×28 的整体尺度保持视觉一致),色值映射（--fg-subtle 常态 /
   --chip-bg+--fg hover）与 T5 逐字一致,不是本任务新定的一套。 */
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
.icon-btn:hover {
  background: var(--surface-2);
  color: var(--text-1);
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
  color: var(--text-2);
}
.save-pop-thresh-label {
  display: flex;
  align-items: baseline;
}
.save-pop-thresh-val {
  margin-left: auto;
  color: var(--accent-hi);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
.save-pop-input {
  padding: 8px 10px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.12s, background 0.12s;
}
.save-pop-input:focus {
  border-color: var(--accent);
  background: var(--surface-1);
}
.save-pop-conds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 7px;
  max-height: 70px;
  overflow-y: auto;
}
.save-pop-cond {
  padding: 2px 9px;
  border-radius: 99px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
  color: var(--accent-hi);
  font-size: 11px;
  font-weight: 500;
}
.save-pop-conds-empty {
  font-size: 11px;
  color: var(--text-4);
}
.save-pop-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
}
.save-pop-toggle-text {
  flex: 1;
}
.save-pop-toggle-label {
  font-size: 12.5px;
  color: var(--text-1);
  font-weight: 500;
}
.save-pop-toggle-desc {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}
.save-pop-foot {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
  background: var(--surface-1);
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
  background: var(--surface-3);
  border-radius: 99px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
/* Fix-6 (owner decision, 2026-08-14): the knob is literal white in EVERY theme and BOTH on/off
   states -- overrides whatever Vue2's own (non-existent) light theme would have done, explicit
   owner requirement. Fix-5's `var(--text-1)` got dark-mode legibility right but was still a
   theme-flipping token, going near-black under `.photos-root.is-light` -- legible, but not
   white, which is what the owner wants. `--text-1` is deliberately no longer used for the knob.
   Literal white, same theme-exception convention as PhotosToastHost.vue's `.photos-toast`
   background / this repo's other theme-invariant surfaces. The light-mode border + shadow below
   is a matched pair with this rule -- see its own comment. */
.sv-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff; /* theme-exception: owner 2026-08-14 decision -- knob is invariant white in every theme/state */
  transition: all 0.2s;
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
/* Owner decision (2026-08-14), paired with the literal-white knob above: a flat white circle has
   no edge against photos light mode's own near-white `--surface-3` off-track, so light mode gets
   a subtle parity-token border plus a lighter drop shadow, same values as
   SmartViewCreateDialog.vue/SmartViewSidePanel.vue's own copies of this rule. Applies to both
   on/off states (neither modifies border/box-shadow), matching the owner's state-invariant
   requirement. */
.photos-root.is-light .sv-switch::after {
  border: 1px solid var(--line-strong);
  box-shadow: 0 1px 2px color-mix(in srgb, black 12%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
/* Fix-5 (owner acceptance, 2026-08-14): straight bug fix, not a deviation from Vue2 -- parity's
   own `.photos-root .sv-switch[data-on="true"]::after` (photos-smartview.scss:786-789) only
   moves the knob (`left: 16px`); it never overrides `background`, so Vue2's knob is the exact
   same colour in both states. The `--on-accent` override this rule used to carry (the C5 ruling
   above pinned this file's `.sv-switch` to SmartViewCreateDialog.vue's values, which carried the
   same bug) was wrong: it made the knob track the on/off *state* instead of staying constant
   like Vue2's. Deleted here too, same fix as that file and SmartViewSidePanel.vue's own copy in
   the same commit -- the knob now always uses the base rule's background above (Fix-6: literal
   white), in both states, matching Vue2's own single-value knob exactly. */
.sv-switch[data-on="true"]::after { left: 16px; }

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
