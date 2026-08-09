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

