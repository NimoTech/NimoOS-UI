<script setup lang="ts">
// Task 11 (SP7-P5 people): PersonAssetGrid.vue — person detail page monthly asset grid
// (multi-select / detach / expand all per month). Ported section-by-section from Vue2
// NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:132-154 (grid template), :760-763
// (assetThumb, size=large), :868-883 (selection logic); styles from photos-people.scss:474-500
// (.person-month / .person-grid, 8 columns + 3px radius).
//
// Why not reuse PhotosGrid (see task-11-brief.md accounting, three hard reasons): ① each tile
// has extra "not this person" detach button (PhotosGrid doesn't expose slots); ② fixed 8
// columns + default 16 photos per month only, conflicts with PhotosGrid's responsive
// auto-fill minmax(140px,1fr) + density three-state contract; ③ thumbnail uses size=large
// not small. Trade-off: person page has no video hover preview (Vue2 detail also lacks it).
//
// Task positioning: pure display + emit — don't touch store, don't fetch, don't toast
// (all in T14 container). Whole-tile click branching pulled back into component (coordinator
// decision, original submission tried pushing to T14 container, corrected): byte-for-byte
// match Vue2 onTileClick (:874-880) — when selectionMode true emit('toggle-select', p.id),
// else emit('open', p), branch within single entry point. Reasons: ① component already has
// selectionMode prop, has all decision info needed — if only used for detach button
// visibility, prop is misnamed; ② 1:1 verifiable behavior with Vue2, "click tile in select
// mode → only toggle-select, not open" can be pinned in component test, no need to wait for
// container wiring to find missing branch; ③ pushing to container means container must
// "receive open but ignore in select mode", one more implicit contract, exactly the kind of
// hazard we're eliminating this period.
//
// Only intentional deviation (plan item 8, brief explicit requirement): Vue2 :138 renders only
// m.photos.slice(0,16) per month but month header shows real total, extra photos permanently
// invisible in grid (only accessible via lightbox pagination). Here still renders 16 by default
// (visual 1:1 unchanged), but when photos.length > 16 adds "show all {n} / collapse" text
// button to month header right side, complete affordance — not redesign.
//
// Iron rule: selection check uses selected.some(x => String(x) === String(p.id)), never
// includes (backend asset id could be number, parent might pass string, types could differ).
//
// Color red line: elements layered over photos on tiles (.tile-vid duration badge, .tile-detach
// detach button, unselected .tile-check checkbox) use var(--overlay-bg) background (layered
// over uncontrolled photo pixels, theme token itself is two semi-transparent values black/
// dark brown, not naked literals), foreground pinned light + theme-exception annotation
// (established precedent in PersonHero.vue, rationale in that file's "color red line" note,
// not repeated here). Exception: selected state .tile-check background switches to saturated
// var(--accent) solid (no longer layered on photo, component-controlled pure color), exactly
// the prerequisite scenario for legal --on-accent use (see task color red line: --on-accent
// only legal on var(--accent) saturated solid), intentionally distinct from unselected state.
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Month, Photo } from '../util/assetToPhoto'

const props = defineProps<{
  months: Month[]
  selected: Array<string | number>
  selectionMode: boolean
}>()

const emit = defineEmits<{
  (e: 'open', photo: Photo): void
  (e: 'toggle-select', id: string | number): void
  (e: 'detach', ids: Array<string | number>): void
}>()

const { t } = useI18n()

// Monthly expanded state, key is Month.key. All collapsed by default (render first 16 only).
const expanded = reactive<Record<string, boolean>>({})

function toggleExpand(key: string): void {
  expanded[key] = !expanded[key]
}

function visiblePhotos(m: Month): Photo[] {
  return expanded[m.key] ? m.photos : m.photos.slice(0, 16)
}

// Iron rule: never use includes — id types could differ on both sides (number vs string).
function isSelected(id: string | number): boolean {
  return props.selected.some((x) => String(x) === String(id))
}

// Whole-tile click (Vue2 :874-880 onTileClick byte-for-byte match, see file header comment).
function onTileClick(p: Photo): void {
  if (props.selectionMode) emit('toggle-select', p.id)
  else emit('open', p)
}

function thumbnailSrc(id: string | number): string {
  return service.photos.thumbnailUrl(id, 'large')
}
</script>

<template>
  <div class="person-asset-grid">
    <div v-if="months.length === 0" class="empty-state" data-test="empty-state">
      {{ t('photosPersonNoPhotos') }}
    </div>

    <template v-else>
      <div v-for="m in months" :key="m.key" class="person-month">
        <div class="person-month-head">
          <span class="title">{{ m.title }}</span>
          <span class="sub">
            {{ t('photosPeoplePhotosCount', { n: m.photos.length }) }}
            <template v-if="m.photos[0] && m.photos[0].place"> · {{ m.photos[0].place }}</template>
          </span>
          <button
            v-if="m.photos.length > 16"
            type="button"
            class="show-all-btn"
            data-test="show-all-toggle"
            @click="toggleExpand(m.key)"
          >{{ expanded[m.key] ? t('photosPersonShowLess') : t('photosPersonShowAll', { n: m.photos.length }) }}</button>
        </div>

        <div class="person-grid">
          <div
            v-for="p in visiblePhotos(m)"
            :key="p.id"
            class="tile"
            :data-selected="isSelected(p.id)"
            :data-selection-mode="selectionMode"
            @click="onTileClick(p)"
          >
            <img :src="thumbnailSrc(p.id)" alt="" />

            <div v-if="p.isVideo" class="tile-vid">
              <span class="vid-play">▶</span> {{ p.duration }}
            </div>

            <button
              type="button"
              class="tile-check"
              :title="isSelected(p.id) ? t('photosPersonDeselect') : t('photosPersonSelect')"
              @click.stop="emit('toggle-select', p.id)"
            >
              <svg
                v-if="isSelected(p.id)"
                class="tile-check-icon"
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><path d="M5 13l4 4L19 7" /></svg>
            </button>

            <button
              v-if="!selectionMode"
              type="button"
              class="tile-detach"
              :title="t('photosPersonNotThePerson')"
              @click.stop="emit('detach', [p.id])"
            >
              <!-- X shape occupies only half the viewport, nominal size needs larger to see
                   clearly (same as Vue2 :150 comment). 15px is Vue2's **effective value**: template
                   :size="20" overridden by styles :1179-1183 `.tile-detach svg { width:15px;
                   height:15px }` (final review Minor 3 verified in source). -->
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--fg-muted);
  font-size: 13px;
}

.person-month { margin-bottom: 28px; }
.person-month-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 0 10px;
}
.person-month-head .title {
  font-family: var(--font);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg);
}
.person-month-head .sub {
  color: var(--fg-muted);
  font-size: 12px;
}
.show-all-btn {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
}
.show-all-btn:hover { text-decoration: underline; }

/* Follow photos-people.scss:492-500 — fixed 8 columns + 3px radius, intentionally differs
   from PhotosGrid's responsive auto-fill/density contract (brief accounting reason ②). */
.person-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 3px;
}

.tile {
  position: relative;
  aspect-ratio: 1;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  background: var(--chip-bg);
}
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }
/* Final review Minor 3: Vue2 :1222 — selected tile darkens the image one stop. Original only
   has accent outline, selected/unselected contrast too weak in thumbnail screen. */
.tile[data-selected="true"] img { opacity: 0.85; }

.tile-vid {
  position: absolute; right: 4px; bottom: 4px; z-index: 2;
  display: flex; align-items: center; gap: 3px;
  padding: 1px 5px; border-radius: 999px; font-size: 9px;
  background: var(--overlay-bg);
  /* theme-exception: duration badge layered on thumbnail, needs light foreground constant
     across themes (established precedent in PhotosGrid.vue .tile-vid / PersonHero.vue series,
     rationale in PersonHero.vue file head "color red line" note, not repeated here). */
  color: #fff;
}
.vid-play { font-size: 7px; }

/* Final review Minor 3 (geometry line-by-line verified against Vue2 :1184-1215): 20×20 /
   offset 6px / **2px** stroke / checkmark 12px — original is 18×18 / 4px / 1px / 10px, whole
   thing one size too small and stroke too thin, in 8-column small tiles almost indistinguishable
   from detach button by volume. Stroke changed from var(--card-border) back to pinned semi-
   transparent light: this circle layered on uncontrolled face photos, theme-varying stroke
   becomes light-on-light in light theme, disappears (same "color red line" handling as other
   foreground elements, see file head). */
.tile-check {
  position: absolute; top: 6px; left: 6px; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; padding: 0;
  /* theme-exception: checkbox circle stroke layered on photo, needs light constant across
     themes (per Vue2 :1195) */
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  background: var(--overlay-bg);
  cursor: pointer;
  /* Per Vue2 PhotosPersonDetail.vue:1199-1208 — default transparent, visible only on
     hover/selected, not permanently layered on each thumbnail (established precedent in this
     repo PhotosGrid.vue:374-376 .tile-check-box). Vue2 source only hides via opacity, no
     :focus-visible override, keyboard tab can still focus the hidden button — this is a Vue2
     built-in accessibility gap, copying as-is and logging, outside this task scope to fix
     (unreported scope additions). */
  opacity: 0;
  transform: scale(0.85);
  /* background/border-color also transition — following :hover and selected states both change
     these two (per Vue2 :1202) */
  transition: opacity 0.15s, transform 0.15s, background 0.15s, border-color 0.15s;
}
.tile:hover .tile-check,
.tile[data-selection-mode="true"] .tile-check,
.tile[data-selected="true"] .tile-check {
  opacity: 1;
  transform: scale(1);
}
/* Final review Minor 3: Vue2 :1209-1212 **button's own hover darkens**. Original only fades
   button in on whole-tile hover, no feedback when pointer on button itself — doesn't read as
   clickable control. */
.tile-check:hover {
  /* theme-exception: blend one stop darker black into semi-transparent layered background,
     blend amount is fixed visual calibration, theme-independent (established precedent in
     PersonHero.vue .hero-back:hover blending white brighter, opposite direction) */
  background: color-mix(in srgb, var(--overlay-bg) 65%, #000 35%);
  /* theme-exception: hover stroke brighten to fully opaque white (per Vue2 :1211) */
  border-color: #fff;
}
.tile[data-selected="true"] .tile-check {
  /* Selected state background switches to saturated --accent solid (no longer layered on
     photo, component-controlled pure color) — exactly the prerequisite scenario for legal
     --on-accent use (task color red line: --on-accent only legal on var(--accent) saturated
     solid), intentionally distinct from unselected state (semi-transparent layered on photo,
     must pin light foreground), not accidental. */
  background: var(--accent);
  border-color: var(--accent);
}
.tile-check-icon { color: var(--on-accent); }

/* Final review Minor 3 (geometry line-by-line verified against Vue2 :1148-1181): 22×22 /
   offset 6px / 1px semi-transparent light stroke / backdrop-filter — original is 18×18 / 4px
   / no stroke / no blur. */
.tile-detach {
  position: absolute; top: 6px; right: 6px; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; padding: 0;
  /* theme-exception: detach button stroke layered on photo, needs semi-transparent light
     constant across themes (per Vue2 :1156, established precedent in PersonAvatar.vue
     .person-avatar-fav) */
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: var(--overlay-bg);
  /* Per Vue2 :1165 — blur layer on top of semi-transparent background, keep photo high-
     frequency detail from showing through button */
  backdrop-filter: var(--blur);
  cursor: pointer;
  /* Per Vue2 PhotosPersonDetail.vue:1162-1171 — default transparent, visible only on
     .tile:hover; unlike .tile-check not forced visible by selectionMode/selected (Vue2 source
     only adds those two forced-visible rules to tile-check, not tile-detach — copying as-is,
     not omission). */
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.15s, transform 0.15s, background 0.15s, color 0.15s, border-color 0.15s;
  /* theme-exception: same as .tile-vid — detach button layered on photo, light foreground
     constant. opacity 0.85 per Vue2 :1157 (not full white): default state intentionally one
     stop weaker than hover. */
  color: rgba(255, 255, 255, 0.85);
}
.tile:hover .tile-detach {
  opacity: 1;
  transform: scale(1);
}
/* Final review Minor 3: Vue2 :1172-1177 **button's own hover changes to danger color**. This is
   component's only destructive action (detach photo from this person), without it it's only
   position-different from adjacent checkbox — final review comment: layered together makes
   this "×" not read as delete key. --remove-bg is this repo's existing solid danger red
   (defined in both themes, theme.css:165/254; same usage as theme.css:392 `.grid-item .remove`). */
.tile-detach:hover {
  background: var(--remove-bg);
  border-color: transparent;
  /* theme-exception: white icon on danger red solid background, follows existing convention
     in theme.css:392, not using --on-accent (only legal on var(--accent) saturated solid, here
     background is not accent). */
  color: #fff;
}
</style>
