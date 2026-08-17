<script setup lang="ts">
// P6b-T5: PlaceInsights.vue — insight cards for 'Nimo Noticed' in the place detail panel. Ported line-by-line from Vue2
// NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1174-1184 (template); styles from
// photos-places.scss:729-756 (skipping .insight-card .meta at :756-762 — the template
// never has a .meta element inside insight-card; it's dead CSS, not ported).
//
// spec §7c-4 hard requirement: zero v-html. The 'P5-T13 precedent' cited in task-5-brief.md is actually a counterexample —
// PersonRelationsTab.vue:19-29 ends up using 'escaped params + v-html', not <i18n-t>. This component
// follows the spec's **requirement** (zero v-html), not its **citation**; this is logged in plan's Self-Review
// in task-5-report.md. Four backend shapes (mostPhotographed/topSpot/companions/home)
// each have a different set of interpolations (some need to bold a param, some have no bold params), so we must hard-code one
// <i18n-t keypath scope="global"> per shape; there is no single template that works for all four shapes.
//
// Deviation entry 8 (T1 decided, util/placesInsight.ts insightKey()): backend keys are from the Vue2 era
// with dotted nested notation; New-UI uses flat camelCase keys; insightKey() returns null for unknown keys — so we let
// that card not render at all + console.warn once, unlike Vue2's pt() which leaks the internal key verbatim to users.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlaceInsight } from '../stores/places'
import { insightKey, joinCompanionNames } from '../util/placesInsight'

const props = defineProps<{ insights: PlaceInsight[] }>()
const { t } = useI18n()

interface RenderableInsight {
  ico: string
  k: string
  params: Record<string, unknown>
}

// Filter out cards with unknown keys (deviation entry 8). console.warn fires only once per unknown card here —
// computed caches by reference; if props.insights doesn't change, it won't warn repeatedly.
const renderable = computed<RenderableInsight[]>(() => {
  const out: RenderableInsight[] = []
  for (const ins of props.insights) {
    const k = insightKey(ins.key)
    if (k === null) {
      console.warn('[photos-places] unknown insight key, skipping card', ins.key)
      continue
    }
    out.push({ ico: ins.ico, k, params: ins.params })
  }
  return out
})

// Icon three-way branch (brief §A-3): ico exactly has three values: sparkles/person/home (backend contract,
// NimoOS-Photos/service/places.go:526-560); unknown values fall back to sparkles.
type IconName = 'sparkles' | 'person' | 'home'
function iconName(ico: string): IconName {
  return ico === 'person' || ico === 'home' ? ico : 'sparkles'
}
</script>

<template>
  <!-- Deviation from entry (brief §A-1 wrote v-if="insights.length > 0"; here we use
       renderable.length instead: if all passed insights have unknown keys, after filtering renderable is empty,
       the whole section is left with just a bare 'Nimo Noticed' title and no cards — worse than Vue2 (Vue2 at least
       leaks the internal key to users, so at least there is content), so we let the whole section disappear together.) -->
  <div v-if="renderable.length > 0" class="detail-section">
    <h4>
      {{ t('photosPlacesNimoNoticed') }}
    </h4>
    <div class="insights">
      <div v-for="(ins, idx) in renderable" :key="idx" class="insight-card">
        <span class="ico">
          <svg
            v-if="iconName(ins.ico) === 'sparkles'" data-test="insight-ico-sparkles"
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          <svg
            v-else-if="iconName(ins.ico) === 'person'" data-test="insight-ico-person"
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
          <svg
            v-else data-test="insight-ico-home"
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /></svg>
        </span>

        <!-- Each of four backend shapes has one <i18n-t> with named slots, zero v-html (spec §7c-4). keypath comes from
             T1's insightKey(), four fixed strings compared (not dynamically constructing keypath) to align with
             the already-filtered key set in renderable. -->
        <i18n-t v-if="ins.k === 'photosPlacesInsightTopSpot'" :keypath="ins.k" tag="span" scope="global">
          <template #spot>
            <b>{{ ins.params.spot }}</b>
          </template>
          <template #count>
            {{ ins.params.count }}
          </template>
        </i18n-t>
        <i18n-t v-else-if="ins.k === 'photosPlacesInsightCompanions'" :keypath="ins.k" tag="span" scope="global">
          <template #names>
            <b>{{ joinCompanionNames(ins.params.names) }}</b>
          </template>
        </i18n-t>
        <i18n-t v-else-if="ins.k === 'photosPlacesInsightHome'" :keypath="ins.k" tag="span" scope="global">
          <template #base>
            <b>{{ t('photosPlacesInsightHomeBase') }}</b>
          </template>
          <template #trips>
            {{ ins.params.trips }}
          </template>
          <template #count>
            {{ ins.params.count }}
          </template>
        </i18n-t>
        <!-- Remaining shape: photosPlacesInsightMostPhotographed, only has {count}, no bold params. -->
        <i18n-t v-else :keypath="ins.k" tag="span" scope="global">
          <template #count>
            {{ ins.params.count }}
          </template>
        </i18n-t>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Token mapping (Vue2 → New-UI, same as PlaceDetailPanel.vue file header §6 table): --text-1/2/3 →
   --fg/--fg-muted/--fg-subtle; --surface-2 → --chip-bg; --line → --card-border;
   --r-sm → --radius-sm. This is a standalone SFC; scoped styles don't cross component boundaries (Vue's
   scoped CSS only forwards the parent's scope attribute to the child component's root node, not to elements inside
   the child template — PlaceDetailPanel.vue's existing `.detail-section h4` rule can't reach the
   <h4> here), so this file needs its own equivalent title styles, same as PersonPlacesTab.vue's existing precedent
   (that file likewise has its own .detail-section styles, doesn't rely on cross-component sharing). */
.detail-section h4 {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fg-subtle);
  margin: 0 0 10px;
  line-height: 1.4;
}

.insights {
  display: flex; flex-direction: column;
  gap: 10px;
}
.insight-card {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 10px;
  padding: 10px 12px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.5;
}
.insight-card .ico {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-text);
  border-radius: 50%;
  margin-top: 1px;
}
.insight-card b { color: var(--fg); font-weight: 600; }
</style>
