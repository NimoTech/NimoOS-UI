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

