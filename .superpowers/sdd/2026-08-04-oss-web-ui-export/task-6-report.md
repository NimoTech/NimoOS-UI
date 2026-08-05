# Task 6 报告 —— 类 3 补丁:桌面(home)侧 11 处(实际 40 条 PATCH 条目,含复审补丁)

---

## 复审后追加(2026-08-04,第二轮)

评审判 Needs fixes,3 条 Important,全部落在本任务已有编辑权的文件里(`HomeTopbar.vue` ×2、`layout.ts` ×1),本轮已修完。评审对机制部分(37 条锚点全量模拟、9 例真断言、`{ key: '` 计数)判"扎实",对两处已披露残留(HomeTopbar 死 import / isAssetId 孤儿)的自我定位也认可;这轮只是补三个漏洞。

### 三条修了什么

1. **`HomeTopbar.vue` 中文注释静默泄漏**(评审最关心的一条):`≤720px` 媒体查询上方的注释原文 `保留搜索与主题切换`,在搜索胶囊按钮被删掉之后仍然声称手机端"保留搜索"——`oss/forbidden.mjs` 的中文词表里没有"搜索"这个词(评审顺带指出全库中文词表覆盖率很低:「搜索」8 文件/「照片」7/「转录」4/「说话人」4,命中全部为 0,但这个词表本身的修补是另一个任务,不动 `forbidden.mjs`)。新增 1 条 PATCH:`find: '保留搜索与主题切换', replace: '保留主题切换'`。
2. **`HomeTopbar.vue` 死 import**:`import { onMounted, onUnmounted } from 'vue'` 在删掉 `onKey`/两行注册调用后失去唯一消费点。新增 1 条 PATCH 整行删除。删除前用 `grep -n "onMounted\|onUnmounted" src/home/components/HomeTopbar.vue` 核实私有侧全文件只有 3 处命中(import 行 + 已被既有 PATCH 删除的两行调用),没有第四处遗漏。
3. **`layout.ts` 死 import**:`import { isAssetId } from '../util/isAssetId'` 在 `bindPhotos` 函数体被删除后失去唯一消费点。新增 1 条 PATCH 整行删除。`isAssetId.ts` 文件本身按评审要求继续不碰,归 DELETE 表处理。

### ① 3 条新锚点的命中次数验证

用同一套 `node -e` + `text.split(find).length - 1` 方法(脚本:`/tmp/.../scratchpad/verify-anchors-2.mjs`),对私有侧当前状态(即 Task 6 第一轮提交后的 `master` 工作树,含 37 条 PATCH 尚未应用的原始源码)逐条验证:

```
OK (1x) src/home/components/HomeTopbar.vue :: "import { onMounted, onUnmounted } from 'vue'\n"
OK (1x) src/home/components/HomeTopbar.vue :: "保留搜索与主题切换"
OK (1x) src/home/stores/layout.ts :: "import { isAssetId } from '../util/isAssetId'\n"

ALL UNIQUE
```

### ② `HomeTopbar.vue` 里 `onMounted`/`onUnmounted` 无其它使用点的 grep 证据

```
$ grep -n "onMounted\|onUnmounted" src/home/components/HomeTopbar.vue
16:import { onMounted, onUnmounted } from 'vue'
30:onMounted(() => window.addEventListener('keydown', onKey))
31:onUnmounted(() => window.removeEventListener('keydown', onKey))
```

只有 3 处:import 行本身,以及第一轮已有 PATCH 会删除的两行注册/反注册调用。确认没有第四处遗漏消费点,删掉 import 不会引入编译错误(该文件其余部分完全不用这两个 API)。

### ③ 产出树抽查(实跑一次 export 后 grep 验证)

```
$ node oss/export.mjs --out <tmp> --skip-guard --no-commit --allow-dirty-oss
[oss] 3/6 应用清单(DELETE 20 · REPLACE 0 · PATCH 40)   ← 37 + 3 = 40,与预期一致
[oss] 完成 → <tmp>

$ cat -n <tmp>/src/home/components/HomeTopbar.vue   # 41 行,末尾媒体查询上方注释:
41: /* ≤720px 手机启动器为只读:隐藏添加/编辑入口(排序增删在桌面做),保留主题切换 */

$ grep -n "搜索\|onMounted\|onUnmounted" <tmp>/src/home/components/HomeTopbar.vue
(no matches — clean)

$ sed -n '1,10p' <tmp>/src/home/stores/layout.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LayoutItem, PlanEntry, Dims } from '../grid/types'
import { DEFAULT } from '../grid/defaultLayout'
import { WIDGETS, sizeOfItem } from '../widgets/registry'
import { applyPlan as applyPlanPure, clampToGrid, firstFree, fits, clampSize } from '../grid/gridMath'
import { service } from '@nimotech/nimoos-service'
import type { DesktopAppDecl } from './apps'
                                                      ← isAssetId import 已不在

$ grep -n "isAssetId" <tmp>/src/home/stores/layout.ts
(no matches — clean)
```

三处均确认:注释不再提"搜索"、两条死 import 都已从产出树消失。

### ④ `pnpm exec vitest run oss/tree.test.mjs` 完整输出尾部

新增两个断言(`复审修复:顶栏 ≤720px 注释不再提"搜索",且没有死 import` / `复审修复:layout.ts 不再 import isAssetId`),原有 15 例保持不变：

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI


 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  03:40:26
   Duration  793ms (transform 118ms, setup 191ms, import 25ms, tests 247ms, environment 225ms)
```

17/17 全绿(15 旧 + 2 新)。

### 自查结论(第二轮)

- 只改了 `oss/manifest.mjs` 与 `oss/tree.test.mjs`,未碰 `src/**`、`oss/forbidden.mjs`、`oss/apply.mjs`、`oss/export.mjs`。
- `isAssetId.ts` 文件本身未删除,继续留给 DELETE 表所在的任务处理。
- 提交后 `git status --porcelain` 只剩 3 行 `design-export` 的 ` D`(见下方 commit 记录)。

---

## 第一轮报告(原文保留)

## 做了什么

1. **Step 1**:在 `oss/tree.test.mjs` 末尾追加 `describe('类 3 · 桌面侧补丁', ...)`,9 个 `it`,逐字照抄 brief。
2. **Step 2**:`pnpm exec vitest run oss/tree.test.mjs` → 9 例全红(6 个既有例通过,新 9 例失败),符合预期。
3. **Step 3+4**:往 `oss/manifest.mjs` 的 `PATCH` 数组追加了 **37 条**条目(brief 给的骨架是 11 组注释块,但逐条计数是 37 条 `{find, replace}`,因为 systemApps/useOpenAction/GridItem/MobileHome/homeUi/HomeTopbar/Home.vue 等文件本来就不是一组一条)。
4. **Step 5**:`pnpm exec vitest run oss/tree.test.mjs` → 15/15 全绿(6 旧 + 9 新)。
5. **Step 6**:见下方 commit。

## 每条锚点的唯一性验证

写了一个校验脚本(`/tmp/.../scratchpad/verify-anchors.mjs`,读私有侧源文件、`text.split(find).length - 1` 计数),对全部 **36 个不同的 find 字符串**(37 条 PATCH 里 useOpenAction 的 SYS_ROUTE 块与 cutoverDisabled 块虽是两条独立 patch 但 find 各自不同,故不同 find 值共 36 个,MobileHome 5 条里有一条 find 值与另一条重复图案但位置不同——实际每条都单独验证)逐条跑,输出：

```
OK (1x) src/home/apps/systemApps.ts :: import iconPhotos...
OK (1x) src/home/apps/systemApps.ts :: photos: '<rect...
OK (1x) src/home/apps/systemApps.ts :: ai: '<path d="M12 3.5c...
OK (1x) src/home/apps/systemApps.ts :: { key: 'photos'...
OK (1x) src/home/composables/useDock.ts :: const DEFAULT_FAV...
OK (1x) src/home/composables/useOpenAction.ts :: (SYS_ROUTE 块)
OK (1x) src/home/composables/useOpenAction.ts :: (cutoverDisabled 块)
OK (1x) src/home/composables/useOpenAction.ts :: (appstore/storage/window.location.href 块)
OK (1x) src/home/composables/useOpenAction.ts :: (photo/ai openItem + sendToAI 块)
OK (1x) src/home/grid/types.ts :: export type Kind...
OK (1x) src/home/widgets/registry.ts :: ai: '<path...
OK (1x) src/home/widgets/registry.ts :: ai: { title: 'widgetAiTitle'...
OK (1x) src/home/components/widgets/WidgetCard.vue :: import AiWidget...
OK (1x) src/home/components/widgets/WidgetCard.vue :: ai: AiWidget,
OK (1x) src/home/components/GridItem.vue :: <PhotoTile v-else-if...
OK (1x) src/home/components/GridItem.vue :: import PhotoTile...
OK (1x) src/home/components/GridItem.vue :: if (props.item.kind === 'app'...photo...
OK (1x) src/home/components/MobileHome.vue :: class="m-tile"...
OK (1x) src/home/components/MobileHome.vue :: <PhotoTile v-else...
OK (1x) src/home/components/MobileHome.vue :: import PhotoTile...
OK (1x) src/home/components/MobileHome.vue :: const tiles = computed...
OK (1x) src/home/components/MobileHome.vue :: .m-photo { grid-column...
OK (1x) src/home/stores/layout.ts :: , bindPhotos,
OK (1x) src/home/stores/homeUi.ts :: // Global search palette...
OK (1x) src/home/stores/homeUi.ts :: function setSearch...
OK (1x) src/home/stores/homeUi.ts :: return { editing, searchOpen...
OK (1x) src/home/composables/useAddPanel.ts :: const curTab = ref<...photo...
OK (1x) src/home/composables/useAddPanel.ts :: if (kind === 'photo') return [2, 2]
OK (1x) src/home/stores/layout.ts :: function bindPhotos(ids...)... (自己补的函数体锚点)
OK (1x) src/home/components/HomeTopbar.vue :: <button class="bar-btn search-btn"...(自己补)
OK (1x) src/home/components/HomeTopbar.vue :: ⌘K onKey 监听块(自己补)
OK (1x) src/home/components/HomeTopbar.vue :: .search-btn 样式块(自己补)
OK (1x) src/views/Home.vue :: <SearchDialog />(自己补)
OK (1x) src/views/Home.vue :: import SearchDialog...(自己补)
OK (1x) src/views/Home.vue :: import { usePhotosStore }...(自己补)
OK (1x) src/views/Home.vue :: const photos = usePhotosStore()(自己补)
OK (1x) src/views/Home.vue :: photos.loadAssets()...bindPhotos(...)(自己补)

ALL UNIQUE
```

全部 1x 命中,无一漏检、无一重复。

补充验证:实际跑了一次 `node oss/export.mjs --out <tmp> --skip-guard --no-commit --allow-dirty-oss`,日志打印 `应用清单(DELETE 20 · REPLACE 0 · PATCH 37)`,`apply.mjs` 的"命中次数必须恰好 1 次"硬校验全部通过(0 次或 ≥2 次会直接 exit 1,没有报错即证明每条都命中且仅命中一次)。产出树里抽查了 `useOpenAction.ts`、`layout.ts`、`HomeTopbar.vue`、`views/Home.vue` 四个文件的实际内容,确认改写符合预期(见下方"自查结论")。

## 相对 brief 的偏离及理由

1. **`layout.ts` 的 `bindPhotos` 函数体**(brief 明确指出的缺口,第 87-97 行):brief 只给了 `, bindPhotos,` 这一条摘掉 return 里的导出名。我按 brief 提示用 `sed -n '85,95p'` 现场取出整段函数体(含函数签名、循环体、闭合花括号、以及函数后的空行)作为独立 PATCH 条目,`replace: ''`。取出范围严格止于 `bindPhotos` 自身,前一个函数 `clampAll` 与后一个函数 `save` 均未被吞入(已用 `cat -n` 核对行号边界)。

2. **`HomeTopbar.vue` 三处多行锚点**(brief 未给逐字文本,只给了 `sed` 提示):
   - 搜索胶囊按钮整块(模板里 4 行 `<button class="bar-btn search-btn">...</button>`)。
   - `⌘K`/`Ctrl+K` 监听(注释 + `onKey` 函数体 + `onMounted`/`onUnmounted` 两行注册/反注册调用)。
   - `.search-btn` 三行样式(含前导注释,后跟一个空行,一并删除以避免产生连续两个空行)。
   均现场 `cat -n` 取原文,逐字照抄进 `find`。

   **发现的残留(超出 brief 清单,未修复)**:移除 `onKey` 后,`import { onMounted, onUnmounted } from 'vue'` 变成死代码(该文件唯一用途就是挂 `onKey`)。这不是 AI/photos/search 语义泄漏(forbidden.mjs 的禁词表不会命中一个通用的 vue 生命周期钩子名),纯粹是"删完逻辑但没清进口"的死代码。brief 的 3 个 sed 提示位置没有覆盖这一行,我判断这不在 T6 的授权范围内(仅授权 11 组/37 条锚点 + 你要求补的那一条),没有顺手加第 38 条去删它。留给后续任务(测试同步/T13 或 T14 泄漏守卫收尾时)决定是否要清。

3. **`views/Home.vue` 四处**(brief 未给逐字文本,只给了 4 个 `sed` 提示位置,实际拆成 5 条 PATCH,因为两个 import 不相邻不能合并成一条锚点):
   - `<SearchDialog />` 挂载行。
   - `import SearchDialog from '.../SearchDialog.vue'`(独立一条)。
   - `import { usePhotosStore } from '.../stores/photos'`(独立一条,与上一条中间隔着 `StartAppDialog`/`useLayoutStore`/`useAppsStore` 三个 import,不能合并)。
   - `const photos = usePhotosStore()`。
   - `onMounted` 里 `photos.loadAssets().then(() => layout.bindPhotos(...)).catch(...)` 整行 + 其前导空行(一并删除避免留双空行)。

   **发现的残留(超出 brief 清单,未修复)**:`src/home/util/isAssetId.ts` 在私有侧有两个消费方——`PhotoTile.vue`(在 `DELETE` 表里,整体删除)和 `layout.ts` 的 `bindPhotos`(本任务删除)。两者都没了之后,`isAssetId.ts` 变成零消费方的孤儿文件,且 `layout.ts` 顶部 `import { isAssetId } from '../util/isAssetId'` 也变成死 import。已用 `grep -rn isAssetId src/` 核实过,私有侧全仓库只有这两个消费方 + 定义文件本身。这属于**类 1(整体删除)**范畴,不是类 3 补丁,而 `DELETE` 表是 T5 已经锁定交付的产物;是否要把 `src/home/util/isAssetId.ts` 补进 `DELETE` 属于跨任务决策,我没有擅自改 `DELETE` 表(T6 的铁律只授权改 `PATCH`),记在这里留给后续任务处理。

   这两处死代码(HomeTopbar 的 `onMounted`/`onUnmounted` 死 import、layout.ts 的 `isAssetId` 死 import + 孤儿工具文件)**不影响本任务的 9 个新增断言**,也不会被现有 `forbidden.mjs` 的禁词表命中(都是通用符号名,不含 photo/ai 字面量),纯属"引用清理"层面的干净度问题,不是功能残留或语义泄漏。

## 测试实际输出

Step 2(补丁填入前)：
```
Test Files  1 failed (1)
     Tests  9 failed | 6 passed (15)
```

Step 5(补丁填入后)：
```
 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  03:26:37
   Duration  716ms
```

另跑了一次独立的 `node oss/export.mjs --out <tmp> --skip-guard --no-commit --allow-dirty-oss`,确认：
- `apply.mjs` 未对任何一条 PATCH 报错(0 次/≥2 次命中都会 exit 1,没报错即证明全部恰好 1 次)。
- 日志:`应用清单(DELETE 20 · REPLACE 0 · PATCH 37)`。
- 抽查产出树 `useOpenAction.ts`/`layout.ts`/`HomeTopbar.vue`/`views/Home.vue` 内容与预期一致(SYS_ROUTE 只剩 vm/settings、cutoverDisabled 恒 false、sendToAI 消失、bindPhotos 函数体与导出都没了、⌘K 监听没了、SearchDialog 挂载与两个 import 都没了)。

## 自查结论

- 37 条 PATCH 全部通过唯一性校验(1x 命中),`oss/tree.test.mjs` 15/15 全绿。
- 只改了 `oss/manifest.mjs` 与 `oss/tree.test.mjs` 两个文件(`git status` 已核对)。
- 未改 `export.mjs`/`apply.mjs`/`forbidden.mjs`。
- 未做设置区/i18n/theme.css/整文件替换/测试同步(T7-T13 的活)。
- 未在 `NimoOS-Web` 建仓。

## 遗留疑问 / 发现的额外残留(供后续任务参考)

1. `src/home/components/HomeTopbar.vue`:移除 `⌘K` 监听后,`import { onMounted, onUnmounted } from 'vue'` 成为死代码(仅这一处用途)。未修复(超出本任务授权范围)。
2. `src/home/util/isAssetId.ts`:`bindPhotos`(本任务删除)与 `PhotoTile.vue`(T5 已在 `DELETE` 表整体删除)是私有侧仅有的两个消费方,二者都没了之后这个文件变成孤儿(零消费方),`layout.ts` 顶部对它的 `import` 也变成死 import。是否要把它并入 `DELETE` 表,建议由负责 T5/DELETE 表收尾或 T14(泄漏守卫收零)的任务决定——本任务未擅自扩权改 `DELETE`。
3. 跑了 `grep -rn "photo" src/home/ --include="*.ts" --include="*.vue"`(私有侧,补丁前)核对 home 区还有哪些"photo"命中点,确认命中全部落在三类里,没有第四类"brief 漏管":
   - **本任务(T6)负责且已清除**的文件:`systemApps.ts`、`GridItem.vue`、`MobileHome.vue`、`useDock.ts`、`useOpenAction.ts`、`layout.ts`、`useAddPanel.ts`(composable,只管 `curTab` 类型与 `defaultSize` 分支)。
   - **T5 已整体删除**的文件:`PhotoTile.vue`、`src/home/stores/photos.ts`、`SearchDialog.vue`。
   - **明确划给后续任务、非本任务遗漏**:`src/home/grid/defaultLayout.ts`(默认布局里still有 `kind: 'photo'` 的磁贴项——这是 **T9「类2替换:桌面默认布局重排」**的活)、`src/home/components/AddPanel.vue`(照片 tab 的 UI 与缩略图网格——这是 **T11「类2替换:AddPanel 去照片 tab」**的活;注意这是组件文件,和本任务负责的 `useAddPanel.ts` composable 是两个不同文件)。
   - 另跑了 `Ai\b|Ai[A-Z]|[a-z]Ai\b` 的粗筛,在 `src/home/` 下**零命中**(排除 `.test.ts`)。
   结论:home 区目前的残留分布与 15 个任务清单的分工完全对得上,没有发现 brief 或任务清单漏掉的 AI/相册/搜索功能性残留。上述"遗留疑问 1/2"两条纯粹是"清理逻辑后忘记清 import/孤儿文件"级别的死代码,不是功能残留。
