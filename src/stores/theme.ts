import { defineStore } from 'pinia'
import { ref } from 'vue'

export const THEMES = ['blue', 'light'] as const // blue = 默认/兜底
export type Theme = (typeof THEMES)[number]

export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}

// 直接写 <html data-theme>,无需 Pinia —— 供 main.ts 在 mount 前调用(防闪)。
// blue 是 :root 默认块,移除属性即回落;light 置属性触发 :root[data-theme="light"] 覆盖块。
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
  // wallpaper.ts's commit() calls setTheme() to turn an accepted preview into
  // the confirmed value. The topbar ThemeToggle stays one-step by design (no
  // Apply step) and keeps calling setTheme() directly.
  function previewTheme(t: Theme) {
    theme.value = t
    applyTheme(t)
  }
  return { theme, setTheme, previewTheme }
})
