# Task 5 报告 — i18n 收口扫描 + 全量守门 + 台账

无源码改动。执行于 NimoOS-New-UI 仓根目录(除 Step 4 显式 `cd` 到 NimoOS-UI)。

## Step 1 — 模板中文文本节点扫描

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<template>/,/^<\/template>/' "$f" | sed 's/<!--.*-->//' \
    | grep "[一-龥]" | grep -vE "^\s*(<!--|[^<]*-->)"
done | grep -v "^\s*$" | tee /tmp/sp6p6-tpl-cn.txt | wc -l
```

命中数:**3**(期望 0,非零,已逐行核验)

| 文件:行 | 判定 |
|---|---|
| `src/storage/components/RaidReplacingCard.vue:49` | 多行 `<!-- -->` 注释的续行(开合标记不同行,单行 sed 剥不掉) → 注释,非文案 |
| `src/storage/components/SnapshotTimeline.vue:96` | 同上,多行注释续行 → 注释,非文案 |
| `src/views/StorageRaidDetail.vue:205` 和 `:237`(两处不同注释块) | 同上,多行注释续行 → 注释,非文案 |

结论:0 条真实用户可见硬编码中文,不补 i18n 键。

## Step 2 — `<script>` / `.ts` 中文字面量扫描

命令一:

```bash
grep -rn "[一-龥]" src/storage --include="*.ts" | grep -v "\.test\.ts" \
  | grep -vE "^[^:]+:[0-9]+:\s*//" | grep -E "['\"\`][^'\"\`]*[一-龥]" | tee /tmp/sp6p6-ts-cn.txt | wc -l
```

命中数:**1** → `src/storage/util/storageMap.ts:45`,`// RAID 卷归 /storage/raid(P3)` 是行尾注释
（过滤器只挡"整行以 `//` 开头"，挡不住"代码 + 行尾注释"）→ 注释，非文案。

命令二:

```bash
for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<script/,/<\/script>/' "$f" | grep -n "[一-龥]" \
    | grep -vE ":\s*(//|\*|/\*)" | grep -E "['\"\`][^'\"\`]*[一-龥]" | sed "s|^|$f:|"
done | tee /tmp/sp6p6-vue-script-cn.txt | wc -l
```

命中数:**1** → `src/storage/components/SnapshotPanel.vue:89`，`// Vue2 同款:只有成功才清备注`
同样是行尾注释 → 注释，非文案。

**Step 1+2 合计 5 条命中，逐条打开文件核验，全部是注释（多行 HTML 注释续行 / 行尾 `//` 注释），
0 条真实 i18n 欠账。与 SP4-P8 / SP5-P8 的历史结论一致。不补键，不提交。**

## Step 3 — New-UI 全量守门

| 检查 | 结果 |
|---|---|
| `pnpm vitest run src/i18n/parity.test.ts src/styles/color-guard.test.ts` | 2 files / 125 passed，绿 |
| `pnpm test` | 247 files / **1572 passed, 0 failed** |
| `pnpm exec vue-tsc --noEmit` | 零输出，零错误 |
| `pnpm build`（内部先跑 vue-tsc 再 vite build） | 成功，`✓ built in 11.01s`（仅 chunk 体积警告，非错误） |

## Step 4 — Vue2 仓全量守门

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm test 2>&1 | tail -20
git status --short -- src/
```

结果：154 files passed / 2 files failed；**1440 passed / 8 failed**。失败集中在
`tests/nimoTaskBar.test.js`（5 条）+ `tests/settingsStore.test.js`（3 条），与 Task 0 记录的
预先失败基线（8 条，同两文件）数量和位置完全一致，未新增红，未修复（brief 明确要求不修）。
`git status --short -- src/` 无输出 → `src/` 干净，所有改动已提交。

## Step 5 — 台账

已写入 `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/sp6/progress-p6.md`（含四点行为矩阵、
Task 0 三文件处置 + 两个提交 hash、Task 1-4 两仓提交 hash、Step 1/2 逐字命令 + 命中 + 核验结论、
两仓测试/tsc/color-guard/parity/build 结果、各任务变异验证摘录、留白 Task 6 部分）。

## Step 6 — 提交

Step 1/2 无真实 i18n 欠账，**无补键，无提交**。（New-UI 侧台账文件在 `.superpowers/` gitignore
内，不 add 不 commit；Vue2 侧本任务无任何代码或文档改动。）

## 其余观察（不属于本任务范围，仅记录不处置）

- NimoOS-New-UI 仓索引里存在 3 处非本会话产生的暂存删除（`design-export/*.html`），未触碰，
  也未做任何提交（无需提交）。
- 两仓各有若干与本任务无关的 `docs/` 已改动/未跟踪文件（`FRONTEND_API_GUIDE.md`、多个
  `docs/superpowers/plans/*.md`），未触碰。
