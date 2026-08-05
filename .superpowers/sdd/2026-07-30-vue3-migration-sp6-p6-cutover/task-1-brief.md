### Task 1: Vue2 `strangler.js` 加「无路由绞杀点」表

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/router/strangler.js`(在文件末尾追加,不改动既有 `migratedRoutes`/`isEnabled`/`resolveTarget`/`matches` 任何一行)
- Test: `/home/nimo/NimoTech/NimoOS-UI/src/router/__tests__/strangler.spec.js`(追加一个 `describe` 块)

**Interfaces:**
- Consumes: 文件内既有的私有函数 `flagKey(from)`(返回 `` `strangler:disabled:${from}` ``)与 `resolveStorage(storage)`(storage 为空时回落到全局 `localStorage`,无 `localStorage` 环境返回 `null`)。
- Produces:
  - `export const migratedEntries` —— 数组,元素形状 `{ from: string, to: string, enabled: boolean }`。
  - `export function resolveEntryTarget(from, storage)` —— 命中且未回退返回 `to` 字符串;未登记 / `enabled === false` / flag 为 `'1'` 时返回 `null`。第二参 `storage` 可选,用于测试注入。
  - Task 2 / Task 3 的三个 `.vue` 调用 `resolveEntryTarget('/storage')`。

- [ ] **Step 1: 写失败测试**

追加到 `src/router/__tests__/strangler.spec.js` 末尾(顶部 import 行同时补上两个新导出):

```js
// 顶部 import 改为:
// import { migratedRoutes, migratedEntries, isEnabled, resolveTarget, resolveEntryTarget } from '../strangler'

describe('无路由绞杀点 migratedEntries(SP6-P6 存储区 cutover)', () => {
  it('存储区是第一条,目标 /app/#/storage', () => {
    expect(migratedEntries[0]).toEqual({ from: '/storage', to: '/app/#/storage', enabled: true })
  })

  it('未回退时 resolveEntryTarget 返回目标 URL', () => {
    expect(resolveEntryTarget('/storage', noStore)).toBe('/app/#/storage')
  })

  it('回退 flag strangler:disabled:/storage === "1" 时返回 null(调用处走老弹窗)', () => {
    expect(resolveEntryTarget('/storage', offStore('strangler:disabled:/storage'))).toBeNull()
  })

  it('flag 为其他值不算回退', () => {
    expect(resolveEntryTarget('/storage', { getItem: () => '0' })).toBe('/app/#/storage')
    expect(resolveEntryTarget('/storage', { getItem: () => '' })).toBe('/app/#/storage')
  })

  it('未登记的入口返回 null', () => {
    expect(resolveEntryTarget('/photos', noStore)).toBeNull()
    expect(resolveEntryTarget('', noStore)).toBeNull()
  })

  it('两张表互不干扰:存储不进路由表,/storage 不被守卫重定向', () => {
    expect(migratedRoutes.some((e) => e.from === '/storage')).toBe(false)
    expect(resolveTarget('/storage', noStore)).toBeNull()
  })

  it('不传 storage 且环境无 localStorage 时不抛(SSR/裸 node)', () => {
    const saved = globalThis.localStorage
    // eslint-disable-next-line no-global-assign
    delete globalThis.localStorage
    expect(() => resolveEntryTarget('/storage')).not.toThrow()
    expect(resolveEntryTarget('/storage')).toBe('/app/#/storage')
    globalThis.localStorage = saved
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm vitest run src/router/__tests__/strangler.spec.js
```

预期:FAIL —— `resolveEntryTarget is not a function` / `migratedEntries` undefined。

- [ ] **Step 3: 实现**

追加到 `src/router/strangler.js` 末尾:

```js
/**
 * 无路由绞杀点:Vue2 侧是模态弹窗、没有路由,进不了 migratedRoutes(全局守卫拦不到),
 * 由入口调用处自己判定。SP6-P6 存储区是第一条;SP7/SP8 若也有模态型入口,在此续行,
 * 不要回到「每个调用处各写一遍 localStorage 判断」。
 * flag 命名与 migratedRoutes 共用:localStorage['strangler:disabled:<from>'] === '1' 即回退。
 */
export const migratedEntries = [
	{ from: '/storage', to: '/app/#/storage', enabled: true }, // SP6-P6:三处存储弹窗入口
]

/**
 * 命中且未回退 → 返回目标 URL(调用处整页跳转);未登记 / 已禁用 / 已回退 → null(调用处走原弹窗)。
 */
export function resolveEntryTarget(from, storage) {
	const entry = migratedEntries.find((e) => e.from === from)
	if (!entry || !entry.enabled) return null
	const ls = resolveStorage(storage)
	if (ls && ls.getItem(flagKey(from)) === '1') return null
	return entry.to
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/router/__tests__/strangler.spec.js
```

预期:PASS,全部用例绿。

- [ ] **Step 5: 变异验证**

把 `resolveEntryTarget` 里 `=== '1'` 临时改成 `=== 'x'`,重跑 → 「回退 flag」那条必须变红;改回。
再把 `enabled` 判定 `|| !entry.enabled` 临时删掉,重跑 → 该改动不应让任何用例变红(**这是预期的**,表里目前没有 `enabled: false` 的条目);恢复后在报告里说明这一点,不要为它补测试(YAGNI)。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/router/strangler.js src/router/__tests__/strangler.spec.js
git commit -m "feat(strangler): 加无路由绞杀点表 migratedEntries + resolveEntryTarget

存储区在 Vue2 是模态弹窗、没有路由,全局守卫拦不到,进不了 migratedRoutes。
新增第二张表登记这类 cutover 点,flag 命名与路由表共用 strangler:disabled:<from>。
SP6-P6 存储区是第一条。"
```

---

