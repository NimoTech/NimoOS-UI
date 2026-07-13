<template>
  <div class="theme-toggle">
    <button class="bar-btn theme-btn" :aria-label="t('themeToggle')" :title="t('themeToggle')" @click="open = !open">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
      </svg>
    </button>
    <template v-if="open">
      <div class="theme-scrim" @click="open = false" />
      <div class="theme-menu" role="menu">
        <button
          v-for="opt in THEMES"
          :key="opt"
          class="theme-opt"
          :class="{ on: theme.theme === opt }"
          role="menuitemradio"
          :aria-checked="theme.theme === opt"
          @click="pick(opt)"
        >
          <span class="sw" :class="'sw-' + opt" />
          <span class="lbl">{{ t(opt === 'light' ? 'themeLight' : 'themeBlue') }}</span>
          <span v-if="theme.theme === opt" class="ck">✓</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore, THEMES, type Theme } from '../../stores/theme'
const { t } = useI18n()
const theme = useThemeStore()
const open = ref(false)
function pick(v: Theme) {
  theme.setTheme(v)
  open.value = false
}
</script>

<style scoped>
.theme-toggle { position: relative; }
.theme-btn { padding: 0 11px; }
.theme-btn .ic { width: 17px; height: 17px; }
.theme-scrim { position: fixed; inset: 0; z-index: 40; }
.theme-menu {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 41;
  display: flex; flex-direction: column; gap: 2px; min-width: 148px; padding: 6px;
  border: 1px solid var(--card-border); border-radius: 14px;
  background: var(--popup-bg); box-shadow: var(--card-shadow-hi);
  backdrop-filter: var(--blur);
}
.theme-opt {
  display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px;
  border: 0; border-radius: 9px; background: transparent; color: var(--fg);
  font-size: 13px; cursor: pointer; text-align: left;
}
.theme-opt:hover { background: var(--tool-bg-hi); }
.theme-opt.on { color: var(--accent); }
.theme-opt .lbl { flex: 1; }
.theme-opt .ck { color: var(--accent); font-weight: 600; }
.sw { width: 18px; height: 18px; border-radius: 6px; border: 1px solid var(--card-border); flex: 0 0 auto; }
/* theme-exception: 主题预览色块必须显示各主题的真实配色,与当前主题无关,故写死品牌色。 */
.sw-blue { background: linear-gradient(135deg, #8ab4ff, #b79bff); }
/* theme-exception: 同上,白色主题预览块。 */
.sw-light { background: linear-gradient(135deg, #f7f5ef 40%, #3b5bdb); }
</style>
