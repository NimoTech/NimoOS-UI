### Task 2: `resolveUploaderHeader` 头部三态 + 两个 i18n 键

**Files:**
- Modify: `src/files/util/opsRow.ts`, `src/files/util/opsRow.test.ts`
- Modify: `src/i18n/zh_cn.base.ts:85` 附近, `src/i18n/en_us.base.ts:85` 附近

**Interfaces:**
- Produces: `resolveUploaderHeader(counts: { uploadCount: number; opsCount: number }): string` —— 返回 i18n key

- [ ] **Step 1: 写失败测试(追加到 `opsRow.test.ts` 末尾)**

```ts
import { resolveUploaderHeader } from './opsRow'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

describe('resolveUploaderHeader', () => {
  it('shows the uploading header whenever an upload is in flight', () => {
    expect(resolveUploaderHeader({ uploadCount: 3, opsCount: 0 })).toBe('filesUploadHeaderUploading')
  })

  it('prefers uploading over processing when both are running', () => {
    expect(resolveUploaderHeader({ uploadCount: 1, opsCount: 5 })).toBe('filesUploadHeaderUploading')
  })

  it('shows the processing header when only file operations are running', () => {
    expect(resolveUploaderHeader({ uploadCount: 0, opsCount: 2 })).toBe('filesUploadHeaderProcessing')
  })

  it('falls back to the plain title when nothing is running', () => {
    expect(resolveUploaderHeader({ uploadCount: 0, opsCount: 0 })).toBe('filesUploadTitle')
  })

  it('resolves every header key it can return in both locales', () => {
    const keys = [
      resolveUploaderHeader({ uploadCount: 1, opsCount: 0 }),
      resolveUploaderHeader({ uploadCount: 0, opsCount: 1 }),
      resolveUploaderHeader({ uploadCount: 0, opsCount: 0 }),
    ]
    for (const k of keys) {
      expect(zh[k as keyof typeof zh]).toBeTruthy()
      expect(en[k as keyof typeof en]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts`
Expected: FAIL —— `resolveUploaderHeader is not a function`

- [ ] **Step 3: 加 i18n 键**

`src/i18n/zh_cn.base.ts`,在 `filesUploadTitle` 那一行下面加:

```ts
  filesUploadHeaderUploading: '正在上传',
  filesUploadHeaderProcessing: '正在处理文件',
```

`src/i18n/en_us.base.ts` 同位置加:

```ts
  filesUploadHeaderUploading: 'Uploading',
  filesUploadHeaderProcessing: 'Processing files',
```

- [ ] **Step 4: 写实现(追加到 `opsRow.ts`)**

```ts
/**
 * i18n key for the upload panel header. Mixed state deliberately shows the
 * uploading header (matches Vue2): uploads carry bytes the user would lose on
 * navigation, file operations run server-side and survive it.
 */
export function resolveUploaderHeader(counts: { uploadCount: number; opsCount: number }): string {
  if (counts.uploadCount > 0) return 'filesUploadHeaderUploading'
  if (counts.opsCount > 0) return 'filesUploadHeaderProcessing'
  return 'filesUploadTitle'
}
```

- [ ] **Step 5: 跑测试确认通过 + parity 门**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts src/i18n/parity.test.ts`
Expected: 全绿。**若 parity 红,说明只加了一个 locale。**

- [ ] **Step 6: 变异验证**

把混合态那两行顺序对调(`opsCount` 判在前),重跑 → 「prefers uploading over processing」必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/util/opsRow.ts src/files/util/opsRow.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): resolve the upload panel header from both queues

New-UI had no header states at all -- the title was hardcoded. Mixed state
shows uploading because uploads hold bytes that navigating away would lose.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

