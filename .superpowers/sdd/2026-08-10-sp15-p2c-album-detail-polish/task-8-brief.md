## Task 8: 删除 SV 详情的 Add condition 入口

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`.sv-header-conds` `:648-652`）
- Modify: `src/photos/components/SmartViewConditionEditor.vue`（以实际路径为准）
- Test: 对应测试文件

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosSmartViewDetail.vue:26-30`（注释说明）+ `:700-710`
（`openAddCond`/`closeAddCond`/`submitCond`/`addCondSuggestion` 四个方法被删）

**机主裁定（spec §3.3）:** 跟着删。这是 Vue2 侧的产品决定（注释原文「用户追加需求」），不是遗漏。

**做:**
- 删「添加条件」按钮与它的弹出层
- **保留** `remove`（条件胶囊上的 ✕）
- 删掉只服务于 add 的方法与状态；`grep` 确认删干净，无死代码残留
- 若 `SmartViewConditionEditor` 删掉 add 后只剩 remove，考虑组件是否还有存在必要 ——
  **由实现者判断并在报告里说明**，不要为了少改文件而留一个只剩一半的组件壳

- [ ] **Step 1: 写失败测试**

```ts
it('no longer offers an add-condition entry', async () => {
  expect(w.find('[data-test="sv-add-cond"]').exists()).toBe(false)
})
it('still lets a condition be removed from its chip', async () => {})
it('leaves no orphaned add-condition handlers behind', () => {
  // read the SFC source and assert the four removed identifiers are gone
})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现删除**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 死代码复查** — `grep -n "openAddCond\|closeAddCond\|submitCond\|addCondSuggestion\|addCond" src/`，
  以及被删 i18n 键的消费者复查（零消费者才删键）
- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add -A src/views/PhotosSmartViewDetail.vue src/photos/components/ src/i18n/
git commit -m "feat(photos): drop the add-condition entry from the smart-view detail"
```

---

