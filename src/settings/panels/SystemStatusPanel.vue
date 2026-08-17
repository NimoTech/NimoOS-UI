<script setup lang="ts">
// Settings · System Status. Corresponds to Vue2 components/settings/SystemStatus.vue (89 lines).
// Data source: GET /v1/gateway/components (**bare JSON, no envelope** — corrected by real-machine testing in P1, item 1).
// Vue2's failure branch is "clear + empty state"; kept as-is here (not a swallowed error — this whole panel is just this one endpoint).
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type GatewayComponent } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import { groupComponents, statusHint } from '../util/components'
import '../styles/settings.css'

const { t } = useI18n()
const components = ref<GatewayComponent[]>([])
const loading = ref(false)
const groups = computed(() => groupComponents(components.value))

// Async stale guard (global constraint #2, implemented inline, not extracted into a shared helper):
// the refresh button can trigger load() again before the mount-time fetch settles, and
// whichever of the two requests resolves first is not guaranteed. A generation counter marks
// "which load() call this is" — only the call whose generation is still current when it settles is allowed to write components; an older call, even if it settles later, must be discarded.
let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  loading.value = true
  try {
    const data = await service.sys.getGatewayComponents()
    if (seq !== loadSeq) return // superseded by a newer load() call — discard this stale result
    components.value = data
  } catch {
    if (seq !== loadSeq) return
    components.value = []
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <SettingsSection :title="t('settingsStatusTitle')">
    <div class="set-comp-head">
      <!-- Vue2's counterpart uses Buefy b-button :loading="loading" (spinner only, doesn't disable clicks) —
           not adding disabled here is deliberate, to stay consistent: it lets the user click refresh
           again while a request is in flight; which of the two settles first is guarded by the generation counter above, not by disabling the button. -->
      <button
        class="set-btn set-comp-refresh" type="button"
        :title="t('settingsStatusRefresh')" @click="load"
      >
        {{ t('settingsStatusRefresh') }}
      </button>
    </div>

    <div v-for="g in groups" :key="g.key" class="set-comp-group">
      <p class="set-comp-group-title">{{ t(g.labelKey) }}</p>
      <div v-for="c in g.items" :key="c.name" class="set-comp-row">
        <span class="set-comp-dot" :class="c.status === 'online' ? 'is-online' : 'is-offline'" />
        <span class="set-comp-name">{{ c.name }}</span>
        <span class="set-comp-ver">{{ c.version || '—' }}</span>
        <span
          class="set-comp-state"
          :class="c.status === 'online' ? 'is-online' : 'is-offline'"
          :title="c.status === 'online' ? undefined : statusHint(c)"
        >
          {{ c.status === 'online' ? t('settingsStatusOnline') : t('settingsStatusOffline') }}
        </span>
      </div>
    </div>

    <p v-if="!loading && !components.length" class="set-comp-empty">{{ t('settingsStatusNoData') }}</p>
  </SettingsSection>
</template>
