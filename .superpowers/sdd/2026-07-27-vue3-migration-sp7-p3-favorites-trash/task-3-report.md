# Task 3 报告 — photosTrash Pinia store

## Status: 完成

## 产出
- `src/photos/stores/trash.ts` — `usePhotosTrash` store(`defineStore('photosTrash', ...)`)。
- `src/photos/stores/__tests__/trash.test.ts` — 13 个测试用例。

## Commit
- `667b846` — `feat(photos): photosTrash store(恢复/清空/永久删除/undo/保留天数)`

## 与 brief 的差异(两处必须修正,已一次做对)
1. **loaded 门控**:`fetchTrash` 只在 try 成功路径末尾置 `loaded.value = true`;catch 分支只清空 `items`,不动 `loaded`,保持可重试语义(对齐 `favorites.ts` 的 `favIdsLoaded`/`favoritesLoaded` 先例)。新增测试:
   - `fetchTrash 失败时 items 清空但 loaded 保持 false(可重试)`
   - `fetchTrash 成功后置 loaded=true`(补充正向对照)
2. **错误日志**:以下四处 catch 均补 `console.error('[photos-trash] <action>', ...)`:
   - `fetchTrash` 的 catch
   - `purge` 逐项 `.then(undefined, e => console.error('[photos-trash] purge', id, e))`
   - `undoRestore` 逐项同上模式(`'[photos-trash] undoRestore'`)
   - `fetchRetention` 的 catch
   - `setRetention` 按 brief 无 try/catch,保持不变(异常直接抛给调用方)。
   新增测试覆盖上述四处日志断言(`purge 单项失败`、`undoRestore 单项失败`、`fetchRetention 失败`)。

## TDD 证据

### RED(实现文件不存在前)
```
$ pnpm exec vitest run src/photos/stores/__tests__/trash.test.ts
 FAIL  src/photos/stores/__tests__/trash.test.ts [ src/photos/stores/__tests__/trash.test.ts ]
Error: Failed to resolve import "../trash" from "src/photos/stores/__tests__/trash.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

### GREEN(实现落地后)
```
$ pnpm exec vitest run src/photos/stores/__tests__/trash.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### 全量测试
```
$ pnpm test
 Test Files  241 passed (241)
      Tests  1466 passed (1466)
```
（stderr 里的 "Not implemented: navigation (except hash changes)" 是既有的
`favorites.test.ts` exportZip 用例触发的 jsdom 日志噪音,与本任务无关,不是失败断言。）

### 类型检查
```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

## 测试清单(13 个)
1. fetchTrash 映射 trashAssetToPhoto,容忍 null
2. fetchTrash 失败时 items 清空但 loaded 保持 false(可重试)【补充】
3. fetchTrash 成功后置 loaded=true【补充】
4. restore 调 batch 后重拉
5. restoreAll 调 restoreAllTrash 后重拉【补充,brief 未显式列出但接口要求】
6. empty 调 emptyTrash 后重拉
7. purge 逐个删后重拉
8. purge 单项失败时吞错并记日志,不影响其余项与后续重拉【补充】
9. undoRestore 逐个 deleteAsset 后重拉
10. undoRestore 单项失败时吞错并记日志【补充】
11. fetchRetention 读 config
12. fetchRetention 失败时记日志且保留默认值【补充】
13. setRetention 先 GET watchDirs 再 PUT

## Concerns
- 无乐观更新完全忠于 Vue2:restore/restoreAll/purge/empty/undoRestore 全部走
  "await 后端 → 全量 fetchTrash" 路径,UI 层(T9)需要自己处理"操作中"loading
  态,store 本身不暴露单独的 pending 标记。
- `restoreAll` 的测试为本任务新增(brief 示例测试未列出,但接口清单第 14 行
  明确要求该 action),已按 restore 的镜像模式补齐。
- `setRetention` 按 brief 指示未加 try/catch,失败会直接向上抛出;T9/P8 消费方
  调用时需自行 catch 处理 UI 反馈。
