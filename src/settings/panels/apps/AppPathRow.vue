<script setup lang="ts">
// Settings · Apps -- one row inside "App data storage location". Mirrors Vue2 SettingsPanel.vue:596-633.
// Shape: title on the left + two chips (usage/capacity · path), a "Change storage location" button on the right.
// sizeText/pathText are computed by the parent (AppsPanel.vue) and passed in -- this component itself doesn't touch renderSize/
// toVirtualPath, staying purely presentational so each row doesn't recompute it separately.
import { useI18n } from 'vue-i18n'
import '../../styles/settings.css'

defineProps<{ label: string; sizeText: string; pathText: string }>()
const emit = defineEmits<{ change: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="set-app-row">
    <div class="set-app-row-main">
      <div class="set-app-row-label">{{ label }}</div>
      <div class="set-app-chips">
        <span class="set-app-chip">{{ sizeText }}</span>
        <span class="set-app-chip set-app-chip-path">{{ pathText }}</span>
      </div>
    </div>
    <button class="set-app-act" type="button" :title="t('settingsAppsChangeLocation')" @click="emit('change')">
      ⤴
    </button>
  </div>
</template>
