# 最终整枝审查 — 四项 finding 修复报告

日期:2026-07-17
分支状态:三仓库工作区均干净，各自在当前分支上直接提交（未新建分支）。

---

## Finding 1(Important)— widget-contract.md 残句与新契约矛盾

**仓库**:`NimoOS-AI`（main）
**文件**:`builtin-skills/desktop-app-builder/references/widget-contract.md`

### 问题
"### The card resizes" 一节里，新增的 "Exception — fixed-size widgets…" 段落
之后紧跟一句旧文案："Users can drag-resize every app widget between 2×1 and
4×4 grid cells; `nimoos.widget.w/h` set only the INITIAL size and there is
no way to lock it." —— 与刚讲完的"可以用 min==max 或 resize=false 锁死"直接
矛盾。

### 修复
```diff
-Users can drag-resize every app widget between 2×1 and 4×4 grid
-cells; `nimoos.widget.w/h` set only the INITIAL size and there is no
-way to lock it. Grid cells are 58–92px depending on the user's
+Unless locked via the min/max labels above, users can drag-resize the
+widget within its declared range (global bounds 2×1..4×4);
+`nimoos.widget.w`/`h` set only the INITIAL size. Grid cells are 58–92px depending on the user's
```
保留了原句其余上下文（grid cell 像素范围、iframe viewport 说明等）不变。
未升 seed 版本（manifest.json / SKILL.md 均未改动，v11 尚未部署过）。

### 验证
纯文档改动，无可运行测试；已 `git diff` 自查，确认改动范围仅限该段落。

### 提交
```
commit 58f2b4a
docs(skills): 修正 widget-contract 与尺寸锁死契约矛盾的残句
```

---

## Finding 2(Important)— layout 持久化尺寸超出收紧后的范围不自愈

**仓库**:`NimoOS-New-UI`（master）
**文件**:`src/home/stores/layout.ts`（实现），`src/home/stores/layout.test.ts`（测试）

### 问题
appwidget 按旧的容器 label 范围持久化尺寸（如 4×4）后，若容器 label 被
收紧（maxw/maxh 变小，或 min==max 锁死），桌面重新加载/轮询时
`autoPin` 对已 `seen` 的应用只做"缺席清理"和"新增上桌"，从不重新校验
已存在项的尺寸 —— 锁死组件的拖拽把手已经隐藏，尺寸却永久停在新范围外。

### 修复设计
在 `autoPin` 的 `for (const d of decls)` 循环里，`seen.value.has(d.key)`
分支不再直接 `continue`：若 `d.widget` 存在，找到对应的 `kind==='appwidget'`
项，用 `clampSize(it, it.w, it.h, sizeOfItem)`（`sizeOfItem` 来自
`../widgets/registry`，内部会查当前 apps store 里该应用最新的
`minw/minh/maxw/maxh` 声明）算出应处的 `[cw, ch]`：

- `[cw,ch] === [it.w,it.h]`：恒等，不碰，也不进 `changed`（合法用户在范围
  内的手动调整不受影响）。
- 需要缩小：`fits(it.c, it.r, cw, ch, it.id, items.value, dims)` 必然为
  true（缩小不会新增碰撞）→ 原地改 `w/h`。
- 需要放大：先用 `fits` 判断原地放大是否与其他项冲突/越界：
  - 不冲突 → 原地放大。
  - 冲突/越界 → 以"排除自身"的 `items.value` 为障碍，`firstFree(cw, ch,
    others, dims)` 重新找位搬过去；找不到位则保持原样不动（可接受的
    退化，spec 里也允许）。
- 有变化时 `changed = true`，沿用既有 `save()` 路径持久化。

导入确认无环：`layout.ts` 新增 `import { sizeOfItem } from
'../widgets/registry'`；`registry.ts` 只 `import { useAppsStore } from
'../stores/apps'`，`apps.ts` 不导入 `layout.ts` —— 单向依赖，grep 确认。

### TDD 证据

新增 4 个测试用例（`describe('autoPin 收紧范围自愈 …')`），覆盖：
1. 合法用户调整仍在当前范围内 → 不被覆盖（identity）。
2. 容器收紧 max（4×4→2×2）→ 原地缩小。
3. 容器抬高 min（2×1→3×2）且原地无碰撞 → 原地放大。
4. 放大后与邻居冲突 → 重新找位搬走，且未破坏邻居项。

**RED**（临时 `git stash` 掉 `layout.ts` + `registry.ts` 的实现改动，只保留
新测试，运行 `pnpm exec vitest run src/home/stores/layout.test.ts`）：

```
 FAIL  …>容器收紧范围后持久化尺寸超界(需缩小):原地缩小
   expected { w: 2, h: 2 } … received { w: 4, h: 4 }
 FAIL  …>容器抬高 min(需放大)且原地无碰撞:原地放大
   expected { w: 3, h: 2 } … received { w: 2, h: 1 }
 FAIL  …>放大后原地与邻居冲突:重新找位搬过去
   expected 3 … received 2
 Test Files  1 failed (1)
      Tests  3 failed | 17 passed (20)
```
（第 4 个新用例"合法调整不覆盖"在旧代码下也通过——旧代码从不碰 seen 项，
这本就是该项行为的一部分基线，不代表新逻辑冗余，只是新逻辑必须继续满足它。）

**GREEN**（`git stash pop` 恢复实现，重跑）：
```
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

### 全量验证
```
pnpm test              → Test Files 152 passed (152) / Tests 715 passed (715)
pnpm exec vue-tsc --noEmit → 无输出（无类型错误）
```
（首次 `pnpm test` 全量跑时 `src/files/upload/persist.test.ts` 里一条无关
用例 `dropPersisted removes record + blob and frees budget` 偶发失败；
单独跑该文件 100% 通过，再次全量跑也 100% 通过 —— 确认是与本次改动无关
的既有跨文件状态泄漏型 flaky 测试，非本次改动引入的回归。）

### 提交
```
commit 04e46d3
fix(home): autoPin 把现存 appwidget 尺寸夹进当前声明范围 + 清理悬空 import
```
（与 Finding 3 合并在同一提交，见下。）

---

## Finding 3(Minor)— registry.ts:2 悬空 import

**仓库**:`NimoOS-New-UI`（master）
**文件**:`src/home/widgets/registry.ts`

### 问题
第 2 行 `import { APP_WIDGET_SIZE, appWidgetRange } from './appWidgetSize'`
中 `APP_WIDGET_SIZE` 未被文件内任何代码使用 —— 该 re-export 走的是第 38
行独立的 `export { APP_WIDGET_SIZE } from './appWidgetSize'`，两条语句
互不依赖。

### 修复
```diff
-import { APP_WIDGET_SIZE, appWidgetRange } from './appWidgetSize'
+import { appWidgetRange } from './appWidgetSize'
```
确认 grep 全文件后 `APP_WIDGET_SIZE` 只在删掉的那一行和 `export {}` 转发
行出现，无其他使用。

### 验证
随 Finding 2 一起跑 `pnpm test`（715 passed）+ `vue-tsc --noEmit`（无报错）。

### 提交
与 Finding 2 同一提交 `04e46d3`。

---

## Finding 4(Minor)— sugar 守卫 `== 0` 改 `<= 0`

**仓库**:`NimoOS-AppManagement`（feat/desktop-label-recognition）
**文件**:`service/desktop_labels.go`（实现），`service/desktop_labels_test.go`（测试）

### 问题
`ParseDesktopLabels` 里 `resize=false` 的语法糖填充逻辑用 `if
m.WidgetMinW == 0 {`（以及 MaxW/MinH/MaxH 三处同构）判断"该字段是否已被
显式声明"。但 `strconv.Atoi` 对垃圾输入如 `"-1"` 能正常解析出 `-1`（非
error 分支），于是 `-1 != 0` 被误判为"已显式声明"，绕过糖填充，让负值
原样流入 `WidgetMinW` 等字段，破坏"resize=false 时 min=max=声明尺寸"的
不变式。

### 修复
```diff
-if m.WidgetMinW == 0 {
+if m.WidgetMinW <= 0 {
     m.WidgetMinW = w0
 }
-if m.WidgetMaxW == 0 {
+if m.WidgetMaxW <= 0 {
     m.WidgetMaxW = w0
 }
-if m.WidgetMinH == 0 {
+if m.WidgetMinH <= 0 {
     m.WidgetMinH = h0
 }
-if m.WidgetMaxH == 0 {
+if m.WidgetMaxH <= 0 {
     m.WidgetMaxH = h0
 }
```

### TDD 证据

新增用例 `"resize=false 糖:垃圾负值不应绕过糖填充"`：
`resize=false` + `minw="-1"` + `w="3"` + `h="3"` → 期望 `WidgetMinW ==
WidgetMaxW == WidgetMinH == WidgetMaxH == 3`（垃圾负值被糖重新填充覆盖）。

**RED**（`git stash` 掉 `desktop_labels.go` 的实现改动，只保留新测试，
`go test ./service/ -run TestParseDesktopLabels -v`）：
```
--- FAIL: TestParseDesktopLabels/resize=false_糖:垃圾负值不应绕过糖填充 (0.00s)
    desktop_labels_test.go:147: negative garbage minw must not bypass
    sugar fill: &{… WidgetMinW:-1 WidgetMinH:3 WidgetMaxW:3 WidgetMaxH:3}
--- FAIL: TestParseDesktopLabels (0.00s)
FAIL
```

**GREEN**（`git stash pop` 恢复实现，重跑）：
```
=== RUN   TestParseDesktopLabels/resize=false_糖:垃圾负值不应绕过糖填充
--- PASS: TestParseDesktopLabels (0.00s)
    --- PASS: TestParseDesktopLabels/resize=false_糖:垃圾负值不应绕过糖填充 (0.00s)
    …（其余 9 个子用例全部 PASS）
PASS
ok  	github.com/NimoTech/NimoOS-AppManagement/service	0.021s
```

### 全量验证
```
go build ./...                                    → 通过（BUILD_OK）
go test ./service/ ./route/... -run TestParseDesktopLabels|TestApplyDesktopMeta -v → 全部 PASS
```
`go test ./service/...`（不加 `-run` 过滤）在本沙箱环境里会命中若干
**既有的、与本次改动无关的网络依赖测试**：
- `TestAppStoreList`（appstore_management_test.go）会挂起直至 10 分钟
  goroutine-leak 超时 —— 该测试内部走真实 AppStore 拉取逻辑，沙箱无外网。
- `TestGetComposeApp` / `TestGetApp` / `TestSkipUpdateCatalog` 直接因
  `context deadline exceeded` / `404` 失败 —— 同样是对
  `github.com/NimoTech/_appstore`、`https://nimoos.app/store/main.zip`
  等真实地址的网络请求，环境不可达导致，与 `desktop_labels.go` 改动
  无关（这些测试文件本次未被触碰）。
用 `go test ./service/... -skip TestAppStoreList` 确认了这些失败与本次
diff 无关（同样的网络失败模式，出现在完全不同的文件里）。
`./route/...` 本身无网络依赖测试，`go test ./route/...` 单独跑通过
（`route/v2` PASS，`route/`、`route/v1` 均 no test files）。

### 提交
```
commit 1a6927d
fix(desktop): resize=false 糖守卫容忍负值垃圾输入
```

---

## 三仓库最终提交汇总

| 仓库 | 分支 | commit |
|---|---|---|
| NimoOS-AI | main | `58f2b4a` |
| NimoOS-New-UI | master | `04e46d3` |
| NimoOS-AppManagement | feat/desktop-label-recognition | `1a6927d` |

`go mod tidy` 未运行；三仓库 seed/manifest 版本均未改动。
