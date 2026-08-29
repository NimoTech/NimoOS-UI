<!--
  1:1 ported from Vue2 src/views/AI/Agent/blocks/TerminalCard.vue — the Vue2 source file itself
  has no <style> block: all `.term*` styles live in the global agent-styles.scss (that file was
  ported wholesale in Task 1a into src/ai/styles/agent-styles.scss and is globally imported by
  AgentPage.vue; the file header comment notes "1:1 ported from Vue2 Agent; literal color values
  are part of the existing system in this scope, exempt from global token rules" — `.term-*` rule
  meaning derives from this same exemption, not redefined/scoped here to maintain Vue2 verbatim
  equivalence. Two exceptions: two meta-line icons where Vue2 directly wrote `color="rgba(255,255,255,0.5)"`
  (not through CSS classes); those two use the new `--term-icon-dim` token (see tokens.scss), no longer
  bare literals.
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
