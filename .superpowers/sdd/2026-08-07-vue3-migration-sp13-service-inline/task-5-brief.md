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

