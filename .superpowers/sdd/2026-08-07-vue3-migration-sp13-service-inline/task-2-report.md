# Task 2 报告:搬源码进 `packages/service/`

## 状态:DONE_WITH_CONCERNS

新增内容(37 个测试文件 / 377 例)全绿,与 Task 1 探测(`JSDOM_RED_FILES = 无`)一致,Step 5 按预期整步跳过。但全仓 `pnpm test` 收尾**不是 0 failed**——有 3 个 `oss/**` 测试文件失败,**这是搬运前就已存在的失败,与本任务无关**,详见下文「顾虑」。

---

## Step 1:测试基线(⚠️ Task 3 / Task 6 都要用这两个数字)

```
Test Files  3 failed | 600 passed (603)
     Tests  1 failed | 9867 passed | 70 skipped (9938)
```

**基线 = `600 passed (603)` 个文件 / `9867 passed`(70 skipped,1 failed,共 9938)例。**

基线本身就带 3 个失败文件 / 1 个失败例,均在 `oss/` 下(`oss/media-wave.test.mjs`、`oss/tree.test.mjs`、`oss/export-rsync.test.mjs`),与 `packages/service` 无关——是另一条并发会话留下的未提交改动(`M README.md`、`M oss/manifest.mjs`、3 个 `design-export/*` 删除)导致的,开工前已在工作树里,详见「顾虑」。

## Step 2:取源

```bash
git -C ../NimoOS-Service archive HEAD | tar -x -C packages/service
```

- 来源 HEAD:`ac39cd7`
- `find packages/service -type f | wc -l` → **105**(期望 105 ✅)
- `ls packages/service/src | wc -l` → **69**(期望 69 ✅)
- `packages/service/.superpowers/sdd` 台账存在(`2026-07-23-vue3-migration-sp7-p0-photos-domain/` + `progress.md` + 顶层 `task-*-brief/report.md`)✅
- 已删除 `packages/service/pnpm-lock.yaml`

## Step 3:dist / node_modules 未被 git 盯上

```
git status --short packages/service | grep -E "dist|node_modules"
→ ✅ 干净
```

未新增任何 `.gitignore` 条目(根 `.gitignore` 裸 `dist`/`node_modules` 已按预期覆盖任意层级)。

## Step 4:全量测试(搬入后)

```
Test Files  3 failed | 637 passed (640)
     Tests  1 failed | 10244 passed | 70 skipped (10315)
```

**Δ 文件数 = 637 − 600 = +37**(期望 +37 ✅)
**Δ 例数  = 10244 − 9867 = +377**(期望 +377 ✅,精确对上)

失败文件集合与搬入前**完全相同**(`oss/media-wave.test.mjs`、`oss/tree.test.mjs`、`oss/export-rsync.test.mjs`),没有一个新增的 `packages/service/src/*.test.ts` 文件失败——即本任务引入的 377 例**全部通过**,符合 Task 1 `JSDOM_RED_FILES = 无` 的预判,无需 Step 5。

## Step 5:跳过

按 Task 1 结论(`JSDOM_RED_FILES = 无`)和 brief 指示,整步跳过,未对任何文件加 `// @vitest-environment node` 注释。

## Step 6:收尾复核

全仓仍是 `3 failed | 637 passed (640)` 文件 / `1 failed | 10244 passed | 70 skipped (10315)` 例——**不是 0 failed**,与 brief 的「期望全绿」有出入。已核实这 3 个失败与搬入 `packages/service` 无因果关系(见「顾虑」),不属于本任务范围,未做任何处理。

## Step 7:提交

```
commit 95a2083
feat(sp13): 搬入共享包源码至 packages/service/
105 files changed, 11299 insertions(+)
```

带 pathspec `-- packages/service`,提交后复查 `git status --short`,只剩另一条会话的既有改动(`M README.md`、`M oss/manifest.mjs`、3 个 `D design-export/*`),未误动、未提交它们。

---

## 顾虑(为何是 DONE_WITH_CONCERNS 而非 DONE)

开工前 `git status` 已显示 `M README.md`、`M oss/manifest.mjs`、3 个 `D design-export/*`——brief 已提前告知这是另一条并发会话的改动,"一个都不要碰"。这些改动导致 `oss/export-rsync.test.mjs` 里的一个用例失败(该用例会跑 `oss/export.mjs`,它在工作树不干净时会中止导出并报错);另外两个 `oss/media-wave.test.mjs`、`oss/tree.test.mjs` 的失败原因未深挖(不在本任务范围,且搬入前后表现一致,确认与 `packages/service` 无关)。

这三个失败在**搬入前的基线里就已经存在**,搬入后原样保留、数量不变,不属于「本步 Step 4/6 期望的失败应与 JSDOM_RED_FILES 一致」的判据范围(那条判据只约束*新增*的 37 个测试文件),因此没有触发「停下来查清」的条件——本任务对应的验收判据(Δ文件 +37、Δ例数 +377、新增测试全绿)完全达标。但由于全仓收尾并非严格 0 failed,如实标记为 DONE_WITH_CONCERNS,供 Task 3/Task 6 知悉:全仓基线并非全绿,是外部并发改动导致,与共享包内联工作无关,预计等那条会话收尾/提交后自行恢复。
