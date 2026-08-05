### Task 1: 纯函数 util `sourceMeta`(名称推导 + 官方源判定)

**Files:**
- Create: `src/apps/util/sourceMeta.ts`
- Test: `src/apps/util/sourceMeta.test.ts`

**Interfaces:**
- Produces: `sourceDisplayName(url: string): string`、`isOfficialSource(url: string): boolean` —— Task 3 store 不用它们,Task 4 页面模板直接 import 使用。

- [ ] **Step 1: 写失败测试**

```ts
// src/apps/util/sourceMeta.test.ts
import { describe, it, expect } from 'vitest'
import { sourceDisplayName, isOfficialSource } from './sourceMeta'

describe('sourceMeta', () => {
  it('http(s) URL 名称 = 第一段路径(Vue2 逐字规则)', () => {
    expect(sourceDisplayName('https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip')).toBe('WisdomSky')
    expect(sourceDisplayName('https://github.com/NimoTech/NimoOS-AppStore/archive/refs/heads/main.zip')).toBe('NimoTech')
  })

  it('非 http URL 名称 = 最后一段去扩展名', () => {
    expect(sourceDisplayName('ftp://host/path/store.zip')).toBe('store')
  })

  it('解析不了的字符串回退自身(去扩展名规则)', () => {
    expect(sourceDisplayName('not a url')).toBe('not a url')
  })

  it('官方源:http(s) 第一段路径 === NimoTech', () => {
    expect(isOfficialSource('https://github.com/NimoTech/NimoOS-AppStore/archive/refs/heads/main.zip')).toBe(true)
    expect(isOfficialSource('https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip')).toBe(false)
    expect(isOfficialSource('not a url')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/apps/util/sourceMeta.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现**

```ts
// src/apps/util/sourceMeta.ts
/** 商店源 URL 的展示元信息(纯函数)。命名规则逐字移植 Vue2
 *  AppStoreSourceManagement.vue getSourceList:http(s) 取第一段路径;
 *  其它取最后一段去扩展名;解析失败回退去扩展名规则。 */

/** 官方源判定:http(s) URL 第一段路径 === 'NimoTech'。
 *  Vue2 用它把官方源从删除列表里藏掉;New-UI 改为显示 + 徽章 + 不给删除按钮(计划 D1)。 */
export function isOfficialSource(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return u.pathname.split('/')[1] === 'NimoTech'
  } catch {
    return false
  }
}

export function sourceDisplayName(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const seg = u.pathname.split('/')[1]
      if (seg) return seg
    }
  } catch {
    /* 非标准 URL 落下方规则 */
  }
  const last = url.split('/').filter(Boolean).pop() ?? ''
  const noExt = last.replace(/\.[^.]+$/, '')
  return noExt || url
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/apps/util/sourceMeta.test.ts`
Expected: PASS(4 用例)

- [ ] **Step 5: Commit**

```bash
git add src/apps/util/sourceMeta.ts src/apps/util/sourceMeta.test.ts
git commit -m "P7: 商店源名称推导与官方源判定纯函数(Vue2 规则逐字移植)"
```

---

