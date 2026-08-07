# SP13 共享包内联 New-UI · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `@nimotech/nimoos-service` 的源码搬进 `NimoOS-New-UI/packages/service/`，让 New-UI 只依赖仓内那一份；Vue2（`NimoOS-UI`）继续吃独立仓 `NimoOS-Service`，两侧从此各自演进。

**Architecture:** 包身份保留（import 说明符 `@nimotech/nimoos-service` 一个字不改，涉及 457 个文件 / 578 处），只把 `package.json` 的依赖从 `file:../NimoOS-Service` 改成 `file:packages/service`，并把包入口从 `./dist/index.js` 改指 `./src/index.ts`。入口指 TS 源码之后，「改完包要 `pnpm build`、dev server 还喂旧预打包缓存」那条漂移链路对 New-UI 侧彻底消失，`optimizeDeps.exclude` 与 `vitest server.deps.inline` 两处补丁随之删除。开源导出流水线（`oss/`）从「archive 两个仓」改成「archive 一个仓 + 在同树子目录上应用 `SERVICE_*` 清单」。

**Tech Stack:** pnpm 9 · Vite 7 · Vitest 4 · vue-tsc 2 · TypeScript 5（`moduleResolution: Bundler`）· Node `git archive`

**Spec:** `docs/superpowers/specs/2026-08-07-vue3-migration-sp13-service-inline-design.md`

## Global Constraints

- **包管理器只用 pnpm**，禁 yarn / npm。
- **本期零 UI 变更**：不改 `src/**` 下任何界面或行为代码。唯一允许碰 `src/` 的情形是 Task 4 的临时取证，且必须当场还原。
- **本工作树永远不要 `git checkout` / `git stash`** —— index 里长期躺着 3 个 `design-export/*` 的删除态，会被卷走。
- **每次 `git commit` 必须带 pathspec**（`git commit -- <路径…>`），理由同上。
- **另有一条会话正在改这个工作树**（本计划编写时 `README.md` 与 `oss/manifest.mjs` 有非本期的未提交改动）。提交前 `git status` 看一眼，**只提交自己动的文件**。Task 5 动 `oss/`，若那时 `oss/manifest.mjs` 仍是脏的，先停下来问机主。
- **测试例数基线现场测，不许写死。** 另一条会话在推进本仓，历史记录里的 9866 已不可信。
- **颜色 token 硬约束**（`CLAUDE.md`）：本期不写任何 CSS，不适用，但别顺手违反。
- **Vue2 仓 `NimoOS-UI` 本期零代码改动。**

---

## 前置事实（都是 2026-08-07 实测，不要凭记忆推翻）

| 事实 | 值 |
|---|---|
| `NimoOS-Service` HEAD | `ac39cd7` |
| Service 仓 git 跟踪文件 | 106 个（69 个 `src/` 源文件含 37 个测试 · 32 个 `.superpowers/` 台账 · `package.json` · `tsconfig.json` · `vitest.config.ts` · `pnpm-lock.yaml` · `.gitignore`） |
| Service 测试 | 377 例 / 1.32 秒 / `environment: 'node'` |
| New-UI 里 import 该包 | 457 文件 / 578 处 |
| New-UI 有无 `pnpm-workspace.yaml` | **无**（本期也不新建） |

**spec 的三处订正**（写计划时查实，以本计划为准）：

1. spec §3.2 末尾说要补 `.gitignore` 一条 `packages/service/dist` —— **不用**。New-UI 的 `.gitignore` 第 2 行就是裸 `dist`，gitignore 的裸名规则匹配任意层级，已覆盖。
2. spec §5 说给 `NimoOS-Service` 的「README（或其 CLAUDE.md）顶部加一句」—— 该仓**两个文件都不存在**，是**新建**，不是编辑。
3. spec §6 写「例数 9866 → 约 10243」—— 基线必须现场测（见 Global Constraints）。

---

## File Structure

**新增（Task 2）**

- `packages/service/` —— 整个包，从 `NimoOS-Service` `git archive HEAD` 取源。职责：New-UI 唯一的 HTTP / 认证 / 后端域封装层。
  - 保留其 `tsconfig.json` 与 `vitest.config.ts`：从根跑 `vue-tsc` / `vitest` 时**两者都不生效**（TS 与 Vitest 都只认根配置，无 workspace / projects 声明），但它们是公开产物树里长期存在的形态，删掉等于凭空偏离一个已被证明的基准。它们的"惰性"写进 `CLAUDE.md`（Task 3）。
  - **不带** `pnpm-lock.yaml`（只锁 axios / typescript / vitest，全在 New-UI 根里，留着是第二份会打架的锁文件）。
  - **不带** `dist/` `node_modules/`（Service 的 `.gitignore` 里，`git archive` 天然拿不到）。

**修改**

| 文件 | 改什么 | 任务 |
|---|---|---|
| `packages/service/package.json` | 入口 `dist` → `src`，`files` 同改 | 3 |
| `package.json:29` | `file:../NimoOS-Service` → `file:packages/service` | 3 |
| `vite.config.ts:46-49` | 删 `optimizeDeps.exclude`，坑注释改写成历史说明 | 3 |
| `vite.config.ts:75-79` | 删 `server.deps.inline` | 3 |
| `CLAUDE.md:28-32` | 「共享 service 包（已知漂移坑）」整节重写 | 3 |
| `../NimoOS-Service/CLAUDE.md` | **新建**：本包只服务 Vue2 | 3 |
| `oss/export.mjs` | 6 处（见 Task 5） | 5 |
| `oss/manifest.mjs` | 删 `SERVICE` 常量 + `SERVICE_PATCH` 第 1 条 | 5 |
| `oss/tree.test.mjs:108-110` | 恒真断言改正向 | 5 |
| `../NimoOS-UI/docs/vue3-migration-roadmap.md` | SP13 勾项 + 状态 | 6 |

**不动**：`tsconfig.json`（`include` 保持 `["src", "src/**/*.vue"]`）· `.gitignore` · `vitest.setup.ts` · `src/**` · Vue2 任何代码。

---

## Task 1: T0 探测 —— 先证实两个未知，再动真仓

**Files:**
- Create（全部在 scratchpad，**真仓一个字节都不动、不提交**）:
  - `/tmp/claude-1000/-home-nimo-NimoTech/4167204c-4a83-445b-a850-45aba33951e0/scratchpad/sp13-spike/`
  - 结论记到 `…/scratchpad/sp13-spike/FINDINGS.md`

**Interfaces:**
- Consumes: 无
- Produces: 两个结论，Task 2 / Task 3 直接照用 ——
  ① `TYPECHECK_OK: true|false` + 若 false，`vue-tsc` 报的**每一条**错误原文
  ② `JSDOM_RED_FILES: string[]` —— 在 jsdom + 全局 Blob 替换下会红的**具体测试文件名**清单

**为什么必须先探：** 「入口指 TS 源码能过 `vue-tsc`」目前的证据来自公开产物树（`oss/tree.test.mjs:707-721` 真跑 `pnpm install` + `vue-tsc --noEmit` 且长期全绿），但那棵树**剥掉了 photos / search / ai / notes / sse / wiki 六个域**。私有仓要跑的是**全量**源码，不是同一件事。

- [ ] **Step 1: 搭 spike 目录（两个仓各 archive 一份）**

```bash
SPIKE=/tmp/claude-1000/-home-nimo-NimoTech/4167204c-4a83-445b-a850-45aba33951e0/scratchpad/sp13-spike
rm -rf "$SPIKE" && mkdir -p "$SPIKE/packages/service"
git -C /home/nimo/NimoTech/NimoOS-New-UI archive HEAD | tar -x -C "$SPIKE"
git -C /home/nimo/NimoTech/NimoOS-Service archive HEAD | tar -x -C "$SPIKE/packages/service"
rm -f "$SPIKE/packages/service/pnpm-lock.yaml"
ls "$SPIKE/packages/service/src" | wc -l   # 期望 69
```

- [ ] **Step 2: 在 spike 里打上三处接缝**

包入口（`$SPIKE/packages/service/package.json`）—— 把这四行

```json
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],
```

换成

```json
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "types": "./src/index.ts", "import": "./src/index.ts" } },
  "files": ["src"],
```

根依赖（`$SPIKE/package.json`）：`"@nimotech/nimoos-service": "file:../NimoOS-Service"` → `"@nimotech/nimoos-service": "file:packages/service"`

根 `$SPIKE/vite.config.ts`：删掉 `optimizeDeps` 整块（46-49 行）与 `server: { deps: { inline: [...] } }` 整块（75-79 行）。

- [ ] **Step 3: 装依赖**

```bash
cd "$SPIKE" && pnpm install --prefer-offline --ignore-scripts --no-frozen-lockfile 2>&1 | tail -5
```

期望：成功。`--prefer-offline` 走本机 pnpm store，不联网也应能装上（`oss/tree.test.mjs` 每次跑测试都这么装产物树）。

- [ ] **Step 4: 探问题①——全量源码能否过 vue-tsc**

```bash
cd "$SPIKE" && pnpm exec vue-tsc --noEmit 2>&1 | tail -30
```

把结果（0 错 / 或每一条错误原文）记进 `FINDINGS.md` 的 `TYPECHECK_OK`。
**若有错：不要在 spike 里修**——记下来，判断是「包源码本来就有的类型问题」还是「Bundler 解析 `./xxx.js` 说明符失败」，交 Task 3 处理。

- [ ] **Step 5: 探问题②——377 例在 jsdom 下哪些会红**

```bash
cd "$SPIKE" && pnpm exec vitest run packages/service 2>&1 | tail -40
```

期望能发现 37 个测试文件 / 377 例。把**失败文件名逐个**记进 `FINDINGS.md` 的 `JSDOM_RED_FILES`。
预判最可能红的三个（用到 Blob / File / FormData，而根 `vitest.setup.ts` 把 `globalThis.Blob` 换成了 Node 的 Blob）：`sys.test.ts` · `photos.uploads.test.ts` · `ai.test.ts`。**预判不等于结论，以实跑为准**——可能一个都不红，也可能红在别处。

- [ ] **Step 6: 写 FINDINGS.md**

```markdown
# SP13 T0 探测结论（YYYY-MM-DD）

TYPECHECK_OK: true / false
  （false 时逐条贴 vue-tsc 原文）

JSDOM_RED_FILES:
  - packages/service/src/xxx.test.ts —— 失败原因一句话
  （无则写「无，377 例全绿」）

发现的意外:
  （有就写，没有写「无」）
```

- [ ] **Step 7: 不提交，向机主口头汇报两个结论**

本任务**不产生任何 git 提交**。spike 目录留着，Task 2/3 遇到同样的红可以对照。

---

## Task 2: 搬源码进 `packages/service/`，全量测试回到全绿

**Files:**
- Create: `NimoOS-New-UI/packages/service/**`（106 - 1 = 105 个文件）
- Modify: 视 Task 1 的 `JSDOM_RED_FILES` 而定，给红的文件加一行文件头注释
- Test: 复用现有 `pnpm test`（本任务会让它多出 377 例）

**Interfaces:**
- Consumes: Task 1 的 `JSDOM_RED_FILES`
- Produces: `packages/service/src/index.ts` 存在；根 `pnpm test` 例数 = 基线 + 377 且全绿

**注意这一步还没翻依赖。** 搬完之后 `package.json` 仍指 `file:../NimoOS-Service`，`src/**` 里 578 处 import 拿到的**还是外部那一份**。`packages/service/` 此刻是「多出来的一份源码」——唯一的立即效果是 **vitest 会发现并跑它的 37 个测试文件**。这个拆法是故意的：让"测试环境不兼容"的红**单独**暴露一次，不跟"依赖翻向"的问题混在一起。

- [ ] **Step 1: 记录测试基线（务必先记，之后要对数）**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -6
```

把 `Test Files N passed` / `Tests M passed` 两个数字记下来，后面 `M + 377` 是硬判据。

- [ ] **Step 2: 取源**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
mkdir -p packages/service
git -C ../NimoOS-Service archive HEAD | tar -x -C packages/service
rm -f packages/service/pnpm-lock.yaml
find packages/service -type f | wc -l    # 期望 105
ls packages/service/src | wc -l          # 期望 69
ls packages/service/.superpowers/sdd | head -3   # 台账在
```

- [ ] **Step 3: 确认 dist / node_modules 没被 git 盯上**

```bash
git status --short packages/service | grep -E "dist|node_modules" && echo "❌ 有产物要进库" || echo "✅ 干净"
```

期望 `✅ 干净`（根 `.gitignore` 的裸 `dist` / `node_modules` 匹配任意层级，已覆盖）。

- [ ] **Step 4: 跑全量测试，看 377 例并进来之后的实况**

```bash
pnpm test 2>&1 | tail -30
```

期望：`Test Files` 比基线 +37、`Tests` 比基线 +377。
若有失败，失败文件应与 Task 1 的 `JSDOM_RED_FILES` 一致；**不一致就停下来，说明 spike 与真仓有差异，先查清再往下走**。

- [ ] **Step 5: 逐文件回落到 node 环境（只对真红的文件做）**

对 `JSDOM_RED_FILES` 里的每一个文件，在**第一行**插入：

```ts
// @vitest-environment node
// SP13 内联:本包原属 NimoOS-Service 仓,那边的 vitest 配置是 environment: 'node'。
// 并入 New-UI 后吃的是根配置的全局 jsdom + vitest.setup.ts 里为 fake-indexeddb 做的
// globalThis.Blob → Node Blob 替换,与本文件的 Blob/File/FormData 用法冲突。
// 逐文件回落而不是改根配置:侵入最小,不波及另外那 N 例(N = Step 1 记的基线,写实际数字)。
```

**不要改 `vite.config.ts` 的全局 `environment`，不要改 `vitest.setup.ts`。**
若 Task 1 报 `JSDOM_RED_FILES: 无`，跳过本步。

- [ ] **Step 6: 重跑，确认全绿且例数对得上**

```bash
pnpm test 2>&1 | tail -6
```

期望：0 failed，`Tests` = 基线 + 377（一例都不能少——少了就是有文件没被发现或被 skip 掉了）。

- [ ] **Step 7: 提交（带 pathspec）**

```bash
git status --short | grep -v "^ D design-export" | grep -v "README.md\|oss/manifest.mjs"
git add packages/service
git commit -m "feat(sp13): 搬入共享包源码至 packages/service/

源自 NimoOS-Service @ac39cd7,git archive HEAD 取源(不带历史,旧提交去该仓查)。
105 个文件:69 源文件(含 37 测试 / 377 例)+ 32 份台账 + 包配置。
不带 pnpm-lock.yaml —— 只锁 axios/typescript/vitest,全在根 package.json 里。

本步尚未翻依赖:src/ 里 578 处 import 拿到的仍是 ../NimoOS-Service。
唯一即时效果是 vitest 发现了这 377 例。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- packages/service
```

---

## Task 3: 翻依赖 + 删两处补丁 + 改两处文档

**Files:**
- Modify: `packages/service/package.json` · `package.json:29` · `vite.config.ts:46-49,75-79` · `CLAUDE.md:28-32`
- Create: `../NimoOS-Service/CLAUDE.md`
- Test: `pnpm test` · `pnpm exec vue-tsc --noEmit` · `pnpm build`

**Interfaces:**
- Consumes: Task 2 产出的 `packages/service/`；Task 1 的 `TYPECHECK_OK`
- Produces: `@nimotech/nimoos-service` 从此解析到仓内 `packages/service/src/index.ts`。后续任务（尤其 Task 5 的导出流水线）依赖 `package.json` 里那行**恰好**是 `"@nimotech/nimoos-service": "file:packages/service"`

- [ ] **Step 1: 改包入口指向 TS 源码**

`packages/service/package.json`，把

```json
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],
```

换成

```json
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "types": "./src/index.ts", "import": "./src/index.ts" } },
  "files": ["src"],
```

这与公开产物树 `oss/manifest.mjs` 的 `SERVICE_PATCH` 第 1 条**一字不差** —— 本步等于把那条补丁「上游化」，Task 5 会把它删掉。

- [ ] **Step 2: 翻根依赖**

`package.json` 第 29 行：

```diff
-    "@nimotech/nimoos-service": "file:../NimoOS-Service",
+    "@nimotech/nimoos-service": "file:packages/service",
```

- [ ] **Step 3: 重装依赖，让 node_modules 重新链到仓内**

```bash
pnpm install 2>&1 | tail -5
ls -l node_modules/@nimotech/nimoos-service
```

期望链接指向 `packages/service`（不再是 `../NimoOS-Service`）。

- [ ] **Step 4: 删 `optimizeDeps`，把坑注释改写成历史说明**

`vite.config.ts` 第 45-49 行整块（那段 20 行注释 + `optimizeDeps`）替换为：

```ts
  // ⚠️ 历史(SP1–SP12):共享包曾是 `file:../NimoOS-Service` 外部依赖,被 Vite 当普通
  // node_modules 依赖预打包;而预打包缓存的失效判据是 lockfile / config / 依赖版本号,
  // **不看依赖内容**,那个包版本号恒为 0.0.1 —— 于是 `cd ../NimoOS-Service && pnpm build`
  // 之后缓存不失效,dev server 一直喂旧包,新加的方法在浏览器里全是 undefined
  // (表现为被调用处 catch 成"保存失败")。单测走源码、生产 build 走 node_modules,
  // 两边都是新的,所以只在 dev 复现。当年靠 optimizeDeps.exclude 绕开。
  // **SP13 内联后此坑根治**:包在仓内 packages/service/、入口直指 TS 源码,
  // Vite 按源码文件加载,永远是新的。exclude 与配套的 include: ['axios'] 一并删除。
```

**注意 `include: ['axios']` 也在这块里** —— 它是为配合 exclude 才加的（"exclude 掉的包内部 import 它，显式登记以免触发发现新依赖 → 整页重载"）。exclude 没了之后它大概率多余，但**必须实测**：Step 8 起 dev server 时若控制台出现 `new dependencies optimized: axios` 并整页重载，就把 `optimizeDeps: { include: ['axios'] }` 加回来并注释说明原因。

- [ ] **Step 5: 删 vitest 的 `server.deps.inline`**

`vite.config.ts` 第 75-79 行：

```diff
     setupFiles: ['./vitest.setup.ts'],
-    server: {
-      deps: {
-        inline: ['@nimotech/nimoos-service'],
-      },
-    },
   },
```

（内联后包就是仓内源码，不存在"要不要把 node_modules 里的依赖内联进测试转换"这个问题。）

- [ ] **Step 6: 跑三道门**

```bash
pnpm test 2>&1 | tail -6
pnpm exec vue-tsc --noEmit && echo "tsc ✅"
pnpm build 2>&1 | tail -5
```

期望：测试例数与 Task 2 收尾时**完全一致**（这一步不该改变任何例数）、tsc 0 错、build ✓。
若 tsc 报错且 Task 1 的 `TYPECHECK_OK` 是 `true`，说明真仓与 spike 有差异，停下来查清。

- [ ] **Step 7: 重写 `CLAUDE.md` 的「共享 service 包」整节**

把第 28-32 行整节换成：

```markdown
## 共享 service 包(SP13 起已内联,无构建步骤)

HTTP/认证内核是 **`@nimotech/nimoos-service`**,**源码就在本仓 `packages/service/`**
(`package.json` 里写的是 `file:packages/service`)。`main.ts` 用 `initService({...})` 注入
token 取存、`onAuthFail`、语言等回调。

**改完存盘即生效,没有任何构建步骤** —— 包入口直接指 `packages/service/src/index.ts`(TS 源码),
Vite / Vitest / vue-tsc 都按源码解析。

> **SP13(2026-08-07)之前不是这样**:该包曾是同级仓库 `../NimoOS-Service` 的 `file:` 依赖,
> 改完必须 `cd ../NimoOS-Service && pnpm build`,而且 dev server 还会因预打包缓存喂旧包
> (缓存失效只看版本号、不看内容,那个包版本号恒为 0.0.1)。**这条坑已根治,别再照旧文档操作。**

**⚠️ `../NimoOS-Service` 仓还在,但它现在只服务 Vue2(`NimoOS-UI`)。改那边不会影响本仓。**

`packages/service/` 里的 `tsconfig.json` 与 `vitest.config.ts` 是从原仓一并搬来的,
**从本仓根跑 `vue-tsc` / `vitest` 时两者都不生效**(TS 与 Vitest 都只认根配置,本仓无
workspace / projects 声明)。留着是为与开源产物树同形,别去改它们指望有效果。

包内 37 个测试文件 / 377 例已并入根 `pnpm test`。个别文件头带 `// @vitest-environment node`
—— 原仓是 node 环境,本仓根配置是全局 jsdom,那几个用 Blob/File/FormData 的文件逐个回落,
不动根配置。
```

- [ ] **Step 8: 起 dev server 实测 `include: ['axios']` 该不该留**

```bash
pnpm dev
```

浏览器开 `http://localhost:5273/app/`，看终端与浏览器控制台有没有 `new dependencies optimized: axios` + 整页重载。
- 没有 → 保持删除状态。
- 有 → 把 `optimizeDeps: { include: ['axios'] }` 加回来，注释写明「内联后包不再被预打包，但 axios 仍需显式登记以免首次请求时触发重载（SP13-T3 实测）」。

看完 `Ctrl-C` 停掉。**这一步只是判定配置，dev server 的正式取证在 Task 4。**

- [ ] **Step 9: 新建 `../NimoOS-Service/CLAUDE.md`**

该仓目前**既无 README.md 也无 CLAUDE.md**，本步是新建：

```markdown
# CLAUDE.md — NimoOS-Service

## ⚠️ 先读这一段:本包现在只服务 Vue2

`@nimotech/nimoos-service` 是 NimoOS 前端的 HTTP / 认证 / 后端域封装层。

**2026-08-07(SP13)起,本仓只有一个消费者:Vue2 主应用 `NimoOS-UI`。**

新的 Vue3 应用 `NimoOS-New-UI` 已经把这个包**内联进它自己的仓库**,源码在
`NimoOS-New-UI/packages/service/`,它只依赖那一份。

**⇒ 改这个仓不会影响 New-UI。** 若你的目标是改 New-UI 的网络层,去
`NimoOS-New-UI/packages/service/` 改;改这里等一整天也不会生效,而且三道门全绿、
不会有任何报错提示你走错了地方。

两侧从此各自演进,不再同步。这是机主 2026-08-07 拍板的("独立共存")。

## 本仓怎么用(Vue2 侧)

- 消费方:`NimoOS-UI/package.json` 的 `"@nimotech/nimoos-service": "file:../NimoOS-Service"`。
- **改完必须重新构建**:`pnpm build`(`tsc -p tsconfig.json` → `dist/`);包入口指 `dist/index.js`。
- 若 Vue2 侧构建报 `Module not found`,回 `NimoOS-UI` 跑一次 `pnpm install` 重新同步 `file:` 链接。
- 测试:`pnpm test`(vitest,`environment: 'node'`,377 例)。
- 分支:直接在 `master` 上开发(2026-07-22 起)。
```

- [ ] **Step 10: 两仓分别提交(都带 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short | grep -v "^ D design-export"
git add package.json packages/service/package.json vite.config.ts CLAUDE.md
git commit -m "feat(sp13): 翻依赖到仓内包 + 删两处预打包补丁 + 改文档

package.json: file:../NimoOS-Service → file:packages/service
packages/service/package.json: 入口 dist → src(与产物树 SERVICE_PATCH 第 1 条同形)
vite.config.ts: 删 optimizeDeps.exclude 与 vitest server.deps.inline
  —— 入口指 TS 源码后,预打包缓存喂旧包那条漂移链路对 New-UI 侧不复存在
CLAUDE.md: 「共享 service 包」整节重写 —— 旧文本的
  「改动该包后必须 cd ../NimoOS-Service && pnpm build」内联后是错误指引

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- package.json packages/service/package.json vite.config.ts CLAUDE.md

cd /home/nimo/NimoTech/NimoOS-Service
git add CLAUDE.md
git commit -m "docs: 本仓自 SP13 起只服务 Vue2,New-UI 已内联自己那份

New-UI 的源码在 NimoOS-New-UI/packages/service/,改本仓不会影响它 ——
且不会有任何报错提示走错了地方,故显式立牌。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- CLAUDE.md
```

---

## Task 4: 漂移根治的正向取证（本期核心收益，必须单独证）

**Files:**
- Modify（**临时，当场还原**）: `packages/service/src/sys.ts`
- Test: 人工在浏览器 / dev server 日志上观察

**Interfaces:**
- Consumes: Task 3 的成品
- Produces: 一段可复述的取证记录，写进本计划下方的「取证留痕」小节

**为什么单独立一个任务：** 测试一直走源码、**本来就绿**，`pnpm test` 全绿证明不了这条坑被修好。这条坑从来只在 dev server 上现形。同理见 SP10-T4 的判据修正 —— **主判据必须落在生效载体上**，不能用一个"无论如何都成立"的间接指标充数。

- [ ] **Step 1: 起 dev server**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev
```

- [ ] **Step 2: 浏览器打开并确认页面正常**

`http://localhost:5273/app/` —— 登录进去，随便进一个会发请求的页面（首页小组件即可）。控制台不该有 `is not a function` 这类错误。

- [ ] **Step 3: 在包源码里插一个可观察的改动，只存盘、不构建**

`packages/service/src/sys.ts` 顶部加一行：

```ts
console.log('[SP13-取证] packages/service 的改动无需构建即生效')
```

存盘。**不跑 `pnpm build`，不跑 `pnpm install`，什么都不做。**

- [ ] **Step 4: 看浏览器**

期望：Vite 触发热更新 / 整页重载，浏览器控制台**立刻**出现 `[SP13-取证] …`。

**这就是主判据。** 内联之前，这一步必须先 `cd ../NimoOS-Service && pnpm build`、且因为预打包缓存**即便 build 了也可能仍看不到**。

- [ ] **Step 5: 还原**

删掉那行 `console.log`，存盘，确认浏览器控制台不再出现它。

```bash
git status --short packages/service    # 期望空 —— 改动已还原干净
```

- [ ] **Step 6: 停 dev server，把取证结果记进本计划的「取证留痕」小节**

本任务**不产生提交**（Step 5 之后工作树应当是干净的）。

---

## Task 5: 改开源导出流水线

**Files:**
- Modify: `oss/export.mjs`（6 处）· `oss/manifest.mjs`（2 处）· `oss/tree.test.mjs:108-110`
- Test: `pnpm exec vitest run oss/`

**Interfaces:**
- Consumes: Task 3 保证的 `package.json` 里那行**恰好**是 `"@nimotech/nimoos-service": "file:packages/service"`
- Produces: 产物树形态与内联前**完全一致**（`packages/service/src/index.ts` 在、`photos.ts` 不在、根 `package.json` 是 `file:packages/service`），只是生产方式从"archive 两个仓"变成"archive 一个仓"

**⚠️ 开工前先看 `git status`。** 本计划编写时 `oss/manifest.mjs` 有一处**非本期**的未提交改动（另一条会话在改 README 的 `privateSha256`）。若它仍是脏的，**停下来问机主**，别在别人的改动上叠加。

**为什么必须改（不是可选项）：** 内联后 `archiveInto(SERVICE, svcDir)` 变成重复取源，而 `file:../NimoOS-Service` 这个锚点从私有仓消失，会撞上 `export.mjs` 自己的 `throw new Error('package.json 的 file: 锚点未唯一命中')`。**不改就直接出不了包。**

**为什么保留 `SERVICE_DELETE` / `SERVICE_PATCH` 两张表**（而不是把 40 条路径加 `packages/service/` 前缀并进主表）：手工改 40 条路径，任一条打错都是**静默漏删**；且会让 `tree.test.mjs` 里「两处台账由两条**不同**清单条目负责、漏哪条都可能」那条守卫用例的立论失效 —— 那条是 SP8-P6-T8 真泄漏之后才补上的。

- [ ] **Step 1: 先跑一遍 oss 测试，记录改动前的绿**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run oss/ 2>&1 | tail -8
```

若此时就是红的，先查清是不是别人的未提交改动造成的，别把它当自己的锅。

- [ ] **Step 2: `export.mjs` —— 删 Service 仓的洁净检查与 HEAD 记录**

第 52-55 行：

```diff
 checkClean(NEW_UI, dirtyAllowNewUi)
-checkClean(SERVICE, [])
 const headNewUi = git(NEW_UI, 'rev-parse', 'HEAD')
-const headService = git(SERVICE, 'rev-parse', 'HEAD')
-log(`  New-UI ${headNewUi.slice(0, 8)} · Service ${headService.slice(0, 8)}`)
+log(`  New-UI ${headNewUi.slice(0, 8)}(共享包已内联,不再取第二个仓)`)
```

- [ ] **Step 3: `export.mjs` —— 取源只 archive 一个仓**

第 88-89 行：

```diff
   archiveInto(NEW_UI, tmp)
-  const svcDir = path.join(tmp, 'packages/service')
-  archiveInto(SERVICE, svcDir)
+  // SP13 内联后 packages/service/ 已经在 New-UI 自己的 archive 里,不再取第二个仓。
+  // 这个变量保留:下面 SERVICE_DELETE / SERVICE_PATCH 两张表仍以它为基准目录。
+  const svcDir = path.join(tmp, 'packages/service')
```

`applyDelete(svcDir, SERVICE_DELETE)`（第 94 行）与 `applyPatch(svcDir, SERVICE_PATCH)`（第 97 行）**原样不动**。

- [ ] **Step 4: `export.mjs` —— 删「4. 内嵌共享包」整段**

第 99-113 行整段删除（`const pkgPath` 到 lockfile 的 `writeFileSync` 结束），换成一行说明：

```ts
  // ── 4. 内嵌共享包 ── SP13 起私有仓本身就是内联形态(package.json 写死
  //    file:packages/service、包入口直指 TS 源码),产物树天然正确,无需任何重写。
  //    原先这里有:file: 一行重写 + lockfile 两处 replaceAll + 两个"锚点未命中"守卫。
```

**保留紧随其后的「4.5 重算 lockfile」整段** —— 它解决的是"清单摘掉 `package.json` 依赖后 lockfile 与之自相矛盾"，与内联无关。

- [ ] **Step 5: `export.mjs` —— 报告文件与 import**

第 223 行附近：

```diff
-    `NimoOS-New-UI HEAD: ${headNewUi}\nNimoOS-Service HEAD: ${headService}\n` +
+    `NimoOS-New-UI HEAD: ${headNewUi}(共享包已内联)\n` +
```

第 7-8 行的 import 去掉 `SERVICE`：

```diff
-  NEW_UI, SERVICE, DEFAULT_OUT, OSS_DIR, DIRTY_ALLOW,
+  NEW_UI, DEFAULT_OUT, OSS_DIR, DIRTY_ALLOW,
```

- [ ] **Step 6: `manifest.mjs` —— 删 `SERVICE` 常量**

第 11 行：

```diff
-export const SERVICE = path.resolve(HERE, '../../NimoOS-Service')
```

- [ ] **Step 7: `manifest.mjs` —— 删 `SERVICE_PATCH` 第 1 条**

删除范围**精确定义为**：从 `export const SERVICE_PATCH = [` 的下一行开始（即以
`  // ── T13 复审 Critical:内嵌包不带构建产物` 打头的那段注释块），一直删到该数组
**第一个元素结束**（那个 `{ path: 'package.json', find: …"files": ["dist"],`,
`replace: …"files": ["src"], }` 对象的收尾 `},`）为止。
**下一行 `{ path: 'src/index.ts', find: "import { createPhotos } …` 是第 2 个元素，保留。**

删掉的位置补上这段历史说明：

```js
export const SERVICE_PATCH = [
  // 注:这里原本的第 1 条补丁把内嵌包的入口从 ./dist/index.js 改指 ./src/index.ts
  // (理由:export.mjs 用 git archive 取源,而 dist/ 在 .gitignore 里拿不到,消费方
  // 会 "Failed to resolve entry for package" —— T13 是第一个真在产出树里跑
  // pnpm install && pnpm test 的任务,才暴露出这个洞)。
  // **SP13(2026-08-07)起该补丁已上游化**:私有仓 packages/service/package.json
  // 本身就指 ./src/index.ts,原补丁的 find 锚点必然失配,故删除。
  { path: 'src/index.ts', find: "import { createPhotos } from './photos.js'\n", replace: '' },
```

其余 19 条 `SERVICE_DELETE` + 20 条 `SERVICE_PATCH` **一字不动**。

验证删对了：

```bash
node --input-type=module -e "import('./oss/manifest.mjs').then(m=>{
  console.log('SERVICE_PATCH', m.SERVICE_PATCH.length, '(期望 20)');
  console.log('SERVICE_DELETE', m.SERVICE_DELETE.length, '(期望 19)');
  console.log('第一条应是 src/index.ts:', m.SERVICE_PATCH[0].path);
  console.log('SERVICE 常量应已删:', 'SERVICE' in m);
})"
```

- [ ] **Step 8: `tree.test.mjs` —— 恒真断言改成正向**

第 108-110 行：

```diff
-  it('lockfile 里不再有 ../NimoOS-Service 路径', () => {
-    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
-  })
+  // SP13 之后私有仓本身就写 file:packages/service,「不含 NimoOS-Service」变成没有任何
+  // 路径能违反的恒真断言(守卫价值归零)。改成正向断言:锁文件必须真的指到内嵌包。
+  it('lockfile 指向内嵌的 packages/service', () => {
+    expect(read('pnpm-lock.yaml')).toContain('packages/service')
+    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
+  })
```

- [ ] **Step 9: 跑 oss 全批**

```bash
pnpm exec vitest run oss/ 2>&1 | tail -20
```

期望全绿，**含**「`pnpm install` + `vue-tsc --noEmit` 在产物树上全绿」那条（`tree.test.mjs:707`）。
`tree.test.mjs:101-106`（内嵌共享包落位）、`237-244`（index.ts 接线补丁）、`89-96`（两处台账都不进产物树）**应当原样通过** —— 有任何一条红，说明基准目录换错了，回 Step 3 查。

- [ ] **Step 10: 提交（带 pathspec）**

```bash
git status --short | grep -v "^ D design-export"
git add oss/export.mjs oss/manifest.mjs oss/tree.test.mjs
git commit -m "refactor(sp13/oss): 导出流水线改为只 archive 一个仓

内联后 archiveInto(SERVICE) 是重复取源,而 file:../NimoOS-Service 锚点从私有仓
消失会撞上 export.mjs 自己的「锚点未唯一命中」守卫 —— 不改直接出不了包。

export.mjs 6 处:删 checkClean(SERVICE)/headService、删第二次 archive、
删「内嵌共享包」整段(file: 重写 + lockfile replaceAll + 两个守卫)、报告去掉
Service HEAD、import 去掉 SERVICE。
manifest.mjs 2 处:删 SERVICE 常量、删 SERVICE_PATCH 第 1 条(入口改 src 那条已上游化)。
tree.test.mjs 1 处:恒真断言改正向。

SERVICE_DELETE 19 条与其余 SERVICE_PATCH 20 条一字未动 —— 保留分组比合并进主表
更安全(40 条手工改路径,打错一条就是静默漏删),且不动摇 SP8-P6-T8 台账守卫的立论。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- oss/export.mjs oss/manifest.mjs oss/tree.test.mjs
```

---

## Task 6: 收尾 —— 全部验收门 + Vue2 零影响 + 更新路线图

**Files:**
- Modify: `../NimoOS-UI/docs/vue3-migration-roadmap.md`（阶段总表 SP13 行 + §4 SP13 段的四个勾）
- Test: 全部六道门

**Interfaces:**
- Consumes: Task 2–5 的全部产出
- Produces: 一份可粘给机主的验收结论

- [ ] **Step 1: New-UI 三道门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test 2>&1 | tail -6
pnpm exec vue-tsc --noEmit && echo "tsc ✅"
pnpm build 2>&1 | tail -5
```

判据：0 failed · `Tests` = Task 2 记的基线 + 377 · tsc 0 错 · build ✓。

- [ ] **Step 2: 开源面门**

```bash
pnpm exec vitest run oss/ 2>&1 | tail -8
```

- [ ] **Step 3: Vue2 零影响验证**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git status --short | head          # 期望:除既有脏文件外,本期没碰过它
pnpm build 2>&1 | tail -5
```

判据：Vue2 仍能构建（它继续吃独立仓 `NimoOS-Service`，`file:../NimoOS-Service` 那条依赖本期一个字没改）。

- [ ] **Step 4: 确认外部仓真的可以不在场（内联是否彻底）**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
grep -rn "NimoOS-Service" package.json pnpm-lock.yaml vite.config.ts tsconfig.json || echo "✅ 构建配置里零引用"
```

期望 `✅` —— New-UI 的构建配置里不该再出现 `NimoOS-Service` 这个名字。
（`CLAUDE.md` 与 `packages/service/**` 里的**文字提及**是有意保留的说明，不算引用。）

- [ ] **Step 5: 更新路线图 —— 阶段总表 SP13 行**

`../NimoOS-UI/docs/vue3-migration-roadmap.md` 第 63 行：

```diff
-| **SP13** 共享包内联 New-UI | 由 SP10-T3 机主拍板(2026-08-07)派生:New-UI 把 `@nimotech/nimoos-service` 内联进自己仓库、只依赖仓内那一份;**Vue2 继续依赖原来的独立包**,两侧从此各自演进 | M | ⬜ **与 SP11/SP12 无依赖,可任意穿插** |
+| **SP13** 共享包内联 New-UI | 由 SP10-T3 机主拍板(2026-08-07)派生:New-UI 把 `@nimotech/nimoos-service` 内联进自己仓库、只依赖仓内那一份;**Vue2 继续依赖原来的独立包**,两侧从此各自演进 | M | ✅ **T1-T6 全部关账(填执行当天日期,格式 2026-MM-DD)**;包落 `packages/service/`(源自 Service@`ac39cd7`)、入口指 TS 源码、`optimizeDeps.exclude` 与 `server.deps.inline` 两处补丁已删;导出流水线改为只 archive 一个仓;**未部署未推 origin** |
```

- [ ] **Step 6: 更新路线图 —— §4 SP13 段落**

第 1119-1128 行那四个 `- [ ]` 逐条改 `- [x]` 并补实测结果。**至少写清这四件事**（都是计划执行中查实、与原文不符的）：

- spec 说要补 `.gitignore` 的 `packages/service/dist` —— **不用**，根 `.gitignore` 的裸 `dist` 已匹配任意层级
- `NimoOS-Service` 仓**既无 README 也无 CLAUDE.md**，T4 的"加一句"实为新建文件
- 实际的 `JSDOM_RED_FILES` 是哪几个（或"一个都没红"）
- `include: ['axios']` 最终留没留（Task 3 Step 8 的实测结论）

- [ ] **Step 7: 提交路线图（带 pathspec）**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md
git commit -m "docs(roadmap): SP13 共享包内联关账

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- docs/vue3-migration-roadmap.md
```

- [ ] **Step 8: 向机主汇报**

一张表报六道门的实际数字（不是"应该通过"，是实际输出），外加 Task 4 的漂移取证结论。
明确说清**未部署、未推 origin**（本期不含这两件事）。

---

## 取证留痕

> Task 4 执行时填这里，别只写"通过"。

- 改的文件与那一行：
- 是否跑过任何构建命令：
- 浏览器控制台出现取证输出的时间/表现：
- 还原后 `git status packages/service` 是否干净：

---

## 本期明确不做

- **不部署**（`./scripts/deploy.sh` 不跑）· **不推 origin** —— 与 SP9/SP10 的惯例一致，推送由机主手动做。
- **不建 `pnpm-workspace.yaml`** —— `file:` 依赖已经够用，引入 workspace 会改变 pnpm 的提升行为，是本期范围外的风险。
- **不动 Vue2 一行代码** —— 它继续吃独立仓。
- **不合并两侧的 service 源码** —— 分叉是本期的目的，不是副作用。
- **不删 `NimoOS-Service` 仓。**
