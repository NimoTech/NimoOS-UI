<script setup lang="ts">
// SP7-P7a-T7: SmartViewConditionEditor.vue —— 智能视图详情页 header 里的条件 chips
// (可删除)+「添加条件」弹层(输入 + 建议)。挂载点在 PhotosSmartViewDetail.vue 的
// `data-test="sv-cond-editor-mount"`(T6 留的空壳,本任务兑现)。
//
// 组件契约(task-7-brief.md):自己不碰 store,只做 UI + draft 输入,真实条件来源是
// `conds` prop(宿主的 `sv.conds`)。`add`/`remove` 两个 emit 由宿主接
// `store.updateSmartView(id, { conds: [...] })`——这样 §7e-2 的核心修复自动生效:
// store 更新数组项 → `sv` computed 变 → `conds` prop 变 → chips 立即重绘,不需要本组件
// 自己乐观更新任何本地条件列表。
//
// 参照 NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue:26-59(模板)、:334-343
// (condSuggestions)、:445-477(四个方法)、:386-391(点外部)。
//
// 回源核对结论(逐条见 task-7-report.md):Vue2 base `.sv-cond`(photos-smartview.scss:96-102）
// 没有任何 `:hover` 规则——brief 结构规格 7 说"`.sv-cond` 基类有 hover"与源码不符,已登记为
// brief 表述错误(本组件不生造一个 Vue2 没有的视觉状态)。
//
// fix round 1 · I1:`.sv-cond-add[data-open="true"]` 与 `.sv-cond-add:hover`
// (photos-smartview.scss:294-303)在 Vue2 里三条声明逐字相同——不存在"基类压变体"式的
// 级联冲突可守,这里真正编码的不变量是"打开态与 hover 态视觉一致"。测试钉的就是这一条
// (两条规则体的 background/border-color 相等,且 `[data-open="true"]` 规则本身存在),
// 不是"胜出规则的 specificity"——早先那条 specificity 断言在旧版 `cssCascade.ts` 下是
// 零价值恒真断言(工具的 vacuous-truth 漏洞+属性选择器不计分,两个问题叠加导致改错值/
// 删规则都测不出来),已随 `cssCascade.ts` 一并修好,断言换成能真正证伪的形式。
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { condSuggestionsFor } from '../util/smartViewSuggest'

const props = withDefaults(defineProps<{ conds: string[]; busy?: boolean }>(), { busy: false })
const emit = defineEmits<{ add: [cond: string]; remove: [cond: string] }>()

const { t } = useI18n()

// ── chips 删除(结构规格 1)───────────────────────────────────────────────────
// 偏离登记(brief 结构规格 6,控制器指定):Vue2 的 updateSmartView 无重入守卫,New-UI
// 的 patchBusy 会短路重复请求但界面不给反馈就成了"点了没反应"——这里在 busy 期间直接
// 不发 remove,配合宿主传入的 store.patchBusy 阻止并发 PATCH。
function removeCond(c: string): void {
  if (props.busy) return
  emit('remove', c)
}

// ── 加条件弹层(结构规格 2-5)─────────────────────────────────────────────────
const open = ref(false)
const draft = ref('')
const addBtnRef = ref<HTMLElement | null>(null)
const popRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const suggestions = computed(() => condSuggestionsFor(props.conds))

function openPop(): void {
  open.value = true
  draft.value = ''
  void nextTick(() => inputRef.value?.focus())
}
function close(): void {
  open.value = false
  draft.value = ''
}
function toggleOpen(): void {
  if (open.value) close()
  else openPop()
}

// submit/addSuggestion 的 busy 守卫是 removeCond 那条偏离登记的自然延伸(同一个"防止
// 连点产生并发 patch"的理由),不是另一条未申报的偏离——按钮本身也用 :disabled 挡了
// 鼠标点击,这里补的是键盘 Enter 路径(disabled 属性不拦截程序触发的 keydown.enter)。
function submit(): void {
  const v = draft.value.trim()
  if (!v) { close(); return }
  if (props.busy) return
  if (!props.conds.includes(v)) emit('add', v)
  // 照搬 Vue2 :467-468:清空 draft、重新聚焦,弹层**不关**——可以连续加多条。
  draft.value = ''
  void nextTick(() => inputRef.value?.focus())
}
function addSuggestion(s: string): void {
  if (props.busy) return
  if (!props.conds.includes(s)) emit('add', s)
  void nextTick(() => inputRef.value?.focus())
}

// ── 点外部关闭(结构规格 5,照 Vue2 :386-391)──────────────────────────────────
function onDocumentMouseDown(e: MouseEvent): void {
  const target = e.target as Node
  const pop = popRef.value, btn = addBtnRef.value
  if (pop && !pop.contains(target) && btn && !btn.contains(target)) close()
}

// ── Esc(硬约束:document 级监听,handler 体内 return 只允许出现在"非 Escape"分支,
// 不早退——本组件只管自己这一个浮层,但仍按多浮层场景的统一写法实现,便于宿主未来
// 把多个浮层的 keydown 监听器合并时行为一致)。
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (open.value) close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onDocumentMouseDown)
    document.addEventListener('keydown', onDocumentKeydown)
  } else {
    document.removeEventListener('mousedown', onDocumentMouseDown)
    document.removeEventListener('keydown', onDocumentKeydown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <span
    v-for="c in conds" :key="c" class="sv-cond sv-cond-removable" data-test="sv-cond-chip"
    :data-busy="busy" :title="t('photosSvRemoveC', { c })" @click="removeCond(c)"
  >
    {{ c }}
    <span class="sv-cond-x">
      <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
    </span>
  </span>

  <div style="position:relative;display:inline-block">
    <button
      ref="addBtnRef" type="button" class="sv-cond sv-cond-add" data-test="sv-cond-add-btn"
      :data-open="open" @click="toggleOpen"
    >
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
      {{ t('photosSvAddCondition') }}
    </button>
    <Transition name="sv-menu">
      <div v-if="open" ref="popRef" class="sv-cond-pop" data-test="sv-cond-pop">
        <div class="sv-cond-pop-head">{{ t('photosSvNewCondition') }}</div>
        <input
          ref="inputRef" v-model="draft" class="sv-cond-pop-input" data-test="sv-cond-pop-input"
          :placeholder="t('photosSvEGSceneSunset')"
          @keydown.enter.prevent="submit" @keydown.esc.prevent="close"
        >
        <template v-if="suggestions.length > 0">
          <div class="sv-cond-pop-sugg-head">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
            {{ t('photosSvSuggestions') }}
          </div>
          <div class="sv-cond-pop-sugg">
            <button
              v-for="s in suggestions" :key="s" type="button" class="sv-cond-pop-chip"
              data-test="sv-cond-suggestion" @click="addSuggestion(s)"
            >+ {{ s }}</button>
          </div>
        </template>
        <div class="sv-cond-pop-foot">
          <button type="button" class="sv-btn-ghost" data-test="sv-cond-done" @click="close">{{ t('photosSvDone') }}</button>
          <button
            type="button" class="sv-btn-primary" data-test="sv-cond-submit"
            :disabled="!draft.trim() || busy" @click="submit"
          >{{ t('photosSvAdd') }}</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── chips 基类(scss:96-102 base + :253 header 覆盖后的合并值——本组件只在
     .sv-header-conds 语境下使用,直接写合并后的最终值,不重复两层级联)── */
.sv-cond {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--chip-bg-hi);
  color: var(--fg-muted);
  font-size: 11.5px;
}

/* ── 可删除 chip(scss:255-282)── */
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
/* Vue2 写死的珊瑚红字面量 → --remove-fg 家族,同文件 :654-658 的既有先例
   (.sv-export-item-danger 等)。 */
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

/* ── 添加条件按钮(scss:284-303)── */
.sv-cond-add {
  gap: 4px;
  background: transparent;
  /* --line/--line-stronger 本仓不存在,借用 --card-border——同既有先例
     PersonAvatar.vue:157-159。 */
  border: 1px dashed var(--card-border);
  color: var(--fg-faint);
  cursor: pointer;
  transition: all 0.12s;
}
/* accent-hi(纯文字色语义,非按钮实底)→ --accent-text,同本文件 :647/:348 既有先例。
   [data-open="true"] 与 :hover 在 Vue2 原值完全相同(都是同一组 accent 描边/底/字色)——
   这两条规则故意保持逐字一致,是"打开态视觉等同 hover 态"这个不变量本身,测试钉的就是
   这一条(background/border-color 相等),见文件头 fix round 1 · I1 注释。 */
.sv-cond-add:hover { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }
.sv-cond-add[data-open="true"] { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }

/* ── 加条件弹层(scss:305-376)── */
.sv-cond-pop {
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  width: 280px;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 10px;
  box-shadow: var(--card-shadow-hi);
  z-index: 60;
}
.sv-cond-pop-head {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-faint);
  margin-bottom: 6px;
}
.sv-cond-pop-input {
  width: 100%;
  padding: 8px 10px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 7px;
  color: var(--fg);
  font: inherit;
  font-size: 12.5px;
  outline: none;
  transition: border-color 0.12s, background 0.12s;
}
.sv-cond-pop-input:focus { border-color: var(--accent); background: var(--popup-bg); }
.sv-cond-pop-sugg-head {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-text);
  margin: 10px 0 6px;
}
.sv-cond-pop-sugg { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
.sv-cond-pop-chip {
  padding: 3px 9px;
  border-radius: 99px;
  background: var(--chip-bg);
  border: 1px dashed var(--accent-soft-bd);
  color: var(--fg);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
}
.sv-cond-pop-chip:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
.sv-cond-pop-foot {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--card-border);
}

/* ── 弹层脚部两钮:Vue2 :53-54 在这个语境下用内联 style 把通用的 36px 版
     .sv-btn-ghost/.sv-btn-primary(scss:970-1004)缩到 28px——本组件自己作用域内没有
     36px 版本可继承,直接把"基类属性 + 28px 覆盖"合并写成一份完整定义。 */
.sv-btn-ghost {
  height: 28px;
  padding: 0 10px;
  border-radius: 9px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.sv-btn-ghost:hover { background: var(--chip-bg-hi); }
.sv-btn-primary {
  height: 28px;
  padding: 0 14px;
  border-radius: 9px;
  background: var(--accent);
  border: 0;
  color: var(--on-accent);
  font: inherit;
  font-size: 12px;
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

/* fix：Vue2 :79/:102 同款的 sv-menu transition(scss:454-455),照本仓 Vue3 写法用
   -enter-from/-leave-to(不是 Vue2 的 -enter)。数值与 PhotosSmartViewDetail.vue 里已有的
   同名 transition 保持一致(能复用就复用,不写第二套不一致的时长/曲线)。 */
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }
</style>
