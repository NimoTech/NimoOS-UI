# SP13 — 共享包内联 New-UI · 设计

> 2026-08-07 · 由 SP10-T3 机主拍板派生（决策原文见 `NimoOS-UI/docs/vue3-migration-roadmap.md` §4 SP10 的 T3 条目）。
> 与 SP11 / SP12 无依赖，可任意穿插。

## 1. 目标与明确不做的事

**目标**：New-UI 只依赖自己仓库里那一份 service 源码，不再伸手去 `../NimoOS-Service`。
Vue2（`NimoOS-UI`）继续吃独立仓那一份，两侧从此各自演进、不再共用源码。

**明确不做**：

- 不改任何界面或行为 —— 本期**零 UI 变更**
- 不改 Vue2 一个字符（文档除外，见 §5）
- 不删 `NimoOS-Service` 仓
- 不动 Gateway / 部署路径 / `/app/` 基址

## 2. 现状（2026-08-07 实测，非记忆）

| 事实 | 数字 |
|---|---|
| New-UI 里 `import … from '@nimotech/nimoos-service'` | **457 个文件 / 578 处** |
| `NimoOS-Service` 源文件 | 69 个（含 37 个测试文件） |
| Service 测试规模与耗时 | **377 例 / 1.32 秒**（`environment: 'node'`） |
| New-UI 现有测试 | 9866 例 |
| oss 清单条目 | `DELETE` 71 · `SERVICE_DELETE` 19 · `PATCH` 252 · `SERVICE_PATCH` 21 · `REPLACE` 4 |
| New-UI 有无 `pnpm-workspace.yaml` | **无** |
| Service 仓 HEAD | `ac39cd7` |

**关键前置事实：公开产物树本来就是内联形态。** `oss/export.mjs` 把 Service 仓 `git archive`
到 `packages/service/`，把依赖改成 `file:packages/service`，并用 `SERVICE_PATCH` 第 1 条把包入口
从 `./dist/index.js` 改指 `./src/index.ts`。也就是说本期要落地的形态，导出流水线已经在临时目录里
**每次跑测试都演练一遍**，且 `tree.test.mjs:707-721` 在那棵树上真跑 `pnpm install` + `vue-tsc --noEmit`
并长期全绿。**所以「入口指 TS 源码」不是推演，是已被证明的形态。**

## 3. 落地形态（三条已拍板的决策）

| 决策点 | 选择 | 理由 |
|---|---|---|
| 代码放哪、import 怎么写 | **`packages/service/`，import 说明符不变** | 578 处 import 一个字不用改；与公开产物树同形，导出流水线因此是**收敛**不是复杂化 |
| 包怎么被解析 | **`file:packages/service` + 入口指 TS 源码** | 彻底消掉「改完包要 `pnpm build` 才生效、dev server 还喂旧预打包缓存」那条反复踩的漂移链路（仅 New-UI 侧） |
| 带不带 git 历史 | **不带，一次性复制** | 历史没丢 —— Service 仓继续为 Vue2 存在，旧提交去那边查；New-UI 的 log 也不会被凭空混入几百条别仓提交。两侧已拍板「各自演进」，subtree 的 pull/push 能力用不上 |

### 3.1 搬什么、不搬什么

**搬**：`NimoOS-Service` 当前 HEAD (`ac39cd7`) 的 69 个源文件（含 37 个测试文件）+ `.superpowers`
台账目录（2026-08-05 起台账入库是既定纪律；开源侧本来就有 `SERVICE_DELETE` 的 `.superpowers`
条目负责剥掉，见 SP8-P6-T8 那次真泄漏的教训）。

**不搬**：

- `dist/` —— 本就 gitignore，且新形态不需要构建产物
- `node_modules/`
- **包自己那份 `pnpm-lock.yaml`** —— 它只锁 axios / typescript / vitest 三个依赖，全都已在
  New-UI 根 `package.json` 里；留着会变成第二份互相打架的锁文件

> **一处澄清**（brainstorm 过程中先说错、后查实纠正，记在此防止后人重走）：
> 起初以为嵌套 lockfile 消失会打红 `oss/forbidden.test.mjs:361` 那条循环。**不会。**
> `forbidden.mjs:264` 的规则是 `/(^|\/)pnpm-lock\.yaml$/`，通配任何层级；而那条测试用的是
> `scanText(路径, 内容)` —— 路径只用来选规则，文件不需要真实存在。**该测试不用改。**

### 3.2 装配的五处接缝

| 处 | 改法 |
|---|---|
| `package.json` | 依赖 `file:../NimoOS-Service` → `file:packages/service`（1 行） |
| `packages/service/package.json` | `main`/`module`/`types`/`exports` 从 `./dist/index.js` 改指 `./src/index.ts`，`files: ["dist"]` → `["src"]`。**与产物树 `SERVICE_PATCH` 第 1 条一字不差** —— 等于把那条补丁「上游化」 |
| `vite.config.ts` | 删 `optimizeDeps.exclude: ['@nimotech/nimoos-service']`。那段 20 行的坑注释**改写成历史说明保留**，别连知识一起删掉。`include: ['axios']` 是为配合 exclude 才加的，exclude 没了之后**实测再决定删不删** |
| `vitest`（在 `vite.config.ts` 的 `test` 段） | 删 `server.deps.inline: ['@nimotech/nimoos-service']` |
| `tsconfig.json` | **不动 `include`**。包源码会因为被 import 而自动进类型检查程序；加进 `include` 反而会把包内 37 个测试文件也拉进 `vue-tsc`（Service 自己的 tsconfig 是特意 `exclude` 掉测试的）。不加 = 与产物树同形 |

另补 `.gitignore` 一条 `packages/service/dist` —— 新形态虽不需要构建，那儿仍能跑出 dist，别让它进 git。

### 3.3 测试并入的两个具体风险

这两条是本期探测新发现的，**不在路线图 T2 的接缝清单里**：

1. **测试环境不一致** —— Service 自己的 `vitest.config.ts` 是 `environment: 'node'`；New-UI 是
   全局 `jsdom`。并入后这 377 例会改在 jsdom 下跑。
2. **`Blob` 被全局替换** —— New-UI 的 `vitest.setup.ts` 为了 fake-indexeddb 的 `structuredClone`
   把 `globalThis.Blob` 换成了 Node 的 Blob，而 jsdom 的 `File` 仍是 jsdom 的。
   `sys.test.ts` / `photos.uploads.test.ts` / `ai.test.ts` 三个文件用到 Blob/File/FormData ——
   **这是最可能变红的地方。**

**处置**：先并入直接跑，红了就在出问题的**文件头**加一行 `// @vitest-environment node` 逐文件回落。
**不改 New-UI 的全局 vitest 配置** —— 侵入最小，且不波及另外 9866 例。

## 4. 导出流水线改动（保留 `SERVICE_*` 分组，只换基准目录）

内联后 `export.mjs` 会**必然断裂**，不是可选项：`archiveInto(SERVICE, svcDir)` 变成重复取源，
而 `file:../NimoOS-Service` 这个锚点直接消失，会撞上它自己的 `throw new Error('锚点未唯一命中')`。

**方案选择**：保留 `SERVICE_DELETE` / `SERVICE_PATCH` 两张表的分组，只把它们作用的基准目录从
「另一棵 archive 出来的树」换成「同一棵树的子目录」。
（否决的替代方案：把 40 条路径全加 `packages/service/` 前缀并进主 `DELETE`/`PATCH`。少一个概念，
但要手工改 40 条路径、任一条打错都是静默漏删；且会让 `tree.test.mjs` 里「两处台账由两条**不同**
清单条目负责、漏哪条都可能」那条守卫用例的立论失效 —— 那条是 SP8-P6-T8 真泄漏之后才补的。）

### 4.1 `oss/export.mjs` 六处

1. 删 `archiveInto(SERVICE, svcDir)`（第 89 行）—— New-UI 自己的 archive 已带出 `packages/service/`
2. `svcDir` 改为 `path.join(tmp, 'packages/service')`（同树子目录），`applyDelete` / `applyPatch` 调用形状不变
3. 删「4. 内嵌共享包」整段（第 99–113 行）：`file:` 一行重写 + lockfile 两处 `replaceAll` + 两个 `throw`
4. 删 `checkClean(SERVICE, [])` 与 `headService`（第 52–55 行），启动日志那句 `New-UI xxx · Service xxx` 去掉后半
5. `.export-report.txt` 去掉 `NimoOS-Service HEAD:` 那行
6. `manifest.mjs` 删 `SERVICE` 常量导出

**保留**：第 4.5 段「重算 lockfile」原样不动 —— 它解决的是「清单摘掉 package.json 依赖后 lockfile
与之自相矛盾」，与内联无关。

### 4.2 `oss/manifest.mjs` 只删一条

`SERVICE_PATCH` 第 1 条（把入口从 `./dist/index.js` 改指 `./src/index.ts` 那条）。
内联后私有侧本身就指 src，这条补丁的 `find` 锚点必然失配、报「锚点未命中」。
**其余 19 + 20 条一字不动**，含那些记录血泪教训的长注释。

### 4.3 连带要动的 oss 测试

- `tree.test.mjs:108`「lockfile 里不再有 `../NimoOS-Service` 路径」会退化成恒真（没有任何路径能
  再产生它）。改成正向断言 `toContain('file:packages/service')` 才有守卫价值。
- 其余内嵌共享包断言（`tree.test.mjs:101-106`、`237-244`）、README 断言（`508-528`）**全部原样有效**。

## 5. Vue2 侧与 Service 仓：零代码改动，但必须改两处文档

Vue2（`NimoOS-UI`）与 `NimoOS-Service` 仓本期**一行代码都不改**。

但内联最容易出的事故不是代码，是**记忆**：以后有人改了 `NimoOS-Service`、`pnpm build`、
然后等 New-UI 生效 —— **静默无效，且三道门全绿**。所以本期必须同时改两处文档：

- **`NimoOS-New-UI/CLAUDE.md` 的「共享 service 包（已知漂移坑）」整节** —— 它现在白纸黑字写着
  「改动该包后必须 `cd ../NimoOS-Service && pnpm build`」。内联后这句话变成**错误指引**，
  必须重写成「包在仓内 `packages/service/`，改完存盘即生效，无构建步骤」。
- **`NimoOS-Service` 仓的 README（或其 CLAUDE.md）顶部加一句**：本包现在只服务 Vue2（`NimoOS-UI`）；
  New-UI 已内联自己那份于 `NimoOS-New-UI/packages/service/`，改这里不会影响 New-UI。

## 6. 验收门（成功标准）

| 门 | 判据 |
|---|---|
| New-UI 测试 | `pnpm test` 全绿，例数 9866 → **约 10243**（+377）。**例数要对上** —— 少了就是有测试文件没被发现 |
| 类型 | `pnpm exec vue-tsc --noEmit` 0 错 |
| 构建 | `pnpm build` ✓ |
| 开源面 | `pnpm exec vitest run oss/` 全绿（内含产物树真跑 `pnpm install` + `vue-tsc`） |
| Vue2 零影响 | `cd ../NimoOS-UI && pnpm build` 仍通过 |
| **漂移根治的正向取证** | ~~改 `packages/service/` 里一个方法 → **不做任何构建** → dev 页面立刻拿到新行为~~(原判据，2026-08-07 实测证伪，见下)→ ~~改 `packages/service/` 里一个方法 → **重启 dev server**(不用 `pnpm build`、不用清 `.vite` 缓存、不用 `pnpm install`)→ dev 页面拿到新行为~~(第二版判据，2026-08-07 Task 4 真机复测再证伪一层，见下)→ 改 `packages/service/` 里一个方法 → **重启 dev server** → **硬刷新浏览器**(`Ctrl-Shift-R`，不用 `pnpm build`、不用清 `.vite` 缓存、不用 `pnpm install`)→ dev 页面拿到新行为 |

最后一条是本期的**核心收益，必须单独取证**。只看测试绿不够：测试一直走源码、本来就绿；
这条坑从来只在 dev server 上现形。同理见 SP10-T4 的判据修正 —— 主判据必须落在**生效载体**上，
不能靠一个「无论如何都成立」的间接指标。

**2026-08-07 判据修订(机主拍板)**:原判据"不做任何构建 → dev 页面立刻拿到新行为"里的
"立刻"经两轮独立实测(Task 3 修复轮 + 控制器复现)**证伪** —— Vite 的文件 watcher 默认忽略
`node_modules/**`,而这个包正是经 `node_modules/.pnpm/@nimotech+nimoos-service@.../src/*.ts`
路径服出去的,dev server 进程存活期间不会自动感知源码变化,**存盘即热更新做不到**。
`optimizeDeps.exclude` 曾在 Task 3 中被误判为"入口指源码后不再需要"而删除,复测发现删了之后
即使反复重启也拿不到新代码(预打包缓存的失效判据是 lockfile/版本号、不看内容),已恢复。
**改后的正向判据**:改包源码 → **重启一次 dev server**(`Ctrl-C` 再 `pnpm dev`,不需要
`--force`、不需要清 `.vite`、不需要 `pnpm install`)→ dev 页面拿到新行为。这仍然是本期要保住
的核心收益 —— 对比 SP13 之前"即使反复重启也拿不到新代码,只能 `--force` 或手动删缓存硬破"的
状态,是实质性的改善,只是没有做到"存盘即生效"这么强。详见
`.superpowers/sdd/2026-08-07-vue3-migration-sp13-service-inline/task-3-report.md` 的两轮修复记录。

**2026-08-07 判据第三次修订(Task 4 真机取证 + 控制器复核)**:上一版判据"改源码 → 重启
dev server → 拿到新行为"本身没错(用 curl 验证过),但 Task 4 用无头 chromium + CDP 在**真
浏览器**里复测时发现它不完整 —— curl 没有浏览器磁盘缓存这一层,而真浏览器有。实测:该包
模块 URL 带 `?v=<hash>` 查询串,响应头 `Cache-Control: max-age=31536000, immutable`;
控制器独立复核确认这个 hash 取自 **lockfile / config**(前后两次观察到 `?v=262bd7ea` →
`?v=4539fc70`,变化恰好发生在 Task 3 修复轮改了 `vite.config.ts` 注释 + 跑了 `pnpm install`
之后),**不随 `packages/service/src/*.ts` 的内容变**。于是:只改包源码、重启 dev server,
`?v=` 不变、`immutable` 缓存依旧有效,**已经加载过该页的标签页做普通 F5 拿不到新代码**,
必须硬刷新(`Ctrl-Shift-R`)或 DevTools 勾 "Disable cache" 才能绕开缓存拿到最新代码。
Task 4 做过 A/B 隔离:重启**前**硬刷新 → 看不到新代码(证明"重启"这一步本身确有必要,
不是缓存在演戏);重启**后**硬刷新 → 立刻看到。**最终判据**(即上表这一行现在写的版本):
改包源码 → 重启 dev server → **硬刷新浏览器** → 拿到新行为。已同步写入
`CLAUDE.md`「共享 service 包」节的第三条警告(与"重启才生效""硬链接陷阱"并列)。

## 7. 风险与回退

- **最可能变红**：并入的 377 例在 jsdom + 全局 Blob 替换下跑（§3.3）。处置见该节。
- **次可能**：`vue-tsc` 把包源码纳入检查后，冒出以前被 `dist` 遮住的类型错误。产物树长期全绿是
  强证据，但**不是私有仓的直接证据** —— 所以第一个任务就是先探这一条，探完再动手。
- **回退**：本期无后端改动、无数据迁移、无部署面变化，`git revert` 那一两条 commit 即可完全复原。
  **⚠️ 回退集写死如下,跳过 `089ee6c`**：`c83206e`、`9a4ce20`、`4e6d458`、`690b80a`、`95a2083`
  (从新到旧,逐条 `git revert`)。`089ee6c` 夹在 `690b80a`(Task 3 完成)与后续 Task 之间，
  但它**不属于 SP13**——是 SP10 遗留在工作树里的未提交改动（README + oss `privateSha256`
  配套改动），由控制器代提交以解开 `export.mjs` 的洁净检查；范围 revert(`git revert
  95a2083..c83206e` 这类写法)会把它一并卷走，回退后须再 `pnpm install` 确认锁文件与
  `package.json` 一致。
- **一次性的分叉**：本期结束后两侧 service 源码正式分叉。SP12 补迁 7-15 后功能时，若 Vue2 侧的包
  有新方法，New-UI 侧要自己再写一份 —— 这是**已拍板接受的代价**，不是新增风险。

## 8. 任务切分（供 writing-plans 展开）

1. **T0 先探** —— 在 scratchpad 里的一份仓库副本上（**不动真仓一个字节**）验证两件事：
   「入口指 TS 源码」在私有仓的 tsconfig 下能否过 `vue-tsc`；377 例在 jsdom + 全局 Blob 替换下
   哪些会红。探完再动手（§7 第二条）。
2. **T1 搬源码** —— 复制 69 个源文件 + 台账到 `packages/service/`，一条 commit 写明来源 `ac39cd7`。
3. **T2 接五处缝** —— §3.2 那张表 + `.gitignore`。
4. **T3 修测试并入的红** —— 逐文件 `// @vitest-environment node`，不动全局配置。
5. **T4 改导出流水线** —— §4 的 6 + 1 + 1 处。
6. **T5 改两处文档** —— §5。
7. **T6 过全部验收门 + 漂移根治正向取证** —— §6。
