<!--
  SP7-P8a-T5: settings page container — wires T3 (storage card) and T4 (AI card)
  into one real routed page at `/photos/settings`. The shell copies the
  AreaShell/.photos-layout/.photos-main structure from PhotosAlbums.vue:184-276
  (that file's header comment already explains this layout is deliberately
  duplicated per-view rather than factored out — same choice here).

  Source coordinates: Vue2 PhotosSettings.vue:1-36 (shell + hero + quick nav),
  :194-214 (footer + toast), :383-386 (scrollTo), :487-491 (showToast, 2800ms),
  :497-526 (mounted data fetch), :527-530 (unmount cleanup).

  ── Architectural deviations on record (four, per project rule: "don't copy
  Vue2's bugs/structure verbatim — fix the logic and record it in a comment") ──
  1. Vue2 is a full-screen overlay (`position:fixed;inset:0;z-index:500`) that
     carries its own `<photos-sidebar>` and its own topbar, toggled via an
     `open` prop. New-UI uses a real route + AreaShell: returning to the home
     page is handled by the AreaShell top bar / PhotosSidebar.side-top, and
     this page mounts **one** PhotosSidebar following PhotosAlbums.vue's
     established structure (consistent with every /photos/* view in this
     area) — this is not "AreaShell auto-generating a sidebar" (AreaShell.vue
     itself has no sidebar concept); the dedup here means "exactly one
     PhotosSidebar copy on the whole page", not "mount none at all". See the
     guard test below.
  2. No `open` prop, no ESC-to-close, no `$emit('close')` — the routed page
     relies on the browser back button, consistent with the rest of this
     area. Consequently there's also no global keydown listener equivalent to
     Vue2 :497-501/:527-528.
  3. (Reverted, entry voided) Vue2's `themeMixin`/`photosThemeClass` (the
     Photos-private light/dark theme toggle) was once decided as "out of
     scope for the whole migration" — spec 2026-08-11 §4 overturned that;
     the private toggle has been brought back via `usePhotosTheme`
     (composable) + `PhotosThemeToggle.vue`, and this page mounts one
     instance of that toggle below. The pixel-level wiring that applies
     `themeClass` to the `.photos-root` root node lands with Plan H — this
     page only wires up the functionality.
  4. The footer's "Sign out" is not migrated (D22) — New-UI already has a
     global sign-out (`src/settings/panels/AccountPanel.vue:167` →
     `useAuth().logout()`); the Vue2 one manually clears 4 localStorage keys
     and redirects to `/logout`, which is inconsistent with New-UI's sign-out
     path.

  Implementation note (not one of the four mandatory deviation entries, but
  still a visible difference from the source, recorded for the record): the
  toast only keeps the text — it doesn't render Vue2's `photos-icon
  :name="toast.icon"` icon, because this repo's Photos area has no
  PhotosIcon.vue equivalent (confirmed zero hits via grep). T12
  PhotosFilterChip.vue's header comment "deviation entry 1" reaches the same
  conclusion (don't build a mini icon-mapping table if there's nothing to map
  to). This repo's global toast (AppToast.vue) is also a plain text pill with
  no icon, so the visuals here match this repo's existing toast rather than
  rebuilding Vue2's icon + purple color scheme.

  Data-fetch division of labor (an interface debt, already aligned with
  T3/T4 — see both cards' header comments and task-5-report.md):
  fetchStorage() is called by PhotosStorageCard itself in its own onMounted;
  this container **does not call it again**. This container's mounted hook
  only calls fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures —
  these four (out of the five fetches in Vue2 :497-526, minus loadStorage,
  which the child component now owns).

  `?section=` deep link: reads route.query.section, recognizing only
  'storage'/'ai' (any other value — including Vue2's `settings=1` "just open,
  don't scroll" semantics — is ignored, no scroll). T6's "Settings · AI
  behavior" link will point to `/photos/settings?section=ai`.
  Both paths are handled (review Important 1, filled in 2026-08-04): ① on
  mount (`onMounted` + `nextTick`) ② when the query changes after mount (a
  `watch(() => route.query.section, ...)` without `immediate`) — the latter
  covers the case where "the user is already sitting on this page and either
  hand-edits the address bar query, or some future in-page link points to
  this page with only the section differing" — a scenario vue-router 4 won't
  remount the component for. Both paths share the same
  `scrollToSection`/`isSectionId` predicate; they are not allowed to each
  maintain their own whitelist and drift apart.
-->
<script setup lang="ts">
import '../photos/styles/vue2-parity'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosStorageCard from '../photos/components/PhotosStorageCard.vue'
import PhotosAiCard from '../photos/components/PhotosAiCard.vue'
import PhotosThemeToggle from '../photos/components/PhotosThemeToggle.vue'
import { usePhotosSettingsStore } from '../photos/stores/settings'

interface ToastPayload { icon: string; text: string }

const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
const route = useRoute()
const settings = usePhotosSettingsStore()

const pageRef = ref<HTMLElement | null>(null)

// Vue2 :302 — fallback to 'NAS' before the about fetch resolves.
const deviceName = computed(() => settings.about?.deviceName || 'NAS')

// Vue2 :352-361, same deviation entry as T4's AI card header comment
// "deviation entry 1" — without an explicit locale this would follow the
// system language rather than the in-app selected language. Here we
// explicitly apply the existing relTime.ts/PlacesRail.vue convention to
// convert to BCP-47.
// Unlike lastBuiltText (T4): Vue2 :359-361's catch branch here falls back to
// an empty string rather than the raw iso (that's how the source itself
// behaves — carried over as-is, not a deviation of this entry).
const librarySinceText = computed(() => {
  const iso = settings.about?.librarySince
  if (!iso) return ''
  try {
    const tag = locale.value.replace('_', '-')
    return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
  } catch {
    return ''
  }
})

// Vue2 :383-386 — a no-op when the target element isn't found, doesn't
// throw (jsdom has no scrollIntoView implementation; just spy it out in
// tests, no need for a real scroll).
function scrollTo(id: string): void {
  const el = pageRef.value?.querySelector('#' + id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// The whitelist is decided in exactly one place; the mounted path and the
// "already on the page, query changed" path share the same function — they
// are not allowed to each maintain their own predicate and drift apart over
// time (verbatim from review Important 1's ruling).
type SectionId = 'storage' | 'ai'
function isSectionId(v: unknown): v is SectionId {
  return v === 'storage' || v === 'ai'
}
function scrollToSection(section: unknown): void {
  if (isSectionId(section)) scrollTo(section)
}

const toast = ref<ToastPayload | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

// Vue2 :487-491 — receives the @toast events bubbled up from the two cards;
// on repeat triggers you must clearTimeout before rescheduling, otherwise
// the first toast's timer will prematurely cut off the second toast too
// (mutation testing locks this down).
function showToast(payload: ToastPayload): void {
  toast.value = payload
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 2800)
}

onMounted(() => {
  void settings.fetchAbout()
  void settings.fetchRetention()
  void settings.fetchScanInterval()
  void settings.fetchAiFeatures()

  void nextTick(() => scrollToSection(route.query.section))
})

// Review Important 1 (2026-08-04): vue-router 4 doesn't remount the same
// routed component when only the query changes — if the user is already
// sitting on this page (e.g. hand-edits the address bar query, or some
// future in-page link points here with only the section differing), the
// single onMounted scroll can't reach this case. This adds a `watch`
// without `immediate`: it doesn't fire again on mount (watch doesn't run
// once at setup time by default), and only scrolls when the query actually
// changes *after* mount — sharing the same scrollToSection/isSectionId
// predicate as the mounted path, so they won't each maintain their own
// whitelist and drift apart. The target elements (#storage/#ai) are
// unconditionally rendered static content that doesn't get added/removed
// based on the section, so this path doesn't need to wait for nextTick the
// way the mounted path does.
watch(() => route.query.section, (section) => scrollToSection(section))

onUnmounted(() => {
  clearTimeout(toastTimer)
})
</script>

<template>
  <AreaShell :title="t('photosSettingsTitle')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <div ref="pageRef" class="ps-scroll scroll">
          <div class="ps-hero">
            <h1>{{ t('photosSettingsTitle') }}</h1>
            <p>{{ t('photosSettingsHeroDesc') }}</p>
            <div class="ps-quicknav">
              <a href="#storage" @click.prevent="scrollTo('storage')">{{ t('photosSettingsNavStorage') }}</a>
              <a href="#ai" @click.prevent="scrollTo('ai')">{{ t('photosSettingsNavAi') }}</a>
            </div>
          </div>

          <PhotosStorageCard @toast="showToast" />
          <PhotosAiCard @toast="showToast" />
          <PhotosThemeToggle />

          <footer class="ps-footer">
            <div class="ps-footer-app">
              {{ t('photosSettingsFooterApp') }}<template v-if="settings.about?.version"> &middot; v{{ settings.about.version }}</template>
            </div>
            <div class="ps-footer-host">
              {{ t('photosSettingsRunningOn') }} {{ deviceName }}<template v-if="librarySinceText"> &middot; {{ t('photosSettingsLibrarySince') }} {{ librarySinceText }}</template>
            </div>
          </footer>
        </div>
      </main>
    </div>
  </AreaShell>

  <transition name="ps-toast">
    <div v-if="toast" class="ps-toast" data-test="settings-toast" role="status" aria-live="polite">{{ toast.text }}</div>
  </transition>
</template>

<style scoped>
/* Fix round 1 (controller-adjudicated, task-3-report.md Disclosure 1): this page still
   uses the old flex-row `.photos-layout` shell (its own re-skin task hasn't landed yet), but
   its root now carries `.photos-root` so the shared PhotosSidebar's Vue2 `.sidebar` root gets
   the parity look. Parity scss deliberately sets no width on `.sidebar` itself (real
   pixel-parity width comes from the `.app` CSS Grid column Task 3 gave Photos.vue) — pin it
   here so the sidebar doesn't collapse to its shrink-to-fit content width in this page's
   flex row. Transitional: drop this rule once this page gets its own `.app` grid re-skin. */
.sidebar { flex: 0 0 var(--sidebar-w); align-self: stretch; overflow-y: auto; }

/* height (not min-height): this caps at one screen, only the inner scroll
   container scrolls — a same-source fix; see the comment on the same rule
   in src/views/Photos.vue for the rationale and Vue2 origin. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.ps-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 4px 4px 24px; }

.ps-hero h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; color: var(--fg); }
.ps-hero p { font-size: 13px; color: var(--fg-muted); margin: 0 0 12px; max-width: 640px; }
.ps-quicknav { display: flex; gap: 16px; }
.ps-quicknav a { color: var(--accent-text); font-size: 13px; font-weight: 500; text-decoration: none; }
.ps-quicknav a:hover { text-decoration: underline; }

.ps-footer { display: flex; flex-direction: column; gap: 2px; padding: 12px 4px 4px; }
.ps-footer-app { font-size: 12.5px; font-weight: 600; color: var(--fg); }
.ps-footer-host { font-size: 12px; color: var(--fg-muted); }

/* Review Important (2026-08-04, caught by the full acceptance gate): this
   visually borrows this repo's global toast (AppToast.vue) style language
   (see the header comment's "Implementation note"), but this one is a
   **page-local** overlay, not the global toast itself — do NOT copy
   AppToast.vue's "must sit above every modal overlay in the whole repo"
   1100, because that hard constraint only applies to *that* single global
   instance (docs/THEMING.md §8: the "toast" in "toast must sit above every
   modal overlay in the whole repo" refers specifically to AppToast.vue).
   This was originally miscopied as 1100 here, colliding with the global
   toast's layer, and `AppToast.zIndex.test.ts` flagged it red immediately —
   that guard is repo-wide: any overlay with z-index ≥ 1100 gets flagged as
   "would sit above the global toast". This settings page's local toast only
   needs to cover **what this page itself renders**, which per §8's ladder
   falls into the "local fixed bar 60–150" tier; but this page also mounts a
   PhotosSidebar (architectural deviation entry 1), whose narrow-screen
   drawer `.photos-sidebar.is-drawer` is 151 (with the `side-scrim` overlay
   at 150) — already above that tier's nominal ceiling, which is a
   pre-existing repo fact, not something introduced here. 160 sits just above
   these two real same-page overlays (151/150) while staying well below the
   entire "area-level/general dialog overlay" band starting at 200, and far
   below the global toast's 1100 — it won't share a layer with anything.
   See the guard test in this file below (locks <1100; does not lock
   <1000/<200, because the convention itself only pins down the toast line —
   the remaining numbers are choices made here based on measured same-page
   overlays, not repo-wide invariants). */
.ps-toast {
  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 160;
  padding: 10px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px;
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur); white-space: nowrap;
  pointer-events: none;
}
.ps-toast-enter-active, .ps-toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.ps-toast-enter-from, .ps-toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }

@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
