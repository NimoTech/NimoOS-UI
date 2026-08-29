<!--
  SP8-P3b Task 5 — 1:1 port from Vue2 src/views/AI/Skills/AddSkillModal.vue (188 lines).

  Shell swapped for SkModal (reka Dialog), instead of copying Vue2's bare `.sk-modal-bg` +
  `@click.self` (precedent set by P2b Task 3, visual rules unchanged). Footer uses SkModal's
  new `footerLeft` slot (added for this task) to hold the "saved locally on this NAS" note,
  and the `footer` slot holds the Cancel/Create buttons — matching Vue2's :96-108 two-column
  layout (`.save-note` on the left, `.right` on the right); see SkModal.vue's header comment
  for details.

  ===== Three deliberate deviations (each documented per the three-part convention, common
  constraints §3.6/3.7/3.8, brief §5.1) =====

  [Deviation 1 — color dots don't use inline :style]
  Vue2 :56-64 passes the gradient string via inline `:style="{ background: c.bg }"`; this repo
  forbids inline colors (common constraint §6). Changed to `:data-color="id"`, with the actual
  color supplied by the 7 `[data-color=…]` rules T1 placed in skills-styles.scss:717-723 (values
  are the `--grad-sk-*` tokens built in P3a Task 1). Selected state still goes through
  `:data-active`, semantically matching Vue2 :60.

  [Deviation 2 — local validation before submit]
  Vue2 :173-174's `submit()` only checks `!this.valid` (both fields non-empty), so the user
  fills the whole screen only to be bounced back by a single English sentence from the backend.
  Here submit() first runs T2's `validateSkillForm(name, description)` (mirroring the backend's
  skills_store.go validation rules field by field); if it returns non-null, the matching i18n key
  is rendered into `.sk-field-err` (placed at the top of `.sk-modal-body`, ahead of all fields).
  `valid` (the button's disabled condition, :137-139) still only checks that both fields are
  non-empty — the full validation only runs on click, not folded into the disabled state,
  otherwise the user wouldn't know why the button won't respond.
  The `serverError` prop and the local validation error render in the same slot — when local
  validation fails no request is sent, so the two are naturally mutually exclusive and need no
  extra priority logic.

  [Deviation 3 — files over 1 MiB are no longer silently dropped]
  Vue2 :164-167 does a bare `continue` on `f.size > 1024*1024`, so the user never sees the file
  disappear. Here we instead accumulate a skip count (`skippedCount`) and, once it's > 0, append
  a `.sk-field-hint` below the file field with copy key `aiSkFilesSkippedTooBig` (precedent:
  P1c1's attachment pipeline's 500 MB gate).

  ===== reka initial-focus empirical finding (the task brief required testing this first, not
  guessing) =====
  Using the same probe-mount technique as SkModal.vue's existing tests (mount, then repeated
  `nextTick` checks of `document.activeElement`): reka Dialog's FocusScope by default lands
  mount-auto-focus on the **first focusable element** inside DialogContent — in this component
  that's SkModal's built-in `.sk-x` close button (it comes before this component's name input in
  DOM order), not the name field. That's inconsistent with Vue2 :133-135 ("focus the name input
  as soon as it opens"), so an explicit `focus()` is needed.
  Further testing found: reka's auto-focus dispatch happens inside `FocusScope`'s own
  `watchEffect(async () => { await nextTick(); ...dispatchMountAutoFocus... })`, which is
  **racing at the same microtask-level timing** as this component's own `nextTick()` + `focus()`
  inside `watch(() => props.open, ...)` — empirically which one wins is not deterministic (under
  jsdom, reka's dispatch runs later and steals focus back to `.sk-x`). Switching to a macrotask-
  level delay (`setTimeout(fn, 0)`) empirically wins reliably and lands focus on the name input,
  no longer getting stolen by reka's default behavior (this doesn't change SkModal's own default
  focus logic, it only overrides it later within this component, and doesn't affect the two
  existing consumers ChannelsSection/McpTokensSection's default focus behavior).

  ===== Implementation details that aren't "deliberate deviations" but still need explaining =====
  In Vue2, every time this modal opens the parent's `v-if` recreates a fresh component instance
  (`mounted()` naturally only runs once, so the form always starts blank). This component instead
  uses SkModal's `open` prop to control visibility — the component instance itself is persistent
  and isn't recreated on every open/close. Without an explicit reset, reopening after "Cancel"
  would show the previous input still lingering. This isn't new behavior, it's there to preserve
  Vue2's visible behavior of "every open is a blank form" after the architecture change:
  `watch(open)` resets every field on close (`v === false`); not separately declared as a
  behavioral deviation here.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SkModal from '../SkModal.vue'
import AgentIcon from '../../icons/AgentIcon.vue'
import { SKILL_COLOR_IDS } from './SkillTile.vue'
import { validateSkillForm } from '../../../util/skillsErrorKey'
// SP8-P3b Task 8 — Coordinator pre-disambiguation ①: `SkillFormPayload`/`SkillScript` moved to
// `types/skill.ts` and exported (pure relocation, fields unchanged), so `SkillsSection.vue`'s
// `onCreate` can type-annotate the `@save` payload. See the "Task 8" section in skill.ts's header comment.
import type { SkillFormPayload } from '../../../types/skill'

interface PickedFile { name: string; content: string; size: number }

const props = defineProps<{ open: boolean; saving: boolean; serverError: string }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'save', payload: SkillFormPayload): void
}>()

const { t } = useI18n()

const name = ref('')
const description = ref('')
const trigger = ref<'auto' | 'slash' | 'manual'>('auto')
const color = ref<string>(SKILL_COLOR_IDS[0]) // Vue2 data() color: 'blue' — the first id is blue
const md = ref('')
const files = ref<PickedFile[]>([])
const skippedCount = ref(0)
const localErrorKey = ref('')

const nameInputEl = ref<HTMLInputElement | null>(null)
const filesInputEl = ref<HTMLInputElement | null>(null)

// Vue2 :137-139 — the button's disabled condition only checks that both fields are non-empty; full validation only runs in submit().
const valid = computed(() => name.value.trim().length > 0 && description.value.trim().length > 0)

// Deviation 2: local validation errors take display priority; the two are mutually exclusive
// (if local validation fails no request is sent, so serverError is never non-empty at the same
// time as a local error).
const errorText = computed(() => (localErrorKey.value ? t(localErrorKey.value) : props.serverError || ''))

// Matches the established approach in ChannelsSection.vue:176-177 — clear the old error as soon
// as the user touches a field, so it doesn't still show last time's red text after editing.
watch([name, description], () => { localErrorKey.value = '' })

const triggerOptions: { id: 'auto' | 'slash' | 'manual'; nameKey: string; descKey: string }[] = [
  { id: 'auto', nameKey: 'aiSkTrigOptAuto', descKey: 'aiSkTrigDescAuto' },
  { id: 'slash', nameKey: 'aiSkTrigOptSlash', descKey: 'aiSkTrigDescSlash' },
  // The "manual" option name reuses aiSkTagManual (same word as the "Manual" tag in the
  // skills list, Vue2 :147 also uses the same $t('Manual')) — one of the reusable keys
  // called out in common constraint §7.
  { id: 'manual', nameKey: 'aiSkTagManual', descKey: 'aiSkTrigDescManual' },
]

// Vue2 :150-153 computed mdPlaceholder。
const mdPlaceholder = computed(() => {
  const head = name.value.trim() || t('aiSkMdPlaceholderHead')
  return `## ${head}\n\n${t('aiSkMdPlaceholderBody')}`
})

function resetForm() {
  name.value = ''
  description.value = ''
  trigger.value = 'auto'
  color.value = SKILL_COLOR_IDS[0]
  md.value = ''
  files.value = []
  skippedCount.value = 0
  localErrorKey.value = ''
  if (filesInputEl.value) filesInputEl.value.value = ''
}

watch(
  () => props.open,
  (v) => {
    if (!v) {
      resetForm()
      return
    }
    // Explicitly focus the name input, matching Vue2 :133-135. See the header comment's "reka
    // initial-focus empirical finding" — a macrotask-level delay is required to reliably beat
    // reka FocusScope's own mount-auto-focus.
    setTimeout(() => { nameInputEl.value?.focus() }, 0)
  },
  { immediate: true },
)

async function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const list = Array.from(input.files || [])
  const out: PickedFile[] = []
  let skipped = 0
  for (const f of list) {
    if (f.size > 1024 * 1024) {
      // Deviation 3: Vue2 :164-167 does a bare continue and silently drops the file; here we accumulate a skip count and show an inline hint.
      skipped++
      continue
    }
    const text = await f.text()
    out.push({ name: f.name, content: text, size: f.size })
  }
  files.value = out
  skippedCount.value = skipped
}

function submit() {
  if (!valid.value) return
  const key = validateSkillForm(name.value, description.value)
  if (key) {
    localErrorKey.value = key
    return
  }
  localErrorKey.value = ''
  emit('save', {
    name: name.value.trim(),
    title: name.value.trim(),
    description: description.value.trim(),
    trigger: trigger.value,
    color: color.value,
    md: md.value.trim(),
    examples: [],
    scripts: files.value.map((f) => ({ path: 'scripts/' + f.name, content: f.content })),
  })
}

function onCancel() {
  emit('update:open', false)
}
</script>

<template>
  <SkModal :open="props.open" :title="t('aiSkAddTitle')" @update:open="(v) => emit('update:open', v)">
    <p v-if="errorText" class="sk-field-err" role="alert">{{ errorText }}</p>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkFieldName') }}</label>
      <input
        ref="nameInputEl"
        type="text"
        :placeholder="t('aiSkNamePlaceholder')"
        v-model="name"
        @keydown.enter.prevent
      >
      <div class="sk-field-hint">{{ t('aiSkNameHint') }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkDescription') }}</label>
      <textarea :placeholder="t('aiSkDescPlaceholder')" v-model="description" />
      <div class="sk-field-hint">{{ t('aiSkDescFormHint') }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkTrigger') }}</label>
      <div class="sk-trig-options">
        <button
          v-for="o in triggerOptions" :key="o.id" type="button" class="sk-trig-option"
          :data-active="trigger === o.id ? 'true' : 'false'"
          @click="trigger = o.id"
        >
          <span class="name">{{ t(o.nameKey) }}</span>
          <span class="desc">{{ t(o.descKey) }}</span>
        </button>
      </div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiSkFieldColor') }}</label>
      <div class="sk-color-row">
        <div
          v-for="id in SKILL_COLOR_IDS" :key="id" class="sk-color-dot"
          :data-color="id"
          :data-active="color === id ? 'true' : 'false'"
          @click="color = id"
        />
      </div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">
        SKILL.md
        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
      </label>
      <textarea
        v-model="md"
        :placeholder="mdPlaceholder"
        style="min-height: 110px; font-family: var(--font-mono); font-size: 12.5px"
      />
    </div>

    <div class="sk-field">
      <label class="sk-field-label">
        {{ t('aiSkScriptFiles') }}
        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
      </label>
      <input ref="filesInputEl" type="file" multiple @change="onFilesPicked">
      <div class="sk-field-hint">{{ t('aiSkScriptsHint') }}</div>
      <div v-if="skippedCount > 0" class="sk-field-hint">{{ t('aiSkFilesSkippedTooBig', { n: skippedCount }) }}</div>
      <ul v-if="files.length" style="font-size: 12px; color: var(--text-tertiary); margin-top: 6px">
        <li v-for="f in files" :key="f.name">{{ f.name }} — {{ f.size }} B</li>
      </ul>
    </div>

    <template #footerLeft>
      <span class="save-note">
        <AgentIcon name="check" :size="11" />
        {{ t('aiSkSavedLocally') }}
      </span>
    </template>
    <template #footer>
      <button type="button" class="sk-btn ghost" @click="onCancel">{{ t('aiCancel') }}</button>
      <button type="button" class="sk-btn primary" :disabled="!valid || props.saving" @click="submit">
        <AgentIcon name="plus" :size="13" />
        {{ props.saving ? t('aiSkCreating') : t('aiSkCreate') }}
      </button>
    </template>
  </SkModal>
</template>
