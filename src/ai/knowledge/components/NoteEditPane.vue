<!--
  SP8-P5d Task 7 —— `NoteEditPane.vue` **upper half** (top bar + draft banner + main-column editor).
  Ported 1:1 from the Vue2 blueprint `NimoOS-UI` (main@7a6ee6b7)
  `src/views/AI/Knowledge/NoteEditPane.vue` (338 lines, read via `git show 7a6ee6b7:`).

  🔴 [SCOPE BOUNDARY — plan doc §T7/§T8, T8 has since landed] T7 (everything above this section) wrote:
  top bar (:7-22) · draft banner (:25-32) · main column (:35-71: title/description
  inputs + kn-editor toolbar + rich/md dual mode + status bar). **T8 (this commit) filled in
  the 5 sidebar cards (:74-144) and the conflict modal
  (:148-180)** — spec in the new "═══ T8 ═══" section appended at the end of this file.
  T8 inserted `<div class="kn-edit-aside">` right before `.kn-edit`'s closing tag; the conflict modal
  (converted to reka `DialogRoot`, see the T8 section below) **preserves the blueprint's `:148` nesting verbatim** —
  it is a sibling node **after** `.k-scroll-inner`, inside `.k-scroll` (between the blueprint's two
  narrowing tags at `:146-147`), not a second template root. `DialogPortal to=".knowledge-app"`
  teleports the rendered output elsewhere **at runtime**, but that's reka's own behavior — it doesn't
  change the nesting in the **source**; this file has exactly one `<template>` root, `.k-scroll`,
  throughout.

  Structure mapping (blueprint line range → this file):
    :7-22    top bar (back to list / status badge / save hint / save button)
    :25-32   draft banner (N26 three-piece concatenation)
    :35-71   main column (title/description inputs · kn-editor toolbar's 8 kn-tb-btn ·
              k-seg dual-mode toggle · rich (NotesMarkdownEditor)/md (textarea) · status-bar word count)
    Corresponding script: props/data/isNew/status/wordCount/created()/onEditorReady/tbActive/
    cmd/save/curateInPlace, plus addTag()/openConflict(), which must be implemented for save() to work
    (see the "task division decision" section below).

  ═══ K41 type narrowing (governance §3 / this pass's DoD 1, registering "package-side type → this repo's narrowing + field basis") ═══
  The `Note` interface in `NimoOS-Service/src/notes.ts:21-34`:
    - `tags: unknown[]` → one-time `as string[]` on the consumer side (blueprint `:215` reads
      `[...this.note.tags]` and spreads it directly as a string array; this repo's `loadNote()`
      narrows at the same spot).
    - `body?: unknown` → one-time `as string | undefined` on the consumer side (blueprint `:214`
      reads `this.note.body || ''`, narrowed at the same spot).
    - `revision?: number` / `status?: string` / `type?: string` are optional.
      This pass uses a **non-null assertion `!`** in two spots (K34 family, precedent set by T6's
      `deleting.value!.id`) instead of adding a default value/defensive branch — the assertion is
      zero runtime behavior, it only silences the compiler, and matches Vue2's implicit assumption
      (which never validated anything) verbatim:
        · In `loadNote()`, `form.type = n.type!` (blueprint `:214` `type: this.note.type` has no
          fallback at all, assigns directly — when undefined, Vue2 also stuffs `undefined` into
          `form.type`; the non-null assertion doesn't change that fact, it just stops TS from
          erroring on assigning `string | undefined` to `string`).
        · In `save()`'s update branch, `expectedRevision: note.value.revision!`
          (blueprint `:285` `expectedRevision: this.note.revision`) — this branch only runs when
          `!isNew`, and by that point `note` must be the real object returned from
          `service.notes.get()` inside `loadNote()`, so `revision` is guaranteed to have a value
          at runtime.
      🔴 `as any` is forbidden; both spots above are **type-level** moves — zero runtime validation,
      zero behavior change — which fits K41's boundary ("if it needs runtime validation to be safe,
      it isn't K41"; neither spot needs runtime validation, so both stay K41).
      ⚠️ `status` is only ever read through a `computed` (never assigned into a stricter type), so
      it needs no assertion.
      ⚠️ The type narrowing for `sourceRefs`/`backlinks` (the local `SourceRef`/`Backlink` interfaces)
      is the **other half** of K41. It didn't exist yet at T7 commit time — **T8 (this commit) has
      filled it in** — see the new "═══ T8 · K41 other half ═══" section appended at the end of
      this file; field basis cites blueprint `:128`/`:131`/`:132`/`:139`/`:141`.

  ═══ N29 (the line in this pass most likely to get "cleaned up" by mistake — do not delete it) ═══
  `tbTick.value >= 0 &&` in `tbActive()` is a **deliberate fake dependency** (blueprint `:228`'s
  comment verbatim: "tbTick makes this computed-on-demand check re-run on every transaction") —
  Vue3's render effect genuinely reads `tbTick.value` when this evaluates, which records the ref
  as a dependency; every time `@transaction="tbTick++"` fires, this method re-evaluates, and that's
  what keeps the toolbar's `data-on` highlight in sync with the editor's selection/format state.
  Delete this half-clause and the toolbar's highlight state will never update after toggling
  bold/heading/etc.
  🔴 **Ruling R5**: the tiptap testability probe in Appendix D §D.6.1 **doesn't mount the parent
  component** (it only mounts the `NotesMarkdownEditor` editor SFC itself), so the causal chain
  "deleting `tbTick.value >= 0 &&` breaks the toolbar's `data-on` refresh" was **never actually
  proven** at the T0 stage. This pass may not cite §D.6.1 as proof — it must mount `NoteEditPane`
  itself (with the real `NotesMarkdownEditor`) and attach mutation evidence — see the corresponding
  describe block in `NoteEditPane.test.ts` and the task report's §Mutation Evidence.

  ═══ K5/K30 (don't echo the backend's e.message) ═══
  All 6 blueprint catch blocks (`created`/`copyPath`/`curateInPlace`/`save`/`openConflict`/
  `copyMine` — the latter two copy* belong to T8) are `$t('Operation failed') + ': ' + (e.message
  || e)`. Following the established mold in this repo (P2a/P2b/P5b K19/P5c K30/P5d T6 K5), we only
  pop the fixed string `aiKbOpFailed` and never echo the backend message — **this is a deliberate
  deviation, explicitly declared**. Assertions use the exclusion form: the toast text must
  **not contain** any backend error string.

  ═══ N27 (four-way ternary chain, copy verbatim, don't rewrite) ═══
  The blueprint's `:17` four-way ternary chain (`saving ? Saving… : dirty ? Unsaved changes :
  isNew ? Not saved yet : Saved · rev {n}`) is written directly in the template, not pulled out into
  a computed lookup table (that would turn "which branch matched" from a readable ternary chain into
  an object lookup — exactly the kind of unrelated refactor N17/N27 explicitly forbid). All four
  branches have corresponding test cases.

  ═══ N26 (three-piece concatenation, copy verbatim, don't rewrite) ═══
  The blueprint's `:28` draft banner is three independent keys with the middle one bolded
  (`aiKbNeDraftBar1` <b>`aiKbNeDraftBar2`</b>`aiKbNeDraftBar3`) — not merged into a single
  HTML-bearing key (that would require v-html), and not using i18n slot syntax (the blueprint
  doesn't use it either).

  ═══ N28 (wordCount regex, copy verbatim, don't rewrite) ═══
  The blueprint's `:207` regex `/[#|\-*`>\s]/g` is copied as-is: it strips every
  `#`/`|`/`-`/`*`/backtick/`>`/whitespace before counting length — this isn't a true "word count",
  and it is not "fixed" into a markdown-aware count.

  ═══ Attribute-state String() copied verbatim (P5b E-9 ruling, don't rewrite) ═══
  `data-on` (8 kn-tb-btn buttons + 2 k-seg buttons) and `data-dirty` are all wrapped in `String(...)`
  (blueprint `:15/43/44/45/47/48/50/51/52/55/56`) — wrapping it or not renders identically, so
  rewriting it is an unrelated refactor. Tests assert `toBe('true')`/`toBe('false')`, not
  `toBeUndefined()`.

  ═══ §5.2 stale guard (K15 family, 9th occurrence in this pass) ═══
  `loadNote()` (the equivalent of the blueprint's created()) fires two requests (`get` +
  `backlinks`) and uses a component-local (NOT module-level!) `let loadEpoch` to decide "am I still
  the latest fire?". `:key="editingId"` (parent component NotesView.vue:290) rebuilds the entire
  `NoteEditPane` instance on note switch, which makes the "two instances interleaving" scenario
  unusually real in this component (an old instance can still be wrapping up a late response while
  a new instance has already fired its own first request). Criterion: moving `loadEpoch` to module
  level must make the "two instances interleaving" test case fail red.

  ═══ Task-division decisions (two spots requiring declaration, brief §"places where you must judge and declare") ═══
  ① `addTag()` (blueprint `:238-243`) — the brief explicitly calls out that `save()` calls it at the
     start (blueprint `:273`); the UI (tag input/focus/delete) belongs to T8, but the brief requires
     "a minimally usable addTag (enough for save()'s behavior to hold)". **This pass's choice:
     implement the full body of addTag() (not a minimal stub), because it's pure logic (reads the
     tagInput ref, writes the form.tags array, dedupes via parseTags) with no dependency on any DOM
     ref or method that only exists once T8 lands. T8 only needs to add the tag-input template in
     the sidebar (:120-121, `v-model="tagInput"` / `@blur="addTag"`) — it doesn't need to touch this
     function's body.**
  ② `openConflict()` (blueprint `:302-309`) — the brief §3 "don't write" list assigns it to T8's
     script list, but the plan doc's T7 DoD item 9 explicitly requires that `save()`'s catch branch
     "conflictMessage(e) && !isNew → openConflict() ... this pass only needs to get as far as
     'conflict state being set'". These two statements don't literally line up: if `openConflict`
     doesn't exist at all, `save()` cannot reach the observable result "conflict state being set".
     **This pass's judgment: `openConflict()` belongs to the same family as `addTag()` — it's pure
     data fetch + state setting (re-`get()` the note, set the `conflict` ref to
     `{latest, baseRevision}`), with zero DOM/UI dependency, following exactly the same pattern as
     "fetching backlinks is this pass's job, rendering the card is T8's job" (governance §4.1,
     explicit). This pass therefore fully implements openConflict(); T8 only needs to consume the
     already-existing `conflict` state in the conflict-modal template and wire up the three buttons
     (adoptDisk/keepMine/copyMine, T8 DoD 5). If the coordinator judges this call to be wrong,
     moving/deleting `openConflict()` is a boundary T8 can adjust at low cost — it isn't depended on
     by any of T7's own assertions, only covered by one save() test case for "conflict state being
     set", which asserts the value of `conflict`, not this function's name.**

  ═══ Data contract (mock layering, governance §4.1 / p5d-fixtures/README.md §2) ═══
  `service.notes.get(id)` returns an **already-normalized single Note** (camelCase).
  `service.notes.backlinks(id)` returns an **array**, `[]` when empty (not a `{backlinks:[]}`
  envelope, `notes.ts:247-250`) — T7's `loadNote()` fires it and stores it into the `backlinks` ref
  (keeping the package's original `unknown[]`; **T8 in this pass makes zero changes to that ref's
  declaration**). T8 adds read-only computeds `sourceRefs`/`backlinkList` at the end of the file
  for K41's other-half type-narrowing consumption, without rewriting `backlinks` itself or adding
  any runtime validation.
  `service.notes.create`/`update`/`curate` return a **single Note** (camelCase).

  ═══ Gap ③ (template has zero raw colors) ═══
  T7's template section (:7-71) has zero inline color literals. **The single inline color is in
  the blueprint at `:152` (the conflict modal's header-icon background color; Appendix B §B.4
  line 35 is the authoritative mapping) — T8 (this commit) has already switched it to
  `var(--warning-soft)`**, see the conflict-modal template at the end of the file.
  `components/NoteEditPane.vue` was already added to the `KNOWLEDGE_VUE_FILES` set in
  `../../styles/knowledgeStyles.test.ts` back in T7 (that file's "guard gap ③′" greedily extracts
  the whole `<template>` block and runs a text-level regex scan over it, which naturally covers
  the template T8 just added), so no duplicate targeted assertion is needed.

  ═══ Locator strategy (brief §4 — T8 will insert content into this file, so locators need to be pinned down) ═══
  Every test locator in this pass is based on a **structurally-unique class combination or
  parent/child chain**, never on the implicit assumption "there's currently only one X in the file":
    · `.kn-edit-top` / `.kn-draftbar` / `.kn-edit-main` are each unique top-level block class names
      (T8's inserted `.kn-edit-aside` is a fourth sibling and won't create ambiguity with the first
      three's selectors);
    · Toolbar buttons uniformly use `.kn-editor-toolbar .kn-tb-btn` (scoped to the toolbar container,
      never bare `.kn-tb-btn`, to guard against T8 later introducing an element with the same class
      elsewhere and mismatching);
    · The `.k-seg` mode-toggle buttons use `.kn-editor-toolbar .k-seg button` (same scoping);
    · The rich/md containers use `.kn-editor-body-wrap` (rich) and `.kn-editor-src`
      (md — the textarea's own class name is unique) respectively — the two are mutually exclusive
      via v-if/v-else, never present at the same time;
    · The top-bar save button uses `.kn-edit-top .k-btn.primary` (scoped to the top bar; the conflict
      modal's `.k-btn.primary` — added by T8 — lives on a completely different branch of the DOM
      tree and won't be matched by this scoped selector).
  This way, even after T8 inserts `.kn-edit-aside` into `.kn-edit` (containing its own `.k-btn`/
  `.kn-aside-*` etc.) and appends the conflict modal after the template root, none of this pass's
  locators will end up pointing at the wrong element, and T8 doesn't need to touch any assertion
  written in this pass.

  ═══════════════════════════════════════════════════════════════════════
  ═══ T8 — lower half (5 sidebar cards + tag editing + conflict modal), brief/plan doc §T8 ═══
  ═══════════════════════════════════════════════════════════════════════

  Structure mapping (blueprint line range → this file, new in this section):
    :74-90    Status card (isNew: hint text; !isNew: three-state badge + source + last modified)
    :91-108   File-on-disk card (isNew: hint text; !isNew: path + hint + file manager/copy path)
    :110-123  Properties card (type dropdown + tag editing: chip / delete / keyboard event / commit on blur)
    :125-135  Sources card (v-if !isNew && sourceRefs.length)
    :137-143  Referenced-by card (v-if !isNew && backlinkList.length)
    :148-180  Conflict modal (converted to reka DialogRoot, see the K36 section below)
  Corresponding script (new in this pass): `sourceRefs`/`backlinkList` (K41 other half) /
  `focusTagInput`/`removeTag`/`onTagKey`/`refLabel`/`openRef`/`openSessionRef`/
  `revealFile`/`copyPath`/`copyMine`/`adoptDisk`/`keepMine`/`onConflictOpenChange`.
  🔴 **`addTag()`/`openConflict()` already landed in T7 (coordinator ruling R16 ratified this,
  brief §2); this pass does not re-implement them** — only wired up in the template (tag input's
  `@blur="addTag"`; the conflict modal's three buttons consuming the existing `conflict` state).

  ═══ K41 other half (DoD-1, `as any` forbidden) ═══
  Both `Note.sourceRefs` (`NimoOS-Service/src/notes.ts:28`) and
  `service.notes.backlinks()` (`:247-250`) return `unknown[]`. Local interfaces:
    interface SourceRef { path?: string; session_id?: string; label?: string }
    interface Backlink { id: string; title: string }
  Field basis (cited line-by-line against the blueprint): `:128` reads `r.path` · `:131` reads
  `r.session_id` · `:132` reads `r.label` via `refLabel(r)` · `:139` reads `b.id`
  (`:key="b.id"`) · `:141` reads `b.title`.
  Consumption technique: `sourceRefs` is a new computed
  (`(note.value.sourceRefs as SourceRef[] | undefined) || []` — the blueprint's own `:206`
  computed is also `this.note.sourceRefs || []`; the `|| []` is a 1:1 preserved blueprint
  defensive idiom, not new runtime validation added by this pass); `backlinkList` is a new
  computed (`backlinks.value as Backlink[]`, **T7's `backlinks` ref declaration left untouched**).
  Both spots are one-time type-level re-assertions — zero runtime validation, zero behavior
  change — and fit within K41's boundary ("if it needs runtime validation to be safe, it isn't
  K41" doesn't apply to either of these).

  ═══ refLabel(r) (DoD-9, needs a test case for all three inputs) ═══
  Blueprint `:255`: `r.label || String(r.session_id || '').slice(0, 8)` — three tiers:
  ① has `label`, use it directly; ② no `label` but has `session_id`, take the first 8 chars;
  ③ neither present, `String(undefined || '').slice(0, 8)` = `''`.

  ═══ The conflict modal's three actions (DoD-5, `dirty`'s value must be asserted in every case) ═══
  Copied verbatim in semantics from blueprint `:316-323` (`adoptDisk`) / `:324-331` (`keepMine`) /
  `:310-315` (`copyMine`):
    · `adoptDisk()`: `note = latest` + `form.body = latest.body || ''` (the same `unknown → string`
      narrowing idiom used by K41's family, same technique as `loadNote()`) +
      `conflict = null` + **`dirty = true`**.
    · `keepMine()`: blueprint `:325`'s comment verbatim, "Rebase onto the disk revision so the
      next save overwrites it" — **only rebases the revision**
      (`note = {...note, revision: rev}`), **leaves body untouched**, `conflict = null`,
      **`dirty = true`**, toast carries `{n: rev}`.
    · `copyMine()`: `navigator.clipboard.writeText(form.body || '')`, on success toasts
      `aiKbNeDraftCopied`.
  All three access `conflict.value!` with a non-null assertion internally (K34 family, precedent
  set by T6/T7) — they can only ever be clicked while the conflict modal is rendered
  (`v-if="conflict"`), at which point `conflict.value` is guaranteed non-null, matching the
  blueprint's zero-defense implicit assumption of `this.conflict.latest` verbatim.

  ═══ 🔴 `navigator.clipboard` doesn't exist under HTTP-IP (governance §9.9, memory
      `newui-clipboard-insecure-reka`) ═══
  `copyPath()`/`copyMine()`'s `navigator.clipboard.writeText(...)` — under this repo's real-device
  HTTP-IP access, `navigator.clipboard` is `undefined`, the call throws a synchronous `TypeError`,
  which falls into each function's own `catch` and pops `aiKbOpFailed`. **This is blueprint
  behavior** (blueprint `:259-264`/`:310-315` also have only a bare try/catch, zero `execCommand`
  fallback) — copied as-is per the N series; it is **forbidden** to opportunistically add this
  repo's Files-area `execCommand` fallback (that's an existing Files-area enhancement, not
  blueprint behavior for the notes area). **Front-end ticket (logged, handed to P5e/P5f)**:
  "The notes area's `copyPath`/`copyMine` should reuse this repo's existing Files-area
  `execCommand` fallback, so copy actually succeeds under HTTP access instead of popping
  'Operation failed'." The acceptance checklist needs to explicitly state: "these two buttons
  popping 'Operation failed' under HTTP access = expected, not a defect."

  ═══ 🔴 Converting the conflict modal to reka (DoD-7, K7/K29/K36 family, aligned with
      `SettingsView.vue` rather than `QueueView.vue`) ═══
  The blueprint's `:149` is a bare `.k-modal-bg` + `@click`/`@click.stop`. T6's delete-confirmation
  modal (`NotesView.vue:418-452`) already converted and got approved against the precedent set by
  `SettingsView.vue:349-624` — **this modal's blueprint `:155` already has a visible title
  `.k-modal-title`**, so K36's established choice is to wrap `<DialogTitle as-child>` directly
  around that div, without inserting an extra hidden `VisuallyHidden` node (that's the other
  precedent, used by `IndexedFilesView.vue` when there's no visible title — it doesn't apply to
  this modal). `DialogPortal to=".knowledge-app" defer`, structure copied from `NotesView.vue:418-
  452`: `DialogRoot :open="!!conflict" @update:open="onConflictOpenChange"`,
  `onConflictOpenChange(v) { if (!v) conflict.value = null }` (K29 family — the blueprint only has
  two close paths, "click the overlay" and "click ×", with no separate "Cancel" button, both
  converge into this one line). K36's standing a11y assertions (`aria-labelledby` matching
  `.k-modal-title`'s `id`, same value same element + exactly one element with an `id` inside the
  modal) are in `NoteEditPane.test.ts`; mutation evidence is in the task report.

  ═══ §9.9 clickability (DoD-8, needs a test case for both sides of every condition) ═══
  The sources card is `v-if="!isNew && sourceRefs.length"`; the referenced-by card is
  `v-if="!isNew && backlinkList.length"`; the file-on-disk card's `<template v-else>`
  (i.e. `!isNew`). 🔴 **Real-device fixture testing (README §4)**: on this machine all 23 notes'
  `source_refs` are non-empty (every `pipeline`-sourced note carries `[{session_id}]`) → the
  sources card **does** render on the real device (governance's original guess that "hand-written
  notes usually have zero source_refs" doesn't hold on this machine); the `backlinks` endpoint is
  permanently `[]` on this machine → the referenced-by card does **not** render on the real device,
  so the "has entries" side of that condition can only be covered by a mock assertion.

  ═══ Locator hardening (DoD-11, a latent fragility flagged by T7 review) ═══
  T7's review already flagged this: the two existing assertions on `.kn-badge[data-s="draft"]`/
  `[data-s="archived"]`, once this pass inserts the status card (blueprint `:82-84`, structurally
  and textually identical to the top bar's `:12-13`), will have `.find()` degrade from "matches
  exactly one" to "matches two, and `.find()` happens to still grab the first one in document
  order, which is the top-bar one" — the test still passes green, but its discriminating power has
  degraded from "asserts against a determined element" to "asserts against the first element in
  document order that happens to have the same value." Per brief §3's requirement, these two
  assertions are **hardened** (pinned to the `.kn-edit-top` ancestor, no longer relying on document
  order); this counts as a "forced change," logged in the task report's "T7 left untouched except
  for N spots" section, with before/after hardening evidence attached. Apart from these 2 spots,
  every other assertion T7 wrote in `NoteEditPane.test.ts` is left untouched by this pass (this
  pass only adds new describe blocks — zero deletions, zero modifications inside existing describe
  blocks).
-->
<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import type { Editor } from '@tiptap/vue-3'
import { service } from '@nimotech/nimoos-service'
import type { Note } from '@nimotech/nimoos-service'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useToast } from '../../../stores/toast'
import KIcon from '../components/KIcon.vue'
import NotesMarkdownEditor from './NotesMarkdownEditor.vue'
import { parseTags, conflictMessage } from '../util/noteEditHelpers'
import { NOTE_TYPES, noteSourceMeta, relativeTime } from '../util/notesViewHelpers'
import { openFileInNewTab, openAgentSessionInNewTab } from '../../services/openInApp'

const props = defineProps<{ noteId: string }>()

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

/** Blueprint `methods: { sourceMeta: noteSourceMeta, timeAgo: relativeTime }`
 * (`:224-225`)—alias technique matches `NotesView.vue:108-109` template,
 * keeps blueprint's call names `sourceMeta(...)`/`timeAgo(...)` in template. */
const sourceMeta = noteSourceMeta
const timeAgo = relativeTime

const isNew = computed<boolean>(() => props.noteId === 'new')

/**
 * Blueprint `data() { note: {} }`(:198)—initial empty object not `null`,
 * aligns with Vue2 property access returning `undefined`(not throwing) when field missing;
 * using `null` would require optional chains throughout, unrelated rewrite this pass skips.
 * Never read when `isNew`, `!isNew` branch before covered by real data in `loadNote()`
 * won't trigger display layer dependency.
 */
const note = ref<Note>({} as Note)
/** K41 — `service.notes.backlinks()` returns `unknown[]`(governance §4.1). T7 only
 * fetches and stores in `loadNote()`, ref declaration itself **unchanged**;
 * T8 adds `backlinkList` computed below for K41 other half type narrowing consumption(card render),
 * doesn't rewrite this ref. */
const backlinks = ref<unknown[]>([])

const saving = ref(false)
const tagInput = ref('')
/** Blueprint `ref="tagInput"` (`:120`) — Vue3 template ref, consumed by `focusTagInput()`
 * (blueprint `:237` `this.$refs.tagInput`). */
const tagInputEl = ref<HTMLInputElement | null>(null)
const mode = ref<'rich' | 'md'>('rich')
const dirty = ref(false)
/** Conflict state (blueprint `:199` `conflict: null`, `:304-305` the assignment shape).
 * `baseRevision` keeps the same `number | undefined` as `Note.revision` (K41: revision is
 * itself optional) — the fallback display when rendering the conflict modal is T8's concern,
 * this pass doesn't narrow it any further. */
const conflict = ref<{ latest: Note; baseRevision: number | undefined } | null>(null)
const editor = ref<Editor>()
const tbTick = ref(0)

const form = reactive({
  title: '',
  description: '',
  type: 'note',
  body: '',
  tags: [] as string[],
})

const status = computed<string | null | undefined>(() => (isNew.value ? null : note.value.status))

/** N28 — blueprint `:207` regex copy as-is, doesn't "fix" to markdown-aware counting. */
const wordCount = computed<number>(() => (form.body || '').replace(/[#|\-*`>\s]/g, '').length)

/**
 * K41 other half (complete registration in file header「═══ T8 ═══」section).
 * Field basis: blueprint `:128` reads `r.path`, `:131` reads `r.session_id`,
 * `:132` via `refLabel(r)` reads `r.label`.
 */
interface SourceRef {
  path?: string
  session_id?: string
  label?: string
}
/** Blueprint `:206` `sourceRefs() { return this.note.sourceRefs || [] }` copied exactly
 * (with `|| []` defensive guard; when note initially `{}`, runtime `sourceRefs` is truly `undefined`,
 * even though package `Note.sourceRefs` type is required `unknown[]`). */
const sourceRefs = computed<SourceRef[]>(() => (note.value.sourceRefs as SourceRef[] | undefined) || [])

/**
 * K41 other half. Field basis: blueprint `:139` reads `b.id`(`:key="b.id"`),
 * `:141` reads `b.title`. `backlinks` ref keeps T7's declared `unknown[]`,
 * here only one-time consumer-side re-assertion, doesn't rewrite ref.
 */
interface Backlink {
  id: string
  title: string
}
const backlinkList = computed<Backlink[]>(() => backlinks.value as Backlink[])

function onEditorReady(ed: Editor): void {
  editor.value = ed
}

/**
 * N29 — `tbTick.value >= 0 &&` is intentional fake dependency, must not delete(see file header comment).
 * `!!(...)` only narrows final return to strict `boolean`(TS function signature requires),
 * doesn't change short-circuit order or observable behavior(blueprint raw form evaluates to `null`
 * when `editor` empty, becomes `"null"` via `String(null)`; but this state only exists in
 * that one sync render before `onEditorReady` fires, at any observation point after `nextTick`/`flushPromises`
 * already covered by reactive re-render to real boolean, equals Vue2 actual observable behavior).
 */
function tbActive(name: string, attrs?: Record<string, unknown>): boolean {
  return !!(tbTick.value >= 0 && editor.value && editor.value.isActive(name, attrs))
}

/**
 * Blueprint `:231-236`: `chain[name](arg).run()` dispatches by string to
 * some `ChainedCommands` method. `@tiptap/core`'s `ChainedCommands` interface lacks
 * index signature, direct string subscript access not valid in `strict` mode —
 * use `as unknown as Record<...>` for one structural re-assertion(not `as any`),
 * only affects type visibility of this dynamic call, doesn't change runtime behavior.
 */
function cmd(name: string, arg?: Record<string, unknown>): void {
  if (!editor.value) return
  const chain = editor.value.chain().focus() as unknown as Record<
    string,
    (a?: Record<string, unknown>) => { run: () => void }
  >
  chain[name](arg).run()
  dirty.value = true
}

/**
 * Blueprint `:238-243`. This pass implements body(see file header "task division decision" ①)—
 * called at start of `save()`(blueprint `:273`), behavior must hold: append deduplicated
 * to `form.tags`, set `dirty = true` only if actually appended. UI(tag input/delete button/keyboard event) goes to T8.
 */
function addTag(): void {
  const parsed = parseTags(tagInput.value)
  const fresh = parsed.filter((tg) => !form.tags.includes(tg))
  if (fresh.length) {
    form.tags.push(...fresh)
    dirty.value = true
  }
  tagInput.value = ''
}

/** Blueprint `:237`: `if (this.$refs.tagInput) this.$refs.tagInput.focus()`
 * —Vue3 template ref is `HTMLInputElement | null`, optional chaining equivalent rewrite. */
function focusTagInput(): void {
  tagInputEl.value?.focus()
}

/** Blueprint `:244-247`. */
function removeTag(tg: string): void {
  form.tags = form.tags.filter((x) => x !== tg)
  dirty.value = true
}

/**
 * Blueprint `:248-254`(DoD-3, three branches + one counter-example): `Enter`/`,` → prevent default +
 * `addTag()`; `Backspace` **and input empty and tags exist** → pop last one +
 * `dirty = true`. `Backspace` but input non-empty → neither branch holds, do nothing
 * (counter-example, don't pop tag).
 */
function onTagKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  }
  if (e.key === 'Backspace' && !tagInput.value && form.tags.length) {
    form.tags = form.tags.slice(0, -1)
    dirty.value = true
  }
}

/** Blueprint `:255`(DoD-9, all three input types need test cases). */
function refLabel(r: SourceRef): string {
  return r.label || String(r.session_id || '').slice(0, 8)
}

/** Blueprint `:256`. */
function openRef(s: SourceRef): void {
  if (s.path) openFileInNewTab(s.path)
}

/** Blueprint `:257`. */
function openSessionRef(r: SourceRef): void {
  openAgentSessionInNewTab(r.session_id)
}

/** Blueprint `:258`. */
function revealFile(): void {
  if (note.value.path) openFileInNewTab(note.value.path)
}

/**
 * Blueprint `:259-264`. RED `navigator.clipboard` unavailable under HTTP-IP(see file header
 * 「═══ T8 ═══」section clipboard clause)—real device goes to catch, N series copy as-is.
 */
async function copyPath(): Promise<void> {
  try {
    await navigator.clipboard.writeText(note.value.path || '')
    useToast().show(t('aiKbNePathCopied'), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * Blueprint `:265-271`. K5: don't echo `e.message`, unified `aiKbOpFailed`.
 */
async function curateInPlace(): Promise<void> {
  try {
    note.value = await service.notes.curate(props.noteId)
    useToast().show(t('aiKbNoteConfirmed'), 2400)
    store.refreshNotesDraftCount()
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * Blueprint `:302-309`. See file header "task division decision" ②:
 * this pass implements body so `save()` catch branch achieves "conflict state being set"
 * observable result. Pure data fetch + state setting, zero UI dependency.
 */
async function openConflict(): Promise<void> {
  try {
    const latest = await service.notes.get(props.noteId)
    conflict.value = { latest, baseRevision: note.value.revision }
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * Blueprint `:310-315`. RED clipboard see file header「═══ T8 ═══」section,
 * real device under HTTP-IP goes to catch, N series copy as-is.
 */
async function copyMine(): Promise<void> {
  try {
    await navigator.clipboard.writeText(form.body || '')
    useToast().show(t('aiKbNeDraftCopied'), 2400)
  } catch {
    useToast().show(t('aiKbOpFailed'), 2400)
  }
}

/**
 * Blueprint `:316-323`. Only clickable during conflict modal render(`v-if="conflict"`),
 * `conflict.value!` non-null assertion exactly matches blueprint `this.conflict.latest`
 * zero defensive(K34 family). `form.body` `unknown → string` narrowing matches `loadNote()`.
 */
function adoptDisk(): void {
  const latest = conflict.value!.latest
  note.value = latest
  form.body = (latest.body as string | undefined) || ''
  conflict.value = null
  dirty.value = true
  useToast().show(t('aiKbNeAdoptedDisk'), 2400)
}

/**
 * Blueprint `:324-331`, comment original「Rebase onto the disk revision so the next save
 * overwrites it」—only rebase revision, **body unchanged**.
 */
function keepMine(): void {
  const rev = conflict.value!.latest.revision
  note.value = { ...note.value, revision: rev }
  conflict.value = null
  dirty.value = true
  useToast().show(t('aiKbNeKeptMine', { n: rev }), 2400)
}

/** K29 family(`NotesView.vue` delete modal / `SettingsView.vue:349-355` established approach)—
 * reka `DialogRoot` `@update:open` expresses "modal closed", blueprint's two close paths
 * (click × / click overlay, blueprint has no separate "cancel" button) both converge to `conflict = null`. */
function onConflictOpenChange(v: boolean): void {
  if (!v) conflict.value = null
}

/**
 * Blueprint `:272-301`. Two paths: `isNew` → `create` + route with `?id=`;
 * otherwise → `update`(`expectedRevision` uses K41 non-null assertion, see file header).
 * Catch branch: 409 and not new → `openConflict()`;  otherwise K5 fixed text.
 * `addTag()` called at very start(blueprint `:273`)—unprompted tags in input also saved.
 */
async function save(): Promise<void> {
  addTag()
  saving.value = true
  try {
    if (isNew.value) {
      const n = await service.notes.create({
        title: form.title,
        content: form.body,
        noteType: form.type,
        tags: form.tags,
        description: form.description,
      })
      dirty.value = false
      router.push('/ai/knowledge/notes?id=' + n.id)
    } else {
      note.value = await service.notes.update(props.noteId, {
        expectedRevision: note.value.revision!,
        content: form.body,
        title: form.title,
        tags: form.tags,
        description: form.description,
      })
      dirty.value = false
    }
    useToast().show(t('aiKbNeSaved'), 2400)
  } catch (e) {
    if (conflictMessage(e as Parameters<typeof conflictMessage>[0]) && !isNew.value) {
      await openConflict()
    } else {
      useToast().show(t('aiKbOpFailed'), 2400)
    }
  } finally {
    saving.value = false
  }
}

/**
 * Equivalent of blueprint `created()`(:209-222) — §5.2 stale guard(this pass 9th),
 * `loadEpoch` declared in `<script setup>` function body scope(component instance, not module),
 * criterion: move to module level "two instance interleaving" case must fail red(see NoteEditPane.test.ts).
 * Two requests(`get` + `backlinks`) in same try, matches blueprint —
 * if `backlinks()` fails, even successful `get()` goes to same catch(blueprint behavior, not split
 * into two independent try).
 */
let loadEpoch = 0

async function loadNote(): Promise<void> {
  const epoch = ++loadEpoch
  try {
    const n = await service.notes.get(props.noteId)
    if (epoch !== loadEpoch) return
    note.value = n
    form.title = n.title
    form.description = n.description
    form.type = n.type!
    form.body = ((n.body as string | undefined) || '')
    form.tags = [...(n.tags as string[])]

    const bl = await service.notes.backlinks(props.noteId)
    if (epoch !== loadEpoch) return
    backlinks.value = bl
  } catch {
    if (epoch !== loadEpoch) return
    useToast().show(t('aiKbOpFailed'), 2400)
    router.push('/ai/knowledge/notes')
  }
}

if (!isNew.value) loadNote()
</script>

<template>
  <div class="k-scroll">
    <div class="k-scroll-inner">
      <div class="kn-edit">
        <!-- top bar -->
        <div class="kn-edit-top">
          <button class="k-btn outline" @click="router.push('/ai/knowledge/notes')">
            <span style="transform: scaleX(-1); display: inline-flex"><KIcon name="chev" :size="12" /></span>
            {{ t('aiKbNeBackToList') }}
          </button>
          <span v-if="status === 'draft'" class="kn-badge" data-s="draft"><KIcon name="sparkle" :size="9" /> {{ t('aiKbAiDraft') }}</span>
          <span v-else-if="status === 'archived'" class="kn-badge" data-s="archived">{{ t('aiKbArchived') }}</span>
          <span class="spacer" />
          <span class="kn-savehint" :data-dirty="String(dirty)">
            <span class="dot" />
            {{ saving ? t('aiKbNeSaving') : dirty ? t('aiKbNeUnsaved') : isNew ? t('aiKbNeNotSavedYet') : t('aiKbNeSavedRev', { n: note.revision }) }}
          </span>
          <button class="k-btn primary" :disabled="saving || (isNew && !form.title.trim())" @click="save">
            <KIcon name="check" :size="12" /> {{ saving ? t('aiKbNeSaving') : t('aiKbNeSave') }}
          </button>
        </div>

        <!-- draft banner: confirm in place -->
        <div v-if="status === 'draft'" class="kn-draftbar">
          <KIcon name="sparkle" :size="16" color="var(--warning)" />
          <div class="kn-draftbar-txt">
            {{ t('aiKbNeDraftBar1') }} <b>{{ t('aiKbNeDraftBar2') }}</b>{{ t('aiKbNeDraftBar3') }}
            <div class="kn-draftbar-sub">{{ t('aiKbNeDraftBarSub') }}</div>
          </div>
          <button class="k-btn primary" @click="curateInPlace"><KIcon name="check" :size="12" /> {{ t('aiKbNeConfirmAsCurated') }}</button>
        </div>

        <!-- main column -->
        <div class="kn-edit-main">
          <div>
            <input class="kn-title-input" v-model="form.title" :placeholder="t('aiKbNeTitlePlaceholder')" @input="dirty = true" />
            <input class="kn-desc-input" v-model="form.description" :placeholder="t('aiKbNeDescPlaceholder')" @input="dirty = true" />
          </div>

          <div class="kn-editor">
            <div class="kn-editor-toolbar">
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('bold'))" :title="t('aiKbNeBold')" @click="cmd('toggleBold')"><b>B</b></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('italic'))" :title="t('aiKbNeItalic')" @click="cmd('toggleItalic')"><i style="font-family: serif">I</i></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('strike'))" :title="t('aiKbNeStrike')" @click="cmd('toggleStrike')"><s>S</s></button>
              <span class="kn-tb-sep" />
              <button class="kn-tb-btn wide" :disabled="mode !== 'rich'" :data-on="String(tbActive('heading', { level: 2 }))" :title="t('aiKbNeH2')" @click="cmd('toggleHeading', { level: 2 })">H2</button>
              <button class="kn-tb-btn wide" :disabled="mode !== 'rich'" :data-on="String(tbActive('heading', { level: 3 }))" :title="t('aiKbNeH3')" @click="cmd('toggleHeading', { level: 3 })">H3</button>
              <span class="kn-tb-sep" />
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('bulletList'))" :title="t('aiKbNeBulletList')" @click="cmd('toggleBulletList')"><KIcon name="layers" :size="13" /></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('blockquote'))" :title="t('aiKbNeQuote')" @click="cmd('toggleBlockquote')"><KIcon name="chev" :size="13" /></button>
              <button class="kn-tb-btn" :disabled="mode !== 'rich'" :data-on="String(tbActive('codeBlock'))" :title="t('aiKbNeCodeBlock')" @click="cmd('toggleCodeBlock')"><KIcon name="code" :size="13" /></button>
              <span style="flex: 1" />
              <div class="k-seg" style="margin-left: 6px">
                <button :data-on="String(mode === 'rich')" @click="mode = 'rich'">{{ t('aiKbNeRichText') }}</button>
                <button :data-on="String(mode === 'md')" @click="mode = 'md'">Markdown</button>
              </div>
            </div>
            <div v-if="mode === 'rich'" class="kn-editor-body-wrap">
              <NotesMarkdownEditor v-model="form.body" @input="dirty = true" @ready="onEditorReady" @transaction="tbTick++" />
            </div>
            <textarea v-else class="kn-editor-src" v-model="form.body" :placeholder="t('aiKbNeMdPlaceholder')" @input="dirty = true" />
            <div class="kn-editor-status">
              <span>{{ t('aiKbNeNChars', { n: wordCount }) }}</span>
              <span class="spacer" />
              <span style="font-family: var(--font-mono)">{{ mode === 'rich' ? 'WYSIWYG' : '.md source' }}</span>
            </div>
          </div>
        </div>

        <!-- aside (T8) -->
        <div class="kn-edit-aside">
          <div class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbStatus') }}</div>
            <div v-if="isNew" class="kn-kv">
              <KIcon name="edit" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeNewStatusHint') }}
            </div>
            <template v-else>
              <div class="kn-kv">
                <span v-if="status === 'draft'" class="kn-badge" data-s="draft"><KIcon name="sparkle" :size="9" /> {{ t('aiKbAiDraft') }}</span>
                <span v-else-if="status === 'archived'" class="kn-badge" data-s="archived">{{ t('aiKbArchived') }}</span>
                <span v-else class="kn-badge" data-s="curated"><KIcon name="check" :size="9" /> {{ t('aiKbCurated') }}</span>
              </div>
              <div class="kn-kv"><KIcon :name="sourceMeta(note.createdBy).icon" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeSource') }}: <b>{{ t(sourceMeta(note.createdBy).labelKey) }}</b></div>
              <div class="kn-kv"><KIcon name="clock" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeLastModified') }}: <b>{{ timeAgo(note.updatedAt) }}</b></div>
            </template>
          </div>

          <div class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeFileOnDisk') }}</div>
            <div v-if="isNew" class="kn-kv" style="font-size: 12px">
              <KIcon name="file" :size="13" color="var(--text-tertiary)" />{{ t('aiKbNeNewFileHint') }}
            </div>
            <template v-else>
              <div class="kn-filepath">{{ note.path }}</div>
              <div class="kn-kv" style="font-size: 11.5px; color: var(--text-tertiary)">{{ t('aiKbNeEditDirectHint') }}</div>
              <div class="kn-file-acts">
                <button class="k-btn outline" style="font-size: 12px; padding: 5px 10px" @click="revealFile">
                  <KIcon name="folder" :size="12" /> {{ t('aiKbNeFileManager') }}
                </button>
                <button class="k-btn ghost" style="font-size: 12px; padding: 5px 10px" @click="copyPath">
                  <KIcon name="copy" :size="12" /> {{ t('aiKbNeCopyPath') }}
                </button>
              </div>
            </template>
          </div>

          <div class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeProperties') }}</div>
            <select class="kn-aside-select" v-model="form.type" @change="dirty = true">
              <option v-for="(m, k) in NOTE_TYPES" :key="k" :value="k">{{ t(m.labelKey) }}</option>
            </select>
            <div class="kn-tagedit" @click="focusTagInput">
              <span v-for="tg in form.tags" :key="tg" class="kn-tagchip">
                {{ tg }}
                <button :title="t('aiKbNeRemoveTag')" @click.stop="removeTag(tg)"><KIcon name="x" :size="9" /></button>
              </span>
              <input
                ref="tagInputEl"
                :placeholder="form.tags.length ? '' : t('aiKbNeTagsPlaceholder')"
                v-model="tagInput"
                @keydown="onTagKey"
                @blur="addTag"
              />
            </div>
          </div>

          <div v-if="!isNew && sourceRefs.length" class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeSources') }}</div>
            <template v-for="(r, i) in sourceRefs" :key="i">
              <button v-if="r.path" class="kn-refbtn" :title="t('aiKbNeRevealFile')" @click="openRef(r)">
                <KIcon name="file" :size="13" /><span class="mono">{{ r.path }}</span><KIcon name="chev" :size="11" />
              </button>
              <button v-else-if="r.session_id" class="kn-refbtn" :title="t('aiKbNeOpenConversation')" @click="openSessionRef(r)">
                <KIcon name="bot" :size="13" /><span class="lbl">{{ t('aiKbNeSourceConversation') }} · {{ refLabel(r) }}</span><KIcon name="chev" :size="11" />
              </button>
            </template>
          </div>

          <div v-if="!isNew && backlinkList.length" class="kn-aside-card">
            <div class="kn-aside-title">{{ t('aiKbNeReferencedBy') }}</div>
            <button v-for="b in backlinkList" :key="b.id" class="kn-refbtn" @click="router.push('/ai/knowledge/notes?id=' + b.id)">
              <KIcon name="paperclip" :size="13" /><span class="lbl">{{ b.title }}</span><KIcon name="chev" :size="11" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 409 conflict: someone saved first (T8, reka Dialog primitive, see file header「═══ T8 ═══」section) -->
    <DialogRoot :open="!!conflict" @update:open="onConflictOpenChange">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent v-if="conflict" class="k-modal" style="width: min(560px, 100%)" :aria-describedby="undefined">
            <div class="k-modal-head">
              <span style="width: 30px; height: 30px; border-radius: 9px; background: var(--warning-soft); color: var(--warning); display: grid; place-items: center">
                <KIcon name="danger" :size="16" />
              </span>
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbNeConflictTitle') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="conflict = null"><KIcon name="x" :size="13" /></button>
            </div>
            <div class="k-modal-body">
              <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6">
                {{ t('aiKbNeConflictBody') }}
              </div>
              <div class="kn-diff" style="margin-top: 10px">
                <div class="kn-diff-pane" data-side="theirs">
                  <div class="kn-diff-pane-head"><KIcon name="drive" :size="11" /> {{ t('aiKbNeConflictTheirs') }} · rev {{ conflict.latest.revision }}</div>
                  <div class="kn-diff-body">{{ conflict.latest.body }}</div>
                </div>
                <div class="kn-diff-pane" data-side="mine">
                  <div class="kn-diff-pane-head"><KIcon name="edit" :size="11" /> {{ t('aiKbNeConflictMine') }} · {{ t('aiKbNeBasedOnRev', { n: conflict.baseRevision }) }}</div>
                  <div class="kn-diff-body">{{ form.body }}</div>
                </div>
              </div>
            </div>
            <div class="k-modal-foot">
              <button class="k-btn text" @click="copyMine"><KIcon name="copy" :size="12" /> {{ t('aiKbNeCopyMyBody') }}</button>
              <span style="flex: 1" />
              <button class="k-btn outline" @click="adoptDisk">{{ t('aiKbNeUseDisk') }}</button>
              <button class="k-btn primary" @click="keepMine">{{ t('aiKbNeKeepMine') }}</button>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
