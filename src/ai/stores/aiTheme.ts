import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// SP8-P2a Task 4 — AI area (Agent page + Settings page) shared light/dark theme.
//
// [Why extract it] In Vue2, `Agent.vue` and `Settings.vue` each maintain a theme, aligned via
// the same localStorage key; because Vue2 route switching destroys and recreates components,
// data()/mounted re-reads localStorage each time, users perceive consistency.
//
// New-UI's Pinia store is a global singleton, route switching doesn't destroy — if two pages
// each maintain a ref, toggling to dark in settings page and returning to /ai/agent won't change
// it. This is not a Vue2 bug, it's an inevitable behavior difference after replacing component-level
// stores with singleton stores, must be solved at the architecture level.
//
// Approach is identical to SP8-P1c2 Task 7's `src/stores/userProfile.ts` (avatar version number
// moved up): move state to the level where it truly should be, consumers each read the same one.
//
// localStorage key is verbatim consistent with Vue2 (`Agent.vue:80`, `Settings.vue:73`), so old
// and new apps' theme preferences are mutually compatible.
const THEME_KEY = 'nimoos.ai.agent.theme'

export type AiTheme = 'light' | 'dark'

export const useAiTheme = defineStore('ai-theme', () => {
  const theme = ref<AiTheme>('light')

  // [SP8-P2b acceptance round 3, 2026-07-30] 'Is AI area currently in foreground' — for `AppToast`.
  //
  // Why needed: `AppToast` is mounted at the outermost layer of `App.vue`, **not within the
  // `.agent-app` theme scope**, so it reads the global blue-black theme's `--toast-bg` (semi-transparent
  // white) and `--toast-fg` (undefined → falls back to `--fg` = #ffffff). Drawn on AI's light page
  // it becomes white text on white background = completely invisible, all toasts in AI area (copy
  // success / save failure / delete failure ...) users can't see. This is the same family of
  // problems as 'native controls follow wrong color-scheme': app-level shell drawn above nested
  // theme scopes.
  //
  // User-decided fix is 'only change AI area, desktop unaffected', so can't unconditionally apply
  // AI coloring to toasts — must know if we're currently on AI page. Register during AI page mount,
  // deregister when leaving.
  //
  // **Reference counting not boolean**: during route switching, new page's onMounted may come before
  // old page's onBeforeUnmount, boolean would be overwritten to 'false' (not in AI area) by departing
  // page; counting is naturally immune to ordering. Floor at 0 and don't decrement below, otherwise
  // extra deregister will press count negative and make next register fail.
  const aiSurfaces = ref(0)
  const aiSurfaceActive = computed(() => aiSurfaces.value > 0)
  function enterAiSurface(): void { aiSurfaces.value += 1 }
  function leaveAiSurface(): void { if (aiSurfaces.value > 0) aiSurfaces.value -= 1 }

  /**
   * Load once persisted preference. Priority consistent with Vue2 `Settings.vue:102-107` /
   * `Agent.vue:90-96`: valid localStorage value → system prefers-color-scheme → 'light'
   * fallback. Repeatable call (idempotent).
   */
  function hydrateTheme(): void {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') {
      theme.value = stored
      return
    }
    if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
      theme.value = 'dark'
      return
    }
    theme.value = 'light'
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, theme.value)
  }

  return { theme, toggleTheme, hydrateTheme, aiSurfaceActive, enterAiSurface, leaveAiSurface }
})
