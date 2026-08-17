<!-- Model dropdown for Ask Nimo. Pixel source: Vue2 NimoOS-UI src/views/Photos/NimoModelPicker.vue
     + photos.scss:4176-4227 (already ported, this component only supplies markup/logic).
     No props/emits: reads useAgentStore('photos') directly, same self-contained pattern Vue2
     used via store injection -- New-UI has no provide() chain in Photos, so direct store access
     is the equivalent seam.
     Preflight F-04: renders in-place (no Teleport) using the SAME z260 "fixed dropdown menu"
     pattern already established by useFixedMenuPosition.ts (consumed by PhotosAlbumDetail.vue/
     PhotosSmartViewDetail.vue's "..." sidebar menu) -- position:fixed computed from the
     trigger's own rect, escapes ancestor scroll clipping without leaving the DOM tree, so this
     naturally stays inside whatever .photos-root subtree it's mounted in (Constraints #7).
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore, type AgentModel } from '../../../ai/stores/agentStore'
import { useFixedMenuPosition } from '../../composables/useFixedMenuPosition'

const { t } = useI18n()
const agent = useAgentStore('photos')

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const { menuStyle } = useFixedMenuPosition(open, triggerRef)

const GROUP_ORDER = ['ollama', 'deepseek', 'openai', 'anthropic', 'qwen', 'other']
const GROUP_LABEL: Record<string, string> = {
  ollama: 'photosModelGroupLocalOllama',
  deepseek: 'photosModelGroupCloudDeepSeek',
  openai: 'photosModelGroupCloudOpenAI',
  anthropic: 'photosModelGroupCloudAnthropic',
  qwen: 'photosModelGroupCloudQwen',
  other: 'photosModelGroupOther',
}
function groupLabel(providerType: string): string {
  return t(GROUP_LABEL[providerType] || GROUP_LABEL.other)
}

const pickableItems = computed(() => agent.availableModels || [])

const groups = computed(() => {
  const byType = new Map<string, AgentModel[]>()
  for (const m of pickableItems.value) {
    const key = m.provider_type || 'other'
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push(m)
  }
  return [...byType.keys()]
    .sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a)
      const ib = GROUP_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    .map((providerType) => ({ providerType, items: byType.get(providerType)! }))
})

const selectedModelObj = computed(() => pickableItems.value.find((m) => m.key === agent.selectedModel))
const triggerLabel = computed(() => {
  const m = selectedModelObj.value
  if (!m) return t('photosSelectModel')
  const name = m.displayName || m.key
  const providerName = m.providerName || (m.source === 'local' ? groupLabel('ollama') : t('photosModelProviderCloudFallback'))
  return `${name} · ${providerName}`
})
const dotClass = computed(() => {
  if (!selectedModelObj.value) return 'is-empty'
  return selectedModelObj.value.source === 'local' ? 'is-local' : 'is-cloud'
})

function toggle(): void {
  open.value = !open.value
}
function pick(m: AgentModel): void {
  agent.selectModel(m.key)
  open.value = false
}
// Review fix (CRITICAL #1): the old '#/settings/ai-providers' hash targeted a route that
// doesn't exist in this repo's router (src/router/index.ts registers the AI provider settings
// page at name 'ai-settings', path '/ai/settings') -- clicking this button was a dead link.
// Also closes the dropdown first, matching Vue2 NimoModelPicker.vue:167-177's goConfig()
// (`this.open = false` before navigating).
function goConfig(): void {
  open.value = false
  window.location.hash = '#/ai/settings'
}

// Re-check N-1: document-level outside-click, verbatim port of Vue2 NimoModelPicker.vue:114-123
// (New-UI has no separate portalHost to special-case anymore -- the whole list lives inside
// rootRef now, so "outside" is simply "outside rootRef").
function onDocMousedown(e: MouseEvent): void {
  if (!open.value) return
  if (rootRef.value && rootRef.value.contains(e.target as Node)) return
  open.value = false
}
// Re-check N-1: Escape is a New-UI-only addition beyond strict Vue2 parity (Vue2's own file has
// no Escape handling at all) -- follows this repo's PlacesFilterMenu.vue precedent.
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  open.value = false
}

onMounted(() => {
  void agent.loadAvailableModels()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div ref="rootRef" class="nimo-mp" @click.stop>
    <button ref="triggerRef" type="button" class="nimo-mp-trigger" @click="toggle">
      <span class="nimo-mp-dot" :class="dotClass" />
      <span class="nimo-mp-label">{{ triggerLabel }}</span>
      <span class="nimo-mp-chev">▾</span>
    </button>
    <div v-if="open" class="nimo-mp-list" :style="menuStyle" @mousedown.stop>
      <div v-if="!pickableItems.length" class="nimo-mp-empty">
        <button type="button" class="nimo-mp-config" @click="goConfig">{{ t('photosGoToSettingsConfigure') }}</button>
      </div>
      <template v-else>
        <div v-for="g in groups" :key="g.providerType">
          <div class="nimo-mp-group-label">{{ groupLabel(g.providerType) }}</div>
          <button
            v-for="m in g.items" :key="m.key" type="button" class="nimo-mp-item"
            :class="{ 'is-active': m.key === agent.selectedModel }" @click="pick(m)"
          >
            <span class="nimo-mp-radio" />
            <span class="nimo-mp-item-name">{{ m.displayName || m.key }}</span>
            <span class="nimo-mp-item-prov">{{ m.providerName || '' }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
