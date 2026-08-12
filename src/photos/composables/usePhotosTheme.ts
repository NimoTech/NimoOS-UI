// Photos-private light/dark theme (spec 2026-08-11 §4: the Vue2 private
// toggle returns, overriding New-UI's earlier "follow global only" decision).
// Module-level singleton, not Pinia: it is the Vue3 counterpart of Vue2's
// themeMixin responsibility, consumed by every .photos-root view root.
import { computed, ref, type ComputedRef, type Ref } from 'vue'

export type PhotosTheme = 'dark' | 'light'

const NEW_KEY = 'nimo_photos_theme'
// Vue2 key, read once as a migration source, never written back.
const LEGACY_KEY = 'nimoos.photos.theme'

let theme: Ref<PhotosTheme> | null = null

function isTheme(v: string | null): v is PhotosTheme {
  return v === 'dark' || v === 'light'
}

function load(): PhotosTheme {
  const stored = localStorage.getItem(NEW_KEY)
  if (isTheme(stored)) return stored
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (isTheme(legacy)) {
    localStorage.setItem(NEW_KEY, legacy)
    return legacy
  }
  return 'dark'
}

export function usePhotosTheme(): {
  theme: Ref<PhotosTheme>
  set: (next: PhotosTheme) => void
  themeClass: ComputedRef<'' | 'is-light'>
} {
  if (!theme) theme = ref(load())
  const t = theme
  function set(next: PhotosTheme) {
    t.value = next
    localStorage.setItem(NEW_KEY, next)
  }
  const themeClass = computed<'' | 'is-light'>(() => (t.value === 'light' ? 'is-light' : ''))
  return { theme: t, set, themeClass }
}

export function __resetPhotosThemeForTests() {
  theme = null
}
