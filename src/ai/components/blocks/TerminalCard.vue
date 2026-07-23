<!--
  1:1 移植自 Vue2 src/views/AI/Agent/blocks/TerminalCard.vue —— Vue2 源文件本身
  没有 <style> 块:`.term*` 全部样式活在全局 agent-styles.scss 里(该文件已在
  Task 1a 整体移植进 src/ai/styles/agent-styles.scss,并由 AgentPage.vue 全局
  引入,文件顶部注释已注明"1:1 移植自 Vue2 Agent;字面色值为作用域内既有体系,
  豁免全局 token 规则"——.term-* 规则含义与该豁免同源,这里不再重复定义/加
  scoped 样式,以保持与 Vue2 verbatim 一致。唯二例外:两处 meta 行图标 Vue2 直接写
  `color="rgba(255,255,255,0.5)"`(未走 CSS 类),这两处改用新增的 `--term-icon-dim`
  token(见 tokens.scss),不再是裸字面量。
-->
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

interface TerminalLine { text: string; stream?: string }
interface TerminalApproval { title?: string; reason?: string }

const props = withDefaults(
  defineProps<{
    command: string
    cwd?: string
    shell?: string
    sandbox?: string
    state?: string // running | success | error | warn | approval
    exitCode?: number
    durationMs?: number | null
    lines?: TerminalLine[]
    streamingLine?: TerminalLine | null
    approval?: TerminalApproval | null
    defaultOpen?: boolean
  }>(),
  {
    cwd: '/work',
    shell: 'bash',
    sandbox: 'nimo-sandbox',
    state: 'success',
    exitCode: undefined,
    durationMs: null,
    lines: () => [],
    streamingLine: null,
    approval: null,
    defaultOpen: true,
  },
)
const emit = defineEmits<{ (e: 'deny'): void; (e: 'approve'): void }>()

const STATE_BADGE: Record<string, { label: string; icon: string | null }> = {
  running: { label: 'Running', icon: null },
  success: { label: 'Exited 0', icon: 'check' },
  error: { label: 'Exit', icon: 'x' },
  warn: { label: 'Approval', icon: null },
  approval: { label: 'Awaiting approval', icon: null },
}

const TOKEN_RE = /(--?[a-zA-Z][\w-]*)|("[^"]*"|'[^']*')/g

const open = ref(props.defaultOpen)
const body = ref<HTMLElement | null>(null)

const badge = computed(() => {
  const b = STATE_BADGE[props.state] || { label: '—', icon: null }
  if (props.state === 'error') {
    return { ...b, label: `Exit ${props.exitCode != null ? props.exitCode : 1}` }
  }
  return b
})

const durationLabel = computed(() => {
  const ms = props.durationMs
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
})

const cmdTokens = computed(() => {
  const cmd = props.command || ''
  const out: Array<{ cls: string; text: string }> = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(cmd))) {
    if (m.index > last) out.push({ cls: '', text: cmd.slice(last, m.index) })
    if (m[1]) out.push({ cls: 'flag', text: m[1] })
    else out.push({ cls: 'str', text: m[2] })
    last = m.index + m[0].length
  }
  if (last < cmd.length) out.push({ cls: '', text: cmd.slice(last) })
  return out
})

function scrollBody() {
  nextTick(() => {
    const el = body.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
watch(() => props.lines, scrollBody)
watch(() => props.streamingLine, scrollBody, { deep: true })

function copy(text: string | null | undefined) {
  if (!text) return
  const c = navigator.clipboard
  if (c && c.writeText) c.writeText(text).catch(() => {})
}
function copyOutput() {
  const text = props.lines.map((l) => l.text).join('\n')
  copy(text)
}
</script>

<template>
  <div class="term">
    <div class="term-head">
      <div class="term-lights"><span /><span /><span /></div>
      <div class="term-title">{{ sandbox }} — {{ shell }}</div>
      <div class="term-badge" :data-state="state">
        <span v-if="state === 'running'" class="dots">
          <span /><span /><span />
        </span>
        <AgentIcon v-else-if="badge.icon" :name="badge.icon" :size="10" :stroke-width="2.5" />
        {{ badge.label }}
      </div>
    </div>

    <div class="term-meta">
      <div class="term-meta-item">
        <AgentIcon name="folder" :size="11" color="var(--term-icon-dim)" />
        <code>{{ cwd }}</code>
      </div>
      <span class="term-meta-sep">·</span>
      <div class="term-meta-item">
        <AgentIcon name="layers" :size="11" color="var(--term-icon-dim)" />
        <code>{{ sandbox }}</code>
      </div>
      <template v-if="durationMs != null">
        <span class="term-meta-sep">·</span>
        <div class="term-meta-item">{{ durationLabel }}</div>
      </template>
      <span class="term-meta-spacer" />
      <button class="term-meta-toggle" @click="open = !open">
        {{ open ? 'Collapse' : 'Expand' }}
      </button>
    </div>

    <template v-if="open">
      <div class="term-cmd">
        <span class="term-prompt">$</span>
        <div class="term-cmd-text">
          <span v-for="(t, i) in cmdTokens" :key="i" :class="t.cls">{{ t.text }}</span>
        </div>
      </div>

      <div
        v-if="lines.length > 0 || streamingLine || state === 'running'"
        ref="body"
        class="term-body"
      >
        <span
          v-for="(l, i) in lines"
          :key="i"
          class="term-line"
          :data-stream="l.stream || 'stdout'"
        >{{ l.text }}
</span>
        <span
          v-if="streamingLine"
          class="term-line"
          :data-stream="streamingLine.stream || 'stdout'"
        >{{ streamingLine.text }}<span class="term-cursor" /></span>
        <span v-else-if="state === 'running'" class="term-cursor" />
      </div>

      <div v-if="state === 'approval' && approval" class="term-approval">
        <div class="term-approval-icon">
          <AgentIcon name="bell" :size="12" />
        </div>
        <div class="term-approval-text">
          <div class="term-approval-title">
            {{ approval.title || 'This command will modify files' }}
          </div>
          <div v-if="approval.reason" class="term-approval-reason">{{ approval.reason }}</div>
        </div>
        <button class="deny" @click="emit('deny')">Deny</button>
        <button class="approve" @click="emit('approve')">Approve once</button>
      </div>

      <div class="term-foot">
        <button @click="copy(command)">
          <AgentIcon name="copy" :size="11" /> Copy command
        </button>
        <button @click="copyOutput">
          <AgentIcon name="copy" :size="11" /> Copy output
        </button>
        <div class="right">
          <span v-if="lines.length > 0">{{ lines.length }} lines</span>
          <template v-if="state === 'success' && exitCode === 0">
            <span class="term-foot-sep">·</span>
            <span class="term-foot-ok">● ok</span>
          </template>
          <template v-else-if="state === 'error'">
            <span class="term-foot-sep">·</span>
            <span class="term-foot-fail">● failed</span>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
