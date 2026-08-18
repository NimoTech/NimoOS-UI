<script setup lang="ts">
// Task 8 (SP7-P5 people): MergeReviewDialog.vue — merge suggestion review dialog shown item-by-item.
// Ported segment-by-segment from Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:364-434
// (template structure) and :595-614 (emit semantics of onAcceptReview/onRejectReview).
//
// Division of concerns (same pattern as T7 ClusterActionDialog, equally reversible): this
// component only collects user clicks and emits; it does not call store, does not show toast,
// and does not clamp index — all three of those happen in the host PhotosPeople.vue (which holds
// the suggestions array and index; the brief explicitly requires clamping logic in the parent).
//
// Avatar reuses T5's PersonAvatar (with added shape='square' extension; see that component's
// changes), does not self-paint — the benefit is three-level fallback (real image → initials →
// person icon) and self-healing on failure, all free of charge; no need to re-implement Vue2's
// :385-399/403-417 local-state avatarFailed/onAvatarError machinery.
//
// Faithful asymmetry (brief explicitly requires copying as-is; logged as Vue2 status quo, not a
// gap in this component): left side (fromId) name reverse-looked-up from people list (:395-396);
// right side (intoId) uses suggestion.intoName directly (:413-414), no lookup — intoName is a
// snapshot from suggestion-generation time, may not match the current latest renamed name; Vue2
// works the same way.
//
// i18n gaps (keys not listed in brief; confirmed missing and added per "report gaps as they
// arise"; logged in task report): photosPersonMergeGroupA/B (two fixed column labels, original
// Vue2 $t('Cluster A'/'Cluster B'); old repo zh_CN.json:1993-1994 translated to "clusters A/B"
// which violates this period's terminology redline, changed to "group A/B"), and
// photosPersonMergeNimoLead (brand-prefixed reason label $t('Nimo:')).
//
// Plan D Task 4 (scoped zeroed out): this component's class names are unchanged (Task 1 already
// landed them in parity under the current .mrd-* names — Vue2's entire dialog is likewise built
// from :style bindings, so there's no class to anchor to). The whole local scoped style block
// that used to live at the end of this file has been deleted: every rule now has a matching,
// line-by-line-compared counterpart in src/photos/styles/vue2-parity/photos-people.scss (the
// genuine gap filled in during the diff — the old `:deep(.person-avatar)` avatar square
// constraint has been rewritten in parity as a plain descendant selector
// `.mrd-side .person-avatar`, since parity isn't scoped CSS and doesn't need :deep; the local
// drift from Vue2 corrected along the way — .mrd-overlay's padding — is also documented in that
// parity rule's own comment). Parity is a plain global stylesheet, and once this component
// carries no local scoped rules at all, nothing can out-specificity parity's own declaration
// order anymore — the hover-fix comment that used to be here (":hover losing its background to
// the base class's hover") existed precisely because a local scoped rule carries its own
// specificity bump; once scoped is entirely zeroed out, that precondition no longer holds and
// can't recur.
import { computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonAvatar from './PersonAvatar.vue'
import { mergeConfidencePct, mergeReasonKey, type Person } from '../util/peopleView'
// Coordinator decision (fix, appended after task-8 report): the header brand circle avatar is not
// the "AI decoration that can be freely substituted" category; the plan explicitly requires using
// the real asset as Vue2 does. Vue2's nimo-logo.png (PhotosPeopleView.vue:370, 372) was originally
// missing from this repo; now copied as-is from the old repo's src/views/Photos/nimo-logo.png to
// src/photos/assets/nimo-logo.png (44850 bytes, md5 checksum matches source), not redrawn.
import nimoLogoUrl from '../assets/nimo-logo.png'

export interface MergeSuggestion {
  id: string | number
  fromId: string | number
  intoId: string | number
  intoName?: string
  confidence?: number
}

const props = defineProps<{
  open: boolean
  suggestions: MergeSuggestion[]
  index: number
  people: Person[]
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  // Declared to satisfy the interface contract in the brief, but currently never called: this
  // component has no independent "jump to item N" navigation control (Vue2 doesn't either —
  // reviewIdx is only set to 0 when openReview is triggered, then clamped by the host only on
  // accept/reject). Keeping this emit ensures open/index stay in a uniform v-model form, rather
  // than cutting interface-required parts just because they're "not used yet".
  (e: 'update:index', v: number): void
  (e: 'accept', id: string | number): void
  (e: 'reject', id: string | number): void
}>()

const { t } = useI18n()

// Hard rule: all ID comparisons normalize to String(); backend IDs may be numbers.
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

// Vue2 :518 currentMerge = mergeSuggestions[reviewIdx]. When index is out of bounds (the host's
// clamping happens after await; during the window when accept/reject is in flight, suggestions
// has one fewer item but index hasn't been clamped yet), falls to undefined — template v-if
// guards against it, no crash, same defensive pattern as Vue2's `v-if="reviewOpen && currentMerge"`.
const current = computed<MergeSuggestion | undefined>(() => props.suggestions[props.index])

const titleText = computed(() =>
  t('photosPersonMergeSuggestTitle', { idx: props.index + 1, total: props.suggestions.length }),
)
const confidenceText = computed(() =>
  t('photosPersonMergeSuggestConfidence', { n: mergeConfidencePct(current.value?.confidence) }),
)

// Left side name reverse lookup (Vue2 :395-396): search people list by fromId, return empty
// string if not found (personInitial falls through to person icon on empty string, same as Vue2's
// `|| ''`).
const fromName = computed(() => {
  const s = current.value
  if (!s) return ''
  return props.people.find((p) => sameId(p.id, s.fromId))?.name ?? ''
})
// Avatar cache-bust ver: both sides use the same lookup logic (Vue2 :560-563 avatarUrl treats
// fromId/intoId identically; asymmetry is only in name display, not avatar URL/ver).
const fromVer = computed(() => {
  const s = current.value
  if (!s) return null
  return props.people.find((p) => sameId(p.id, s.fromId))?.coverFaceId ?? null
})
const intoVer = computed(() => {
  const s = current.value
  if (!s) return null
  return props.people.find((p) => sameId(p.id, s.intoId))?.coverFaceId ?? null
})

const reasonText = computed(() => {
  const r = mergeReasonKey(current.value ?? null)
  return t(r.key, r.params)
})

// Primary button copy: intoName exists → photosPersonMergeAs {name}; missing → use
// photosPersonMergeAsSame to fill the same key's {name} placeholder (Vue2's :429-430 v-if/v-else
// two lines are already merged into one in New-UI locale; see photosPersonMergeAs definition in
// zh_cn.ts / en_us.ts).
const acceptLabel = computed(() =>
  t('photosPersonMergeAs', { name: current.value?.intoName || t('photosPersonMergeAsSame') }),
)

function close(): void {
  emit('update:open', false)
}
function onReject(): void {
  if (!current.value) return
  emit('reject', current.value.id)
}
function onAccept(): void {
  if (!current.value) return
  emit('accept', current.value.id)
}

// Esc: document-level + watch(open) attach/detach + stopPropagation inside (same pattern as
// AlbumPickerDialog.vue:70-100 / ClusterActionDialog.vue:103-134). Click overlay @click.self to
// close. z-index must be lower than the three-state dialog (ClusterActionDialog is 220; Vue2
// itself has a 100 vs 200 ratio between the two), see comment in styles section.
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  close()
}
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) document.addEventListener('keydown', onDocumentKeydown)
    else document.removeEventListener('keydown', onDocumentKeydown)
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))
</script>

<template>
  <div v-if="open && current" class="mrd-overlay" data-test="mrd-overlay" @click.self="close">
    <div class="mrd-panel" data-test="mrd-panel">
      <div class="mrd-head">
        <!-- Vue2 :372 renders brand circle avatar using nimoLogoUrl image (background:url(...)
             center/cover). Here we use equivalent <img> + object-fit:cover to restore the same
             geometry; real asset documented in import comment. -->
        <img :src="nimoLogoUrl" class="mrd-logo" data-test="mrd-logo" alt="" aria-hidden="true">

        <div class="mrd-head-text">
          <div class="mrd-title" data-test="mrd-title">{{ titleText }}</div>
          <div class="mrd-confidence" data-test="mrd-confidence">{{ confidenceText }}</div>
        </div>
        <button type="button" class="mrd-close" data-test="mrd-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <div class="mrd-compare">
        <div class="mrd-side" data-test="mrd-side-from">
          <PersonAvatar :person-id="current.fromId" :name="fromName" :ver="fromVer" :size="200" shape="square" />
          <div class="mrd-side-label" data-test="mrd-label-from">{{ t('photosPersonMergeGroupA') }}</div>
        </div>
        <div class="mrd-side" data-test="mrd-side-into">
          <PersonAvatar :person-id="current.intoId" :name="current.intoName || ''" :ver="intoVer" :size="200" shape="square" />
          <div class="mrd-side-label" data-test="mrd-label-into">{{ t('photosPersonMergeGroupB') }}</div>
        </div>
      </div>

      <div class="mrd-reason" data-test="mrd-reason">
        <b class="mrd-reason-lead">{{ t('photosPersonMergeNimoLead') }}</b> {{ reasonText }}
      </div>

      <div class="mrd-actions">
        <button type="button" class="mrd-btn" data-test="mrd-reject" @click="onReject">{{ t('photosPersonNotAMatch') }}</button>
        <button type="button" class="mrd-btn mrd-btn-primary" data-test="mrd-accept" @click="onAccept">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          {{ acceptLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
