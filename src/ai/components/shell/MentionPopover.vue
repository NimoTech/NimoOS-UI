<!--
  1:1 ported from Vue2 src/views/AI/Agent/shell/MentionPopover.vue (409 lines).
  Pure display/interaction component: props drive open/query/segments/anchorRect, emit
  drill-in/pick/pop-segment/close — a later task (composer) is responsible for detecting
  "@" in the input and feeding query/segments, and for handling pick. This task doesn't wire it up.

  Mechanical conversion checklist:
  1. $set(loadingPaths,...)/$set(entriesByPath,...) (Vue2:215-234) → ref<Record<...>>
     direct assignment — Vue3 Proxy reactivity naturally tracks assignment to new keys, no $set needed.
  2. beforeDestroy (Vue2:195-197) → onBeforeUnmount, removes the window keydown capture listener;
     the open watcher's add/remove pairing logic is kept (Vue2:172-181), see watch(open) below.
  3. v-for + v-else on the same element (Vue2:44-46) → an outer <template v-else> wraps the v-for.
  4. The key on <template v-for> moved onto the <template> itself (Vue2:15-18) — the Vue2 original
     used two separate keys, `c${i}`/`s${i}`, for the chev icon and the crumb span, but Vue3's
     <template v-for> can only carry one key on the <template> itself, so they're merged into one.
  5. >>> deep selector (Vue2:370) → :deep(mark).
  6. hi watcher's $nextTick + querySelector(...).scrollIntoView(...) (Vue2:187-193)
     → nextTick + ref for DOM access; scrollIntoView may not exist in jsdom, guard with `?.` before calling
     (an allowed defensive deviation, explicitly approved by the brief).
  7. Added the catch Vue2 was missing — see the comments inside loadMounts/loadCurrent.
  8. popStyle (Vue2:161-169) copied as-is.
  9. Keyboard onKey (Vue2:235-268) copied case-by-case as-is.
  10. Styling: position:fixed + pointer-events:auto kept (the ancestor .composer-wrap is
      pointer-events:none); the new --hairline-ring token replaces the bare rgba hairline ring;
      the [data-theme=dark] background override block is removed entirely, using --glass-strong throughout.

  Another deviation (not a Vue2 defect — a correctness fix made in this repo, see the watch(open) comment below):
  In Vue2's open watcher, loadMounts()/loadCurrent() are called concurrently, fire-and-forget —
  if segments is already non-empty the first time the component is created with open=true (mounts is
  still an empty array at that point), currentAbsolute evaluates to '', loadCurrent runs as a no-op and
  nothing ever retries it afterward, so this "opened with initial segments" scenario can never load its
  entries. Here, when mounts needs loading first, we await it before deciding whether to call
  loadCurrent, fixing this timing bug.

  Review fix (2026-07-27): the await introduced above created a new problem — window.addEventListener
  must be attached synchronously, in the same tick that open becomes true, before the await. Otherwise
  (a) keys pressed while the mounts request is still in flight do nothing, and (b) if the component
  unmounts while suspended on that await, onBeforeUnmount runs first (there's nothing to remove yet
  since the listener hasn't attached), the listener attaches anyway once the await resumes, and it is
  never removed again — a capture-phase window listener leaks permanently. The fix, in watch(open)
  below: the listener-attach line must stay synchronous, executed before any await; the mounts/loadCurrent
  loading is moved into an inner async IIFE, so it never blocks the listener attach and the listener-attach
  line never ends up after an await.
-->
<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AgentIcon from '../icons/AgentIcon.vue'
import KindIcon from './KindIcon.vue'
import { driveColor, formatBytes, formatTime, highlightMatch, getExt } from '../../util/mentionFormat'

export interface MentionItem {
  name: string
  resolvedPath: string
  kind: 'drive' | 'folder' | 'file'
  ext?: string
  size?: number
  modified?: number | string
  ignored?: boolean
  color?: string
  capacity?: number
  used?: number
}

const props = withDefaults(
  defineProps<{
    open?: boolean
    query?: string
    segments?: string[]
    anchorRect?: DOMRect | null
  }>(),
  {
    open: false,
    query: '',
    segments: () => [],
    anchorRect: null,
  },
)

const emit = defineEmits<{
  (e: 'drill-in', item: MentionItem): void
  (e: 'pick', item: MentionItem): void
  (e: 'pop-segment'): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const hi = ref(0)
const mounts = ref<MentionItem[]>([])
const loadingMounts = ref(false)
const entriesByPath = ref<Record<string, MentionItem[]>>({})
const loadingPaths = ref<Record<string, boolean>>({})
const listEl = ref<HTMLElement | null>(null)

const currentAbsolute = computed(() => {
  // Resolve segments to an absolute filesystem path using mounts.
  if (props.segments.length === 0) return ''
  const mount = mounts.value.find((m) => m.name === props.segments[0])
  if (!mount) return ''
  const tail = props.segments.slice(1).join('/')
  return tail ? `${mount.resolvedPath}/${tail}` : mount.resolvedPath
})

const children = computed(() => {
  if (props.segments.length === 0) return mounts.value
  return entriesByPath.value[currentAbsolute.value] || []
})

const loading = computed(() => {
  if (props.segments.length === 0) return loadingMounts.value && mounts.value.length === 0
  const abs = currentAbsolute.value
  return !!loadingPaths.value[abs] && !entriesByPath.value[abs]
})

const filtered = computed(() => {
  if (!props.query) return children.value
  const q = props.query.toLowerCase()
  return children.value
    .map((c) => ({
      c,
      score: c.name.toLowerCase().startsWith(q) ? 2 : c.name.toLowerCase().includes(q) ? 1 : 0,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c)
})

const popStyle = computed(() => {
  const r = props.anchorRect
  if (!r) return { left: '24px', bottom: '120px', width: '460px' }
  return {
    left: `${r.left}px`,
    bottom: `${window.innerHeight - r.top + 8}px`,
    width: `${Math.min(r.width, 520)}px`,
  }
})

async function loadMounts() {
  loadingMounts.value = true
  try {
    const r = (await service.ai.listMounts()) as any[] | null | undefined
    mounts.value = (r || []).map((m: any) => ({
      name: m.label || m.path,
      resolvedPath: m.path,
      kind: 'drive' as const,
      color: driveColor(m.label || m.path),
      capacity: m.total,
      used: m.used,
    }))
  } catch {
    // Fix for Vue2 MentionPopover.vue:199-213 — try/finally with no catch there
    // means a rejected listMounts() promise is an unhandled rejection. Leaving
    // mounts empty is safe: loadMounts only runs while mounts.length === 0, so
    // the next `open` retries automatically.
  } finally {
    loadingMounts.value = false
  }
}

async function loadCurrent() {
  const abs = currentAbsolute.value
  if (!abs || entriesByPath.value[abs] || loadingPaths.value[abs]) return
  loadingPaths.value[abs] = true
  try {
    const r = (await service.ai.listFsEntries(abs, false)) as any[] | null | undefined
    entriesByPath.value[abs] = (r || []).map((e: any) => ({
      name: e.name,
      resolvedPath: e.path,
      kind: e.kind === 'dir' ? ('folder' as const) : ('file' as const),
      ext: e.kind === 'file' ? getExt(e.name) : '',
      size: e.size,
      modified: e.modified,
      ignored: !!e.ignored,
    }))
  } catch {
    // Fix for Vue2 MentionPopover.vue:215-234 — same missing-catch defect as
    // loadMounts above. Leave entriesByPath[abs] unset so the next open (or
    // re-drill into this same path) retries the fetch.
  } finally {
    loadingPaths.value[abs] = false
  }
}

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  const list = filtered.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    hi.value = Math.min(hi.value + 1, list.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    hi.value = Math.max(hi.value - 1, 0)
  } else if (e.key === 'Tab') {
    const item = list[hi.value]
    if (!item) return
    e.preventDefault()
    if (item.kind !== 'file') emit('drill-in', item)
    else emit('pick', item)
  } else if (e.key === 'Enter' || e.key === ' ') {
    const item = list[hi.value]
    if (!item) return
    e.preventDefault()
    emit('pick', item)
  } else if (e.key === '/') {
    const item = list[hi.value]
    if (item && item.kind !== 'file') {
      e.preventDefault()
      emit('drill-in', item)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'Backspace' && !props.query && props.segments.length > 0) {
    e.preventDefault()
    emit('pop-segment')
  }
}

function onClickItem(item: MentionItem) {
  if (item.kind === 'file') emit('pick', item)
  else emit('drill-in', item)
}

function highlight(name: string): string {
  return highlightMatch(name, props.query)
}

function formatSize(n: number): string {
  return formatBytes(n)
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      hi.value = 0
      // Attach the capture-phase listener synchronously, in the same tick
      // `open` becomes true — before any await. This matters for two reasons:
      // (1) keys pressed while the mounts fetch is still in flight must work
      // (Vue2 attached synchronously too, since its fetches were fire-and-forget);
      // (2) it guarantees nothing ever attaches a listener *after* this watcher
      // callback has already returned — so if the component unmounts while the
      // mounts fetch is still pending, onBeforeUnmount's removeEventListener is
      // always the last word and no listener is left dangling with no cleanup
      // path (review fix — real trigger: open the popover, then close/navigate
      // away before the network round-trip finishes).
      window.addEventListener('keydown', onKey, true)
      // See file-header note: await the mounts fetch first when it's needed,
      // so currentAbsolute (which depends on `mounts`) is resolvable before
      // loadCurrent runs — fixes a Vue2 ordering bug (see header comment).
      // Run this in an inner async IIFE (rather than making the watcher
      // callback itself async) so the listener attach above always happens
      // synchronously and this awaited work never gates it.
      ;(async () => {
        if (mounts.value.length === 0) await loadMounts()
        if (props.segments.length > 0) loadCurrent()
      })()
    } else {
      window.removeEventListener('keydown', onKey, true)
    }
  },
  { immediate: true },
)

watch(
  () => props.segments,
  () => {
    hi.value = 0
    if (props.open && props.segments.length > 0) loadCurrent()
  },
)

watch(
  () => props.query,
  () => { hi.value = 0 },
)

watch(hi, () => {
  nextTick(() => {
    const el = listEl.value?.querySelector(`[data-i="${hi.value}"]`) as HTMLElement | null
    // jsdom doesn't implement scrollIntoView — guard with `?.` (allowed
    // defensive deviation from Vue2 MentionPopover.vue:187-193).
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
    class="mention-pop"
    :style="popStyle"
    @mousedown.prevent
  >
    <!-- Crumbs -->
    <div class="mention-crumbs">
      <span class="mention-at">@</span>
      <template v-if="segments.length === 0">
        <span class="mention-crumb" data-root="true">{{ t('aiMentionAllDrives') }}</span>
      </template>
      <template v-else>
        <template v-for="(s, i) in segments" :key="i">
          <AgentIcon v-if="i > 0" name="chev" :size="11" color="var(--text-quaternary)" />
          <span class="mention-crumb">{{ s }}</span>
        </template>
      </template>
      <template v-if="query">
        <AgentIcon name="chev" :size="11" color="var(--text-quaternary)" />
        <span class="mention-crumb" data-typing>{{ query }}<span class="mention-caret" /></span>
      </template>
      <div class="mention-spacer" />
      <span class="mention-count">
        {{ filtered.length }} {{ segments.length === 0 ? t('aiMentionDrives') : t('aiMentionItems') }}
      </span>
    </div>

    <!-- List -->
    <div class="mention-list scroll" ref="listEl">
      <div v-if="loading" class="mention-empty">
        <AgentIcon name="refresh" :size="18" color="var(--text-quaternary)" />
        <span>{{ t('aiMentionLoading') }}</span>
      </div>
      <div v-else-if="filtered.length === 0" class="mention-empty">
        <AgentIcon name="search" :size="18" color="var(--text-quaternary)" />
        <i18n-t v-if="query" keypath="aiMentionNoMatchTpl" tag="span">
          <template #query><b>"{{ query }}"</b></template>
        </i18n-t>
        <span v-else>{{ t('aiMentionEmptyHere') }}</span>
        <span class="mention-empty-hint">
          {{ t('aiMentionTryDifferentName') }} <span class="mention-kbd">⌫</span> {{ t('aiMentionUpHint') }}
        </span>
      </div>
      <template v-else>
        <div
          v-for="(item, i) in filtered"
          :key="item.resolvedPath"
          class="mention-item"
          :data-i="i"
          :data-active="i === hi"
          :data-ignored="item.ignored ? 'true' : null"
          @mouseenter="hi = i"
          @mousedown.prevent
          @click="onClickItem(item)"
        >
          <KindIcon :kind="item.kind" :ext="item.ext" :color="item.color" :size="16" />
          <div class="mention-name" v-html="highlight(item.name)" />
          <div class="mention-meta">
            <!-- Declared deviation (final review, 2026-07-27): Vue2 MentionPopover.vue:59
                 prints the raw byte counts `{{ item.used }} / {{ item.capacity }}` (e.g.
                 "500107862016 / 1000204885504"). Treated as a Vue2 presentation defect under
                 the project rule (logic follows correctness) — every sibling row in this same
                 list already goes through formatSize, so raw bytes here would be the odd one
                 out. Intentionally formatted; not a missed 1:1 port. -->
            <span v-if="item.kind === 'drive' && item.used && item.capacity">{{ formatSize(item.used) }} / {{ formatSize(item.capacity) }}</span>
            <span v-else-if="item.kind === 'folder'">{{ t('aiMentionFolder') }}</span>
            <span v-else-if="item.kind === 'file' && item.size != null">{{ formatSize(item.size) }}</span>
            <span v-if="item.modified" class="mention-mod">· {{ formatTime(item.modified) }}</span>
            <span v-if="item.ignored" class="mention-ignored">{{ t('aiMentionIgnored') }}</span>
          </div>
          <div v-if="item.kind !== 'file'" class="mention-drill">
            <AgentIcon name="chev" :size="12" color="var(--text-tertiary)" />
          </div>
        </div>
      </template>
    </div>

    <!-- Footer hints -->
    <div class="mention-foot">
      <span><span class="mention-kbd">↑↓</span> {{ t('aiMentionKbdNav') }}</span>
      <span><span class="mention-kbd">Tab</span> {{ t('aiMentionKbdDrill') }}</span>
      <span><span class="mention-kbd">Space</span> {{ t('aiMentionKbdSelect') }}</span>
      <span><span class="mention-kbd">⌫</span> {{ t('aiMentionKbdUp') }}</span>
      <span><span class="mention-kbd">esc</span> {{ t('aiMentionKbdClose') }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
// SP8-P1c1 patch task 2 — shell rules (container/list/item/empty/foot/kbd)
// moved into shared mixins (src/ai/styles/popover.scss) so SlashPopover.vue
// can render as the visually identical panel the user asked for. Every
// `@include` below reproduces its prior literal declaration block unchanged —
// see the task report for the rule-by-rule before/after diff. Panel-specific
// rules (crumb glyph, typing caret, drill chevron, ignored/meta styling) are
// untouched, still written out here directly.
@use '../../styles/popover.scss' as pop;

.mention-pop {
  @include pop.pop-container;
}

.mention-crumbs {
  @include pop.crumbs-bar;
}
.mention-spacer { @include pop.crumbs-spacer; }
.mention-at { font-family: var(--font-mono); font-weight: 700; color: var(--accent); font-size: 13px; margin-right: 1px; }
.mention-crumb { font-weight: 500; white-space: nowrap; color: var(--text-secondary); }
.mention-crumb[data-root="true"] { color: var(--text-tertiary); }
.mention-crumb[data-typing] { color: var(--text-primary); font-weight: 600; position: relative; }
.mention-caret {
  display: inline-block; width: 1.5px; height: 12px;
  background: var(--accent); margin-left: 2px; vertical-align: -2px;
  animation: blink 1s steps(2) infinite;
}
@keyframes blink { 50% { opacity: 0; } }
.mention-count {
  @include pop.crumbs-count;
}

.mention-list { @include pop.pop-list; }
.mention-item {
  @include pop.pop-item;
}
.mention-item[data-active="true"] { @include pop.pop-item-active-bg; }
.mention-item[data-active="true"] .mention-name { color: var(--accent); }
.mention-item[data-active="true"] .mention-drill { color: var(--accent); opacity: 1; }
.mention-item[data-ignored="true"] { opacity: 0.55; }
.mention-name {
  @include pop.pop-name;
}
.mention-name :deep(mark) {
  background: transparent; color: var(--accent); font-weight: 700;
  text-decoration: underline; text-decoration-color: var(--accent-soft);
  text-underline-offset: 2px;
}
.mention-meta {
  display: flex; gap: 4px; font-size: 11px;
  color: var(--text-tertiary); font-variant-numeric: tabular-nums; flex-shrink: 0;
}
.mention-mod { color: var(--text-quaternary); }
.mention-ignored { color: var(--warning); margin-left: 4px; }
.mention-drill { opacity: 0.5; flex-shrink: 0; display: grid; place-items: center; }

.mention-empty {
  @include pop.pop-empty;
}
.mention-empty-hint { @include pop.pop-empty-hint; }

.mention-foot {
  @include pop.pop-foot;
}
.mention-kbd {
  @include pop.pop-kbd;
}
</style>
