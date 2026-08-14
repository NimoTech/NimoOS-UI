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
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonAvatar from './PersonAvatar.vue'
import { mergeConfidencePct, type Person } from '../util/peopleView'

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

function submitName(): void {
  const name = nameInput.value.trim()
  if (!name) return
  emit('submit-name', name)
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
          <div class="cad-title" data-test="cad-title">{{ t(titleKey) }}</div>
          <div class="cad-subtitle" data-test="cad-subtitle">{{ subtitleText }}</div>
        </div>
        <button type="button" class="cad-close" data-test="cad-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <template v-if="mode === 'name'">
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

<style scoped>
.cad-overlay {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

/* P2 hard-won lesson (brief explicitly calls this out): panel background must use --popup-bg, not --card-bg (in dark theme
   --card-bg is near-transparent, layered on dark background it becomes see-through). */
.cad-panel {
  width: 440px;
  max-width: 100%;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 22px;
  box-shadow: var(--card-shadow-hi);
}

.cad-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
/* Vue2 :246-247 avatar outer decorative ring: 48px border-box container + 2px border, actual content area is 44px —
   PersonAvatar is passed size=44, this element only handles the outer geometry, does not change component contract. */
.cad-avatar-ring {
  width: 48px; height: 48px; box-sizing: border-box; flex: 0 0 auto;
  border-radius: 50%; border: 2px solid var(--accent-soft); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.cad-head-text { flex: 1 1 auto; min-width: 0; }
.cad-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.cad-subtitle { font-size: 11.5px; color: var(--fg-muted); margin-top: 2px; }
.cad-close {
  flex: 0 0 auto;
  width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.cad-close:hover { background: var(--hover); color: var(--fg); }

.cad-input {
  width: 100%; height: 36px; padding: 0 12px; margin-bottom: 12px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 8px;
  color: var(--fg); font: inherit; font-size: 13px; outline: none;
}
.cad-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

.cad-label { display: block; font-size: 11.5px; color: var(--fg-muted); margin-bottom: 6px; }

.cad-hint { font-size: 11px; color: var(--fg-muted); line-height: 1.5; padding: 8px 0 16px; }

.cad-actions { display: flex; gap: 10px; padding-top: 6px; border-top: 1px solid var(--divider); }
.cad-btn {
  flex: 1; height: 38px; border-radius: 10px; background: var(--chip-bg);
  border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px;
  font-weight: 500; cursor: pointer;
}
.cad-btn:hover { background: var(--chip-bg-hi); }
.cad-btn-primary {
  flex: 1.4; background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600;
  /* Final review Minor 1: after adding check icon, need Vue2 :291-292's inline-flex centering + 6px gap
     (same geometry as .cad-btn-danger in this file). */
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
/* Real device acceptance fix: `.cad-btn:hover` (previous rule, specificity (0,2,0)) overrides the single-class
   `.cad-btn-primary` (0,1,0), on hover swaps solid accent background for near-white --chip-bg-hi, but text
   is still --on-accent → white-on-white button disappears entirely. Variant must carry its own :hover background to redraw itself
   (same correct pattern as PhotosPersonDetail.vue:1142 on the details page).
   Background declaration goes in a rule without :not(:disabled): disabled state is also stolen by base class hover,
   both places need protection; brightness boost only applied when clickable (next rule stays as-is). */
.cad-btn-primary:hover { background: var(--accent); }
.cad-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
.cad-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
/* Follow Vue2 :351-357 solid red fill (not border) — gradient reuses PhotosTrash.vue:446
   `.trash-btn-cta.danger` existing convention (--remove-fg → --remove-bg), not a new color scheme. */
.cad-btn-danger {
  flex: 1.4; border: 0; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: linear-gradient(135deg, var(--remove-fg), var(--remove-bg));
  color: #fff; /* theme-exception: danger gradient button text, background is always danger red gradient
    (--remove-fg/--remove-bg), white text contrast is stable across both themes — same convention as PhotosTrash.vue
    .trash-btn-cta.danger, do not use --on-accent (it is only readable when background is definitely var(--accent) saturated
    solid, here background is not accent) */
  box-shadow: 0 4px 14px color-mix(in srgb, var(--remove-bg) 35%, transparent);
}
.cad-btn-danger svg { color: #fff; /* theme-exception: same as above, icon pinned to white like button text */ }
/* Same as above: on hover must redraw the danger red gradient, otherwise overridden by `.cad-btn:hover`'s --chip-bg-hi
   combined with pinned-white text → button and text both disappear (this is the button that showed up in device acceptance).
   Gradient is verbatim identical to .cad-btn-danger base declaration, tests have an equality assertion pinning both to prevent drift. */
.cad-btn-danger:hover {
  background: linear-gradient(135deg, var(--remove-fg), var(--remove-bg));
  filter: brightness(1.08);
}

.cad-candidates {
  max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
  margin-bottom: 14px;
}
.cad-candidate {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 8px;
  color: var(--fg); font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.cad-candidate:hover { background: var(--chip-bg-hi); }
.cad-candidate-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cad-candidate-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cad-candidate-count { font-size: 11px; color: var(--fg-muted); }
/* Final review Minor 2: end-of-line chevR. Vue2 :322 provides --text-3, this repo's equivalent is --fg-muted
   (same as the existing mapping in .cad-candidate-count above). */
.cad-candidate-chev { flex: 0 0 auto; color: var(--fg-muted); }
.cad-empty { padding: 24px; text-align: center; color: var(--fg-muted); font-size: 12px; }

/* Danger color tone (Vue2's delete warning box is semi-transparent red, not the --warn-* amber set — that set is the
   semantic for non-destructive notifications like "face recognition disabled", delete warning uses --remove-fg danger red family). */
.cad-warning {
  padding: 14px; background: color-mix(in srgb, var(--remove-fg) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--remove-fg) 25%, transparent); border-radius: 10px;
  font-size: 12.5px; color: var(--fg); line-height: 1.55; margin-bottom: 16px;
}
/* Vue2 :342 inner gray small text body (per var(--text-3)/11.5px). */
.cad-warning-body { color: var(--fg-muted); font-size: 11.5px; }
</style>
