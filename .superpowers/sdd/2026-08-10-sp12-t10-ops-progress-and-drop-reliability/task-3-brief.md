### Task 3: 上传框对文件操作可见 —— 门控与自动弹开

**Files:**
- Modify: `src/files/components/UploadPanel.vue`
- Test: `src/files/components/UploadPanel.test.ts`(不存在则新建)

**Interfaces:**
- Consumes: `useFileOpsStore()` from `src/files/stores/fileOps.ts`(`active: FileTask[]`)

**这是本批最容易被漏掉的一条。** `totalCount` 是**上传队列长度**;不改门控,「只粘贴、没在上传」这个最常见场景下后面 Task 4 加的分组**永远看不见**,而只喂上传队列的单测**照不出来**。

- [ ] **Step 1: 写失败测试**

```ts
// src/files/components/UploadPanel.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '../../i18n'
import UploadPanel from './UploadPanel.vue'
import { useFileOpsStore } from '../stores/fileOps'
import type { FileTask } from '../util/fileOps'

function opsTask(over: Partial<FileTask> = {}): FileTask {
  return {
    id: 'op1', type: 'copy', finished: false, status: 'PROCESSING',
    processing_path: '/DATA/Documents/big.iso',
    processed_size: 30, total_size: 100, to: '/DATA/Downloads',
    ...over,
  }
}

describe('UploadPanel visibility', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('stays hidden when neither uploads nor file operations are running', () => {
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.upload-panel-wrap').exists()).toBe(false)
  })

  it('appears for file operations alone, with no uploads queued at all', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask()]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.upload-panel-wrap').exists()).toBe(true)
  })

  it('opens itself when a file operation starts while the panel sits collapsed', async () => {
    const ops = useFileOpsStore()
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    ops.active = [opsTask()]
    await w.vm.$nextTick()
    expect(w.find('.upload-panel').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
Expected: 后两条 FAIL(`.upload-panel-wrap` 不存在)

- [ ] **Step 3: 改实现**

在 `<script setup>` 里,`const totalCount = ...` 附近加:

```ts
import { useFileOpsStore } from '../stores/fileOps'

const ops = useFileOpsStore()

// The panel is shared by two independent queues. `totalCount` is the upload
// queue alone; gating on it would hide the file-operation group in the most
// common case of all -- a paste with nothing uploading.
const opsCount = computed(() => ops.active.length)
const panelVisible = computed(() => totalCount.value > 0 || opsCount.value > 0)
```

把已有的 `watch` 换成同时监听两路(保留 `shouldAutoOpenUploadList` 的既有语义,不要改那个纯函数):

```ts
watch(
  () => store.queue.length,
  (curLen, prevLen) => {
    if (shouldAutoOpenUploadList(prevLen ?? 0, curLen)) open.value = true
  },
)
// Same rule for file operations: an empty -> non-empty transition pops the
// panel open. Reuses the upload helper so both queues share one definition of
// "something just started".
watch(
  opsCount,
  (cur, prev) => {
    if (shouldAutoOpenUploadList(prev ?? 0, cur)) open.value = true
  },
)
```

模板里把最外层 `v-if="totalCount"` 换成 `v-if="panelVisible"`,折叠态按钮的计数改成 `{{ totalCount + opsCount }}`:

```vue
  <div v-if="panelVisible" class="upload-panel-wrap">
    <button v-if="!open" class="upload-panel-toggle" @click="open = true">
      {{ t('filesUploadTitle') }} ({{ totalCount + opsCount }})
    </button>
```

⚠️ 头部那句 `<span class="up-title">{{ t('filesUploadTitle') }}</span>` **本任务不动**,Task 4 再接三态。
⚠️ 「全部删除」按钮的 `v-if="totalCount"` **保持不变** —— 它删的是上传队列,不该因为有粘贴任务而出现。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
Expected: 3/3 PASS

- [ ] **Step 5: 跑既有全套上传相关测试,确认没打破**

Run: `pnpm exec vitest run src/files/`
Expected: 全绿

- [ ] **Step 6: 变异验证**

把 `panelVisible` 改回 `totalCount.value > 0`,重跑 → 后两条必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/components/UploadPanel.vue src/files/components/UploadPanel.test.ts
git commit -m "feat(files): let the upload panel open for file operations too

Gating on the upload queue alone would hide the incoming file-operation
group in its most common case: a paste with nothing uploading.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

