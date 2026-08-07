### Task 4: v2 信封解包器 `v2Data`

**Files:**
- Create: `NimoOS-Service/src/v2.ts`
- Test: `NimoOS-Service/src/v2.test.ts`

**Interfaces:**
- Produces: `v2Data<T>(raw: unknown): T` — v2 裸信封 `{message,data}` 取 `data`;带 `success` 的标准信封走 `unwrap`(容错);无 `data` 键的裸值原样返回。Task 5/6 全部方法消费它。

- [ ] **Step 1: 写失败测试**

`src/v2.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { v2Data } from './v2'

describe('v2Data', () => {
  it('v2 裸信封 {message,data} 无 success → 取 data', () => {
    expect(v2Data<string[]>({ message: '', data: ['a'] })).toEqual(['a'])
  })
  it('带 success 的标准信封 → 走 unwrap 语义', () => {
    expect(v2Data<number>({ success: 200, data: 7 })).toBe(7)
    expect(() => v2Data({ success: 500, message: 'boom', data: null })).toThrow('boom')
  })
  it('裸值(无 data 键)原样返回', () => {
    expect(v2Data<string[]>(['x'])).toEqual(['x'])
    expect(v2Data<null>(null)).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm vitest run src/v2.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 最小实现**

`src/v2.ts`:

```typescript
import type { StdEnvelope } from './types.js'
import { unwrap } from './unwrap.js'

/** v2 app_management 的 BaseResponse 是 {message, data},没有 success 字段
 *  (openapi BaseResponse 实证;appgrid 2026-07-15 踩坑的全域版)。
 *  错误路径后端用真实 HTTP 状态码,axios 已 reject,到这里的都是 2xx。 */
export function v2Data<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const body = raw as { data?: unknown; success?: number }
    if (body.success !== undefined) return unwrap(body as StdEnvelope<T>)
    return body.data as T
  }
  return raw as T
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/v2.test.ts`
Expected: PASS 3/3。

- [ ] **Step 5: Commit**

```bash
git add src/v2.ts src/v2.test.ts
git commit -m "feat(v2): v2Data 解包器——app_management v2 信封无 success 字段,unwrap 会误抛

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

