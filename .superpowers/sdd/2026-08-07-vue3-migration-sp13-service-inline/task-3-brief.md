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

