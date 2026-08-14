<script setup lang="ts">
// Task 10 (SP7-P5 person details): PersonHero.vue —— person detail page hero section (cover + avatar + name/favorite +
// edit menu + relation group dropdown + four stats + two action buttons). Port each section from Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:3-91 (template), :492-529 (cover/heroBg/
// heroIsFallback/firstYear/firstMonthShort), :586-590 (relationLabel), :782-840
// (menu toggle and positioning logic); styles from photos-people.scss:277-460.
//
// Pure presentation + emit, no store access, no requests — all side effects are in T14 container (brief defines responsibilities).
// Ask Nimo button (Vue2 :85-87) is not rendered (spec D1 deferred to SP8).
//
// Implementation deviation (approved, per brief): Vue2 uses getBoundingClientRect for manual fixed positioning +
// document mousedown + closest('.relation-menu') to manage two menus (:598-617, 782-831).
// Here changed to position:absolute anchored to trigger buttons within the component (same pattern as established
// in PhotosPeople.vue :352-358, 412-424 with people-pop-wrap/people-menu), closing still uses document-level
// mousedown + keydown(Esc), attached on onMounted / removed on onUnmounted, paired. Visual position remains consistent
// (menu appears directly below trigger button).
//
// ★ Final review Important 5 deviation registration —— **Why Vue2 uses fixed**: not arbitrary, but to work around
// `.detail-hero { overflow: hidden }` (photos-people.scss:277-281). fixed containment block is the viewport,
// unaffected by any ancestor overflow clipping; absolute containment block is the nearest positioned ancestor,
// and gets clipped if ancestor clips. Switching to absolute breaks z-index completely (clipping happens before compositing),
// and hero has no scrollbar to rescue it—menu gets **directly clipped**: default layout menu bottom ≈279.5px
// just 0.5px away from clipping; once a long name triggers `.hero-name-row { flex-wrap: wrap }` wrapping,
// trigger button shifts down ~46px, menu bottom reaches ≈296px, last item "Work" gets clipped about halfway
// (same for larger font / narrow viewport). Fix (review offered two options, chose the first; see .hero-clip comment
// in style block): move `overflow: hidden` from .person-hero to dedicated .hero-clip clipping layer, menu no longer
// affected by ancestor clipping, keep absolute anchoring this approved deviation.
//
// Deviation 10 registration (not previously declared, added in final review): `.hero-name-row` flex-wrap: wrap is new
// to this repo —— Vue2 `.detail-hero .name` (photos-people.scss:325-331) is `display:flex; align-items:center;
// gap:12px`, **no** flex-wrap, so long names compress Edit/relation-group capsules and overflow. Keep wrap
// (part of "don't copy Vue2 bugs" category), but it changes hero's actual height, so must be viewed together with above:
// wrap is what makes menu overflow a common path, not an edge case.
//
// Deviation 9 registration (brief explicitly requires correction, don't copy Vue2 bug): Vue2 :528 hardcodes month
// short names as toLocaleDateString('en', {month:'short'}) —— here changed to use BCP-47 tag derived from
// useI18n().locale (same pattern as established in PhotosPeople.vue:157 formatIndexedDate: locale.value.replace('_', '-')),
// renders month abbreviations following current language. Also **does not** copy Vue2's manual trailing "." concatenation
// (:528's `+ '.'`) —— that period is only conventional typography for English abbreviations ("Jan."), Chinese short
// month format (e.g. "3月") has no such punctuation convention, forced concatenation results in awkward "3月." —— changed
// to completely trust Intl.DateTimeFormat to provide localized short month for current locale, no manual punctuation
// concatenation (same approach as T6 formatIndexedDate: delegate to Intl, don't concatenate strings yourself).
//
// Color critical path (highest risk in this task; brief emphasized "this gap caused two reworks in this phase"): everything
// in the hero foreground layered over darkened cover photo (back button / avatar ring and name outside it / stat numbers
// and labels / favorite button / Edit/relation group trigger buttons / text and icons of two action buttons) all
// **locked to light colors** (theme-exception), using no dynamic --fg/--fg-muted/--fg-subtle tokens (in light theme
// these are dark colors, layering on darkened photos creates dark-on-dark), especially not --on-accent (only works
// over saturated solid --accent background, here background is uncontrollable face photo, doesn't meet precondition).
// Two dropdown menu bodies (Edit menu / relation menu) are exceptions —— each has solid var(--popup-bg) background,
// no longer layered on photo, menu text/highlight follows normal theme tokens (--fg/--fg-muted/--accent-soft/--accent-text/--remove-fg), not locked.
//
// Dark scrim deviation registration (different from brief's suggested formula, detailed rationale recorded in task report):
// brief suggested New-UI use linear-gradient(180deg, transparent, var(--bg) 95%) when lacking --hero-scrim.
// But light theme --bg is near pure white (#f7f5ef) —— blending scrim toward var(--bg) washes the hero middle section
// (avatar/name/stats in vertical center area) to light gray or near white, locked light text in that section becomes
// unreadable, directly contradicting this task's highest priority "critical path" goal. Changed to fixed black gradient
// unrelated to theme (same pattern as existing PhotosAlbumDetail.vue .album-hero-bg::after: that similar "photo hero +
// locked light foreground" scenario also uses fixed black gradient, independent of var(--bg)), ensures locked light text
// has stable contrast across both themes.
//
// Rule: all id comparisons must use String(a) === String(b).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import PersonAvatar from './PersonAvatar.vue'
import type { Person } from '../util/peopleView'

const props = defineProps<{
  person: Person
  relationCount: number
  placesCount: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'toggle-fav'): void
  (e: 'rename'): void
  (e: 'merge'): void
  (e: 'delete'): void
  (e: 'pick-relation', relation: string): void
  (e: 'make-album'): void
  (e: 'open-hero-picker'): void
}>()

const { t, locale } = useI18n()

// User acceptance feedback: unnamed people now have a detail page entry (list menu "View these photos"),
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

function pickEdit(action: 'rename' | 'merge' | 'delete'): void {
  editOpen.value = false
  if (action === 'rename') emit('rename')
  else if (action === 'merge') emit('merge')
  else emit('delete')
}

function pickRelation(value: string): void {
  relationOpen.value = false
  emit('pick-relation', value)
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
  <div class="person-hero" data-test="hero-root" :data-fallback="isFallback ? 'true' : 'false'">
    <!-- Final review Important 5: clipping layer. Blurred background and darkening scrim are contained here,
         `overflow: hidden` handled by itself, .person-hero no longer clips —— otherwise the two hero dropdown menus (absolute)
         would get clipped by ancestor. -->
    <div class="hero-clip" data-test="hero-clip">
      <div
        class="hero-bg"
        data-test="hero-bg"
        :class="{ 'is-fallback': isFallback }"
        :style="isFallback ? {} : { backgroundImage: `url(${heroBg})` }"
      />
      <div v-if="!isFallback" class="hero-scrim" data-test="hero-scrim" />
    </div>

    <!-- Final review Minor 7: copy is t('photosPeople') ("People") —— matches Vue2 :6 $t('People').
         Not photosPersonBack ("Back to people"): that text is for the back button in **person not found** empty state
         (PhotosPersonDetail.vue gate ③), two different contexts. -->
    <button type="button" class="hero-back" data-test="hero-back" :aria-label="t('photosPeople')" @click="emit('back')">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {{ t('photosPeople') }}
    </button>

    <div class="hero-inner">
      <div class="hero-avatar" data-test="hero-avatar">
        <PersonAvatar :person-id="person.id" :name="person.name" :ver="person.coverFaceId" :size="200" />
      </div>

      <div class="hero-info">
        <div class="hero-name-row">
          <span class="hero-name" data-test="hero-name">{{ heroTitle }}</span>

          <!-- Final review Minor 7: unfavorited state title/aria matches Vue2 :26 `Mark as favorite` (not generic
               `Favorite`); favorited state reuses photosUnfavorite, whose text matches Vue2's original `Remove favorite` translation. -->
          <button
            type="button"
            class="hero-fav"
            data-test="hero-fav"
            :class="{ 'is-fav': person.favorite }"
            :aria-label="t(person.favorite ? 'photosUnfavorite' : 'photosPersonMarkFavorite')"
            :title="t(person.favorite ? 'photosUnfavorite' : 'photosPersonMarkFavorite')"
            @click="emit('toggle-fav')"
          >
            <svg v-if="person.favorite" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
          </button>

          <div ref="editWrapRef" class="hero-menu-wrap" data-test="hero-edit-wrap">
            <button type="button" class="hero-trigger" data-test="hero-edit-trigger" @click.stop="editOpen = !editOpen">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
              {{ t('photosPersonEdit') }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="editOpen" class="hero-menu" data-test="hero-edit-menu">
              <button type="button" class="hero-menu-item" data-test="hero-edit-rename" @click="pickEdit('rename')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                <!-- Final review Minor 6: short verb key (matches Vue2 :38 `$t('Rename')`); photosPersonRename
                     is the rename dialog title "Rename person", cannot replace menu item. -->
                {{ t('photosPersonMenuRename') }}
              </button>
              <button type="button" class="hero-menu-item" data-test="hero-edit-merge" @click="pickEdit('merge')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
                <!-- Final review Minor 6: same as above, matches Vue2 :41 `$t('Merge into…')`; photosPersonMergeInto
                     is the merge dialog title "Merge into another person". -->
                {{ t('photosPersonMenuMergeInto') }}
              </button>
              <button type="button" class="hero-menu-item hero-menu-danger" data-test="hero-edit-delete" @click="pickEdit('delete')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                {{ t('photosPersonDelete') }}
              </button>
            </div>
          </div>

          <div ref="relationWrapRef" class="hero-menu-wrap" data-test="hero-relation-wrap">
            <button type="button" class="hero-trigger" data-test="hero-relation-trigger" @click.stop="relationOpen = !relationOpen">
              {{ t(relationLabelKey) }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="relationOpen" class="hero-menu" data-test="hero-relation-menu">
              <button
                v-for="opt in relationOptions"
                :key="opt.value"
                type="button"
                class="hero-menu-item"
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

        <div class="hero-stats" data-test="hero-stats">
          <div class="hero-stat" data-test="hero-stat-photos">
            <div class="v">{{ person.count ? person.count.toLocaleString() : 0 }}</div>
            <div class="k">{{ t('photosPersonStatPhotos') }}</div>
          </div>
          <div class="hero-stat" data-test="hero-stat-places">
            <div class="v">{{ placesCount }}</div>
            <div class="k">{{ t('photosPersonStatPlaces') }}</div>
          </div>
          <div class="hero-stat" data-test="hero-stat-appears">
            <div class="v">{{ relationCount }}</div>
            <div class="k">{{ t('photosPersonStatAppearsWith') }}</div>
          </div>
          <div class="hero-stat" data-test="hero-stat-first-seen">
            <div class="v">{{ firstYear }}<span class="hero-stat-month">{{ firstMonthShort }}</span></div>
            <div class="k">{{ t('photosPersonStatFirstSeen') }}</div>
          </div>
        </div>
      </div>

      <div class="hero-actions">
        <button type="button" class="hero-action-btn" data-test="hero-make-album" @click="emit('make-album')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          {{ t('photosPersonMakeAlbum') }}
        </button>
        <button type="button" class="hero-action-btn" data-test="hero-background" @click="emit('open-hero-picker')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          {{ t('photosPersonBackground') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.person-hero {
  position: relative;
  min-height: 280px;
  /* Final review Important 5: **intentionally no overflow: hidden here** (Vue2 .detail-hero has it,
     photos-people.scss:277-281). The two dropdown menus use absolute positioning (see implementation deviation
     registration in file header), if ancestor clips they disappear entirely, z-index useless, no scrollbar to rescue ——
     long names trigger .hero-name-row wrapping and menu's last item gets clipped about halfway. Clipping responsibility
     moved to .hero-clip. When adding new absolutely positioned children, note: they will **not** be clipped by hero border. */
  flex: none;
}
/* Clip only "what needs clipping": blurred cover + darkening scrim.
   Why must be **independent ancestor container**, not .hero-bg's own overflow:hidden (what review literally suggested):
   `filter: blur(40px)` output is painted **outside** element box per spec (up to ~120px overflow here),
   `transform: scale(1.2)` also enlarges it 20% —— element's own overflow can't clip its own filter output,
   only **ancestor** overflow can. Without clipping, blur edges spill into lower tabs/grid and page sides.
   Another candidate fix: revert menus to Vue2's position:fixed + getBoundingClientRect manual coordinates;
   didn't choose it because requires reintroducing coordinate math, and Vue2's approach detaches on page scroll/window resize
   (no scroll/resize recalc attached), trading one known gap for another. */
.hero-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(40px) saturate(1.4);
  transform: scale(1.2);
  opacity: 0.45;
}
/* Solid gradient fallback when no cover/no face thumbnail —— don't layer blur/scale/opacity
   (those three designed for "blurred photos", on solid gradient just washes to 45% transparent haze,
   not the same saturated gradient block as PersonAvatar's three-tier fallback; Vue2 :1420-1422 [data-fallback]
   override doesn't remove parent filter/opacity, judged as unintended visual dilution, not copied ——
   use same gradient token but render full-saturation opaque block). */
.hero-bg.is-fallback {
  filter: none;
  transform: none;
  opacity: 1;
  background: var(--avatar-fallback);
}
.hero-scrim {
  position: absolute;
  inset: 0;
  /* theme-exception: fixed darkening gradient layered over person cover photo, provides cross-theme consistent
     readable contrast for locked light foreground text/icons below —— complete explanation of rationale and why
     brief's suggested var(--bg) blend formula not adopted, see file header comments, not repeated here. */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.5) 45%, rgba(0, 0, 0, 0.68) 100%);
}

.hero-back {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  padding: 6px 12px 6px 8px;
  border-radius: 999px;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  border: 1px solid var(--card-border);
  cursor: pointer;
  color: #fff; /* theme-exception: chrome button at hero top, always layered over darkened cover photo, needs
    cross-theme consistent light foreground (see file header "color critical path" explanation) */
}
/* theme-exception: hover state adds white to --overlay-bg for brightening, amount is fixed visual tuning value,
   independent of theme (same logic as .hero-back itself locking light foreground, see above declaration) */
.hero-back:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }

.hero-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px 32px;
  min-height: 280px;
}

.hero-avatar {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  flex: none;
  border: 3px solid var(--panel-bg);
  box-shadow: var(--icon-shadow), 0 0 0 1px var(--card-border);
  position: relative;
}

.hero-info { flex: 1; min-width: 0; }
.hero-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.hero-name {
  font-family: var(--font);
  font-size: 38px;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: #fff; /* theme-exception: name directly layered on darkened cover photo, needs cross-theme consistent
    light color (see file header "color critical path" explanation, don't use --fg —— light theme --fg is near black,
    layering on dark photo creates dark-on-dark) */
}

.hero-fav {
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--overlay-bg);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  /* Unfavorited state: semi-transparent light outline star, similarly locked independent of theme (see file header
     "color critical path" explanation). Favorited state in .hero-fav.is-fav rule below, reuses established --star-fg
     fallback convention in this repo. */
  color: rgba(255, 255, 255, 0.72); /* theme-exception */
}
.hero-fav.is-fav {
  /* --star-fg not separately defined in both themes, established precedent in this repo (PhotosGrid.vue/
     PersonAvatar.vue both use var(--star-fg, #ffd60a)) —— fixed golden star unchanged across skins,
     expressed as var(fallback) form, color-guard clears by token usage, not bare literal. */
  color: var(--star-fg, #ffd60a);
}
/* theme-exception: same as .hero-back:hover —— fixed white mix amount, independent of theme */
.hero-fav:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }

.hero-menu-wrap { position: relative; display: inline-flex; align-items: center; }
.hero-trigger {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  cursor: pointer;
  font-family: var(--font);
  color: #fff; /* theme-exception: same as .hero-back —— chrome button layered on darkened cover photo */
}
/* theme-exception: same as .hero-back:hover —— fixed white mix amount, independent of theme */
.hero-trigger:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }

/* Dropdown menu body has its own opaque background (--popup-bg), no longer layered on photo ——
   menu text/highlight follow normal theme tokens, not locked (intentionally different from hero direct foreground
   handling above, rationale in file header "color critical path" explanation). */
.hero-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 170px;
  z-index: 20;
  padding: 6px;
  border-radius: 10px;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hero-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  font-size: 12.5px;
  color: var(--fg);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.hero-menu-item:hover { background: var(--hover); }
.hero-menu-item[data-active="true"] {
  /* Vue2 :60 uses var(--accent-hi) —— this token not defined in both theme blocks in this repo (confirmed by grep,
     same as existing MergeReviewDialog.vue:249 precedent), borrowing --accent-text with same tone, defined in both themes. */
  background: var(--accent-soft);
  color: var(--accent-text);
}
.hero-menu-danger { color: var(--remove-fg); }
.hero-menu-danger:hover { background: color-mix(in srgb, var(--remove-fg) 12%, transparent); }

.hero-stats { display: flex; gap: 28px; margin-top: 14px; }
.hero-stat .v {
  font-family: var(--font);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: #fff; /* theme-exception: stat numbers layered on darkened cover photo, see file header "color critical path" explanation */
}
.hero-stat .k {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.72); /* theme-exception: stat labels same as above, locked semi-transparent light */
}
.hero-stat-month {
  font-size: 12px;
  margin-left: 4px;
  font-family: var(--font);
  color: rgba(255, 255, 255, 0.72); /* theme-exception: same as .hero-stat .k */
}

.hero-actions {
  flex: none;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hero-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  border: 1px solid var(--card-border);
  padding: 9px 14px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font);
  color: #fff; /* theme-exception: action button layered on darkened cover photo, see file header "color critical path" explanation */
}
/* theme-exception: same as .hero-back:hover —— fixed white mix amount, independent of theme */
.hero-action-btn:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }
</style>
