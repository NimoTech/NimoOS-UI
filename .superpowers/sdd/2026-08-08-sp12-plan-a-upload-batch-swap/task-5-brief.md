### Task 5: 裂开角标

**Files:**
- Create: `src/files/util/uploadBadge.ts`, `src/files/util/uploadBadge.test.ts`
- Modify: `src/files/stores/files.ts`
- Modify: `src/files/components/FileTile.vue`, `src/files/components/FileRow.vue`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`

**Interfaces:**
- Consumes: 无
- Produces: `isUploadBroken(entry: FileEntry): boolean`、`uploadBatchIdOf(entry: FileEntry): string`；
  `FileTile` / `FileRow` 新增 emit `(e: 'open-batch', batchId: string): void`

- [ ] **Step 1: 写失败的测试**

创建 `src/files/util/uploadBadge.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { isUploadBroken, uploadBatchIdOf } from './uploadBadge'
import type { FileEntry } from '../stores/files'

function entry(ext: unknown): FileEntry {
  return { name: 'a.txt', path: '/DATA/x/a.txt', is_dir: false, extensions: ext as FileEntry['extensions'] }
}

describe('upload badge state', () => {
  it('reads a boolean broken flag', () => {
    expect(isUploadBroken(entry({ upload: { broken: true, batchId: 'b1' } }))).toBe(true)
  })

  // 后端 JSON 可能给字符串:Vue2 IconContainerMixin.js:71 两种都认,照搬。
  it('reads a string broken flag', () => {
    expect(isUploadBroken(entry({ upload: { broken: 'true', batchId: 'b1' } }))).toBe(true)
  })

  it('is false for broken:false, missing upload, null extensions', () => {
    expect(isUploadBroken(entry({ upload: { broken: false } }))).toBe(false)
    expect(isUploadBroken(entry({ share: { shared: 'true' } }))).toBe(false)
    expect(isUploadBroken(entry(null))).toBe(false)
  })

  it('extracts the batch id, empty string when absent', () => {
    expect(uploadBatchIdOf(entry({ upload: { broken: true, batchId: 'b1' } }))).toBe('b1')
    expect(uploadBatchIdOf(entry({ upload: { broken: true } }))).toBe('')
    expect(uploadBatchIdOf(entry(null))).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm exec vitest run src/files/util/uploadBadge.test.ts
```
Expected: FAIL — 无法解析 `./uploadBadge`

- [ ] **Step 3: 扩展 FileEntry 类型**

`src/files/stores/files.ts` 的 `FileEntry`：

```ts
export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size?: number | string
  date?: string
  write?: boolean
  extensions?: {
    share?: { shared?: string }
    // 后端在文件列表里挂的上传批次状态(NimoOS route/v1/file.go:441)。
    // broken 可能是布尔也可能是字符串 —— 判定见 util/uploadBadge.ts。
    upload?: { broken?: boolean | string; batchId?: string }
  } | null
}
```

- [ ] **Step 4: 实现纯函数**

创建 `src/files/util/uploadBadge.ts`：

```ts
import type { FileEntry } from '../stores/files'

/**
 * True when the NAS reports this entry as belonging to an interrupted upload
 * batch. The backend may serialize the flag as a boolean or as the string
 * 'true' — both count (ported from Vue2 IconContainerMixin.js:71).
 */
export function isUploadBroken(entry: FileEntry | null | undefined): boolean {
  const up = entry?.extensions?.upload
  return !!up && (up.broken === true || up.broken === 'true')
}

/** Batch id behind the badge; '' when the entry carries none. */
export function uploadBatchIdOf(entry: FileEntry | null | undefined): string {
  return entry?.extensions?.upload?.batchId || ''
}
```

- [ ] **Step 5: 运行确认通过**

```bash
pnpm exec vitest run src/files/util/uploadBadge.test.ts
```
Expected: 4 passed

- [ ] **Step 6: 加 i18n 键**

`src/i18n/zh_cn.base.ts` 加：
```ts
  filesUploadBrokenBadge: '上传中断 —— 点击查看详情',
```
`src/i18n/en_us.base.ts` 加：
```ts
  filesUploadBrokenBadge: 'Upload interrupted — click for details',
```

- [ ] **Step 7: 写组件测试**

创建 `src/files/components/FileTile.badge.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import FileTile from './FileTile.vue'
import FileRow from './FileRow.vue'
import { i18n } from '../../i18n'
import type { FileEntry } from '../stores/files'

const broken: FileEntry = {
  name: 'a.txt', path: '/DATA/x/a.txt', is_dir: false,
  extensions: { upload: { broken: true, batchId: 'b1' } },
}
const clean: FileEntry = { name: 'b.txt', path: '/DATA/x/b.txt', is_dir: false, extensions: null }

describe.each([['FileTile', FileTile], ['FileRow', FileRow]] as const)('%s torn badge', (_n, Comp) => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders the badge only for a broken entry', () => {
    const w = mount(Comp, { props: { entry: broken }, global: { plugins: [i18n] } })
    expect(w.find('.upload-broken-badge').exists()).toBe(true)
    const w2 = mount(Comp, { props: { entry: clean }, global: { plugins: [i18n] } })
    expect(w2.find('.upload-broken-badge').exists()).toBe(false)
  })

  it('emits open-batch and does NOT emit open/select when the badge is clicked', async () => {
    const w = mount(Comp, { props: { entry: broken }, global: { plugins: [i18n] } })
    await w.find('.upload-broken-badge').trigger('click')
    expect(w.emitted('open-batch')?.[0]).toEqual(['b1'])
    // 角标长在卡片上,不 stop 就会连带触发卡片的打开/选中 —— Vue2 #91 的根因。
    expect(w.emitted('open')).toBeUndefined()
    expect(w.emitted('select')).toBeUndefined()
  })
})
```

- [ ] **Step 8: 运行确认失败**

```bash
pnpm exec vitest run src/files/components/FileTile.badge.test.ts
```
Expected: FAIL — 找不到 `.upload-broken-badge`

- [ ] **Step 9: 两个组件加角标**

`FileTile.vue`：script 里加

```ts
import { isUploadBroken, uploadBatchIdOf } from '../util/uploadBadge'
```
emits 里加 `(e: 'open-batch', batchId: string): void`，模板里在 `.tile-check` 之后加：

```html
    <button
      v-if="isUploadBroken(props.entry)"
      type="button"
      class="upload-broken-badge"
      :title="$t('filesUploadBrokenBadge')"
      @click.stop.prevent="emit('open-batch', uploadBatchIdOf(props.entry))"
    >!</button>
```

样式（**颜色必须走 token**）：

```css
.upload-broken-badge {
  position: absolute; right: 6px; top: 6px; width: 20px; height: 20px;
  display: grid; place-items: center; padding: 0;
  border-radius: 999px; border: 1px solid var(--card-border);
  background: var(--remove-bg); color: var(--remove-fg);
  font-size: 13px; font-weight: 700; line-height: 1; cursor: pointer;
}
.upload-broken-badge:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
```

> 已核实 `--remove-bg` / `--remove-fg` / `--card-border` 在 `theme.css` 的深浅两套主题块里
> 都有值（`:149` `:281` `:402` `:493`），直接用即可。**`--remove-bg-hi` 不存在** ——
> hover 改用 `color-mix(in srgb, var(--remove-fg) 22%, transparent)`，与
> `SelectionToolbar.vue` 的 danger 按钮同一套写法。
> `FileTile` 的根元素需要 `position: relative` 才能定位角标 —— 检查现有样式，没有就补。

`FileRow.vue` 同样处理，角标尺寸改 16px、插在 `.file-icon` 之后。

- [ ] **Step 10: 运行确认通过 + 全量**

```bash
pnpm exec vitest run src/files/components/FileTile.badge.test.ts
pnpm test
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/i18n/parity.test.ts
```
Expected: 全绿

- [ ] **Step 11: 提交**

```bash
git add src/files/util/uploadBadge.ts src/files/util/uploadBadge.test.ts \
        src/files/stores/files.ts src/files/components/FileTile.vue \
        src/files/components/FileRow.vue src/files/components/FileTile.badge.test.ts \
        src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): show the torn badge on entries from interrupted batches

The badge state comes straight off the listing — the NAS already annotates
entries with extensions.upload — so nothing needs to be tracked client-side.

The click handler stops propagation: the badge sits inside the card, and
without that the card's own open/select fires alongside it. That exact wiring
is what Vue 2 had to go back and fix."
```

---

