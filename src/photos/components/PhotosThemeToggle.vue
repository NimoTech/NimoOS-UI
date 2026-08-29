<script setup lang="ts">
// Minimal functional toggle (Plan A). Pixel-parity styling of the settings
// page as a whole lands with Plan H; this row already uses only theme tokens.
import { useI18n } from 'vue-i18n'
import { usePhotosTheme, type PhotosTheme } from '../composables/usePhotosTheme'

const { t } = useI18n()
const { theme, set } = usePhotosTheme()
const OPTIONS: PhotosTheme[] = ['dark', 'light']
const LABEL_KEYS: Record<PhotosTheme, string> = {
  dark: 'photosSettingsThemeDark',
  light: 'photosSettingsThemeLight',
}
</script>

<template>
  <div class="theme-toggle-row">
    <span class="theme-toggle-label">{{ t('photosSettingsAppearance') }}</span>
    <div class="theme-toggle-group">
      <button
        v-for="opt in OPTIONS" :key="opt"
        type="button"
        class="theme-toggle-btn"
        :data-theme-option="opt"
        :data-active="theme === opt"
        @click="set(opt)"
      >{{ t(LABEL_KEYS[opt]) }}</button>
    </div>
  </div>
</template>

<style scoped>
.theme-toggle-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.theme-toggle-label { font-size: 13px; color: var(--fg-muted); flex: 1 1 auto; }
.theme-toggle-group { display: inline-flex; gap: 6px; }
.theme-toggle-btn {
  padding: 4px 14px; border-radius: 999px; font: inherit; font-size: 12.5px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted); cursor: pointer;
}
.theme-toggle-btn[data-active="true"] {
  background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text);
}
</style>
