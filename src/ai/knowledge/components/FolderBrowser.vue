<!--
  SP8-P5c Task 3 (half two) — directory selector for "add root directory". 1:1 ported from the
  Vue 2 panel's blueprint `src/components/common/FolderBrowser.vue` (143 lines,
  read via `git show main:` rather than the on-disk working tree, which was a stale branch).

  Structure mapping (blueprint line → this file):
    :1-29   Template block (breadcrumbs + list 4 branches) — copied verbatim, including :5 String()
    :39-41  prop roots
    :43     data (current / entries / loading / error)
    :46     computed crumbs = crumbsFor(current, $t('Volumes'))
    :49-55  reset()
    :56-74  go(path)
    :76-78  created() { this._seq = 0 }
    :82-143 <style scoped> — 🔴 this file **zero <style> block**: those 8 .fb* classes
            moved to `src/ai/styles/knowledge.scss:1647-1712` (nested in .knowledge-app)
            by P5c T2a, review passed. This round doesn't touch scss.

  【K27 / K28 — fetch unwrapping, easiest place to crash in this file】
    Blueprint :64-66 is `folder.getList(path)` +
    `(r.data && r.data.data && r.data.data.content) || []` — **three layers**
    (HTTP raw is `{success,message,data:{content,…}}`, axios wraps again with `.data`).
    This repo's shared package `folder.ts:7-10` already does `return unwrap<FolderListing>(res.data)`
    → `service.folder.getList()` directly yields **single layer** `{ content: FolderEntry[] }`
    → write `listing.content || []` here. K1 family Nth time.
    ⚠️ 【N7】 `|| []` fallback **must not delete** (necessary defense against Go nil slice
    serializing to null).

  【§5.2 `_seq` race guard — copy blueprint, don't change style or extract common guard】
    `seq` is **component-local** `let` (not module-level — module-level would cross-instance
    conflict, not `ref` either: doesn't participate in render). `reset()` increments then
    clears state, `go()` has `const mySeq = ++seq`, success branch and catch each have one
    `if (mySeq !== seq) return`, finally has **positive** `if (mySeq === seq)` — four places
    order and form copied verbatim. 🔴 Blueprint `reset()` called before `created()` would
    get `NaN` (`this._seq` not yet initialized), but actual call is in parent `$nextTick`,
    `created` already ran → unreachable; Vue3 here `let seq = 0` has value at setup time,
    unreachable path doesn't even exist.

  【i18n】 uses 4 aiKbFb* keys already landed by T1 (aiKbFbLoading / aiKbFbLoadFailed /
    aiKbFbNoVolumes / aiKbFbEmpty) + crumbs root tag aiKbFbVolumes. **zero new keys.**
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import KIcon from './KIcon.vue'
import { crumbsFor, dirEntries } from '../util/folderBrowser'
import type { DirEntry, PickerCandidate } from '../util/folderBrowser'

/** Blueprint :39-41 — `[{path, label}]`, label optional (template has `|| r.path` fallback). */
const props = withDefaults(defineProps<{ roots?: PickerCandidate[] }>(), { roots: () => [] })
const emit = defineEmits<{ (e: 'pick', path: string): void }>()

const { t } = useI18n()

/** Blueprint :43 data(). */
const current = ref('')
const entries = ref<DirEntry[]>([])
const loading = ref(false)
const error = ref('')

/** Blueprint :77 `created(){ this._seq = 0 }` — component-local, not module-level. */
let seq = 0

/** Blueprint :46. */
const crumbs = computed(() => crumbsFor(current.value, t('aiKbFbVolumes')))

/** Blueprint :49-55 — increment _seq first (discard in-flight requests) then clear state, order copied. */
function reset(): void {
  seq++
  current.value = ''
  entries.value = []
  error.value = ''
  loading.value = false
}

/** Blueprint :56-74. emit('pick') position copied: after "empty path direct return" —
 *  clicking root breadcrumb (path === '') doesn't emit. */
async function go(path: string): Promise<void> {
  current.value = path
  error.value = ''
  if (!path) { entries.value = []; return }
  emit('pick', path)
  const mySeq = ++seq
  loading.value = true
  try {
    const listing = await service.folder.getList(path)
    if (mySeq !== seq) return
    entries.value = dirEntries(listing.content || []) // K28: single layer + N7 fallback
  } catch {
    if (mySeq !== seq) return
    entries.value = []
    error.value = t('aiKbFbLoadFailed')
  } finally {
    if (mySeq === seq) loading.value = false
  }
}

/** Blueprint uses `$refs.fb.reset()` call (parent SettingsView) → Vue3 explicit expose. */
defineExpose({ reset })
</script>

<template>
  <div class="fb">
    <div class="fb-crumbs">
      <button v-for="(c, i) in crumbs" :key="c.path || 'root'"
              class="fb-crumb" :data-last="String(i === crumbs.length - 1)"
              @click="go(c.path)">{{ c.label }}</button>
    </div>
    <div class="fb-list">
      <div v-if="loading" class="fb-stub">{{ t('aiKbFbLoading') }}</div>
      <div v-else-if="error" class="fb-stub fb-err">{{ error }}</div>
      <template v-else-if="current === ''">
        <button v-for="r in props.roots" :key="r.path" class="fb-row" @click="go(r.path)">
          <KIcon name="drive" :size="13"/>
          <span class="fb-name">{{ r.label || r.path }}</span>
          <KIcon name="chev" :size="10"/>
        </button>
        <div v-if="!props.roots.length" class="fb-stub">{{ t('aiKbFbNoVolumes') }}</div>
      </template>
      <template v-else>
        <button v-for="e in entries" :key="e.path" class="fb-row" @click="go(e.path)">
          <KIcon name="folder" :size="13"/>
          <span class="fb-name">{{ e.name }}</span>
          <KIcon name="chev" :size="10"/>
        </button>
        <div v-if="!entries.length" class="fb-stub">{{ t('aiKbFbEmpty') }}</div>
      </template>
    </div>
  </div>
</template>
