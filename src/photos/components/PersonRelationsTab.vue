<script setup lang="ts">
// Task 13 (SP7-P5 people): PersonRelationsTab.vue — people detail page "relations" tab
// (relation graph area + co-appearance list + Nimo's read insight card). Line-by-line port from
// Vue2 NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:187-227 (entire v-if="tab==='graph'"
// block), :530-536 (sortedRelations/relMax), :571-585 (nimoRead sentence assembly); styles from
// photos-people.scss:502-568 (relation graph + co-appearance list) and :647-682 (insight card).
//
// Section title (coordinator decision, same as T12): Vue2's two .detail-section-title instances
// (:189-192 relation graph, :202 co-appearance) both live inside v-if="tab==='graph'" block,
// are part of this tab itself, not container responsibility — container (T14) only switches tab.
//
// Affordance complement (brief explicitly requires, not Vue2 behavior): PersonRelGraph's
// open-person (click satellite node to jump) passes through here to parent unchanged; Vue2
// relation graph nodes are not clickable; this complement already recorded at top of PersonRelGraph.vue.
//
// nimoRead sentence assembly's pure function part already moved to peopleView.ts's nimoReadParts
// (T13 new addition, see that file's comments); here only does t(key, params) resolution + space
// joining (follows :584 `parts.join(' ')`), plus v-html hardening (see escapeHtml comment below).
//
// v-html security (tradeoff between two brief options, detailed in report): brief suggests "if low
// cost, switch to <i18n-t> named slots to make <b> a slot". Here using another lower-cost path
// that equally closes the risk — before assembling sentence, HTML-escape each interpolation
// parameter (person name / place name, both from backend / user input), then v-html the assembled
// string. After escaping, the only remaining "<b>"/"</b>" in the string can only come from our own
// translation template, never from data; XSS risk is closed, and doesn't depend on vue-i18n rich
// interpolation slot's dynamic slot-name mechanism (that path would need separate handling for
// bold/non-bold parameter branching for 5 different keys with different parameter sets, much higher
// complexity). Vue2 uses completely unescaped raw interpolation for the same parameters (:576
// `$t('...<b>{other}</b>.', {..., other: top.name})`), so here is already safer than Vue2, not
// "same risk carried over".
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonRelGraph from './PersonRelGraph.vue'
import PersonAvatar from './PersonAvatar.vue'
import nimoLogoUrl from '../assets/nimo-logo.png'
import { nimoReadParts, type Person, type PlaceGroup } from '../util/peopleView'
import type { PersonRelation } from '../composables/usePersonDetail'

const props = defineProps<{
  relations: PersonRelation[]
  person: Person | null
  places: PlaceGroup[]
}>()

const emit = defineEmits<{ (e: 'open-person', id: string | number): void }>()

const { t } = useI18n()

// Vue2 :530-532 sortedRelations — descending by count, does not mutate props.relations itself
// (nimoReadParts needs to read original order's relations[0], see nimoReadHtml below).
const sortedRelations = computed(() => [...props.relations].sort((a, b) => b.count - a.count))

// Vue2 :533-536 relMax. Review-recorded correctness fix (not copying bug; per project "port
// discipline" convention, correcting logic and recording in comment): Vue2 when relations is
// non-empty but all count===0 computes Math.max(...[0,0])===0, leading to bar width `0/0*100%`
// = NaN% (browser ignores this invalid inline style value, visually degrades to "no width set"
// rather than crash, but still bad value). Here also add ,1 fallback in Math.max call, same
// technique as PersonRelGraph's maxCount — no behavior difference for real data (count is never 0,
// else this relation wouldn't be in relations at all), just plugs this one theoretical divide-by-zero
// gap.
const relMax = computed(() =>
  props.relations.length ? Math.max(...props.relations.map((r) => r.count), 1) : 1,
)

// escapeHtml — see v-html security explanation at script top. Only escapes HTML special
// characters, no extra normalization — escaped text goes as-is to vue-i18n's t() for interpolation.
function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Vue2 :571-585 nimoRead. When person is null Vue2 also directly returns empty string
// (:572 `if (!this.person) return ''`).
const nimoReadHtml = computed(() => {
  if (!props.person) return ''
  // User acceptance new: unnamed people can now enter detail page, and insight card sentence
  // templates all have {name} placeholder; bare person.name would render as " photos not enough..."
  // with leading space artifact (Vue2 same issue, but it can't get here so unreachable). Fallback
  // language exactly matches same-period PersonPlacesTab.vue:51 — both use photosPersonThisPerson.
  const name = props.person.name.trim() || t('photosPersonThisPerson')
  const parts = nimoReadParts(name, props.relations, props.places)
  return parts
    .map((part) => {
      const escaped: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(part.params)) escaped[k] = escapeHtml(v)
      return t(part.key, escaped)
    })
    .join(' ')
})
</script>

<template>
  <div class="rel-section">
    <div>
      <div class="detail-section-title">
        {{ t('photosPersonGraphTitle') }}
        <span class="sub">{{ t('photosPersonGraphSub') }}</span>
      </div>
      <div class="rel-graph-wrap">
        <div class="legend">
          <span><span class="l" /> {{ t('photosPersonGraphLegendFrequent') }}</span>
          <span><span class="l thin" /> {{ t('photosPersonGraphLegendOccasional') }}</span>
        </div>
        <PersonRelGraph
          :relations="relations" :person="person"
          @open-person="emit('open-person', $event)"
        />
      </div>
    </div>
    <div>
      <div class="detail-section-title">{{ t('photosPersonCoappearTitle') }}</div>
      <div class="rel-list">
        <div
          v-for="r in sortedRelations" :key="r.personId" class="rel-row"
          @click="emit('open-person', r.personId)"
        >
          <PersonAvatar :person-id="r.personId" :name="r.name" :ver="r.coverFaceId" :size="36" />
          <div class="body">
            <div class="nm">{{ r.name }}</div>
            <div class="ct">{{ t('photosPersonPhotosTogether', { n: r.count }) }}</div>
          </div>
          <div class="bar"><div :style="{ width: (r.count / relMax * 100) + '%' }" /></div>
        </div>
      </div>

      <div class="rel-insight-card" style="margin-top: 18px">
        <div class="hd"><span class="orb" :style="{ backgroundImage: `url(${nimoLogoUrl})` }" /> {{ t('photosPersonNimoRead') }}</div>
        <!-- eslint-disable-next-line vue/no-v-html -- interpolation params already escaped
             individually in nimoReadHtml, remaining <b> can only come from translation template
             itself, see script section comment -->
        <p class="insight-text" data-test="insight-text" v-html="nimoReadHtml" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Relation graph area (follow photos-people.scss:502-535). */
.rel-section {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  align-items: start;
}
/* Vue2 uses --font-display/--font-sans two font tokens to distinguish title/subtitle font-weight
   source; New-UI has only one unified --font token (verified in theme.css), both use it, same as
   PersonPlacesTab.vue's .detail-section-title/.sub existing precedent (T12, same flex+baseline+gap
   structure, same --fg/--fg-muted coloring) — both tabs render their own section titles
   (coordinator decision), CSS rules therefore written separately, not omitted sharing. */
.detail-section-title {
  font-family: var(--font);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 14px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--fg);
}
.detail-section-title .sub {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-muted);
  letter-spacing: 0;
}
/* Vue2 this card uses --surface-1 (background) / --line (border) / --r-lg (border-radius) three
   tokens, none exist here (verified via grep, both theme blocks lack them) — substitute with
   --card (same as T12 .map-card precedent) / --card-border / --radius-sm respectively. */
.rel-graph-wrap {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: 16px;
  position: relative;
  min-height: 420px;
  overflow: hidden;
}
/* Vue2 legend text uses --text-3, does not exist here, substitute with semantically equivalent --fg-muted. */
.rel-graph-wrap .legend {
  position: absolute;
  top: 14px;
  left: 16px;
  font-size: 11px;
  color: var(--fg-muted);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rel-graph-wrap .legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rel-graph-wrap .legend .l {
  width: 18px;
  height: 2px;
  background: var(--accent);
  opacity: 0.8;
}
.rel-graph-wrap .legend .l.thin {
  opacity: 0.4;
}

/* Co-appearance list (follow photos-people.scss:537-568). */
.rel-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
/* Vue2 uses --surface-2, does not exist here, substitute with --hover (same as PersonHero.vue
   .hero-menu-item:hover precedent: light overlay layer on transparent background for line-level hover). */
.rel-row:hover {
  background: var(--hover);
}
.rel-row .body {
  flex: 1;
  min-width: 0;
}
.rel-row .nm {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}
.rel-row .ct {
  font-size: 11.5px;
  color: var(--fg-muted);
}
.rel-row .bar {
  width: 60px;
  height: 4px;
  border-radius: 99px;
  /* Vue2 this track background uses --ink token at 6% transparency, --ink does not exist here
     (verified via grep, neither theme block has that token) — substitute with semantically
     equivalent neutral light overlay token --divider (defined in both themes). */
  background: var(--divider);
  overflow: hidden;
  flex: none;
}
.rel-row .bar > div {
  height: 100%;
  /* Vue2 uses var(--accent-hi) — that token does not exist here, substitute with --accent-text
     (defined in both themes, semantics equivalent: "accent highlight/text variant"). */
  background: linear-gradient(90deg, var(--accent), var(--accent-text));
}

/* Nimo's read insight card (follow photos-people.scss:647-673; does not include :674-682
   "deep dive" button styles — that button not rendered this task, belongs to SP8). */
.rel-insight-card {
  /* Vue2 this card's background is hard-coded fixed purple transparency gradient (RGB 110,91,255)
     — exactly Vue2 old theme's accent literal color, not theme-independent data viz color. Change to
     use color-mix deriving from current theme's --accent, follows theme switch, not pinned to purple
     (the two themes' accent values differ). */
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 10%, transparent),
    color-mix(in srgb, var(--accent) 3%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: var(--radius-sm);
  padding: 16px;
}
.rel-insight-card .hd {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--accent-text);
  font-weight: 600;
  margin-bottom: 10px;
}
.rel-insight-card .hd .orb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}
.rel-insight-card p {
  font-size: 12.5px;
  color: var(--fg-muted);
  line-height: 1.55;
  margin: 0;
}
</style>
