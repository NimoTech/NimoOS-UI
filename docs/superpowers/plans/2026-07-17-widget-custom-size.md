# 容器小组件自定义/固定尺寸(label 契约扩展)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第三方容器通过 `nimoos.widget.minw/minh/maxw/maxh`(及语法糖 `nimoos.widget.resize=false`)控制桌面小组件的可调整尺寸范围;min==max 时尺寸锁死、桌面自动隐藏调整把手。

**Architecture:** 三仓库链:① NimoOS-AppManagement(分支 `feat/desktop-label-recognition`)解析新 label 并在 appgrid 响应的 `widget` 对象上加纯加法可选字段 → ② NimoOS-New-UI(master)+ 共享包 NimoOS-Service:`sizeOfItem()` 对 appwidget 改为按应用自带范围(夹进全局 2×1..4×4),初始尺寸夹进有效范围;**零 UI 组件代码**(`canResize` 已有 min==max 判断,resize 拖拽本来就按 `sizeOfItem` 夹紧)→ ③ 契约文档(人类版 label-spec + AI skill 正本)最后发,seed 版本 10→11。

**Tech Stack:** Go 1.21 + oapi-codegen v1.12.4(AppManagement,纯 Go 无 CGO)· Vue 3 + TS strict + vitest(New-UI,pnpm)· 共享 `file:` 链接包 @nimotech/nimoos-service。

**Spec:** `nimo_os_docs/docs/design/2026-07-17-widget-custom-size-HANDOFF.md`

## Global Constraints

- 全局硬边界:小组件尺寸永远夹紧在 **w 2..4 × h 1..4**(`2×1..4×4`)内;初始尺寸缺省/非法 → `2×2`。
- **label 没写就不带字段**:appgrid 响应新字段全部可选、缺省不序列化(向后兼容,老桌面忽略)。
- appgrid 生产响应是**裸信封 `{data,message}`,没有 success 字段**——验收 curl 时按此解析。
- Go 版本钉死 `go 1.21`;**如跑了 `go mod tidy` 必须恢复版本钉**(echo v4.12、旧 `golang.org/x/*`)。
- **绝不手改生成代码**(`codegen/app_management_api.go`)——改 `api/app_management/openapi.yaml` 后 `go generate ./...` 重生成。
- New-UI 包管理器 **pnpm**(勿用 yarn/npm);改 `../NimoOS-Service` 后必须 `cd ../NimoOS-Service && pnpm build`,消费端报 Module not found 则再 `pnpm install`。
- New-UI 部署唯一入口 `./scripts/deploy.sh`;后端服务部署 `nimo_os_docs/scripts/deploy.sh <svc>`。**勿手写 rsync 到 /var/lib。**
- 本特性**无新 i18n 文案、无新 CSS**(不触发 theme token / i18n parity 约束)。
- AI skill 正本改动后必须把 `NimoOS-AI/service/skills_seed.go` 的 `BuiltinSeedVersion` 从 `"10"` 升 `"11"`。
- AppManagement 工作分支是 **`feat/desktop-label-recognition`**(未合 main),提交都落这个分支。
- 每个仓库独立 git,**分别提交,绝不在工作区根目录跑 git**。

## ⚠ 已知工作区状态(动手前必读)

- **NimoOS-New-UI master 有遗留未提交 WIP**(接手前已存在,疑似"系统应用图标"工作):
  `src/home/apps/systemApps.ts`、`src/home/components/AppTile.test.ts`、
  `src/home/components/SearchDialog.vue`、`src/home/stores/apps.ts`(一行:`icon: s.icon`)、
  未跟踪目录 `src/home/apps/icons/`。本计划要改 `apps.ts`,WIP 与我们的改动同文件。
  处理方式见 Task 4(测试通过则先单独一笔提交保全 WIP,不与本特性混在一起)。
- AppManagement 分支 `feat/desktop-label-recognition` 工作区应干净(以 `git status` 实际为准)。

---

### Task 1: AppManagement — 解析四个新 label + `resize=false` 语法糖(TDD)

**Files:**
- Modify: `NimoOS-AppManagement/service/desktop_labels.go`
- Test: `NimoOS-AppManagement/service/desktop_labels_test.go`

**Interfaces:**
- Consumes: 现有 `ParseDesktopLabels(labels map[string]string) *DesktopLabelMeta` / `ApplyDesktopMeta(app *model.MyAppList, labels map[string]string)`。
- Produces: `DesktopLabelMeta` 新增 `WidgetMinW, WidgetMinH, WidgetMaxW, WidgetMaxH int`(0 = 未声明);Task 2 的 adapter 和 `model.MyAppList` 依赖这四个字段名。

- [ ] **Step 1: 写失败测试**(追加到 `desktop_labels_test.go` 的 `TestParseDesktopLabels` 内,并给 `TestApplyDesktopMeta` 加断言)

```go
	t.Run("自定义尺寸范围四 label", func(t *testing.T) {
		m := ParseDesktopLabels(map[string]string{
			"nimoos.enable":      "true",
			"nimoos.widget.path": "/widget",
			"nimoos.widget.minw": "3", "nimoos.widget.minh": "2",
			"nimoos.widget.maxw": "4", "nimoos.widget.maxh": "3",
		})
		if m.WidgetMinW != 3 || m.WidgetMinH != 2 || m.WidgetMaxW != 4 || m.WidgetMaxH != 3 {
			t.Fatalf("bad range: %+v", m)
		}
	})

	t.Run("范围 label 缺省为 0(不带字段)", func(t *testing.T) {
		m := ParseDesktopLabels(map[string]string{
			"nimoos.enable": "true", "nimoos.widget.path": "/widget",
		})
		if m.WidgetMinW != 0 || m.WidgetMinH != 0 || m.WidgetMaxW != 0 || m.WidgetMaxH != 0 {
			t.Fatalf("expected all-zero range: %+v", m)
		}
	})

	t.Run("resize=false 糖:min=max=声明的 w/h", func(t *testing.T) {
		m := ParseDesktopLabels(map[string]string{
			"nimoos.enable": "true", "nimoos.widget.path": "/widget",
			"nimoos.widget.w": "4", "nimoos.widget.h": "3",
			"nimoos.widget.resize": "false",
		})
		if m.WidgetMinW != 4 || m.WidgetMaxW != 4 || m.WidgetMinH != 3 || m.WidgetMaxH != 3 {
			t.Fatalf("bad sugar: %+v", m)
		}
	})

	t.Run("resize=false 糖:w/h 未声明按默认 2×2 锁死", func(t *testing.T) {
		m := ParseDesktopLabels(map[string]string{
			"nimoos.enable": "true", "nimoos.widget.path": "/widget",
			"nimoos.widget.resize": "false",
		})
		if m.WidgetMinW != 2 || m.WidgetMaxW != 2 || m.WidgetMinH != 2 || m.WidgetMaxH != 2 {
			t.Fatalf("bad sugar default: %+v", m)
		}
	})

	t.Run("显式 min/max label 优先于 resize=false", func(t *testing.T) {
		m := ParseDesktopLabels(map[string]string{
			"nimoos.enable": "true", "nimoos.widget.path": "/widget",
			"nimoos.widget.w": "3",
			"nimoos.widget.minw":   "2",
			"nimoos.widget.resize": "false",
		})
		// minw 显式给 2,其余未给的按糖补:maxw=w=3,minh=maxh=2
		if m.WidgetMinW != 2 || m.WidgetMaxW != 3 || m.WidgetMinH != 2 || m.WidgetMaxH != 2 {
			t.Fatalf("explicit label must win: %+v", m)
		}
	})
```

在 `TestApplyDesktopMeta` 的第一个 t.Run 里,给传入 labels 增加 `"nimoos.widget.minw": "3", "nimoos.widget.maxw": "4"`,并把断言扩为(在现有 `app.WidgetH != 2` 后追加):

```go
			app.WidgetMinW != 3 || app.WidgetMaxW != 4 || app.WidgetMinH != 0 || app.WidgetMaxH != 0 {
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-AppManagement && go test ./service/ -run 'TestParseDesktopLabels|TestApplyDesktopMeta' -v`
Expected: 编译错误 `m.WidgetMinW undefined`(字段还不存在)。

- [ ] **Step 3: 最小实现**

`desktop_labels.go` — struct 加字段:

```go
	WidgetW    int // 0 = 未声明或非法,前端夹紧
	WidgetH    int
	// 自定义可调整范围(0 = 未声明 → appgrid 不带该字段,前端用全局 2×1..4×4)
	WidgetMinW int
	WidgetMinH int
	WidgetMaxW int
	WidgetMaxH int
```

`ParseDesktopLabels` 在 `m.WidgetH, _ = strconv.Atoi(...)` 之后追加:

```go
	m.WidgetMinW, _ = strconv.Atoi(labels["nimoos.widget.minw"])
	m.WidgetMinH, _ = strconv.Atoi(labels["nimoos.widget.minh"])
	m.WidgetMaxW, _ = strconv.Atoi(labels["nimoos.widget.maxw"])
	m.WidgetMaxH, _ = strconv.Atoi(labels["nimoos.widget.maxh"])
	// 语法糖:resize=false ≡ min=max=初始 w/h(未声明按前端默认 2×2);显式 min/max label 优先
	if labels["nimoos.widget.resize"] == "false" {
		w0, h0 := m.WidgetW, m.WidgetH
		if w0 <= 0 {
			w0 = 2
		}
		if h0 <= 0 {
			h0 = 2
		}
		if m.WidgetMinW == 0 {
			m.WidgetMinW = w0
		}
		if m.WidgetMaxW == 0 {
			m.WidgetMaxW = w0
		}
		if m.WidgetMinH == 0 {
			m.WidgetMinH = h0
		}
		if m.WidgetMaxH == 0 {
			m.WidgetMaxH = h0
		}
	}
```

`ApplyDesktopMeta` 在 `app.WidgetH = dm.WidgetH` 后追加:

```go
	app.WidgetMinW = dm.WidgetMinW
	app.WidgetMinH = dm.WidgetMinH
	app.WidgetMaxW = dm.WidgetMaxW
	app.WidgetMaxH = dm.WidgetMaxH
```

(此步 `model.MyAppList` 还没有这四个字段——**本步先在 Task 2 的 model 改动之前会编译失败**;因此把 model 字段的添加提前到本步一起做:见 Step 3b。)

- [ ] **Step 3b: model 加字段**(`NimoOS-AppManagement/model/app.go`,`WidgetH` 行后)

```go
	WidgetMinW   int    `json:"widget_minw"`
	WidgetMinH   int    `json:"widget_minh"`
	WidgetMaxW   int    `json:"widget_maxw"`
	WidgetMaxH   int    `json:"widget_maxh"`
```

- [ ] **Step 4: 跑测试确认通过**

Run: `go test ./service/ -run 'TestParseDesktopLabels|TestApplyDesktopMeta' -v`
Expected: PASS(全部子测试)。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-AppManagement
git add service/desktop_labels.go service/desktop_labels_test.go model/app.go
git commit -m "feat(desktop): nimoos.widget.minw/minh/maxw/maxh + resize=false 语法糖解析"
```

---

### Task 2: AppManagement — appgrid 响应带可选范围字段(OpenAPI + adapter)

**Files:**
- Modify: `NimoOS-AppManagement/api/app_management/openapi.yaml:1782-1795`(`WebAppGridItemWidget` schema)
- Regenerate: `NimoOS-AppManagement/codegen/app_management_api.go`(勿手改)
- Modify: `NimoOS-AppManagement/route/v2/internal_web.go:181-193`(compose 适配)与 `:273-279`(容器适配)

**Interfaces:**
- Consumes: Task 1 的 `DesktopLabelMeta.WidgetMinW/MinH/MaxW/MaxH` 与 `model.MyAppList` 同名字段。
- Produces: appgrid JSON `widget` 对象新增可选 `minw/minh/maxw/maxh`(int,label 没写就不出现);oapi-codegen 生成的 Go 字段名为 `Minw/Minh/Maxw/Maxh *int`。前端(Task 3)按这四个 JSON 键名消费。

- [ ] **Step 1: 改 OpenAPI schema**(`openapi.yaml` 的 `WebAppGridItemWidget`,在 `h:` 属性后追加)

```yaml
        minw:
          description: min resizable width in cells; absent = global default 2
          type: integer
          example: 2
        minh:
          description: min resizable height in cells; absent = global default 1
          type: integer
          example: 1
        maxw:
          description: max resizable width in cells; absent = global default 4
          type: integer
          example: 4
        maxh:
          description: max resizable height in cells; absent = global default 4
          type: integer
          example: 4
```

- [ ] **Step 2: 重新生成 codegen**

Run: `cd /home/nimo/NimoTech/NimoOS-AppManagement && go generate ./...`
Expected: 无报错;`git diff codegen/app_management_api.go` 里 `WebAppGridItemWidget` 出现 `Maxh/Maxw/Minh/Minw *int` 带 `json:"...,omitempty"`。
(若 `go generate` 因 MessageBus 生成物缺失报错:先 `cd ../NimoOS-MessageBus && go generate ./...` 再回来重跑。)

- [ ] **Step 3: adapter 带字段**(`route/v2/internal_web.go`)

文件顶部函数区加一个小 helper(放在 `WebAppGridItemAdapterV1` 之前):

```go
// setWidgetRange 只在 label 声明了对应值(>0)时带字段——未声明保持无字段,老桌面忽略。
func setWidgetRange(w *codegen.WebAppGridItemWidget, minw, minh, maxw, maxh int) {
	if minw > 0 {
		w.Minw = utils.Ptr(minw)
	}
	if minh > 0 {
		w.Minh = utils.Ptr(minh)
	}
	if maxw > 0 {
		w.Maxw = utils.Ptr(maxw)
	}
	if maxh > 0 {
		w.Maxh = utils.Ptr(maxh)
	}
}
```

compose 适配处(现 181-189 行)改为:

```go
			if dm := service.ParseDesktopLabels(composeApp.Services[i].Labels); dm != nil {
				item.Desktop = utils.Ptr(true)
				if dm.WidgetPath != "" {
					item.Widget = &codegen.WebAppGridItemWidget{
						Path: dm.WidgetPath,
						W:    utils.Ptr(dm.WidgetW),
						H:    utils.Ptr(dm.WidgetH),
					}
					setWidgetRange(item.Widget, dm.WidgetMinW, dm.WidgetMinH, dm.WidgetMaxW, dm.WidgetMaxH)
				}
			}
```

容器适配处(现 273-279 行)改为:

```go
		if container.WidgetPath != "" {
			item.Widget = &codegen.WebAppGridItemWidget{
				Path: container.WidgetPath,
				W:    utils.Ptr(container.WidgetW),
				H:    utils.Ptr(container.WidgetH),
			}
			setWidgetRange(item.Widget, container.WidgetMinW, container.WidgetMinH, container.WidgetMaxW, container.WidgetMaxH)
		}
```

- [ ] **Step 4: 构建 + 全量测试**

Run: `go build ./... && go test ./...`
Expected: build 通过;测试全绿(该仓库纯 Go,无 CGO)。

- [ ] **Step 5: 提交**

```bash
git add api/app_management/openapi.yaml codegen/app_management_api.go route/v2/internal_web.go
git commit -m "feat(appgrid): widget 对象纯加法可选字段 minw/minh/maxw/maxh"
```

---

### Task 3: NimoOS-Service 共享包 — `AppGridWidget` 类型扩展

**Files:**
- Modify: `NimoOS-Service/src/types.ts:36`(`AppGridWidget`)

**Interfaces:**
- Consumes: Task 2 定义的 JSON 键名 `minw/minh/maxw/maxh`。
- Produces: `export interface AppGridWidget { path: string; w?: number; h?: number; minw?: number; minh?: number; maxw?: number; maxh?: number }` — Task 5/6 的前端代码依赖这些可选字段。

- [ ] **Step 1: 改类型**(`NimoOS-Service/src/types.ts`)

```ts
export interface AppGridWidget {
  path: string; w?: number; h?: number
  // nimoos.widget.minw/... 自定义可调整范围(缺省 = 全局 2×1..4×4)
  minw?: number; minh?: number; maxw?: number; maxh?: number
}
```

- [ ] **Step 2: 构建共享包**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm build`
Expected: 构建成功,无类型错误。

- [ ] **Step 3: 提交**(NimoOS-Service 是独立 git 仓库)

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/types.ts
git commit -m "feat(types): AppGridWidget 可选 minw/minh/maxw/maxh(小组件自定义尺寸范围)"
```

---

### Task 4: New-UI — 基线确认 + 遗留 WIP 单独入库

**Files:**
- Commit(原样保全,不改内容): `src/home/apps/systemApps.ts`、`src/home/components/AppTile.test.ts`、`src/home/components/SearchDialog.vue`、`src/home/stores/apps.ts`(遗留一行)、`src/home/apps/icons/`

本任务不写新代码,目的是:① 确认测试基线是绿的;② 把接手前的遗留 WIP 独立成一笔提交,避免与本特性混淆(后续任务要改 `apps.ts` 同一文件)。

- [ ] **Step 1: 同步共享包链接并跑全量测试**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm install && pnpm test`
Expected: 全绿。若有红:**停下**,把失败清单报告给用户,不要继续(遗留 WIP 状态未知,不能替用户决定丢弃/修复)。

- [ ] **Step 2: 类型检查基线**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 无错误。红则同上,停下报告。

- [ ] **Step 3: 遗留 WIP 单独提交**

```bash
git add src/home/apps/systemApps.ts src/home/apps/icons/ src/home/components/AppTile.test.ts src/home/components/SearchDialog.vue src/home/stores/apps.ts
git commit -m "chore(home): 接手前遗留 WIP 原样入库(系统应用图标 + 搜索面板排序)"
```

Expected: `git status` 干净。

---

### Task 5: New-UI — `appWidgetSize.ts` 纯函数模块(TDD)

**Files:**
- Create: `NimoOS-New-UI/src/home/widgets/appWidgetSize.ts`
- Test: `NimoOS-New-UI/src/home/widgets/appWidgetSize.test.ts`
- Modify: `NimoOS-New-UI/src/home/widgets/registry.ts:36-37`(常量改为 re-export)

**Interfaces:**
- Consumes: `WidgetSize`(`src/home/grid/types.ts`,形如 `{ min: [number, number]; max: [number, number] }`)。
- Produces:
  - `export const APP_WIDGET_SIZE: WidgetSize`(从 registry.ts **移入**本模块,registry re-export 保持旧导入路径可用);
  - `export function appWidgetRange(w?: { minw?: number; minh?: number; maxw?: number; maxh?: number }): WidgetSize` — Task 6 的 `sizeOfItem` 与 Task 7 的 `desktopDecls` 都调它。
- 模块依赖方向(防循环导入,**不得反向**):`appWidgetSize.ts` ← `registry.ts` / `stores/apps.ts`;`registry.ts` ← `stores/apps.ts` 仅单向(registry 导入 store,apps 绝不导入 registry)。

- [ ] **Step 1: 写失败测试**(`src/home/widgets/appWidgetSize.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { APP_WIDGET_SIZE, appWidgetRange } from './appWidgetSize'

describe('appWidgetRange', () => {
  it('未声明/空对象 → 全局范围', () => {
    expect(appWidgetRange(undefined)).toEqual(APP_WIDGET_SIZE)
    expect(appWidgetRange({})).toEqual(APP_WIDGET_SIZE)
  })

  it('部分声明:缺的轴补全局值', () => {
    expect(appWidgetRange({ maxw: 3 })).toEqual({ min: [2, 1], max: [3, 4] })
    expect(appWidgetRange({ minh: 2 })).toEqual({ min: [2, 2], max: [4, 4] })
  })

  it('min==max 锁死(canResize 据此隐藏把手)', () => {
    expect(appWidgetRange({ minw: 3, maxw: 3, minh: 2, maxh: 2 })).toEqual({ min: [3, 2], max: [3, 2] })
  })

  it('越界值夹进全局 2×1..4×4', () => {
    expect(appWidgetRange({ minw: 1, maxw: 9, minh: 0, maxh: 9 })).toEqual({ min: [2, 1], max: [4, 4] })
  })

  it('min > max 时以 min 为准(max 抬到 min)', () => {
    expect(appWidgetRange({ minw: 4, maxw: 2 })).toEqual({ min: [4, 1], max: [4, 4] })
    expect(appWidgetRange({ minh: 3, maxh: 1 })).toEqual({ min: [2, 3], max: [4, 3] })
  })
})
```

说明:`{ minh: 0 }` 与未声明等价(后端 0 = 未声明,且 JSON omitempty 通常根本不带)——`minh: 0` 用例里 h 下限回全局 `1`。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/home/widgets/appWidgetSize.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现**(`src/home/widgets/appWidgetSize.ts`)

```ts
import type { WidgetSize } from '../grid/types'

// 第三方应用 iframe 小组件的全局硬边界(spec §3 夹紧规则)——从 registry.ts 移入
export const APP_WIDGET_SIZE: WidgetSize = { min: [2, 1], max: [4, 4] }

export interface AppWidgetRangeDecl { minw?: number; minh?: number; maxw?: number; maxh?: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** label 声明的自定义可调整范围 → 有效范围:缺省轴补全局值,越界夹进全局,min>max 时 min 说了算。 */
export function appWidgetRange(w?: AppWidgetRangeDecl): WidgetSize {
  if (!w || (!w.minw && !w.minh && !w.maxw && !w.maxh)) return APP_WIDGET_SIZE
  const g = APP_WIDGET_SIZE
  const minw = clamp(w.minw || g.min[0], g.min[0], g.max[0])
  const minh = clamp(w.minh || g.min[1], g.min[1], g.max[1])
  const maxw = Math.max(minw, clamp(w.maxw || g.max[0], g.min[0], g.max[0]))
  const maxh = Math.max(minh, clamp(w.maxh || g.max[1], g.min[1], g.max[1]))
  return { min: [minw, minh], max: [maxw, maxh] }
}
```

`registry.ts`:删掉第 36-37 行的本地定义

```ts
// 第三方应用 iframe 小组件的统一尺寸约束(spec §3 夹紧规则)
export const APP_WIDGET_SIZE: WidgetSize = { min: [2, 1], max: [4, 4] }
```

改为 re-export(旧导入路径 `../widgets/registry` 继续可用):

```ts
export { APP_WIDGET_SIZE } from './appWidgetSize'
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/home/widgets/appWidgetSize.test.ts && pnpm exec vitest run src/home/grid/gridMath.test.ts`
Expected: 两个文件全 PASS(gridMath 现状不受影响)。

- [ ] **Step 5: 提交**

```bash
git add src/home/widgets/appWidgetSize.ts src/home/widgets/appWidgetSize.test.ts src/home/widgets/registry.ts
git commit -m "feat(home): appWidgetRange — label 自定义尺寸范围夹进全局 2×1..4×4"
```

---

### Task 6: New-UI — `sizeOfItem` 按应用自带范围(registry + gridMath 测试)

**Files:**
- Modify: `NimoOS-New-UI/src/home/widgets/registry.ts:39-43`(`sizeOfItem`)
- Test: `NimoOS-New-UI/src/home/grid/gridMath.test.ts:137-145`

**Interfaces:**
- Consumes: Task 5 的 `appWidgetRange`;`useAppsStore().app(key)?.widget`(Task 7 会扩 AppMeta 类型,但 store 数据是运行时透传,本任务的 store 查询已能拿到后端新字段——类型收窄在 Task 7 完成前用现有 `widget` 字段即可,`appWidgetRange` 的参数对多余属性是结构兼容的)。
- Produces: `sizeOfItem({kind:'appwidget', key})` 返回该应用的有效范围;无声明应用行为不变(返回 `APP_WIDGET_SIZE`)。`GridItem.vue` 的 `canResize`(min==max → 隐藏把手)与 `useDragResize` 的 `clampSize` **零改动**直接生效。
- ⚠ 行为变化:`sizeOfItem` 内部会调 `useAppsStore()`,**调用方必须有活跃 pinia**(应用运行时恒真;测试需 `setActivePinia`)。

- [ ] **Step 1: 改失败测试**(`src/home/grid/gridMath.test.ts`)

文件顶部 import 区加:

```ts
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../../home/stores/apps'
```

(按该文件现有相对路径风格调整——它在 `src/home/grid/` 下,store 路径是 `../stores/apps`。)

把现有 137-145 行的用例改为:

```ts
  it('sizeOfItem: appwidget 用 APP_WIDGET_SIZE,widget 用 registry,其余 undefined', () => {
    setActivePinia(createPinia())
    expect(sizeOfItem({ kind: 'appwidget', key: 'any-app' })).toEqual(APP_WIDGET_SIZE)
    expect(sizeOfItem({ kind: 'widget', key: 'clock' })).toEqual({ min: [2, 1], max: [4, 2] })
    expect(sizeOfItem({ kind: 'app', key: 'x' })).toBeUndefined()
  })

  it('sizeOfItem: appwidget 应用自带范围 → 用自带的(夹进全局)', () => {
    setActivePinia(createPinia())
    useAppsStore().setApps([
      { name: 'locked', desktop: true, status: 'running', port: '1',
        widget: { path: '/w', w: 3, h: 2, minw: 3, maxw: 3, minh: 2, maxh: 2 } },
      { name: 'ranged', desktop: true, status: 'running', port: '1',
        widget: { path: '/w', w: 2, h: 1, maxw: 3, maxh: 9 } },
    ])
    expect(sizeOfItem({ kind: 'appwidget', key: 'locked' })).toEqual({ min: [3, 2], max: [3, 2] })
    expect(sizeOfItem({ kind: 'appwidget', key: 'ranged' })).toEqual({ min: [2, 1], max: [3, 4] })
  })
```

同文件 143-145 行的 `clampSize` 用例若直接以 `sizeOfItem` 作 sizeOf 且构造 appwidget item,也需要在该用例开头加 `setActivePinia(createPinia())`(按现状:它复用上面的 `it` 外的 `sizeOfItem`,检查并补上)。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/home/grid/gridMath.test.ts`
Expected: 新用例 FAIL(`locked` 仍返回全局 `{min:[2,1],max:[4,4]}`)。

- [ ] **Step 3: 实现**(`src/home/widgets/registry.ts`)

import 区加:

```ts
import { appWidgetRange } from './appWidgetSize'
import { useAppsStore } from '../stores/apps'
```

`sizeOfItem` 改为:

```ts
export function sizeOfItem(it: { kind: string; key: string }): WidgetSize | undefined {
  // 应用自带范围就用自带的(夹进全局),否则全局 2×1..4×4
  if (it.kind === 'appwidget') return appWidgetRange(useAppsStore().app(it.key)?.widget)
  if (it.kind === 'widget') return widgetSize(it.key)
  return undefined
}
```

- [ ] **Step 4: 跑全量测试确认通过**

Run: `pnpm test`
Expected: 全绿。若其他测试文件因 `sizeOfItem` 的 pinia 依赖变红(如 layout/useAddPanel 相关),在对应测试的 setup 里补 `setActivePinia(createPinia())`——只加 setup,不改断言。

- [ ] **Step 5: 提交**

```bash
git add src/home/widgets/registry.ts src/home/grid/gridMath.test.ts
git commit -m "feat(home): sizeOfItem 支持 appwidget 自带尺寸范围(min==max 自动锁死把手)"
```

---

### Task 7: New-UI — 初始尺寸夹进自定义范围(apps store)

**Files:**
- Modify: `NimoOS-New-UI/src/home/stores/apps.ts:6-19,70-83`
- Test: `NimoOS-New-UI/src/home/stores/apps.test.ts:32-58`

**Interfaces:**
- Consumes: Task 3 的 `AppGridWidget`(含 minw/…)、Task 5 的 `APP_WIDGET_SIZE` / `appWidgetRange`、`WidgetSize` 类型。
- Produces: `clampWidgetDecl(w?: number, h?: number, range: WidgetSize = APP_WIDGET_SIZE): [number, number]` — 第三参可选,**现有两参调用(AddPanel.vue:243)无需改动**(desktopDecls 已把初始值夹进自定义范围,AddPanel 的全局重夹是幂等的);`AppMeta.widget` 类型改为 `AppGridWidget`(透传新字段,`setApps` 第 47 行的 `widget: a.widget` 无需改)。

- [ ] **Step 1: 写失败测试**(`src/home/stores/apps.test.ts`)

`describe('clampWidgetDecl')` 内追加:

```ts
  it('第三参自定义范围:初始尺寸夹进范围', () => {
    expect(clampWidgetDecl(2, 2, { min: [3, 2], max: [4, 4] })).toEqual([3, 2])
    expect(clampWidgetDecl(4, 4, { min: [2, 1], max: [3, 2] })).toEqual([3, 2])
    expect(clampWidgetDecl(undefined, undefined, { min: [3, 3], max: [3, 3] })).toEqual([3, 3])
  })
```

`describe('desktop 应用透传')` 内追加:

```ts
  it('desktopDecls 初始尺寸夹进 label 自定义范围', () => {
    const store = useAppsStore()
    store.setApps([
      { name: 'locked', title: { en_us: 'L' }, status: 'running', port: '1', desktop: true,
        widget: { path: '/w', w: 2, h: 2, minw: 3, maxw: 3, minh: 3, maxh: 3 } },
    ])
    expect(store.desktopDecls()).toEqual([{ key: 'locked', widget: { w: 3, h: 3 } }])
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/home/stores/apps.test.ts`
Expected: 新用例 FAIL(三参签名不存在 → 类型错误,或运行时忽略第三参)。

- [ ] **Step 3: 实现**(`src/home/stores/apps.ts`)

import 区改为:

```ts
import { service, type AppGridItem, type AppGridWidget } from '@nimotech/nimoos-service'
import type { WidgetSize } from '../grid/types'
import { APP_WIDGET_SIZE, appWidgetRange } from '../widgets/appWidgetSize'
```

`clampWidgetDecl` 改为(行为对齐旧版:缺省/非法 → 2,再夹进范围;全局范围下与旧实现逐点等价):

```ts
/** spec §3:初始尺寸夹进有效范围(缺省 = 全局 w 2..4 / h 1..4);非法/缺省 → 2×2 再夹 */
export function clampWidgetDecl(w?: number, h?: number, range: WidgetSize = APP_WIDGET_SIZE): [number, number] {
  const iw = !w || w <= 0 ? 2 : w
  const ih = !h || h <= 0 ? 2 : h
  return [
    Math.max(range.min[0], Math.min(range.max[0], iw)),
    Math.max(range.min[1], Math.min(range.max[1], ih)),
  ]
}
```

`AppMeta.widget` 类型改为:

```ts
  desktop?: boolean; widget?: AppGridWidget
```

`desktopDecls()` 的 map 回调改为:

```ts
      .map((k) => {
        const a = apps.value[k]
        const [w, h] = clampWidgetDecl(a.widget?.w, a.widget?.h, appWidgetRange(a.widget))
        return { key: k, widget: a.widget?.path ? { w, h } : undefined }
      })
```

- [ ] **Step 4: 全量验证**

Run: `pnpm test && pnpm exec vue-tsc --noEmit`
Expected: 测试全绿,类型检查零错误。特别确认旧断言 `clampWidgetDecl(1, 1) → [2, 1]`、`(9,9) → [4,4]`、`(0,-1) → [2,2]` 仍绿(行为兼容)。

- [ ] **Step 5: 提交**

```bash
git add src/home/stores/apps.ts src/home/stores/apps.test.ts
git commit -m "feat(home): 小组件初始尺寸夹进 label 自定义范围"
```

---

### Task 8: 契约文档 — 人类版 label-spec + AI skill 正本 + seed v11

**Files:**
- Modify: `NimoOS-New-UI/docs/nimoos-app-label-spec.md`(§1 表格)
- Modify: `NimoOS-AI/builtin-skills/desktop-app-builder/references/app-contract.md`(label 表,w/h 行之后)
- Modify: `NimoOS-AI/builtin-skills/desktop-app-builder/references/widget-contract.md`("The card resizes" 一节)
- Modify: `NimoOS-AI/service/skills_seed.go:13`(`BuiltinSeedVersion "10"` → `"11"`)

**Interfaces:**
- Consumes: Task 1-7 落地的最终行为(全局夹紧、min 优先、糖的优先级)。
- Produces: 文档与实现一致;seed v11 触发设备端 skill 重播种。

- [ ] **Step 1: 人类版 spec 表格加三行**(`NimoOS-New-UI/docs/nimoos-app-label-spec.md` §1 表,`nimoos.widget.h` 行后)

```md
| `nimoos.widget.minw` / `nimoos.widget.minh` | 否 | 全局下限 `2` / `1` | 小组件可调整的最小宽/高(格子数),夹紧进全局 `2..4` / `1..4`。四个范围 label 都不写 = 现状(全局范围内可调) |
| `nimoos.widget.maxw` / `nimoos.widget.maxh` | 否 | 全局上限 `4` / `4` | 小组件可调整的最大宽/高(格子数),同样夹紧进全局范围;min > max 时以 min 为准。**min == max 时尺寸锁死,桌面编辑模式自动隐藏该组件的调整把手**;初始 `w`/`h` 也会被夹进这个范围 |
| `nimoos.widget.resize` | 否 | 可调整 | 写字符串 `"false"` ≡ `min=max=初始 w/h`(尺寸锁死语法糖,`w`/`h` 未声明按默认 `2×2` 锁死);显式 min/max label 优先于本糖 |
```

- [ ] **Step 2: AI 版 app-contract.md label 表加三行**(`nimoos.widget.h` 行后,英文,风格对齐现有行)

```md
| `nimoos.widget.minw` / `nimoos.widget.minh` | MAY | integer string | global `2` / `1` | min resizable width/height in grid cells, clamped into the global 2..4 / 1..4 range. Omit all four range labels = today's behavior (freely resizable within the global range) |
| `nimoos.widget.maxw` / `nimoos.widget.maxh` | MAY | integer string | global `4` / `4` | max resizable width/height in grid cells, clamped the same way; if min > max, min wins. **min == max locks the size — the desktop hides the resize handle**. The initial `w`/`h` is clamped into this range too |
| `nimoos.widget.resize` | MAY | `"false"` | resizable | sugar for `min=max=initial w/h` (locks the size; defaults to 2×2 when `w`/`h` are omitted). Explicit min/max labels take precedence |
```

- [ ] **Step 3: widget-contract.md 尺寸一节补充**(在 `### The card resizes — the page MUST be written responsive` 一节的开头段后加一段)

```md
Exception — fixed-size widgets: declare `nimoos.widget.resize: "false"` (or
`minw`/`minh`/`maxw`/`maxh` with min == max) to lock the card size. A locked
widget never resizes, so the responsive rules below relax to just "look right
at the one locked size". Prefer a locked size only when the layout genuinely
cannot flex (e.g. a fixed board); otherwise stay responsive — users like
resizing. Partial ranges work too: e.g. `nimoos.widget.maxh: "2"` keeps the
widget short while width stays flexible.
```

- [ ] **Step 4: seed 版本升 11**(`NimoOS-AI/service/skills_seed.go`)

```go
const BuiltinSeedVersion = "11"
```

- [ ] **Step 5: 构建验证 + 分仓提交**

Run: `cd /home/nimo/NimoTech/NimoOS-AI && CGO_ENABLED=1 go build ./...`
Expected: 编译通过。

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add docs/nimoos-app-label-spec.md
git commit -m "docs(spec): nimoos.widget.minw/maxw/resize 尺寸范围 label"

cd /home/nimo/NimoTech/NimoOS-AI
git add builtin-skills/desktop-app-builder/references/app-contract.md builtin-skills/desktop-app-builder/references/widget-contract.md service/skills_seed.go
git commit -m "feat(skills): desktop-app-builder 补小组件尺寸范围契约,seed v11"
```

---

### Task 9: 部署 + 真机验收(按发布顺序)

**Files:** 无代码改动;跑 `nimo_os_docs/scripts/deploy.sh`、New-UI `./scripts/deploy.sh`、sudo docker。

**Interfaces:**
- Consumes: Task 1-8 全部提交;验收工具见 handoff(todo-widget :18001 源码 `/DATA/AppData/todo-widget/`;Playwright 配方)。
- Produces: 三条验收结论(锁死无把手 / 范围内可拖 / 无 label 不变)。

- [ ] **Step 1: 部署 AppManagement**

Run: `bash /home/nimo/NimoTech/nimo_os_docs/scripts/deploy.sh app-management`
Expected: build + systemd 重启成功。`journalctl -u nimoos-app-management.service -n 20 --no-pager` 无 panic。

- [ ] **Step 2: 给 todo-widget 贴新 label 重建(锁死用例)**

先看现有容器配置,再以相同镜像/端口重建加 label(docker 需 sudo):

```bash
sudo docker inspect todo-widget --format '{{.Config.Image}} {{json .HostConfig.PortBindings}} {{json .Config.Labels}}'
sudo docker rm -f todo-widget
# 按 inspect 结果补齐原有 -p/-v 参数,在原 label 基础上追加:
sudo docker run -d --name todo-widget -p 18001:80 \
  --label nimoos.enable=true --label nimoos.title=Todo --label nimoos.port=18001 \
  --label nimoos.widget.path=/widget/ --label nimoos.widget.w=4 --label nimoos.widget.h=4 \
  --label nimoos.widget.resize=false \
  <inspect 得到的镜像名>
```

- [ ] **Step 3: 验证 appgrid 响应带新字段**(裸信封 `{data,message}`,无 success 字段)

Run: `curl -s http://127.0.0.1:80/v2/app_management/web/appgrid | jq '.data[] | select(.name=="todo-widget") | .widget'`
Expected: `{"path":"/widget/","w":4,"h":4,"minw":4,"minh":4,"maxw":4,"maxh":4}`。

- [ ] **Step 4: 部署 New-UI 与 AI**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && ./scripts/deploy.sh
bash /home/nimo/NimoTech/nimo_os_docs/scripts/deploy.sh ai
cat /var/lib/nimoos/ai/skills/builtin/.version   # Expected: 11
```

- [ ] **Step 5: 桌面无头验收(Playwright)**

复用/重建 handoff 里的脚本配方(chromium 二进制 `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`;playwright-core 从 `~/.npm/_npx/361ceb562f3b3235/node_modules/playwright-core/index.mjs` import;localStorage 预置 `access_token`/`refresh_token`/`version`/`lang`;路由拦截剥 Authorization 头,`/v1/(ai|photos)/` 与 `users/refresh` 喂 `{"success":200}` 空响应),脚本放本会话 scratchpad。验收三点:

1. **锁死**:todo-widget(resize=false)上桌后进入编辑模式,其 grid item 内 **无** `.resize-handle` 元素;
2. **范围**:给 `nimoos-demo-widget`(:18080,label path `/widget/?v=2`)重建加 `--label nimoos.widget.maxw=3 --label nimoos.widget.maxh=2`,编辑模式拖把手,断言最终 span ≤ 3×2(检查 `style.gridColumn/gridRow` 的 span);
3. **回归**:不带范围 label 的应用小组件仍可在 2×1..4×4 内调整,把手存在。

Expected: 三点全过。任一不过 → 用 superpowers:systematic-debugging 排查,不许跳过。

- [ ] **Step 6: 收尾报告**

向用户用人话讲清(用户是初学者,按记忆约定给因果链):贴什么 label → 桌面上小组件表现什么行为;并列出已部署的三个服务与提交清单。

---

## Self-Review(已执行)

- **Spec 覆盖**:四 label 解析(T1)、appgrid 纯加法字段+缺省不带(T2)、类型透传(T3)、范围生效+把手自动隐藏(T5/6)、初始尺寸夹紧(T7)、全局 2×1..4×4 夹紧(T5)、resize=false 糖(T1)、文档+seed v11(T8)、发布顺序+验收三点(T9)。✓
- **占位符扫描**:所有代码步骤均含完整代码;T9 Step 2 的镜像名来自前一命令 inspect 输出,属运行时取值非占位。✓
- **类型一致性**:Go `WidgetMinW/...`(T1↔T2)、JSON `minw/...`(T2↔T3)、TS `AppGridWidget.minw?`(T3↔T6/7)、`appWidgetRange`/`APP_WIDGET_SIZE`(T5↔T6/7)命名逐点核对一致。✓
- **循环导入**:appWidgetSize(无依赖)← registry ← —;appWidgetSize ← apps;registry → stores/apps 单向,apps 不导入 registry。✓
