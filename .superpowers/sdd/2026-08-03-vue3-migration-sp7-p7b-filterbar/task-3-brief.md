### Task 3: `PhotosToolbar.vue` 补 `after-tabs` 槽位

**Files:**
- Modify: `src/photos/components/PhotosToolbar.vue`
- Test: `src/photos/components/__tests__/PhotosToolbar.test.ts`(已存在,追加 2 条)

**Interfaces:**
- Consumes: 无(纯结构改动)。
- Produces: `PhotosToolbar` 的 `after-tabs` 具名插槽,位置在 `.tabs` 之后、`flex:1` 撑开条之前。T4 使用。

**背景**:这是本期三处「往已收官期回改」之一。P1 的 `task-7-brief.md` 明确记录了 scope cut:「no EXIF-filter `after-tabs` slot」——当年是有据的砍,现在按 P7b 补回。回源 Vue2 `PhotosToolbar.vue` 第 15-16 行,插槽紧跟在 `</div>`(tabs)之后、`<div style="flex:1">` 之前。

- [ ] **Step 1: 写失败的测试**

在 `src/photos/components/__tests__/PhotosToolbar.test.ts` 末尾追加:

```ts
describe('P7b-T3: after-tabs 槽位', () => {
  it('不传槽位时不多渲染任何节点(默认形态与 P1 一致)', () => {
    const w = mountToolbar()
    expect(w.find('[data-test="after-tabs-probe"]').exists()).toBe(false)
  })

  it('传入的槽位内容渲染在 .tabs 之后、计数与密度按钮之前', () => {
    const w = mount(PhotosToolbar, {
      props: { tab: 'photo', density: 'comfortable', count: 3 },
      slots: { 'after-tabs': '<i data-test="after-tabs-probe">x</i>' },
      global: { plugins: [i18n] },
    })
    const probe = w.get('[data-test="after-tabs-probe"]')
    const children = Array.from(w.get('.photos-toolbar').element.children)
    const tabsIdx = children.findIndex(el => el.classList.contains('tabs'))
    const probeIdx = children.indexOf(probe.element)
    const densityIdx = children.findIndex(el => el.classList.contains('density'))
    expect(tabsIdx).toBeGreaterThanOrEqual(0)
    expect(probeIdx).toBe(tabsIdx + 1)
    expect(probeIdx).toBeLessThan(densityIdx)
  })
})
```

> 若该测试文件里没有现成的 `mountToolbar()` 助手或 `i18n` / `mount` / `PhotosToolbar` 导入,照文件顶部既有写法补齐;**不要改动已有用例**。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/photos/components/__tests__/PhotosToolbar.test.ts`
Expected: 第二条 FAIL(`probeIdx` 为 -1,找不到探针节点)。

- [ ] **Step 3: 写实现**

在 `src/photos/components/PhotosToolbar.vue` 模板里,`</div>`(tabs 结束)与 `<div style="flex:1"></div>` 之间插入:

```html
    <!-- P7b-T3:EXIF 筛选条(漏斗 + 内联展开的胶囊)挂在标签页之后 —— 位置照 Vue2
         NimoOS-UI src/views/Photos/PhotosToolbar.vue:15-16。P1 task-7-brief 当年
         明确砍掉过这个槽位,本期按 P7b 补回。 -->
    <slot name="after-tabs" />
```

同时把文件顶部注释里那句 `// P1 scope cut (task-7-brief.md): no EXIF-filter `after-tabs` slot, no icon` 改成:

```
// P1 scope cut (task-7-brief.md): no icon library — tabs/density buttons render as
// plain text with i18n labels. (`after-tabs` 槽位已由 SP7-P7b-T3 补回。)
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm exec vitest run src/photos/components/__tests__/PhotosToolbar.test.ts && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS;tsc exit 0。

- [ ] **Step 5: 提交**

```bash
git add src/photos/components/PhotosToolbar.vue src/photos/components/__tests__/PhotosToolbar.test.ts
git commit -m "feat(photos): P7b-T3 PhotosToolbar 补回 after-tabs 槽位(P1 scope cut 回改一)"
```

---

