### Task 6: 批次详情弹窗（查看 + 放弃）

**Files:**
- Create: `src/files/components/UploadBatchModal.vue`, `src/files/components/UploadBatchModal.test.ts`
- Modify: `src/views/Files.vue`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`

**Interfaces:**
- Consumes: Task 1 的 `service.uploadBatches.getBatch` / `abandonBatch`；Task 5 的 `open-batch` 事件
- Produces: 组件 props `{ batchId: string }`，emits `(e:'close'):void` 与 `(e:'abandoned'):void`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/components/UploadBatchModal.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UploadBatchModal from './UploadBatchModal.vue'
import { i18n } from '../../i18n'

const getBatch = vi.fn()
const abandonBatch = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    uploadBatches: {
      getBatch: (...a: unknown[]) => getBatch(...a),
      abandonBatch: (...a: unknown[]) => abandonBatch(...a),
    },
  },
}))

const detail = {
  batch: { id: 'b1', target_path: '/DATA/x', status: 'interrupted', total: 3, done: 1 },
  missing: [
    { batch_id: 'b1', relative_path: 'Trip/a.jpg', size: 1024, done: false },
    { batch_id: 'b1', relative_path: 'Trip/b.jpg', size: 2048, done: false },
  ],
}

function mountModal() {
  return mount(UploadBatchModal, { props: { batchId: 'b1' }, global: { plugins: [i18n] } })
}

describe('UploadBatchModal', () => {
  beforeEach(() => { getBatch.mockReset(); abandonBatch.mockReset() })

  it('lists the missing files and the done/total count', async () => {
    getBatch.mockResolvedValue(detail)
    const w = mountModal()
    await flushPromises()
    expect(getBatch).toHaveBeenCalledWith('b1')
    const rows = w.findAll('.ubm-missing-item')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Trip/a.jpg')
    expect(w.text()).toContain('1')
    expect(w.text()).toContain('3')
  })

  it('shows a load-failure message when the batch cannot be read', async () => {
    getBatch.mockRejectedValue(new Error('boom'))
    const w = mountModal()
    await flushPromises()
    expect(w.find('.ubm-load-error').exists()).toBe(true)
    expect(w.find('.ubm-missing-item').exists()).toBe(false)
  })

  it('abandons and closes on success', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockResolvedValue(undefined)
    const w = mountModal()
    await flushPromises()
    await w.find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(abandonBatch).toHaveBeenCalledWith('b1')
    expect(w.emitted('abandoned')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
  })

  // #122:批次早被清扫掉 → 404。用户的目标本来就是"让角标消失",不该弹错误把人堵住。
  it('treats a 404 on abandon as already abandoned', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockRejectedValue({ response: { status: 404 } })
    const w = mountModal()
    await flushPromises()
    await w.find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(w.emitted('abandoned')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
    expect(w.find('.ubm-error').exists()).toBe(false)
  })

  it('keeps the dialog open and shows the error on a non-404 failure', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockRejectedValue({ response: { status: 500 } })
    const w = mountModal()
    await flushPromises()
    await w.find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(w.emitted('abandoned')).toBeFalsy()
    expect(w.emitted('close')).toBeFalsy()
    // 弹窗内联报错,不用 toast:toast 是 z-index 60,会被遮罩(1000)压住且被 blur 糊掉。
    expect(w.find('.ubm-error').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
```
Expected: FAIL — 无法解析 `./UploadBatchModal.vue`

- [ ] **Step 3: 加 i18n 键**

`zh_cn.base.ts`：
```ts
  filesBatchTitle: '上传中断',
  filesBatchProgress: '已上传 {done} / {total} 个文件',
  filesBatchMissing: '缺失的文件',
  filesBatchLoadFailed: '无法加载批次详情',
  filesBatchAbandon: '放弃这批',
  filesBatchAbandonFailed: '放弃失败,请重试',
```
`en_us.base.ts`：
```ts
  filesBatchTitle: 'Upload interrupted',
  filesBatchProgress: 'Uploaded {done} of {total} files',
  filesBatchMissing: 'Missing files',
  filesBatchLoadFailed: 'Failed to load batch details',
  filesBatchAbandon: 'Abandon this batch',
  filesBatchAbandonFailed: 'Could not abandon the batch — try again',
```

- [ ] **Step 4: 实现组件**

创建 `src/files/components/UploadBatchModal.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { UploadBatch, UploadBatchItem } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { renderSize } from '../util/format'

const props = defineProps<{ batchId: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'abandoned'): void }>()
const { t } = useI18n()

const loading = ref(true)
const batch = ref<UploadBatch | null>(null)
const missing = ref<UploadBatchItem[]>([])
const abandoning = ref(false)
const errorText = ref('')

onMounted(async () => {
  try {
    const d = await service.uploadBatches.getBatch(props.batchId)
    batch.value = d.batch
    missing.value = d.missing
  } catch {
    batch.value = null
  } finally {
    loading.value = false
  }
})

async function abandon(): Promise<void> {
  if (abandoning.value) return
  abandoning.value = true
  errorText.value = ''
  try {
    await service.uploadBatches.abandonBatch(props.batchId)
    emit('abandoned')
    emit('close')
  } catch (e) {
    // 批次在服务端已不存在(过期被清扫 / 陈旧角标竞态)时返回 404。用户点这个按钮的目标
    // 就是"让角标消失",所以走成功路径刷新列表,而不是报服务器错误把人堵在弹窗里。
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      emit('abandoned')
      emit('close')
    } else {
      // 弹窗内报错必须内联:toast 的 z-index 低于遮罩,会被压住并被 blur 糊掉。
      errorText.value = t('filesBatchAbandonFailed')
    }
  } finally {
    abandoning.value = false
  }
}
</script>

<template>
  <Dialog :open="true" :title="t('filesBatchTitle')" @update:open="(v: boolean) => { if (!v) emit('close') }">
    <div v-if="loading" class="ubm-loading">…</div>
    <template v-else-if="batch">
      <p class="ubm-progress">{{ t('filesBatchProgress', { done: batch.done, total: batch.total }) }}</p>
      <p class="ubm-missing-title">{{ t('filesBatchMissing') }}</p>
      <ul class="ubm-missing-list">
        <li v-for="m in missing" :key="m.relative_path" class="ubm-missing-item">
          <span class="ubm-path" :title="m.relative_path">{{ m.relative_path }}</span>
          <span class="ubm-size">{{ renderSize(m.size) }}</span>
        </li>
      </ul>
    </template>
    <p v-else class="ubm-load-error">{{ t('filesBatchLoadFailed') }}</p>
    <p v-if="errorText" class="ubm-error">{{ errorText }}</p>

    <template #footer>
      <button class="ubm-btn ubm-danger ubm-abandon" :disabled="abandoning" @click="abandon">
        {{ t('filesBatchAbandon') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.ubm-progress { margin-bottom: 12px; color: var(--fg); }
.ubm-missing-title { font-weight: 600; margin-bottom: 6px; color: var(--fg); }
.ubm-missing-list { max-height: 240px; overflow-y: auto; }
.ubm-missing-item { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 3px 0; }
.ubm-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
.ubm-size { flex: 0 0 auto; color: var(--fg-muted); }
.ubm-load-error { color: var(--fg-muted); }
.ubm-error { margin-top: 10px; color: var(--remove-fg); }

/* 本仓没有全局 .ui-btn(已核:src/styles/*.css 零命中),按钮样式一律组件内定义 ——
   照 SelectionToolbar.vue 的 .sel-btn 写法。 */
.ubm-btn {
  padding: 4px 12px; border-radius: 999px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--chip-border); background: transparent; color: var(--fg);
}
.ubm-btn:hover { background: var(--chip-bg-hi); }
.ubm-btn:disabled { opacity: 0.5; cursor: default; }
/* 变体必须自带 :hover 背景 —— 基类 .ubm-btn:hover 的优先级(0,2,0)会压过变体
   .ubm-danger(0,1,0),不写这条就会 hover 成白底白字(本仓栽过)。 */
.ubm-danger { color: var(--remove-fg); border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent); }
.ubm-danger:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
</style>
```

> 已核实：`renderSize` 在 `src/files/util/format.ts:3`，签名 `(bytes: number | string) => string`，
> 上面的 import 路径正确。`--remove-fg` / `--remove-bg` / `--chip-border` / `--chip-bg-hi`
> 在 `theme.css` 的深浅两套主题块里都有值。

- [ ] **Step 5: 运行确认通过**

```bash
pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
```
Expected: 5 passed

- [ ] **Step 6: 接线 Files.vue**

1. import 组件与 `useFilesStore`（已有则跳过）
2. 加状态：
```ts
const batchModalId = ref('')
```
3. **两个中间层必须各加一次转发** —— 已核实 `FileGridView.vue` 与 `FileListView.vue`
   都是显式列举 emits 再逐个 `@x="emit('x', $event)"` 转发的，不透传未声明的事件，
   不补这一步事件到不了 `Files.vue`：

   两个文件的 `defineEmits` 各加一行：
```ts
  (e: 'open-batch', batchId: string): void
```
   模板里给 `<FileTile>` / `<FileRow>` 各加一行：
```html
      @open-batch="emit('open-batch', $event)"
```
   然后在 `Files.vue` 的 `<FileGridView>` 与 `<FileListView>` 上各加：
```html
@open-batch="(id: string) => (batchModalId = id)"
```
4. 模板底部挂弹窗：
```html
    <UploadBatchModal
      v-if="batchModalId"
      :batch-id="batchModalId"
      @close="batchModalId = ''"
      @abandoned="files.load(files.currentPath)"
    />
```

- [ ] **Step 7: 全量与类型检查**

```bash
pnpm test
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/i18n/parity.test.ts
```
Expected: 全绿

- [ ] **Step 8: 提交**

```bash
git add src/files/components/UploadBatchModal.vue src/files/components/UploadBatchModal.test.ts \
        src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): add the interrupted-batch dialog

Lists what did not make it and offers a way out. A 404 on abandon is treated
as success: the batch is already gone server-side, which is exactly what the
button was asking for, and reporting a server error would strand the user in
a dialog with nothing left to do.

The failure message is inline rather than a toast — toasts sit below the
dialog backdrop and get blurred by it."
```

---

