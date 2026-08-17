<script setup lang="ts">
// Task 7 (SP7-P5 people): ClusterActionDialog.vue — unnamed person tri-state action dialog (name / merge /
// delete). Migrate segment by segment from Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:237-361 (template) and
// :624-643 (nextTick focus in openXxxDialog); photos-people.scss itself contains no modal styles
// (Vue2 modals rely entirely on inline style), here converted to this repo's convention of scoped style blocks + theme tokens.
// (Note: deliberately not writing literal style opening tag in the comment — color-guard.test.ts's style-block extraction regex uses
//  non-greedy matching, and a fake opening tag in the comment would make it consume all the way to the real closing tag at the end of the file, scanning the entire script +
//  template as a style block. See the no-fake-style-tag test case in that test file.)
//
// Division of responsibility (per brief, following the precedent of P4 AlbumPickerDialog but reversed): this component
// **only collects input and emits**; it does not call any store or toast — the actual calls, re-entrance guards, and toast
// for all three submission paths (renamePerson / mergePersonInto / purgePersonWithUndo) are entirely in the host PhotosPeople.vue.
//
// Review coordinator corrections (post-review, 3 items reverted to Vue2 literal implementation; this period's discipline is
// "UI must be exactly 1:1, only bug/race/silent failure changes apply" — the brief's structure checklist is a snapshot,
// Vue2 source code is the authority, absence from the checklist does not mean deletion is permitted):
//  1) Add <label> for mode='name', key photosPersonNameLabel (coordinator verified zh_CN.json:49
//     "Name": "名称" and approved new additions; both en and zh locales added at segment end, no reordering of existing keys).
//  2) Add decorative 2px solid var(--accent-soft) border ring around avatar in header (Vue2 :246-247's
//     border-box 48px container, actual content area is 44px — use outer .cad-avatar-ring here to replicate the same
//     geometry, PersonAvatar itself takes size 44).
//  3) Delete confirmation button reverted to Vue2's solid red fill (:351-357): use gradient with --remove-fg/--remove-bg
//     two existing tokens (same established convention as PhotosTrash.vue:446 `.trash-btn-cta.danger`, not a new invention),
//     foreground pinned to white + theme-exception (reason in that style comment, do not use --on-accent —
//     it is only readable when the background is definitely the saturated solid var(--accent) color, here background is a danger red gradient, condition not met).
//
// Review mandatory 1 (second round): delete mode actually has **three different captions** belonging to three slots; cross-checked
// Vue2 :259-262 (header title) against :337-343 (warning box's own title line + gray small text body) and discovered the previous version
// had incorrectly placed the warning box's title line ("Delete this person cluster?") in the header title slot, causing the header's actual
// "Delete face cluster" line to disappear and the warning box's own title line to be lost. Added header-specific key
// photosPersonDeleteClusterTitle (en is verbatim 'Delete face cluster'; zh does not copy zh_CN.json's
// "删除面部集群" — "cluster" violates this period's terminology red line, changed to "delete this group of faces"), warning box restored to
// "title line + <br/> + gray small text body" two-line structure, all three captions now in their correct slots.
//
// Plan D Task 4 (scoped zeroed out): this component's class names are unchanged (Task 1 already
// landed them in parity under the current .cad-* names — Vue2's entire dialog is built from
// :style bindings, so there's no class to anchor to). The whole local scoped style block that
// used to live at the end of this file has been deleted: every rule now has a matching,
// line-by-line-compared counterpart in src/photos/styles/vue2-parity/photos-people.scss (the two
// genuine gaps filled in during the diff — .cad-input:focus, .mrd-side's avatar square
// constraint — and the two local drifts from Vue2 corrected along the way — .cad-overlay's
// padding, .cad-btn-primary:disabled's visual — are all documented in those parity rules' own
// comments). Parity is a plain global stylesheet, and once this component carries no local
// scoped rules at all, nothing can out-specificity parity's own declaration order anymore — the
// hover-fix comments that used to be here (":hover losing its background to the base class's
// hover") existed precisely because a local scoped rule carries its own specificity bump; once
// scoped is entirely zeroed out, that precondition no longer holds and can't recur.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonAvatar from './PersonAvatar.vue'
import { findNamedDuplicate, mergeConfidencePct, type Person } from '../util/peopleView'

type DialogMode = 'name' | 'merge' | 'delete'

const props = defineProps<{
  open: boolean
  mode: DialogMode
  person: Person | null
  candidates: Person[]
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'submit-name', name: string): void
  (e: 'submit-merge', targetId: string | number): void
  (e: 'submit-delete'): void
}>()

const { t } = useI18n()

const nameInput = ref('')
const mergeQuery = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const mergeInputRef = ref<HTMLInputElement | null>(null)
// Task 7 (Plan D, duplicate-name dupconfirm): when non-null, the mode='name' template switches
// to the dupconfirm substate (mirroring Vue2's PhotosPeopleView.vue confirmName() :774-785, which
// switches clusterDialog.mode wholesale to 'dupconfirm' — here it's only a substate, not a new
// top-level mode, because the open/mode props are owned by the host; this component only
// switches views inside its own private ref).
const dupConfirm = ref<{ name: string; existing: Person } | null>(null)
const dupConfirmRef = ref<HTMLElement | null>(null)

// Iron rule: always normalize all id comparisons to String().
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

const titleKey = computed(() => {
  if (props.mode === 'name') return 'photosPersonNameTitle'
  if (props.mode === 'merge') return 'photosPersonMergeTitle'
  // Review mandatory 1: delete mode's header title slot corresponds to Vue2 :262 $t('Delete face cluster'),
  // and is different from the warning box's own internal title line (photosPersonDeleteTitle, :341); they are two different captions and cannot share a key.
  return 'photosPersonDeleteClusterTitle'
})

// Task 7 (Plan D, duplicate-name dupconfirm): when dupConfirm is non-null (the mode==='name'
// substate), the header title slot switches to the "a person with this name already exists"
// interpolated copy (mirroring Vue2 PhotosPeopleView.vue:317
// `$t('A person named "{name}" already exists.', { name: clusterDialog.pendingName })`); the
// avatar/subtitle (subtitleText) stay unchanged — they describe this naming action's original
// person cluster, and don't switch with the substate.
const headTitle = computed(() => {
  if (props.mode === 'name' && dupConfirm.value) {
    return t('photosPersonDupExistsTitle', { name: dupConfirm.value.name })
  }
  return t(titleKey.value)
})

const subtitleText = computed(() => {
  if (!props.person) return ''
  const n = props.person.count
  const pct = mergeConfidencePct(props.person.confidence)
  // No new merge key added: Vue2 has a single sentence "{n} photos · confidence {pct}%", this repo's locale doesn't have a
  // corresponding single combined key, so concatenate two existing keys (photosPeoplePhotosCount / photosPersonMergeSuggestConfidence)
  // joined by " · ", consistent with the same concatenation convention in PhotosPeople.vue's banner secondary line (:t + .sep).
  return `${t('photosPeoplePhotosCount', { n })} · ${t('photosPersonMergeSuggestConfidence', { n: pct })}`
})

const canSaveName = computed(() => nameInput.value.trim().length > 0)

// Candidates: exclude self → sort by count descending, same count by name ascending (deviates from registration 12, per brief) →
// empty query takes first 6, query present (case-insensitive includes) takes first 8. Sort → filter → truncate; filtering placed inside
// the dialog (it holds the query, per brief decision).
const sortedCandidates = computed(() => {
  const selfId = props.person?.id ?? null
  const pool = props.candidates.filter((p) => selfId === null || !sameId(p.id, selfId))
  return [...pool].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name)
  })
})
const filteredCandidates = computed(() => {
  const q = mergeQuery.value.trim().toLowerCase()
  if (!q) return sortedCandidates.value.slice(0, 6)
  return sortedCandidates.value.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
})

function close(): void {
  emit('update:open', false)
}

// Esc always listened at document level, watch(open) attaches/detaches; stopPropagation in branch (this repo's overlay convention,
// following AlbumPickerDialog.vue:70-100 precedent). Click overlay via @click.self to close.
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  close()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      nameInput.value = ''
      mergeQuery.value = ''
      dupConfirm.value = null
      document.addEventListener('keydown', onDocumentKeydown)
      // Follow Vue2 openNameDialog/openMergeDialog :624-637 $nextTick + focus (+select per brief
      // requirement; input is empty now, select() is a no-op but kept to match brief literal description).
      void nextTick(() => {
        if (props.mode === 'name') {
          nameInputRef.value?.focus()
          nameInputRef.value?.select()
        } else if (props.mode === 'merge') {
          mergeInputRef.value?.focus()
        }
      })
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

// Task 7: wires up duplicate-name detection (mirroring Vue2's confirmName :774-785 —
// findNamedDuplicate(peopleNamed, name) switches mode to 'dupconfirm' and focuses that box on a
// hit, only calling the real applyName otherwise). `candidates` is already the host-supplied full
// people.named list (the same one the merge mode reuses); the naming scenario doesn't need
// excludeId — this mode only ever triggers from an unnamed cluster, and the cluster itself isn't
// in candidates (the full named-people list), so it can't be misjudged as a duplicate of itself.
function submitName(): void {
  const name = nameInput.value.trim()
  if (!name) return
  const dup = findNamedDuplicate(props.candidates, name)
  if (dup) {
    dupConfirm.value = { name, existing: dup }
    // Mirroring Vue2's focusDlg() semantics of "focus the box itself in the dupconfirm substate" (:740-743).
    void nextTick(() => dupConfirmRef.value?.focus())
    return
  }
  emit('submit-name', name)
}
// "Name anyway" (mirroring Vue2 dupNameAnyway :791-796): ignore the duplicate, submit this name regardless.
function dupNameAnyway(): void {
  if (!dupConfirm.value) return
  emit('submit-name', dupConfirm.value.name)
}
// "Merge into existing" (mirroring Vue2 dupMergeInto :797-802): redirects into merging with that already-existing person.
function dupMergeInto(): void {
  if (!dupConfirm.value) return
  emit('submit-merge', dupConfirm.value.existing.id)
}
function pickCandidate(p: Person): void {
  emit('submit-merge', p.id)
}
function submitDelete(): void {
  emit('submit-delete')
}
</script>

<template>
  <div v-if="open" class="cad-overlay" data-test="cad-overlay" @click.self="close">
    <div class="cad-panel" data-test="cad-panel">
      <div class="cad-head">
        <div class="cad-avatar-ring" data-test="cad-avatar-ring">
          <PersonAvatar :person-id="person?.id ?? null" :name="person?.name" :ver="person?.coverFaceId ?? null" :size="44" />
        </div>
        <div class="cad-head-text">
          <div class="cad-title" data-test="cad-title">{{ headTitle }}</div>
          <div class="cad-subtitle" data-test="cad-subtitle">{{ subtitleText }}</div>
        </div>
        <button type="button" class="cad-close" data-test="cad-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <template v-if="mode === 'name'">
        <!-- Task 7: the duplicate-name dupconfirm substate — mirroring Vue2
             PhotosPeopleView.vue:396-419, replaces the input/hint/regular action row with three
             actions. The header (avatar/subtitle) is unchanged; only this block's content switches. -->
        <template v-if="!dupConfirm">
          <label class="cad-label" data-test="cad-name-label">{{ t('photosPersonNameLabel') }}</label>
          <input
            ref="nameInputRef"
            v-model="nameInput"
            type="text"
            class="cad-input"
            data-test="cad-name-input"
            :placeholder="t('photosPersonNamePlaceholder')"
            @keydown.enter="submitName"
          >
          <div class="cad-hint" data-test="cad-name-hint">
            {{ t('photosPersonNameHint', { n: person?.count ?? 0 }) }}
          </div>
          <div class="cad-actions">
            <button type="button" class="cad-btn" data-test="cad-cancel" @click="close">{{ t('photosCancel') }}</button>
            <button
              type="button"
              class="cad-btn cad-btn-primary"
              data-test="cad-save-name"
              :disabled="!canSaveName"
              @click="submitName"
            >
              <!-- Final review Minor 1: Vue2 PhotosPeopleView.vue:293 button has check icon inside (size 13),
                   original implementation missed it. Delete button on same row (:235) and MergeReviewDialog's accept both have it,
                   only this one of the three is plain text — internally inconsistent. -->
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              {{ t('photosPersonSaveName') }}
            </button>
          </div>
        </template>
        <template v-else>
          <div ref="dupConfirmRef" class="cad-dupconfirm" data-test="cad-dupconfirm" tabindex="-1">
            <button type="button" class="cad-dup-primary" data-test="cad-dup-merge" @click="dupMergeInto">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>
              {{ t('photosPersonDupMergeInto') }}
            </button>
            <button type="button" class="cad-dup-secondary" data-test="cad-dup-name-anyway" @click="dupNameAnyway">
              {{ t('photosPersonDupNameAnyway') }}
            </button>
            <button type="button" class="cad-dup-cancel" data-test="cad-dup-cancel" @click="close">
              {{ t('photosCancel') }}
            </button>
          </div>
        </template>
      </template>

      <template v-else-if="mode === 'merge'">
        <input
          ref="mergeInputRef"
          v-model="mergeQuery"
          type="text"
          class="cad-input"
          data-test="cad-merge-input"
          :placeholder="t('photosPersonMergeSearch')"
        >
        <div class="cad-candidates">
          <button
            v-for="p in filteredCandidates"
            :key="p.id"
            type="button"
            class="cad-candidate"
            data-test="cad-candidate"
            :data-id="p.id"
            @click="pickCandidate(p)"
          >
            <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="32" />
            <span class="cad-candidate-info">
              <span class="cad-candidate-name">{{ p.name }}</span>
              <span class="cad-candidate-count">{{ t('photosPeoplePhotosCount', { n: p.count.toLocaleString() }) }}</span>
            </span>
            <!-- Final review Minor 2: Vue2 :322 line end has chevR (size 12, --text-3 → this repo's --fg-muted),
                 original implementation missed it. Clicking this row **directly executes merge** with no undo; without this
                 "there's a next step" chevron the entire row is left with only hover background as a hint. -->
            <svg class="cad-candidate-chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
          <div v-if="filteredCandidates.length === 0" class="cad-empty" data-test="cad-empty">
            {{ t('photosPersonNoMatch') }}
          </div>
        </div>
        <div class="cad-actions">
          <button type="button" class="cad-btn" data-test="cad-cancel" @click="close">{{ t('photosCancel') }}</button>
        </div>
      </template>

      <template v-else>
        <!-- Review mandatory 1: warning box restored to Vue2 :337-343 two-line structure — first line is warning box's own title
             (photosPersonDeleteTitle, "Delete this person cluster?"), <br/> after line break comes gray small text body
             (photosPersonDeleteBody). These two captions and the header title (titleKey) are three different captions belonging to
             three different slots, cannot be substituted for each other. -->
        <div class="cad-warning" data-test="cad-delete-warning">
          <span data-test="cad-delete-warning-title">{{ t('photosPersonDeleteTitle') }}</span><br>
          <span class="cad-warning-body" data-test="cad-delete-warning-body">{{ t('photosPersonDeleteBody') }}</span>
        </div>
        <div class="cad-actions">
          <button type="button" class="cad-btn" data-test="cad-cancel" @click="close">{{ t('photosCancel') }}</button>
          <button type="button" class="cad-btn cad-btn-danger" data-test="cad-confirm-delete" @click="submitDelete">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            {{ t('photosPersonConfirmDelete') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
