### Task 1: `util/ext.ts` — 单一扩展名提取(合并三处)+ 导出 `IMAGE_EXTS`

**Files:**
- Create: `src/files/util/ext.ts`
- Create: `src/files/util/ext.test.ts`
- Modify: `src/files/util/icons.ts`(删内部 `ext()`,import `fileExt`;导出 `IMAGE_EXTS`)
- Modify: `src/files/stores/files.ts`(删 `extOf`,`KEY_FN.format` 用 `fileExt`)
- Modify: `src/files/components/FileRow.vue`(类型列用 `fileExt`)

**Interfaces:**
- Produces:
  ```ts
  export function fileExt(name: string): string        // ext.ts:小写扩展名,Vue2 getFileExt 忠实版
  export const IMAGE_EXTS: ReadonlySet<string>          // icons.ts:图片扩展集(供 isImage 复用)
  ```

- [ ] **Step 1: 写失败测试**

`src/files/util/ext.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { fileExt } from './ext'

describe('fileExt', () => {
  it('extracts the lowercase extension after the last dot', () => {
    expect(fileExt('a.PNG')).toBe('png')
    expect(fileExt('archive.tar.gz')).toBe('gz')
    expect(fileExt('readme.md')).toBe('md')
  })
  it('matches Vue2 getFileExt for extensionless names and dotfiles', () => {
    expect(fileExt('Dockerfile')).toBe('dockerfile')
    expect(fileExt('Makefile')).toBe('makefile')
    expect(fileExt('.gitignore')).toBe('gitignore')
    expect(fileExt('.env')).toBe('env')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/util/ext.test.ts`
Expected: FAIL(`Cannot find module './ext'`)

- [ ] **Step 3: 写实现**

`src/files/util/ext.ts`:
```ts
// 单一文件扩展名提取,逐字对齐 Vue2 mixins/mixin.js getFileExt:
//   name.substring(name.lastIndexOf('.') + 1) —— 无点名返回整名(Dockerfile→dockerfile),
//   dotfile 返回点后段(.gitignore→gitignore)。全库唯一实现,勿再复制。
export function fileExt(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase()
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/util/ext.test.ts`
Expected: PASS(2 用例)

- [ ] **Step 5: 合并 `icons.ts`(删内部 ext + 导出 IMAGE_EXTS)**

在 `src/files/util/icons.ts` 顶部加 import:
```ts
import { fileExt } from './ext'
```
删除文件中的:
```ts
function ext(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase()
}
```
把 `iconNameFor` 末行 `return EXT_TO_ICON[ext(entry.name)] || 'unknown'` 改为:
```ts
  return EXT_TO_ICON[fileExt(entry.name)] || 'unknown'
```
在 `TYPE_MAP` 反向索引构建之后(`EXT_TO_ICON` 那段之后)新增导出:
```ts
// 图片扩展集(供 isImage 复用,来源同 typeMap 的 image-x-generic)
export const IMAGE_EXTS: ReadonlySet<string> = new Set(TYPE_MAP['image-x-generic'])
```

- [ ] **Step 6: 合并 `filesStore`(删 extOf,format 用 fileExt)**

在 `src/files/stores/files.ts` 顶部 import 区加:
```ts
import { fileExt } from '../util/ext'
```
删除:
```ts
  function extOf(name: string): string {
    const i = name.lastIndexOf('.')
    return i > 0 ? name.slice(i + 1).toLowerCase() : ''
  }
```
把 `KEY_FN` 的 `format` 行改为:
```ts
    format: (e) => fileExt(e.name),
```

- [ ] **Step 7: 合并 `FileRow.vue`(类型列用 fileExt)**

在 `src/files/components/FileRow.vue` `<script setup>` import 区加:
```ts
import { fileExt } from '../util/ext'
```
把类型列那行:
```html
    <span class="file-format">{{ props.entry.is_dir ? '' : (props.entry.name.split('.').length > 1 ? props.entry.name.split('.').pop() : '') }}</span>
```
改为:
```html
    <span class="file-format">{{ props.entry.is_dir ? '' : fileExt(props.entry.name) }}</span>
```

- [ ] **Step 8: 跑受影响测试确认全绿(合并无回归)**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/util/ext.test.ts src/files/util/icons.test.ts src/files/stores/files.test.ts src/files/components/FileRow.test.ts`
Expected: PASS(ext 2 + icons 用例 + files 用例 + FileRow 2,全绿。行为不变:icons 的 ext 算法与原 `ext()` 相同;format 排序对既有测试数据无影响)

- [ ] **Step 9: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/util/ext.ts src/files/util/ext.test.ts src/files/util/icons.ts src/files/stores/files.ts src/files/components/FileRow.vue
git commit -m "refactor(files): single fileExt util + IMAGE_EXTS; consolidate 3 ext call sites"
```

---

