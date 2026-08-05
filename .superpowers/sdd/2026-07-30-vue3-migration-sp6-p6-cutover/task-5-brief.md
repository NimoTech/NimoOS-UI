### Task 5: i18n 收口扫描 + 全量守门 + 台账

无源码改动预期(扫描发现问题才改,改则单独小提交)。

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/sp6/progress-p6.md`(台账;`.superpowers/` 在 gitignore 里,只落磁盘、不进 git)
- 扫描范围:`src/storage/`(components / stores / util)+ `src/views/Storage*.vue`(五个视图)

**Interfaces:**
- Consumes: Task 1–4 的全部改动。
- Produces: 台账文件 + 扫描结论,供 Task 6 记账引用。

- [ ] **Step 1: 模板中文文本节点扫描(期望 0)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<template>/,/^<\/template>/' "$f" | sed 's/<!--.*-->//' \
    | grep "[一-龥]" | grep -vE "^\s*(<!--|[^<]*-->)"
done | grep -v "^\s*$" | tee /tmp/sp6p6-tpl-cn.txt | wc -l
```

预期 `0`。非 0 则逐行看 `/tmp/sp6p6-tpl-cn.txt`:真的是硬编码中文文案 → 补 i18n 键(zh_cn + en_us 都加)并单独提交;是注释残留 → 记进台账说明为何不算欠账。

- [ ] **Step 2: `<script>` / `.ts` 中文字面量扫描(逐条核验)**

```bash
grep -rn "[一-龥]" src/storage --include="*.ts" | grep -v "\.test\.ts" \
  | grep -vE "^[^:]+:[0-9]+:\s*//" | grep -E "['\"\`][^'\"\`]*[一-龥]" | tee /tmp/sp6p6-ts-cn.txt | wc -l

for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<script/,/<\/script>/' "$f" | grep -n "[一-龥]" \
    | grep -vE ":\s*(//|\*|/\*)" | grep -E "['\"\`][^'\"\`]*[一-龥]" | sed "s|^|$f:|"
done | tee /tmp/sp6p6-vue-script-cn.txt | wc -l
```

两条命中都要**逐条核验**并把结论写进台账(SP4-P8 / SP5-P8 的结论都是「全是代码注释,欠账不存在」)。真有面向用户的硬编码中文 → 补键并单独提交。

- [ ] **Step 3: i18n parity + color-guard + 全量 + 构建**

```bash
pnpm vitest run src/i18n/parity.test.ts src/styles/color-guard.test.ts
pnpm test 2>&1 | tail -15
pnpm exec vue-tsc --noEmit
pnpm build 2>&1 | tail -15
```

预期:parity 与 color-guard 绿;全量绿;tsc 零错;build 成功。

- [ ] **Step 4: Vue2 仓全量守门**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm test 2>&1 | tail -20
git status --short -- src/
```

预期:全量绿;工作区 `src/` 干净(所有改动已提交)。

- [ ] **Step 5: 写台账**

`/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/sp6/progress-p6.md`,内容含:
- 四个 cutover 点与那一把 flag 的最终形态(照 spec §4 的行为矩阵抄一份)。
- Task 0 三个文件的处置结果 + 两个提交 hash。
- Task 1–4 的提交 hash(两仓分列)。
- **Step 1/2 三条扫描命令逐字 + 命中数 + 逐条核验结论。**
- 两仓全量测试用例数、tsc、color-guard、parity、build 结果。
- 变异验证记录:每个任务撤回了什么、哪条测试变红。
- 留白待 Task 6 填:部署产物入口 chunk、真机验收结果。

- [ ] **Step 6: 提交(仅 Vue2 仓若有 i18n 补键;New-UI 台账不进 git)**

若 Step 1/2 没有补键,本任务**无提交**。台账文件在 gitignore 内,不需要也不能 `git add`。报告扫描数字与台账路径。

---

