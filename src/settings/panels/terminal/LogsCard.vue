<script setup lang="ts">
// Settings · Terminal & Logs -- the logs card. Maps to Vue2 components/logsAndTerminal/LogsCard.vue (111 lines).
// Porting discipline (logged): Vue2 uses v-html to render the raw server log text as HTML --
//   an injection surface when the log contains user-controllable content (filenames/paths).
//   Here we use text interpolation + white-space: pre-wrap instead, with the same visual result.
//
// 2026-08 owner acceptance SP9-P3: switched to the same display shell as apps/console/LogsPane.vue
// (components/ui/LogConsole.vue) instead of maintaining its own look -- the dark console
// background + rounded corners + floating toolbar in the top-right corner + auto-scroll-to-bottom
// now all match the app console. The old hardcoded .set-logs padding-top: 52px spacer is gone,
// replaced by LogConsole's --log-console-* custom properties (see the comment at
// .set-logs-wrap in settings.css).
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LogConsole from '../../../components/ui/LogConsole.vue'
import '../../styles/settings.css'

defineProps<{ text: string }>()
const { t } = useI18n()
const fullscreen = ref(false)
const fsLabel = computed(() =>
  fullscreen.value ? t('settingsTermExitFullscreen') : t('settingsTermFullscreen'),
)
</script>

<template>
  <div class="set-logs-wrap" :class="{ 'is-fullscreen': fullscreen }">
    <LogConsole
      :text="text"
      :empty-text="t('settingsTermLoadingLogs')"
      class="set-logs"
      data-test="logs-pre"
    >
      <template #tools>
        <slot name="tools" />
        <button class="set-btn set-logs-fs" type="button" :title="fsLabel" @click="fullscreen = !fullscreen">
          {{ fsLabel }}
        </button>
      </template>
    </LogConsole>
    <!-- The footer sits inside .set-logs-wrap on purpose: the fullscreen state is
         `position: fixed; inset: 16px` on the wrap, so anything placed outside it
         would be covered up and the pager would be unreachable while fullscreen. -->
    <slot name="footer" />
  </div>
</template>
