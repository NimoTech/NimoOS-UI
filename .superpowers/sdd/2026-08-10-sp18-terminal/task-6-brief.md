### Task 6: `TerminalTabs` and `TerminalLockCard` presentation components

**Files:**
- Create: `src/terminal/TerminalTabs.vue`
- Create: `src/terminal/TerminalLockCard.vue`
- Test: `src/terminal/TerminalTabs.test.ts`, `src/terminal/TerminalLockCard.test.ts`

**Interfaces:**
- Consumes: `TerminalWindow` type (Task 2), i18n keys (Task 3).
- Produces (consumed by Task 7):
  - `TerminalTabs` props `{ windows: TerminalWindow[] }`, emits `select(i: number)`, `create()`, `close(i: number)`, `rename(i: number, name: string)`
  - `TerminalLockCard` props `{ pwError: boolean; frozenSeconds: number }`, emits `submit(pw: string)`

**Test-mount note:** `vitest.setup.ts` installs the app i18n globally — mount plainly with `mount(Comp, { props })`; do NOT create a local `createI18n` (duplicate-install trap).

- [ ] **Step 1: Write the failing tests**

`src/terminal/TerminalTabs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TerminalTabs from './TerminalTabs.vue'

const WINS = [
  { index: 0, name: 'zsh', active: true },
  { index: 1, name: 'build', active: false },
]

describe('TerminalTabs', () => {
  it('renders index:name labels and marks the active tab', () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    const tabs = w.findAll('[data-test="win-tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].text()).toContain('0:zsh')
    expect(tabs[0].classes()).toContain('is-active')
    expect(tabs[1].classes()).not.toContain('is-active')
  })

  it('emits select on click and close on the x (without also selecting)', async () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    await w.findAll('[data-test="win-tab"]')[1].trigger('click')
    expect(w.emitted('select')).toEqual([[1]])
    await w.findAll('[data-test="win-close"]')[0].trigger('click')
    expect(w.emitted('close')).toEqual([[0]])
    expect(w.emitted('select')).toEqual([[1]]) // close click must not bubble into select
  })

  it('emits create from the + button', async () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    await w.find('[data-test="win-add"]').trigger('click')
    expect(w.emitted('create')).toEqual([[]])
  })

  it('double-click opens the rename input; enter commits the trimmed name', async () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    await w.findAll('[data-test="win-tab"]')[1].trigger('dblclick')
    const input = w.find('[data-test="win-rename"]')
    expect(input.exists()).toBe(true)
    await input.setValue('  dev ')
    await input.trigger('keyup.enter')
    expect(w.emitted('rename')).toEqual([[1, '  dev ']]) // trimming is the composable's job
    expect(w.find('[data-test="win-rename"]').exists()).toBe(false)
  })
})
```

`src/terminal/TerminalLockCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TerminalLockCard from './TerminalLockCard.vue'

describe('TerminalLockCard', () => {
  it('emits submit with the typed password on enter and on the unlock button', async () => {
    const w = mount(TerminalLockCard, { props: { pwError: false, frozenSeconds: 0 } })
    await w.find('[data-test="pw-input"]').setValue('s3cret')
    await w.find('[data-test="pw-input"]').trigger('keyup.enter')
    await w.find('[data-test="pw-submit"]').trigger('click')
    expect(w.emitted('submit')).toEqual([['s3cret'], ['s3cret']])
  })

  it('shows the wrong-password line only when pwError', async () => {
    const w = mount(TerminalLockCard, { props: { pwError: true, frozenSeconds: 0 } })
    expect(w.find('[data-test="pw-error"]').exists()).toBe(true)
    await w.setProps({ pwError: false })
    expect(w.find('[data-test="pw-error"]').exists()).toBe(false)
  })

  it('freeze disables input and button and shows the countdown', () => {
    const w = mount(TerminalLockCard, { props: { pwError: false, frozenSeconds: 42 } })
    expect((w.find('[data-test="pw-input"]').element as HTMLInputElement).disabled).toBe(true)
    expect((w.find('[data-test="pw-submit"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-test="pw-frozen"]').text()).toContain('42')
  })

  it('carries the session-resume subtitle (backend boundary ③)', () => {
    const w = mount(TerminalLockCard, { props: { pwError: false, frozenSeconds: 0 } })
    expect(w.find('[data-test="lock-resume"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/terminal/TerminalTabs.test.ts src/terminal/TerminalLockCard.test.ts`
Expected: FAIL — components not found.

- [ ] **Step 3: Implement `TerminalTabs.vue`**

```vue
<script setup lang="ts">
// tmux window tab strip, 1:1 with Vue2 Terminal.vue's .term-tabs block
// (click select / dblclick rename / x close / + create), restyled onto theme
// tokens per spec §1 decision 1 (chrome follows the theme).
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TerminalWindow } from '@nimotech/nimoos-service'

defineProps<{ windows: TerminalWindow[] }>()
const emit = defineEmits<{ select: [i: number]; create: []; close: [i: number]; rename: [i: number, name: string] }>()
const { t } = useI18n()

const renamingIndex = ref(-1)
const renameText = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function beginRename(win: TerminalWindow) {
  renamingIndex.value = win.index
  renameText.value = win.name
  void nextTick(() => renameInput.value?.focus())
}
function commitRename(i: number) {
  if (renamingIndex.value !== i) return // blur after enter already committed
  renamingIndex.value = -1
  emit('rename', i, renameText.value)
}
</script>

<template>
  <div class="term-tabs" role="tablist">
    <div
      v-for="win in windows"
      :key="win.index"
      data-test="win-tab"
      class="term-tab"
      :class="{ 'is-active': win.active }"
      role="tab"
      :aria-selected="win.active"
      @click="emit('select', win.index)"
      @dblclick="beginRename(win)"
    >
      <template v-if="renamingIndex === win.index">
        <input
          ref="renameInput"
          v-model="renameText"
          data-test="win-rename"
          class="term-tab-input"
          @click.stop
          @keyup.enter="commitRename(win.index)"
          @blur="commitRename(win.index)"
        />
      </template>
      <template v-else>
        <span class="term-tab-label">{{ win.index }}:{{ win.name }}</span>
        <button
          type="button"
          data-test="win-close"
          class="term-tab-close"
          :title="t('termCloseWin')"
          :aria-label="t('termCloseWin')"
          @click.stop="emit('close', win.index)"
        >×</button>
      </template>
    </div>
    <button type="button" data-test="win-add" class="term-tab-add" :title="t('termNewWin')" :aria-label="t('termNewWin')" @click="emit('create')">＋</button>
  </div>
</template>

<style scoped>
.term-tabs { display: flex; align-items: center; gap: 6px; overflow-x: auto; }
.term-tab {
  display: inline-flex; align-items: center; height: 28px; padding: 0 10px;
  border-radius: 9px; border: 1px solid var(--card-border);
  background: transparent; color: var(--fg-muted);
  cursor: pointer; font-size: 13px; white-space: nowrap;
}
.term-tab.is-active { background: var(--chip-bg-hi); color: var(--fg); }
.term-tab-close {
  margin-left: 6px; border: 0; background: transparent; color: inherit;
  cursor: pointer; opacity: 0.6; font-size: 13px; padding: 0; line-height: 1;
}
.term-tab-close:hover { opacity: 1; }
.term-tab-add {
  height: 28px; min-width: 30px; border: 1px solid var(--card-border); border-radius: 9px;
  background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 13px;
}
.term-tab-add:hover { background: var(--chip-bg-hi); color: var(--fg); }
.term-tab-input {
  width: 90px; font-size: 13px; background: var(--chip-bg); color: var(--fg);
  border: 1px solid var(--accent); border-radius: 6px; outline: none; padding: 2px 6px;
}
</style>
```

- [ ] **Step 4: Implement `TerminalLockCard.vue`**

```vue
<script setup lang="ts">
// Lock overlay card, 1:1 with Vue2's .lock-card except: theme tokens instead of
// hardcoded dark values (spec §1 decision 1), plus a subtitle spelling out that
// the tmux session survives the lock (backend Known Boundary ③, spec §4-3).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ pwError: boolean; frozenSeconds: number }>()
const emit = defineEmits<{ submit: [pw: string] }>()
const { t } = useI18n()
const password = ref('')

function submit() { emit('submit', password.value) }
</script>

<template>
  <div class="term-lock">
    <div class="lock-card">
      <p class="lock-title">{{ t('termLockedTitle') }}</p>
      <p class="lock-resume" data-test="lock-resume">{{ t('termLockedResume') }}</p>
      <input
        data-test="pw-input"
        v-model="password"
        type="password"
        class="lock-input"
        :placeholder="t('termPwPlaceholder')"
        :disabled="frozenSeconds > 0"
        @keyup.enter="submit"
      />
      <p v-if="pwError" class="lock-error" data-test="pw-error">{{ t('termPwWrong') }}</p>
      <p v-if="frozenSeconds > 0" class="lock-error" data-test="pw-frozen">{{ t('termFrozen', { s: frozenSeconds }) }}</p>
      <button data-test="pw-submit" type="button" class="set-btn primary lock-submit" :disabled="frozenSeconds > 0" @click="submit">
        {{ t('termUnlock') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/styles/settings.css';
.term-lock {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--console-bg) 82%, transparent);
}
.lock-card {
  width: 320px; padding: 24px; border-radius: 16px;
  background: var(--card-bg); border: 1px solid var(--card-border); color: var(--fg);
}
.lock-title { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
.lock-resume { margin: 0 0 14px; font-size: 12px; color: var(--fg-muted); }
.lock-input {
  width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 13px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border);
  border-radius: 9px; outline: none;
}
.lock-input:focus { border-color: var(--accent); }
.lock-error { margin: 8px 0 0; font-size: 12px; color: var(--danger-fg); }
.lock-submit { margin-top: 14px; }
</style>
```

Before committing, verify the token names used above actually exist in BOTH theme blocks of `src/styles/theme.css` (`--card-bg`, `--card-border`, `--chip-bg`, `--chip-bg-hi`, `--fg`, `--fg-muted`, `--accent`, `--danger-fg`, `--console-bg`): `grep -n -- '--card-bg\b' src/styles/theme.css` etc. If any is missing, pick the repo's actual equivalent from `docs/THEMING.md` rather than inventing a new token. If `@import` of settings.css inside a scoped style block doesn't resolve `.set-btn` (check the rendered test DOM), drop the `@import` and the `set-btn primary` classes and style `.lock-submit` locally with the same tokens `.set-btn.primary` uses.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/terminal/TerminalTabs.test.ts src/terminal/TerminalLockCard.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/TerminalTabs.vue src/terminal/TerminalLockCard.vue src/terminal/TerminalTabs.test.ts src/terminal/TerminalLockCard.test.ts
git commit -m "feat(terminal): window tab strip and lock card components"
```

---

