## Task 9: SV 详情灯箱导航序对齐当前排序

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`:481` 的 `lb.openAt`）
- Test: `src/views/PhotosSmartViewDetail.assets.test.ts`

**Vue2 源码坐标:** `33b05636` 的 `#117` 子提交「SV 详情灯箱导航序对齐当前排序」

**取证依据 E8:** 现在传的是 `store.matchedAssets`（未排序）。T6 建立了 `sortBy` 后，网格按排序渲染，
而灯箱仍按原始顺序导航 ⇒ 用户在灯箱里按「下一张」会跳到屏幕上并不相邻的照片。

**Interfaces:** Consumes T6 的 `sortBy`

**做:** 把 `lb.openAt(p, store.matchedAssets, 0)` 的第二参数换成**与网格同一份排序后的列表**，
且起始下标要用该照片在排序后列表里的位置（**不是恒定 0**，除非现有实现的第三参数另有语义 ——
打开 `useLightbox` 核对 `openAt(photo, entryList, startMs?, query?)` 的第三参数究竟是什么，
P1 记忆里登记的签名第三参数是 `startMs`，不是下标）。

- [ ] **Step 1: 写失败测试**

```ts
it('hands the lightbox the same order the grid is showing', async () => {
  // switch sort to date-taken, click the third tile, assert the list passed to openAt
  // is the sorted list and its first element matches the grid's first tile
})
it('keeps the lightbox order in step after the sort changes while it is closed', async () => {})
```

- [ ] **Step 2: 跑测试确认失败**

> 注意 P1 的教训：`vi.spyOn(lb, 'openAt')` **拦不住** —— `useLightbox()` 每次返回新的对象字面量。
> 用该文件既有的 lightbox 断言手法（打开被测组件已 mock 的模块），不要照搬 spyOn。

- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 变异验证** —— 把参数改回 `store.matchedAssets` → 首条应红
- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail.assets.test.ts
git commit -m "fix(photos): open the lightbox in the order the smart-view grid shows"
```

---

