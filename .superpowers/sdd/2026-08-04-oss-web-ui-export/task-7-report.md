# Task 7 报告 —— 类 3 补丁:设置侧 + Service 侧 + 注释洗白 + `.gitignore`

## 做了什么

只改了 `oss/manifest.mjs`(`PATCH` 追加 22 条、`SERVICE_PATCH` 从空填到 4 条、`DELETE` 追加 1 条)
和 `oss/tree.test.mjs`(追加 1 个 describe 块 10 例 + 2 处已有断言里插入新检查项)。未碰
`src/**`、`../NimoOS-Service/**` 或 `oss/` 下其它文件。

### Step 1-2:先写失败断言,跑红

按 brief 原样写了 6 例到 `oss/tree.test.mjs`,`pnpm exec vitest run oss/tree.test.mjs -t '设置与 Service'`
確認全红(6/6 fail,`find` 命中的锚点在 PATCH/SERVICE_PATCH 里当时都是空)。

### Step 3:设置侧 PATCH(brief 给的 8 条逐字核对后落地,另加 1 条 brief 没给的)

brief 的 8 条锚点逐条在私有侧文件里跑过命中计数(`text.split(find).length-1`),全部**恰好 1 次**才写进
manifest:

| 文件 | 锚点摘要 | 命中次数 |
|---|---|---|
| `src/settings/util/tabs.ts` | `SETTINGS_TABS` 去掉 `'folder-permissions',` 那一行 | 1 |
| 同上 | `RAIL_TABS` 注释+切片 7→6 | 1 |
| 同上 | `TAB_LABEL_KEY` 里的 `folder-permissions` 项 | 1 |
| 同上 | `railTabsFor(role)` 整个函数体 → 恒等函数 | 1 |
| `src/settings/panels/index.ts` | `import FolderPermissionsPanel...` | 1 |
| 同上 | `PANEL_BY_TAB` 里的 `folder-permissions` 项 | 1 |
| `src/settings/util/systemConfig.ts` | `search_switch?: boolean` 接口字段 | 1 |
| 同上 | `search_switch: true,` 默认值 | 1 |

**Step2 之后自己发现的第 9 条(brief 未给)**:跑完上面 8 条再跑测试,`设置 tab 从 9 降到 8…` 这条断言
仍然红——`tabs.ts` 文件头部的映射注释(`//   - visibleTabs (L1034)    —— 非 admin 过滤掉
folder-permissions`)也点了名,断言要求"全无 folder-permissions",这条死文档没被 brief 的锚点摘到。
现场 `sed -n '1,7p' src/settings/util/tabs.ts` 取原文,验证 1 次命中后加了一条 PATCH,把这行连同上一行
"7 项" 的具体计数一起改写成不点名任何具体 tab 的泛化描述,不改变其余行号映射注释。改完重跑,27 例全绿。
这正是 brief 提醒的"先跑测试确认失败"这一步真正抓出的一个问题,没有它这条断言会一直红。

### Step 4:`SERVICE_PATCH`(相对 `packages/service/`,验证读的是 `../NimoOS-Service/src/...`)

| 文件 | 锚点 | 命中次数 |
|---|---|---|
| `src/index.ts` | `import { createPhotos } from './photos.js'\n` | 1 |
| 同上 | `PhotoAsset, `(类型导出列表里的一项) | 1 |
| 同上 | `get photos()` 整块(`sed -n '48,50p'` 现场取,3 行) | 1 |
| `src/types.ts` | `export interface PhotoAsset { ... }` 整行 | 1 |
| 同上(保留面) | `UserFolderPermission` 接口存在 | 是(未删) |

### Step 5:`railTabsFor` 调用处

```
grep -rn "railTabsFor(" src --include=*.vue --include=*.ts | grep -v "util/tabs"
```
输出唯一一条:`src/settings/components/SettingsShell.vue:41`(`tabs.test.ts` 因为路径含
`util/tabs` 被这条 grep 自身排除,不算漏检)。已加 PATCH,把
```
const railTabs = computed(() =>
  railTabsFor(typeof user.value.role === 'string' ? user.value.role : undefined),
)
```
改成
```
const railTabs = computed(() => railTabsFor())
```
命中 1 次(多行锚点用 node 现场核对整段字符串)。`user` 变量在文件里还有其它使用点(`userName`/`initial`
的 computed),改完不会变成死变量。

### Step 6-7:跑测试、提交

见下方"测试输出"与"commit"。

---

## 4 个尾巴

### 尾巴1:HomeTopbar.vue 死代码

`grep -n "homeUi" src/home/components/HomeTopbar.vue` 确认改前有 4 处:模板里的搜索按钮
(T6 已删)、`import { useHomeUiStore }`、`const homeUi = ...`、⌘K 监听里的 `homeUi.openSearch()`
(T6 已删)。T6 的 3 条 PATCH 删掉搜索按钮 DOM 和整个 `onKey`/`onMounted`/`onUnmounted` 块后,
只剩 import 与 const 声明两行无消费方。加了 2 条 PATCH 各删 1 行,命中各 1 次。产出树里 `grep homeUi`
零命中(实跑验证见下方 export 探针)。同时在 `oss/tree.test.mjs` 补了一条
`T7 尾巴1:HomeTopbar 不再引用 homeUi` 断言。

### 尾巴2:`installedApps.ts` 注释洗白

原文 `src/apps/stores/installedApps.ts:50-51` 两行注释点名"AI agent / Photos ML"。改成
"供其他应用使用的内部服务容器"(与 brief 里 `systemApp.ts` 的洗白措辞保持一致的说法)。加了断言
`installedApps.ts 的注释不再点名 AI agent / Photos ML`。**没有碰它的孪生测试
`installedApps.test.ts:56`**——那是 T13 的地盘,按要求跳过。

### 尾巴3:`AppsPanel.vue:152-153` 注释洗白

原文提"待相册区迁移完成后启用"+"数据源是**相册**的 IndexedDB 上传队列…SP7 尚未迁"。改成不提相册、
不提迁移分期计划的措辞:"该功能依赖的后端能力尚未提供"+"数据源是本地 IndexedDB 上传队列(与文件区
上传队列是两套独立实现,见下一行)"——第三行(`⚠️ 别拿 src/files/upload/idb.ts 顶…`)本来就没提相册,
未改动。加了断言确认整份文件不再含"相册"或"SP7"(`grep` 核实过改前这两个词在全文件里只出现在这两行)。

### 尾巴4:`isAssetId.ts` 加入 `DELETE`

`grep -rln "isAssetId" src --include=*.ts --include=*.vue` 私有侧当前(未应用任何 patch 前)命中 4 个
文件:`PhotoTile.vue`(已在 DELETE)、`layout.ts`(T6 的 PATCH 会删掉唯一消费点 `bindPhotos` 与
对应 import)、`isAssetId.ts` 自身、**以及 `src/home/stores/photos.test.ts`**。

**这里我要更正交接指令里的一个不准确表述**:指令写"`photos.test.ts`(已在 DELETE)",但我实际
`grep -n "photos.test.ts" oss/manifest.mjs` 核实后发现——`DELETE` 数组里只有 **Service 侧**的
`src/photos.test.ts`(在 `SERVICE_DELETE`),**New-UI 侧的 `src/home/stores/photos.test.ts` 并不在
任何删除表里**,它被 manifest 里的注释明确标记为"测试同步:整体删除的 9 个(T13 填齐)"之一,还没到
它被删的任务。

也就是说,把 `isAssetId.ts` 加进 `DELETE` 之后,**当前(T7 结束到 T13 开始之前)的产出树里会有一个
真实的悬空引用**:`src/home/stores/photos.test.ts:4` 的 `import { isAssetId } from '../util/isAssetId'`
和它 `describe('layout.bindPhotos', ...)` 里对已被 T6 删除的 `bindPhotos` 方法的调用,都会指向不存在
的东西。已用 `--skip-guard --no-commit` 探针实跑确认这份文件确实原样保留在产出树里(见下方"证据"),
且它的悬空程度和这条流水线里其它已知的、留给后续任务收尾的不一致(例如 `tabs.test.ts` 现在也还在
用旧的 `railTabsFor(role)` 签名调用,同样要等 T13)是同一类问题,不是我引入的新缺陷。

**判断与处理**:仍然按指令把 `isAssetId.ts` 加进 `DELETE`(它对于最终产出树而言确实是零消费方孤儿,
一旦 T13 按计划删掉 `photos.test.ts` 就完全兑现),但**没有**擅自去动 `photos.test.ts`——那是明确写在
manifest 注释里的 T13 范围,不属于本任务的"尾巴"。这一点在下面的"疑虑"里再提一次,提醒 T13 执行时
它已经不需要再额外处理 `isAssetId.ts` 这个文件本身(T7 已经删了),只需要删测试文件即可。

---

## `.gitignore`(重点 A)

按用户拍板:删掉"Claude Code 本地状态"两行(`.claude/`、`.superpowers/`,连中文注释一起)、
"时间机器验收测试台(T12)"两行(`scripts/tmlab/`、`vite.config.tmlab.ts`,连中文注释一起),
把第二处替换成"# 导出报告(含上游 commit hash),仅供本地追溯" + 独立一行 `.export-report.txt`。

两条锚点在私有侧 `.gitignore` 里跑过 `text.split(find).length-1`,均为 **1 次**。

**实跑验证 E9 的"独立一行"断言 + export.mjs 自身的 exit-1 断言**:

```
$ node oss/export.mjs --out /tmp/t7-commit-probe --skip-guard --allow-dirty-oss
[oss] 1/6 前置检查
[oss]   New-UI 7d0c2386 · Service 7e84566b
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 21 · REPLACE 0 · PATCH 58)
[oss] 4/6 内嵌共享包
[oss] 5/6 泄漏守卫 —— 已用 --skip-guard 跳过(仅开发期允许,未扫描任何文件)
[oss] 6/6 落盘
[oss] 完成 → /tmp/t7-commit-probe
```
没有 `--no-commit`,退出码 0(没有抛出"产出树 .gitignore 不含 .export-report.txt"的错误)。
`cd /tmp/t7-commit-probe && git log --oneline -1` → `07b485c NimoOS Web UI`,`git status --porcelain`
干净。跑完 `rm -rf /tmp/t7-commit-probe`。在此之前(补丁写完前先跑过一次同样命令),同一条命令是
exit 1 的(旧 `.gitignore` 没有 `.export-report.txt` 这一行),这个对照没有留存日志,但流程符合 brief
描述的"此前一直是 exit 1"。

`oss/tree.test.mjs` 里 E9 那条断言也补了一行 `expect(g.split('\n')).toContain('.export-report.txt')`,
比 brief 原文的 `toContain` 子串匹配更严格地保证是"独立一整行"而不是被拼进别的内容里。

---

## 测试输出(`oss/tree.test.mjs`,`--reporter=verbose`)

```
 ✓ oss/tree.test.mjs > 类 1 · 整体删除 > oss/ 自己不在产物里
 ✓ oss/tree.test.mjs > 类 1 · 整体删除 > AI/相册/搜索的组件与 store 全没了
 ✓ oss/tree.test.mjs > 类 1 · 整体删除 > 保留面还在
 ✓ oss/tree.test.mjs > 类 1 · 整体删除 > 文档与 AI 辅助开发痕迹整体不导出(E7/E8)
 ✓ oss/tree.test.mjs > 内嵌共享包 > Service 落到 packages/service/,package.json 的 file: 指过去
 ✓ oss/tree.test.mjs > 内嵌共享包 > lockfile 里不再有 ../NimoOS-Service 路径
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > 系统应用清单只剩 5 个,photos/ai 的 import 与 glyph 都没了
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > Dock 默认收藏 = files/storage/vm/appstore
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > SYS_ROUTE 指内部路由,cutoverDisabled 恒 false,sendToAI 整个没了
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > Kind 联合类型去掉 'photo'
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > 小组件注册表与 WidgetCard 不再有 ai
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > GridItem / MobileHome 不再引用 PhotoTile
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > layout store 去掉 bindPhotos,homeUi 去掉 search 四项
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > 顶栏没有搜索胶囊与 ⌘K 监听,Home.vue 不挂 SearchDialog
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > AddPanel 的 tab 联合类型与尺寸表去掉 photo
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > 复审修复:顶栏 ≤720px 注释不再提"搜索",且没有死 import
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > 复审修复:layout.ts 不再 import isAssetId
 ✓ oss/tree.test.mjs > 类 3 · 桌面侧补丁 > T7 尾巴1:HomeTopbar 不再引用 homeUi(...)
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > 设置 tab 从 9 降到 8,rail 从 7 降到 6,folder-permissions 全无
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > railTabsFor 退化为恒等(不再按 admin 过滤)
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > SettingsShell.vue 的唯一调用处跟着改签名,不再传 role 实参
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > E2:systemConfig 不再有 search_switch
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > E13:Service 不再导出 photos / PhotoAsset
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > 注释洗白:两处不再点名 AI agent / Photos ML / photos_data
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > T7 尾巴2:installedApps.ts 的注释不再点名 AI agent / Photos ML
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > T7 尾巴3:AppsPanel.vue 的注释不再提相册区迁移计划
 ✓ oss/tree.test.mjs > 类 3 · 设置与 Service 侧补丁 > E9:.gitignore 洗掉 4 行,加 .export-report.txt

 Test Files  1 passed (1)
      Tests  27 passed (27)
```
17 例(T1-T6.5 已有)+ 10 例(本任务新增:brief 的 6 例 + 尾巴1/2/3 各 1 例 + `SettingsShell.vue` 1 例)
= 27,全绿,verbose reporter 无隐藏 `[Vue warn]`。

## `node oss/export.mjs --out /tmp/t7-tree --skip-guard --no-commit --allow-dirty-oss` 产出树抽查

- `.gitignore`:4 行已删,`.export-report.txt` 独立一行,已贴在上文。
- `src/settings/util/tabs.ts`:8 项 tab、`RAIL_TABS.slice(0, 6)`、`railTabsFor()` 无参,已贴在上文。
- `src/home/components/HomeTopbar.vue`:`homeUi` 零命中,已贴在上文。
- `src/settings/panels/AppsPanel.vue` / `src/apps/stores/installedApps.ts` / `src/apps/util/systemApp.ts` /
  `src/settings/util/appPaths.ts` / `src/settings/components/SettingsShell.vue`:均已贴在上文,措辞符合预期。
- `packages/service/src/index.ts`:`createPhotos`/`PhotoAsset`/`get photos()` 全部消失(逐行核对过 import
  列表与惰性域对象),`packages/service/src/types.ts` 里 `PhotoAsset` 零命中。
- `src/home/util/isAssetId.ts` 不存在;`src/home/stores/photos.test.ts` **仍然存在且仍 import 它**
  (上面"尾巴4"一节已详细说明,这是留给 T13 的已知缺口,不是本任务引入的新问题)。

## 自查结论

- 22 条新 `PATCH` + 4 条新 `SERVICE_PATCH` + 1 条新 `DELETE`,每条锚点改动前都用
  `text.split(find).length-1` 在私有侧文件里验证过恰好命中 1 次(含 2 条多行锚点,均用 node 现场取
  原文而非凭记忆重写)。
- brief 给的 6 例失败断言、chinese-leaks.md T7 一节列出的两条(AppsPanel.vue:152-153)、4 个尾巴,
  全部处理并各自补了一条对应断言。
- `.gitignore` 的独立一行断言 + `export.mjs` 的真实 commit 探针都实跑通过,探针目录已清理。
- Service 侧改动只落在 `SERVICE_PATCH`(相对 `packages/service/`),验证读的是
  `../NimoOS-Service/src/index.ts` 与 `../NimoOS-Service/src/types.ts`,`../NimoOS-Service` 本身
  `git status --porcelain` 干净,没有被误改。
- `git status --porcelain` 除本任务改的 2 个文件外只剩 3 行既有的 `design-export/*` 删除态(不属本任务)。
- 未跑 `pnpm test` 全量、未对产出树跑 `pnpm install`/`vue-tsc`/`pnpm build`,遵照指令。

## 遗留疑问 / 超出 brief+交接清单范围的发现

1. **`tabs.ts` 头部映射注释也点名了 folder-permissions**(brief 未给这条锚点),已自行发现并修补,
   详见 Step 3 小节。这是"先写断言再实现"这套流程真正抓出的一处遗漏,不是我凭空加的检查。
2. **交接指令里"`photos.test.ts`(已在 DELETE)"这句表述不准确**:New-UI 侧的
   `src/home/stores/photos.test.ts` 目前不在任何 DELETE/SERVICE_DELETE 表里,是显式留给 T13 的
   "整体删除的 9 个"孤儿测试之一。我按指令把 `isAssetId.ts` 加进了 `DELETE`(这个动作本身没错,它
   对最终产出树而言确实是孤儿),但**没有**顺手删除 `photos.test.ts`——那需要跨到 T13 的授权范围。
   T13 执行时请注意:`photos.test.ts` 要删的是整份文件(包含 `isAssetId` 测试与 `layout.bindPhotos`
   测试两个 `describe` 块),不是局部改写;且不需要再单独处理 `isAssetId.ts` 这个源文件,T7 已经
   在 DELETE 表里处理了。
3. **设置区的非测试文件没有发现 brief + 交接清单之外的新残留**——实跑
   `grep -rln "AI agent\|相册\|search_switch\|Photos ML\|photos_data" src/settings` 命中 5 个文件:
   `appPaths.ts`/`systemConfig.ts`/`AppsPanel.vue`(本任务已处理)+ `AppsPanel.test.ts`/`appPaths.test.ts`
   两个测试文件。`AppsPanel.test.ts:114/119` 已经在 chinese-leaks.md 里明确记为 T13 范围(断言文案要
   跟着尾巴3 的洗白改)。**`appPaths.test.ts:28/51` 没有出现在 chinese-leaks.md 清单里,是我在收尾自查
   时才发现的**——它的 fixture 用 `photos_data` 当 mock key 名、注释也写"后端给了 4 个 key(含
   photos_data)"。这是真实后端字段名的测试数据,不算"AI/相册/搜索功能存在过"这个级别的语义泄漏,
   但确实点名了 `photos_data` 字符串;按铁律测试文件归 T13,这里只记录、不修改,留给 T13 与
   `AppsPanel.test.ts` 一起处理(两处的措辞都要和 `appPaths.ts` 洗白后的版本对齐)。
