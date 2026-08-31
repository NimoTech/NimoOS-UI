<script setup lang="ts">
// PersonHero.vue —— person detail page hero section (cover + avatar + name/favorite +
// edit menu + relation group dropdown + four stats + two action buttons). Port each section from the Vue 2 panel
// src/views/Photos/PhotosPersonDetail.vue:3-91 (template), :492-529 (cover/heroBg/
// heroIsFallback/firstYear/firstMonthShort), :586-590 (relationLabel), :782-840
// (menu toggle and positioning logic); styles from photos-people.scss:277-460.
//
// Pure presentation + emit, no store access, no requests — all side effects live in the host container.
// The Ask about {name} button (Vue2 :89-92 `.btn-ai`) was previously deferred
// and left unrendered; now added back in Vue2's own order (first in the actions row). The
// click is currently a no-op — wiring the real Ask Nimo call comes later; for now this only adds the
// copy + visuals + an empty placeholder function (see onAskNimo below).
//
// Implementation deviation from Vue2: Vue2 uses getBoundingClientRect for manual fixed positioning +
// document mousedown + closest('.relation-menu') to manage two menus (:598-617, 782-831).
// Here changed to position:absolute anchored to trigger buttons within the component (same pattern as established
// in PhotosPeople.vue :352-358, 412-424 with people-pop-wrap/people-menu), closing still uses document-level
// mousedown + keydown(Esc), attached on onMounted / removed on onUnmounted, paired. Visual position remains consistent
// (menu appears directly below trigger button).
//
// Deviation registration —— **Why Vue2 uses fixed**: not arbitrary, but to work around
// `.detail-hero { overflow: hidden }` (photos-people.scss:277-281). fixed containment block is the viewport,
// unaffected by any ancestor overflow clipping; absolute containment block is the nearest positioned ancestor,
// and gets clipped if ancestor clips. Switching to absolute breaks z-index completely (clipping happens before compositing),
// and hero has no scrollbar to rescue it—menu gets **directly clipped**: default layout menu bottom ≈279.5px
// just 0.5px away from clipping; once a long name triggers `.hero-name-row { flex-wrap: wrap }` wrapping,
// trigger button shifts down ~46px, menu bottom reaches ≈296px, last item "Work" gets clipped about halfway
// (same for larger font / narrow viewport). Fix (of two possible approaches, chose this one; see .hero-clip comment
// in style block): move `overflow: hidden` from .person-hero to dedicated .hero-clip clipping layer, menu no longer
// affected by ancestor clipping, keep absolute anchoring this approved deviation.
//
// Deviation registration: `.hero-name-row` flex-wrap: wrap is new
// to this repo —— Vue2 `.detail-hero .name` (photos-people.scss:325-331) is `display:flex; align-items:center;
// gap:12px`, **no** flex-wrap, so long names compress Edit/relation-group capsules and overflow. Keep wrap
// (part of "don't copy Vue2 bugs" category), but it changes hero's actual height, so must be viewed together with above:
// wrap is what makes menu overflow a common path, not an edge case.
//
// Deviation registration (correcting a Vue2 bug, not copying it): Vue2 :528 hardcodes month
// short names as toLocaleDateString('en', {month:'short'}) —— here changed to use BCP-47 tag derived from
// useI18n().locale (same pattern as established in PhotosPeople.vue:157 formatIndexedDate: locale.value.replace('_', '-')),
// renders month abbreviations following current language. Also **does not** copy Vue2's manual trailing "." concatenation
// (:528's `+ '.'`) —— that period is only conventional typography for English abbreviations ("Jan."), Chinese short
// month format (e.g. "3月") has no such punctuation convention, forced concatenation results in awkward "3月." —— changed
// to completely trust Intl.DateTimeFormat to provide localized short month for current locale, no manual punctuation
// concatenation (same approach as PhotosPeople.vue's formatIndexedDate: delegate to Intl, don't concatenate strings yourself).
//
// Color critical path (the highest-risk area in this component — this gap has caused rework before): everything
// in the hero foreground layered over darkened cover photo (back button / avatar ring and name outside it / stat numbers
// and labels / favorite button / Edit/relation group trigger buttons / text and icons of two action buttons) all
// **locked to light colors** (theme-exception), using no dynamic --fg/--fg-muted/--fg-subtle tokens (in light theme
// these are dark colors, layering on darkened photos creates dark-on-dark), especially not --on-accent (only works
// over saturated solid --accent background, here background is uncontrollable face photo, doesn't meet precondition).
// Two dropdown menu bodies (Edit menu / relation menu) are exceptions —— each has solid var(--popup-bg) background,
// no longer layered on photo, menu text/highlight follows normal theme tokens (--fg/--fg-muted/--accent-soft/--accent-text/--remove-fg), not locked.
//
// Correction: the back button `.back`, the Edit/relation
// group triggers `.edit-btn`/`.relation-trigger`, and the two action buttons `.actions .btn`
// (Ask about excepted) were wrongly grouped into the "pinned light" rule above — they all
// actually carry a `var(--float-bg)` pill background (parity-supplied, a frosted
// backdrop-filter surface), so they are not bare text over the photo. Vue2 itself (the Vue 2 panel
// src/views/Photos/photos-people.scss:320/327, 350/360, 406; PhotosPersonDetail.vue:1133,
// 1175/1183, 1197) never pins a colour on these elements: it uses the themed tokens
// `var(--text-2)`/`var(--text-1)` together with the equally themed `var(--float-bg)` pill, so
// the two shift in step and the light theme naturally gets dark text on a light pill — no
// dedicated `is-light` branch is ever needed (the whole of photos-people.scss has only four
// is-light/data-fallback branches, none of them touching a button). This component used to pin
// those three to `#fff` as well, on top of the same themed pill that turns near-white in the
// light theme — light on light, which is exactly the combination that made
// the buttons and text unreadable in the light theme. The fix is
// to put those three back on the themed var(--text-2)/var(--text-1) so they shift together
// with the themed pill, as in Vue2. `.name-text`/`.stat .v`/`.stat .k`/the `.fav-toggle` icon
// are still bare over the photo (no pill), so the pinned-light rule still holds for them and
// they are unchanged.
//
// Dark scrim deviation registration (different from the originally suggested formula):
// the initial approach called for New-UI to use linear-gradient(180deg, transparent, var(--bg) 95%) when lacking --hero-scrim.
// But light theme --bg is near pure white (#f7f5ef) —— blending scrim toward var(--bg) washes the hero middle section
// (avatar/name/stats in vertical center area) to light gray or near white, locked light text in that section becomes
// unreadable, directly contradicting this component's highest-priority "critical path" goal. Changed to fixed black gradient
// unrelated to theme (same pattern as existing PhotosAlbumDetail.vue .album-hero-bg::after: that similar "photo hero +
// locked light foreground" scenario also uses fixed black gradient, independent of var(--bg)), ensures locked light text
// has stable contrast across both themes.
//
// Rule: all id comparisons must use String(a) === String(b).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import PersonAvatar from './PersonAvatar.vue'
import nimoLogoUrl from '../assets/nimo-logo.png'
import { useAskNimo } from '../composables/useAskNimo'
import type { Person } from '../util/peopleView'

const props = defineProps<{
  person: Person
  relationCount: number
  placesCount: number
  // Gates the "Hide person" edit-menu item, mirroring Vue2's
  // `v-if="hiddenPeopleSupported"` on the same menu item (PhotosPersonDetail.vue:43-46).
  // Owned by the people store (usePhotosPeople().hiddenPeopleSupported) — this component
  // stays a pure prop/emit consumer like every other piece of `person`-derived state here.
  hiddenPeopleSupported: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'toggle-fav'): void
  (e: 'rename'): void
  (e: 'merge'): void
  (e: 'hide'): void
  (e: 'delete'): void
  (e: 'pick-relation', relation: string): void
  (e: 'make-album'): void
  (e: 'open-hero-picker'): void
}>()

const { t, locale } = useI18n()

// Unnamed people now have a detail page entry (list menu "View these photos"),
// unreachable in Vue2 so it :22 directly renders person.name, empty name becomes blank title. Added fallback copy here.
// trim check: backend may store names that are only whitespace; rendering as spaces is same as blank, use fallback for both.
const heroTitle = computed(() => props.person.name.trim() || t('photosPersonUnnamedTitle'))

// ── Background layer (Vue2 :497-506) ────────────────────────────────────
// heroAssetId takes priority; otherwise use face thumbnail as background; if both missing → gradient fallback (isFallback).
const heroBg = computed(() => {
  if (props.person.heroAssetId) return service.photos.thumbnailUrl(props.person.heroAssetId, 'large')
  return service.photos.personFaceThumbnailUrl(props.person.id, props.person.coverFaceId)
})
const isFallback = computed(() => !props.person.coverFaceId && !props.person.heroAssetId)

// ── First seen (Vue2 :522-529, deviation 9 explained in file header) ────
function parsedFirstSeen(): Date | null {
  if (!props.person.firstSeen) return null
  const d = new Date(props.person.firstSeen)
  return Number.isNaN(d.getTime()) ? null : d
}
const firstYear = computed(() => {
  const d = parsedFirstSeen()
  return d ? String(d.getFullYear()) : ''
})
const firstMonthShort = computed(() => {
  const d = parsedFirstSeen()
  if (!d) return ''
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { month: 'short' }).format(d)
})

// ── Relation group (Vue2 :586-590) ────────────────────────────────────────
const relationOptions = [
  { value: '', labelKey: 'photosPersonRelationNone' },
  { value: 'family', labelKey: 'photosPersonRelationFamily' },
  { value: 'friend', labelKey: 'photosPersonRelationFriend' },
  { value: 'work', labelKey: 'photosPersonRelationWork' },
] as const

const relationLabelKey = computed(() => {
  const cur = props.person.relation || ''
  const opt = relationOptions.find((o) => o.value === cur)
  return opt ? opt.labelKey : 'photosPersonRelationNone'
})

// ── Two menus (Vue2 :782-840, implementation deviation explained in file header) ───
const editOpen = ref(false)
const relationOpen = ref(false)
const editWrapRef = ref<HTMLElement | null>(null)
const relationWrapRef = ref<HTMLElement | null>(null)

function pickEdit(action: 'rename' | 'merge' | 'hide' | 'delete'): void {
  editOpen.value = false
  if (action === 'rename') emit('rename')
  else if (action === 'merge') emit('merge')
  else if (action === 'hide') emit('hide')
  else emit('delete')
}

function pickRelation(value: string): void {
  relationOpen.value = false
  emit('pick-relation', value)
}

// Opens the Ask Nimo popup with Vue2's exact canned prompt (PhotosPersonDetail.vue:89-92).
function onAskNimo(): void {
  useAskNimo().openWith(t('photosPersonAskAboutPrompt', { name: heroTitle.value }))
}

function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (editOpen.value && editWrapRef.value && !editWrapRef.value.contains(target)) editOpen.value = false
  if (relationOpen.value && relationWrapRef.value && !relationWrapRef.value.contains(target)) relationOpen.value = false
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // Check both menus independently, close both —— can't use early return like early implementation because
  // if both menus are open, Esc would only close the first one (caught as a real regression by component's own test validation).
  editOpen.value = false
  relationOpen.value = false
}
onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <!-- Root class renamed `person-hero` → `detail-hero` and every descendant
       class below renamed to its parity/Vue2 anchor so
       `src/photos/styles/vue2-parity/photos-people.scss` governs directly. data-test attributes,
       props/emits and all logic are unchanged. -->
  <div class="detail-hero" data-test="hero-root" :data-fallback="isFallback ? 'true' : 'false'">
    <!-- The clip layer. The blurred background and the darkening scrim
         are contained here, `overflow: hidden` is this element's own responsibility —
         .detail-hero no longer clips, otherwise the two hero dropdown menus (absolute) would be
         cut off by an ancestor. -->
    <div class="hero-clip" data-test="hero-clip">
      <div
        class="bg"
        data-test="hero-bg"
        :class="{ 'is-fallback': isFallback }"
        :style="isFallback ? {} : { backgroundImage: `url(${heroBg})` }"
      />
      <div v-if="!isFallback" class="scrim" data-test="hero-scrim" />
    </div>

    <!-- Copy is t('photosPeople') ("People") —— matches Vue2 :6 $t('People').
         Not photosPersonBack ("Back to people"): that text is for the back button in **person not found** empty state
         (PhotosPersonDetail.vue gate ③), two different contexts. -->
    <button type="button" class="back" data-test="hero-back" :aria-label="t('photosPeople')" @click="emit('back')">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {{ t('photosPeople') }}
    </button>

    <div class="inner">
      <div class="avatar" data-test="hero-avatar">
        <PersonAvatar :person-id="person.id" :name="person.name" :ver="person.coverFaceId" :size="200" />
      </div>

      <div class="info">
        <div class="name">
          <span class="name-text" data-test="hero-name">{{ heroTitle }}</span>

          <!-- Unfavorited state title/aria matches Vue2 :26 `Mark as favorite` (not generic
               `Favorite`); favorited state reuses photosUnfavorite, whose text matches Vue2's original `Remove favorite` translation. -->
          <button
            type="button"
            class="fav-toggle"
            data-test="hero-fav"
            :class="{ 'is-fav': person.favorite }"
            :aria-label="t(person.favorite ? 'photosUnfavorite' : 'photosPersonMarkFavorite')"
            :title="t(person.favorite ? 'photosUnfavorite' : 'photosPersonMarkFavorite')"
            @click="emit('toggle-fav')"
          >
            <svg v-if="person.favorite" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
          </button>

          <div ref="editWrapRef" class="relation-picker" data-test="hero-edit-wrap">
            <button type="button" class="edit-btn" data-test="hero-edit-trigger" @click.stop="editOpen = !editOpen">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
              {{ t('photosPersonEdit') }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="editOpen" class="relation-menu edit-menu" data-test="hero-edit-menu">
              <button type="button" class="relation-option" data-test="hero-edit-rename" @click="pickEdit('rename')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                <!-- Short verb key (matches Vue2 :38 `$t('Rename')`); photosPersonRename
                     is the rename dialog title "Rename person", cannot replace menu item. -->
                {{ t('photosPersonMenuRename') }}
              </button>
              <button type="button" class="relation-option" data-test="hero-edit-merge" @click="pickEdit('merge')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
                <!-- Same as above, matches Vue2 :41 `$t('Merge into…')`; photosPersonMergeInto
                     is the merge dialog title "Merge into another person". -->
                {{ t('photosPersonMenuMergeInto') }}
              </button>
              <!-- "Hide person" — per Vue2 PhotosPersonDetail.vue:43-46, only
                   shows when hiddenPeopleSupported, with an explanatory title; the click executes
                   immediately, the container owns the actual hide + toast + navigation (this
                   component never touches the store, same division of labor as the file-header
                   comment). -->
              <button
                v-if="hiddenPeopleSupported"
                type="button"
                class="relation-option"
                data-test="hero-edit-hide"
                :title="t('photosPersonHideGateTitle')"
                @click="pickEdit('hide')"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9" /><path d="M10 13h4" /></svg>
                {{ t('photosPersonMenuHide') }}
              </button>
              <button type="button" class="relation-option edit-menu-danger" data-test="hero-edit-delete" @click="pickEdit('delete')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                {{ t('photosPersonDelete') }}
              </button>
            </div>
          </div>

          <div ref="relationWrapRef" class="relation-picker" data-test="hero-relation-wrap">
            <button type="button" class="relation-trigger" data-test="hero-relation-trigger" @click.stop="relationOpen = !relationOpen">
              {{ t(relationLabelKey) }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="relationOpen" class="relation-menu" data-test="hero-relation-menu">
              <button
                v-for="opt in relationOptions"
                :key="opt.value"
                type="button"
                class="relation-option"
                data-test="hero-relation-option"
                :data-value="opt.value"
                :data-active="(person.relation || '') === opt.value"
                @click="pickRelation(opt.value)"
              >
                {{ t(opt.labelKey) }}
                <svg v-if="(person.relation || '') === opt.value" data-test="hero-relation-check" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="stats-row" data-test="hero-stats">
          <div class="stat" data-test="hero-stat-photos">
            <div class="v">{{ person.count ? person.count.toLocaleString() : 0 }}</div>
            <div class="k">{{ t('photosPersonStatPhotos') }}</div>
          </div>
          <div class="stat" data-test="hero-stat-places">
            <div class="v">{{ placesCount }}</div>
            <div class="k">{{ t('photosPersonStatPlaces') }}</div>
          </div>
          <div class="stat" data-test="hero-stat-appears">
            <div class="v">{{ relationCount }}</div>
            <div class="k">{{ t('photosPersonStatAppearsWith') }}</div>
          </div>
          <div class="stat" data-test="hero-stat-first-seen">
            <div class="v">{{ firstYear }}<span class="stat-month">{{ firstMonthShort }}</span></div>
            <div class="k">{{ t('photosPersonStatFirstSeen') }}</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <!-- Ask about {name} — Vue2 :89-92 `.btn-ai`, first in actions order.
             Click is currently a no-op (onAskNimo) — wiring comes later. -->
        <button type="button" class="btn btn-ai" data-test="hero-ask-nimo" @click="onAskNimo">
          <span class="ask-nimo-icon" :style="{ backgroundImage: `url(${nimoLogoUrl})` }" />
          {{ t('photosPersonAskAbout', { name: heroTitle }) }}
        </button>
        <button type="button" class="btn" data-test="hero-make-album" @click="emit('make-album')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          {{ t('photosPersonMakeAlbum') }}
        </button>
        <button type="button" class="btn" data-test="hero-background" @click="emit('open-hero-picker')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          {{ t('photosPersonBackground') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup. The
   short version: every rule below that duplicated a parity anchor under the same selector
   path has been deleted (parity — `src/photos/styles/vue2-parity/photos-people.scss` —
   governs directly, using its own token set). What survives is exactly two kinds of rule:
   (1) structural New-UI-only additions with no Vue2/parity counterpart at all (`.hero-clip`,
   `.scrim`, the `.bg::after` neutralizer, `.stat-month`, the approved `overflow`/`flex-wrap`
   deviations); (2) the hero's "pinned light foreground" theme-exception family — captions/
   labels/icons that sit *directly* over the (possibly light-themed) blurred cover photo with
   no opaque backing of their own (`.name-text`, `.stat .v`/`.stat .k`, the `.fav-toggle`
   icon) keep an explicit `color` override here, because parity itself uses *themed* tokens
   (`--text-1`/`--text-2`) for these captions and relies on a light-theme text-shadow halo
   instead of a fixed light color — a real design difference from this app's already-reviewed
   "pinned foreground color" red-line decision (see file-header comment), not something this
   cleanup should undo.

   Correction: `.back`, `.edit-btn`/`.relation-trigger`, and
   `.actions .btn` (excluding `.btn-ai`) were previously miscategorized into that same "pinned
   light foreground" family and hardcoded to a fixed white. They don't belong there — all three carry
   their own themed `var(--float-bg)` pill background (parity-supplied, not overridden here),
   so in the light theme that pill goes near-white while the text stayed pinned white too:
   white-on-white, exactly the reported "hero pills/text hard to read in light theme"
   defect. Vue2's own rules for these three (photos-people.scss:320/327, 350/360, 406;
   PhotosPersonDetail.vue:1133, 1175/1183, 1197) were never pinned — they use themed
   `var(--text-2)`/`var(--text-1)`, which stays correctly paired with the themed pill
   background across both themes, with no `is-light` branch needed at all. Reverted below to
   match.

   These color survivors are written as full parity-matching selector paths (not bare class
   names) specifically so the scoped-attribute specificity bump reliably beats parity's own
   rules for the same element regardless of stylesheet load order — a bare `.back { color }`
   would tie parity's `.detail-hero .back` in specificity, which is exactly the kind of
   coin-flip this technique avoids. */
.detail-hero {
  position: relative;
  /* overflow: hidden is deliberately absent here (parity's own
     .detail-hero has it). The two dropdown menus are absolute-anchored (see the file-header
     "implementation deviation" note); any ancestor clip would remove them entirely — z-index is
     useless once the ancestor already clips, and there's no scrollbar to save it. A long name
     wrapping `.name` pushes the trigger down, clipping off roughly half of the menu's last item.
     Clipping responsibility moved down to .hero-clip. When adding new absolutely-positioned
     children here, note this element no longer clips them at the hero's own bounds.
     min-height/border-bottom/background all now come from parity's own `.detail-hero` rule
     (duplicates deleted); flex:none is Vue2's own component-scoped supplement
     (PhotosPersonDetail.vue:1104), not transcribed into the shared parity file yet. */
  overflow: visible;
  flex: none;
}
/* Clip only what actually needs clipping: the blurred cover image + the darkening scrim.
   Why this must be a **separate ancestor container** rather than letting `.bg` clip itself
   (the straightforward fix one might try first): `filter: blur(40px)`'s output is painted **outside**
   the element's own box per spec (up to roughly 120px of bleed here), and `transform: scale(1.2)`
   then enlarges the whole thing by 20% on top of that — an element's own `overflow` can't clip
   its own filter output, only an **ancestor's** `overflow` can. Without this, the blur edges
   would bleed into the tabs/grid below and the page's sides.
   The other candidate fix was reverting the menus to Vue2's own position:fixed +
   getBoundingClientRect coordinate math; not chosen because that reintroduces coordinate
   calculation, and Vue2's own version loses its anchor on page scroll/window resize (it never
   wires up scroll/resize recalculation) — that would just trade one known defect for another. */
.hero-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
/* `.bg`'s own base rule (position/inset/background-size/position/filter/transform/opacity)
   duplicated parity's `.detail-hero .bg` byte-for-byte and has been deleted. Only the
   fallback modifier survives: the plain-gradient fallback for when there is no cover photo and no
   face thumbnail — it doesn't layer on blur/scale/opacity (those three are designed for "a
   blurred photo"; stacked on a flat-color gradient they'd just wash it out into a 45%-opacity
   pale haze, not the saturated gradient block PersonAvatar's own three-tier fallback uses).
   Parity's own [data-fallback] override rule likewise never lifts the parent rule's
   filter/opacity — judged here as an unintentional visual dilution on Vue2's part, not copied;
   same gradient token, rendered as a full-strength opaque color block instead). */
.bg.is-fallback {
  filter: none;
  transform: none;
  opacity: 1;
  background: var(--avatar-fallback);
}
/* Parity paints its own scrim as `.bg::after` (mixed toward var(--bg), washes out in the light
   theme exactly where the pinned light text sits — see file-header comment for the full
   reasoning). This component uses a separate `.scrim` sibling div with
   a fixed black gradient instead (below) — neutralize parity's pseudo-element so the two don't
   stack. Written as the full parity selector path for the specificity reasons noted above. */
.detail-hero .bg::after { content: none; }
.scrim {
  position: absolute;
  inset: 0;
  /* theme-exception: a fixed darkening gradient layered over the person's cover photo, giving
     the pinned-light foreground text/icons below it cross-theme-constant readable contrast — see
     this file's header comment for the full reasoning, not repeated here. */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.5) 45%, rgba(0, 0, 0, 0.68) 100%);
}

/* This button has its own themed `var(--float-bg)` pill background
   (parity-supplied), so it should NOT join the "pinned light foreground" family — pinning its
   text white while its background is themed (and goes near-white in the light theme) produced
   the reported white-on-white washout. Matches Vue2's own `.back`/`.back:hover`
   (photos-people.scss:320/327), which have always used themed var(--text-2)/var(--text-1) —
   correctly paired with the same themed pill background in both themes, no `is-light` branch
   needed. Everything else about this button — position/padding/border-radius/background/
   backdrop-filter/border/hover background — still comes straight from parity, duplicates
   deleted. */
.detail-hero .back { color: var(--text-2); }
.detail-hero .back:hover { color: var(--text-1); }

/* `.inner`'s position/display/align-items/gap/padding duplicated parity's own `.detail-hero
   .inner` rule and have been deleted. `z-index`/`min-height` survive: Vue2 itself has TWO
   sources for `.inner` — the shared photos-people.scss rule parity already transcribes, and a
   second, component-scoped supplement in PhotosPersonDetail.vue's own <style> block
   (:1110-1118) that layers z-index:1 and min-height:280px on top — parity hasn't picked up
   that second source yet, so it stays local here rather than going untranscribed silently. */
.inner { z-index: 1; min-height: 280px; }

/* `.avatar`'s sizing/border/shadow duplicated parity's own `.detail-hero .avatar` rule
   (different token names, same concept — border/shadow tokens, not text/icon color, so there
   is no theme-exception concern here) and has been deleted entirely. */

.name {
  /* Deviation 10 (already registered in the file header): flex-wrap:wrap is a New-UI addition —
     parity/Vue2's own `.name` doesn't have it, and a long name would squeeze and overflow the
     Edit/relation-group pills. display/align-items/gap/font/color all come from parity's
     `.detail-hero .name`; this is the only local override left. */
  flex-wrap: wrap;
}
/* theme-exception: the name sits directly over the darkened cover photo, so it needs a
   cross-theme-constant light color (not --fg — in the light theme --fg is near-black, which
   would render dark-on-dark over the darkened photo). font-family/size/weight/letter-spacing all
   come from parity's `.detail-hero .name` — only color needs overriding here. */
.name-text { color: #fff; }

/* The previous bare `.fav-toggle { … }` here
   compiled to `.fav-toggle[data-v-hash]` — specificity (0,2,0). Parity's own
   `.detail-hero .name .fav-toggle` (photos-people.scss:420-430) is (0,3,0) and — being an
   unscoped global rule — wins regardless of stylesheet load order, the exact opposite of every
   other survivor in this file (which all use the full compound-path technique explained at the
   top of this block precisely to avoid this). The bare selector was dead code.

   True cascade situation, verified against Vue2's real template (PhotosPersonDetail.vue:23-29):
   this button carries an inline `style="background:transparent;border:0;padding:4px;
   cursor:pointer;display:inline-flex;align-items:center;color:[gold hex]"` — inline style has
   the highest priority for any property it sets, for every pseudo-class state (a `:hover` rule
   cannot override a property the base element's inline style already claims), so parity's own
   `.fav-toggle`/`.fav-toggle:hover` rule (border/background/transition) is fully unreachable in
   real Vue2 rendering — dead in the *source of truth*, not just an artifact of this app's
   token choices like this file's other survivors. That dead rule is left as-is in parity for
   future cleanup, not touched here.

   This app's plain `<svg>` has no equivalent to Vue2's inline-style mechanism, so the real
   values have to be carried by an actual CSS rule here, written as the same full compound path
   parity uses (plus the scoped-attribute bump) so it actually governs: background:transparent,
   border:0, padding:4px, inline-flex, centered — Vue2's real look, not parity's dead-code pill.
   Icon color stays a theme-exception pin (rgba/--star-fg), not Vue2's real per-state inline
   `color` prop (`#FFD60A` favorited / `var(--text-3)` unfavorited): with the pill background
   now gone, the icon sits directly over the photo, and `var(--text-3)` is exactly the kind of
   themed-dark-in-light-theme value this whole component's "pinned foreground color" red-line
   section already exists to keep out from here — not a fresh decision, the same established
   policy applied consistently. */
.detail-hero .name .fav-toggle {
  background: transparent;
  border: 0;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  /* Unfavorited state: a semi-transparent light outlined star, likewise pinned regardless of
     theme (see the file-header "pinned foreground color" red-line note). The favorited state is
     the `.fav-toggle.is-fav` rule below, reusing this app's already-established --star-fg
     fallback convention. */
  color: rgba(255, 255, 255, 0.72); /* theme-exception */
}
.detail-hero .name .fav-toggle.is-fav {
  /* --star-fg not separately defined in both themes, established precedent in this repo (PhotosGrid.vue/
     PersonAvatar.vue both use var(--star-fg, #ffd60a)) —— fixed golden star unchanged across skins,
     expressed as var(fallback) form, color-guard clears by token usage, not bare literal. */
  color: var(--star-fg, #ffd60a);
}
/* The previous version of this rule kept a new
   faint hover tint as a "don't copy a Vue2 UX gap" affordance. Ruling: pixel parity governs
   here — this rule shape exists purely to neutralize a specificity problem, not to introduce
   new visuals Vue2 never has. Vue2's real hover state is pixel-identical to its resting state
   (the inline style's transparent background / zero border applies unconditionally — inline
   styles aren't scoped to pseudo-classes, so there's nothing for a `:hover` rule to add or
   change). Reverted to that: same values as the base rule above, no added tint.

   This selector still has to exist, though — it is not a no-op left over from the old version.
   The math: this file's own base rule above is `.detail-hero .name .fav-toggle` + the scoped
   attribute = 4 class-level selectors, (0,4,0). Parity's OWN hover rule
   (photos-people.scss:427-430) is `.detail-hero .name .fav-toggle:hover` = 4 class-level
   selectors too (the `:hover` pseudo-class counts the same as a class) — also (0,4,0). Tied
   specificity between an unscoped global rule and a scoped local one resolves by *stylesheet
   load order*, which this app does not guarantee — so on hover, parity's own darkened,
   dead-in-Vue2 background/border-color pair could win that coin flip and render a pill Vue2
   never shows. Adding this `:hover`-qualified rule (base selector + `:hover` + the scoped
   attribute = 5 class-level selectors, (0,5,0)) reliably beats parity's hover rule regardless of
   load order, the same guaranteed-win technique used by every other survivor in this file — it
   just now carries the *same* values as rest instead of a new tint, so hovering renders
   pixel-identical to resting, matching Vue2. */
.detail-hero .name .fav-toggle:hover { background: transparent; border: 0; }

/* `.relation-picker`'s position/display/align-items duplicated parity's own rule exactly and
   has been deleted. */

/* Same reasoning as `.back` above — these two triggers carry their own
   themed `var(--float-bg)` pill background, so pinning their text white produced white-on-
   near-white in the light theme ("Edit/No group pills... hard to read"). Vue2's
   own `.edit-btn`/`.relation-select` (photos-people.scss:350/360, 442/452 — the latter's
   `.relation-select` rule has since been deleted as a confirmed zero-consumer orphan;
   PhotosPersonDetail.vue:1175/1183/1197) have always used themed var(--text-2)/var(--text-1),
   correctly paired with the same themed pill background, no `is-light` branch needed. Base +
   hover still written as parity's own compound selectors so the scoped-attribute specificity
   bump reliably beats parity's `:hover` variant too (parity's hover selector is itself a
   4-class compound, `.detail-hero .name .edit-btn:hover`, so a bare local `.edit-btn:hover`
   would lose outright, not just tie). Height/padding/border-radius/border/background/
   backdrop-filter/font — all still come straight from parity. */
.detail-hero .name .edit-btn,
.detail-hero .name .relation-trigger { color: var(--text-2); }
.detail-hero .name .edit-btn:hover,
.detail-hero .name .relation-trigger:hover { color: var(--text-1); }

/* The popup bodies themselves (`.relation-menu`/`.relation-option`/`.edit-menu-danger`) are
   NOT part of the "pinned light foreground" family — per the file-header "pinned foreground
   color" red-line note, once open they sit on their own opaque `var(--surface-1)` popup
   background, not on the photo, so
   they follow normal theme tokens same as any other popup. Every property parity supplies for
   them (position/sizing/background/border/hover/active/danger colors) duplicated this
   component's old local rules 1:1 in intent (just different token names) and has been deleted
   entirely — no survivors needed here. */

.stat-month {
  /* New-UI addition: Vue2 renders this span with an inline style, not a class
     (PhotosPersonDetail.vue:83), so there is no parity selector to align to or delete —
     values transcribed from that inline style, color pinned per this hero's own convention. */
  font-size: 12px;
  margin-left: 4px;
  font-family: var(--font);
  color: rgba(255, 255, 255, 0.72); /* theme-exception: same as .stat .k */
}
/* theme-exception: the stat numbers/labels sit over the darkened cover photo and need a
   cross-theme-constant light color — parity's own `.detail-hero .stat .v`/`.stat .k` use themed
   tokens (`.v` doesn't even set color, it inherits; `.k` uses var(--text-3)); font/size/weight
   and other structural properties are all inherited/reused from parity, only color is overridden
   here. */
.detail-hero .stat .v { color: #fff; } /* theme-exception */
.detail-hero .stat .k { color: rgba(255, 255, 255, 0.72); } /* theme-exception */

/* `.actions`'s layout duplicated parity's own `.detail-hero .actions` rule exactly (parity is
   actually a superset — it also sets align-items:stretch, which this component's old local
   rule was missing) and has been deleted. */

/* Same reasoning as `.back` above — "Make album"/"Background" carry
   their own themed `var(--float-bg)` pill background, so pinning their text white produced
   white-on-near-white in the light theme ("Make album/Background... washed-out
   translucent white pills with white text"). Vue2's own `.actions .btn`
   (photos-people.scss:397; PhotosPersonDetail.vue:1133) has always used themed var(--text-1),
   correctly paired with the same themed pill background, no `is-light` branch needed; it
   doesn't change color on hover either, so this single declaration survives hover too without
   a separate hover rule. `:not(.btn-ai)` scopes this to the two plain buttons only — `.btn-ai`
   (the purple "Ask about {name}" button, already correct and explicitly out of scope for this
   fix) also carries the `.btn` class, and its own always-white text must stay untouched;
   parity's own `.detail-hero .actions .btn-ai` rule (declared after `.btn` in the same file)
   still wins that tie for it exactly as before. Everything else — padding/border-radius/
   background/backdrop-filter/border/hover background — still comes straight from parity. */
.detail-hero .actions .btn:not(.btn-ai) { color: var(--text-1); }

/* Ask-about icon — Vue2 :90 renders this as an inline-styled <span>
   (display:inline-block;width:16px;height:16px;border-radius:99px;background:url(...)
   center/cover no-repeat), not a class, so there is no parity selector to align to or
   delete — values transcribed from that inline style; only the background-image itself
   stays inline (imported asset URL, same technique as PersonRelationsTab.vue's `.hd .orb`). */
.ask-nimo-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 99px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
