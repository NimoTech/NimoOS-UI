### Task 4: Bug 5 — 拖应用上桌不查重,重复图标

`useAddPanel.ts:34` 的 `dupWidget` 只覆盖 `widget`/`appwidget` 两种 kind,`app`(和 `folder`)一律放行 → 同一 app 可无限次上桌;另外 `layout.ts:193` 的 `autoPin` 只看 `seen` 集合、不看 `items` 里是否已有同 key 磁贴,手动 pin 过一个未进 `seen` 的应用后,下一轮 autoPin 会再加一个。两处都补。

**Files:**
- Modify: `src/home/composables/useAddPanel.ts:32-53`
- Modify: `src/home/stores/layout.ts:193-198`(autoPin 的 push 分支)
- Modify: `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts`(`addPanelWidgetExists` 附近,zh 约 320 行,新增 2 个 key)
- Test: `src/home/composables/useAddPanel.test.ts`、`src/home/stores/layout.test.ts`(autoPin describe 在 176 行起)

**Interfaces:**
- Consumes: `LayoutItem`(`src/home/grid/types.ts`:`kind: 'widget'|'app'|'folder'|'photo'|'appwidget'`,`key: string`,folder 另有 `path?: string`);`layout.pin` / `layout.items` / `ui.showToast` / `i18n.global.t`。
- Produces: `useAddPanel()` 返回值中 `pinToFree(desc): boolean` / `spawnPlace(desc, tc, tr): boolean` 语义变更:desc 为已上桌的 app(按 `kind==='app' && key` 判等)或 folder(按 `kind==='folder' && path` 判等)时返回 `false` 并 toast。新增 i18n key:`addPanelAppExists`、`addPanelFolderExists`。

- [ ] **Step 1: 写红测试**

在 `src/home/composables/useAddPanel.test.ts` 中新增(照文件里现有用例的 setup 惯例,含 `__resetAddPanelForTest`):

```ts
it('同一 app 第二次 pinToFree 被拒并 toast', () => {
  const { pinToFree } = useAddPanel(dims)
  expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 })).toBe(true)
  expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 })).toBe(false)
  expect(layout.items.filter((i) => i.kind === 'app' && i.key === 'jellyfin')).toHaveLength(1)
})

it('同一 folder(按 path 判等)第二次 spawnPlace 被拒', () => {
  const { spawnPlace } = useAddPanel(dims)
  const desc = { kind: 'folder' as const, key: 'docs', path: '/DATA/docs', w: 1, h: 1 }
  expect(spawnPlace(desc, 1, 1)).toBe(true)
  expect(spawnPlace(desc, 2, 1)).toBe(false)
})
```

在 `src/home/stores/layout.test.ts` 的 autoPin describe 中新增:

```ts
it('autoPin 不重复添加桌面上已有的同 key app 磁贴(手动 pin 后未进 seen 的场景)', () => {
  const s = useLayoutStore()
  s.pin({ kind: 'app', key: 'jellyfin', c: 1, r: 1, w: 1, h: 1 }) // 手动上桌,不进 seen
  s.autoPin([{ key: 'jellyfin' }], dims)
  expect(s.items.filter((i) => i.kind === 'app' && i.key === 'jellyfin')).toHaveLength(1)
  // seen 要补记,否则下一轮还会尝试
})
```

(具体 `dims`/store 初始化照各测试文件现有惯例;`autoPin` 的 decl 形状参考同 describe 现有用例。)

Run: `pnpm vitest run src/home/composables/useAddPanel.test.ts src/home/stores/layout.test.ts`
Expected: FAIL(新用例红,旧用例必须仍绿)

- [ ] **Step 2: 实现 useAddPanel 查重**

`src/home/composables/useAddPanel.ts`,替换 32-35 行的判重块:

```ts
const widgetUsed = (key: string) => layout.items.some((it) => it.kind === 'widget' && it.key === key)
const appWidgetUsed = (key: string) => layout.items.some((it) => it.kind === 'appwidget' && it.key === key)
const appUsed = (key: string) => layout.items.some((it) => it.kind === 'app' && it.key === key)
const folderUsed = (path: string) => layout.items.some((it) => it.kind === 'folder' && it.path === path)
// 查重覆盖 widget/appwidget/app/folder 四种 kind(photo 允许重复添加)。
// folder 按 path 判等:不同盘下允许同名文件夹并存。
const isDuplicate = (desc: Desc) =>
  (desc.kind === 'widget' && widgetUsed(desc.key)) ||
  (desc.kind === 'appwidget' && appWidgetUsed(desc.key)) ||
  (desc.kind === 'app' && appUsed(desc.key)) ||
  (desc.kind === 'folder' && folderUsed(desc.path ?? ''))
const existsMsgKey = (kind: Desc['kind']) =>
  kind === 'app' ? 'addPanelAppExists' : kind === 'folder' ? 'addPanelFolderExists' : 'addPanelWidgetExists'
```

`pinToFree` 第一行 `if (dupWidget(desc)) return false` 改为:

```ts
if (isDuplicate(desc)) { ui.showToast(i18n.global.t(existsMsgKey(desc.kind))); return false }
```

`spawnPlace` 第一行改为:

```ts
if (isDuplicate(desc)) { ui.showToast(i18n.global.t(existsMsgKey(desc.kind))); return false }
```

`toggleWidget` 里的 `dupWidget(...)` 改名为 `isDuplicate(...)`(行为等价:它只传 widget desc)。注意 `toggleWidget` 的非重复分支调用 `pinToFree`,此时 `isDuplicate` 必为 false,不会双重 toast。

- [ ] **Step 3: 实现 autoPin 查重**

`src/home/stores/layout.ts` autoPin 的 push 分支(193-198 行)改为:

```ts
if (!items.value.some((it) => it.kind === 'app' && it.key === d.key)) {
  const pos = firstFree(1, 1, items.value, dims)
  if (pos) items.value = [...items.value, tag({ kind: 'app', key: d.key, c: pos.c, r: pos.r, w: 1, h: 1 })]
}
if (d.widget && !items.value.some((it) => it.kind === 'appwidget' && it.key === d.key)) {
  const wpos = firstFree(d.widget.w, d.widget.h, items.value, dims)
  if (wpos) items.value = [...items.value, tag({ kind: 'appwidget', key: d.key, c: wpos.c, r: wpos.r, w: d.widget.w, h: d.widget.h })]
}
```

(`seen.value.add(d.key)` 与 `changed = true` 保持原样 —— 手动 pin 过的 app 借此补记进 seen。)

- [ ] **Step 4: 加 i18n key**

`src/i18n/zh_cn.base.ts`(`addPanelWidgetExists` 下一行):

```ts
  addPanelAppExists: '该应用已在主页',
  addPanelFolderExists: '该文件夹已在主页',
```

`src/i18n/en_us.base.ts` 同位置:

```ts
  addPanelAppExists: 'This app is already on the home screen',
  addPanelFolderExists: 'This folder is already on the home screen',
```

- [ ] **Step 5: 跑测试确认绿**

Run: `pnpm vitest run src/home/composables/useAddPanel.test.ts src/home/stores/layout.test.ts src/i18n/parity.test.ts src/home/components/AddPanel.test.ts src/home/components/AddPanel.spawn.test.ts src/home/components/AddPanel.spawn-place.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/home/composables/useAddPanel.ts src/home/stores/layout.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/home/composables/useAddPanel.test.ts src/home/stores/layout.test.ts
git commit -m "fix(home): prevent duplicate app/folder tiles on the desktop

The add-panel dedup only covered widget kinds, so dragging the same app in
repeatedly stacked identical tiles; autoPin additionally trusted the seen
set alone and would re-add an app the user had already pinned manually."
```

---

