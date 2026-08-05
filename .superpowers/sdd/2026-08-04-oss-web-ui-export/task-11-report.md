# Task 11 报告:AddPanel 去照片 tab

## 做了什么

- `cp src/home/components/AddPanel.vue oss/files/AddPanel.vue`(519 行,私有侧未改动)
- 在拷贝里删四处 + 洗白一处注释,489 行
- `oss/manifest.mjs` REPLACE 表加第 3 条,`privateSha256` 钉住私有侧当前内容的 sha256
- `oss/tree.test.mjs` 追加 `describe('类 2 · AddPanel 去照片 tab')`,4 例

## 四处删除的执行与验证

1. **`<template>` 104–116 Photo tab 整块** —— `<div v-if="ap.curTab.value === 'photo'" class="lib-content lib-photo-grid">…</div>`,含 `photosStore.assets`/`photosStore.thumbnailUrl` 两处引用与内层 `addPanelNoPhotos` 键。已删,只留 Reset button 之前直接衔接 Folder tab 的 `</div>`。
2. **`<script setup>` 218/131 行 `usePhotosStore`** —— `const photosStore = usePhotosStore()` 与 `import { usePhotosStore } from '../stores/photos'` 两行均删。
3. **225 行 tab 定义** —— `{ key: 'photo', label: 'addPanelTabPhoto' },` 一行删,`TABS` 数组只剩 widget/app/folder 三项。
4. **`<style>` 484–496 `.lib-photo-*`** —— `/* ── Photo grid ── */` 分节标题 + `.lib-photo-grid` / `.lib-photo-thumb` / `.lib-photo-thumb:hover` / `.lib-photo-thumb img` 四条规则整段删。

## 注释洗白(原文 → 改后)

原文(私有侧 409 行附近,`.lib-app-ic` 规则内):
```
  /* background comes from the bound .ic-* class (global): vivid gradient for
     system apps (ic-files/ic-photos/…), neutral glass (.ic-app) for container apps */
```
改后(oss/files/AddPanel.vue):
```
  /* background comes from the bound .ic-* class (global): vivid gradient for
     system apps (e.g. ic-files), neutral glass (.ic-app) for container apps */
```
只去掉具名的 `ic-photos`,保留原意(系统应用用彩色渐变、容器应用用中性玻璃),`ic-files` 仍在(Files 应用未被剔除)。

## 死 import 与悬空引用的逐个 grep 证据

```
$ grep -n "usePhotosStore\|photosStore\|lib-photo\|addPanelTabPhoto\|addPanelNoPhotos\|'photo'" oss/files/AddPanel.vue
(无输出 —— 零残留)
```

`<script setup>` 里剩余每个 import 的出现次数(1 次 import 行本身 + ≥1 次使用,证明无死 import):
```
computed: 5   onMounted: 2   watch: 2        useI18n: 2
useAddPanel: 3   useHomeUiStore: 2   useAppsStore: 2   clampWidgetDecl: 2
useFoldersStore: 2   useLiveStatsStore: 2   WIDGETS: 2   Kind: 2
```
全部 ≥2,说明每个 import 都还有真实使用点。

跨文件依赖链(导出树里核验,非私有 `src/**`——私有侧本身在其它任务的 PATCH/DELETE 表里处理):
```
$ node oss/export.mjs --out /tmp/t11-tree --skip-guard --no-commit --allow-dirty-oss
[oss] 3/6 应用清单(DELETE 21 · REPLACE 3 · PATCH 99)   # REPLACE 从 2 → 3,本任务条目生效
[oss] 完成 → /tmp/t11-tree

$ grep -n "curTab\|photo" /tmp/t11-tree/src/home/composables/useAddPanel.ts
13: const curTab = ref<'widget' | 'app' | 'folder'>('widget')   # T6 已去 photo,闭合
$ ls /tmp/t11-tree/src/home/stores/photos.ts
No such file or directory                                       # DELETE 表已整体删除
$ grep -n "addPanelTabPhoto\|addPanelNoPhotos" /tmp/t11-tree/src/i18n/*.ts
(无输出)                                                          # T8 已清 i18n 键
$ grep -rn "usePhotosStore\|photosStore\b" /tmp/t11-tree/src/
(无输出)
```
四条依赖链全部闭合,导出树里无悬空引用。

## CSS 选择器集合差集(原文件 vs 新文件)

```
REMOVED selectors (4):
  - .lib-photo-grid
  - .lib-photo-thumb
  - .lib-photo-thumb:hover
  - .lib-photo-thumb img
ADDED selectors (0):
```
恰好是要删的 4 条,无其它规则被误伤。反向核查(模板类名 ↔ 样式选择器双向):新文件里模板出现的每个静态/动态 class(`lib-panel`/`lib-tabs`/`lib-tab`/`active`/`lib-content`/`lib-card*`/`lib-used-badge`/`lib-app-grid`/`lib-icon`/`is-stopped`/`lib-app-ic`/`has-img`/`lib-app-label`/`lib-breadcrumb`/`lib-bc-seg`/`lib-bc-back`/`lib-folder-row`/`lib-folder-name`/`lib-pin-btn`/`lib-empty`/`lib-footer`/`lib-reset-btn`)在 `<style>` 里都有对应规则;`<style>` 里的选择器也都有模板类名消费(机械脚本额外抓到的 `fs-pin`/`reset-btn`/`stopped` 等噪声,来自注释文字"like .fs-pin"/"like .reset-btn"/"同 AppTile.stopped"提及的*其它组件*的类名,不是本文件的孤儿选择器,且这些注释在原文件里就存在,不属本次改动范围)。

## 三个 tab 完好的证据

```
$ grep -n "key: 'widget'\|key: 'app'\|key: 'folder'" oss/files/AddPanel.vue
207:  { key: 'widget', label: 'addPanelTabWidget' },
208:  { key: 'app',    label: 'addPanelTabApp' },
209:  { key: 'folder', label: 'addPanelTabFolder' },
```
三个 tab 各自的模板块(widget 卡片网格 + app-widget 卡片、app 应用网格、folder 磁盘/面包屑/子文件夹列表)、`onSpawnDown` 拖拽生成逻辑、尺寸计算相关代码(`targetCellAt`/`spawnStart`/`ap.spawnPlace`/`ap.pinToFree`/`ap.toggleWidget`)全部原样保留,未触碰。

## 最终行数

- 私有侧 `src/home/components/AddPanel.vue`:519 行(未改动)
- `oss/files/AddPanel.vue`:489 行

## 测试输出

```
$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  45 passed (45)   # 41 原有 + 4 新增
```

```
$ node oss/export.mjs --out /tmp/t11-tree --skip-guard --no-commit --allow-dirty-oss
[oss] 6/6 落盘
[oss] 完成 → /tmp/t11-tree
```
(未按 brief Step 5 的 `pnpm install && vue-tsc --noEmit` 继续跑 —— 铁律③明确本任务不许碰产出树的编译/运行,README=T12 与测试同步=T13 未做,产出树此刻编译不过是预期状态,眼验统一挪到 T15。)

## 哈希钉负向验证(隔离临时目录,未碰本仓 src/**)

直接 `import('./oss/apply.mjs')` 在系统临时目录里模拟"私有侧改动 → 哈希不符":
```
Scenario A (hash matches): OK, replaced without error.
Scenario B (drifted): correctly threw -> 私有仓的 AddPanel.vue 变了(sha256 af1f24df5d67… ≠ 钉住的 948b9dcae47c…)。
```
证实哈希钉在私有侧漂移时会准确 exit(抛错),该临时目录已清理,本仓 `src/**` 全程未改动。

另:按 brief 提醒确认了 `export.mjs` 的执行顺序——`checkClean` 先于 `git archive HEAD`,因此"改私有侧文件后看哈希钉报错"这条负向验证若直接在本仓走一遍,会先撞 `checkClean` 而非哈希比对;这也是选择用 `oss/apply.mjs` 隔离临时目录验证而非改本仓文件的原因。

## 自查结论

- 四处删除全部完成,零残留(grep 证据见上)。
- 死 import 逐个核实:6 个 script import 全部仍被使用。
- CSS 选择器差集:仅减少 4 条 `.lib-photo-*`,无误伤、无新增。
- 三个 tab(widget/app/folder)完整保留,包括各自渲染、拖拽生成、尺寸计算。
- 跨文件依赖链(useAddPanel.ts curTab 类型、photos.ts 整体删除、i18n 两键)在导出树里逐一验证闭合。
- 提交后 `git status --porcelain` 只剩 3 行既有 `design-export/*` 删除态,未误触其它文件。
- `oss/tree.test.mjs` 45 例全绿(41 + 4 新增)。

## 遗留疑问

无。T12(README)/T13(测试同步)/T14(泄漏守卫)按计划留给后续任务。

---

## 追加:评审 Important 修复(内部编号泄漏)

评审指出 `oss/files/` 下两处冻结分身注释暴露内部开发状态,一并修复(同类 2 处,一次处理完):

### 两处改后的注释原文

`oss/files/AddPanel.vue:219`(改前 → 改后):
```diff
- // App-declared widgets (Task 5/9: desktop apps with a `widget` decl) — listed
+ // App-declared widgets: desktop apps with a `widget` decl — listed
```
去掉内部任务追踪编号 `(Task 5/9: …)`,保留功能性描述不变。

`oss/files/MediaViewer.vue:165`(改前 → 改后,T10 那一轮漏抓,本次一并补):
```diff
- // 封面 + 标题/艺术家(Vue2 mm.fetchFromUrl)——元数据失败不阻断播放。
+ // 封面 + 标题/艺术家(mm.fetchFromUrl)——元数据失败不阻断播放。
```
去掉 `Vue2` 字样(会暴露"存在一个旧版本"),保留"用 mm.fetchFromUrl 取封面 / 元数据失败不阻断播放"的信息价值。

两处均只改注释文字,未动任何代码;`oss/manifest.mjs` 未改(`git diff oss/manifest.mjs` 输出为空),两个 `privateSha256` 原值未动 —— 哈希钉钉的是私有侧内容,冻结分身自己改注释不影响它。

### 固定清单复扫(全部 `oss/files/`)

```
$ grep -rnE 'Task [0-9]|SP[0-9]|sp[789]|spec §|本期|做样子|Vue2|NimoOS-UI' oss/files/ && echo "FOUND" || echo "0 matches — clean"
0 matches — clean
```
`oss/files/` 目录当前含 `AddPanel.vue`、`MediaViewer.vue`、`defaultLayout.ts` 三个冻结分身,固定清单扫描全部为 0。

### 顺带固定为守卫断言

`oss/tree.test.mjs` 新增 `describe('类 2 · 冻结分身注释不泄露内部开发状态')`:导入 `manifest.mjs` 的 `REPLACE` 表,对表里**每一条**冻结分身(而不只是这两个文件名)在导出树里跑同一份固定清单正则,以后新增 REPLACE 条目会自动被这条断言守住,不必再为个别文件单开一次任务。

### 测试输出(尾部)

```
$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  46 passed (46)   # 45 原有(T11 基线)+ 1 新增守卫
```

### git 状态

```
$ git status --porcelain
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
```
提交后只剩既有的 3 行 `design-export/*` 删除态,未误触其它文件。commit:`294fb3b`(`fix(oss): 冻结分身注释洗白内部编号 + 补固定清单守卫`)。
