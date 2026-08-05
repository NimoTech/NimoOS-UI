### Task 3: 前端 layout store 新增 evict（立即清位）

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/stores/layout.ts`
- Test: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/stores/layout.test.ts`（追加用例）

**Interfaces:**
- Produces: `useLayoutStore().evict(key: string)` —— 立即移除该 key 的 `app`/`appwidget` 布局项、清 `seen` 与 `missingSince`、持久化（Task 4 调用）。

- [ ] **Step 1: 写失败测试** — 在 `layout.test.ts` 的 `describe('autoPin', ...)` 块内追加（沿用该文件既有 `dl()` 辅助与 `DIMS` 常量）：

```ts
  it('evict 立即移除图标+小组件并清 seen(重新出现可再上桌)', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('tasklist', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(2) // app + appwidget

    s.evict('tasklist')
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(0)

    // seen 已清:同名容器再出现要能重新自动上桌
    s.autoPin([dl('tasklist', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(2)
  })

  it('evict 不误伤其他项且无匹配时不报错', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('other')], DIMS)
    s.evict('nonexistent')
    expect(s.items.filter((i) => i.key === 'other').length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: 跑测试确认失败** — `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/home/stores/layout.test.ts`，预期：`s.evict is not a function`。

- [ ] **Step 3: 最小实现** — 在 `layout.ts` 的 `autoPin` 函数定义之后追加，并把 `evict` 加进文件末尾的 `return {...}`：

```ts
  /** 事件推送快路径:确知容器已被删除(daemon destroy 事件),立即清位,不等缺席宽限期 */
  function evict(key: string) {
    const before = items.value.length
    items.value = items.value.filter((it) => !((it.kind === 'app' || it.kind === 'appwidget') && it.key === key))
    const hadSeen = seen.value.delete(key)
    missingSince.delete(key)
    if (items.value.length !== before || hadSeen) { save(); saveSeen() }
  }
```

- [ ] **Step 4: 跑测试确认通过** — 同 Step 2 命令，预期全绿。
- [ ] **Step 5: 提交** — `git add src/home/stores/ && git commit -m "feat(home): layout.evict 立即清除已删除容器的图标与小组件"`

---

