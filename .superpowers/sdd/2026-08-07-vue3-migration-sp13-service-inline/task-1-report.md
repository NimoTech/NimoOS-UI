# SP13 Task 1（T0 探测）报告 —— 2026-08-07

## 结论摘要

TYPECHECK_OK: **true**
JSDOM_RED_FILES: **无，377 例全绿**

两个未知都在乐观方向上得到确认：全量私有仓源码（含 photos / search / ai / notes / sse /
wiki 六个域）能过 `vue-tsc --noEmit`；37 个测试文件 / 377 例在 jsdom + 根 vitest.setup.ts
（换 Blob 实现）下全部通过，包括预判最可能红的 `sys.test.ts` / `photos.uploads.test.ts` /
`ai.test.ts`。

## 执行过程

### Step 1: 搭 spike 目录

```bash
SPIKE=/tmp/claude-1000/-home-nimo-NimoTech/4167204c-4a83-445b-a850-45aba33951e0/scratchpad/sp13-spike
git -C /home/nimo/NimoTech/NimoOS-New-UI archive HEAD | tar -x -C "$SPIKE"
git -C /home/nimo/NimoTech/NimoOS-Service archive HEAD | tar -x -C "$SPIKE/packages/service"
```

`ls "$SPIKE/packages/service/src" | wc -l` = **69**，与 brief 预期一致。

### Step 2: 三处接缝

- `packages/service/package.json`：`main/module/types/exports/files` 从 `dist` 改指向
  `./src/index.ts`（源文件）。
- 根 `package.json`：`"@nimotech/nimoos-service": "file:../NimoOS-Service"` →
  `"file:packages/service"`。
- 根 `vite.config.ts`：删掉 `optimizeDeps: { exclude: ['@nimotech/nimoos-service'], include: ['axios'] }`
  整块，以及 `test.server.deps.inline: ['@nimotech/nimoos-service']` 整块。均按行原样删除，
  未改动其余配置（DEV_PROXY、base、preview、pdfjs 拷资源插件等原样保留）。

三处均按 brief 逐字操作，无偏差。

### Step 3: `pnpm install`

```bash
pnpm install --prefer-offline --ignore-scripts --no-frozen-lockfile
```

**顺利，耗时 3.4 秒**（`Done in 3.4s`）。命中本机 pnpm store，未联网、未跑生命周期脚本。
验证 `node_modules/@nimotech/nimoos-service` 软链正确落到
`.pnpm/@nimotech+nimoos-service@file+packages+service/node_modules/@nimotech/nimoos-service`，
其 `package.json` 的 `main/module/types/exports` 确认是接缝后指向 `./src/index.ts` 的版本
——证明 `file:packages/service` 依赖链路本身可用。

**耗时量级偏低于预期**：3.4 秒远快于"装依赖"通常给人的心理预期（数十秒到数分钟），
原因是本机 pnpm store 精确命中所有依赖版本，`--prefer-offline` 完全走本地缓存。若 Task
2/3 在 store 缓存不命中的环境（比如全新机器）跑同样命令，实际耗时/是否需要联网会不同，
本次探测**未覆盖**这种更严苛的场景，留待注意。

### Step 4: `vue-tsc --noEmit`（探问题①）

```bash
cd "$SPIKE" && pnpm exec vue-tsc --noEmit
```

**exit code 0，stdout/stderr 完全为空，耗时 ~18.7s（real），user time ~37s（多核并行）。**
复跑一次核验（避免侥幸），结果一致：0 行输出，exit 0。

**TYPECHECK_OK: true** —— 对全量 69 个源文件（比 oss 产物树多出 photos / search / ai /
notes / sse / wiki 六个域）跑通，没有出现：
- 「Bundler 无法把 `./xxx.js` 说明符解析回同名 `.ts` 文件」的报错；
- 「包源码本身存在类型错误、只是此前被 oss 裁剪掩盖」的报错。

两种事先担心的问题都没有出现，无需向 Task 3 移交任何 vue-tsc 错误原文（因为没有错误）。

### Step 5: `vitest run packages/service`（探问题②）

```bash
cd "$SPIKE" && pnpm exec vitest run packages/service
```

输出：

```
 Test Files  37 passed (37)
      Tests  377 passed (377)
   Start at  12:05:45
   Duration  5.98s (transform 1.61s, setup 7.08s, import 1.40s, tests 320ms, environment 14.31s)
```

exit code 0。**实际发现的测试文件数 = 37，例数 = 377，与 brief 预期（37 文件 / 377 例）
完全吃合，无出入。**

`find packages/service/src -name "*.test.ts" | wc -l` 独立核对也是 37，两个来源一致。

为排除"默认 reporter 藏告警"这个已知坑（memory: `vitest-reporter-hides-warnings.md`），
用 `--reporter=verbose` 复跑一次，逐条打印全部 377 行断言，逐行核对无 warn/error/fail
关键字，只有 `✓`。

**JSDOM_RED_FILES: 无，377 例全绿。** 预判最可能红的三个文件（`sys.test.ts` /
`photos.uploads.test.ts` / `ai.test.ts`，用到 Blob/File/FormData，而根 vitest.setup.ts 把
`globalThis.Blob` 换成了 Node 的 Blob）**全部通过**，没有观察到 Blob 替换引发的任何断言
失败或运行时异常。

## 意外 / 与预期不符之处

**无实质性意外。** 两项探测都比 brief 行文中流露的谨慎预期（"可能一个都不红，也可能红在
别处""不一定"）更顺利——两个未知都干净地落在"没问题"这一侧。唯一值得记录的两点非结论性
观察（不影响 TYPECHECK_OK / JSDOM_RED_FILES 的值）：

1. `pnpm install` 3.4 秒完成，远快于一般直觉，因为本机 store 已精确缓存所有依赖版本；
   这次没有验证"store 缓存未命中"场景下的行为。
2. `vue-tsc` 18.7s / user 37s，量级合理但比六域被剥掉的 oss 产物树预期会慢一些，不构成
   阻碍。

## 未做的事（按硬约束）

- 未修改 `/home/nimo/NimoTech/NimoOS-New-UI` 或 `/home/nimo/NimoTech/NimoOS-Service` 任一
  真仓的任何已跟踪文件；三处接缝、install、typecheck、测试全部只发生在
  `$SPIKE`（`/tmp/.../scratchpad/sp13-spike/`）。
- 未产生任何 git 提交（两个真仓、spike 目录都没有 `git commit`；spike 目录甚至不是一个
  git 仓库，只是 tar 展开的普通文件树）。
- 发现 0 错误，因此没有"发现问题但不修"的情况需要克制——本次探测没有触发这条纪律。

## 产物位置（供 Task 2/3 对照）

- Spike 目录（留存，未清理）：
  `/tmp/claude-1000/-home-nimo-NimoTech/4167204c-4a83-445b-a850-45aba33951e0/scratchpad/sp13-spike/`
- `FINDINGS.md`（与本报告同内容）：
  `/tmp/claude-1000/-home-nimo-NimoTech/4167204c-4a83-445b-a850-45aba33951e0/scratchpad/sp13-spike/FINDINGS.md`
- 本报告：
  `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/2026-08-07-vue3-migration-sp13-service-inline/task-1-report.md`
