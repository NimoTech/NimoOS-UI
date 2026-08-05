### Task 6: 删除快照 —— 确认弹窗 + 时间线接线

Vue2 用 `$buefy.dialog.confirm` 弹一个 danger 确认框(标题「删除快照」、正文「仅删除 {time} 的这个快照,你当前的文件不受影响。」、确认「删除」/取消)。New-UI 无该原语 → 新建 `SnapshotDeleteDialog.vue`(复用 `src/components/ui/Dialog.vue` 底座,照 `RaidDeleteDialog.vue` 骨架,但**不做 type-to-confirm**——删单个快照不是删阵列,确认强度照 Vue2 保持一次点击确认)。时间线条目动作区加删除按钮。

**Files:**
- Create: `src/storage/components/SnapshotDeleteDialog.vue`
- Test: `src/storage/components/SnapshotDeleteDialog.test.ts`
- Modify: `src/storage/components/SnapshotTimeline.vue`、`src/storage/components/SnapshotTimeline.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T6」的 3 个键)

**Interfaces:**
- Consumes: `Dialog`(`../../components/ui/Dialog.vue`);`store.removeSnapshot`/`store.deletingName`(T2)。
- Produces:
  - `SnapshotDeleteDialog` props `{ open: boolean; timeText: string; busy?: boolean }`,emits `{ (e:'update:open', v: boolean): void; (e:'confirm'): void }`(无 payload——目标由父组件持有)。稳定 class:`.sdd-msg`、`.sdd-ok`、`.sdd-cancel`。
  - `SnapshotTimeline` 条目动作区新增 `.st-delete` 按钮。

- [ ] **Step 1: 写失败测试**

`src/storage/components/SnapshotDeleteDialog.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotDeleteDialog from './SnapshotDeleteDialog.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotDeleteDialog, {
    props: { open: true, timeText: '2026/7/27 09:00:00', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

beforeEach(() => { document.body.innerHTML = '' })

describe('SnapshotDeleteDialog', () => {
  it('正文含被删快照的时间,并说明当前文件不受影响', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    const msg = document.body.querySelector('.sdd-msg') as HTMLElement
    expect(msg.textContent).toContain('2026/7/27 09:00:00')
  })
  it('点删除 → emit confirm(无 payload)', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    ;(document.body.querySelector('.sdd-ok') as HTMLButtonElement).click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([])
  })
  it('点取消 → emit update:open(false),不 emit confirm', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    ;(document.body.querySelector('.sdd-cancel') as HTMLButtonElement).click()
    expect(w.emitted('update:open')![0]).toEqual([false])
    expect(w.emitted('confirm')).toBeUndefined()
  })
  it('busy 时两个按钮都禁用(防连点)', async () => {
    const w = mountIt({ busy: true }); await w.vm.$nextTick()
    expect((document.body.querySelector('.sdd-ok') as HTMLButtonElement).disabled).toBe(true)
    expect((document.body.querySelector('.sdd-cancel') as HTMLButtonElement).disabled).toBe(true)
  })
})
```

追加到 `SnapshotTimeline.test.ts`:
```ts
describe('SnapshotTimeline 删除', () => {
  const one = [{ id: 1, name: '20260727T090000Z_manual_升级前', type: 'manual', created_at: day(27, 9) }]

  it('条目有删除按钮;点击弹确认框(此时还没发请求)', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    expect(w.find('.st-delete').exists()).toBe(true)
    await w.find('.st-delete').trigger('click'); await flush(w)
    expect(document.body.querySelector('.sdd-ok')).not.toBeNull()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('确认后才发 remove(name, uuid),成功则该条从列表消失', async () => {
    listMock.mockResolvedValue(one)
    removeMock.mockResolvedValue(undefined)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-ok') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).toHaveBeenCalledWith('20260727T090000Z_manual_升级前', 'u1')
    expect(w.findAll('.st-item')).toHaveLength(0)
  })

  it('取消 → 不发请求,条目还在', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-cancel') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).not.toHaveBeenCalled()
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
})
```
> 注:`SnapshotTimeline.test.ts` 顶部 mock 里的 `remove: vi.fn()` 要改成具名 `const removeMock = vi.fn()` 并在工厂里转发;`beforeEach` 里加 `document.body.innerHTML = ''`(弹窗走 portal 挂 body,不清会串味——`FormatDialog.test.ts` 同款处理)。

- [ ] **Step 2: 运行测试确认失败** → FAIL。

- [ ] **Step 3: 实现**

`SnapshotDeleteDialog.vue`:
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

defineProps<{ open: boolean; timeText: string; busy?: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm'): void }>()
const { t } = useI18n()
</script>

<template>
  <Dialog :open="open" :title="t('snapDeleteTitle')" @update:open="emit('update:open', $event)">
    <p class="sdd-msg">{{ t('snapDeleteMsg', { time: timeText }) }}</p>
    <template #footer>
      <button class="sdd-cancel" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button class="sdd-ok" type="button" :disabled="busy" @click="emit('confirm')">{{ t('snapDelete') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.sdd-msg { margin: 0; font-size: 14px; color: var(--fg-muted); }
.sdd-cancel, .sdd-ok {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.sdd-ok { color: var(--remove-fg); border-color: var(--remove-fg); }
.sdd-cancel:disabled, .sdd-ok:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
```

`SnapshotTimeline.vue`:
```ts
import SnapshotDeleteDialog from './SnapshotDeleteDialog.vue'
import type { SnapshotItemView } from '../util/snapshotView'

const deleteOpen = ref(false)
const deleteTarget = ref<SnapshotItemView | null>(null)
// 弹窗正文里的时间:Vue2 用 new Date(item.createdAt).toLocaleString()
const deleteTimeText = computed(() =>
  deleteTarget.value ? new Date(deleteTarget.value.createdAt).toLocaleString() : '',
)

function confirmDelete(item: SnapshotItemView) {
  deleteTarget.value = item
  deleteOpen.value = true
}

async function onDeleteConfirmed() {
  const target = deleteTarget.value
  if (!target) return
  const ok = await store.removeSnapshot(props.volumeUuid, target.name)
  if (ok) { deleteOpen.value = false; deleteTarget.value = null }
}
```
动作区占位注释换成:
```vue
            <div class="st-actions">
              <!-- [浏览] 未迁:文件区快照只读浏览套件推迟到独立一期(见 P5 计划台账) -->
              <button
                class="st-delete"
                type="button"
                :disabled="store.deletingName !== null"
                @click="confirmDelete(item)"
              >{{ t('snapDelete') }}</button>
            </div>
```
根节点末尾挂弹窗:
```vue
    <SnapshotDeleteDialog
      :open="deleteOpen"
      :time-text="deleteTimeText"
      :busy="store.deletingName !== null"
      @update:open="deleteOpen = $event"
      @confirm="onDeleteConfirmed"
    />
```
样式补:
```css
.st-delete {
  padding: 3px 10px; border-radius: 999px; font-size: 11px; cursor: pointer;
  border: 1px solid var(--remove-fg); background: var(--chip-bg); color: var(--remove-fg);
}
.st-delete:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotDeleteDialog.vue src/storage/components/SnapshotDeleteDialog.test.ts src/storage/components/SnapshotTimeline.vue src/storage/components/SnapshotTimeline.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 删除快照确认弹窗+时间线接线(P5 T6)"
```

---

