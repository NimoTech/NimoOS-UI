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

/* Task 5 (Plan D) shadowing cleanup: `.person-month`/`.person-month-head` (+`.title`/`.sub`)
   duplicated parity's own rules under the same selectors and have been deleted — parity now
   governs directly. */
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

/* Task 5 (Plan D) shadowing cleanup: `.person-grid` (8-column grid) duplicated parity's own
   rule and has been deleted. `.tile img`/`[data-selected] { outline }`/`[data-selected] img
   { opacity }` are likewise now transcribed into parity's `.person-grid .tile` family
   (geometry was already Vue2-accurate here; only the color tokens moved — see
   task-5-report.md). Base positioning (`position/overflow`) also moved to parity; what's left
   here is New-UI-only: a placeholder background while the thumbnail loads (no Vue2 value to
   transcribe) and `cursor: pointer`, which parity doesn't set for `.tile` either. */
.tile { background: var(--chip-bg); cursor: pointer; }
/* New-UI addition, no Vue2 source: Vue2's build has a global image reset this app doesn't
   (its own `.tile img` rule is likewise absent from both Vue2's scoped block and parity —
   confirmed by grep), so this app's raw `<img>` needs its own cover-fit sizing rule or it
   would render at native image size instead of filling the tile. */
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }

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

/* Task 5 (Plan D) shadowing cleanup: the full `.tile-check`/`.tile-detach` geometry, opacity,
   transitions and hover states duplicated parity's newly-added `.person-grid .tile .tile-check`
   / `.tile-detach` family (transcribed from Vue2's own PhotosPersonDetail.vue:1263-1331) and
   have been deleted — parity now governs directly, including the background/border colors
   (Vue2's own literal fixed overlay colors, not this app's theme tokens; see
   task-5-report.md's deviations table for the token → literal-color changes this produced).
   `.tile-check-icon` survives: Vue2 sets this icon's color via an inline `color="white"` prop
   on its icon component (PhotosPersonDetail.vue:150), not a CSS rule — there is nothing for
   parity to hold, and this app's SVG needs a CSS-driven color since it isn't prop-driven. */
.tile-check-icon { color: var(--on-accent); }
</style>
