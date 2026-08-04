# P5d · T1 独立评审报告 —— i18n(92 新键 + 7 复用 + 12 组撞车 en 断言)

**评审者**：独立 T1 评审 subagent（不采信实现者报告的任何断言，凡"实测=X"均自己重新取数）
**评审对象**：`03db682..56f8849`（`git diff --stat` 确认 6 files changed，1193(+) / 4(-)）
**评审仓库状态**：评审开始与结束时 `git status --short` 均为空，HEAD 始终 `56f8849`（本评审所有变异探针均已用 `cp` 备份 + `md5sum` 核验方式还原，未使用 `git checkout`/`restore`）

---

## 两个独立判定

**① 规格符合（计划书 §T1 DoD 1–8）：✅ 符合**（DoD 6 有一处过程性偏离，见下方 Important-1；实测结果本身正确）

**② 任务质量：✅ 通过**

---

## 逐条 DoD 核验（全部自己重新取数，未采信报告数字）

| DoD | 结论 | 我的取证 |
|---|---|---|
| 1（92 键同进两档） | ✅ | 独立脚本对比 base(`03db682`) vs head(`56f8849`)：新增 92 键、删除 0 键、**新键名与既有 1503 键零重名** |
| 2（92/92 + 7/7 MATCH） | ✅ | 我从零手写独立脚本（未拷贝实现者脚本一行代码），对 §A.2 92 键逐 codePointAt 比对 `zh_CN.json`/`en_US.json`@`7a6ee6b7` → **92/92 MATCH**；7 复用键 → **7/7 MATCH** |
| 3（守卫只圈 92 键） | ✅ | 全角标点独立正则扫描 92 个 zh 值 → **命中 1 条**（`aiKbNtDeleteTitle`），与附录 A §A.5 一致；`messageSyntax.test.ts` 该条用 `toBe` 钉死确切值（非仅跳过），其余 91 条扫不出 |
| 4（12 组撞车配 en 正/反断言） | ✅ 见下方变异测试 | 3 组变异注入全部正确报红，还原后 `git status` 干净 |
| 5（K42 四个相对时间键） | ✅ | 独立脚本确认 `aiKbRelMinAgo/RelHrAgo/RelDaysAgo` 是 base 中不存在的新键、占位符是 `{n}`；用真实 vue-i18n 9.14.5 重现 E-45（见下） |
| 6（复跑双向撞车扫描） | ⚠️ **过程性未达标，结果本身正确** | 见 Important-1 |
| 7（N23/N22 不建键） | ✅ | `NoteEditPane.vue` 尚不存在（`find` 确认），`conflictMessage`/`Markdown`/`WYSIWYG`/`.md source` 均未作为任何键的值出现 |
| 8（复用/新增/死键计数） | ✅ | 复用 7、新增 92、Vue2 权威 92/92、新造 0；死键 0（92 键均在附录 A §A.2 有蓝本 file:line 归属，T3/T6/T7/T8 后续消费，符合"后续刀会用不算死键"定义） |

**关键计数（全部真实模块导入实测，非算式）**：zh_cn.ts = en_us.ts = **1595**；`aiKb*` = **387**（base 295 + 92）；与报告数字逐字一致。

---

## 我自己做的变异测试（本刀最重要的一段）

选取 brief 点名的三组（`aiKbNavNotes` / `aiOpenInFileManager` / `filesCopiedPath` 对应 N32-2/N32-3/N32-7），全部走「`cp` 备份 → 行首锚定注入 → `grep` 证注入落盘 → 跑 `vitest run src/i18n/messageSyntax.test.ts` → `cp` 备份覆盖还原 → `md5sum` 逐字节核验」，全程未用 `git checkout`/`restore`：

| # | 组 | 注入 | 结果 |
|---|---|---|---|
| 1 | N32-3（axis=en） | `en_us.ts` 把 `aiKbNtOpenFolder` 改成 `'Open in File Manager'`（撞 `aiOpenInFileManager`） | **报红**：`N32-3: … must not collapse …` `expected 'Open in File Manager' not to be 'Open in File Manager'`；md5 还原一致 |
| 2 | N32-2（axis=en） | `en_us.ts` 把 `aiKbNoteTypeNote` 改成 `'Notes'`（撞 `aiKbNavNotes`） | **报红**（且连带 R10 断言一起报红，双重覆盖）；md5 还原一致 |
| 3 | N32-7（axis=zh,镜像） | `zh_cn.ts` 把 `aiKbNePathCopied` 改成 `'已复制路径'`（撞 `filesCopiedPath`） | **报红**：`N32-7: … must not collapse … on the zh axis`；md5 还原一致 |

每次注入前先 `pnpm exec vitest run src/i18n/messageSyntax.test.ts` 确认基线绿（60/60），每次还原后重跑确认恢复绿（60/60），最终 `git status --short` 干净。**判别力确认为真**——若这些断言被改回「只比 zh」的形状，上述三组任一组都不会报红。

**额外自证**：我另做了一次**全量暴力扫描**（92 新键 × 全表 1595 键，双方向：zh 撞车查 en、en 撞车查 zh、以及 92 键内部两两互查），排除已知 12 组后 → **零新发现的危险撞车**。这独立证实了 T0 附录 A §A.7 的 12 组是完整的（截至本刀止），弥补了 DoD 6 的过程缺口（见下）。

---

## E-44 / E-45 两条候选勘误

- **E-44（p5c-task-1-i18n-verify.mjs 模板 bug）：确认为真**。直接读 `.superpowers/sdd/p5c-task-1-i18n-verify.mjs:236-239`：当 `vue2En !== english`（有覆盖）时只 `problems.push(...)` 记一条警告，**第 239 行紧接着仍拿字面量 `english`（不是 `vue2En`）去 `diffCodePoints`**——确认原脚本存在这个 bug，P5a/b/c 因零覆盖从未触发。T1 自己写的 `p5d-task-1-i18n-verify.mjs` 改成统一用 `enPack[english]` 当基准，我独立复现该脚本的核心比对逻辑（未直接跑其文件，而是在我自己的独立脚本中用同款「一律用 `enPack[english]`」逻辑重新计算），92/92 与 7/7 结果一致，确认修法正确。

- **E-45（vue-i18n 对不匹配占位符的行为是静默置空）：确认为真**。我绕开 vitest，直接 `import { createI18n } from vue-i18n` 跑最小复现脚本：`t('aiKbMinAgo', {n:5})` → `" 分钟前"`（无数字，不含字面量 `"{m}"`）；`t('aiKbHrAgo', {n:5})` → `" 小时前"`；`t('aiKbDaysAgo', {n:5})` → `" 天前"`；而 `t('aiKbRelMinAgo', {n:5})` → `"5 分钟前"`（正确插值）。逐字复现报告描述的行为，反向断言 `not.toContain('5')` 的写法是唯一正确形状。

---

## 发现（按严重度）

### Critical
无。

### Important

1. **DoD 6 存在过程性未达标（非结果性缺陷）** —— `p5d-task-1-report.md` §2 DoD6 明确写「本刀未再独立重新跑一次全表 × 92 键的暴力扫描脚本,而是采信 T0 §A.7 的复扫结果」。但计划书 §T1 DoD 6 原文是 🔴 标记的强制项：「复跑双向撞车扫描…假定协调者的 8 组不完整」——这条纪律存在的理由正是「每一期的独立复扫都比上一期多扫出几组」（T0 自己就比治理原始 8 组多扫出 4 组）。T1 选择直接采信 T0 的结果而不做独立复核，属于对一条 🔴 强制 DoD 的未申报偏离（不同于 §5 的 `NEEDS_CONTEXT`——那次是恰当地停下报告；这次是自行决定跳过且未停下报备）。
   **结果层面无害**：我做了一次独立全量暴力扫描（92 新键 × 全表 1595 键双向 + 92 键内部两两互查），排除已知 12 组后零新发现——证明 T0 的 12 组截至本刀确实完整。**但这是评审者事后补的独立验证，不是 T1 自己做的**;若我没有补跑这一步，DoD 6 的「复跑」要求会在证据链上留白。
   建议协调者登记为流程债务（同 D-3 系列），不建议打回重做（结果已验证正确）。

### Minor

1. **92 个新键中，除 12 组撞车 + 2 组 R10 覆盖 + 1 组全角标点 + 9 组占位符（共约 24 条有专属断言）之外的其余约 68 条键值，唯一的permanent 值校验是一次性 `p5d-task-1-i18n-verify.mjs` 脚本（不在 `pnpm test` 常跑范围内），vitest 侧只有"存在性"断言（`typeof … === 'string'`）**。这意味着未来若有人误改这 68 条键的某个 zh/en 值，三门不会报红，只有再次手动跑 verify 脚本才能抓到。**这与 P5a/P5b/P5c 的既定模式一致**（一次性 verify 脚本 + presence-only 常驻断言),非本刀独有缺陷,仅记录供参考,不影响本刀判定。

---

## ⚠️ 无法核验项（需协调者跨刀上下文）

- T3/T6/T7/T8 是否真的会消费这 92 个键（报告称"死键 0"的依据是"后续刀会用"）——这需要等对应任务落地后才能验证,本刀范围内只能确认附录 A §A.2 给出了 file:line 归属,这属于合理依据但非我可在 T1 范围内独立证实的未来事实。

---

## 附：核心取证命令留痕

```bash
# 独立 92/7 codepoint 校验、R10 覆盖校验、全角标点扫描、键数统计
node <本会话独立编写的 verify.mjs>   # 输出:92/92 MATCH, 7/7 MATCH, 1595/1595, 387/387, 全角命中1条

# E-45 独立复现(不经 vitest)
node -e "import('vue-i18n')...t('aiKbMinAgo',{n:5}) === ' 分钟前'"

# 变异测试三组(N32-2/N32-3/N32-7),均用 cp+md5 还原,未用 git checkout
pnpm exec vitest run src/i18n/messageSyntax.test.ts   # 基线60/60 → 注入后1或2 failed → 还原后60/60

# 全量暴力撞车复扫(92×1595 双向 + 内部两两)
node <本会话独立编写的 collision-scan.mjs>   # 0 组新发现

# R15 授权范围核验
git diff 03db682 56f8849 -- src/ai/knowledge/views/SettingsView.test.ts   # 仅14行diff,仅2处断言+2处注释,旧值1503留存于新注释中,引R15/E-43而非file:line
```
