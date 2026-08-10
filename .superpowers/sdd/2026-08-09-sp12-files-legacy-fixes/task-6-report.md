# Task 6 报告 —— 收尾门 + 交接文档

## 概述

按 brief 顺序跑了六道门，写了交接文档并提交。六道门里 **Gate 1/3/4 全绿，Gate 2/5 因同一
根因各命中一处失败，Gate 6 需要现场适配**（`sp12-plan-b` 在本任务执行期间已经合入
master，分支被清理，brief 假设的前提在执行过程中变得过时）。未在本任务里修任何源码，按要
求只报告、不现场修。

## 前置动作：清理阻塞门的脏树（非本任务范围，但必须先做）

开工时发现 `docs/superpowers/plans/2026-08-09-sp12-files-legacy-fixes.md` 有未提交改动
（Task 1/2/4 把源码里的中文测试描述译成英文时，忘了同步这份计划文档里的代码镜像片段）。
这份脏树会导致 `oss/export.mjs` 的"工作树必须干净"检查失败，进而拖垮 `oss/tree.test.mjs`
等三个 oss 测试文件——这些失败会污染 Gate 2 的真实数字，让人分不清哪些红是这批次真正引入
的。判断这属于"补齐上一个任务遗漏的提交"而非"本任务改源码"，于是先把这份纯文档镜像同步
提交（`8fbecf7`），再跑六道门。

## Gate 1 —— 类型检查

命令：`pnpm exec vue-tsc --noEmit`
结果：**PASS** —— exit 0，零输出。

## Gate 2 —— 全量测试（前台跑，等了约 2 分 45 秒）

命令：`pnpm test`
实测数字：
```
Test Files  1 failed | 658 passed (659)
     Tests  1 failed | 10509 passed (10510)
  Start at  13:46:54
  Duration  164.68s (transform 34.69s, setup 119.04s, import 145.10s, tests 195.90s, environment 251.49s)
```

失败的是 `oss/tree.test.mjs > 泄漏守卫 > 不带 --skip-guard 也能跑通`，报错：
```
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:2 [photo] // same origin and logic as photosLayoutHeightCap.test.ts in the photos area,
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:11 [photo] // Unlike the photos area: photos had 11 pages each with an inner scroll container already,
[oss] 失败:泄漏守卫命中 2 处,一个字节都不落盘。
```

根因：Task 5（提交 `70c24b0`）新增的 `src/views/__tests__/filesLayoutHeightCap.test.ts`
头部注释里用 "photo" 类比相册区同名守卫文件，撞上开源导出对 "photo" 的软禁词守卫
（`oss/forbidden.mjs`）。这个守卫要求每一处合法出现都要按"文件+整行精确匹配"逐条登记白
名单（该文件里已有 40+ 条这样的先例），这两行新注释从来没有补登记。**这是本批次真实引入
的缺口，不是环境噪音或已知噪音清单里的东西**——Task 5 大概率只跑了该文件自身的 vitest，
没跑到会触发开源导出闸的路径，直到这次全量收尾门才第一次暴露。按 Global Constraints 没有
现场修，已完整记入交接文档「三、收尾门实测数字」。

已知无害噪音（如实出现，未追查）：jsdom `Not implemented: navigation` 警告 + 相册区
`favorites.test.ts` 的 `/tmp/nimoos-www-xxx 不存在` 报错，均来自不相关的相册测试
`exportZip`；`DesktopContextMenu.test.ts` 在全量套件里通过（本次是全量跑，孤立跑的已知
flake 未复测，也不需要复测）。

## Gate 3 —— i18n parity

命令：`pnpm exec vitest run src/i18n/parity.test.ts`
结果：**PASS** —— `Test Files 1 passed (1)`；`Tests 9 passed (9)`。

## Gate 4 —— 构建

命令：`pnpm build`
结果：**PASS** —— exit 0（用 `> file 2>&1; echo $?` 单独确认过，不是 tail 管道污染的假
exit code），`✓ built in 17.30s`。唯一提示是预置的 >500kB chunk 体积警告，本批次未新增
任何大依赖，不是本批次引入、也不是错误。

## Gate 5 —— 开源导出闸

命令：`node oss/export.mjs --out /tmp/claude-1000/oss-check --no-commit --allow-dirty-oss`
结果：**FAIL** —— exit 1，与 Gate 2 完全同一根因、同样两行命中：
```
[oss] 5/6 泄漏守卫
  ⚠ 3 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定)
  ✗ src/views/__tests__/filesLayoutHeightCap.test.ts:2 [photo] ...
  ✗ src/views/__tests__/filesLayoutHeightCap.test.ts:11 [photo] ...
[oss] 失败:泄漏守卫命中 2 处,一个字节都不落盘。
```
3 个二进制/符号链接跳过（两张壁纸图 + 一个 settings.png）属于预期内、不计入泄漏判定，与
brief 里"几个二进制跳过是预期内的"完全对上，不是新问题。

给出两条候选修法（均遵循 `forbidden.mjs` 既有约定，不放宽词表，具体见交接文档）：改写注释
措辞避开 "photo" 字面量（推荐），或在 `forbidden.mjs` 补两条 `exactLine` 精确白名单。本任
务未执行任一修法。

## Gate 6 —— 与 sp12-plan-b 的合并预演

按字面执行：
```
git merge-tree --write-tree sp12-files-fixes sp12-plan-b
exit=1
merge-tree: sp12-plan-b - not something we can merge
```

排查发现 `sp12-plan-b` 分支已经不存在——`git log --all --oneline` 显示 master 上已有
`9100418 Merge sp12-plan-b: same-name conflict dialog, upload conflicts and folder merge`
（2026-08-09 13:15:27），说明 plan-b 已经在本任务执行期间（或刚好之前）合入 master，分支
与 worktree 被按惯例清理。brief 撰写时"plan-b 仍在进行中"的前提已经过时。

为了让 Gate 6 仍然产出有意义的信息，额外做了一次等价预演——`sp12-files-fixes` 对**当前
master**（已含 plan-b 改动）：
```
git merge-tree --write-tree sp12-files-fixes master
exit=0
dc2ecbcf2e2bb661bdd0bf54cc35d478af2e8769
```
exit=0 + 单行 tree OID ⇒ **无冲突**。spec §7 记录的重叠面（`Files.vue` 与两个 i18n
base 文件）在 plan-b 合入 master 之后依然不相交，验证成立。

（这次预演用临时 ref `refs/tmp-master-check` 指向本地 `master` 完成，`merge-tree` 全程
只读，跑完已用 `git update-ref -d` 清理掉临时 ref，没有移动任何分支、没有触碰工作树。）

## 交接文档

路径：`docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md`

六个必须小节全部包含：
1. 三条改了什么（F17/F11/F12），各一段用户可见变化 + 代码坐标 + 提交号
2. F14 判为不成立的取证链（原样照抄 spec §0 的表）
3. 收尾门实测数字（Gate 1-6 真实输出，含 Gate 2/5 失败根因的完整分析、Gate 6 的适配说明、
   已知无害噪音清单）
4. 真机验收清单（原样照抄 spec §5 的 10 步，一步没删没改）
5. 未做的相邻项：F10（复用 F12 的过滤+告知跳过数模式）+ F3/F4 挂账；另外把 brief 里给的
   六条评审推迟小项逐条收录，防止跟着 worktree 一起被回收后失传
6. 合并纪律：文件重叠面 + Gate 6 两次预演结果 + "合入前必须先处理 Gate 5 缺口"的提醒 +
   "后合的一方须在合并结果上重跑全套门"的强调（并指出 master 现在是绿的、这个缺口完全出
   自本分支，合并会把它带进去）

## 提交

```
8fbecf7 docs(sp12): sync plan mirror with the English translations already committed
d3ba150 docs(sp12): hand off the Files legacy-fix batch
```

工作树干净（`git status` 确认过）。

## 自我复核

- 有没有写任何"预期值"当"实测值"？没有——所有数字都来自实际命令的 stdout/stderr，Gate 2/5
  的两处失败输出逐字复制进了交接文档；Gate 6 的两次 tree OID 和 exit code 都是真实命令的
  输出。
- 有没有在本任务里改源码？没有。改的两个文件都是 `docs/**` 下的文档（一份是 Task 1/2/4
  遗漏提交的计划镜像同步，一份是本任务要求产出的交接文档），没有碰
  `src/**`/`oss/forbidden.mjs`/任何 `.vue`/`.ts` 实现文件。
- Gate 5 失败是否可能是本任务的"清理脏树"提交引入的？不是——两次失败命中的是
  `src/views/__tests__/filesLayoutHeightCap.test.ts` 的第 2、11 行，这个文件属于 Task 5
  提交 `70c24b0`，早于本任务的任何改动；我提交的 `8fbecf7` 只碰了
  `docs/superpowers/plans/2026-08-09-sp12-files-legacy-fixes.md` 一个文件。
- Gate 6 的"额外预演"是否算越权改动了任务范围？没有移动任何分支、没有合并、没有改动工作
  树——`merge-tree` 全程只读，临时 ref 用完即删，符合 brief"Gate 6 是只读预演"的约束；
  额外做的这次只是换了个仍然存在的目标（master）重跑同一个只读命令，因为原目标（分支
  `sp12-plan-b`）在执行期间已被清理，字面执行拿不到任何有用信息。

---

## 补记 —— 协调者通知修复后的复验（HEAD `3080275`）

协调者报告 Task 5 实现者已用提交 `3080275`（"reword layout-cap guard comments to drop
cross-area reference"）修掉 Gate 2/5 的红：只改了
`src/views/__tests__/filesLayoutHeightCap.test.ts` 头部注释的措辞，断言和 CSS 一字未动，
不再点名 "photos 区" 或该区文件名。协调者已自行复核了 Gate 2/3/5/6，本次补记只补跑了协调
者点名要我复核的 Gate 1 与 Gate 4，并把六个真实结果一并写回交接文档。

### Gate 1 复验（HEAD `3080275`）

命令：`pnpm exec vue-tsc --noEmit`
结果：**PASS** —— exit 0，零输出（用 `> file 2>&1; echo $?` 单独确认过 exit code，不是
管道污染的假值）。

### Gate 4 复验（HEAD `3080275`）

命令：`pnpm build`
结果：**PASS** —— exit 0，`✓ built in 16.80s`。唯一提示仍是预置的 >500kB chunk 体积告警
（与首次跑一致），不是错误，也不是本批次引入。

两项复验结果与协调者的判断一致："注释改动不该影响类型检查/构建"这次有了实测支撑，不再
是猜测。

### 交接文档更新

在 `docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md` 上做了四处更新，
提交 `0544335`（"docs(sp12): update the handoff to reflect the fixed gates"）：

1. 顶部警示条从"⚠️ 收尾门未全绿"改为"六道门现状：全绿"，摘要改述为"曾经红过、已被
   Task 5 修好"的时间线，而不是把失败当成仍未解决的悬案。
2. Gate 表（原「三」）整表换成 HEAD `3080275` 的六个真实结果：Gate 1（PASS，重新单独跑
   过）、Gate 2（`Test Files 659 passed (659)` / `Tests 10510 passed (10510)`，零失败）、
   Gate 3（不变，9/9）、Gate 4（PASS，重新单独跑过，16.80s）、Gate 5
   （`pnpm exec vitest run oss/` → `Test Files 6 passed (6)` / `Tests 141 passed (141)`）、
   Gate 6（对 master 的 merge-tree，exit 0，OID `c9338f2f608d21a8978b5e1531e75dc257bd53f4`）。
3. 把"Gate 2/5 失败根因"一节改写成"首次跑时的失败，及修复方式"，加入协调者给的教训——
   为什么这次是改写措辞而不是照抄先例加 `forbidden.mjs` 白名单：现存白名单条目命中的都是
   偶然的字面碰撞（用户路径、测试夹具文件名），而这两行注释是真的在跨区引用一个会被开源
   导出整个剥离掉的文件，对开源读者是悬空引用，白名单只会把这个真实缺陷盖住。落成一条
   可迁移的通用规律："守卫注释里指向一个会被剥离的区域就会触发泄漏守卫——这不是误报，
   是该被修的信号"。
4. Gate 6 说明段补上第二次预演（HEAD `3080275` 对 master）的 tree OID，与第一次
   （HEAD `8fbecf7` 对 master）的 OID 并列，说明两次都是"exit=0 + 无冲突"，OID 不同是
   因为分支内容变了，不代表结论变了。
5. 合并纪律一节按协调者要求加了第 4 点：`sp12-plan-b` 已先合入 master，"后合的一方"现在
   具体就是 `sp12-files-fixes` 自己——文档里六道门的绿是在**本分支自己的 HEAD**上跑出来
   的，不是在"合入 master 之后的结果树"上跑的，真正执行合并后仍必须在合并结果上重新跑
   一遍 Gate 1-5，不能拿"本分支绿 + master 绿"当作合并后自动绿的证据。

### 补记后的提交

```
3080275 fix(files): reword layout-cap guard comments to drop cross-area reference   (Task 5 实现者提交，非本任务产出)
0544335 docs(sp12): update the handoff to reflect the fixed gates
```

工作树干净（`git status` 确认过）。

### 补记自我复核

- 有没有把协调者报告的数字直接抄进文档而不核实？没有——Gate 1/4 是本任务实际重跑确认的；
  Gate 2/3/5/6 的数字取自协调者消息里给出的、协调者自称已复核过的输出，原样引用时标注了
  是协调者复核的结果，没有杜撰。
- 有没有在这次补记里碰源码？没有，只改了交接文档一个文件，`git status` 确认改动范围。
