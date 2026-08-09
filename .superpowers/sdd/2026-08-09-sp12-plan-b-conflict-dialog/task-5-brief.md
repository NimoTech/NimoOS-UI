## Task 5: 冲突弹窗组件 `FileConflictDialog.vue` + i18n + danger token

**Files:**
- Create: `src/files/components/FileConflictDialog.vue`
- Test: `src/files/components/FileConflictDialog.test.ts`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`, `src/styles/theme.css`

**Interfaces:**
- Consumes: `src/components/ui/Dialog.vue`（reka-ui 基元）；Task 1 的 `ConflictChoice`
- Produces: 组件 props `{ open, name, targetPath, isDir, allowMerge, queueIndex, queueTotal }`，events `(e: 'choose', v: ConflictChoice)` / `(e: 'cancel')`

**新增 i18n 键（中文照抄 Vue2 `zh_CN.json`，英文照抄 Vue2 的英文 key 本身）**

| 键 | zh_cn | en_us |
|---|---|---|
| `filesConflictTitle` | `已存在同名项目` | `An item with this name already exists` |
| `filesConflictQueuePos` | `第 {index} 项，共 {total} 项` | `Item {index} of {total}` |
| `filesConflictHint` | `请选择如何处理这个同名冲突` | `Choose how to handle this name conflict` |
| `filesConflictDirNote` | `文件夹不支持覆盖 — 请选择保留两者或跳过` | `Folders cannot be overwritten — choose Keep both or Skip instead` |
| `filesConflictDirNoteMerge` | `合并进已有文件夹，或选择保留两者/跳过` | `Merge into the existing folder, or keep both / skip` |
| `filesConflictOverwriteDisabled` | `文件夹不支持覆盖` | `Folders cannot be overwritten` |
| `filesConflictApplyAll` | `应用于剩余全部项目` | `Apply to all remaining items` |
| `filesConflictMerge` | `合并` | `Merge` |
| `filesConflictKeepBoth` | `保留两者` | `Keep both` |
| `filesConflictSkip` | `跳过` | `Skip` |
| `filesConflictOverwrite` | `覆盖` | `Overwrite` |
| `filesUploadSkipped` | `已跳过 {count} 项` | `Skipped {count} item(s)` |

**删除的键**（旧的逐文件弹窗，Task 8 会一并把用它的模板删掉；两个 locale 都要删）：`filesUploadConflictTitle`、`filesUploadConflictMsg`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/components/FileConflictDialog.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileConflictDialog from './FileConflictDialog.vue'
import { i18n } from '../../i18n'

function open(props: Record<string, unknown> = {}) {
  return mount(FileConflictDialog, {
    props: { open: true, name: 'a.txt', targetPath: '/DATA/Documents', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}
const btn = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

describe('FileConflictDialog', () => {
  it('shows the conflicting name and its target directory', () => {
    open()
    expect(document.body.textContent).toContain('a.txt')
    expect(document.body.textContent).toContain('/DATA/Documents')
  })

  it('emits the chosen action', async () => {
    const w = open()
    btn('覆盖')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')![0]).toEqual([{ action: 'overwrite', applyToAll: false }])
  })

  it('offers keep both and skip for a plain file conflict, and no merge', () => {
    open()
    expect(btn('保留两者')).toBeTruthy()
    expect(btn('跳过')).toBeTruthy()
    expect(btn('合并')).toBeFalsy()
  })

  it('disables Overwrite for a directory conflict and explains why', () => {
    open({ isDir: true })
    expect((btn('覆盖') as HTMLButtonElement).disabled).toBe(true)
    expect(document.body.textContent).toContain('文件夹不支持覆盖')
  })

  it('a programmatic overwrite on a directory conflict emits nothing', async () => {
    const w = open({ isDir: true })
    ;(w.vm as unknown as { choose: (a: string) => void }).choose('overwrite')
    await w.vm.$nextTick()
    expect(w.emitted('choose')).toBeUndefined()
  })

  it('shows Merge only when allowMerge AND isDir are both true', () => {
    open({ isDir: true, allowMerge: true })
    expect(btn('合并')).toBeTruthy()
    document.body.innerHTML = ''
    open({ isDir: false, allowMerge: true })
    expect(btn('合并')).toBeFalsy()
  })

  it('a programmatic merge without allowMerge emits nothing', async () => {
    const w = open({ isDir: true, allowMerge: false })
    ;(w.vm as unknown as { choose: (a: string) => void }).choose('merge')
    await w.vm.$nextTick()
    expect(w.emitted('choose')).toBeUndefined()
  })

  it('hides the queue position and apply-to-all for a single conflict', () => {
    open({ queueIndex: 0, queueTotal: 1 })
    expect(document.body.textContent).not.toContain('共 1 项')
    expect(document.body.querySelector('input[type="checkbox"]')).toBeFalsy()
  })

  it('shows a 1-based queue position for a multi-conflict queue', () => {
    open({ queueIndex: 1, queueTotal: 3 })
    expect(document.body.textContent).toContain('第 2 项，共 3 项')
  })

  it('carries applyToAll through with the chosen action', async () => {
    const w = open({ queueTotal: 2 })
    const cb = document.body.querySelector('input[type="checkbox"]') as HTMLInputElement
    cb.click()
    await w.vm.$nextTick()
    btn('跳过')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')![0]).toEqual([{ action: 'skip', applyToAll: true }])
  })

  it('resets applyToAll every time it reopens', async () => {
    const w = open({ queueTotal: 2 })
    ;(document.body.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    btn('跳过')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')!.at(-1)).toEqual([{ action: 'skip', applyToAll: false }])
  })

  it('closing the dialog emits cancel', async () => {
    const w = open()
    await w.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
```

> **注意**：测试断言用中文字面量是因为 i18n 默认 locale 是 `zh_cn`；不要另建 `createI18n`（会与 setup 的单例重复安装），直接 import `src/i18n` 的单例。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/components/FileConflictDialog.test.ts`
Expected: FAIL —「Failed to resolve import "./FileConflictDialog.vue"」

- [ ] **Step 3a: 加 danger token**

在 `src/styles/theme.css` 的 `:root` 块（深色，`--toast-danger-*` 附近）加：

```css
  /* SP12 Plan B: ghost-red destructive button (conflict dialog's Overwrite).
     Distinct from --toast-danger-* which is a filled toast surface. */
  --danger-fg: #ff8a8a;
  --danger-bg: rgba(255, 80, 100, 0.10);
  --danger-border: rgba(255, 80, 100, 0.40);
```

在 `:root[data-theme="light"]` 块（浅色，`--toast-danger-*` 附近）加：

```css
  --danger-fg: #c0392b;
  --danger-bg: rgba(192, 57, 43, 0.08);
  --danger-border: rgba(192, 57, 43, 0.35);
```

- [ ] **Step 3b: 加 i18n 键**

`src/i18n/zh_cn.base.ts`：把第 111-112 行的 `filesUploadConflictTitle` / `filesUploadConflictMsg` **删掉**，在同一位置加入：

```ts
  filesConflictTitle: '已存在同名项目',
  filesConflictQueuePos: '第 {index} 项，共 {total} 项',
  filesConflictHint: '请选择如何处理这个同名冲突',
  filesConflictDirNote: '文件夹不支持覆盖 — 请选择保留两者或跳过',
  filesConflictDirNoteMerge: '合并进已有文件夹，或选择保留两者/跳过',
  filesConflictOverwriteDisabled: '文件夹不支持覆盖',
  filesConflictApplyAll: '应用于剩余全部项目',
  filesConflictMerge: '合并',
  filesConflictKeepBoth: '保留两者',
  filesConflictSkip: '跳过',
  filesConflictOverwrite: '覆盖',
  filesUploadSkipped: '已跳过 {count} 项',
```

`src/i18n/en_us.base.ts`：同样删掉那两个键，加入：

```ts
  filesConflictTitle: 'An item with this name already exists',
  filesConflictQueuePos: 'Item {index} of {total}',
  filesConflictHint: 'Choose how to handle this name conflict',
  filesConflictDirNote: 'Folders cannot be overwritten — choose Keep both or Skip instead',
  filesConflictDirNoteMerge: 'Merge into the existing folder, or keep both / skip',
  filesConflictOverwriteDisabled: 'Folders cannot be overwritten',
  filesConflictApplyAll: 'Apply to all remaining items',
  filesConflictMerge: 'Merge',
  filesConflictKeepBoth: 'Keep both',
  filesConflictSkip: 'Skip',
  filesConflictOverwrite: 'Overwrite',
  filesUploadSkipped: 'Skipped {count} item(s)',
```

- [ ] **Step 3c: 写组件**

创建 `src/files/components/FileConflictDialog.vue`：

```vue
<!--
  Generic same-name-conflict dialog: shows ONE conflicting item at a time and
  lets the user pick Overwrite / Keep both / Skip (plus Merge for a
  folder-into-folder collision), with an "apply to all remaining items"
  checkbox for batches. Deliberately carries no upload-specific language — it
  only knows a name / isDir / targetPath / queue position to display and an
  action to emit. Ported from Vue2 FileConflictDialog.vue.

  Queue usage: the CALLER walks the queue (fileConflict.ts's
  resolveConflictQueue), opening this dialog fresh for each conflict. This
  component holds no queue state beyond the checkbox for the current decision.

  Directory conflicts: the backend cannot overwrite a directory, so Overwrite
  is disabled rather than hidden — a disabled control with an inline
  explanation reads clearer than a button that silently vanishes.

  Cancel (Esc / outside click) means "stop asking about the rest of this
  batch"; the caller marks this and every remaining conflict as cancelled.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import type { ConflictChoice } from '../upload/fileConflict'

const props = withDefaults(
  defineProps<{
    open: boolean
    name: string
    targetPath: string
    isDir?: boolean
    /** Shows Merge — only meaningful together with isDir. Defaults to false so
     *  a plain file conflict never offers it. */
    allowMerge?: boolean
    /** 0-based position in the caller's queue; drives the "Item N of M" line
     *  and gates the apply-to-all checkbox (meaningless for one conflict). */
    queueIndex?: number
    queueTotal?: number
  }>(),
  { isDir: false, allowMerge: false, queueIndex: 0, queueTotal: 1 },
)

const emit = defineEmits<{ (e: 'choose', v: ConflictChoice): void; (e: 'cancel'): void }>()
const { t } = useI18n()

// Scoped to THIS dialog invocation only — reset on every (re)open so a stale
// tick from a previous conflict never leaks into the next decision.
const applyToAll = ref(false)
watch(() => props.open, (v) => { if (v) applyToAll.value = false })

function choose(action: ConflictChoice['action']) {
  // Defensive only — the Overwrite button is already disabled for a directory
  // conflict and Merge only renders when it is allowed. These guard a stray
  // programmatic call.
  if (action === 'overwrite' && props.isDir) return
  if (action === 'merge' && !(props.allowMerge && props.isDir)) return
  emit('choose', { action, applyToAll: applyToAll.value })
}

function onOpenChange(v: boolean) {
  if (!v) emit('cancel')
}

defineExpose({ choose })
</script>

<template>
  <Dialog :open="open" :title="t('filesConflictTitle')" @update:open="onOpenChange">
    <div v-if="queueTotal > 1" class="fc-queue-pos">
      {{ t('filesConflictQueuePos', { index: queueIndex + 1, total: queueTotal }) }}
    </div>

    <div class="fc-item">
      <span class="fc-item-icon" aria-hidden="true">{{ isDir ? '📁' : '📄' }}</span>
      <div class="fc-item-text">
        <div class="fc-item-name" :title="name">{{ name }}</div>
        <div class="fc-item-path" :title="targetPath">{{ targetPath }}</div>
      </div>
    </div>

    <p class="fc-hint">{{ t('filesConflictHint') }}</p>

    <div v-if="isDir" class="fc-dir-note">
      {{ allowMerge ? t('filesConflictDirNoteMerge') : t('filesConflictDirNote') }}
    </div>

    <label v-if="queueTotal > 1" class="fc-apply-all">
      <input v-model="applyToAll" type="checkbox" />
      <span>{{ t('filesConflictApplyAll') }}</span>
    </label>

    <template #footer>
      <button v-if="allowMerge && isDir" class="fc-btn fc-primary" @click="choose('merge')">
        {{ t('filesConflictMerge') }}
      </button>
      <button class="fc-btn" @click="choose('skip')">{{ t('filesConflictSkip') }}</button>
      <button class="fc-btn" :class="{ 'fc-primary': !(allowMerge && isDir) }" @click="choose('keep_both')">
        {{ t('filesConflictKeepBoth') }}
      </button>
      <button
        class="fc-btn fc-danger"
        :disabled="isDir"
        :title="isDir ? t('filesConflictOverwriteDisabled') : ''"
        @click="choose('overwrite')"
      >
        {{ t('filesConflictOverwrite') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.fc-queue-pos { font-size: 11px; font-weight: 500; color: var(--fg-muted); margin-bottom: 10px; }
.fc-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px;
  border: 1px solid var(--chip-border); border-radius: 10px;
}
.fc-item-icon { flex-shrink: 0; font-size: 20px; line-height: 1.2; }
.fc-item-text { min-width: 0; flex: 1 1 auto; }
.fc-item-name {
  font-size: 13px; font-weight: 600; color: var(--fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-item-path {
  font-size: 11px; color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-hint { margin: 12px 0 0; font-size: 12px; color: var(--fg-muted); }
.fc-dir-note {
  margin-top: 8px; padding: 6px 10px; border-radius: 8px; font-size: 11px;
  color: var(--warn-fg); background: var(--warn-bg); border: 1px solid var(--warn-border);
}
.fc-apply-all {
  display: flex; align-items: center; gap: 6px; margin-top: 14px;
  font-size: 12px; color: var(--fg-muted); cursor: pointer;
}

.fc-btn {
  padding: 7px 16px; border-radius: 999px; font-size: 13px; cursor: pointer;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
}
.fc-btn:hover:not(:disabled) { background: var(--chip-bg-hover, var(--chip-border)); }
.fc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Every variant redeclares its own :hover background. A bare .fc-btn:hover is
   (0,2,0) and would otherwise beat a variant class at (0,1,0), washing the
   variant colour out on hover. */
.fc-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.fc-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.08); }

.fc-danger { background: transparent; border-color: var(--danger-border); color: var(--danger-fg); }
.fc-danger:hover:not(:disabled) { background: var(--danger-bg); border-color: var(--danger-fg); }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/components/FileConflictDialog.test.ts src/i18n/parity.test.ts`
Expected: 两个都 PASS

- [ ] **Step 5: 提交**

```bash
git add src/files/components/FileConflictDialog.vue src/files/components/FileConflictDialog.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/styles/theme.css
git commit -m "feat(files): add the shared same-name conflict dialog

One conflict at a time with overwrite/keep both/skip, plus merge for a
folder-into-folder collision and an apply-to-all checkbox for batches.
Overwrite is disabled rather than hidden on a directory conflict, with an
inline note explaining why. Adds ghost-red danger tokens to both themes."
```

---

