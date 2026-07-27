<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/MentionPopover.vue(409 行)。
  纯展示/交互组件:props 驱动 open/query/segments/anchorRect,emit
  drill-in/pick/pop-segment/close——由后续任务(composer)负责检测输入里的
  "@" 并喂 query/segments、处理 pick。本任务不接线。

  机械转换清单(对应 .superpowers/sdd/p1c1-task-7-brief.md Step 3):
  1. $set(loadingPaths,...)/$set(entriesByPath,...)(Vue2:215-234)→ ref<Record<...>>
     直接赋值——Vue3 Proxy 响应式对新 key 赋值天然可追踪,无需 $set。
  2. beforeDestroy(Vue2:195-197)→ onBeforeUnmount,摘掉 window.keydown 捕获监听;
     open watcher 里 add/remove 的配对逻辑保留(Vue2:172-181),见下方 watch(open)。
  3. v-for + v-else 同元素(Vue2:44-46)→ 外层 <template v-else> 包住 v-for。
  4. <template v-for> 的 key 移到 <template> 上(Vue2:15-18)——Vue2 原写法把
     chev 图标和 crumb span 分别用 `c${i}`/`s${i}` 两把 key,但 Vue3 的
     <template v-for> 只能在 <template> 本身挂一把 key,故合并为单一 key。
  5. >>> 深选择器(Vue2:370)→ :deep(mark)。
  6. hi watcher 里 $nextTick + querySelector(...).scrollIntoView(...)(Vue2:187-193)
     → nextTick + ref 取 DOM;jsdom 里 scrollIntoView 可能不存在,调用前 `?.` 守卫
     (允许的防御性偏离,brief 明确认可)。
  7. 补 Vue2 缺的 catch——见 loadMounts/loadCurrent 内注释。
  8. popStyle(Vue2:161-169)照抄。
  9. 键盘 onKey(Vue2:235-268)逐案照抄。
  10. 样式:position:fixed + pointer-events:auto 保留(祖先 .composer-wrap 是
      pointer-events:none);--hairline-ring 新 token 替换裸 rgba 发丝环;
      [data-theme=dark] 覆盖背景整条删除,统一走 --glass-strong。

  另一处偏离(非 Vue2 缺陷,是本仓库的正确性修复,见下方 watch(open) 内注释):
  Vue2 的 open watcher 里 loadMounts()/loadCurrent() 是"发了就不等"地并发调用——
  若 segments 在组件"第一次以 open=true 创建"时就已非空(mounts 此时还是空数组),
  currentAbsolute 算出来是 '',loadCurrent 会直接空跑且此后再无人重试,导致这类
  "带初始 segments 打开"的场景永远拉不到条目。这里在需要先加载 mounts 时
  await 一下再决定是否 loadCurrent,修掉这个时序坑。
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
  async (v) => {
    if (v) {
      hi.value = 0
      // See file-header note: await the mounts fetch first when it's needed,
      // so currentAbsolute (which depends on `mounts`) is resolvable before
      // loadCurrent runs — fixes a Vue2 ordering bug (see header comment).
      if (mounts.value.length === 0) await loadMounts()
      if (props.segments.length > 0) loadCurrent()
      window.addEventListener('keydown', onKey, true)
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
        <span v-if="query">{{ t('aiMentionNoMatch', { query }) }}</span>
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

<style scoped>
.mention-pop {
  position: fixed; z-index: 1000;
  pointer-events: auto;
  background: var(--glass-strong);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg), 0 0 0 0.5px var(--hairline-ring);
  overflow: hidden;
  display: flex; flex-direction: column;
  max-height: 360px;
  animation: mention-rise 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: bottom left;
  font-size: 13px;
}
@keyframes mention-rise {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.mention-crumbs {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line-faint);
  font-size: 12px;
  color: var(--text-secondary);
  flex-wrap: nowrap;
  overflow: hidden;
}
.mention-spacer { flex: 1; }
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
  font-size: 11px; color: var(--text-quaternary);
  font-variant-numeric: tabular-nums; flex-shrink: 0;
}

.mention-list { flex: 1; overflow-y: auto; padding: 4px; min-height: 0; }
.mention-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background 80ms ease;
}
.mention-item[data-active="true"] { background: var(--accent-soft); }
.mention-item[data-active="true"] .mention-name { color: var(--accent); }
.mention-item[data-active="true"] .mention-drill { color: var(--accent); opacity: 1; }
.mention-item[data-ignored="true"] { opacity: 0.55; }
.mention-name {
  flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
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
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 28px 16px; gap: 8px;
  color: var(--text-tertiary); font-size: 13px;
}
.mention-empty-hint { font-size: 11px; color: var(--text-quaternary); }

.mention-foot {
  display: flex; align-items: center; gap: 12px;
  padding: 7px 12px;
  border-top: 1px solid var(--line-faint);
  background: var(--bg-sunken);
  font-size: 11px; color: var(--text-tertiary);
  flex-wrap: wrap;
}
.mention-kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px; font-weight: 600;
  color: var(--text-secondary); margin-right: 4px;
  box-shadow: 0 1px 0 var(--line); vertical-align: -2px;
}
</style>
