<!--
  SP8-P5d Task 6 — "Notes" page (rail item 4), 1:1 port from Vue2 blueprint
  the Vue 2 panel (main@7a6ee6b7) `src/views/AI/Knowledge/NotesView.vue` (271 lines,
  read via `git show 7a6ee6b7:`, governance §1: working tree of old branch is not
  trusted).

  Structure cross-reference (blueprint line range → this file):
    :8-16    pathstrip (each note is a .md file on disk)
    :19-28   skeleton screen (loading && !notes.length)
    :31-38   empty state (!notes.length)
    :42-76   draft inbox (drafts.length)
    :79-99   toolbar (status pill + type select + create)
    :102-142 list (filtered) + list footer
    :147-175 delete confirm dialog (this task converts to reka, see K7/K29/K36 family below)
    :180-266 all script

  [K1 — single-level fetch, governance §4.1] `service.notes.list({limit:200})` returns
  **normalized `Note[]`**, not a `{notes:[]}` envelope (`the shared service package's src/notes.ts:211-215`);
  `service.notes.getSettings()` returns camelCase with only `{notesRoot, autoExtract}`
  two fields; `service.notes.remove(id)` return value not used on this page (blueprint `:261`
  just `await`).

  [§5.2 — reload() stale guard, K15 family 8th instance] `reload()` has 3 concurrent entry
  points: created equivalent (see setup top-level call at file bottom) · `watch editingId`
  becomes empty · 5 actions each call `reload()`. `loading = false` cleared early by
  whichever finishes first makes skeleton disappear early, user-visible — use component-local
  (not module-level!) `let reloadEpoch` to check "am I still the latest dispatch?", drop
  entire request if not latest, inline write, don't extract shared guard.

  [N30 — watch editingId reloads only when becoming empty, copied] `:key="editingId"` cannot
  be deleted. When switching to another note (id non-empty → another non-empty), no reload
  triggered, use :key change to rebuild child component.

  [N24 — skeleton arithmetic inline styles copied verbatim] `(52 - i*8)%` / `(72 - i*6)%`
  and `cursor: default` unchanged, don't extract to class / computed.

  [N31 — confirmAll copied] `Promise.all` concurrent + no `finally` + reload() even on fail.
  On partial success (e.g. 1 of 3 rejected by backend): `Promise.all` rejects as whole, toast
  one failure message, but subsequent `reload()` still refreshes the ones that succeeded on
  backend — this is Vue2 current state, not reproducible buggy behavior, don't fix.

  [N25 — list footer whole sentence with {n} copied] cannot split into three concat parts.

  [K3] `store.actions.toast(...)` → global `useToast().show(msg, 2400)` (per P5a K3,
  2400ms matches the fixed duration in `knowledgeStore.ts:312`).
  [K5 (all catch blocks)] don't echo backend `e.message`, unified fixed message `aiKbOpFailed`
  — blueprint has 5 catch blocks with `$t('Operation failed') + ': ' + (e.message || e)`,
  this repo per established template (P2a/P2b/P5b K19/P5c K30) just toasts fixed key.

  [`store.actions.setNotesDraftCount(n)` call copied] `knowledgeStore.ts:509`,
  this store unchanged throughout, this task just calls it.

  [notesRoot silent fallback, K6] blueprint `:215` is empty catch + comment `keep placeholder`,
  copied verbatim, don't even add `console.error`.

  [`editingId` deep link watch each key's own getter] `editingId` reads `route.query.id`
  as computed (naturally reactive, not one-time read in onMounted), avoid the
  `newui-router-query-only-no-remount` pitfall — user changing address bar also takes effect.

  [Gap ③ — template inline color, Appendix B §B.4 line 34 is authoritative mapping] blueprint
  `:85` has draft count bg color literal buried in `:style` JS object literal, swapped to
  token reference. Guard in `../../styles/knowledgeStyles.test.ts` "guard gap ③′" — that
  assertion greedily scans entire `<template>` block with text-level regex, naturally covers
  color strings inside `:style` object literals (not just `style="…"` attribute), this task
  adds `views/NotesView.vue` to `KNOWLEDGE_VUE_FILES` list to be covered.

  [K41 family — tags type narrowing] `Note.tags` inside package is `unknown[]`
  (`the shared service package's src/notes.ts:25`), blueprint template treats it as string array, renders
  directly (`:124/:128`, `{{ t }}` / `:key="t"`), create/update both endpoints already have
  tags field as `string[]`, blueprint itself never does runtime validation. Consumer-side
  one-time assertion narrowing (`tagsOf()`), don't change package, don't use `any`. K41
  formally registered in governance at T7, this task hits same field same technique, note
  together in prose.

  [K34 family — Vue3+TS mechanical translation] In `confirmDelete()`, `deleting.value!.id`
  — blueprint `notesApi.remove(this.deleting.id)` has no null defense, `deleting` only
  non-null when delete dialog opens (button only appears inside dialog). Per K34 item ④
  "throw if we can", use non-null assertion `!` not `?.` / early return (that would silently
  turn blueprint's implicit throw into no-op, not zero behavior change).

  [NoteEditPane.vue landed in T7] At T6 submission this file didn't exist, inlined a
  zero-logic placeholder component replacing static import (see p5d-task-6-report.md §7).
  T7 created real `../components/NoteEditPane.vue`, per plan §T7 / brief §2
  "auto-chamber" guard requirement (see NotesView.test.ts corresponding describe block),
  already swapped this import back to real component, placeholder implementation deleted.

  [Delete confirm dialog converted to reka, declared] Plan §T8-7 already defined conflict
  dialog as "convert", this task judges delete confirm as same family (K7 since P5b applies
  to all new dialogs this period, QueueView/IndexedFilesView/SettingsView three precedents
  all converted). Blueprint itself already has visible `.k-modal-title` element (near `:150`),
  per K36 established choice use `<DialogTitle as-child>` directly wrapping that div
  (no additional VisuallyHidden hidden node), DOM verbatim as blueprint. `DialogPortal
  to=".knowledge-app"`, structure copied from `QueueView.vue:560-583` / `SettingsView.vue:580-624`,
  don't invent new.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import { service } from '@nimotech/nimoos-service'
import type { Note } from '@nimotech/nimoos-service'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useToast } from '../../../stores/toast'
import KIcon from '../components/KIcon.vue'
import NoteEditPane from '../components/NoteEditPane.vue'
import { openDirInNewTab } from '../../services/openInApp'
import { NOTE_TYPES, noteTypeMeta, noteSourceMeta, applyFilters, relativeTime } from '../util/notesViewHelpers'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

const typeMeta = noteTypeMeta
const sourceMeta = noteSourceMeta
const timeAgo = relativeTime

const notes = ref<Note[]>([])
const loading = ref(false)
const fType = ref('')
const fStatus = ref<'active' | 'draft' | 'curated' | 'archived'>('active')
const inboxOpen = ref(true)
const deleting = ref<Note | null>(null)
const bulkConfirming = ref(false)
const notesRoot = ref('')

/** K41 family (see file header comment) — `Note.tags` inside package is `unknown[]`,
 * consumer-side one-time assertion narrowing to `string[]`, blueprint template treats it
 * as string array directly. */
function tagsOf(n: Note): string[] {
  return n.tags as string[]
}

const filtered = computed<Note[]>(() => applyFilters(notes.value, { type: fType.value, status: fStatus.value }))
const drafts = computed<Note[]>(() => notes.value.filter((n) => n.status === 'draft'))
const counts = computed(() => ({
  draft: notes.value.filter((n) => n.status === 'draft').length,
  curated: notes.value.filter((n) => n.status === 'curated').length,
  archived: notes.value.filter((n) => n.status === 'archived').length,
}))

/** Deep link: `editingId` comes from `route.query.id`. Use computed to directly read
 * `route.query.id` (not read once in onMounted and store in local var) — `route` is
 * reactive, so user changing address bar `?id=` immediately reflects here (recall
 * `newui-router-query-only-no-remount`). */
const editingId = computed<string>(() => (route.query.id as string) || '')

/**
 * Blueprint `watch: { editingId(v) { if (!v) this.reload() } }`(:208-209, N30) —
 * only reload when `id` becomes empty (return from edit page to list), no reload when
 * switching to another non-empty id, use `:key="editingId"` in template to rebuild
 * `NoteEditPane`.
 */
watch(editingId, (v) => {
  if (!v) reload()
})

/**
 * 🔴 §5.2 stale guard (K15 family 8th instance) — `reload()` has 3 concurrent entry
 * points: setup top-level call (blueprint created) · `watch editingId` above · 5 actions
 * each call `reload()`. `epoch` declared inside `<script setup>` function body ==
 * component instance scope (each mount is new closure), not module-level — two component
 * instances each count independently, no cross-talk. Evidence: if we move `let reloadEpoch = 0`
 * to module top-level (shared across instances), when two instances interleave they discard
 * each other's responses as "stale", the "two instances interleave" test case in
 * `NotesView.test.ts` fails (see that file's RED probe record).
 */
let reloadEpoch = 0

async function reload(): Promise<void> {
  const epoch = ++reloadEpoch
  loading.value = true
  try {
    const list = await service.notes.list({ limit: 200 })
    // Stale: a later dispatch already moved reloadEpoch forward, this one is first-sent
    // but arrived-late — don't overwrite new data, also don't clear loading below (that's
    // the skeleton disappearing early bug).
    if (epoch !== reloadEpoch) return
    notes.value = list
    store.setNotesDraftCount(drafts.value.length)
  } catch {
    if (epoch !== reloadEpoch) return
    useToast().show(t('aiKbOpFailed'), 2400)
  }
  if (epoch === reloadEpoch) loading.value = false
}

// Blueprint created() (:212-216) equivalent — setup top-level call, one-time initial load
// + notes root directory probe.
reload()
service.notes
  .getSettings()
  .then((s) => {
    notesRoot.value = s.notesRoot
  })
  .catch(() => {
    // Blueprint :215 empty catch, original comment `keep placeholder`. K6: silent fallback,
    // don't even add `console.error`, copied verbatim.
  })

function openNotesFolder(): void {
  openDirInNewTab(notesRoot.value || '/DATA/Notes')
}

function startCreate(): void {
  router.push({ query: { id: 'new' } })
}

function edit(n: Note): void {
  router.push({ query: { id: n.id } })
}

async function curate(n: Note): Promise<void> {
  try {
    await service.notes.curate(n.id)
    useToast().show(t('aiKbNoteConfirmed'), 2400)
    reload()
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/** N31 copied — `Promise.all` concurrent confirm, no `finally`, reload() even on fail.
 * Partial success (e.g. 1 of 3 rejected by backend): `Promise.all` rejects as whole,
 * toast one failure, but subsequent `reload()` still refreshes the ones already curatedon backend — this is Vue2 current state, not reproducible buggy behavior, don't fix. */
async function confirmAll(): Promise<void> {
  const list = drafts.value
  bulkConfirming.value = true
  try {
    await Promise.all(list.map((d) => service.notes.curate(d.id)))
    useToast().show(t('aiKbNtNDraftsConfirmed', { n: list.length }), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
  bulkConfirming.value = false
  reload()
}

async function archive(n: Note): Promise<void> {
  try {
    await service.notes.archive(n.id)
    useToast().show(t('aiKbNtNoteArchived'), 2400)
    reload()
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

function archiveInsteadOfDelete(): void {
  const n = deleting.value
  deleting.value = null
  if (n) archive(n)
}

async function confirmDelete(): Promise<void> {
  try {
    // K34 family: blueprint `notesApi.remove(this.deleting.id)` has no null defense, per
    // "throw if we can" use non-null assertion (not `?.` / early return — that would
    // silently turn blueprint's implicit throw into no-op). Button only appears inside
    // delete dialog, `deleting` always non-null here.
    await service.notes.remove(deleting.value!.id)
    useToast().show(t('aiKbNtNoteDeleted'), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
  deleting.value = null
  reload()
}

/** K29 family (SettingsView.vue:349-355 established pattern) — reka's `DialogRoot` uses
 * `@update:open` to express "dialog was closed", blueprint's three close paths (× button
 * / cancel / click overlay) all converge to `deleting = null`. */
function onDeleteOpenChange(v: boolean): void {
  if (!v) deleting.value = null
}
</script>

<template>
  <div class="k-view">
    <NoteEditPane v-if="editingId" :key="editingId" :note-id="editingId" />
    <template v-else>
      <div class="k-scroll">
        <div class="k-scroll-inner kn-notes-col">
          <!-- Selling point: every note is a Markdown file on disk -->
          <div class="kn-pathstrip">
            <KIcon name="folder" :size="14" color="var(--text-tertiary)" />
            <span>
              {{ t('aiKbNtPathLead') }}
              <code>{{ notesRoot || '/DATA/Notes' }}/</code>
              — {{ t('aiKbNtPathTail') }}
            </span>
            <a @click.prevent="openNotesFolder">{{ t('aiKbNtOpenFolder') }} <KIcon name="chev" :size="10" /></a>
          </div>

          <!-- Loading skeleton -->
          <div v-if="loading && !notes.length" class="kn-list">
            <div v-for="i in 4" :key="i" class="kn-note-row" style="cursor: default">
              <div class="k-skel" style="width: 32px; height: 32px; border-radius: 9px" />
              <div style="display: flex; flex-direction: column; gap: 7px">
                <div class="k-skel" :style="{ width: (52 - i * 8) + '%', height: '13px' }" />
                <div class="k-skel" :style="{ width: (72 - i * 6) + '%', height: '11px' }" />
              </div>
              <div class="k-skel" style="width: 52px; height: 11px" />
            </div>
          </div>

          <!-- Empty state -->
          <div v-else-if="!notes.length" class="k-empty">
            <div class="k-empty-illust" style="display: grid; place-items: center">
              <KIcon name="edit" :size="34" color="var(--text-quaternary)" />
            </div>
            <div class="k-empty-title">{{ t('aiKbNtEmptyTitle') }}</div>
            <div class="k-empty-sub">{{ t('aiKbNtEmptySub') }}</div>
            <button class="k-btn primary" @click="startCreate"><KIcon name="plus" :size="13" /> {{ t('aiKbNtNewNote') }}</button>
          </div>

          <template v-else>
            <!-- Draft inbox -->
            <div v-if="drafts.length" class="kn-inbox" :data-open="String(inboxOpen)">
              <div class="kn-inbox-head" @click="inboxOpen = !inboxOpen">
                <div class="kn-inbox-icon"><KIcon name="sparkle" :size="17" /></div>
                <div style="flex: 1; min-width: 0">
                  <div class="kn-inbox-title"><b>{{ drafts.length }}</b> {{ t('aiKbNtInboxTitle') }}</div>
                  <div class="kn-inbox-sub">{{ t('aiKbNtInboxSub') }}</div>
                </div>
                <button class="k-btn primary" style="flex-shrink: 0" :disabled="bulkConfirming" @click.stop="confirmAll">
                  <KIcon name="check" :size="12" /> {{ t('aiKbNtConfirmAll') }} ({{ drafts.length }})
                </button>
                <span class="kn-inbox-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <template v-if="inboxOpen">
                <div class="kn-inbox-rows">
                  <div v-for="d in drafts" :key="d.id" class="kn-inbox-row">
                    <span class="kn-type-ic" :style="{ background: typeMeta(d.type).color, width: '30px', height: '30px' }">
                      <KIcon :name="typeMeta(d.type).icon" :size="13" stroke-width="2" />
                    </span>
                    <div class="kn-inbox-row-main" @click="edit(d)">
                      <div class="kn-inbox-row-title">{{ d.title }}</div>
                      <div class="kn-inbox-row-desc">{{ d.description }}</div>
                    </div>
                    <span class="kn-inbox-row-time">{{ timeAgo(d.updatedAt) }}</span>
                    <div class="kn-inbox-acts">
                      <button class="kn-act" data-tone="confirm" @click="curate(d)"><KIcon name="check" :size="11" /> {{ t('aiKbNtConfirm') }}</button>
                      <button class="kn-act" data-tone="danger" :title="t('aiKbNtDelete')" @click="deleting = d"><KIcon name="trash" :size="11" /></button>
                    </div>
                  </div>
                </div>
                <div class="kn-inbox-foot">
                  <span class="kn-inbox-foot-hint">{{ t('aiKbNtInboxFootHint') }}</span>
                  <button class="k-btn text" @click="fStatus = 'draft'">{{ t('aiKbNtReviewOneByOne') }} <KIcon name="chev" :size="11" /></button>
                </div>
              </template>
            </div>

            <!-- Toolbar: status pills + type select + new -->
            <div class="kn-toolbar">
              <button class="k-filter-pill" :data-on="String(fStatus === 'active')" @click="fStatus = 'active'">
                {{ t('aiKbAll') }}<span class="k-filter-pill-count">{{ counts.draft + counts.curated }}</span>
              </button>
              <button class="k-filter-pill" :data-on="String(fStatus === 'draft')" @click="fStatus = 'draft'">
                <KIcon name="sparkle" :size="11" />{{ t('aiKbAiDraft') }}
                <span
                  class="k-filter-pill-count"
                  :style="counts.draft ? { background: 'var(--warning-soft)', color: 'var(--warning)' } : null"
                >{{ counts.draft }}</span>
              </button>
              <button class="k-filter-pill" :data-on="String(fStatus === 'curated')" @click="fStatus = 'curated'">
                {{ t('aiKbCurated') }}<span class="k-filter-pill-count">{{ counts.curated }}</span>
              </button>
              <button class="k-filter-pill" :data-on="String(fStatus === 'archived')" @click="fStatus = 'archived'">
                {{ t('aiKbArchived') }}<span class="k-filter-pill-count">{{ counts.archived }}</span>
              </button>
              <select class="k-filt-select" v-model="fType" :title="t('aiKbColType')">
                <option value="">{{ t('aiKbNtAllTypes') }}</option>
                <option v-for="(m, k) in NOTE_TYPES" :key="k" :value="k">{{ t(m.labelKey) }}</option>
              </select>
              <span style="flex: 1" />
              <button class="k-btn primary" @click="startCreate"><KIcon name="plus" :size="13" /> {{ t('aiKbNtNewNote') }}</button>
            </div>

            <!-- List -->
            <div class="kn-list">
              <div v-if="!filtered.length" class="kn-empty-filtered">
                <KIcon name="funnel" :size="22" color="var(--text-quaternary)" />
                {{ t('aiKbNtNoMatch') }}
                <button class="k-btn outline" @click="fType = ''; fStatus = 'active'">{{ t('aiKbClearFilters') }}</button>
              </div>
              <template v-else>
                <div v-for="n in filtered" :key="n.id" class="kn-note-row" :data-s="n.status" @click="edit(n)">
                  <span class="kn-type-ic" :style="{ background: typeMeta(n.type).color, width: '32px', height: '32px' }">
                    <KIcon :name="typeMeta(n.type).icon" :size="14" stroke-width="2" />
                  </span>
                  <div class="kn-note-main">
                    <div class="kn-note-line1">
                      <span class="kn-note-title">{{ n.title }}</span>
                      <span v-if="n.status === 'draft'" class="kn-badge" data-s="draft"><KIcon name="sparkle" :size="9" /> {{ t('aiKbAiDraft') }}</span>
                      <span v-else-if="n.status === 'archived'" class="kn-badge" data-s="archived">{{ t('aiKbArchived') }}</span>
                    </div>
                    <div v-if="n.description" class="kn-note-desc">{{ n.description }}</div>
                    <div class="kn-note-meta">
                      <span>{{ t(typeMeta(n.type).labelKey) }}</span>
                      <span class="sep">·</span>
                      <span class="kn-src"><KIcon :name="sourceMeta(n.createdBy).icon" :size="11" />{{ t(sourceMeta(n.createdBy).labelKey) }}</span>
                      <span v-if="tagsOf(n).length" class="sep">·</span>
                      <span v-for="tg in tagsOf(n)" :key="tg" class="kn-tag">{{ tg }}</span>
                    </div>
                  </div>
                  <div class="kn-note-side" @click.stop>
                    <span class="kn-note-time">{{ timeAgo(n.updatedAt) }}</span>
                    <div class="kn-note-actions">
                      <button v-if="n.status === 'draft'" class="kn-act" data-tone="confirm" @click="curate(n)"><KIcon name="check" :size="11" /> {{ t('aiKbNtConfirm') }}</button>
                      <button v-if="n.status !== 'archived'" class="kn-act" @click="archive(n)">{{ t('aiKbNtArchive') }}</button>
                      <button class="kn-act" data-tone="danger" :title="t('aiKbNtDelete')" @click="deleting = n"><KIcon name="trash" :size="11" /></button>
                    </div>
                  </div>
                </div>
                <div class="kn-list-foot">
                  <KIcon name="layers" :size="12" />
                  {{ t('aiKbNtListFoot', { n: filtered.length }) }}
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>

      <!-- Delete confirm — reka Dialog primitive, portal to knowledge app container (see file header comment) -->
      <DialogRoot :open="!!deleting" @update:open="onDeleteOpenChange">
        <DialogPortal to=".knowledge-app" defer>
          <DialogOverlay class="k-modal-bg">
            <DialogContent v-if="deleting" class="k-modal" style="width: min(420px, 100%)" :aria-describedby="undefined">
              <div class="k-modal-head">
                <DialogTitle as-child>
                  <div class="k-modal-title">{{ t('aiKbNtDeleteTitle') }}</div>
                </DialogTitle>
                <button class="k-modal-x" @click="deleting = null"><KIcon name="x" :size="13" /></button>
              </div>
              <div class="k-modal-body">
                <div style="display: flex; gap: 10px; align-items: center">
                  <span class="kn-type-ic" :style="{ background: typeMeta(deleting.type).color, width: '32px', height: '32px' }">
                    <KIcon :name="typeMeta(deleting.type).icon" :size="14" stroke-width="2" />
                  </span>
                  <div style="min-width: 0">
                    <div style="font-size: 13.5px; font-weight: 600">{{ deleting.title }}</div>
                    <div v-if="deleting.path" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); margin-top: 2px; word-break: break-all">{{ deleting.path }}</div>
                  </div>
                </div>
                <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6; margin-top: 10px">
                  {{ t('aiKbNtDeleteBody1') }}
                  <b style="color: var(--danger)">{{ t('aiKbNtDeleteBody2') }}</b>
                  {{ t('aiKbNtDeleteBody3') }}
                </div>
              </div>
              <div class="k-modal-foot">
                <button class="k-btn ghost" @click="deleting = null">{{ t('aiKbCancel') }}</button>
                <button class="k-btn outline" @click="archiveInsteadOfDelete">{{ t('aiKbNtArchiveInstead') }}</button>
                <button class="k-btn danger" @click="confirmDelete"><KIcon name="trash" :size="12" /> {{ t('aiKbNtDelete') }}</button>
              </div>
            </DialogContent>
          </DialogOverlay>
        </DialogPortal>
      </DialogRoot>
    </template>
  </div>
</template>
