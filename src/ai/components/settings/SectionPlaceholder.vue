<!--
  New component, Vue2 has no equivalent blueprint (9 sections outside this phase's scope +
  skills/mcp have no real components this phase).

  Simple placeholder panel: `.set-inner` + `.sk-section` wrapper (consistent with Vue2 xxxSection.vue
  root structure, e.g. ThinkingDefaultsSection.vue:1-2 `.set-inner`), content is just
  a title + explanatory text. Used for:
    - This task (T8) phase placeholder for "Models" group 4 sections (models/providers/privacy/thinking),
      Tasks 9/10/11 will replace corresponding SECTION_COMPONENTS lines with real components
    - `blacklist`/`execution`/`search`/`memory`/`observability`/`mcptokens`/`channels`/`skills`/`mcp`
      will be filled in by later phases
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{ titleKey: string; bodyKey: string }>()

const { t } = useI18n()
</script>

<template>
  <div class="set-inner">
    <div class="sk-section">
      <h1 class="set-h1">{{ t(props.titleKey) }}</h1>
      <p class="set-desc">{{ t(props.bodyKey) }}</p>
    </div>
  </div>
</template>
