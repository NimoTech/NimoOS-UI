<script setup lang="ts">
// SP7-P7a-T8: SmartViewActivityFeed.vue — activity feed, 4th section in smart view detail page right column.
// Based on the Vue 2 panel's src/views/Photos/PhotosSmartViewDetail.vue:211-229 (template),
// :270-280 (activityText), :318-324 (activity computed, `seeds: a.assetIds`), ported;
// styles from photos-smartview.scss:606-625 (+ placeholder thumbnail inline style from :211-221, converted to class).
//
// — Unknown eventType (last row of structural spec table, same handling as P6b insight unknown key,
//    entry) ──────────────────────────────────────────────────────────────────────
// Vue2 activityText()'s default branch (:278) renders the backend's raw eventType string directly
// to users. New-UI changes to: skip the line entirely + console.warn once, don't let internal enum values leak to the UI.
//
// — Zero v-html (§7e-6) ────────────────────────────────────────────────────────
// fix round 1 · I3 (Important, controller verified against zh_CN.json and corrected): matched (1 photo)/
// matched (N photos) — the `<b>` in both texts wraps the entire phrase "interpolation + language-specific static word" —
// `<b>1 new photo</b>` and `<b>{n} new photos</b>` are completely symmetric in form, not 'one wraps the whole phrase, one only
// wraps the digit'. Round 1 simplified the N photos version to only bold `{n}` itself, causing adjacent rows in the activity feed to have one line with the whole phrase bold,
// and one with only the digit bold — not 'slightly different from Vue2', but self-contradictory. Solution: split both into 'main sentence key + bold
// phrase key' symmetrically — `photosSvActOneMatchedBold` (already exists) and newly added
// `photosSvActNMatchedBold` (value `'{n} new photos'`, self-contained interpolation; Chinese equivalent in zh_CN.json, rendered via
// `t('photosSvActNMatchedBold', { n })` then wrapped in `<b>`), both keys have identical form, zero v-html.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { relTime } from '../util/relTime'
import type { SmartViewActivity } from '../stores/smartViews'

const props = defineProps<{ activity: SmartViewActivity[]; now?: number }>()

const { t, locale } = useI18n()

type Kind = 'created' | 'updated' | 'matchedOne' | 'matchedN' | 'exported' | 'renamed' | 'convertedFromAlbumN' | 'convertedFromAlbum'
interface Row { a: SmartViewActivity; kind: Kind; n: number }

// Unknown eventType is filtered out here (doesn't enter rows), so the template doesn't need any 'default/fallback' branch —
// this is the implementation location of 'skip that row' handling itself.
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const a of props.activity) {
    switch (a.eventType) {
      case 'created':
        out.push({ a, kind: 'created', n: 0 })
        break
      case 'updated':
        out.push({ a, kind: 'updated', n: 0 })
        break
      case 'matched': {
        // Copied from Vue2 :271: `(a.assetIds && a.assetIds.length) || 0`.
        const n = (a.assetIds && a.assetIds.length) || 0
        out.push({ a, kind: n === 1 ? 'matchedOne' : 'matchedN', n })
        break
      }
      case 'exported':
        out.push({ a, kind: 'exported', n: 0 })
        break
      case 'renamed':
        out.push({ a, kind: 'renamed', n: 0 })
        break
      // SP15-P2b Task 8: the backend records this when ConvertFromAlbum finishes; assetIds
      // is the original album's full membership, so the count is real when present. Absent
      // is defensive only -- keep the count-free wording rather than printing "0 photos
      // locked in".
      case 'converted_from_album': {
        const n = (a.assetIds && a.assetIds.length) || 0
        out.push({ a, kind: n > 0 ? 'convertedFromAlbumN' : 'convertedFromAlbum', n })
        break
      }
      default:
        console.warn('[photos-smartviews] unknown activity eventType', a.eventType)
    }
  }
  return out
})

function thumbSrc(id: string): string {
  return service.photos.thumbnailUrl(id, 'large')
}
function timeOf(a: SmartViewActivity): string {
  return relTime(a.occurredAt, props.now ?? Date.now(), t, locale.value)
}
</script>

<template>
  <div class="sv-side-section">
    <h3>{{ t('photosSvActivity') }}</h3>
    <div class="sv-activity" data-test="sv-activity-feed">
      <div v-for="row in rows" :key="row.a.id" class="sv-activity-row" data-test="sv-activity-row">
        <div class="sv-activity-thumbs">
          <template v-if="row.a.assetIds.length > 0">
            <img v-for="s in row.a.assetIds.slice(0, 3)" :key="s" :src="thumbSrc(s)" alt="">
          </template>
          <div v-else class="sv-activity-placeholder" data-test="sv-activity-placeholder">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          </div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="sv-activity-text" data-test="sv-activity-text">
            <template v-if="row.kind === 'created'">{{ t('photosSvSmartViewCreated') }}</template>
            <template v-else-if="row.kind === 'updated'">{{ t('photosSvConditionsSettingsUpdated') }}</template>
            <i18n-t v-else-if="row.kind === 'matchedOne'" keypath="photosSvActOneMatched" tag="span" scope="global">
              <template #photo><b>{{ t('photosSvActOneMatchedBold') }}</b></template>
            </i18n-t>
            <i18n-t v-else-if="row.kind === 'matchedN'" keypath="photosSvActNMatched" tag="span" scope="global">
              <template #photo><b>{{ t('photosSvActNMatchedBold', { n: row.n }) }}</b></template>
            </i18n-t>
            <template v-else-if="row.kind === 'exported'">{{ t('photosSvExportedDetail', { detail: row.a.detail || t('photosSvExportFile') }) }}</template>
            <template v-else-if="row.kind === 'renamed'">{{ t('photosSvSmartViewRenamed') }}</template>
            <template v-else-if="row.kind === 'convertedFromAlbumN'">{{ t('photosSvActConvertedFromAlbumN', { n: row.n }) }}</template>
            <template v-else-if="row.kind === 'convertedFromAlbum'">{{ t('photosSvActConvertedFromAlbum') }}</template>
          </div>
          <div class="sv-activity-time">{{ timeOf(row.a) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Section title same as SmartViewSidePanel.vue's .sv-side-section h3 (scss:528-536) — each of the two components is
   scoped, can't share styles across components, so we write an equivalent definition here (same as existing precedent in this area: PlaceInsights.vue
   and PlaceDetailPanel.vue each have their own .detail-section h4). */
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-3); margin: 0 0 10px;
}

/* — Activity feed (scss:606-625) — */
.sv-activity { display: flex; flex-direction: column; gap: 10px; }
.sv-activity-row { display: flex; gap: 8px; font-size: 11.5px; align-items: flex-start; }
.sv-activity-thumbs { display: flex; gap: 2px; flex-shrink: 0; }
.sv-activity-thumbs img { width: 26px; height: 26px; border-radius: 4px; object-fit: cover; }
/* Vue2 :219-221 inline style (width/height/border-radius/background/display/
   align-items/justify-content) migrated line-by-line by attribute; icon color --accent-hi → --accent-text
   (same as file header token mapping). */
.sv-activity-placeholder {
  width: 26px; height: 26px; border-radius: 4px; background: var(--accent-soft);
  display: flex; align-items: center; justify-content: center; color: var(--accent-hi);
}
.sv-activity-text { flex: 1; color: var(--text-2); line-height: 1.4; }
.sv-activity-text b { color: var(--text-1); font-weight: 600; }
.sv-activity-time { color: var(--text-4); font-size: 10.5px; }
</style>
