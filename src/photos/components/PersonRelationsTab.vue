<script setup lang="ts">
// PersonRelationsTab.vue — people detail page "relations" tab
// (relation graph area + co-appearance list + Nimo's read insight card). Line-by-line port from
// the Vue 2 panel's src/views/Photos/PhotosPersonDetail.vue:187-227 (entire v-if="tab==='graph'"
// block), :530-536 (sortedRelations/relMax), :571-585 (nimoRead sentence assembly); styles from
// photos-people.scss:502-568 (relation graph + co-appearance list) and :647-682 (insight card).
//
// Section title (same approach as the places tab): Vue2's two .detail-section-title instances
// (:189-192 relation graph, :202 co-appearance) both live inside v-if="tab==='graph'" block,
// are part of this tab itself, not container responsibility — the container only switches tab.
//
// Affordance complement (not Vue2 behavior): PersonRelGraph's
// open-person (click satellite node to jump) passes through here to parent unchanged; Vue2
// relation graph nodes are not clickable; this complement already recorded at top of PersonRelGraph.vue.
//
// nimoRead sentence assembly's pure function part already moved to peopleView.ts's nimoReadParts
// (see that file's comments); here only does t(key, params) resolution + space
// joining (follows :584 `parts.join(' ')`), plus v-html hardening (see escapeHtml comment below).
//
// The insight card's bottom "Dig deeper" button (Vue2 :228-230 `.nimo-btn`,
// $emit('ask-nimo', ...)) was previously deferred and left unrendered; now added back per Vue2.
// The click is currently a no-op — wiring the real Ask Nimo call comes later.
//
// v-html security (tradeoff between two possible approaches): one option was "if low
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
import { useAskNimo } from '../composables/useAskNimo'

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

// Vue2 :533-536 relMax. Correctness fix (not copying the bug, correcting logic and recording it
// here): Vue2 when relations is
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
  // Unnamed people can now enter the detail page, and insight card sentence
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

// Opens the Ask Nimo popup with Vue2's exact canned prompt (PhotosPersonDetail.vue:228-230).
function onDigDeeper(): void {
  const name = props.person?.name?.trim() || t('photosPersonThisPerson')
  useAskNimo().openWith(t('photosPersonDigDeeperPrompt', { name }))
}
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
            <!-- PR 137 gap-close: Vue2 PR 137 patch (PhotosPersonDetail.vue,
                 graph-tab rel-row) added `r.name || $t('Unnamed person')` here — this list row
                 was missing that fallback. -->
            <div class="nm">{{ r.name || t('photosPersonUnnamedTitle') }}</div>
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
        <!-- The "Dig deeper" button — Vue2 :228-230, click is currently a no-op
             (onDigDeeper), wiring comes later. -->
        <button type="button" class="nimo-btn" data-test="rel-insight-dig-deeper" @click="onDigDeeper">
          {{ t('photosPersonDigDeeper') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup: `.rel-section`, `.detail-section-title`(+`.sub`),
   `.rel-graph-wrap`(+`.legend` family), `.rel-list`/`.rel-row`(+`.body`/`.nm`/`.ct`/`.bar`/
   `.bar > div`) all duplicated parity anchors under the exact same selector paths and have
   been deleted — parity now governs directly, using its own token set (`--text-1`/`--surface-1`
   /`--line`/`--r-lg` etc.) rather than this app's theme.css tokens the comments here used to
   explain as substitutes (mostly cosmetic: parity's tokens resolve to Vue2's own pixel values inside
   `.photos-root`, this component's previous substitutions were reasoned approximations). */

/* `.rel-insight-card` survives as a deliberate, already-reviewed deviation from both Vue2 and
   parity: Vue2 hardcodes this card's background as a fixed purple RGB-triplet gradient
   (its old theme's literal accent color) — parity transcribes that literal value too. This app
   follows the *current* theme's --accent instead via color-mix, so the card doesn't look
   frozen to Vue2's old purple in whichever theme has a different accent. Not a bug to fix;
   kept exactly as previously reasoned. */
.rel-insight-card {
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 10%, transparent),
    color-mix(in srgb, var(--accent) 3%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: var(--radius-sm);
  padding: 16px;
}
/* `.hd` itself duplicated parity's own rule (parity's `color: var(--accent-hi)` is already a
   themed token, not one of Vue2's hardcoded literals, so there's no reason to keep a local
   copy — deleted). `.hd .orb`'s background-image comes from an inline :style binding (imported
   asset URL, see script block) rather than parity's `url(../../assets/nimo-logo.png)` —
   parity's relative scss import path is not guaranteed to resolve the same way through this
   app's own asset pipeline, so the image itself stays inline; only the box geometry survives
   here (parity's shorthand still supplies matching background-size/position/repeat, since
   inline style only overrides the single background-image longhand it sets). `.rel-insight-card
   p` duplicated parity's own rule too and has been deleted (parity's `margin: 0 0 10px` vs.
   this component's `margin: 0` — this component never renders the button that margin made room
   for, so the extra 10px is just a touch of trailing padding, not a visible defect). */
.rel-insight-card .hd .orb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
</style>
