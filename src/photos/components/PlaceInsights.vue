<script setup lang="ts">
// PlaceInsights.vue — the place detail panel's "Nimo noticed" insight-card section. Ported
// section-by-section from Vue2 src/views/Photos/PhotosPlacesView.vue:1174-1184 (template);
// styles follow photos-places.scss:729-756 (skipping `.insight-card .meta` at :756-762 — the
// template's insight-card never has a .meta element, it's dead CSS, not ported).
//
// Hard requirement: zero v-html. A precedent once cited for this ("PersonRelationsTab.vue's
// approach") is actually a counterexample — PersonRelationsTab.vue:19-29 ultimately chose
// "escaped params + v-html", not <i18n-t>. This component follows the **requirement** (zero
// v-html), not that citation. The four backend shapes (mostPhotographed/topSpot/companions/home)
// each have a different set of interpolations (some need a bolded parameter, some have no
// bolded parameter at all), so each shape has to be hardcoded as its own
// <i18n-t keypath scope="global"> — there's no single template generic enough to cover all
// four shapes.
//
// Deviation 8 (established in util/placesInsight.ts's insightKey()): the backend key is a
// Vue2-era dot-nested key, New-UI uses a flat camelCase key; insightKey() returns null for an
// unknown key — based on that, this card doesn't render at all and logs a single
// console.warn, rather than dumping the raw internal key to the user the way Vue2's pt() would.
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

// Filters out cards with unknown keys (Deviation 8). console.warn fires once per unknown card
// here — the computed is cached by reference, so it won't re-warn as long as props.insights
// doesn't change.
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

// Three icon branches: ico has exactly three values, sparkles/person/home (backend contract,
// NimoOS-Photos/service/places.go:526-560), unknown values fall back to sparkles.
type IconName = 'sparkles' | 'person' | 'home'
function iconName(ico: string): IconName {
  return ico === 'person' || ico === 'home' ? ico : 'sparkles'
}
</script>

<template>
  <!-- Deviation: the original spec called for v-if="insights.length > 0"; here
       renderable.length is used instead — if every passed-in insight has an unknown key,
       renderable is empty after filtering, leaving just a bare "Nimo noticed" title with no
       cards at all, which is worse than Vue2 (Vue2 at least dumps the internal key to the
       user, so there's at least some content) — so the whole section is hidden together in
       that case. -->
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

        <!-- Each of the four backend shapes gets its own <i18n-t> named slot, zero v-html.
             The keypath comes from insightKey(); it's checked against four fixed strings (not
             a dynamically-built keypath), matching the already-filtered key set in
             renderable. -->
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
        <!-- The one remaining shape: photosPlacesInsightMostPhotographed, which only has
             {count} and no bolded parameter. -->
        <i18n-t v-else :keypath="ins.k" tag="span" scope="global">
          <template #count>
            {{ ins.params.count }}
          </template>
        </i18n-t>
      </div>
    </div>
  </div>
</template>


<!-- Shadowing cleanup: the `<style scoped>` block that used to
     live here has been deleted entirely. Every rule it carried (`.detail-section h4`,
     `.insights`, `.insight-card`, `.insight-card .ico`, `.insight-card b`) was a duplicate of
     `src/photos/styles/vue2-parity/photos-places.scss:675-682`(`.detail-section h4`)/
     `:750-774`(`.insights`/`.insight-card` family) — this component always renders inside
     `.photos-root` (via PlaceDetailPanel.vue → PlacesMap-page), so parity's *unscoped* global
     selectors already reach it fine; the old header comment's claim that "Vue scoped CSS
     doesn't cross component boundaries, so this file needs its own copy" only explains why
     PlaceDetailPanel.vue's own *scoped* `.detail-section h4` can't reach here — it does not
     apply to parity's plain, unscoped CSS, which crosses every component boundary the same
     way any global stylesheet does. Two real value bugs this also fixes: `.insight-card .ico`
     used the global New-UI token `--accent-text` (`#a9c6ff`, a blue family calibrated for
     New-UI's own accent) instead of Photos-local `--accent-hi`/`--accent-ink` (`#8A7AFF`/
     `#CFC6FF`, purple family) — wrong hue; and the base `.detail-section h4`/`.insights`/
     `.insight-card`/`b` rules all substituted global tokens (`--fg-subtle`/`--chip-bg`/
     `--card-border`/`--radius-sm`/`--fg-muted`/`--fg`) for Photos-local ones
     (`--text-3`/`--surface-2`/`--line`/`--r-sm`/`--text-2`/`--text-1`) that parity already
     declares correctly for these exact selectors — same shadowing-bug pattern as
     PlacesZoomBar.vue's own fix for the identical issue. No test in PlaceInsights.test.ts reads
     this component's own raw `<style>` text (grep-confirmed: no `cssCascade`/`extractStyleBlock`
     import), so nothing here needed to survive locally. -->
