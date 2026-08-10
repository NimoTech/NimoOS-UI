### Task 9: Settings > Terminal Security section

**Files:**
- Create: `src/settings/panels/terminal/TerminalSecuritySection.vue`
- Modify: `src/settings/panels/TerminalPanel.vue` (replace the empty-state block; logs card untouched)
- Test: `src/settings/panels/terminal/TerminalSecuritySection.test.ts`, plus extend `src/settings/panels/TerminalPanel.test.ts` if it exists (check first: `ls src/settings/panels/TerminalPanel.test.ts`)

**Interfaces:**
- Consumes: `service.terminal.getSettings/putSettings` (Task 2), `statusOf`/`errorBody` (Task 4), `useSessionStore().isAdmin`, i18n keys (Task 3), `.set-*` styles from `src/settings/styles/settings.css`.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing tests**

Create `src/settings/panels/terminal/TerminalSecuritySection.test.ts` (mount plainly — global i18n from `vitest.setup.ts`; mirror `DeveloperPanel.test.ts` for the service-mock shape):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const getSettings = vi.fn()
const putSettings = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      getSettings: () => getSettings(),
      putSettings: (b: unknown) => putSettings(b),
    },
  },
}))

import TerminalSecuritySection from './TerminalSecuritySection.vue'

function httpErr(status?: number, data?: unknown) {
  const e = new Error('http') as Error & { response?: { status: number; data: unknown } }
  if (status !== undefined) e.response = { status, data }
  return e
}

beforeEach(() => {
  vi.useFakeTimers()
  getSettings.mockReset().mockResolvedValue({ mode: 'idle', idle_minutes: 15 })
  putSettings.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers() })

async function mountReady() {
  const w = mount(TerminalSecuritySection)
  await flushPromises()
  return w
}

describe('TerminalSecuritySection', () => {
  it('loads the current policy into the form', async () => {
    const w = await mountReady()
    const rows = w.findAll('[data-test="mode-row"]')
    expect(rows).toHaveLength(3)
    expect(w.find('[data-test-mode="idle"] .term-sec-radio').classes()).toContain('on')
    expect((w.find('[data-test="idle-minutes"]').element as HTMLInputElement).value).toBe('15')
  })

  it('falls back to the unavailable empty state when the service does not answer (registered deviation, spec §3.4-2)', async () => {
    getSettings.mockRejectedValue(httpErr())
    const w = await mountReady()
    expect(w.find('[data-test="term-sec-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="mode-row"]').exists()).toBe(false)
  })

  it('saving asks for the password inline, then PUTs policy + password', async () => {
    const w = await mountReady()
    await w.find('[data-test-mode="off"]').trigger('click')
    await w.find('[data-test="sec-save"]').trigger('click')
    expect(putSettings).not.toHaveBeenCalled() // confirm step first
    await w.find('[data-test="sec-pw"]').setValue('hunter2')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(putSettings).toHaveBeenCalledWith({ mode: 'off', idle_minutes: 15, password: 'hunter2' })
    expect(w.find('[data-test="sec-saved"]').exists()).toBe(true)
  })

  it('clamps idle minutes into 1-240 before saving', async () => {
    const w = await mountReady()
    await w.find('[data-test="idle-minutes"]').setValue('999')
    await w.find('[data-test="sec-save"]').trigger('click')
    await w.find('[data-test="sec-pw"]').setValue('pw')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(putSettings).toHaveBeenCalledWith({ mode: 'idle', idle_minutes: 240, password: 'pw' })
  })

  it('shows the wrong-password line on 401 and keeps the confirm open', async () => {
    putSettings.mockRejectedValue(httpErr(401, {}))
    const w = await mountReady()
    await w.find('[data-test="sec-save"]').trigger('click')
    await w.find('[data-test="sec-pw"]').setValue('bad')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sec-pw-error"]').exists()).toBe(true)
    expect(w.find('[data-test="sec-pw"]').exists()).toBe(true)
  })

  it('starts the freeze countdown on 429 and disables confirm until it ends', async () => {
    putSettings.mockRejectedValue(httpErr(429, { retry_after_seconds: 2 }))
    const w = await mountReady()
    await w.find('[data-test="sec-save"]').trigger('click')
    await w.find('[data-test="sec-pw"]').setValue('pw')
    await w.find('[data-test="sec-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sec-frozen"]').text()).toContain('2')
    expect((w.find('[data-test="sec-confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect((w.find('[data-test="sec-confirm"]').element as HTMLButtonElement).disabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/settings/panels/terminal/TerminalSecuritySection.test.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the section**

Create `src/settings/panels/terminal/TerminalSecuritySection.vue`:

```vue
<script setup lang="ts">
// Settings > Terminal > Security: the three-mode lock policy, 1:1 port of Vue2
// TerminalSecuritySection.vue with two registered deviations (spec §3.4):
//   1. Load failure renders the pre-existing "terminal unavailable" empty state
//      instead of an interactive form whose Save can only fail — Vue2 silently
//      kept defaults (the exact fake-form D7 rejected).
//   2. putSettings opts out of the shared 401 refresh-replay (service layer) so
//      one typo burns exactly one of the backend's 5-per-15min attempts.
// The password step-up is inline, not a dialog (1:1 Vue2; errors answer the
// button they belong to).
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type TerminalMode } from '@nimotech/nimoos-service'
import { statusOf, errorBody } from '../../../terminal/terminalHttp'
import '../../styles/settings.css'

const { t } = useI18n()

const phase = ref<'loading' | 'ready' | 'unavailable'>('loading')
const mode = ref<TerminalMode>('idle')
const idleMinutes = ref(15)
const saved = ref(false)
const confirming = ref(false)
const saving = ref(false)
const password = ref('')
const pwError = ref(false)
const saveError = ref(false)
const frozenSeconds = ref(0)
let frozenTimer: ReturnType<typeof setInterval> | undefined
let loadSeq = 0

const MODES: { value: TerminalMode; label: string }[] = [
  { value: 'off', label: 'termModeOff' },
  { value: 'on_open', label: 'termModeOnOpen' },
  { value: 'idle', label: 'termModeIdle' },
]

async function load() {
  const seq = ++loadSeq
  try {
    const s = await service.terminal.getSettings()
    if (seq !== loadSeq) return
    mode.value = s.mode
    idleMinutes.value = Number(s.idle_minutes)
    phase.value = 'ready'
  } catch {
    if (seq !== loadSeq) return
    phase.value = 'unavailable'
  }
}
void load()

function beginSave() {
  saved.value = false; pwError.value = false; saveError.value = false
  password.value = ''
  confirming.value = true
}

function cancelSave() {
  confirming.value = false
  password.value = ''; pwError.value = false; saveError.value = false
  clearFrozen()
}

async function confirmSave() {
  if (frozenSeconds.value > 0 || saving.value) return
  pwError.value = false; saveError.value = false
  saving.value = true
  // Clamp to the backend's documented 1-240 range (Vue2 relied on b-numberinput).
  const minutes = Math.min(240, Math.max(1, Math.round(Number(idleMinutes.value) || 1)))
  idleMinutes.value = minutes
  try {
    await service.terminal.putSettings({ mode: mode.value, idle_minutes: minutes, password: password.value })
    saved.value = true
    confirming.value = false
    password.value = ''
  } catch (e) {
    const st = statusOf(e)
    if (st === 429) startFrozen(errorBody(e)?.retry_after_seconds ?? 60)
    else if (st === 401) pwError.value = true
    else saveError.value = true
  } finally {
    saving.value = false
  }
}

function startFrozen(sec: number) {
  frozenSeconds.value = sec
  clearFrozen(false)
  frozenTimer = setInterval(() => {
    frozenSeconds.value -= 1
    if (frozenSeconds.value <= 0) clearFrozen()
  }, 1000)
}

function clearFrozen(resetSeconds = true) {
  if (frozenTimer) { clearInterval(frozenTimer); frozenTimer = undefined }
  if (resetSeconds) frozenSeconds.value = 0
}

onUnmounted(() => clearFrozen())
</script>

<template>
  <div class="term-sec">
    <p class="set-comp-group-title">{{ t('termSecTitle') }}</p>

    <div v-if="phase === 'unavailable'" class="set-term-empty" data-test="term-sec-unavailable">
      <p class="set-row-label">{{ t('settingsTermUnavailable') }}</p>
      <p class="set-row-sub">{{ t('settingsTermUnavailableHint') }}</p>
    </div>

    <template v-else-if="phase === 'ready'">
      <div class="set-list term-sec-card">
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          class="set-list-item clickable"
          data-test="mode-row"
          :data-test-mode="m.value"
          @click="mode = m.value"
        >
          <span class="term-sec-radio" :class="{ on: mode === m.value }" aria-hidden="true"></span>
          <span class="set-row-text"><span class="set-row-label">{{ t(m.label) }}</span></span>
        </button>
        <div v-if="mode === 'idle'" class="set-list-item term-sec-minutes-row">
          <span class="set-row-text"><span class="set-row-label">{{ t('termIdleMinutes') }}</span></span>
          <input v-model.number="idleMinutes" data-test="idle-minutes" class="set-input term-sec-minutes" type="number" min="1" max="240" />
        </div>
      </div>

      <div v-if="!confirming" class="term-sec-save">
        <button type="button" class="set-btn primary" data-test="sec-save" @click="beginSave">{{ t('termSave') }}</button>
        <span v-if="saved" class="term-sec-saved" data-test="sec-saved">{{ t('termSaved') }}</span>
      </div>
      <div v-else class="term-sec-confirm">
        <p class="set-row-sub">{{ t('termConfirmPwHint') }}</p>
        <div class="term-sec-confirm-row">
          <input
            v-model="password"
            data-test="sec-pw"
            class="set-input term-sec-pw"
            type="password"
            :placeholder="t('termPwPlaceholder')"
            :disabled="frozenSeconds > 0"
            @keyup.enter="confirmSave"
          />
          <button type="button" class="set-btn primary" data-test="sec-confirm" :disabled="frozenSeconds > 0 || saving" @click="confirmSave">{{ t('termConfirm') }}</button>
          <button type="button" class="set-btn" data-test="sec-cancel" @click="cancelSave">{{ t('termCancel') }}</button>
        </div>
        <p v-if="pwError" class="set-danger" data-test="sec-pw-error">{{ t('termPwWrong') }}</p>
        <p v-else-if="saveError" class="set-danger" data-test="sec-save-error">{{ t('termSaveFailed') }}</p>
        <p v-if="frozenSeconds > 0" class="set-danger" data-test="sec-frozen">{{ t('termFrozen', { s: frozenSeconds }) }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.term-sec { margin-bottom: 24px; }
.term-sec-card { margin-bottom: 14px; }
.term-sec-radio {
  position: relative; display: inline-block; width: 18px; height: 18px; margin-right: 12px;
  border-radius: 50%; border: 2px solid var(--card-border); flex-shrink: 0;
  transition: border-color 0.2s;
}
.term-sec-radio.on { border-color: var(--accent); }
.term-sec-radio.on::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--accent); }
.term-sec-minutes { max-width: 96px; }
.term-sec-save { display: flex; align-items: center; gap: 12px; }
.term-sec-saved { font-size: 12px; color: var(--fg-muted); }
.term-sec-confirm-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.term-sec-pw { max-width: 220px; }
</style>
```

Verify `.set-danger` and `.set-term-empty` exist in `src/settings/styles/settings.css` (both were present at plan time: lines ~251 and the empty-state block used by `TerminalPanel.vue`); mirror `.set-list-item` usage from an existing panel (e.g. `GeneralPanel.vue`) if the bare `<button class="set-list-item">` markup renders wrong.

- [ ] **Step 4: Replace the empty state in `TerminalPanel.vue`**

In `src/settings/panels/TerminalPanel.vue`:
- Add imports: `import TerminalSecuritySection from './terminal/TerminalSecuritySection.vue'` and `import { useSessionStore } from '../../stores/session'`; add `const session = useSessionStore()`.
- Replace the empty-state block

```html
    <div class="set-term-empty">
      <p class="set-row-label">{{ t('settingsTermUnavailable') }}</p>
      <p class="set-row-sub">{{ t('settingsTermUnavailableHint') }}</p>
    </div>
```

with

```html
    <!-- SP18: the Security section replaces the former unavailable empty state.
         Admin-gated on the frontend, 1:1 with Vue2 (v-if isAdmin); non-admins
         see only the logs card below. The section itself falls back to the
         unavailable empty state when the service does not answer. -->
    <TerminalSecuritySection v-if="session.isAdmin" />
```

- Update the header comment of `TerminalPanel.vue`: the "授权偏离 #9 …空态" rationale is now history — rewrite that paragraph (in English, per SP18 comment rules) to say the terminal service exists since 2026-08-10 and the Security section landed with SP18, while the logs card stays as-is. Do NOT touch the logs card, its 5s polling, or the `loadSeq` guard.
- If `src/settings/panels/TerminalPanel.test.ts` exists, extend it: seed `localStorage.setItem('user', JSON.stringify({ role: 'admin' }))` → section rendered; role `user` → section absent, logs card still rendered. If it does not exist, add these two cases to `TerminalSecuritySection.test.ts`'s file as a separate `describe('TerminalPanel integration')` that mounts `TerminalPanel.vue` (mock `service.sys.getLogs` returning `''` in the service mock, and `service.terminal.getSettings` as already mocked). The panel reads `useSessionStore` — this describe needs `setActivePinia(createPinia())` in its `beforeEach` (the section-only tests above don't).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/settings/panels/`
Expected: ALL PASS (new section tests + panel integration + every pre-existing settings panel test).

- [ ] **Step 6: Commit**

```bash
git add src/settings/panels/terminal/TerminalSecuritySection.vue src/settings/panels/terminal/TerminalSecuritySection.test.ts src/settings/panels/TerminalPanel.vue
git add src/settings/panels/TerminalPanel.test.ts 2>/dev/null || true
git commit -m "feat(settings): terminal lock-policy security section replaces the unavailable empty state"
```

---

