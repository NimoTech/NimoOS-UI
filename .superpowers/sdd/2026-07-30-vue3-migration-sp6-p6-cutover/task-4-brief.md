### Task 4: New-UI 存储磁贴补回退 flag

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/composables/useOpenAction.ts`(14-32 行附近)
- Test: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/composables/useOpenAction.test.ts`

**Interfaces:**
- Consumes: 无(不依赖 Vue2 侧代码;共用的只是 localStorage 键名字符串)。
- Produces: 无(叶子改动)。

现状:`if (key === 'storage') { router.push('/storage'); return }`,P1 起就无条件硬跳,代码里已留注释「SP6-P6 cutover 时补齐」。回退时应落到既有的 `window.location.href = SYS_ROUTE[key] || '/#/legacy'`(`SYS_ROUTE` 无 `storage` 键 → `/#/legacy`),与 `appstore` 分支完全同型。

顺带 DRY:现有 `appsCutoverDisabled()` 与要加的存储版只差键名,合并成一个带参数的 `cutoverDisabled(from)`。这是本任务正在编辑的同一段代码,不算无关重构。

- [ ] **Step 1: 写失败测试**

在 `src/home/composables/useOpenAction.test.ts` 的 `describe('useOpenAction.openApp')` 块内、`appstore` 那两条之后追加:

```ts
  it('storage 磁贴应用内 router.push /storage(SP6-P6 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/storage')
  })
  it('storage 与 apps 两把 flag 互不干扰', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
```

并把 `beforeEach` 里的清理补上存储键(紧跟现有 `/apps` 那行):

```ts
  localStorage.removeItem('strangler:disabled:/storage')
```

**已核实**:`storage` 是 `src/home/apps/systemApps.ts:25` 的内置条目(`SYSTEM_APPS`),`apps.app('storage')` 天然返回 `system: true` 的记录,**用例不需要 `setApps`** —— 与现有 `appstore`/`settings` 两条用例同样的前提。

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm vitest run src/home/composables/useOpenAction.test.ts
```

预期:「回退 flag」那条 FAIL(现在无条件 push);另两条应已通过。

- [ ] **Step 3: 实现**

把 14-18 行的 `appsCutoverDisabled` 替换为带参版本:

```ts
// 回退 flag(与 Vue2 strangler.js 的 strangler:disabled:<from> 命名一致):
// == '1' 时磁贴退回 Vue2 /#/legacy 老桌面,可逆 cutover。
// /apps = SP5-P8;/storage = SP6-P6(Vue2 桌面那三个存储入口共用同一把键,
// 同源共享 localStorage,所以置一次即两侧同时回退)。
function cutoverDisabled(from: string): boolean {
  try { return localStorage.getItem(`strangler:disabled:${from}`) === '1' } catch { return false }
}
```

`openApp` 里两行改为:

```ts
      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
```

(删掉原 storage 分支上方那两行「尚无 strangler 回退 flag …… SP6-P6 cutover 时补齐」的注释 —— 债已还。)

- [ ] **Step 4: 跑测试确认通过 + 全量守门**

```bash
pnpm vitest run src/home/composables/useOpenAction.test.ts
pnpm test 2>&1 | tail -15
pnpm exec vue-tsc --noEmit
```

预期:三条新用例 PASS,`/apps` 的四条老用例仍绿;全量绿;tsc 零错。

- [ ] **Step 5: 变异验证**

把 `!cutoverDisabled('/storage')` 临时改成 `!cutoverDisabled('/storages')` → 「回退 flag」那条变红;改回。
把 `'/apps'` 临时也改成 `'/storage'` → 「两把 flag 互不干扰」那条变红;改回。

- [ ] **Step 6: 提交**

```bash
git add src/home/composables/useOpenAction.ts src/home/composables/useOpenAction.test.ts
git commit -m "feat(storage): 存储磁贴补回退 flag strangler:disabled:/storage(SP6-P6)

P1 起磁贴就硬跳 /storage、浏览器侧回滚不掉,本次补齐门控,回退落 /#/legacy。
顺带把 appsCutoverDisabled 合并成带参 cutoverDisabled(from),两处共用。"
```

---

