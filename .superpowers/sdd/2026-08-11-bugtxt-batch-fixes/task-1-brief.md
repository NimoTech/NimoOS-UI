### Task 1: Bug 3 — "清空"按钮改为"取消选择"

选中文件后工具栏的"清空"(清空选择)会被理解成"清空文件夹"。Vue2 老仓无同款按钮,最接近语感是 `cancel-all: 全部取消`;采用"取消选择"。

**Files:**
- Modify: `src/i18n/zh_cn.base.ts:23`(`filesClearSel: '清空'`)
- Modify: `src/i18n/en_us.base.ts:23`(`filesClearSel: 'Clear'`)
- Modify: `src/files/components/SelectionToolbar.test.ts`(第 8 行附近的内联 mock messages 里有 `filesClearSel: '清空'`,以及任何按 `'清空'` 文本断言的用例)

**Interfaces:**
- Consumes: i18n key `filesClearSel`(使用处:`src/files/components/SelectionToolbar.vue:12`、`src/files/snapshot/SnapshotSelectionToolbar.vue:28` —— 两处共用同一 key,语义都是"取消选择",**不需要**改这两个组件)
- Produces: 无新接口

- [ ] **Step 1: 改 i18n 两个文件**

`src/i18n/zh_cn.base.ts:23`:`filesClearSel: '清空',` → `filesClearSel: '取消选择',`
`src/i18n/en_us.base.ts:23`:`filesClearSel: 'Clear',` → `filesClearSel: 'Deselect',`

- [ ] **Step 2: 同步测试 mock 与断言**

打开 `src/files/components/SelectionToolbar.test.ts`,把 mock messages 里的 `filesClearSel: '清空'` 改为 `filesClearSel: '取消选择'`;`grep -n "清空" src/files/ -r` 检查是否还有按文本查询的断言,一并更新。

- [ ] **Step 3: 跑相关测试确认全绿**

Run: `pnpm vitest run src/files/components/SelectionToolbar.test.ts src/i18n/parity.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/components/SelectionToolbar.test.ts
git commit -m "fix(files): reword clear-selection button so it cannot read as emptying a folder"
```

---

