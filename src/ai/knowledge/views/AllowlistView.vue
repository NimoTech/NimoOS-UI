<!--
  SP8-P5f Task 4 — Allowlist page (rail item 8, route `/ai/knowledge/allowlist`),
  migrated 1:1 from Vue2 blueprint `NimoOS-UI` @ `7a6ee6b7`
  `src/views/AI/Knowledge/AllowlistView.vue` (249 lines, read via
  `git -C ../../NimoOS-UI show 7a6ee6b7:` — governance §0.4: that repo's working tree
  is on a different branch, cannot be trusted).

  Structure cross-reference (blueprint line range → this file):
    :2-4     `.k-view` → `.k-scroll` → `.k-scroll-inner` three-layer wrapper
              (copied layer by layer)
    :6-53    Section A "File types": group heading + select all/none + extension
              chips + advanced collapse section + custom input
    :56-97   Section B "Folder rules": empty state / table header + rows / priority hint
    :101-151 "Add folder rule" modal (**K57: convert to reka primitives + portal to
              `.knowledge-app`**)
    :159-166 `GROUPS_TEMPLATE` three group templates (**K55: three `bg` gradients
              changed to tokens**)
    :171-179 four page-level ephemeral `data()` fields → local component `ref`s
    :180-188 `computed groups` (N54)
    :189-191 `created()` → `onMounted()`
    :192-246 `methods` → plain functions

  ─────────────────────────────────────────────────────────────────────────────
  【Zero <style> block — K44 / governance §3】 This file's entire scss block
    (`.k-extgroup*` / `.k-ext-chip*` / `.k-custom-add` / `.k-frow*` /
    `.k-priority-hint` / `.k-field*` / `.k-radio-2` / `.k-radio-card*`) has been
    moved into `src/ai/styles/knowledge.scss` by **T2** (blueprint
    `knowledge.scss:985-1141` + `:1342-1396` + `:1500-1503` media queries) and
    reviewed; `knowledge.scss` is imported by `KnowledgeLayout.vue`, this file
    no longer imports styles (precedent: `QueueView.vue` / `IndexedFilesView.vue`
    / `SettingsView.vue` follow the same pattern).

  【K1 — store layer flattening, at each location】 Blueprint has
    `this.store.state.extensions` (`:182`) / `this.store.state.folderRules` (`:65`
    `:75`); this repo's `knowledgeStore` is a Pinia setup store where **the `state`
    layer is entirely absent** → `store.extensions` / `store.folderRules`.
    Three flattening points total (**computed 1 + template 2**) — miss even one
    and that section renders blank with no error.

  【K55 — Three `GROUPS_TEMPLATE` `bg` gradients changed to tokens】 Blueprint
    lines `:160` / `:162` / `:164` write three `linear-gradient(135deg, …)`
    literals directly in `.vue` `<script>` constants, rendered via
    `:style="{background: g.bg}"` (`:14`). 🔴 **`color-guard` does not scan
    `.ts` / `.vue` `<script>` constants** (cross-area §1 issue B location ④,
    mutation test confirms "injected color in comment passes completely green")
    ⇒ those three are the only bare colors in the entire repo. This repo
    changed to `var(--grad-ext-docs)` / `var(--grad-ext-text)` /
    `var(--grad-ext-code)` tokens (T2 already declared one each for dark/light
    variants in `knowledge.scss`, values frozen in appendix B §B.1 / §B.6).
    Two guard rules, both in `src/ai/styles/knowledgeStyles.test.ts`:
      · T2b's "auto-chamber" assertion (decision R20, M-a) — presence of this
        file triggers it, pins three groups each consuming **corresponding**
        token (misalignment also caught);
      · K40-style targeted assertion added in `AllowlistView.test.ts` — pins
        three `bg` values to contain only `var(--…)`, zero hex / rgb / named
        colors (test: inject a color literal → must fail).

  【K57 — "Add folder rule" modal converted to reka primitives】 Blueprint
    `:102-151` is bare `.k-modal-bg` + overlay with `@click="adding = false"` +
    inner `@click.stop`. This repo changed to `DialogRoot` / `DialogPortal
    to=".knowledge-app" defer` / `DialogOverlay class="k-modal-bg"` /
    `DialogContent class="k-modal"`, structure copied from existing precedent
    `SettingsView.vue` (K29 implementation), not invented here. Three mappings:
      · Overlay click closes / interior click does not → `DialogContent`'s
        `pointerDownOutside` (equivalent), 🔴 **no `@click.stop` anymore**;
      · Blueprint's three close paths (× / cancel / overlay click) all just set
        `adding` to false, **no second state to clear** ⇒ `@update:open` writes
        directly `adding = $event` (same as `QueueView.vue`'s `confirmClear`;
        `SettingsView` wraps via `closeMigrate()` because it also clears
        `migrateAck`);
      · reka's a11y requires a `DialogTitle`. **This page's blueprint `:105`
        already has `.k-modal-title`** → wrap with `<DialogTitle as-child>`
        directly on that div, DOM structure matches blueprint exactly (no extra
        hidden node), **no `VisuallyHidden` needed** — same choice as
        `SettingsView`.
    ⚠️ `DialogPortal to=".knowledge-app"` **only recognizes the first matching
      host** (P5b handoff item #3). This page mounts under `KnowledgeLayout.vue`
      in production, and `.knowledge-app` class only appears in
      **`KnowledgeLayout.vue`** in this repo (all other occurrences are
      selectors in `knowledge.scss` and test temporary hosts) ⇒ at any given
      time exactly one host exists on the page, no ambiguity in which `to`
      points to. Tests must provide their own host in body (`AllowlistView.test.ts`'s
      `withHost()`, precedent `SettingsView.test.ts` / `QueueView.test.ts`).

  【K58 (K5 family) — 5 catch blocks do not echo backend text】 All 5 places
    in blueprint are `this.store.actions.toast(this.$t('Save failed') + ': ' +
    (e.message || e))` (`:199` `:209` `:221` `:237` `:244`) — the second part
    is exactly what K5 forbids echoing. This repo follows the **established
    pattern (form A)** per `p5f-task-0-report.md` §12: **show only fixed i18n
    keys, no `': '` prefix** ("no second part to concatenate, so no prefix",
    precedent `QueueView.vue:212-217` / `IndexedFilesView.vue:592-593` /
    `NoteEditPane.vue:461`). **Do not invent a second mapping set.**
    Five call sites: `toggle` / `setAllInGroup` → `aiKbAlSaveFailed`;
    `addCustom` → `aiKbAlAddFailed`; `saveRule` → `aiKbAlSaveFailed`;
    `removeRule` → `aiKbAlDeleteFailed`. Guard is **exclusion assertion**
    (see K58 group in test file: reject store action with recognizable text,
    assert toast text and full page DOM **do not contain** that text).
    ⚠️ That probe text **intentionally does not appear in this file**
    (governance §9: negative assertion meets comment = false positive).

  【K27 family — all toast calls use `store.toast(...)`】 Decision **R27** /
    Corrigendum **E-62**: inside `knowledgeStore.ts`, `toast()` calls
    `useToast().show(msg, 2400)`, while **global `show()` defaults to only 1500ms**
    ⇒ calling `useToast()` directly loses the blueprint's 2400ms. Six existing
    pages all use `store.toast()`, this page follows the same pattern — **10
    total calls** = **5 success** + **5 catch** (catch uses 3 keys:
    `aiKbAlSaveFailed` ×3 / `aiKbAlAddFailed` / `aiKbAlDeleteFailed`).
    🔴 **Correction (T5 did this, decision R24 Minor M-1)**: this note
    originally said "9 calls = 5 success + 4 catch", missed `toggle()`'s catch.
    **Only this comment changed, no product code changed.**

  ═══════════════════ Copying declaration (§3.5 N items) ═══════════════════

  【N47 — `:data-on="String(e.enabled)"` copied exactly】 (`:27`) Parser reports
    `enabled` as SQLite **integer 0/1**, normalized (`!!e.enabled`) **in store**
    (`knowledgeStore.ts:395`), 🔴 **this page does not normalize again**.
    Template's `String(...)` copied exactly — `data-*` is not a boolean
    attribute, needs to render as string `"false"` not absent, tests on both
    sides compare `'true'` / `'false'`.

  【N49 — `store.extensions || []` copied exactly】 (blueprint `:182`) Go / Python
    may serialize empty arrays as `null`, this fallback is necessary defense,
    **must not delete**.

  【N52 — `setAllInGroup` is serial `for` + `await`, with `if (e.enabled !== on)`
    skip】 (blueprint `:202-211`) 🔴 **must not change to `Promise.all`
    concurrent** — it hits the same SQLite backend, blueprint's serial is
    intentional. Two test cases: already at target state does not request · order
    is serial (test: change to `Promise.all` → must fail).
    ⚠️ `g.exts` read in loop is **snapshot at click time**: `store.toggleExtension`
    internally calls `loadAllowlist()` replacing entire `extensions`, `groups`
    recomputes to new object, but `g` still points to old snapshot ⇒ later
    iterations' `e.enabled` uses old values. **Blueprint (Vue 2 computed)
    behavior identical, copied unchanged.**

  【N53 — `addCustom` normalization】 (blueprint `:212-223`) `trim().toLowerCase()`,
    prepend `.` if not already present; empty string returns immediately (**no
    request**). Three test cases + success clears `customExt`.

  【N54 — Three `match` extension tables copied exactly】 (blueprint `:161` /
    `:163` / `:165`, **12 + 13 + 25 = 50** items, corrigendum **E-74**) 🔴
    **must not "complete" or remove any item** — changing silently hides / shows
    extensions. `groups` also copies three things exactly: `localeCompare`
    sorting · `filter(g => g.exts.length > 0)` skips empty groups · **no
    extension not in three match tables displays**.
    ⚠️ **Device consequence (decision R6, blueprint behavior not this period's
    defect)**: Parser knows 45 extensions, `.wps` (`enabled: 1`) **matches none
    of the three groups** ⇒ page shows only 44, `.wps` cannot be toggled here.
    Separate accounting ticket opened (decision §4, issue E), **changing it
    changes blueprint behavior, violates "1:1 interface"**.

  ═══════════════════ Vue2 → Vue3 forced rewrites (governance §2, not deviation)
    | Blueprint (Options API) | This file | Reason |
    |---|---|---|
    | `data()` object | `ref()` | `<script setup>` has no `this` |
    | `computed: { groups() }` | `computed()` | same |
    | `created()` | `onMounted()` | blueprint's `loadAllowlist()` call is same
      **non-blocking on first screen** (no await), behavior identical |
    | `methods: { … }` | plain functions | same |
    | `this.$t` | `useI18n().t` | this repo standard |
    | `this.store.actions.x()` | `store.x()` | Pinia setup store has no `actions`
      layer |

  🔴 **Zero `any`** (inherits K41): three shapes declare named interfaces below;
    element types of `store.extensions` / `store.folderRules` imported directly
    from `knowledgeStore`, not redeclared.
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { AllowlistExtension } from '../stores/knowledgeStore'

const { t } = useI18n()
const store = useKnowledgeStore()

/** Blueprint `:159-166` group template item. `labelKey` is rendered in two places:
 *  `$t(g.labelKey)` (`:17`) and `$t('All {group} …', { group: $t(g.labelKey) })`
 *  (`:207`) ⇒ it is a **dynamic key**, must appear in i18n (appendix A §A.7),
 *  unreachable by grep in template, **must not be judged as dead code**. */
interface ExtGroupTemplate {
  id: string
  labelKey: string
  icon: string
  /** 🔴 K55: only `var(--…)` references, **no color literals** (appendix B §B.1). */
  bg: string
  match: (ext: string) => boolean
}

/** Product of `groups` computed — template adds a filtered and sorted `exts`. */
interface ExtGroup extends ExtGroupTemplate {
  exts: AllowlistExtension[]
}

/** Three fields of `form` from blueprint `:171-178`. `root_id` / `path_glob` /
 *  `action` are **Parser's HTTP contract field names (snake_case)**, sent to
 *  backend as-is (`knowledgeStore.ts:406-414`), 🔴 **must not change to
 *  camelCase**. */
interface FolderRuleForm {
  root_id: string
  path_glob: string
  action: string
}

/**
 * Blueprint `:159-166` — three group templates.
 * 🔴 **K55**: three `linear-gradient` literals in `bg` → three tokens (appendix B
 *   §B.1, values frozen, implementer cannot choose); tokens declared in
 *   `src/ai/styles/knowledge.scss` for dark/light variants, both with same values.
 * 🔴 **N54**: three `match` tables **copied exactly** (12 + 13 + 25 = 50 items,
 *   corrigendum E-74), **must not complete or delete** — changing silently hides
 *   / shows extensions.
 */
const GROUPS_TEMPLATE: ExtGroupTemplate[] = [
  { id: 'docs', labelKey: 'aiKbAlGroupDocuments', icon: 'file', bg: 'var(--grad-ext-docs)',
    match: (ext) => ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.html', '.htm', '.xml', '.epub'].includes(ext) },
  { id: 'text', labelKey: 'aiKbAlGroupText', icon: 'edit', bg: 'var(--grad-ext-text)',
    match: (ext) => ['.md', '.markdown', '.txt', '.rst', '.csv', '.tsv', '.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.log'].includes(ext) },
  { id: 'code', labelKey: 'aiKbAlGroupCode', icon: 'code', bg: 'var(--grad-ext-code)',
    match: (ext) => ['.py', '.go', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.rs', '.php', '.sh', '.bash', '.zsh', '.fish', '.sql', '.lua', '.kt', '.scala', '.swift'].includes(ext) },
]

/* ── Four page-level ephemeral variables from blueprint data() (`:171-178`), all
   local component ref, not in store (governance §5.1) ── */

/** Blueprint `:174` — "Advanced: custom extension" collapse section. */
const customOpen = ref(false)
/** Blueprint `:175`. */
const customExt = ref('')
/** Blueprint `:176` — "Add folder rule" modal toggle. */
const adding = ref(false)
/** Blueprint `:177` — form initial value; reset to **this exact one** after
 *  `saveRule` success (blueprint `:234` identical). */
const form = ref<FolderRuleForm>({ root_id: 'any', path_glob: '/Downloads/*', action: 'deny' })

/**
 * Blueprint `:181-187` (N54). Three things copied exactly:
 *   ① Only extensions matching `match` enter group ⇒ **no extension not in three
 *      tables displays** (this device's `.wps` is in this category);
 *   ② Sort with `localeCompare`;
 *   ③ `filter(g => g.exts.length > 0)` ⇒ **empty groups do not render**.
 * 🔴 K1 layer flattening: blueprint `this.store.state.extensions` →
 *    `store.extensions`; N49's `|| []` fallback copied unchanged.
 */
const groups = computed<ExtGroup[]>(() => {
  const all = store.extensions || []
  return GROUPS_TEMPLATE.map((g) => ({
    ...g,
    exts: all.filter((e) => g.match(e.ext)).sort((a, b) => a.ext.localeCompare(b.ext)),
  })).filter((g) => g.exts.length > 0)
})

/** Blueprint `:189-191` `created()`. Blueprint has no await or catch — copied as-is
 *  (precedent `QueueView.vue:290`'s `onMounted(() => { loadForScope() })`). */
onMounted(() => {
  store.loadAllowlist()
})

/** Blueprint `:193`. */
function onCountFor(g: ExtGroup): number {
  return g.exts.filter((e) => e.enabled).length
}

/** Blueprint `:194-201` (K58: catch block shows only fixed key, does not echo
 *  backend text). */
async function toggle(ext: string, enabled: boolean): Promise<void> {
  try {
    await store.toggleExtension(ext, enabled)
    store.toast(enabled ? t('aiKbAlNowIndexing', { ext }) : t('aiKbAlStoppedIndexing', { ext }))
  } catch {
    store.toast(t('aiKbAlSaveFailed'))
  }
}

/**
 * Blueprint `:202-211` — 🔴 **N52: serial `for` + `await` with `if (e.enabled !==
 * on)` skip**. **Must not change to `Promise.all`**: it hits the same SQLite
 * backend, blueprint's serial is intentional.
 */
async function setAllInGroup(g: ExtGroup, on: boolean): Promise<void> {
  try {
    for (const e of g.exts) {
      if (e.enabled !== on) await store.toggleExtension(e.ext, on)
    }
    store.toast(
      on
        ? t('aiKbAlAllSelected', { group: t(g.labelKey) })
        : t('aiKbAlAllDeselected', { group: t(g.labelKey) }),
    )
  } catch {
    store.toast(t('aiKbAlSaveFailed'))
  }
}

/** Blueprint `:212-223` — N53: `trim().toLowerCase()` + prepend `.` if not
 *  present; empty string returns immediately. */
async function addCustom(): Promise<void> {
  const ext = customExt.value.trim().toLowerCase()
  if (!ext) return
  const normalized = ext.startsWith('.') ? ext : '.' + ext
  try {
    await store.toggleExtension(normalized, true)
    store.toast(t('aiKbAlAddedExt', { ext: normalized }))
    customExt.value = ''
  } catch {
    store.toast(t('aiKbAlAddFailed'))
  }
}

/** Blueprint `:224-238` — closes modal + shows toast + **resets form to initial
 *  value** (`:234` exactly). */
async function saveRule(): Promise<void> {
  try {
    await store.addFolderRule({
      root_id: form.value.root_id || 'any',
      path_glob: form.value.path_glob.trim(),
      action: form.value.action,
    })
    adding.value = false
    store.toast(t('aiKbAlSavedCleaning'))
    // reset for next add (blueprint `:233` comment exactly)
    form.value = { root_id: 'any', path_glob: '/Downloads/*', action: 'deny' }
  } catch {
    store.toast(t('aiKbAlSaveFailed'))
  }
}

/** Blueprint `:239-246`. */
async function removeRule(id: string | number): Promise<void> {
  try {
    await store.deleteFolderRule(id)
    store.toast(t('aiKbAlDeletedCleaning'))
  } catch {
    store.toast(t('aiKbAlDeleteFailed'))
  }
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <!-- Section A: file types (blueprint :5-53) -->
        <div class="k-section">
          <div class="k-section-head">
            <div class="k-section-title">{{ t('aiKbAlFileTypes') }}</div>
            <div class="k-section-hint">{{ t('aiKbAlFileTypesHint') }}</div>
          </div>
          <div class="k-section-body">
            <div v-for="g in groups" :key="g.id" class="k-extgroup">
              <div class="k-extgroup-head">
                <div class="k-extgroup-icon" :style="{ background: g.bg }">
                  <KIcon :name="g.icon" :size="14" />
                </div>
                <div class="k-extgroup-title">{{ t(g.labelKey) }}</div>
                <div class="k-extgroup-meta">
                  {{ onCountFor(g) }}/{{ g.exts.length }} {{ t('aiKbAlEnabledSuffix') }}
                </div>
                <div class="k-extgroup-toggle">
                  <button @click="setAllInGroup(g, true)">{{ t('aiKbAlSelectAll') }}</button>
                  <button @click="setAllInGroup(g, false)">{{ t('aiKbAlSelectNone') }}</button>
                </div>
              </div>
              <div class="k-ext-chips">
                <button
                  v-for="e in g.exts"
                  :key="e.ext"
                  class="k-ext-chip"
                  :data-on="String(e.enabled)"
                  @click="toggle(e.ext, !e.enabled)"
                >
                  <span class="k-ext-chip-mark">
                    <!-- Blueprint :30 named color foreground → `var(--text-on-accent)`
                         (appendix B §B.3-①). `.k-ext-chip-mark` under `[data-on="true"]`
                         sits on `var(--accent)` solid background, semantics: "bright
                         foreground on solid background". 🔴 **Not `--on-accent`** — that
                         token is dark in dark mode, becomes "dark foreground on dark
                         background" (appendix B §B.3.1 section warning). ⚠️ Intentionally
                         **do not repeat blueprint's color literal spelling** — color
                         sweep §6 **does not strip comments**, writing it fails the
                         "named color in template attribute position" guard as true
                         positive (E-60 criteria). -->
                    <KIcon v-if="e.enabled" name="check" :size="9" color="var(--text-on-accent)" />
                  </span>
                  {{ e.ext }}
                </button>
              </div>
            </div>

            <div style="padding: 0 16px 14px">
              <button
                class="k-adv-toggle"
                :data-open="String(customOpen)"
                @click="customOpen = !customOpen"
              >
                <span class="chev"><KIcon name="chev" :size="11" /></span>
                <KIcon name="settings" :size="12" />
                {{ t('aiKbAlAdvancedCustom') }}
              </button>
            </div>
            <div v-if="customOpen" class="k-custom-add">
              <input
                v-model="customExt"
                type="text"
                placeholder=".log, .ini, .conf …"
                @keydown.enter="addCustom"
              />
              <button class="k-btn primary" :disabled="!customExt.trim()" @click="addCustom">
                <KIcon name="plus" :size="12" /> {{ t('aiKbAdd') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Section B: folder rules (blueprint :55-97) -->
        <div class="k-section">
          <div class="k-section-head">
            <div class="k-section-title">{{ t('aiKbAlFolderRules') }}</div>
            <div class="k-section-hint">{{ t('aiKbAlPriorityHint') }}</div>
            <button class="k-btn primary" style="margin-left: auto" @click="adding = true">
              <KIcon name="plus" :size="12" /> {{ t('aiKbAlAddRule') }}
            </button>
          </div>
          <div class="k-section-body">
            <div
              v-if="store.folderRules.length === 0"
              style="padding: 40px 20px; text-align: center; color: var(--text-tertiary); font-size: 13px"
            >
              {{ t('aiKbAlNoRules') }}
            </div>
            <template v-else>
              <div class="k-frow k-frow-head">
                <span>{{ t('aiKbAlLibrary') }}</span>
                <span>{{ t('aiKbColPath') }}</span>
                <span>{{ t('aiKbColAction') }}</span>
                <span />
              </div>
              <div v-for="r in store.folderRules" :key="r.id" class="k-frow">
                <span class="k-frow-root">
                  <span class="k-frow-root-icon"><KIcon name="drive" :size="11" /></span>
                  {{ r.root_id || 'any' }}
                </span>
                <span class="k-frow-path" :title="r.path_glob">{{ r.path_glob }}</span>
                <span class="k-frow-action" :data-act="r.action">
                  <KIcon :name="r.action === 'allow' ? 'check' : 'x'" :size="11" />
                  {{ r.action === 'allow' ? t('aiKbAlAllow') : t('aiKbAlDeny') }}
                </span>
                <span style="display: flex; justify-content: flex-end">
                  <button
                    class="k-row-action"
                    data-tone="danger"
                    :title="t('aiKbAlDeleteRule')"
                    @click="removeRule(r.id)"
                  >
                    <KIcon name="trash" :size="13" />
                  </button>
                </span>
              </div>
            </template>
            <div class="k-priority-hint">
              <KIcon name="info" :size="12" />
              {{ t('aiKbAlExampleHint') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add rule modal (blueprint :101-151) — K57: reka Dialog primitives,
         portal to knowledge base container. Blueprint's "click overlay to close /
         click inside does not close" is expressed by DialogContent's
         pointerDownOutside equivalent. -->
    <DialogRoot :open="adding" @update:open="adding = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" :aria-describedby="undefined">
            <div class="k-modal-head">
              <!-- DialogTitle wraps blueprint's own .k-modal-title (as-child) —
                   satisfies reka's a11y requirement without extra hidden node,
                   DOM matches blueprint :105 exactly. -->
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbAlAddFolderRule') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="adding = false">
                <KIcon name="x" :size="12" />
              </button>
            </div>
            <div class="k-modal-body">
              <div class="k-field">
                <label class="k-field-label">{{ t('aiKbAlLibrary') }}</label>
                <input v-model="form.root_id" type="text" placeholder="DATA / Backup / Media / any" />
                <div class="k-field-hint">{{ t('aiKbAlLibraryHint') }}</div>
              </div>
              <div class="k-field k-field-mono">
                <label class="k-field-label">{{ t('aiKbColPath') }}</label>
                <input v-model="form.path_glob" type="text" placeholder="/Downloads/*" />
                <div class="k-field-hint">{{ t('aiKbAlPathHint') }}</div>
              </div>
              <div class="k-field">
                <label class="k-field-label">{{ t('aiKbColAction') }}</label>
                <div class="k-radio-2">
                  <button
                    class="k-radio-card"
                    :data-on="String(form.action === 'allow')"
                    @click="form.action = 'allow'"
                  >
                    <span class="k-radio-card-icon" data-tone="allow"
                      ><KIcon name="check" :size="13"
                    /></span>
                    <div>
                      <div class="k-radio-card-text">{{ t('aiKbAlAllow') }}</div>
                      <div class="k-radio-card-desc">{{ t('aiKbAlAllowDesc') }}</div>
                    </div>
                  </button>
                  <button
                    class="k-radio-card"
                    :data-on="String(form.action === 'deny')"
                    @click="form.action = 'deny'"
                  >
                    <span class="k-radio-card-icon" data-tone="deny"
                      ><KIcon name="x" :size="13"
                    /></span>
                    <div>
                      <div class="k-radio-card-text">{{ t('aiKbAlDeny') }}</div>
                      <div class="k-radio-card-desc">{{ t('aiKbAlDenyDesc') }}</div>
                    </div>
                  </button>
                </div>
              </div>
              <div
                style="padding: 10px 12px; background: var(--bg-sunken); border-radius: var(--r-sm); font-size: 12px; color: var(--text-tertiary); line-height: 1.55"
              >
                <KIcon name="info" :size="11" /> {{ t('aiKbAlPriorityFull') }}
              </div>
            </div>
            <div class="k-modal-foot">
              <div class="right" style="margin-left: auto">
                <button class="k-btn ghost" @click="adding = false">{{ t('aiKbCancel') }}</button>
                <button
                  class="k-btn primary"
                  :disabled="!form.path_glob.trim()"
                  @click="saveRule"
                >
                  <KIcon name="check" :size="12" /> {{ t('aiKbAlSaveRule') }}
                </button>
              </div>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
