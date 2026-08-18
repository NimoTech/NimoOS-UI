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

