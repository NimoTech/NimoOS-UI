<!--
  SlashPopover: `/` command panel, restyled to match
  MentionPopover.vue (the `@` panel) instead of the rejected full-screen
  SlashMenu.vue (see file header there for why it's being retired — a later
  task, not this one, deletes it and wires this one up in AgentComposer.vue).

  User's acceptance decision (2026-07-27): the `/` panel must look and behave
  like the `@` panel — inline, anchored above the composer, ↑↓/Enter/Esc, and
  a two-stage drill (`/init` -> pick an authorized target directory, Esc backs
  out one stage) instead of a full-screen modal with radio buttons.

  Two-stage model (`stage` prop, driven by the composer — not by this
  component): 'command' lists the fixed command constant (COMMANDS, below);
  'target' lists `folders` (the composer's already-authorized directories,
  passed in as a prop — this component makes no service calls of its own,
  unlike MentionPopover which fetches mounts/entries). Keyboard/mouse handling,
  filtering (startsWith=2/includes=1/else drop, sorted desc), the capture-phase
  `window` keydown listener lifecycle, and the `hi` (highlight index) reset
  watchers are ported from MentionPopover.vue's `filtered`/`onKey`/watch block
  verbatim in spirit (this component has no async fetch, so — unlike Mention —
  there's no need for the inner-async-IIFE dance there: attaching the listener
  synchronously inside the `immediate` open-watcher is already race-free here).
-->
<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'

export interface SlashFolder {
  id?: string | number
  path: string
}

interface SlashCommand {
  name: string
  descKey: string
}

// Module-level constant — only one command today ('init'); adding another
// command later is a one-line addition here, not a template rewrite.
const COMMANDS: SlashCommand[] = [
  { name: 'init', descKey: 'aiSlashInitDesc' },
]

const props = withDefaults(
  defineProps<{
    open?: boolean
    stage?: 'command' | 'target'
    query?: string
    folders?: SlashFolder[]
    anchorRect?: DOMRect | null
  }>(),
  {
    open: false,
    stage: 'command',
    query: '',
    folders: () => [],
    anchorRect: null,
  },
)

const emit = defineEmits<{
  (e: 'pick-command', name: string): void
  (e: 'pick-target', path: string): void
  (e: 'back'): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const hi = ref(0)
const listEl = ref<HTMLElement | null>(null)

// Same scoring as MentionPopover.vue's `filtered` computed: startsWith=2,
// includes=1, 0 dropped, sorted score desc — kept identical on purpose so
// both panels' filtering "feel" the same to the user.
const filteredCommands = computed<SlashCommand[]>(() => {
  if (!props.query) return COMMANDS
  const q = props.query.toLowerCase()
  return COMMANDS
    .map((c) => ({ c, score: c.name.toLowerCase().startsWith(q) ? 2 : c.name.toLowerCase().includes(q) ? 1 : 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c)
})

const filteredFolders = computed<SlashFolder[]>(() => {
  if (!props.query) return props.folders
  const q = props.query.toLowerCase()
  return props.folders
    .map((f) => ({ f, score: f.path.toLowerCase().startsWith(q) ? 2 : f.path.toLowerCase().includes(q) ? 1 : 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f)
})

const list = computed<Array<SlashCommand | SlashFolder>>(() =>
  props.stage === 'command' ? filteredCommands.value : filteredFolders.value,
)

const popStyle = computed(() => {
  // Identical to MentionPopover.vue's popStyle — same anchor math, same
  // fallback — so the two panels appear at the same spot/width.
  const r = props.anchorRect
  if (!r) return { left: '24px', bottom: '120px', width: '460px' }
  return {
    left: `${r.left}px`,
    bottom: `${window.innerHeight - r.top + 8}px`,
    width: `${Math.min(r.width, 520)}px`,
  }
})

function isFolder(item: SlashCommand | SlashFolder): item is SlashFolder {
  return 'path' in item
}

function pickItem(item: SlashCommand | SlashFolder): void {
  if (isFolder(item)) emit('pick-target', item.path)
  else emit('pick-command', item.name)
}

function onKey(e: KeyboardEvent): void {
  if (!props.open) return
  const items = list.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    hi.value = Math.min(hi.value + 1, items.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    hi.value = Math.max(hi.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    const item = items[hi.value]
    if (!item) return
    e.preventDefault()
    pickItem(item)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (props.stage === 'target') emit('back')
    else emit('close')
  } else if (e.key === 'Backspace' && !props.query && props.stage === 'target') {
    e.preventDefault()
    emit('back')
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      hi.value = 0
      // Attach the capture-phase listener synchronously in the same tick
      // `open` becomes true — see MentionPopover.vue's watch(open) comment
      // for why this must never move after an `await` (it never does here;
      // this component has no async fetch of its own, so there's nothing
      // that could delay the attach in the first place).
      window.addEventListener('keydown', onKey, true)
    } else {
      window.removeEventListener('keydown', onKey, true)
    }
  },
  { immediate: true },
)

watch(
  () => props.stage,
  () => { hi.value = 0 },
)

watch(
  () => props.query,
  () => { hi.value = 0 },
)

watch(hi, () => {
  nextTick(() => {
    const el = listEl.value?.querySelector(`[data-i="${hi.value}"]`) as HTMLElement | null
    // jsdom doesn't implement scrollIntoView — guard with `?.` (same
    // defensive deviation as MentionPopover.vue).
    el?.scrollIntoView?.({ block: 'nearest' })
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
})
</script>

<template>
  <div
    v-if="open"
    class="slash-pop"
    :style="popStyle"
    @mousedown.prevent
  >
    <!-- Crumbs -->
    <div class="slash-crumbs">
      <span class="slash-slash">/</span>
      <template v-if="stage === 'target'">
        <span class="slash-crumb">init</span>
        <AgentIcon name="chev" :size="11" color="var(--text-quaternary)" />
      </template>
      <template v-if="query">
        <span class="slash-crumb" data-typing>{{ query }}<span class="slash-caret" /></span>
      </template>
      <div class="slash-spacer" />
      <span class="slash-count">{{ list.length }}</span>
    </div>

    <!-- List -->
    <div class="slash-list scroll" ref="listEl">
      <div v-if="list.length === 0" class="slash-empty">
        <AgentIcon name="search" :size="18" color="var(--text-quaternary)" />
        <span>{{ stage === 'command' ? t('aiSlashNoCommand') : t('aiSlashNoFolders') }}</span>
      </div>
      <template v-else>
        <div
          v-for="(item, i) in list"
          :key="isFolder(item) ? (item.id ?? item.path) : item.name"
          class="slash-item"
          :data-i="i"
          :data-active="i === hi"
          @mouseenter="hi = i"
          @mousedown.prevent
          @click="pickItem(item)"
        >
          <template v-if="isFolder(item)">
            <span class="slash-name">{{ item.path }}</span>
          </template>
          <template v-else>
            <span class="slash-name">/{{ item.name }}</span>
            <span class="slash-desc">{{ t(item.descKey) }}</span>
          </template>
        </div>
      </template>
    </div>

    <!-- Footer hints -->
    <div class="slash-foot">
      <span><span class="slash-kbd">↑↓</span> {{ t('aiSlashKbdNav') }}</span>
      <span><span class="slash-kbd">Enter</span> {{ t('aiSlashKbdSelect') }}</span>
      <span><span class="slash-kbd">esc</span> {{ stage === 'target' ? t('aiSlashKbdBack') : t('aiSlashKbdClose') }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Shares its shell (container/list/item/empty/foot/kbd) with MentionPopover.vue
// via src/ai/styles/popover.scss — see that file's header comment for why this
// is a shared *source* rather than a shared runtime stylesheet, and the task
// report for the rule-by-rule equivalence proof against MentionPopover's rules.
@use '../../styles/popover.scss' as pop;

.slash-pop {
  @include pop.pop-container;
}

.slash-crumbs {
  @include pop.crumbs-bar;
}
.slash-spacer { @include pop.crumbs-spacer; }
.slash-slash { font-family: var(--font-mono); font-weight: 700; color: var(--accent); font-size: 13px; margin-right: 1px; }
.slash-crumb { font-weight: 500; white-space: nowrap; color: var(--text-secondary); }
.slash-crumb[data-typing] { color: var(--text-primary); font-weight: 600; position: relative; }
.slash-caret {
  display: inline-block; width: 1.5px; height: 12px;
  background: var(--accent); margin-left: 2px; vertical-align: -2px;
  animation: slash-blink 1s steps(2) infinite;
}
@keyframes slash-blink { 50% { opacity: 0; } }
.slash-count {
  @include pop.crumbs-count;
}

.slash-list { @include pop.pop-list; }
.slash-item {
  @include pop.pop-item;
}
.slash-item[data-active="true"] { @include pop.pop-item-active-bg; }
.slash-item[data-active="true"] .slash-name { color: var(--accent); }
.slash-name {
  @include pop.pop-name;
}
.slash-desc {
  font-size: 11px; color: var(--text-tertiary); flex-shrink: 0;
  max-width: 55%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.slash-empty {
  @include pop.pop-empty;
}

.slash-foot {
  @include pop.pop-foot;
}
.slash-kbd {
  @include pop.pop-kbd;
}
</style>
