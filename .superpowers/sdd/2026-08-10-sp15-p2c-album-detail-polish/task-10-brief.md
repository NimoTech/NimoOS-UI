## Task 10: Albums 页智能卡同构渲染 + 删 SmartViewCard

**Files:**
- Modify: `src/views/PhotosAlbums.vue`（`:411` 的 `<SmartViewCard>`、`:24` 的 import、CSS）
- Delete: `src/photos/components/SmartViewCard.vue`
- Delete: `src/photos/components/__tests__/SmartViewCard.test.ts`
- Test: `src/views/__tests__/PhotosAlbums.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumsView.vue:93-146`（同构卡片 + 创建卡）

**做:**
1. 智能卡改成与手动相册卡同构的内联渲染：
   `.album-card` > `.album-cover`（`<img>` 取 `seeds[0]`，空则 `.album-cover-fallback`）
   + `.al-smart-badge`（Smart View 角标）+ `.al-live-dot`（Live/Paused 呼吸点）
   + `.album-title` + `.album-meta`（`{n} photos` · Live/Paused）
2. **不再上卡面:** 三图拼贴、条件 chips、阈值胶囊
3. `New album` 创建卡尺寸对齐相册卡：虚线框收窄到 `.album-create-cover`，
   外层补两行 `visibility:hidden` 的隐形文字行（与 `.album-title`/`.album-meta` 同规格），
   **不用硬编码 px** —— 随主题/字号自然对齐
4. 删 `SmartViewCard.vue` 与它的测试

**E4：删这两个文件不需要改开源剥离清单**（`oss/manifest.mjs:90` 的 `'src/photos'` 整目录条目已覆盖）。
删完仍要跑一次 `pnpm exec vitest run oss/` 确认（工作树先提交干净，见 Global Constraint 7）。

**保留不动:** `buildMixedAlbums` / `sortMixed` / `item.kind` / 网格 `:key` 的 kind 前缀。
（P2b Task 3 已查明 kind 前缀不可被测试观测 —— Vue 的 `isSameVNodeType` 比较 (type, key) 对，
两种卡是不同 vnode 类型，永远不会混淆。**别再花一轮去给它写测试**，注释已在文件里登记原因。
本任务把智能卡从组件改成 `<div>` 之后两种卡变成同一 vnode 类型，**这个结论随之失效** ——
届时 kind 前缀就真的是载荷了，请补一条同 raw id 的渲染测试。）

**Vue2 的 `al-live-dot` 坑（`#116` 第二条子提交）:** 后代选择器不匹配导致呼吸点渲染成空心点，
Vue2 专门补了显式样式。**照抄那条修复**，不要只搬第一条子提交。

- [ ] **Step 1: 写失败测试**

```ts
it('renders a smart album with the same card shape as a manual album', async () => {
  expect(w.findAll('.album-card')).toHaveLength(2)   // one manual, one smart
  expect(w.find('.sv-card').exists()).toBe(false)
})
it('uses the first seed as the smart card cover', async () => {})
it('falls back to the neutral cover when the smart view has no seeds', async () => {
  expect(w.find('.album-cover-fallback').exists()).toBe(true)
  expect(w.find('.album-cover img').exists()).toBe(false)   // never an empty-src img
})
it('shows the smart badge and the live dot on the cover', async () => {})
it('shows the paused state in both the dot and the meta row', async () => {})
it('no longer puts conditions or the threshold on the card face', async () => {})
it('opens the smart view detail when the card is clicked', async () => {})
it('renders both cards when a manual album and a smart view share a raw id', async () => {
  // now load-bearing: both cards are plain divs, so the kind prefix in :key is the only
  // thing keeping Vue from treating them as the same vnode
})
it('gives the create tile the same total height as an album card', async () => {
  expect(w.find('.album-create .album-title').attributes('style')).toContain('visibility: hidden')
})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现同构卡片 + 创建卡 + 删组件**
- [ ] **Step 4: 跑测试确认通过** — `pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/styles src/i18n/parity.test.ts`
- [ ] **Step 5: 变异验证**

1. 去掉 `:key` 的 kind 前缀 → 「shares a raw id」用例应红（**这次必须真的红** —— 若仍不红，
   说明测试没能构造出同 vnode 类型的冲突，报告里如实说明，不要假装通过）
2. 空 seeds 时渲染 `<img>` → 「never an empty-src img」应红
3. 删掉 `al-live-dot` 的显式样式 → 若无测试覆盖，在报告中说明这是 CSS-only 无法被 jsdom 观测

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add -A src/views/PhotosAlbums.vue src/views/__tests__/PhotosAlbums.test.ts src/photos/components/
git commit -m "refactor(photos): render smart albums with the manual album card shape"
```

---

