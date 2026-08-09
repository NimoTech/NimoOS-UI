## Task 6: 收尾门 + 台账

**Files:**
- Create: `docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md`

**Interfaces:**
- Consumes: Task 1-5 的全部产出
- Produces: 交接文档

- [ ] **Step 1: 类型检查**

Run: `pnpm exec vue-tsc --noEmit`
Expected: clean，零输出

- [ ] **Step 2: 全量测试(前台跑,约 3 分钟,等它跑完)**

Run: `pnpm test`
Expected: 全绿。**把文件数与用例数抄下来**写进交接文档 —— 不要转述"应该是多少"，抄实际输出。

- [ ] **Step 3: i18n parity**

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS，9/9

- [ ] **Step 4: 构建**

Run: `pnpm build`
Expected: 成功

- [ ] **Step 5: 开源导出闸**

Run: `node oss/export.mjs --out /tmp/claude-1000/oss-check --no-commit --allow-dirty-oss`
Expected: 零真实泄漏（几个二进制跳过是预期内的）

- [ ] **Step 6: 与 sp12-plan-b 的合并预演**

```bash
git merge-tree --write-tree sp12-files-fixes sp12-plan-b > /tmp/claude-1000/merge-preview.txt; echo "exit=$?"
head -3 /tmp/claude-1000/merge-preview.txt
```

Expected: `exit=0` 且输出是单行 tree OID ⇒ 无冲突。若非 0，把冲突文件记进交接文档，**不要在本期解决** —— 合并顺序由控制器定。

- [ ] **Step 7: 写交接文档**

创建 `docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md`，必须包含：

1. **三条改了什么**，各一段：用户能看到的变化 + 代码坐标
2. **F14 判为不成立**的取证链（照抄 spec §0 的表，供下一轮审计免于重复开工）
3. **收尾门实测数字**（Step 1-6 的真实输出，不是预期值）
4. **真机验收清单**：照抄 spec §5 的 10 步，一步不删
5. **未做的相邻项**：F10（多选删除 all-or-nothing）—— 与 F12 同属「批量操作遇不合格成员」语义，本期定下的「过滤 + 告知跳过数」可直接复用；F3/F4 仍在清单上
6. **合并纪律**：与 `sp12-plan-b` 的重叠面 + Step 6 的预演结果 + 「后合的一方必须在合并结果上重跑全套门」

- [ ] **Step 8: 提交**

```bash
git add docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md
git commit -m "docs(sp12): hand off the Files legacy-fix batch"
```

---

## Self-Review

**Spec 覆盖**：spec §1（F17）→ Task 5；§2（F11）→ Task 1+2；§3（F12）→ Task 3+4，i18n 在 Task 4 Step 1；§4（测试策略）六行分别落在 Task 1 Step 1、Task 3 Step 1、Task 2 Step 1（菜单形态 + 端到端）、Task 4 Step 3、Task 5 Step 1；§5（真机验收 10 步）→ Task 6 Step 7 要求原样抄进交接文档；§6（边界）→ Global Constraints 的「不碰上传管线」+ Task 6 Step 7 第 5 点；§7（合并纪律）→ Task 6 Step 6。§0 的 F14 证伪 → Task 6 Step 7 第 2 点。无遗漏。

**占位符扫描**：无 TBD/TODO；每个代码步骤都给了可直接落地的完整代码。初稿留的两处「先查证」已在定稿前查掉并写死结论 —— toast 是堆叠数组（`stores/toast.ts:30-44`，断言改读 `toasts`，并据此明确「两条 toast」是有意选择）、两个网格测试文件均确认存在。计划里不再有待定项。

**类型一致性**：`contextTargets(entry, selected)` 在 Task 1 定义、Task 2 经 `ctxTargets` 包装消费；`isAlreadyShared` / `shareableFolders` 在 Task 3 定义，Task 4 分别在 `FileContextMenu.vue` 与 `Files.vue` 消费，返回的 `{ targets, skipped }` 字段名两处一致；`ctxTargetCount` 在 Task 2 Step 3 定义、Step 4 模板消费、Step 1 测试断言，三处同名。
