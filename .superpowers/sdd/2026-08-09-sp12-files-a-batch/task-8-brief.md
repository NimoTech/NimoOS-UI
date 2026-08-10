### Task 8: F9 —— 面包屑最后一段与表头空列不再假装可点

**用户看到什么**：① 面包屑最后一段（当前目录）鼠标移上去有 hover 反馈、点了会白导航一次到自己。② 列表表头最左的复选框列和最右的星标列鼠标变手型，点了没反应。

**Files:**
- Modify: `src/files/components/Breadcrumb.vue:26,35`
- Modify: `src/files/components/FileListView.vue:52`
- Test: `src/files/components/Breadcrumb.test.ts`、`src/files/components/FileListView.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// Breadcrumb.test.ts
it('does not navigate when the current directory segment is clicked', async () => {
  const w = mountCrumb({ path: '/DATA/a/b' })
  const crumbs = w.findAll('.crumb')
  await crumbs[crumbs.length - 1].trigger('click')
  expect(w.emitted('navigate')).toBeUndefined()
})

it('still navigates from an ancestor segment', async () => {
  const w = mountCrumb({ path: '/DATA/a/b' })
  await w.findAll('.crumb')[0].trigger('click')
  expect(w.emitted('navigate')).toBeTruthy()
})
```

```ts
// FileListView.test.ts —— 用 cssCascade 工具算优先级，jsdom 不做样式计算
it('does not give the non-sortable header cells a pointer cursor', () => {
  const css = fs.readFileSync(new URL('./FileListView.vue', import.meta.url), 'utf8')
  // cursor:pointer 必须挂在真能排序的格子上，不能挂在通吃的 .head-cell 上
  expect(css).not.toMatch(/\.head-cell\s*\{[^}]*cursor:\s*pointer/)
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/components/Breadcrumb.test.ts src/files/components/FileListView.test.ts
```

- [ ] **Step 3: 实现**

`Breadcrumb.vue`：最后一段渲染成不可交互元素。

```vue
<!-- The last segment is where you already are: it used to be a live button
     that navigated to the current directory, with hover feedback promising
     something would happen. -->
<span v-if="i === segments.length - 1" class="crumb current">{{ seg.label }}</span>
<button v-else class="crumb" @click="emit('navigate', seg.vpath)">{{ seg.label }}</button>
```

样式里 `.crumb.current` 保留原有配色/字重不动；确认 `.crumb:hover` 只对 `button.crumb` 生效（`<span>` 不再是 button，但 `.crumb:hover` 仍会命中它）—— 把 hover 规则收窄：

```css
button.crumb:hover { background: var(--chip-bg); color: var(--fg); }
```

> 注意原文里 `.crumb` 与 `.crumb:hover` 用了 `var(--fg-muted, #9aa4bf)` / `var(--chip-bg, rgba(255,255,255,0.06))` 这种**带硬编码兜底色**的写法。本任务既然动到这两条规则，**顺手把兜底字面量去掉**（token 在两套主题里都有值，兜底是死的），符合仓库的颜色硬约束。

`FileListView.vue:52`：

```css
/* Only the sortable columns react to clicks; the checkbox and star columns
   are spacers and used to inherit a pointer cursor that promised nothing. */
.head-cell { user-select: none; }
.head-cell.is-sortable { cursor: pointer; }
```

并在 `:32` 那个 `v-for` 渲染的可排序格子上补 `is-sortable` 类。

- [ ] **Step 4: 跑测试确认它绿 + 守卫门**

```bash
pnpm exec vitest run src/files/components/Breadcrumb.test.ts src/files/components/FileListView.test.ts src/styles/
```
（`src/styles/` 下有 color-guard 与注释完整性守卫，动过 CSS 必须跑。）

- [ ] **Step 5: 提交**

```bash
git add -A src/
git commit -m "fix(files): stop advertising clicks that do nothing

The breadcrumb's last segment navigated to the directory you were already
in, and the two spacer header cells inherited a pointer cursor from the
sortable ones."
```

---

