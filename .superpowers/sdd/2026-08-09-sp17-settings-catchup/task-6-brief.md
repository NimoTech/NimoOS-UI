### Task 6: 收尾门(五道)

**Files:** 不改代码,除非门红。

- [ ] **Step 1: 类型检查**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 0 错。

- [ ] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 全绿。**把真实的「文件数 / 用例数」记下来写进挂账文档,不要写约数。**
已知既有 flake:`src/files/upload/persist.test.ts:55` 偶发红(SP4 期遗留,与本期无关),单跑该文件确认能绿即可,别去改它。

- [ ] **Step 3: i18n 键对齐**

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS

- [ ] **Step 4: 开源导出**

Run: `node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/f58a5f4d-afa0-4fa2-950e-aa2dc8ebb7cb/scratchpad/sp17-oss --no-commit --allow-dirty-oss`
Expected: 零真实泄漏(二进制跳过属预期)。⚠️ 该守卫会把**注释里提到跨区文件的散文**也算命中 —— 若红,改写注释措辞,别加白名单。

- [ ] **Step 5: 构建**

Run: `pnpm build`
Expected: 成功(chunk 体量警告不算错)。

- [ ] **Step 6: 把五道门的真实输出补进挂账文档并提交**

```bash
git add docs/superpowers/2026-08-09-sp17-outstanding.md
git commit -m "docs(sp17): record the gate results"
```

---

## 完成后

**不做**的事(除非机主另有指示):不合并进 `master`、不推 origin、不跑 `scripts/deploy.sh`(会覆盖设备上 `/app/` 那一份,三条并行线共用一个部署目录)。验收一律起 dev server。
