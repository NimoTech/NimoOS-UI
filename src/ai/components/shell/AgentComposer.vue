<!--
  SP8-P1c1 Task 9 — AgentComposer skeleton: chips + textarea + toolbar + send/stop.
  1:1 ported from Vue2 src/views/AI/Agent/shell/AgentComposer.vue (830 lines). This task
  only implements the skeleton: visible resource chips (Vue2 5-17), auto-height textarea
  (45-54), toolbar row (56-113), caption (127-129). **Not implemented** (left for Task 10/11,
  wiring points noted below):
    - Attachment chips (Vue2 18-42), upload/delete pipeline (onFilesPicked/removeAttachment,
      Vue2 506-611) — the `attachments` array is always empty in this task.
    - @mention panel (MentionPopover) and `/init` slash panel (SlashPopover since P1c1 patch
      Task 3; the initial SlashMenu was rejected by the user and retired) — mention scanning
      in onInput (Vue2 306-334), drillIn/pickItem/popSegment, onInit not yet wired.
    - Vue2's BrowserModal (NAS browser dialog) — user deferred this phase, Browse button
      becomes a placeholder toast.
    - `activeSessionId` watcher (Vue2 275-281) — in Vue2 this watcher does two things
      (close mention panel + clear pending attachments), both belong to the next task scope.
      Adding an empty watcher body here would be dead code, so defer entirely to Task 10.

  SP8-P1c1 Task 10 — attachment pipeline (select/upload/progress/doc errors/delete/clear).
  1:1 ported from Vue2: attachment chips template (18-42), `attachments` data shape
  (220-225), `onFilesPicked` (506-602), `removeAttachment` (604-611),
  `chipTitle`/`docOkLabel` (488-504), `attachmentHint` (234-244), `submit()` attachment
  portion (438-452), `activeSessionId` watcher (275-281, this task only clears attachments;
  `closeMention()` call site left for Task 11 — see note in watch block below).

  SP8-P1c1 Task 11 — @mention + slash command wiring + gitignore 409 confirmation.
  1:1 ported from Vue2: slash/@ scanning in `onInput` (300-335, pure text math already
  prepared in Task 5's `composerText.ts`: `scanMention`/`buildDrillText`/`buildPopText`/
  `stripMentionToken`), `onBlur` (343-346), `closeMention` (347-352),
  drillIn/pickItem/popSegment (355-428), `onInit` (613-617), `activeSessionId` watcher's
  `closeMention()` call site (275-281, seat left in Task 10). MentionPopover mount (115-124),
  SlashMenu mount (131-136). **Don't port** BrowserModal mount (138-142) — deferred this
  phase, Browse button still placeholder toast.

  SP8-P1c1 acceptance patch Task 3 (2026-07-27, user acceptance round 1 rejected fullscreen
  SlashMenu) — retire the `SlashMenu` mounted in Task 11 above (fullscreen overlay +
  centered card + single-select list), replace with `SlashPopover.vue` (same shell as
  MentionPopover, inline/anchored/↑↓/Enter/Tab/Esc/Backspace, two-stage command→target).
  This is not a defect fix but user-reshaped interaction design, so directly delete the
  component written in the previous cycle (not subject to "defer all deletes to SP10" — that
  rule governs the old Vue2 repo, not our own work from this cycle that got rejected).
  State machine (replaces Task 11's "entire string is exactly `/`" rule in onInput 307-310):
  three refs `slashOpen`/`slashStage`/`slashQuery` re-derived on each onInput (and focus/click
  sync paths from Task 1) — see `deriveSlashState()`. Add `slashDismissedText`: remember
  the text at last Esc close, prevent focus/click from reopening the panel the user just
  closed with Esc (only reopen if text changes, see `onSlashPopClose()`). @ and / panels
  mutually exclusive, unified collection point `syncPanelsFromText()` — when slash derivation
  wins, force close mention panel; otherwise run existing `syncMentionFromCaret()`. Add
  `if (slashOpen.value) return` to `onKeydown` (right after existing
  `if (mentionOpen.value) return`; mutually exclusive so order not sensitive, but both must
  precede Enter send logic). Three emits (`pick-command`/`pick-target`/`back`, plus native
  `close`) correspond to `onSlashPickCommand`/`onSlashPickTarget`/`onSlashBack`/
  `onSlashPopClose`, align line-by-line with brief "state machine" section; add slash panel
  close in `activeSessionId` watcher (back to command stage + clear dismiss memory), parallel
  to existing `closeMention()`.

  Vue2 defect fixes (project 2026-07-27 port discipline: logic follows correctness, not 1:1):
  (a) Vue2 onBlur's setTimeout handle never stored/cleared, can fire after component unmount.
      Store it in `blurTimer`, clearTimeout in onBeforeUnmount.
  (b) See note in pickItem below — gitignore 409 confirmation pending state uses separate
      open/target refs, not per-brief description "merge into one ref, clear in update:open"
      — reason in pickItem annotation.
  (c) P1c1 acceptance patch Task 1 (2026-07-27, user acceptance feedback): Vue2 textarea
      (45-53) lacks `@focus` handler — onBlur (343-346) closes panel after 180ms, but no
      path reopens it on refocus, so switching tabs or clicking elsewhere and back, panel
      stays closed. Add onFocus here (clear pending blurTimer then reopen by caret position)
      + onClick (moving caret into/out of @ word should toggle open/close), both use new
      extracted `syncMentionFromCaret()` (scan logic from onInput, unchanged, just extracted
      for reuse). See notes at their declarations.
  (d) P1c1 acceptance patch task 4 (2026-07-27, user re-acceptance round 2, @ still broken):
      Vue2 shell/AgentComposer.vue:331 (and `syncMentionFromCaret` extracted above) scans
      from caret backward via `scanMention`, closing (`{open:false}`) on any whitespace.
      NimoOS mount point display name `System (/DATA)` has both spaces and slashes — after
      drilling text becomes `@System (/DATA)/.system_data/` — triggering this scan again
      (next keystroke, blur→focus, even drillIn's own el.focus() in nextTick's onFocus),
      scanning backward hits space and bails, panel never reopens.
      Fix: add `mentionPrefix`/`parseActiveMention` pure functions to composerText.ts (pure
      slice comparison, no character-by-character scan); change `syncMentionFromCaret` to
      two-level logic — if drilled at least once (`mentionSegs.length>0`), prioritize recorded
      segments/start, only use `scanMention` to discover new words if not yet drilled. Split
      old `closeMention()` into `hideMentionPanel()` (hide only, used in onBlur) and
      `resetMention()` (full reset, used in Esc/select/send/session-switch/clear-text) —
      blur no longer destroys drilled levels, reset only on true end. See notes at
      `syncMentionFromCaret`/`hideMentionPanel`/`resetMention` declarations and
      `.superpowers/sdd/p1c1-patch-task-4-brief.md`.

  gitignore 409 confirmation (only intentional interaction deviation this cycle): Vue2 uses
  blocking `window.confirm` (Vue2 398, 630), here use repo's reka-ui `AlertDialog`. Note
  AlertDialog renders via `DialogPortal` outside `.agent-app` tree, so `.agent-app` tokens
  don't apply to it — this is existing convention (AgentSidebar's delete confirmation same
  situation), not a new problem introduced here.

  P1c1 acceptance patch round 2 Task 5 (2026-07-27, review round 2 Item A + Item B) —

  Item A: @ panel lacks Esc close memory, asymmetric with slash panel's `slashDismissedText`/
  `openSlashIfNotDismissed`. Defect repro: type '@doc' → MentionPopover Esc (`close`) closes
  panel → click back to textarea → onFocus → syncMentionFromCaret → scanMention rediscovers
  same `@doc` token → panel reopens uninvited. Looked "fixed" before only because existing
  test happened to use mount point name with spaces (`scanMention` fails on space, unrelated
  to this memory, pure coincidence). Fix: add `mentionDismissedText` ref + `openMentionIfNotDismissed()`
  helper, mirror slash side's shape/naming exactly. Write point: `onMentionPopClose()`
  (replace direct `resetMention` binding on `@close`); read points: both branches of
  `syncMentionFromCaret()` (state-priority parseActiveMention, discovery-style scanMention)
  must check here; clear point in `resetMention()` (select/submit/session-switch/clear-text
  all full-reset paths clear together, ensure this memory never deadlocks panel). **Vue2 has
  no such mechanism** — never had "Esc then focus doesn't reopen" behavior; this is a defect
  we discovered and fixed. Port discipline 2026-07-27: UI 1:1 Vue2, but logic follows
  correctness. See notes at `mentionDismissedText`/`openMentionIfNotDismissed`/`onMentionPopClose`
  declarations.

  Item B (review question, verified with component test, not speculation): `drillIn()`'s
  `nextTick(() => { el.focus(); el.setSelectionRange(caretPos, caretPos); grow() })` order
  is unsafe when token is followed by other text (e.g. `@Dr tail` drills to `@Drive1/ tail`) —
  `el.focus()` synchronously re-enters `onFocus` → `syncMentionFromCaret`, but `setSelectionRange`
  hasn't run yet, so `el.selectionStart` reads browser's native position after `.value`
  wholesale replacement (string end), treating tail text as mentionQuery. Fix: swap to
  `setSelectionRange` then `focus()` — first doesn't require focus, second won't reset
  existing selection, swap order fixes it. See note at `drillIn` declaration.

  SP8-P3a post-acceptance addition (2026-07-30) — "mounted skill" banner, **user-directed
  new UI not in Vue2**. Context: "try in conversation" stores skill id in
  `agentStore.pendingSkillId` (placeholder, temporary only), truly takes effect **next time**
  `send()` puts it in `X-Skill-Id` header and clears it (agentStore.ts:925-927, same as Vue2
  agentStore.js:357-359, existed in P1, we just visualize it here) — but UI shows nothing,
  user asked "URL changed but will this skill actually be used?", proves this UX gap is real.
  This doesn't change URL (plan ② not chosen), doesn't add skill-disabled hint (plan ③ not
  chosen), just reads `store.pendingSkillId` and renders a dismissible banner, dismissal only
  nulls it. Place before chips row because semantically same: both are "attached to next message",
  both inherit `.composer`'s `pointer-events: auto`. See
  .superpowers/sdd/p3a-post-skillbanner-brief.md.
-->
<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AgentIcon from '../icons/AgentIcon.vue'
import KindIcon from './KindIcon.vue'
import ContextUsageBar from '../blocks/ContextUsageBar.vue'
import MentionPopover from './MentionPopover.vue'
import SlashPopover from './SlashPopover.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useToast } from '../../../stores/toast'
import {
  getExt, basename, dirname, scanMention, buildDrillText, buildPopText, stripMentionToken,
  parseActiveMention,
} from '../../util/composerText'
import { ACCEPT_TYPES, MAX_ATTACHMENT_BYTES, TEXT_EXTS, docErrorKey, docErrorShortKey } from '../../util/attachmentMeta'

const props = withDefaults(
  defineProps<{ busy?: boolean; ctxUsage?: { tokens: number; window: number; pct: number } | null }>(),
  { busy: false, ctxUsage: null },
)

/** Task 10 Interfaces section: shape of single attachmentRefs item in submit() (verbatim from brief). */
interface AttachmentRef {
  id: string
  filename: string
  kind?: string
  mime?: string
  url: string
}

// Three emit names and payload shapes are Task 12 wiring contract, don't change
// (p1c1-task-9-brief.md Interfaces section). `send-init` has no caller in this task
// (SlashMenu/onInit are Task 11's concern), declared here as interface placeholder.
const emit = defineEmits<{
  send: [payload: { text: string; attachmentIds: string[]; attachmentRefs: AttachmentRef[] }]
  stop: []
  'send-init': [target: string]
  // context-window override saved from the ContextUsageBar popover —
  // AgentPage refreshes the usage indicator so the new window shows at once
  'ctx-window-saved': []
}>()

const { t } = useI18n()
const store = useProvidedAgentStore()
const toast = useToast()

/**
 * Task 10 Interfaces section: shape of local pending attachment list item (internal only,
 * never exported). Line-by-line alignment with Vue2 220-225 `attachments` data:
 *   docError: backend extract_error code when kind=document; undefined on success.
 *   docMeta:  { extractor, pages, truncated } when document extraction succeeds.
 */
interface PendingAttachment {
  tmpId: string
  file: File
  status: 'uploading' | 'uploaded' | 'failed'
  progress: number
  aid?: string
  kind?: string
  mime?: string
  error?: string
  docError?: string
  docMeta?: { extractor?: string; pages?: number; truncated?: boolean }
}

const text = ref('')
const composerEl = ref<HTMLElement | null>(null)
const ta = ref<HTMLTextAreaElement | null>(null)
const attachFileInput = ref<HTMLInputElement | null>(null)
// Vue2 295-299 anchorRect: for MentionPopover positioning; panel itself left for Task 11,
// here just scaffold the calculation + resize binding, no half-state.
const anchorRect = ref<DOMRect | null>(null)
// Vue2 219-225 attachments data — local pending attachment list (browser-selected,
// uploading/uploaded files), distinct from store.attachments (server list in right panel),
// no interference.
const attachments = ref<PendingAttachment[]>([])

// Vue2 210-216 mention picker / slash menu data.
const mentionOpen = ref(false)
const mentionStart = ref(-1)
const mentionSegs = ref<string[]>([])
const mentionQuery = ref('')
// P1c1 patch Task 3 — SlashPopover driver state (replaces Task 11's single-shot `slashOpen`
// that only fires when entire string is exactly '/', fails on second keystroke). See file
// header "SP8-P1c1 acceptance patch Task 3" state machine overview, and line-by-line notes
// in deriveSlashState() declaration.
const slashOpen = ref(false)
const slashStage = ref<'command' | 'target'>('command')
const slashQuery = ref('')
// On Esc (command stage close event), save the text at that moment; as long as text hasn't
// changed, focus/click resync should not resurrect the panel — see usage in deriveSlashState()'s
// openSlashIfNotDismissed(). Clear when text empties or first char is no longer '/'.
const slashDismissedText = ref<string | null>(null)
// P1c1 acceptance patch round 2 Task 5 Item A (2026-07-27) — symmetrical memory for @ panel,
// mirrors `slashDismissedText`/`openSlashIfNotDismissed` above. Defect repro: type '@doc' →
// MentionPopover Esc (`close`) closes panel → click back to textarea → onFocus →
// syncMentionFromCaret → scanMention rediscovers same `@doc` token → panel reopens unsummoned.
// Slash panel had this memory long ago, @ panel never did — should be symmetric, this is
// omission not design choice. Write point: `onMentionPopClose()` (MentionPopover `@close`,
// i.e., Esc). Read points: both branches of `syncMentionFromCaret()` (state-priority
// parseActiveMention branch and discovery-style scanMention branch) must check here — see
// `openMentionIfNotDismissed` declaration notes for why both branches need gating.
// Clear point: `resetMention()` (select/submit/session-switch/clear-text unified collection
// point) clears together, ensure this memory never deadlocks panel; `onMentionPopClose()`
// itself calls `resetMention()`, so write memory after calling (else clear first, clear again).
// Vue2 has no such memory (never fixed this bug, we discovered the defect) — port discipline
// 2026-07-27: UI 1:1 Vue2, but logic follows correctness.
const mentionDismissedText = ref<string | null>(null)
// Vue2 defect fix (a) (see file header): onBlur's setTimeout handle must be clearable in
// onBeforeUnmount; Vue2 never stored this handle.
const blurTimer = ref<ReturnType<typeof setTimeout> | null>(null)

/**
 * gitignore 409 confirmation pending state. **Not** per-brief description merged into
 * single `ref<{path,kind}|null>` cleared in `update:open===false` — that hits reka
 * timing trap we've hit before, noted explicitly in AgentSidebar.vue/SourcesPage.vue:
 * `AlertDialogAction` click fires `update:open(false)` before our own `@confirm`
 * handler, if pending data cleared by update:open callback, onGitignoreConfirm reads null.
 * Here follow existing pattern from those two — open uses separate bool, pending data
 * clears only after confirm handler reads it, cancel/Escape path pending briefly stale
 * without refresh harmless (next pickItem hitting 409 overwrites entirely).
 */
const gitignoreOpen = ref(false)
const gitignoreTarget = ref<{ path: string; kind: string } | null>(null)

const placeholder = computed(() => t('aiComposerPlaceholder'))
const acceptTypes = ACCEPT_TYPES

/**
 * Vue2 234-244 attachmentHint(). **Intentional deviation**: Vue2 uses Buefy `<b-tooltip
 * multilined>` to display these 7 lines; this repo has no Buefy, use native `title`
 * attribute + `\n` to join seven lines (see title binding on attach button in template).
 */
const attachmentHint = computed(() =>
  [
    t('aiAttachHint1'),
    t('aiAttachHint2'),
    t('aiAttachHint3'),
    t('aiAttachHint4'),
    '· ' + t('aiAttachHint5') + ' ' + TEXT_EXTS.join(' '),
    t('aiAttachHint6'),
    t('aiAttachHint7'),
  ].join('\n'),
)

/** Vue2 289-294 grow() — verbatim alignment (min(scrollHeight, 220)). */
function grow() {
  const el = ta.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 220) + 'px'
}

/** Vue2 295-299 updateAnchor(). */
function updateAnchor() {
  if (composerEl.value) anchorRect.value = composerEl.value.getBoundingClientRect()
}

/**
 * P1c1 acceptance patch task 4 (2026-07-27, user re-acceptance round 2): change @ mention
 * word from "re-derive from text every time" to "state priority, text only discovers new
 * words / extracts filter words".
 *
 * Root cause (see p1c1-patch-task-4-brief.md "root cause" section, code-verified not
 * guessed): `scanMention` (composerText.ts:48-67, same as Vue2 shell/AgentComposer.vue:331
 * note "mention path contains no spaces") is backward-scan discovery algorithm, breaks on
 * whitespace to set `{open:false}`. NimoOS mount point display name `System (/DATA)` has
 * both spaces and slashes — after drilling text becomes `@System (/DATA)/.system_data/`,
 * triggering this function again (next keystroke, blur→focus, even drillIn's own `el.focus()`
 * in nextTick's onFocus — incidentally proven with component test on real interaction),
 * backward scan hits space and bails, panel never reopens.
 *
 * Fix: `mentionSegs` (level) written by `drillIn`/`popSegment` is authoritative, never
 * re-derived from text. Once drilled at least once (`mentionSegs.value.length > 0`), use
 * `parseActiveMention` doing pure slice comparison "does recorded prefix still match this
 * text segment" (no character scanning, naturally immune to embedded spaces/slashes), on
 * match directly reuse/update `mentionQuery`, **don't run `scanMention` again**.
 *
 * Can't gate on `mentionSegs.value.length > 0` alone: `mentionPrefix([])` is just bare `'@'`,
 * if we unconditionally trust `parseActiveMention` for "not yet drilled, just typed `@xxx`
 * without selecting any level" state, that prefix will judge "still holds" for any following
 * text (as long as caret is after `@`), including user typing space to end the mention —
 * breaks existing test case "`AgentComposer @mention / slash` closes after typing space"
 * (Task 11). Not-yet-drilled "character discovery" is inherently safe (no space-containing
 * mount point name mixed into state yet), so keep that path to `scanMention` rediscovery —
 * two-level logic together is what brief "component refactor" step 2 calls "two-tier logic".
 */
/**
 * P1c1 acceptance patch round 2 Task 5 Item A — mirrors `openSlashIfNotDismissed()`: only
 * open if current text differs from `mentionDismissedText` (text at last Esc close); else
 * stay closed. Both branches of `syncMentionFromCaret()` (state-priority parseActiveMention,
 * discovery-style scanMention) pass through here, no separate logic to drift — both need
 * gating because: even if `resetMention()` (part of Esc close path) clears `mentionSegs`,
 * next time almost always falls into scanMention branch rediscovering same token, but this
 * memory check itself doesn't depend on "which branch discovered", both branches can
 * recalculate same start/segments/query when text unchanged, must gate both, can't trust
 * just one call path.
 */
function openMentionIfNotDismissed(v: string, start: number, segs: string[], query: string) {
  if (mentionDismissedText.value !== null && mentionDismissedText.value === v) {
    mentionOpen.value = false
    return
  }
  mentionStart.value = start
  mentionSegs.value = segs
  mentionQuery.value = query
  mentionOpen.value = true
  updateAnchor()
}

function syncMentionFromCaret() {
  const v = text.value
  const el = ta.value
  const caret = el ? (el.selectionStart ?? v.length) : v.length

  if (mentionSegs.value.length > 0) {
    const parsed = parseActiveMention(v, mentionStart.value, mentionSegs.value, caret)
    if (parsed.active) {
      openMentionIfNotDismissed(v, mentionStart.value, mentionSegs.value, parsed.query)
      return
    }
  }

  const scan = scanMention(v, caret)
  if (scan.open) {
    openMentionIfNotDismissed(v, scan.start, scan.segments, scan.query)
    return
  }
  resetMention()
}

/**
 * P1c1 patch Task 3 — SlashPopover open/close helper: only truly open if current text
 * differs from `slashDismissedText` (text at last Esc close); else stay closed. This is the
 * only landing point for "don't auto-reopen after close, only reopen if text changes" rule —
 * all three paths (`onInput`/`onFocus`/`onClick`) pass through here, prevents separate
 * logic from drifting.
 */
function openSlashIfNotDismissed(v: string) {
  if (slashDismissedText.value !== null && slashDismissedText.value === v) {
    slashOpen.value = false
    return
  }
  slashOpen.value = true
  updateAnchor()
}

/**
 * P1c1 patch Task 3 — replaces Task 11's "entire string is exactly '/', fails on second
 * keystroke" rule in onInput 307-310. Every call re-derives purely from current `text.value`
 * and current `slashStage` (no history dependency), so `onInput`/`onFocus`/`onClick` sharing
 * same logic doesn't drift. See file header "SP8-P1c1 acceptance patch Task 3" section.
 *
 * - First char not '/' (or text empty): force close, revert to command stage, clear query,
 *   clear `slashDismissedText` (brief: "clear this memory when text empties or first char
 *   no longer '/'").
 * - target stage: text must still start with `/init ` (command name + one space) to stay in
 *   target, query = remaining text after that prefix (filters by dir path); else revert to
 *   command stage, falls to command branch below to re-derive (e.g. user deletes "/init "
 *   to "/in", should go back to command stage list filtered to "in").
 * - command stage: open only if no whitespace after `/`, query = remaining text after `/`;
 *   close immediately on any whitespace (user typed space), stay in command stage — aligns
 *   with Vue2's two-stage layout: entering target stage is `pick-command` event-driven, not
 *   space-triggered.
 */
function deriveSlashState() {
  const v = text.value
  if (v.length === 0 || v[0] !== '/') {
    slashOpen.value = false
    slashStage.value = 'command'
    slashQuery.value = ''
    slashDismissedText.value = null
    return
  }

  if (slashStage.value === 'target') {
    const prefix = '/init ' // Currently only one command; multi-command needs to build prefix from current command name.
    if (v.startsWith(prefix)) {
      slashQuery.value = v.slice(prefix.length)
      openSlashIfNotDismissed(v)
      return
    }
    // Text no longer starts with "/init " (user deleted space or command name) — revert to command stage,
    // fall through to re-derive by command rules below.
    slashStage.value = 'command'
  }

  const rest = v.slice(1)
  if (/\s/.test(rest)) {
    slashOpen.value = false
    slashQuery.value = ''
    return
  }
  slashQuery.value = rest
  openSlashIfNotDismissed(v)
}

/**
 * P1c1 patch Task 3 — unique collection point for @ / mutual exclusion: first derive slash
 * state; if slash wins (`slashOpen` true), force close mention panel, don't re-derive
 * mention; else run existing `syncMentionFromCaret()`. Two panels never open together —
 * regardless of direction (slash→mention or reverse), logic unified here, never drifts to
 * two separate branches.
 *
 * P1c1 patch task 4: must use `resetMention()` (full reset), can't just `hideMentionPanel()`
 * — after slash panel wins, if mention's `mentionSegs`/`mentionStart` still there, next time
 * slash panel closes and text becomes something "still matching recorded prefix",
 * `syncMentionFromCaret` resurrects mention panel (see brief "component refactor" step 3 last
 * point).
 */
function syncPanelsFromText() {
  deriveSlashState()
  if (slashOpen.value) {
    if (mentionOpen.value) resetMention()
    return
  }
  syncMentionFromCaret()
}

/**
 * Vue2 300-335 onInput(). Order matters: grow() first, then `syncPanelsFromText()` —
 * replaces Task 11's hand-written "slash trigger + syncMentionFromCaret()" branches (see
 * notes above two functions).
 */
function onInput() {
  grow()
  syncPanelsFromText()
}

/**
 * P1c1 acceptance patch Task 1 — fix Vue2 defect (c): Vue2 `shell/AgentComposer.vue`
 * textarea (45-53) binds only `@input`/`@keydown`/`@blur`, no `@focus`. `onBlur` (343-346)
 * calls `closeMention()` after 180ms, but only path reopening panel is `onInput`'s scan —
 * so switching tabs or clicking elsewhere and back, panel stays closed until user types
 * something. Not UI difference, logic defect; per port discipline 2026-07-27 (UI mirrors
 * Vue2, logic follows correctness), fix here: on refocus,
 *   1) clear pending blur-close timer first — else "click panel item → input refocus" existing
 *      interaction gets immediately cancelled by our 180ms timer;
 *   2) use syncMentionFromCaret() to decide open/close by caret — level/query words
 *      restored by scanMention from text, naturally preserves drilled levels, no extra state.
 * P1c1 patch Task 3 update: originally just called `syncMentionFromCaret()` here; now call
 * `syncPanelsFromText()`, simultaneously re-derive slash panel by current text — brief
 * explicitly requires "re-derive slash state in every onInput (and new focus/click sync
 * paths from Task 1)". `slashDismissedText` mechanism ensures this path doesn't resurrect
 * panels the user just closed with Esc and text unchanged.
 */
function onFocus() {
  if (blurTimer.value !== null) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  syncPanelsFromText()
}

/**
 * P1c1 acceptance patch Task 1 continued, second half of defect (c): user may click in
 * existing text, moving caret into/out of @ word, panel should toggle open/close (not just
 * respond to typing). Calls same idempotent function as onFocus — P1c1 patch Task 3 changed
 * to `syncPanelsFromText()` (simultaneously covers slash state derivation, reason same as
 * onFocus note).
 */
function onClick() {
  syncPanelsFromText()
}

/**
 * Vue2 336-342 onKeydown(). **Restore** the `if (this.mentionOpen) return` guard (line 336)
 * removed in Task 9 — mention panel wasn't wired then, guard was dead code; wiring
 * MentionPopover here, guard regains function: when panel open, keyboard goes to panel
 * (arrows/Tab/Enter/Esc/Backspace, see MentionPopover.vue onKey), composer no longer
 * intercepts Enter to send. IME double-guard kept verbatim (`e.isComposing || keyCode === 229`,
 * latter is historical fallback for browsers/IME that don't set isComposing, keep both).
 *
 * P1c1 patch Task 3: add `if (slashOpen.value) return`, let SlashPopover's window keydown
 * capture-phase listener monopolize arrows/Enter/Tab/Esc/Backspace (see SlashPopover.vue onKey).
 * Two panels mutually exclusive (syncPanelsFromText() ensures), so order of two returns
 * doesn't matter, but both must precede Enter send logic.
 */
function onKeydown(e: KeyboardEvent) {
  if (mentionOpen.value) return // popover handles keys
  if (slashOpen.value) return // SlashPopover handles keys
  if (e.key !== 'Enter' || e.shiftKey) return
  if (e.isComposing || (e as unknown as { keyCode?: number }).keyCode === 229) return
  e.preventDefault()
  submit()
}

/**
 * Vue2 245-250 canSend(). Three-part logic: no ready attachments and no text → can't send;
 * else can send if no uploading attachments (ready attachments allow attachment-only or
 * empty-text send).
 */
const canSend = computed(() => {
  const hasReady = attachments.value.some((a) => a.status === 'uploaded' && a.aid)
  const hasText = text.value.trim().length > 0
  if (!hasReady && !hasText) return false
  return !attachments.value.some((a) => a.status === 'uploading')
})

/** Vue2 260-272 chips() — use basename/dirname/getExt from Task 5 composerText.ts. */
const chips = computed(() =>
  store.visibleResources.map((r) => {
    const isFile = r.kind === 'file'
    return {
      id: r.id,
      path: r.path,
      name: basename(r.path),
      parent: dirname(r.path),
      kind: r.kind,
      ext: isFile ? getExt(r.path) : '',
    }
  }),
)

/** Vue2 654-657 toastError() — shared generic error hint for removeChip/pickItem/onBrowserPick,
 *  corresponds to Vue2's `$t('Authorization failed: {msg}')`, catch with `aiAuthFailed` key here;
 *  removeChip is the only call site wired in this task, else resource removal failure silently
 *  swallowed. SP8-P1c2 Task 6: auth failure → danger tier (p1c2-task-6-brief.md
 *  "AgentComposer 7 places"). */
function toastError(e: unknown) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string } | null
  const msg = err?.response?.data?.detail || err?.message || 'unknown'
  toast.show(t('aiAuthFailed', { msg }), 5000, 'danger')
}

/**
 * Vue2 430-434 removeChip()。
 *
 * P1c2 debt 1(1c-1 final review, 2026-07-27, paid off here): chips the agent
 * itself authorizes mid-run arrive with no `id` — Vue2 agentStream.js:539-542
 * and this repo's dispatchEvent.ts (`case 'visible_resource_added'`, ~line
 * 310-315) both forward the stream event to `appendVisibleResource` with only
 * `{path, kind}`, never an id (see the same observation in agentStore.ts:35).
 * Vue2 has no guard here at all — it calls `removeVisibleResource(undefined)`
 * unconditionally, which hits `/visible-resources/undefined` and fails, but
 * the failure surfaces through Vue2's existing `catch { toastError(e) }` —
 * broken, but at least visible to the user. 1c-1's port instead added an
 * `id === undefined` guard that no-ops silently: clicking × on such a chip
 * did nothing and gave no feedback at all, strictly worse than Vue2.
 *
 * Fix: route id-less chips through `store.removeVisibleResourceByPath(c.path)`
 * (agentStore.ts), which refreshes the server-side list first (it always
 * carries real ids) and either deletes by the now-known id, or — if the
 * server has already forgotten the path — cleans up the local entry only.
 * Both branches still funnel failures through the same `toastError` as the
 * id path below, so behaviour stays consistent between the two.
 */
async function removeChip(c: { id?: string | number; path: string }) {
  try {
    if (c.id !== undefined) {
      await store.removeVisibleResource(c.id)
    } else {
      await store.removeVisibleResourceByPath(c.path)
    }
  } catch (e) {
    toastError(e)
  }
}

/** Vue2 257-259 visibleFolders() — feed `folders` prop to SlashPopover (P1c1 patch Task 3
 *  onward; previously retired SlashMenu). */
const visibleFolders = computed(() => store.visibleResources.filter((r) => r.kind === 'folder'))

/**
 * P1c1 patch task 4 — split "hide" and "reset" (brief "component refactor" step 1):
 *
 * - `hideMentionPanel()`: only close panel (`mentionOpen=false`), **keep**
 *   `mentionStart`/`mentionSegs`/`mentionQuery` — used in `onBlur`'s delayed close so
 *   on refocus `syncMentionFromCaret` can use `parseActiveMention` recognize "still the
 *   same mention word" and restore panel to original level (immune to spaces/slashes in
 *   mount point name, exactly what this patch fixes).
 * - `resetMention()`: full clear, semantics of old `closeMention()` — used at all endpoints
 *   where mention truly ends: Esc close panel, select item, send, switch session, slash
 *   panel mutex takeover, clear input. Each call site annotated at declaration.
 */
function hideMentionPanel() {
  mentionOpen.value = false
}

function resetMention() {
  mentionOpen.value = false
  mentionStart.value = -1
  mentionSegs.value = []
  mentionQuery.value = ''
  // P1c1 acceptance patch round 2 Task 5 Item A — every full-reset path also clears Esc
  // memory, so it never deadlocks panel (brief requires "clear everywhere in select/submit/
  // session-switch/clear-text"). `onMentionPopClose()` (Esc itself) must write
  // `mentionDismissedText` *after* calling this function, else write then immediately clear.
  mentionDismissedText.value = null
}

/**
 * P1c1 acceptance patch round 2 Task 5 Item A — handler for MentionPopover `@close` (Esc).
 * Replaces direct `resetMention` binding: fully reset first (semantics unchanged — mention
 * truly ends), then record "text at close" in `mentionDismissedText`, let
 * `openMentionIfNotDismissed()` refuse reopen while text unchanged. **Don't clear text** —
 * user may want to keep editing, semantically aligned with `onSlashPopClose()`.
 */
function onMentionPopClose() {
  resetMention()
  mentionDismissedText.value = text.value
}

/**
 * Vue2 343-346 onBlur(). 180ms delayed close, lets click on panel item happen before
 * blur closes. **Fix Vue2 defect (a)** (see file header): store timer handle in `blurTimer`,
 * clearTimeout in onBeforeUnmount — Vue2 never stored it, setTimeout can fire after
 * component unmount (this becomes dead instance).
 *
 * Final-review fix (2026-07-27): storing only the *latest* handle was still incomplete —
 * blur→focus→blur sequence overwrote `blurTimer` with second timer's handle without
 * clearing the first, so first timer kept running and could fire `closeMention()` after
 * user refocused and reopened popover. Clear any pending handle before scheduling new one
 * so at most one blur-close timer is ever live.
 *
 * P1c1 patch task 4 (key fix): delayed callback now calls `hideMentionPanel()`, not
 * `resetMention()`. Old `closeMention()` was full reset — blur-close clears `mentionSegs`/
 * `mentionStart`, refocus can only re-derive from text via `scanMention`, but spaces in
 * mount point name make that derivation fail (brief "root cause"). Now just hide, keep state,
 * on refocus `syncMentionFromCaret` has something to compare with `parseActiveMention`.
 */
function onBlur() {
  if (blurTimer.value !== null) clearTimeout(blurTimer.value)
  blurTimer.value = setTimeout(() => {
    hideMentionPanel()
    blurTimer.value = null
  }, 180)
}

/**
 * Vue2 355-371 drillIn() — drill into one folder/mount level, write "<name>/" back to @token
 * end. Use buildDrillText from Task 5 composerText.ts for text+caret math.
 *
 * P1c1 acceptance patch round 2 Task 5 Item B (2026-07-27, review timing issue, verified
 * with component test) — `el.setSelectionRange` **must come before `el.focus()`**:
 * `el.focus()` synchronously re-enters `onFocus()` (see its declaration note — not guessed,
 * proved), and `onFocus` immediately calls `syncMentionFromCaret()`, which reads "current"
 * `el.selectionStart`. textarea's `.value` just wholesale-replaced by this drill (Vue v-model
 * patch landed before nextTick callback runs), native behavior resets caret to new string end
 * — if token followed by other text (e.g. `@Dr tail` drills to `@Drive1/ tail`), this
 * resync triggered by focus reads caret as string end before `setSelectionRange` moved it
 * back to token end, polluting `mentionQuery` with tail text (` tail`). Setting caret first
 * then focusing avoids re-entry reading wrong position — setSelectionRange doesn't require
 * focus, focus() doesn't reset existing selection, so swapping order is safe.
 */
function drillIn(item: { name: string }) {
  const el = ta.value
  const caret = el ? (el.selectionStart ?? text.value.length) : text.value.length
  const result = buildDrillText(text.value, mentionStart.value, caret, mentionSegs.value, item.name)
  text.value = result.text
  mentionSegs.value = result.segments
  mentionQuery.value = ''
  nextTick(() => {
    el?.setSelectionRange(result.caretPos, result.caretPos)
    el?.focus()
    grow()
  })
}

/** Vue2 374-410 pickItem() — pick leaf node (file or Enter-selected folder): delete @token,
 *  create visible resource. Use stripMentionToken from Task 5 composerText.ts for text+caret math. */
async function pickItem(item: { kind: string; resolvedPath: string }) {
  const el = ta.value
  const caret = el ? (el.selectionStart ?? text.value.length) : text.value.length
  const result = stripMentionToken(text.value, mentionStart.value, caret)
  text.value = result.text

  const kind = item.kind === 'file' ? 'file' : 'folder'
  const path = item.resolvedPath
  // P1c1 patch task 4: after selection mention truly ends, must resetMention() (not just hide)
  // — see brief "component refactor" step 3 "after pickItem select".
  resetMention()
  nextTick(() => {
    el?.focus()
    el?.setSelectionRange(result.caretPos, result.caretPos)
    grow()
  })

  try {
    await store.addVisibleResource(path, kind, false)
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { detail?: string } } } | null
    const status = err?.response?.status
    const detail = err?.response?.data?.detail
    if (status === 409 && /gitignore/i.test(detail || '')) {
      // Approved deviation from Vue2 398/630 (window.confirm) — see file-header
      // comment and the gitignoreOpen/gitignoreTarget declaration above for why
      // pending state is kept in two separate refs instead of one that gets
      // cleared from an `update:open` handler.
      gitignoreTarget.value = { path, kind }
      gitignoreOpen.value = true
    } else {
      toastError(e)
    }
  }
}

/** Vue2 412-428 popSegment() — pop last segment. **Vue2 intentionally doesn't focus()**
 *  (unlike drillIn/pickItem), keep this asymmetry verbatim here. Use buildPopText from Task 5
 *  composerText.ts for text+caret math. */
function popSegment() {
  if (mentionSegs.value.length === 0) return
  const el = ta.value
  const caret = el ? (el.selectionStart ?? text.value.length) : text.value.length
  const result = buildPopText(text.value, mentionStart.value, caret, mentionSegs.value)
  text.value = result.text
  mentionSegs.value = result.segments
  mentionQuery.value = ''
  nextTick(() => {
    el?.setSelectionRange(result.caretPos, result.caretPos)
    grow()
  })
}

/**
 * P1c1 patch Task 3 — SlashPopover `pick-command(name)`. Currently only 'init' command.
 * Normalize text to `/${name} ` (command name + one space), switch to target stage, clear
 * query (target stage candidates are all authorized dirs, no pre-filter needed). **Don't**
 * send any request here — wait for user to finish selecting dir in target stage (see
 * onSlashPickTarget).
 */
function onSlashPickCommand(name: string) {
  text.value = `/${name} `
  slashStage.value = 'target'
  slashQuery.value = ''
  nextTick(() => {
    const el = ta.value
    el?.focus()
    el?.setSelectionRange(text.value.length, text.value.length)
    grow()
  })
}

/**
 * P1c1 patch Task 3 — SlashPopover `pick-target(path)`. Equivalent to Vue2 `onInit`
 * (613-617) "close menu + clear input + send send-init": clear input, close panel back to
 * command stage, `nextTick(grow)`, then pass target dir to AgentPage (`store.sendInit` wiring
 * on that side, not changed here).
 *
 * P1c1 patch task 4: add `resetMention()` — here we clear entire input, mention word (if any)
 * must end too, can't leave mentionStart/mentionSegs dangling to non-existent text. See
 * brief "component refactor" step 3 "onSlashPickTarget and other clear-text paths".
 */
function onSlashPickTarget(path: string) {
  text.value = ''
  resetMention()
  slashOpen.value = false
  slashStage.value = 'command'
  slashQuery.value = ''
  slashDismissedText.value = null
  nextTick(grow)
  emit('send-init', path)
}

/**
 * P1c1 patch Task 3 — SlashPopover `back()` (target stage Esc/Backspace trigger). Revert to
 * command stage, shrink text from `/${cmd} <query>` back to `/${cmd}` (drop everything after
 * command name, including space), then re-derive with `deriveSlashState()` by new text — so
 * command stage list naturally highlights/filters to that command (brief requirement "re-derive
 * slashQuery accordingly"), no separate filter logic needed.
 */
function onSlashBack() {
  const v = text.value
  const spaceIdx = v.indexOf(' ')
  const cmdName = spaceIdx === -1 ? v.slice(1) : v.slice(1, spaceIdx)
  text.value = `/${cmdName}`
  slashStage.value = 'command'
  deriveSlashState()
  nextTick(() => {
    const el = ta.value
    el?.setSelectionRange(text.value.length, text.value.length)
    // Backing up shortens text (drops query typed in target stage), without height
    // recalc textarea freezes at previously stretched height until next keystroke.
    grow()
  })
}

/**
 * P1c1 patch Task 3 — SlashPopover `close()` (command stage Esc trigger). Close panel, back
 * to command stage, record text at that moment to `slashDismissedText` — this is write point
 * for "don't auto-reopen after Esc" rule (read point in `openSlashIfNotDismissed`).
 * **Don't clear text**: user may want to keep editing, semantically aligned with
 * `closeMention()`.
 */
function onSlashPopClose() {
  slashDismissedText.value = text.value
  slashOpen.value = false
  slashStage.value = 'command'
}

/** gitignore 409 confirmation dialog `@confirm` handler — clear after reading pending (see
 *  gitignoreOpen/gitignoreTarget declaration notes), retry addVisibleResource with force=true;
 *  failure goes through generic toastError (Vue2 401-403 fallback). */
function onGitignoreConfirm() {
  const pending = gitignoreTarget.value
  gitignoreOpen.value = false
  gitignoreTarget.value = null
  if (!pending) return
  store.addVisibleResource(pending.path, pending.kind, true).catch((e2) => toastError(e2))
}

/**
 * Vue2 460-472 docErrorLabel(). Codes from attachmentMeta.ts docErrorKey (aligned with
 * backend agent/attachments/extract.py extract_error codes); unknown codes use
 * 'aiDocErrGeneric' fallback with code param (aligned with Vue2 `{code}` interpolation).
 */
function docErrorLabel(code: string): string {
  const { key, params } = docErrorKey(code)
  return t(key, params ?? {})
}

/** Vue2 474-486 docErrorShort(). */
function docErrorShort(code: string): string {
  return t(docErrorShortKey(code))
}

/** Vue2 488-494 docOkLabel(). */
function docOkLabel(entry: PendingAttachment): string {
  if (!entry.docMeta) return t('aiDocOkExtracted')
  const parts = [t('aiDocOkExtracted')]
  if (entry.docMeta.pages) parts.push(t('aiDocPages', { n: entry.docMeta.pages }))
  if (entry.docMeta.truncated) parts.push(t('aiDocTruncated'))
  return parts.join(' · ')
}

/** Vue2 496-504 chipTitle(). */
function chipTitle(entry: PendingAttachment): string {
  if (entry.docError) {
    return `${entry.file.name} — ${docErrorLabel(entry.docError)}`
  }
  if (entry.kind === 'document' && entry.status === 'uploaded') {
    return `${entry.file.name} — ${docOkLabel(entry)}`
  }
  return entry.file.name
}

/**
 * Vue2 506-602 onFilesPicked() — verbatim-ported upload pipeline, order critical:
 * 1) Reset input.value (allow re-selecting same file), empty selection return directly.
 * 2) If no session, lazy-create (517-527) — fail gives danger toast and return.
 * 3) Per-file **serial** for-of (not Promise.all): 500MB gate → generate tmpId → build entry
 *    with `reactive()` (see entry declaration note, Vue3 port-specific trap, not Vue2 missing)
 *    → **push entry before await upload** (545, make chip visible immediately) → onProgress
 *    directly mutates entry → success writes aid/kind/mime/status → document extraction fail
 *    gives 7000ms warning toast, binary+not_installed+doc extension same toast → fail writes
 *    status/error and danger toast.
 */
async function onFilesPicked(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  target.value = '' // Allow re-selecting same file afterward
  if (!files.length) return

  // Attach button no longer gated by sessionId — on page load no activeSession yet, lazy-create
  // one here so "attach before send" operation works. Must create after OS file picker returns
  // (not before .click()), else user gesture context lost.
  if (!store.activeSessionId) {
    try {
      await store.createSession()
    } catch (err) {
      const msg = (err as Error)?.message || String(err)
      toast.show(t('aiAttachSessionFailed', { err: msg }), 5000, 'danger')
      return
    }
  }
  if (!store.activeSessionId) return
  const sid = store.activeSessionId // narrow once: TS re-widens the ref across awaits below

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.show(t('aiAttachTooLarge', { name: file.name }), 5000, 'danger')
      continue
    }
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    // reactive(), not a plain object: onProgress/success/failure below mutate
    // `entry` directly (Vue2 relied on Vue2's auto-reactive `data()` array
    // items for this — a plain object pushed into a Vue3 ref<T[]> array is
    // NOT itself the reactive proxy the template reads back out of the array,
    // so in-place field writes on a plain `entry` would silently not trigger
    // a re-render. Wrapping with reactive() up front makes `entry` itself the
    // canonical proxy Vue caches for this object, so writes through this same
    // reference correctly notify the template.
    const entry = reactive<PendingAttachment>({ tmpId, file, status: 'uploading', progress: 0 })
    attachments.value.push(entry)
    // Fix (review, 2026-07-27): Vue2 (AgentComposer.vue:547) reads `this.sessionId`
    // — a *computed* — fresh on every loop iteration, so a session switch mid-batch
    // just silently redirects remaining uploads into whatever session happens to be
    // active. That is wrong, not merely different: the `activeSessionId` watcher above
    // has already cleared every local chip for this batch (including the one just pushed
    // above, on very next reactive flush), so user has no way to see or manage an
    // attachment landing in the new session — orphaned server-side draft. Per project
    // rule (logic follows correctness, not 1:1 UI parity), re-read session id here and
    // stop entire batch moment it no longer matches batch start id, instead of continuing
    // to upload. Drop entry we just pushed for this file (never uploaded) before breaking,
    // so no stale "uploading" chip can flash before watcher's clear takes effect.
    if (store.activeSessionId !== sid) {
      attachments.value = attachments.value.filter((a) => a.tmpId !== tmpId)
      break
    }
    try {
      const body = (await service.ai.uploadAttachment(sid, file, {
        onProgress: (p: number) => { entry.progress = p },
      })) as { id?: string; kind?: string; mime?: string; meta?: Record<string, unknown> }
      entry.aid = body.id
      entry.kind = body.kind
      entry.mime = body.mime
      entry.status = 'uploaded'
      // kind=document: extraction may fail at upload time (200 OK) — upload itself still
      // succeeds (model still sees filename+mime), but user should know model can't read content.
      if (body.kind === 'document' && body.meta) {
        if (body.meta.extract_error) {
          entry.docError = body.meta.extract_error as string
          toast.show(`${file.name}:${docErrorLabel(entry.docError)}`, 7000, 'warning')
        } else {
          entry.docMeta = {
            extractor: (body.meta.extractor as string) || undefined,
            pages: (body.meta.pages as number) || undefined,
            truncated: !!body.meta.truncated,
          }
        }
      }
      // kind=binary and extract_error=not_installed is infrastructure issue (server missing
      // extraction lib); when doc extension matches still notify user this upload can't be used
      // for content Q&A.
      if (
        body.kind === 'binary'
        && body.meta && body.meta.extract_error === 'not_installed'
        && /\.(pdf|docx|xlsx|xlsm|pptx)$/i.test(file.name)
      ) {
        toast.show(`${file.name}:${docErrorLabel('not_installed')}`, 7000, 'warning')
      }
    } catch (err) {
      entry.status = 'failed'
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string } | null
      entry.error = errObj?.response?.data?.detail || errObj?.message || 'upload failed'
      toast.show(`${file.name}: ${entry.error}`, 5000, 'danger')
    }
  }
}

/** Vue2 604-611 removeAttachment(). For uploaded ones, best-effort delete server (fail still
 *  locally removes, doesn't block user), then filter from local list. */
async function removeAttachment(entry: PendingAttachment) {
  const sid = store.activeSessionId
  if (entry.status === 'uploaded' && entry.aid && sid) {
    try {
      await service.ai.deleteAttachment(sid, entry.aid)
    } catch {
      /* best-effort */
    }
  }
  attachments.value = attachments.value.filter((a) => a.tmpId !== entry.tmpId)
}

/**
 * Vue2 436-454 submit(). Attachment portion: only count uploaded items with aid as ready
 * (readyAttachments), derive attachmentIds/attachmentRefs from these; second gate when
 * uploading attachments exist (duplicates canSend guard, but submit can be called directly
 * by Enter key, bypassing disabled button state, so this guard can't be omitted).
 *
 * Vue2 defect fix (final review, 2026-07-27, port discipline: logic follows correctness):
 * Vue2 AgentComposer.vue:436-454 submit() lacks busy guard, unconditionally clears
 * this.text/this.attachments; but corresponding store send() starts with `if (busy.value) return`
 * — so pressing Enter during streaming reply clears text and uploaded chips in place, but
 * message never actually sends, silently swallowing user input. Gate with busy before any
 * clear/emit here.
 *
 * P1c1 patch task 4: when clearing `text`/`attachments` also add `resetMention()` — after
 * send input box is fresh text, any lingering mention levels/query words must also end.
 * See brief "component refactor" step 3 "after submit() send".
 */
function submit() {
  if (props.busy) return
  const trimmed = text.value.trim()
  const readyAttachments = attachments.value.filter((a) => a.status === 'uploaded' && a.aid)
  const attachmentIds = readyAttachments.map((a) => a.aid as string)
  if (!trimmed && attachmentIds.length === 0) return
  if (attachments.value.some((a) => a.status === 'uploading')) return
  const attachmentRefs: AttachmentRef[] = readyAttachments.map((a) => ({
    id: a.aid as string,
    filename: a.file.name,
    kind: a.kind,
    mime: a.mime,
    url: service.ai.attachmentRawUrl(store.activeSessionId as string, a.aid as string),
  }))
  emit('send', { text: trimmed, attachmentIds, attachmentRefs })
  text.value = ''
  attachments.value = []
  resetMention()
  nextTick(grow)
}

/**
 * Vue2 643-650 openFilePicker(). **Must** be attached to `@mousedown.prevent` (in template),
 * not `@click`: mousedown fires before click (user hasn't released button, OS dialog starts
 * opening), `preventDefault` keeps textarea focused, saves round-trip blur→mention-panel-close
 * (Vue2 644-647 comment line-by-line).
 */
function openFilePicker() {
  attachFileInput.value?.click()
}

/** Vue2 651-653 notSupported() (voice key). Vue2 uses 'is-warning' type, not error, default
 *  toast duration. SP8-P1c2 Task 6: brief categorizes "feature not yet supported" as info tier
 *  (p1c2-task-6-brief.md "AgentComposer 7 places") — don't pass tier param, use show()'s default,
 *  so this call site needs no change. */
function notSupported() {
  toast.show(t('aiNotSupportedYet'))
}

/**
 * **Intentional deviation this cycle**: Vue2 Browse click opens `<BrowserModal>` (NAS
 * browser dialog). Dialog not implemented this phase (user decision, see Task 9 brief
 * "Browse button" section), changed to toast placeholder here, no browserOpen state,
 * don't render `data-active` (Vue2 line 59 `:data-active="browserOpen"` also dropped).
 * SP8-P1c2 Task 6: same, Browse placeholder → info tier, don't pass tier, call site no change.
 */
function onBrowseClick() {
  toast.show(t('aiBrowseComingSoon'))
}

/**
 * Vue2 275-281 `activeSessionId` watcher. Close mention panel (`resetMention()`)
 * + clear pending attachments. Server attachments still belong to old session, here just
 * discard local chip references, don't send requests.
 *
 * P1c1 patch task 4: originally called `closeMention()` here, now per brief "component refactor"
 * step 3 "activeSessionId watcher" call `resetMention()` — semantics unchanged (always full
 * reset: session switch is fresh context, shouldn't inherit previous session's mention
 * levels/query words), just distinguishes from newly-split `hideMentionPanel()`, avoids future
 * accidental misuse of hide-only function.
 *
 * P1c1 patch Task 3: also add close slash panel — back to command stage and clear
 * `slashDismissedText` (not record one dismiss, full reset: new session is fresh context,
 * shouldn't inherit "text just closed with Esc" memory from previous session). Prevent
 * half-state lingering after session switch (e.g. stuck in target stage but dir list already
 * new session).
 */
watch(
  () => store.activeSessionId,
  () => {
    resetMention()
    slashOpen.value = false
    slashStage.value = 'command'
    slashDismissedText.value = null
    attachments.value = []
  },
)

onMounted(() => window.addEventListener('resize', updateAnchor))
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateAnchor)
  // Vue2 defect fix (a) — see file header: Vue2 never clears onBlur's setTimeout handle.
  if (blurTimer.value !== null) clearTimeout(blurTimer.value)
})
</script>

<template>
  <div class="composer-wrap">
    <div class="composer" ref="composerEl">
      <!-- SP8-P3a post-acceptance addition — see file header: store.pendingSkillId placeholder
           hint, no Vue2 equivalent, user requested in-person 2026-07-30. -->
      <div v-if="store.pendingSkillId" class="pending-skill">
        <AgentIcon name="sparkle" :size="12" color="var(--accent)" />
        <i18n-t keypath="aiSkPendingBanner" tag="span" class="pending-skill-text">
          <template #name><code>{{ store.pendingSkillId }}</code></template>
        </i18n-t>
        <button
          class="pending-skill-x"
          :title="t('aiSkPendingDetach')"
          :aria-label="t('aiSkPendingDetach')"
          @click="store.pendingSkillId = null"
        >
          <AgentIcon name="x" :size="10" />
        </button>
      </div>

      <div v-if="chips.length > 0 || attachments.length > 0" class="composer-chips">
        <div v-for="c in chips" :key="c.id" class="ctx-chip" :title="c.path">
          <KindIcon :kind="c.kind === 'file' ? 'file' : 'folder'" :ext="c.ext" :size="12" />
          <span class="ctx-chip-name">{{ c.name }}</span>
          <span class="ctx-chip-path">{{ c.parent || '/' }}</span>
          <button class="ctx-chip-x" @click="removeChip(c)">
            <AgentIcon name="x" :size="10" />
          </button>
        </div>
        <div
          v-for="a in attachments"
          :key="a.tmpId"
          class="ctx-chip ctx-chip-att"
          :class="{
            'is-uploading': a.status === 'uploading',
            'is-failed': a.status === 'failed',
            'is-doc-warn': a.docError,
          }"
          :title="chipTitle(a)"
        >
          <KindIcon
            :kind="a.kind === 'image' ? 'image' : 'file'"
            :ext="getExt(a.file.name)"
            :size="12"
          />
          <span class="ctx-chip-name">{{ a.file.name }}</span>
          <span v-if="a.status === 'uploading'" class="ctx-chip-prog">{{ a.progress }}%</span>
          <span v-else-if="a.status === 'failed'" class="ctx-chip-err">!</span>
          <span
            v-else-if="a.docError"
            class="ctx-chip-doc-warn"
          >⚠ {{ docErrorShort(a.docError) }}</span>
          <button class="ctx-chip-x" @click="removeAttachment(a)">
            <AgentIcon name="x" :size="10" />
          </button>
        </div>
      </div>

      <textarea
        ref="ta"
        class="composer-textarea"
        :placeholder="placeholder"
        rows="1"
        v-model="text"
        @input="onInput"
        @keydown="onKeydown"
        @blur="onBlur"
        @focus="onFocus"
        @click="onClick"
      />

      <div class="composer-row">
        <button
          class="composer-tool"
          :title="t('aiComposerBrowseTitle')"
          @click="onBrowseClick"
        >
          <AgentIcon name="folder" :size="14" /> {{ t('aiComposerBrowse') }}
        </button>
        <!-- Vue2 663-673: display:none input doesn't fire synthetic .click() in some browsers,
             so use position+opacity instead of hidden/display:none (kept in .attach-file-input below). -->
        <input
          type="file"
          ref="attachFileInput"
          :accept="acceptTypes"
          multiple
          class="attach-file-input"
          @change="onFilesPicked"
        />
        <!-- Vue2 73-86 wraps this button in Buefy <b-tooltip multilined> to show
             attachmentHint; this repo has no Buefy equivalent, so same 7-line hint joined
             with \n into native `title` attribute (approved deviation, see Task 10 brief). -->
        <button
          class="composer-tool"
          :title="attachmentHint"
          @mousedown.prevent="openFilePicker"
        >
          <AgentIcon name="paperclip" :size="14" />
        </button>
        <button class="composer-tool" :title="t('aiComposerVoice')" @click="notSupported">
          <AgentIcon name="mic" :size="14" />
        </button>
        <div class="composer-spacer" />
        <ContextUsageBar
          v-if="ctxUsage"
          :tokens="ctxUsage.tokens"
          :window="ctxUsage.window"
          :pct="ctxUsage.pct"
          class="composer-ctx-usage"
          @saved="emit('ctx-window-saved')"
        />
        <button
          v-if="props.busy"
          class="send-btn busy"
          @click="emit('stop')"
        >
          <AgentIcon name="stop" :size="12" />
        </button>
        <button
          v-else
          class="send-btn"
          :disabled="!canSend"
          @click="submit"
        >
          <AgentIcon name="send" :size="14" />
        </button>
      </div>

      <!-- P1c1 patch task 4: `@close` (Esc) must fully reset (can't just hide) — else user
           presses Esc to close, next focus gets parseActiveMention branch of syncMentionFromCaret
           recognizing "mention word still valid" and immediately reopens, Esc wasted. See brief
           "component refactor" step 3 "panel close(Esc)". P1c1 patch acceptance round 2 Task 5
           Item A: full reset alone isn't enough — after reset `mentionSegs` cleared, next focus
           falls into scanMention branch, "re-discovers" same token from text and bounces back
           (slash panel had this pit years ago, here adding symmetric memory for @ panel). Bind
           `onMentionPopClose`: full reset + record close-time text, let `openMentionIfNotDismissed()`
           refuse reopen while text unchanged. -->
      <MentionPopover
        :open="mentionOpen"
        :query="mentionQuery"
        :segments="mentionSegs"
        :anchor-rect="anchorRect"
        @drill-in="drillIn"
        @pick="pickItem"
        @pop-segment="popSegment"
        @close="onMentionPopClose"
      />

      <!-- P1c1 patch Task 3 — retire fullscreen SlashMenu, replace with same-style inline/
           anchored SlashPopover (two-stage command → target). always-mounted (don't v-if
           component itself, its template v-if="open" alone), aligns with MentionPopover mount
           style — component instance always exists, :open controls visibility. -->
      <SlashPopover
        :open="slashOpen"
        :stage="slashStage"
        :query="slashQuery"
        :folders="visibleFolders"
        :anchor-rect="anchorRect"
        @pick-command="onSlashPickCommand"
        @pick-target="onSlashPickTarget"
        @back="onSlashBack"
        @close="onSlashPopClose"
      />
    </div>

    <div class="composer-caption">
      {{ t('aiComposerCaption') }}
    </div>

    <AlertDialog
      v-model:open="gitignoreOpen"
      :title="t('aiGitignoreBlockedTitle')"
      :message="t('aiGitignoreBlockedMsg', { path: gitignoreTarget?.path ?? '' })"
      :confirm-text="t('aiAllow')"
      :cancel-text="t('aiCancel')"
      @confirm="onGitignoreConfirm"
    />
  </div>
</template>

<style scoped>
/* agent-styles.scss:353-406 already globally defines .composer-wrap/.composer/
   .composer-textarea/.composer-row/.composer-tool/.send-btn layout (sticky positioning,
   pointer-events toggle, border-radius/border/shadow, focus-within highlight, hover states,
   etc.) — here only add missing parts, don't duplicate layout rules. */

.attach-file-input {
  /* Keep input in render tree so $refs.attachFileInput.click() always lands on live element.
     `hidden` attribute works but some browsers won't dispatch synthetic click on display:none
     inputs. (Vue2 663-673, verbatim.) */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

/* SP8-P3a post-acceptance addition — "mounted skill" banner (see file header). Visual
   language mirrors .ctx-chip below (border-radius/font/spacing aligned), bg uses --accent-softer
   to differentiate (same token as .composer:focus-within, see agent-styles.scss:369). */
.pending-skill {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px;
  margin-bottom: 8px;
  background: var(--accent-softer);
  border: 1px solid var(--accent-soft);
  border-radius: var(--r-pill);
  font-size: 12px;
  color: var(--text-primary);
}
.pending-skill-text { flex: 1; }
.pending-skill-text :deep(code) {
  font-family: var(--font-mono);
  color: var(--accent);
}
.pending-skill-x {
  width: 18px; height: 18px;
  flex-shrink: 0;
  display: grid; place-items: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  background: transparent; border: none; cursor: pointer;
  transition: all 120ms ease;
}
.pending-skill-x:hover { background: var(--bg-elevated); color: var(--text-primary); }

.composer-chips {
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-bottom: 8px;
}
.ctx-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 4px 4px 7px;
  background: var(--bg-chip);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  font-size: 12px;
  color: var(--text-primary);
  max-width: 280px;
}
.ctx-chip-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctx-chip-path {
  font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 140px;
}
.ctx-chip-x {
  width: 18px; height: 18px;
  display: grid; place-items: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  background: transparent; border: none; cursor: pointer;
  transition: all 120ms ease;
}
.ctx-chip-x:hover { background: var(--bg-elevated); color: var(--text-primary); }

/* Vue2 722-747 attachment chip states — colors ported to theme tokens
   (--danger/--warning/--warning-soft, defined in src/ai/styles/tokens.scss).
   Vue2's raw hex/rgba literal fallbacks dropped; tokens above always have values
   in both theme blocks. */
.ctx-chip-att.is-uploading {
  opacity: 0.7;
}
.ctx-chip-att.is-failed {
  border-color: var(--danger);
}
.ctx-chip-prog {
  font-size: 11px; color: var(--text-tertiary); margin-left: 4px;
}
.ctx-chip-err {
  font-size: 11px; color: var(--danger); margin-left: 4px;
}
.ctx-chip-att.is-doc-warn {
  border-color: var(--warning);
  max-width: 380px;
}
.ctx-chip-doc-warn {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 500;
  color: var(--warning);
  background: var(--warning-soft);
  border-radius: 4px;
  padding: 1px 6px;
  margin-left: 4px;
  white-space: nowrap;
}

.composer-textarea::placeholder { color: var(--text-tertiary); }

.composer-spacer { flex: 1; }

.send-btn.busy {
  background: var(--bg-chip);
  color: var(--text-primary);
  box-shadow: none;
}

.composer-caption {
  text-align: center; margin-top: 8px;
  font-size: 11px; color: var(--text-quaternary);
}

.composer-ctx-usage {
  margin-right: 8px;
  flex-shrink: 0;
}
</style>
