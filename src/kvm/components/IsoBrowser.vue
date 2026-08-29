<script setup lang="ts">
// ISO selector dialog—custom (local file browse) section. Visual 1:1 mirrors Vue2 components/KVM/OSSelector.vue
// template :54-93 (collapsible title bar + breadcrumb + file list); logic mirrors fetchCustomDir (:304-321) /
// navigateCustomUp (:323-326) / handleCustomItemClick (:328-361)—the latter two have been moved into
// useIsoBrowser composable (Task 6, new in this task); this component only handles rendering and translates clicks
// into composable calls + emit('select', ...) to parent.
//
// Task 5's OsSelector official template section is a pure presentation layer (isos held by page-level useIsoList),
// but this component differs: local directory browse state (current path / list / loading) only makes sense during
// the "custom area expanded" interaction, with no reason to reuse across components or continue after dialog close
// (unlike ISO download progress), so let IsoBrowser create its own useIsoBrowser() instance; dispose() on component
// unmount.
import { computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { useIsoBrowser } from '../composables/useIsoBrowser'
import { isIsoFile, formatFileSize, matchTemplateByFilename } from '../util/isoMatch'
import { osIconFor } from '../util/format'
import type { IsoRow } from '../composables/useIsoList'
import type { SelectedOs } from './OsSelector.vue'

const props = defineProps<{
  isos: IsoRow[]
  /** SP16 Task 6: expanded state is held by parent component. Vue2's selector component is permanently mounted,
   * so once this section expands it stays expanded; dialog content here is unmounted by reka each time it closes,
   * with state left in the component inevitably resetting—user expands, selects, opens again, must re-expand. Parent
   * component (KvmPage) holds it; this component only reports toggle actions. Explicit props/emit instead of defineModel,
   * following this repo's existing convention. */
  expanded: boolean
}>()
const emit = defineEmits<{
  select: [os: SelectedOs]
  'update:expanded': [v: boolean]
}>()

const { t } = useI18n()

// Intentionally not destructured (don't write `const { path, items, isLoading } = useIsoBrowser()`): Vue's ref
// auto-unwrap (and vue-tsc's corresponding type narrowing for ref in templates) only happens in the case "top-level
// setup binding is itself a ref"—once destructured path/items/isLoading as top-level bindings, bare `path` in template
// gets auto-unwrapped to string, but explicit `path.value` would be seen by vue-tsc as "accessing .value on string"
// and report type error (TS2551, tested and works); accessing nested property on a non-ref plain object (`browser.path`)
// doesn't get this auto-unwrap; `.value` remains a valid `Ref<string>` access. Keep the `browser.xxx.value` pattern so
// type and runtime behavior are consistent.
const browser = useIsoBrowser()
onUnmounted(() => browser.dispose())

const expanded = computed(() => props.expanded)

function toggle(): void {
  emit('update:expanded', !expanded.value)
}

// Per Vue2 mounted/watch(visible) (:130-136): fetch directory content of current path when expanded.
// After controlled state, toggle() no longer directly changes value, so this step moved from toggle to watch on
// expanded—semantics unchanged, and additionally covers a new scenario: parent-held expanded state leaves this component
// **already expanded at mount time**; watch doesn't fire then (value hasn't changed), but directory list reset on component
// unmount, requiring a re-fetch. `immediate` simultaneously manages both paths (does nothing when initial value is false).
watch(expanded, (v) => {
  if (v) browser.fetch(browser.path.value)
}, { immediate: true })

function onItemClick(item: FolderEntry): void {
  if (item.is_dir) {
    browser.fetch(item.path)
    return
  }
  // Defensive check (not an oversight): in the real data flow useIsoBrowser.fetch already filters out non-directory/
  // non-.iso items; theoretically we only receive .iso files. But the component shouldn't assume upstream filtering is
  // always complete (the last test case in brief Step 3 verifies this defense, simulating "leaked" non-.iso files);
  // when this branch is hit, do nothing and silently return.
  if (!isIsoFile(item.name)) return

  // Per Vue2 handleCustomItemClick (:328-357): reverse-lookup template by filename, bring out recommended specs;
  // when reverse-lookup fails, id falls back to 'local', all recommended specs undefined.
  const tmpl = matchTemplateByFilename(item.name, props.isos)
  emit('select', {
    isLocal: true,
    id: tmpl ? tmpl.id : 'local',
    name: item.name,
    path: item.path,
    size: item.size,
    recommendedVcpu: tmpl?.recommendedVcpu,
    recommendedMemory: tmpl?.recommendedMemory,
    minMemory: tmpl?.minMemory,
    minDisk: tmpl?.minDisk,
  })
  // Note: this component does not close the dialog itself—Vue2's handleCustomItemClick calls
  // this.close() after hitting the .iso branch, but New-UI consolidates the "close dialog after selection" decision
  // in OsSelector's onLocalSelect (following the same path as official template's selectOS); IsoBrowser only reports select.
}
</script>

<template>
  <section class="custom-section">
    <!-- This divider is the only control that opens local ISO browsing, so a
         click-only div left keyboard users with no route in at all. It gains a
         button role, focusability and Enter/Space handling; nothing about it
         looks different. `.prevent` on Space is required — on a focusable
         element Space would otherwise scroll the dialog. -->
    <div
      class="custom-divider"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="t('kvmToggleCustom')"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span>{{ t('kvmCustom') }}</span>
      <span aria-hidden="true">{{ expanded ? '▴' : '▾' }}</span>
    </div>

    <div v-if="expanded" class="custom-browse">
      <div class="custom-breadcrumb">
        <button
          type="button"
          class="custom-back-btn"
          :disabled="browser.path.value === '/'"
          :aria-label="t('kvmParentDir')"
          @click="browser.up()"
        >
          <span aria-hidden="true">↑</span>
        </button>
        <span class="custom-path">{{ browser.path.value }}</span>
      </div>

      <div class="custom-file-list">
        <div v-if="browser.isLoading.value" class="custom-loading">
          <span class="kvm-spinner" aria-hidden="true"></span>
        </div>
        <div v-else-if="browser.items.value.length === 0" class="custom-empty">
          {{ t('kvmFolderEmpty') }}
        </div>
        <template v-else>
          <div
            v-for="item in browser.items.value"
            :key="item.path"
            class="custom-file-item"
            @click="onItemClick(item)"
          >
            <div class="custom-file-icon">
              <span v-if="item.is_dir" aria-hidden="true">▣</span>
              <img
                v-else-if="isIsoFile(item.name)"
                :src="osIconFor(item.name)"
                :alt="item.name"
                style="width: 2.25rem; height: 2.25rem; object-fit: contain;"
              />
              <span v-else aria-hidden="true">▤</span>
            </div>
            <div class="custom-file-info">
              <span class="custom-file-name">{{ item.name }}</span>
              <span v-if="!item.is_dir" class="custom-file-size">{{ formatFileSize(item.size) }}</span>
            </div>
            <span v-if="item.is_dir" class="custom-file-arrow" aria-hidden="true">▸</span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
