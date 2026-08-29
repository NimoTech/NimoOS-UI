import { defineStore } from 'pinia'
import { ref } from 'vue'

export const THEMES = ['blue', 'light'] as const // blue = default/fallback
export type Theme = (typeof THEMES)[number]

export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}

// Writes <html data-theme> directly, no Pinia needed -- lets main.ts call this before mount (avoids a flash).
// blue is the :root default block; removing the attribute falls back to it. light sets the
// attribute, which triggers the :root[data-theme="light"] override block.
export function applyTheme(t: Theme): void {
  if (t === 'blue') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export function initialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return isTheme(stored) ? stored : 'blue'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(initialTheme())
  function setTheme(t: Theme) {
    theme.value = t
    applyTheme(t)
    localStorage.setItem('theme', t)
  }
  // I2 (SP11 final review, stores/wallpaper.ts): preview-only counterpart to
  // setTheme -- updates the in-memory theme and repaints <html>, but never
  // touches localStorage. WallpaperDialog's preset tiles (pickBase) use this
  // so a theme switch bundled into a preset can be discarded by Cancel;
  // WallpaperDialog's own apply() calls setTheme() to turn an accepted preview
  // into the confirmed value -- deliberately NOT wallpaper.ts's commit()
  // (review round 2: commit() is also called by setFromNasPath(), which never
  // offers a theme to confirm, so commit() confirming one anyway silently
  // persisted whatever theme happened to be live). The topbar ThemeToggle
  // stays one-step by design (no Apply step) and keeps calling setTheme()
  // directly.
  function previewTheme(t: Theme) {
    theme.value = t
    applyTheme(t)
  }
  return { theme, setTheme, previewTheme }
})
