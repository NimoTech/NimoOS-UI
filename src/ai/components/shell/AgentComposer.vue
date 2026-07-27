<!--
  SP8-P1c1 Task 9 —— AgentComposer 骨架:chips + textarea + 工具栏 + 发送/停止。
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentComposer.vue(830 行)。本任务只做
  骨架:可见资源 chips(Vue2 5-17)、自增高 textarea(45-54)、工具栏行(56-113)、
  caption(127-129)。**不做**(留给 Task 10/11,接线处见下方注释):
    - 附件 chips(Vue2 18-42)、上传/删除管线(onFilesPicked/removeAttachment,
      Vue2 506-611)——`attachments` 数组在本任务里恒为空数组。
    - @mention 面板(MentionPopover)与 `/init` 斜杠面板(SlashMenu)——onInput 的
      mention 扫描(Vue2 306-334)、drillIn/pickItem/popSegment、onInit 均未接入。
    - Vue2 的 BrowserModal(浏览 NAS 弹窗)——本期用户决定延后,Browse 按钮改为
      toast 占位提示。
    - `activeSessionId` watcher(Vue2 275-281)——Vue2 里这个 watcher 同时做两件事
      (关闭 mention 面板 + 清空待附件列表),两者都属于下一任务范围,若本任务加上
      一个空 watcher 体只会是死代码,故整体挪到 Task 10。
-->
<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import KindIcon from './KindIcon.vue'
import ContextUsageBar from '../blocks/ContextUsageBar.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useToast } from '../../../stores/toast'
import { getExt, basename, dirname } from '../../util/composerText'
import { ACCEPT_TYPES } from '../../util/attachmentMeta'

const props = withDefaults(
  defineProps<{ busy?: boolean; ctxUsage?: { tokens: number; window: number; pct: number } | null }>(),
  { busy: false, ctxUsage: null },
)

// 三个 emit 名与 payload 形状是 Task 12 接线契约,不可改
// (p1c1-task-9-brief.md Interfaces 段)。`send-init` 本任务无调用方
// (SlashMenu/onInit 是 Task 11 的事),这里先声明接口占位。
const emit = defineEmits<{
  send: [payload: { text: string; attachmentIds: string[]; attachmentRefs: unknown[] }]
  stop: []
  'send-init': [target: string]
}>()

const { t } = useI18n()
const store = useProvidedAgentStore()
const toast = useToast()

const text = ref('')
const composerEl = ref<HTMLElement | null>(null)
const ta = ref<HTMLTextAreaElement | null>(null)
const attachFileInput = ref<HTMLInputElement | null>(null)
// Vue2 295-299 anchorRect: 供 MentionPopover 定位,面板本身留 Task 11,这里先把
// 计算+resize 联动的骨架搭好,不留半截状态。
const anchorRect = ref<DOMRect | null>(null)

const placeholder = computed(() => t('aiComposerPlaceholder'))
const acceptTypes = ACCEPT_TYPES

/** Vue2 289-294 grow() —— 逐字对齐(min(scrollHeight, 220))。 */
function grow() {
  const el = ta.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 220) + 'px'
}

/** Vue2 295-299 updateAnchor()。 */
function updateAnchor() {
  if (composerEl.value) anchorRect.value = composerEl.value.getBoundingClientRect()
}

/**
 * Vue2 300-335 onInput() 的骨架切片:本任务只保留 grow() 副作用。@ 提及扫描
 * (Vue2 312-334,`scanMention` 已在 Task 5 的 composerText.ts 里备好纯函数)
 * 与 `/` 斜杠检测(Vue2 307-310)留给 Task 11 往这个函数体里续接——函数名保持
 * `onInput` 不变,模板绑定不需要跟着改。
 */
function onInput() {
  grow()
}

/**
 * Vue2 336-342 onKeydown()。**修正一处**:去掉了 `if (this.mentionOpen) return`
 * 守卫——mention 面板本任务未接入,该分支目前恒不成立,是死代码。IME 双重守卫
 * 逐字保留(`e.isComposing || keyCode === 229`,后者是历史上部分浏览器/输入法
 * 不设置 isComposing 时的兜底,两个都要留)。
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey) return
  if (e.isComposing || (e as unknown as { keyCode?: number }).keyCode === 229) return
  e.preventDefault()
  submit()
}

/**
 * Vue2 245-250 canSend()。Vue2 原逻辑同时看 `attachments`(是否有已上传就绪项 /
 * 是否有正在上传项);本任务附件数组恒为空数组(上传管线是 Task 10 的事),
 * 代入空数组化简后就是纯文本非空判断——Task 10 补上 attachments 状态后需要把
 * 这里换回 Vue2 原始的三段式判断。
 */
const canSend = computed(() => text.value.trim().length > 0)

/** Vue2 260-272 chips()——用 Task 5 composerText.ts 的 basename/dirname/getExt。 */
const chips = computed(() =>
  store.visibleResources.map((r) => {
    const isFile = r.kind === 'file'
    return {
      id: r.id,
      path: r.path,
      name: basename(r.path),
      parent: dirname(r.path),
      kind: r.kind,
      ext: isFile ? getExt(r.path) : '',
    }
  }),
)

/** Vue2 654-657 toastError()——removeChip/pickItem/onBrowserPick 三处共用的通用
 *  错误提示,对应 Vue2 的 `$t('Authorization failed: {msg}')`,本任务用
 *  `aiAuthFailed` 键接住;removeChip 是本任务唯一接入的调用点,否则移除资源失败
 *  会被静默吞掉。 */
function toastError(e: unknown) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string } | null
  const msg = err?.response?.data?.detail || err?.message || 'unknown'
  toast.show(t('aiAuthFailed', { msg }), 5000)
}

/** Vue2 430-434 removeChip()。 */
async function removeChip(c: { id?: string | number }) {
  if (c.id === undefined) return
  try {
    await store.removeVisibleResource(c.id)
  } catch (e) {
    toastError(e)
  }
}

/**
 * Vue2 436-454 submit()。附件部分本任务恒为空数组(Task 10 接入上传管线后,
 * 把这里换回 Vue2 原始的 readyAttachments 派生逻辑)。
 */
function submit() {
  const trimmed = text.value.trim()
  if (!trimmed) return
  emit('send', { text: trimmed, attachmentIds: [], attachmentRefs: [] })
  text.value = ''
  nextTick(grow)
}

/** Vue2 651-653 notSupported()(语音键)。Vue2 用 'is-warning' 类型,不是错误,
 *  用默认 toast 时长。 */
function notSupported() {
  toast.show(t('aiNotSupportedYet'))
}

/**
 * **本期有意偏离 Vue2**:Vue2 点击 Browse 直接打开 `<BrowserModal>`
 * (浏览 NAS 弹窗)。该弹窗本阶段不做(用户决定,见 Task 9 brief「Browse 按钮」
 * 一节),这里改为 toast 占位提示,不设 browserOpen 状态、不渲染
 * `data-active`(Vue2 59 行的 `:data-active="browserOpen"` 因此一并去掉)。
 */
function onBrowseClick() {
  toast.show(t('aiBrowseComingSoon'))
}

onMounted(() => window.addEventListener('resize', updateAnchor))
onBeforeUnmount(() => window.removeEventListener('resize', updateAnchor))
</script>

<template>
  <div class="composer-wrap">
    <div class="composer" ref="composerEl">
      <div v-if="chips.length > 0" class="composer-chips">
        <div v-for="c in chips" :key="c.id" class="ctx-chip" :title="c.path">
          <KindIcon :kind="c.kind === 'file' ? 'file' : 'folder'" :ext="c.ext" :size="12" />
          <span class="ctx-chip-name">{{ c.name }}</span>
          <span class="ctx-chip-path">{{ c.parent || '/' }}</span>
          <button class="ctx-chip-x" @click="removeChip(c)">
            <AgentIcon name="x" :size="10" />
          </button>
        </div>
      </div>

      <textarea
        ref="ta"
        class="composer-textarea"
        :placeholder="placeholder"
        rows="1"
        v-model="text"
        @input="onInput"
        @keydown="onKeydown"
      />

      <div class="composer-row">
        <button
          class="composer-tool"
          :title="t('aiComposerBrowseTitle')"
          @click="onBrowseClick"
        >
          <AgentIcon name="folder" :size="14" /> {{ t('aiComposerBrowse') }}
        </button>
        <!-- Seam for Task 10: hidden file input, styling trick kept verbatim
             (Vue2 663-673 — a display:none input does not fire a synthetic
             .click() in some browsers, hence position+opacity instead).
             :accept bound now; @change (onFilesPicked) wired by Task 10. -->
        <input
          type="file"
          ref="attachFileInput"
          :accept="acceptTypes"
          multiple
          class="attach-file-input"
        />
        <button class="composer-tool">
          <AgentIcon name="paperclip" :size="14" />
        </button>
        <button class="composer-tool" :title="t('aiComposerVoice')" @click="notSupported">
          <AgentIcon name="mic" :size="14" />
        </button>
        <div class="composer-spacer" />
        <ContextUsageBar
          v-if="ctxUsage"
          :tokens="ctxUsage.tokens"
          :window="ctxUsage.window"
          :pct="ctxUsage.pct"
          class="composer-ctx-usage"
        />
        <button
          v-if="props.busy"
          class="send-btn busy"
          @click="emit('stop')"
        >
          <AgentIcon name="stop" :size="12" />
        </button>
        <button
          v-else
          class="send-btn"
          :disabled="!canSend"
          @click="submit"
        >
          <AgentIcon name="send" :size="14" />
        </button>
      </div>
    </div>

    <div class="composer-caption">
      {{ t('aiComposerCaption') }}
    </div>
  </div>
</template>

<style scoped>
/* agent-styles.scss:353-406 已经全局定了 .composer-wrap/.composer/
   .composer-textarea/.composer-row/.composer-tool/.send-btn 的布局(sticky 定位、
   pointer-events 开关、圆角/边框/阴影、focus-within 高亮、悬停态等)——这里只
   补它没有的部分,不重复布局规则。 */

.attach-file-input {
  /* Keep the input in the render tree so $refs.attachFileInput.click()
     always lands on a live element. `hidden` attribute also works but some
     browsers won't dispatch synthetic click events on display:none inputs.
     (Vue2 663-673, verbatim.) */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

.composer-chips {
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-bottom: 8px;
}
.ctx-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 4px 4px 7px;
  background: var(--bg-chip);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  font-size: 12px;
  color: var(--text-primary);
  max-width: 280px;
}
.ctx-chip-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctx-chip-path {
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 140px;
}
.ctx-chip-x {
  width: 18px; height: 18px;
  display: grid; place-items: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  background: transparent; border: none; cursor: pointer;
  transition: all 120ms ease;
}
.ctx-chip-x:hover { background: var(--bg-elevated); color: var(--text-primary); }

.composer-textarea::placeholder { color: var(--text-tertiary); }

.composer-spacer { flex: 1; }

.send-btn.busy {
  background: var(--bg-chip);
  color: var(--text-primary);
  box-shadow: none;
}

.composer-caption {
  text-align: center; margin-top: 8px;
  font-size: 11px; color: var(--text-quaternary);
}

.composer-ctx-usage {
  margin-right: 8px;
  flex-shrink: 0;
}
</style>
