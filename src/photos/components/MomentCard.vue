<script setup lang="ts">
// MomentCard.vue — the mosaic card for the Moments band.
// Ported piece-by-piece from the Vue 2 panel's 899af59b:src/views/Photos/PhotosSmartViewsView.vue:367-433
// inline component MomentCard; styles ported from photos-smartview.scss:186-268.
// The collage/meta structure is deliberately aligned with SmartViewCard.vue (same three-row
// meta layout), so it reuses the .sv-card/.sv-collage/.sv-meta class names and only layers
// .mo-* overrides on top — the same technique Vue2 used.
//
// Deliberate deviations from Vue2:
//  1) emit('open', id) passes only the id string, not the whole moment object (following the
//     existing precedent at SmartViewCard.vue:32) — the detail page fetches fresh from the
//     store by id, eliminating stale references.
//  2) Out-of-range featured slots render nothing: the Vue2 template hard-indexes
//     featuredAssetIds[0] and [1] in the T1/T2/T4 branches; with only 1 entry, the second
//     <img>'s src is undefined and the browser fires a spurious request resolved against
//     the current page. Here each slot is checked for existence and missing slots are
//     skipped. (Visual parity is unaffected — reaching this branch already means
//     pickMomentTemplate judged n>=2, so this is purely defensive.)
//  3) The asset count's thousands separator follows the i18n locale (`toLocaleString(localeTag)`),
//     not Vue2's bare `toLocaleString()` (which follows the browser's locale, unpredictable).
//  4) Amber badge: Vue2 used a literal `linear-gradient(135deg,#FF9F0A,#FF6B5C)` and
//     `rgba(255,159,10,0.15)/#FF9F0A`. This repo forbids bare color literals. `.mo-badge`
//     reuses --warn-fg (theme.css:155/:510) for its flat fill -- kept as-is, cosmetic-only
//     gradient-to-flat deviation, unaffected by the item-6 fix below since its text is a
//     literal white on a solid fill, always legible regardless of theme. `.mo-span-mini`
//     (below, near .sv-stats) originally reused the --warn-bg/--warn-fg *pair* the same way,
//     but that one is a translucent tint sitting directly on the page background, not a solid
//     fill -- neither token is shadowed on
//     `.photos-root`, so under photos light mode (data-theme still dark) it kept the dark
//     pairing: a faint wash under bright orange text on the parity light surface, low-contrast.
//     Switched to `--warning` (declared directly on `.photos-root`, deliberately invariant by
//     spec) + `color-mix` reproducing Vue2's own 0.15 alpha exactly -- see that rule's own
//     comment for the full trace.
//  5) .mo-card .sv-name's two-line clamp is copied as-is (scss:254-259).
//  6) [flagged during review, deliberately not acted on] The badge star is
//     fill-only. Vue 2 renders it through <photos-icon name="star">, which both fills *and*
//     strokes the same path (PhotosIcon.vue:193 `fillOverride` returns the colour for 'star'
//     while `strokeOverride` returns it too, at stroke-width 1.6 with round caps and joins).
//     The path data is identical; only the 1.6px outline is absent. At the 9px this badge
//     renders at, that outline is sub-pixel, so it stays as-is — logged because this branch
//     registers every deviation, not because it is worth changing.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Moment } from '../stores/moments'
import type { MomentSize, MomentTemplate } from '../util/momentLayout'

const props = defineProps<{ moment: Moment; size: MomentSize; template: MomentTemplate }>()
const emit = defineEmits<{ (e: 'open', id: string): void }>()

const { t, locale } = useI18n()
// BCP-47 conversion (this repo's established pattern, see SmartViewCard.vue:38).
const localeTag = computed(() => locale.value.replace('_', '-'))

// Data source for the three/two/one-slot collage, each slot checked for existence
// (deviation 2 above). Relies on an invariant this component does not itself enforce:
// pickMomentTemplate (src/photos/util/momentLayout.ts) only ever hands out T1/T2/T4 when
// featuredAssetIds has >= 2 entries, and T3 when it has >= 1 — so f[0]/f[1] below are never
// read out of an empty array in practice, even though .filter(Boolean) would silently
// tolerate it if that invariant ever broke.
const collageIds = computed<string[]>(() => {
  const cover = props.moment.coverAssetId
  const f = props.moment.featuredAssetIds
  if (props.template === 'single') return [cover].filter(Boolean)
  if (props.template === 'T3') return [cover, f[0]].filter(Boolean)
  return [cover, f[0], f[1]].filter(Boolean)
})

const typeLabel = computed(() => {
  const key = props.moment.recipeKey || ''
  if (key.startsWith('trip')) return t('photosMoTypeTrip')
  if (key.includes('pets')) return t('photosMoTypePets')
  if (key.includes('family')) return t('photosMoTypeFamily')
  return t('photosMoTypeTheme')
})

function thumbUrl(id: string): string {
  return service.photos.thumbnailUrl(id, 'large')
}
</script>

<template>
  <div
    class="sv-card mo-card"
    :class="{ 'mo-card-wide': size === 'wide', 'mo-card-tall': size === 'tall' }"
    :data-id="moment.id"
    @click="emit('open', moment.id)"
  >
    <div
      class="sv-collage mo-collage"
      :class="{
        'mo-collage-single': template === 'single',
        'mo-tpl-t2': template === 'T2',
        'mo-tpl-t3': template === 'T3',
        'mo-tpl-t4': template === 'T4',
      }"
    >
      <img
        v-for="(id, i) in collageIds" :key="id"
        :class="{ 'sv-collage-main': i === 0 }" :src="thumbUrl(id)" alt=""
      >
      <div class="sv-collage-overlay" />
      <div class="sv-collage-badge mo-badge">
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="currentColor"
        ><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" /></svg>
        {{ t('photosMoBadge') }}
      </div>
    </div>
    <div class="sv-meta">
      <h3 class="sv-name">
        {{ moment.title }}
      </h3>
      <div class="sv-conds">
        <span class="sv-cond">{{ typeLabel }}</span>
        <span v-if="moment.place" class="sv-cond">{{ moment.place }}</span>
      </div>
      <div class="sv-stats">
        <b>{{ moment.assetCount.toLocaleString(localeTag) }}</b> {{ t('photosSvPhotosCount') }}
        <span v-if="moment.addedThisWeek > 0" class="mo-week-badge">{{ t('photosMoAddedThisWeek', { n: moment.addedThisWeek }) }}</span>
        <span style="flex:1" />
        <span v-if="moment.subtitle" class="mo-span-mini">{{ moment.subtitle }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card shell / collage / meta blocks share the same spec as SmartViewCard.vue (Vue2 reused
   the .sv-card class; this repo's scoped styles don't inherit across components, so the
   handful of rules needed here are restated rather than promoting SmartViewCard's styles
   to global). */
.sv-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--surface-1);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.sv-card:hover { transform: translateY(-2px); box-shadow: var(--card-shadow-hi); }

.sv-collage {
  position: relative;
  display: grid;
  gap: 2px;
  background: var(--bg);
}
/* Collage gap fix (per scss:198-218): an explicit 1fr track's auto minimum size gets
   stretched open by a portrait image's intrinsic height, and the tallest card in a row
   drags the shorter ones down with blank space below them. Tracks are pinned to
   minmax(0, 1fr) and img minimum size is zeroed out. The mosaic card's collage height is
   driven by .mo-grid's fixed row-height unit, not a fixed 16:9 ratio. */
.mo-collage {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
.mo-collage img { width: 100%; height: 100%; object-fit: cover; display: block; min-width: 0; min-height: 0; }
.sv-collage-main { grid-row: 1 / span 2; }

/* T2: big top, two-across bottom (tall-card exclusive) — cover takes the top two shares,
   the two featured images sit side by side on the bottom share. */
.mo-tpl-t2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 2fr) minmax(0, 1fr); }
.mo-tpl-t2 .sv-collage-main { grid-column: 1 / span 2; grid-row: 1; }

/* T3: side-by-side halves (the n == 1 fallback) — a single row, overriding
   .sv-collage-main's default two-row span. */
.mo-tpl-t3 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.mo-tpl-t3 .sv-collage-main { grid-row: 1; }

/* T4: three across (wide-card exclusive) — same structure as T1, just narrower column ratio
   (2fr:1fr tightened to 11fr:9fr). */
.mo-tpl-t4 { grid-template-columns: minmax(0, 11fr) minmax(0, 9fr); }

/* single: one image, absolutely positioned to fill. */
.mo-collage-single { display: block; }
.mo-collage-single img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

.sv-collage-overlay {
  position: absolute; bottom: 0; left: 0; right: 0; height: 70%; pointer-events: none;
  /* theme-exception: bottom gradient scrim over the collage, giving the badge sitting on
     top of the photo a constant cross-theme contrast (same precedent as
     SmartViewCard.vue .sv-collage-overlay). */
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
}
.sv-collage-badge {
  position: absolute; top: 10px; left: 10px;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px 3px 6px;
  border-radius: var(--chip-radius, 999px);
  backdrop-filter: var(--blur);
  font-size: 10.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em;
}
/* Vue2 used an amber-to-coral gradient literal here (see the file header); this repo has
   no second amber token, so it collapses to a flat --warn-fg (cosmetic-only deviation). */
.mo-badge {
  background: var(--warn-fg);
  /* theme-exception: badge text sits on top of the photo collage and needs a constant
     cross-theme light foreground, --on-accent is unsuitable here (same precedent and
     rationale as SmartViewCard.vue .sv-collage-badge). */
  color: #fff;
}

.sv-meta {
  padding: 14px 16px 16px;
  /* Prerequisite for a flex child to truncate: the parent's flex-direction:column gives
     this a default min-width:auto. */
  min-width: 0;
}
.sv-name {
  font-size: 15px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em;
  /* Long titles clamp to two lines max (scss:254-259). */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sv-conds { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
/* Fix-2 item 4/6 (owner acceptance, 2026-08-13): background corrected from `--chip-bg`
   (global, non-`.photos-root`-shadowed, glass-gradient in dark mode) to parity's own
   `--surface-3` -- Vue2's real base `.sv-cond` background (photos-smartview.scss:91-97), one
   rung lighter than what was here before (`--chip-bg`/--surface-2, not `--chip-bg-hi`/
   --surface-3) -- a plain value drift, not just a theming one. Same fix applied to
   PhotosAlbumDetail.vue's and AlbumConvertToSmartDialog.vue's own copies of this chip. */
.sv-cond { padding: 2px 8px; border-radius: var(--chip-radius, 999px); background: var(--surface-3); color: var(--text-2); font-size: 11px; }
.sv-stats { display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: var(--text-4); font-variant-numeric: tabular-nums; }
.sv-stats b { color: var(--text-1); font-weight: 600; }
.mo-week-badge { color: var(--success); }
/* Fix-2 item 6 (owner acceptance, 2026-08-13): was `background: var(--warn-bg); color:
   var(--warn-fg)` -- both *global*, non-`.photos-root`-shadowed tokens, so in photos light
   mode (data-theme still dark) this stayed the dark pairing: a very faint 8%-alpha orange wash
   sitting directly on the parity light surface underneath, with the same bright orange text on
   top as always -- low-contrast orange-on-near-white, the same root cause class as the rest of
   this sweep. `--warning` is different: it is declared directly on `.photos-root` itself
   (vue2-parity/photos.scss's token block) at the exact same orange Vue2 itself uses literally,
   and is deliberately left un-overridden by `.photos-root.is-light` (functional colors are
   invariant by spec) -- i.e. it is *already* the correct, parity-scoped, theme-invariant token
   this pill wants, not a leftover. Vue2's own literal fill is a 15%-alpha version of that same
   orange (photos-smartview.scss:250-258's `.mo-span-mini` / :264-268's `.mo-type-pill`, both the
   exact source this pill ports) -- `color-mix` reproduces that alpha ratio precisely (a real
   value fix too: `--warn-bg`'s own 8% was already a drift from Vue2's 15%, not just a theming
   one). */
.mo-span-mini {
  display: inline-flex; align-items: center;
  padding: 2px 7px; border-radius: var(--chip-radius, 999px);
  background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning);
  font-weight: 600; white-space: nowrap;
}
</style>
