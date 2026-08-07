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
        <button class="theme-opt" role="menuitemradio" data-test="tt-blue"
          :class="{ on: active === 'blue' }" :aria-checked="active === 'blue'" @click="pickBase('blue')">
          <span class="sw sw-blue" />
          <span class="lbl">{{ t('themeBlue') }}</span>
          <span v-if="active === 'blue'" class="ck">✓</span>
        </button>
        <button class="theme-opt" role="menuitemradio" data-test="tt-light"
          :class="{ on: active === 'light' }" :aria-checked="active === 'light'" @click="pickBase('light')">
          <span class="sw sw-light" />
          <span class="lbl">{{ t('themeLight') }}</span>
          <span v-if="active === 'light'" class="ck">✓</span>
        </button>
        <button class="theme-opt" role="menuitemradio" data-test="tt-photo"
          :class="{ on: active === 'photo' }" :aria-checked="active === 'photo'" @click="pickPhoto()">
          <span class="sw sw-photo" />
          <span class="lbl">{{ t('themePhoto') }}</span>
          <span v-if="active === 'photo'" class="ck">✓</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore, type Theme } from '../../stores/theme'
import { useWallpaperStore, NONE } from '../../stores/wallpaper'
import { useToast } from '../../stores/toast'

const { t } = useI18n()
const theme = useThemeStore()
const wp = useWallpaperStore()
const toast = useToast()
const open = ref(false)

// Three entries, not two themes plus a wallpaper toggle: from the user's side
// this menu answers "what is behind everything", and an image answers it too.
const active = computed<'blue' | 'light' | 'photo'>(() =>
  wp.record.kind !== 'none' ? 'photo' : theme.theme === 'light' ? 'light' : 'blue',
)

function pickBase(v: Theme) {
  wp.preview(NONE)
  // Controller override (task-8 brief): a bare `void wp.commit()` here would
  // let a failed save go unreported — the wallpaper looks cleared, the user
  // believes it saved, and it reappears after a reload with no message in
  // between. The menu still closes immediately; only the failure toast waits
  // on the network.
  wp.commit().catch(() => toast.show(t('wpSaveFailed'), 3000, 'danger'))
  theme.setTheme(v)
  open.value = false
}

function pickPhoto() {
  open.value = false
  wp.openDialog()
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
/* theme-exception: preview swatch shows what the photo option looks like, not
   the active theme's colours. */
.sw-photo { background: linear-gradient(135deg, #7a8ea8, #3c4a5e); }
</style>
