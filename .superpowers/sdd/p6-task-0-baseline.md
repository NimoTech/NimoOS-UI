# SP8-P6 Task 0：基线取证报告

日期：2026-08-06
执行人：Task 0 子代理（本刀不改任何产品代码）

本报告是后续 P6 cutover 10 刀判断「是不是我弄坏的」的唯一依据。所有计数均为**本次实测**，与 brief/计划里记载的数字不一致处均已显式申报。

---

## Step 1：三仓 HEAD 与工作树状态

### NEW-UI — `/home/nimo/NimoTech/NimoOS-New-UI`
- 分支：`master`
- HEAD：`91337f1` — `docs(sp9): P8 验收轮 2 通过关账 —— SP9 收尾视图全区收官`
- 与本刀开工前记录的 BASE `91337f18` 一致。
- 工作树状态（`git status --short`）：
  ```
   D "design-export/Audio Speaker Segmentation.html"
   D design-export/audio-waveform-design-kit.html
   D design-export/design-final.html
  ```
  三个 design-export 文件是**已暂存的删除**（pre-existing，非本刀所为）。按记忆 `newui-test-gate-speedup-plan.md` / SP9 记录，这是已知的、会挡 merge 的 staged 删除，**本刀原样保留，未触碰**。

### SERVICE — `/home/nimo/NimoTech/NimoOS-Service`
- 分支：`master`
- HEAD：`2dcae71` — `chore(ledger): 台账入库规则同步到本仓 —— SP7-P0 那 15 份原本 git 救不回`
- 与 BASE `2dcae718` 一致。
- 工作树状态：干净（无输出）。

### VUE2 — `/home/nimo/NimoTech/NimoOS-UI`
- 分支：`docs/vue3-migration-sp3`
- HEAD：`79de66a` — `docs(sp8-p6): 实施计划 —— 11 刀 / 72 步`
- 与 BASE `79de66a3` 一致。
- 工作树状态：
  ```
  ?? FRONTEND_API_GUIDE.md
  ?? docs/vue3-pending/
  ```
  两个未跟踪项**归 T9 处置，本刀未触碰**。

**结论：三仓 HEAD 与工作树状态均与开工前记录的 BASE 一致，无漂移。**

---

## Step 2：冲突面复测（不采信 spec 记载的 15 / 2）

### NEW-UI: `git merge-tree --write-tree --name-only master sp8-ai`

完整原始输出（stdout + stderr 合并，因为 `merge-tree` 遇冲突退出码为 1，属预期行为非命令失败）：

```
46603f8e9f9302f04b72af66bb0963c86cb1e029
.superpowers/sdd/progress.md
docs/THEMING.md
package.json
pnpm-lock.yaml
src/components/AppToast.test.ts
src/components/AppToast.vue
src/i18n/en_us.ts
src/i18n/zh_cn.ts
src/router/index.test.ts
src/router/index.ts
src/stores/toast.test.ts
src/stores/toast.ts
src/viteOptimizeDepsGuard.test.ts
vite.config.ts

Auto-merging .superpowers/sdd/progress.md
CONFLICT (add/add): Merge conflict in .superpowers/sdd/progress.md
Auto-merging docs/THEMING.md
CONFLICT (content): Merge conflict in docs/THEMING.md
Auto-merging package.json
CONFLICT (content): Merge conflict in package.json
Auto-merging pnpm-lock.yaml
CONFLICT (content): Merge conflict in pnpm-lock.yaml
Auto-merging src/components/AppToast.test.ts
CONFLICT (content): Merge conflict in src/components/AppToast.test.ts
Auto-merging src/components/AppToast.vue
CONFLICT (content): Merge conflict in src/components/AppToast.vue
Auto-merging src/i18n/en_us.ts
CONFLICT (content): Merge conflict in src/i18n/en_us.ts
Auto-merging src/i18n/zh_cn.ts
CONFLICT (content): Merge conflict in src/i18n/zh_cn.ts
Auto-merging src/router/index.test.ts
CONFLICT (content): Merge conflict in src/router/index.test.ts
Auto-merging src/router/index.ts
CONFLICT (content): Merge conflict in src/router/index.ts
Auto-merging src/stores/toast.test.ts
CONFLICT (content): Merge conflict in src/stores/toast.test.ts
Auto-merging src/stores/toast.ts
CONFLICT (content): Merge conflict in src/stores/toast.ts
Auto-merging src/styles/theme.css
Auto-merging src/viteOptimizeDepsGuard.test.ts
CONFLICT (add/add): Merge conflict in src/viteOptimizeDepsGuard.test.ts
Auto-merging vite.config.ts
CONFLICT (content): Merge conflict in vite.config.ts
```

**名单清点（name-only 第二行起，逐行去除首行 tree OID 后）：共 14 个冲突文件**：
1. `.superpowers/sdd/progress.md`
2. `docs/THEMING.md`
3. `package.json`
4. `pnpm-lock.yaml`
5. `src/components/AppToast.test.ts`
6. `src/components/AppToast.vue`
7. `src/i18n/en_us.ts`
8. `src/i18n/zh_cn.ts`
9. `src/router/index.test.ts`
10. `src/router/index.ts`
11. `src/stores/toast.test.ts`
12. `src/stores/toast.ts`
13. `src/viteOptimizeDepsGuard.test.ts`
14. `vite.config.ts`

（`src/styles/theme.css` 出现 "Auto-merging" 但无 CONFLICT，是干净自动合并，不计入冲突清单，也确实不在 name-only 列表中。）

🔴 **申报差异：spec/计划记载 NEW-UI 冲突面为 15 个，本次实测为 14 个。以实测 14 为准。**

### SERVICE: `git merge-tree --write-tree --name-only master sp8-ai`

完整原始输出：

```
2cd52d9e23a1f9d9ac03f504806283ca2b87a3c4
src/disks.test.ts
src/index.ts

Auto-merging src/disks.test.ts
CONFLICT (content): Merge conflict in src/disks.test.ts
Auto-merging src/disks.ts
Auto-merging src/index.ts
CONFLICT (content): Merge conflict in src/index.ts
```

**名单清点：共 2 个冲突文件**：
1. `src/disks.test.ts`
2. `src/index.ts`

（`src/disks.ts` 干净自动合并，无冲突。）

**结论：SERVICE 冲突面实测 2，与 spec 记载一致，无需申报差异。**

---

## Step 3：三仓全量测试基线

### SERVICE — `pnpm exec vitest run`（尾部原文）

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-Service


 Test Files  33 passed (33)
      Tests  267 passed (267)
   Start at  11:07:53
   Duration  1.24s (transform 785ms, setup 0ms, import 1.43s, tests 266ms, environment 3ms)
```

**SERVICE 基线：33 文件 / 267 用例，零失败。**

### NEW-UI — `pnpm exec vitest run`（尾部原文）

```
+   "packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/task-3-report.md",
+   "packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/task-5-report.md",
+ ]

 ❯ oss/tree.test.mjs:673:18
    671|     } }
    672|     walk(tree)
    673|     expect(hits).toEqual([])
       |                  ^
    674|   })
    675| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed | 475 passed (476)
      Tests  2 failed | 6249 passed (6251)
   Start at  11:08:02
   Duration  109.65s (transform 22.90s, setup 76.29s, import 99.63s, tests 120.29s, environment 174.42s)
```

**既有失败详情（重跑 `oss/tree.test.mjs` 单文件取得的完整上下文）：**

失败文件：`oss/tree.test.mjs`（1 个文件，2 个用例失败，另外 63 个用例通过）

用例 1：`泄漏守卫 > ...`（第一个失败，见下方泄漏守卫命中日志）—— 泄漏守卫扫到 437 处命中，报错信息：
```
[oss] 失败:泄漏守卫命中 437 处,一个字节都不落盘。修法只有两条:真泄漏就补剥离清单;误报就往 forbidden.mjs 加精确白名单 —— 禁止放宽词表。
```

用例 2：`泄漏守卫 > 手工抽查:产出树里一律扫不到相册/Nimo AI/transcript/qdrant/内网 IP（独立于 forbidden.mjs 词表的第二重验证）`
```
AssertionError: expected [ …(4) ] to deeply equal []
- []
+ [
+   "packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/README.md",
+   "packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/task-3-brief.md",
+   "packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/task-3-report.md",
+   "packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/task-5-report.md",
+ ]
```
根因是台账文件 `packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/*` 内含「相册/photo」相关中文词汇，被 OSS 导出泄漏扫描器的第二重人工抽查命中。

🔴 **申报：brief 只警示 Vue2 侧有既有失败，未提及 NEW-UI 侧。但本次实测 NEW-UI 侧 `master` 分支本身也有 1 个既有失败文件（`oss/tree.test.mjs`，2 个用例）。这不是本刀引入的，是 master 当前 HEAD 自带的既有状态 —— 已如实记录为基线，后续刀比对时同样按「零新增」处理，不得算作新增失败，也不算作已修复。**

**NEW-UI 基线：476 文件（1 失败 / 475 通过）/ 6251 用例（2 失败 / 6249 通过）。**

### VUE2 — `pnpm exec vitest run`（尾部原文）

```
     × loadServicesStatus sets false on error 3ms
stdout | tests/nimoTaskBar.test.js
Download the Vue Devtools extension for a better development experience:
https://github.com/vuejs/vue-devtools
You are running Vue in development mode.
Make sure to turn on production mode when deploying for production.
See more tips at https://vuejs.org/guide/deployment.html

 ❯ tests/nimoTaskBar.test.js (13 tests | 5 failed) 50ms
     × 有任务时收起态显示小图标 + 「X 个后台任务」文字,不显示总百分比/任何明细/进度条 10ms
     × 任务数文字反映当前任务条数 3ms
     × 展开后才出现按类型明细与进度条 5ms
     × 不同类型各渲染一条独立进度,标签正确 4ms
     × 某类型有错误时该类型标记失败,并显示错误详情 3ms

 Test Files  2 failed | 156 passed (158)
      Tests  8 failed | 1471 passed (1479)
   Start at  11:10:50
   Duration  21.79s (transform 8.16s, setup 19.68s, import 13.66s, tests 6.79s, environment 44.66s)
```

**既有失败文件逐条列表（共 2 个文件 / 8 个用例）：**

1. `tests/nimoTaskBar.test.js`（5 个用例失败，均为中英文案不一致 —— 期望中文，实际渲染英文）：
   - `NimoTaskBar 收起态 > 有任务时收起态显示小图标 + 「X 个后台任务」文字,不显示总百分比/任何明细/进度条` — 期望 `1 个后台任务`，实际 `1 background tasks`
   - `NimoTaskBar 收起态 > 任务数文字反映当前任务条数` — 期望 `2 个后台任务`，实际 `2 background tasks`
   - `NimoTaskBar 展开态:按类型分开显示 > 展开后才出现按类型明细与进度条` — 期望包含 `索引照片`，实际是 `Indexing photos`
   - `NimoTaskBar 展开态:按类型分开显示 > 不同类型各渲染一条独立进度,标签正确` — 期望包含 `索引照片`，实际是英文类型名
   - `NimoTaskBar 展开态:按类型分开显示 > 某类型有错误时该类型标记失败,并显示错误详情` — 期望包含 `生成 AI 索引`，实际 `Generating AI index`

2. `tests/settingsStore.test.js`（3 个用例失败，均为 `servicesStatus` 多出一个 `openvino` 键，期望值里没有）：
   - `createSettingsStore - factory + initial state > initial state has expected shape` — 期望 `{ ollama: null, agent: null }`，实际多了 `openvino: null`
   - `createSettingsStore - policy + services actions > loadServicesStatus normalizes nested .running into booleans` — 期望 `{ ollama: true, agent: false }`，实际多了 `openvino: false`
   - `createSettingsStore - policy + services actions > loadServicesStatus sets false on error` — 期望 `{ ollama: false, agent: false }`，实际多了 `openvino: false`

**VUE2 基线：158 文件（2 失败 / 156 通过）/ 1479 用例（8 失败 / 1471 通过）。**

🔵 **申报：brief 提示 SP6-P6 时期 Vue2 既有失败数为 8（来自 `nimoTaskBar`/`settingsStore`）。本次实测同样是 8 个用例、同样两个文件，数字与历史记录一致，未发生漂移——但按 brief 要求，本结论是**实测得出**，不是照抄历史数字。**

---

## Step 4：四个关键计数

```
master 台账跟踪数: 514
sp8-ai 台账跟踪数: 776
src/ai 文件数: 276
sp8 zh 全表 1726 | ai* 前缀 1206
```

逐项对应取数命令：
- `cd /home/nimo/NimoTech/NimoOS-New-UI && git ls-files .superpowers | wc -l` → **514**
- `cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI && git ls-files .superpowers | wc -l` → **776**
- `cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI && find src/ai -type f | wc -l` → **276**
- `node -e "..."` 对 `.sp8/NimoOS-New-UI/src/i18n/zh_cn.ts` 顶层键（`^\s{2}[A-Za-z0-9_]+:` 正则匹配）计数 → **全表 1726 个键，其中 `ai*` 前缀 1206 个**

补充记录（非 brief 要求，供交叉核对用）：`.sp8/NimoOS-New-UI` worktree 当前分支 `sp8-ai`，HEAD `b5db2cf`（`docs(p5f): 验收清单 + 下一期交接单（SP8-P5 六批收官）`），工作树 `git status --short` 仅显示与本刀无关的既有状态（未额外改动）。`sp8-ai` 分支在 NEW-UI 主仓与 SERVICE 主仓中的 HEAD 分别为 `b5db2cf`（NEW-UI）与 `15c2eba`（SERVICE，`docs(wiki): 终审 Minor —— 蓝本行号引用订正 89-92 → 93-96`）。

---

## 汇总：四个关键计数 + 三仓测试基线速览

| 项目 | 数值 |
|---|---|
| NEW-UI master 台账跟踪数 | 514 |
| sp8-ai 台账跟踪数 | 776 |
| src/ai 文件数（sp8-ai worktree） | 276 |
| sp8 zh_cn.ts 全表键数 / ai* 前缀键数 | 1726 / 1206 |
| SERVICE 测试基线 | 33 文件 / 267 用例，零失败 |
| NEW-UI 测试基线 | 476 文件（1 失败）/ 6251 用例（2 失败，`oss/tree.test.mjs`） |
| VUE2 测试基线 | 158 文件（2 失败）/ 1479 用例（8 失败，`tests/nimoTaskBar.test.js` + `tests/settingsStore.test.js`） |
| NEW-UI 冲突面（master vs sp8-ai） | 14 个文件（spec 记 15，申报差异，以 14 为准） |
| SERVICE 冲突面（master vs sp8-ai） | 2 个文件（与 spec 一致） |

---

## 后续刀比对规则（供 T1-T10 使用）

1. **VUE2**：`tests/nimoTaskBar.test.js`（5 用例）+ `tests/settingsStore.test.js`（3 用例）为既有失败，允许继续存在，**零新增**即可（按测试文件名 + 用例名比对，不按数字）。
2. **NEW-UI**：`oss/tree.test.mjs`（2 用例，泄漏守卫 + 手工抽查）为既有失败，**同样零新增**即可。若后续刀顺带修复了这个既有失败（比如把 SP7 photos 台账文件里的敏感词剥离），应在对应刀的报告里显式声明「修复了 Task 0 基线记录的既有失败」，不能悄悄改变基线而不说明。
3. **SERVICE**：基线零失败，因此 SERVICE 侧任何新失败都是新增，直接判定为回归。
4. 冲突面数字（14 / 2）仅用于后续合流刀预估工作量，实际合并时以当时重新跑 `merge-tree` 的结果为准（缓存分支可能已推进）。
