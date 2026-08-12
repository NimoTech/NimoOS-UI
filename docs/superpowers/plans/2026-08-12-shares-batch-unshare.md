# Shares Page Batch Unshare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-select to the shares page (`/files/shares`) so the user can check several shared folders and unshare them in one confirmed action.

**Architecture:** Selection state is a page-local `Set<number>` of share ids in `SharesPage.vue` (not Pinia — nothing else reads it, and it should die on navigation). Each `ShareRow` gains a hover-revealed checkbox. When selection > 0 a toolbar appears (count / select-all / deselect / unshare) styled after the existing files-area `SelectionToolbar.vue`. Batch unshare goes through a new `removeMany(ids)` store action: concurrent `Promise.allSettled` over the existing single-delete endpoint (backend has no batch endpoint), one reload, one toast; failed ids stay selected for retry.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + vue-i18n + reka-ui (`AlertDialog`), vitest + @vue/test-utils.

**Design provenance:** This is a New-UI enhancement authorized by the owner (2026-08-12). Verified: Vue2 `ShareListView.vue` has an empty checkbox container and never sets `isSelected` — there is no Vue2 behavior to port, so the 1:1 rule does not constrain this feature. Interaction approved by owner: per-row checkbox + toolbar. (One approved-design refinement: the toolbar uses Select all / Deselect *buttons* like the files area's `SelectionToolbar.vue`, instead of a tri-state master checkbox — consistency with the in-repo idiom.)

## Global Constraints

- Code comments, commit messages, and **test descriptions** in English only (owner ruling 2026-08-09). Conversation stays Chinese.
- All visible colors via theme tokens `var(--…)`; `var(--token, rgba(...))` fallback form is allowed (matches existing lines in the same files). No new bare color literals outside `var()` fallbacks.
- New i18n keys go into **both** `src/i18n/zh_cn.base.ts` and `src/i18n/en_us.base.ts` (parity test enforces). Do **not** create new i18n shard files.
- zh copy punctuation mirrors its neighbors in `zh_cn.base.ts` (half-width `?` and `,` — e.g. line 209 `吗?局域网…`).
- `git commit` must always use explicit pathspecs (`git commit -m "..." -- <paths>`); the main worktree carries unrelated local `design-export/*` deletions that must not be swept into commits. Never run `git checkout` / `git stash` / `git reset` / `git add -A` in this worktree.
- Run all test commands in the **foreground** and paste real output; do not background them.
- Working directory: `/home/nimo/NimoTech/NimoOS-New-UI` (main worktree, master).
- Dialog component tests must mount with `attachTo: document.body` (reka portals). Clean up by unmounting the tracked wrapper in `afterEach`; do **not** wipe `document.body.innerHTML` (it corrupts reka's global layer state — known flake root cause).

---

### Task 1: i18n keys + `removeMany` store action

**Files:**
- Modify: `src/i18n/zh_cn.base.ts` (after `filesUnshareConfirmMsg`, ~line 209)
- Modify: `src/i18n/en_us.base.ts` (after `filesUnshareConfirmMsg`, ~line 209)
- Modify: `src/files/stores/shares.ts`
- Test: `src/files/stores/shares.test.ts`

**Interfaces:**
- Consumes: `service.samba.deleteShare(id: number): Promise<void>` (existing, `packages/service/src/samba.ts:33`).
- Produces: `useSharesStore().removeMany(ids: number[]): Promise<{ failedIds: number[] }>` — resolves after list reload and toast; `failedIds` preserves the order of `ids`. i18n keys `filesUnshareBatchConfirmMsg` / `filesUnshareBatchDone` / `filesUnshareBatchPartial` (Task 3 uses the first one).

- [ ] **Step 1: Add i18n keys**

In `src/i18n/zh_cn.base.ts`, directly after the `filesUnshareConfirmMsg` line:

```ts
  filesUnshareBatchConfirmMsg: '确定取消共享这 {count} 个文件夹吗?局域网将无法再访问它们。',
  filesUnshareBatchDone: '已取消共享 {count} 项',
  filesUnshareBatchPartial: '已取消共享 {ok} 项,{fail} 项失败',
```

In `src/i18n/en_us.base.ts`, directly after the `filesUnshareConfirmMsg` line:

```ts
  filesUnshareBatchConfirmMsg: 'Stop sharing these {count} folders? They will no longer be accessible on the local network.',
  filesUnshareBatchDone: 'Unshared {count} item(s)',
  filesUnshareBatchPartial: 'Unshared {ok} item(s), {fail} failed',
```

- [ ] **Step 2: Run the i18n guards to verify parity**

Run: `pnpm exec vitest run src/i18n/parity.test.ts src/i18n/messageSyntax.test.ts`
Expected: PASS (both files got all three keys; placeholder syntax valid).

- [ ] **Step 3: Write the failing store tests**

Append to `src/files/stores/shares.test.ts` inside the existing `describe('useSharesStore', …)` block. Note the file's existing hoisted mocks (`listShares`, `deleteShare`) are reused; toast text is asserted via `useToast().msg` (the store-level pattern — do not query DOM). Add the import at the top of the file: `import { useToast } from '../../stores/toast'`.

```ts
  it('removeMany deletes every id, reloads once, toasts batch-done on full success', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7])
    expect(deleteShare).toHaveBeenCalledTimes(2)
    expect(deleteShare).toHaveBeenCalledWith(3)
    expect(deleteShare).toHaveBeenCalledWith(7)
    expect(listShares).toHaveBeenCalledTimes(1)
    expect(failedIds).toEqual([])
    expect(useToast().msg).toBe('已取消共享 2 项')
  })

  it('removeMany reports partial failure and returns the failed ids', async () => {
    listShares.mockResolvedValue([])
    deleteShare.mockImplementation(async (id: number) => {
      if (id === 7) throw new Error('boom')
    })
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7, 9])
    expect(failedIds).toEqual([7])
    expect(listShares).toHaveBeenCalledTimes(1) // still reloads exactly once
    expect(useToast().msg).toBe('已取消共享 2 项,1 项失败')
  })

  it('removeMany surfaces the backend message when every id fails', async () => {
    listShares.mockResolvedValue([])
    deleteShare.mockRejectedValue({ response: { data: { message: 'smb busy' } } })
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7])
    expect(failedIds).toEqual([3, 7])
    expect(useToast().msg).toBe('smb busy')
  })

  it('removeMany with empty ids is a no-op (no network, no toast)', async () => {
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([])
    expect(failedIds).toEqual([])
    expect(deleteShare).not.toHaveBeenCalled()
    expect(listShares).not.toHaveBeenCalled()
  })
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm exec vitest run src/files/stores/shares.test.ts`
Expected: 4 new tests FAIL with `s.removeMany is not a function`; the 4 pre-existing tests still PASS.

- [ ] **Step 5: Implement `removeMany`**

In `src/files/stores/shares.ts`, add after the existing `remove` function (before the `return`), and add `removeMany` to the returned object:

```ts
  // Batch unshare. The backend only has a per-id DELETE endpoint, so fan out
  // concurrently and settle all: one reload, one toast, failed ids returned so
  // the page can keep them selected for retry.
  async function removeMany(ids: number[]): Promise<{ failedIds: number[] }> {
    if (!ids.length) return { failedIds: [] }
    const results = await Promise.allSettled(ids.map((id) => service.samba.deleteShare(id)))
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected')
    await load()
    const ok = ids.length - failedIds.length
    if (!failedIds.length) {
      toast.show(t('filesUnshareBatchDone', { count: ok }))
    } else if (!ok) {
      const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      toast.show(errMsg(first?.reason) || t('filesShareFailed'))
    } else {
      toast.show(t('filesUnshareBatchPartial', { ok, fail: failedIds.length }))
    }
    return { failedIds }
  }
```

Change the return line to:

```ts
  return { items, loading, load, create, remove, removeMany }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/files/stores/shares.test.ts src/i18n/parity.test.ts`
Expected: PASS (8 store tests + parity).

- [ ] **Step 7: Commit**

```bash
git add src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/stores/shares.ts src/files/stores/shares.test.ts
git commit -m "feat(shares): add removeMany store action for batch unshare" -- src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/stores/shares.ts src/files/stores/shares.test.ts
```

---

### Task 2: ShareRow checkbox

**Files:**
- Modify: `src/files/shares/ShareRow.vue`
- Test: `src/files/shares/ShareRow.test.ts` (create)

**Interfaces:**
- Consumes: `ShareRow` type from `../stores/shares` (existing).
- Produces: `ShareRow.vue` accepts optional prop `selected?: boolean`, emits `(e: 'toggle-select', row: ShareRow)` when the checkbox changes. Root `.share-row-main` carries class `selected` when the prop is true. (Task 3 binds both.)

- [ ] **Step 1: Write the failing component test**

Create `src/files/shares/ShareRow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import ShareRow from './ShareRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const row = { id: 5, path: '/DATA/Documents', name: 'Documents' }

function mountRow(selected: boolean) {
  return mount(ShareRow, { props: { row, selected }, global: { plugins: [i18n] } })
}

describe('ShareRow selection checkbox', () => {
  it('renders a checkbox whose checked state follows the selected prop', () => {
    const off = mountRow(false)
    const on = mountRow(true)
    expect((off.find('input.share-check-box').element as HTMLInputElement).checked).toBe(false)
    expect((on.find('input.share-check-box').element as HTMLInputElement).checked).toBe(true)
    off.unmount(); on.unmount()
  })

  it('adds the selected class to the row body when selected', () => {
    const on = mountRow(true)
    const off = mountRow(false)
    expect(on.find('.share-row-main').classes()).toContain('selected')
    expect(off.find('.share-row-main').classes()).not.toContain('selected')
    on.unmount(); off.unmount()
  })

  it('emits toggle-select with the row when the checkbox changes', async () => {
    const w = mountRow(false)
    await w.find('input.share-check-box').setValue(true)
    expect(w.emitted('toggle-select')).toHaveLength(1)
    expect(w.emitted('toggle-select')![0]).toEqual([row])
    w.unmount()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/files/shares/ShareRow.test.ts`
Expected: FAIL — `input.share-check-box` not found.

- [ ] **Step 3: Implement the checkbox**

In `src/files/shares/ShareRow.vue`:

Replace the props/emits lines with:

```ts
const props = defineProps<{ row: ShareRow; selected?: boolean }>()
const emit = defineEmits<{ (e: 'get-link', row: ShareRow): void; (e: 'goto', row: ShareRow): void; (e: 'unshare', row: ShareRow): void; (e: 'toggle-select', row: ShareRow): void }>()
```

In the template, add the `selected` class binding and the checkbox before the icon:

```html
      <div class="share-row-main" :class="{ selected: props.selected }">
        <span class="share-check" @click.stop>
          <input
            type="checkbox"
            class="share-check-box"
            :checked="props.selected"
            :aria-label="props.row.name"
            @change="emit('toggle-select', props.row)"
          />
        </span>
        <img class="share-icon" :src="iconUrl('folder-default')" alt="" />
```

Append to the scoped styles (mirrors `FileTile.vue`'s hover-reveal checkbox; `var(--token, fallback)` form matches existing lines in this file):

```css
.share-check { flex: 0 0 auto; display: flex; align-items: center; }
.share-check-box { opacity: 0; cursor: pointer; }
.share-row-main:hover .share-check-box, .share-row-main.selected .share-check-box { opacity: 1; }
.share-row-main.selected { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
```

- [ ] **Step 4: Run tests to verify they pass (and no regression in the page suite)**

Run: `pnpm exec vitest run src/files/shares/`
Expected: PASS (new ShareRow tests + existing SharesPage/ShareLinkDialog tests untouched).

- [ ] **Step 5: Commit**

```bash
git add src/files/shares/ShareRow.vue src/files/shares/ShareRow.test.ts
git commit -m "feat(shares): hover-revealed selection checkbox on share rows" -- src/files/shares/ShareRow.vue src/files/shares/ShareRow.test.ts
```

---

### Task 3: Selection toolbar + SharesPage wiring

**Files:**
- Create: `src/files/shares/SharesSelectionToolbar.vue`
- Modify: `src/files/shares/SharesPage.vue`
- Test: `src/files/shares/SharesPage.multiselect.test.ts` (create)

**Interfaces:**
- Consumes: `removeMany(ids: number[]): Promise<{ failedIds: number[] }>` (Task 1); `ShareRow.vue` `selected` prop + `toggle-select` emit (Task 2); i18n keys `filesSelectedCount` / `filesSelectAll` / `filesClearSel` / `filesUnshare` / `filesCancel` / `filesUnshareConfirmTitle` (all pre-existing) and `filesUnshareBatchConfirmMsg` (Task 1); `AlertDialog.vue` (existing, `open/title/message/confirmText/cancelText/destructive` + `confirm` emit).
- Produces: user-facing feature; nothing downstream.

- [ ] **Step 1: Create the toolbar component**

Create `src/files/shares/SharesSelectionToolbar.vue` (styling copied from `src/files/components/SelectionToolbar.vue` with renamed root class — scoped styles cannot be shared across SFCs):

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ count: number; busy?: boolean }>()
const emit = defineEmits<{ (e: 'select-all'): void; (e: 'clear'): void; (e: 'unshare'): void }>()
const { t } = useI18n()
</script>

<template>
  <div class="shares-sel-toolbar">
    <span class="sel-count">{{ t('filesSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn sel-all" @click="emit('select-all')">{{ t('filesSelectAll') }}</button>
    <button class="sel-btn sel-clear" @click="emit('clear')">{{ t('filesClearSel') }}</button>
    <button class="sel-btn sel-unshare danger" :disabled="props.busy" @click="emit('unshare')">{{ t('filesUnshare') }}</button>
  </div>
</template>

<style scoped>
.shares-sel-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px; border-radius: 12px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 13px; }
.sel-count { flex: 0 0 auto; }
.sel-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: transparent; color: var(--fg); cursor: pointer; font-size: 12px; }
.sel-btn:hover { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.sel-btn:disabled { opacity: 0.5; cursor: default; }
.sel-btn.danger { color: var(--remove-fg, #ff8a8a); border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent); }
.sel-btn.danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 22%, transparent); }
@media (max-width: 768px) {
  .shares-sel-toolbar { flex-wrap: wrap; row-gap: 8px; }
}
</style>
```

- [ ] **Step 2: Write the failing page tests**

Create `src/files/shares/SharesPage.multiselect.test.ts`. The mock block is copied from `SharesPage.test.ts` (same reason: FilesSidebar needs router, onMounted hits `service.samba`/`service.storage`), with `deleteShare` lifted into the hoisted block so individual ids can be rejected. Dialog assertions query `document.body` because reka portals render outside the wrapper; mount with `attachTo: document.body` and unmount in `afterEach` (never wipe `document.body.innerHTML` — see Global Constraints).

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import SharesPage from './SharesPage.vue'

const { listShares, deleteShare } = vi.hoisted(() => ({
  listShares: vi.fn(),
  deleteShare: vi.fn(async () => {}),
}))

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      samba: { listShares, deleteShare },
      users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
      folder: { getList: vi.fn() },
      driver: { listDrivers: vi.fn().mockResolvedValue([]) },
      cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
      storage: { list: vi.fn().mockResolvedValue([]) },
    },
  }
})

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/files', name: 'files', component: { template: '<div/>' } },
    { path: '/files/shares', name: 'files-shares', component: { template: '<div/>' } },
    { path: '/files/:path(.*)*', name: 'files-path', component: { template: '<div/>' } },
  ],
})

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const ROWS = [
  { id: 1, path: '/DATA/Documents' },
  { id: 2, path: '/DATA/Media' },
  { id: 3, path: '/DATA/Downloads' },
]

let w: VueWrapper | undefined

async function mountPage() {
  w = mount(SharesPage, { global: { plugins: [i18n, testRouter] }, attachTo: document.body })
  await flushPromises()
  return w
}

// The literal text "取消共享" appears on row hover buttons, the toolbar button
// AND the dialog confirm button — never look buttons up by that text in
// document.body. Only one reka dialog renders its portal content at a time,
// so scoping to .ui-dialog-content is unambiguous.
function dialogConfirmButton(): HTMLButtonElement {
  const btn = document.body.querySelector('.ui-dialog-content .ui-btn.danger')
  expect(btn, 'an open dialog with a destructive confirm button').toBeTruthy()
  return btn as HTMLButtonElement
}

describe('SharesPage multi-select batch unshare', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    listShares.mockReset()
    deleteShare.mockReset()
    deleteShare.mockResolvedValue(undefined)
    listShares.mockResolvedValue(ROWS)
    await testRouter.push('/files/shares')
    await testRouter.isReady()
  })

  afterEach(() => {
    w?.unmount()
    w = undefined
  })

  it('toolbar is hidden until a row is checked, then shows the count', async () => {
    const page = await mountPage()
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
    await page.findAll('input.share-check-box')[0].setValue(true)
    expect(page.find('.shares-sel-toolbar').exists()).toBe(true)
    expect(page.find('.sel-count').text()).toBe('已选 1 项')
  })

  it('select-all checks every row; clear hides the toolbar again', async () => {
    const page = await mountPage()
    await page.findAll('input.share-check-box')[0].setValue(true)
    await page.find('.sel-all').trigger('click')
    expect(page.find('.sel-count').text()).toBe('已选 3 项')
    await page.find('.sel-clear').trigger('click')
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
  })

  it('confirming the batch dialog deletes every selected id', async () => {
    const page = await mountPage()
    // Reload after removeMany returns only the surviving row.
    listShares.mockResolvedValue([ROWS[2]])
    await page.findAll('input.share-check-box')[0].setValue(true)
    await page.findAll('input.share-check-box')[1].setValue(true)
    await page.find('.sel-unshare').trigger('click')
    const msg = document.body.querySelector('.ui-alert-msg')
    expect(msg?.textContent).toContain('2 个文件夹')
    dialogConfirmButton().click()
    await flushPromises()
    expect(deleteShare).toHaveBeenCalledTimes(2)
    expect(deleteShare).toHaveBeenCalledWith(1)
    expect(deleteShare).toHaveBeenCalledWith(2)
    // Selection cleared, toolbar gone, list re-rendered from reload.
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
    expect(page.findAll('.share-row')).toHaveLength(1)
  })

  it('failed ids stay selected after a partial failure', async () => {
    const page = await mountPage()
    deleteShare.mockImplementation(async (id: number) => {
      if (id === 2) throw new Error('boom')
    })
    // id 1 deleted, ids 2 and 3 remain on the server.
    listShares.mockResolvedValue([ROWS[1], ROWS[2]])
    await page.findAll('input.share-check-box')[0].setValue(true)
    await page.findAll('input.share-check-box')[1].setValue(true)
    await page.find('.sel-unshare').trigger('click')
    dialogConfirmButton().click()
    await flushPromises()
    // Only the failed id (2) is still selected → toolbar shows 1.
    expect(page.find('.sel-count').text()).toBe('已选 1 项')
    const checks = page.findAll('input.share-check-box')
    expect(checks).toHaveLength(2)
    expect((checks[0].element as HTMLInputElement).checked).toBe(true)  // id 2 (failed)
    expect((checks[1].element as HTMLInputElement).checked).toBe(false) // id 3 (untouched)
  })

  it('selection is pruned when rows disappear from a reload', async () => {
    const page = await mountPage()
    await page.findAll('input.share-check-box')[0].setValue(true) // select id 1
    // Single-row unshare of that same row via its own hover button + dialog.
    listShares.mockResolvedValue([ROWS[1], ROWS[2]])
    const unshareBtns = page.findAll('.share-act.danger')
    await unshareBtns[0].trigger('click')
    dialogConfirmButton().click()
    await flushPromises()
    // id 1 vanished from the reload; the stale selection must not survive.
    expect(page.find('.shares-sel-toolbar').exists()).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run src/files/shares/SharesPage.multiselect.test.ts`
Expected: FAIL — no `input.share-check-box` bindings / no `.shares-sel-toolbar` (SharesPage doesn't pass `selected` yet).

- [ ] **Step 4: Wire SharesPage**

In `src/files/shares/SharesPage.vue`:

Script changes — extend imports and add selection state below `delDlg`:

```ts
import { onMounted, ref, watch } from 'vue'
// ...existing imports...
import SharesSelectionToolbar from './SharesSelectionToolbar.vue'
```

```ts
const selected = ref<Set<number>>(new Set())
const batchDlg = ref(false)
const batchBusy = ref(false)

// Prune stale ids whenever the list reloads (single unshare, batch unshare,
// external changes) — a selection must never reference a row that is gone.
watch(() => shares.items, (items) => {
  const live = new Set(items.map((r) => r.id))
  const next = new Set([...selected.value].filter((id) => live.has(id)))
  if (next.size !== selected.value.size) selected.value = next
})

function toggleSelect(row: ShareRowT) {
  const next = new Set(selected.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  selected.value = next
}
function selectAllRows() { selected.value = new Set(shares.items.map((r) => r.id)) }
function clearSelection() { selected.value = new Set() }
function onBatchUnshare() { if (selected.value.size && !batchBusy.value) batchDlg.value = true }
async function confirmBatchUnshare() {
  if (batchBusy.value) return
  batchDlg.value = false
  batchBusy.value = true
  try {
    const { failedIds } = await shares.removeMany([...selected.value])
    // Keep failures selected so one more click retries exactly those.
    selected.value = new Set(failedIds)
  } finally {
    batchBusy.value = false
  }
}
```

Template changes — insert the toolbar between the `<h2>` and the empty-state `<p>`, bind the new row props, and append the batch dialog after the existing single-row `AlertDialog`:

```html
        <h2 class="shares-title">{{ t('filesSharesTitle') }}</h2>
        <SharesSelectionToolbar
          v-if="selected.size"
          :count="selected.size"
          :busy="batchBusy"
          @select-all="selectAllRows"
          @clear="clearSelection"
          @unshare="onBatchUnshare"
        />
```

```html
          <ShareRow
            v-for="row in shares.items"
            :key="row.id"
            :row="row"
            :selected="selected.has(row.id)"
            @get-link="onGetLink"
            @goto="onGoto"
            @unshare="onUnshare"
            @toggle-select="toggleSelect"
          />
```

```html
    <AlertDialog
      v-model:open="batchDlg"
      :title="t('filesUnshareConfirmTitle')"
      :message="t('filesUnshareBatchConfirmMsg', { count: selected.size })"
      :confirm-text="t('filesUnshare')"
      :cancel-text="t('filesCancel')"
      destructive
      @confirm="confirmBatchUnshare"
    />
```

- [ ] **Step 5: Run the shares suite to verify everything passes**

Run: `pnpm exec vitest run src/files/shares/`
Expected: PASS — new multiselect tests plus all pre-existing shares tests (the original `SharesPage.test.ts` must stay green: the goto-race test finds buttons by text, unaffected by the new checkbox).

- [ ] **Step 6: Commit**

```bash
git add src/files/shares/SharesSelectionToolbar.vue src/files/shares/SharesPage.vue src/files/shares/SharesPage.multiselect.test.ts
git commit -m "feat(shares): multi-select batch unshare with confirm dialog" -- src/files/shares/SharesSelectionToolbar.vue src/files/shares/SharesPage.vue src/files/shares/SharesPage.multiselect.test.ts
```

---

### Task 4: Full gates

**Files:** none new — verification only (fix-forward if a gate is red, commit fixes with pathspec).

- [ ] **Step 1: Type check**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: exit code 0, zero failures. Note: `color-guard.test.ts` generates cases per `.vue` file — the case count grows by the new component; that is expected, only failures matter. If `oss/*.test.mjs` fail with a dirty-tree message, that means uncommitted changes exist — commit first, never stash.

- [ ] **Step 3: OSS export guard specifically**

Run: `pnpm exec vitest run oss/`
Expected: PASS. The new files live under `src/files/shares/` (files area ships in the public export). If a manifest/tree guard flags the new files by name, follow the guard's own message to register them in `oss/manifest.mjs`; do not add forbidden-word whitelist entries.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: success (this also re-runs vue-tsc).

- [ ] **Step 5: Commit any gate fixes**

Only if Steps 1-4 required changes:

```bash
git add <exact files touched>
git commit -m "chore(shares): gate fixes for batch unshare" -- <exact files touched>
```
