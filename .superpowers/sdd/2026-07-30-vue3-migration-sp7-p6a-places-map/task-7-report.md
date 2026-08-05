# Task 7 报告 —— `usePlacesView.ts`(地图视图变换与手势 composable)

## 实现了什么(11 条约束逐条对应代码位置)

文件:`src/photos/composables/usePlacesView.ts`

1. **`svgPoint` letterbox 换算**(Vue2 :564-576)→ 代码 :69-81。`fit = min(w/MAP_W, h/MAP_H) || 1`,`ox/oy` 居中偏移,`svg` 为 null 返回 `(MAP_W/2, MAP_H/2)`。
2. **`applyZoom` 定点缩放**(Vue2 :585-594)→ 代码 :111-120。先 `stopViewAnim()`;`clamped===old` 时 early return(不产生新对象);`wx=(vbX-tx)/old` 反算世界点,新 `tx=vbX-wx*clamped`。
3. **`animateView` easeOutCubic**(Vue2 :605-620)→ 代码 :123-138。`ease=t=>1-(1-t)**3`,`duration=420`,`k=min(1,(now-t0)/duration)`,rAF 驱动,`k<1` 续帧否则 `raf=null`。起手 `stopViewAnim()`。
4. **`stopViewAnim`**(Vue2 :597-602)→ 代码 :103-108。`onWheel`(:181-186)与 `onPointerDown`(:189-198)开头都调用它。
5. **`visibleCenterVb`**(Vue2 :578-583)→ 代码 :95-100。`panelFrac=(rect && hasDetailPanel()) ? min(0.55, 420/rect.width) : 0`,分支已建齐并单测(P6a 恒 false 场景 + 用 stub 覆盖 true 场景)。
6. **`centerOn`**(Vue2 :622-626)→ 代码 :141-145。走 `animateView`,不瞬移。
7. **`autoPanTo`**(Vue2 :724-735 `autoPan`)→ 代码 :167-172。**必须从传入 `place` 取 lon/lat**,空值直返;`scale=max(view.scale,1.8)`。
8. **`zoomToCluster(pin, currentScale)`**(Vue2 :661-664)→ 代码 :175-178。`next=max(currentScale+0.01, splitScaleFor(pin.members??[], currentScale))`,+0.01 保留。
9. **拖拽**(Vue2 :701-723)→ 代码 :189-221。`onPointerDown` 命中 `.geo-pin` 直返;记录 `{x,y,tx,ty,s:screenToVbScale()}`;`setPointerCapture`。`onPointerMove` 用 `tx+(clientX-x)*s`。`onPointerUp` 清 `drag` + `releasePointerCapture` 包 try/catch。
10. **`onWheel`**(Vue2 :635-639)→ 代码 :181-186。`preventDefault()` + `factor=deltaY<0?1.18:1/1.18` + 以指针 viewBox 点为锚 `applyZoom`。注册(`{passive:false}`)留给 T11,本任务不做。
11. **`dispose()`**(Vue2 beforeDestroy :359-361)→ 代码 :224-226。只 `stopViewAnim()`,不摘 pointer capture。

`screenToVbScale`(Vue2 :693-699,代码 :84-91)、`zoomBy`/`setScale`/`reset`(Vue2 :627-634、:561 `handleReset`,代码 :147-162)、`zoomFrac`(接口新增派生量,`(scale-1)/(MAX_SCALE-1)`,代码 :62)均按接口实现。

## 回源核对结果

逐条核对 `NimoOS-UI/src/views/Photos/PhotosPlacesView.vue:561-735` 与 brief 的行号/魔数——**本次全部吻合,没有发现出入**(这是七个任务里第一次全对):
- 行号::561 handleReset、:564-576 svgPoint、:578-583 visibleCenterVb、:585-594 applyZoom、:597-602 stopViewAnim、:605-620 animateView、:622-626 centerOn、:627-630 zoomBy、:631-634 setScale、:635-639 onWheel、:644-660 splitScaleFor(T2 已消化)、:661-664 zoomToCluster、:693-699 screenToVbScale、:701-723 拖拽三件套、:724-735 autoPan —— 全部逐行核对无误。
- 魔数:`1.18`(onWheel factor)、`420`(duration 默认值)、`easeOutCubic = 1-(1-t)**3`、`+0.01`(zoomToCluster)、`1.8`(autoPan 最小 scale)、`420`/`0.55`(visibleCenterVb 的 panelFrac)—— 全部与源码一致。
- `9/scale`、`1.04`、`22` 步是 T2 `splitScaleFor` 内部的常量,本任务只消费,未改动、未需要重新核对(T2 报告应已核过)。

## 测试期望值手算过程

- **letterbox**:mockSvg(1200,400) → `fit=min(1200/1000,400/500)=min(1.2,0.8)=0.8`;`ox=(1200-1000*0.8)/2=(1200-800)/2=200`;`oy=(400-500*0.8)/2=0`。点 `(200,0)→((200-0-200)/0.8,(0-0-0)/0.8)=(0,0)`。点 `(1000,400)→((1000-200)/0.8,(400-0)/0.8)=(1000,500)`。
- **定点缩放不变量**:不用固定数字反填,改为断言恒等式 `(vbX-tx)/scale` 在 `applyZoom` 前后相等,4 组随机 `(scale, anchor, start)` 反复验。
- **zoomFrac**:`MAX_SCALE=16`(核对 `util/placesMap.ts:34`)。`scale=1→(1-1)/15=0`;`scale=16→15/15=1`;`scale=8.5→7.5/15=0.5`。
- **visibleCenterVb**:wrap 宽 1000、hasDetailPanel=true → `panelFrac=min(0.55,420/1000)=min(0.55,0.42)=0.42`,`x=1000*(1-0.42)/2=290`。wrap 宽 500 → `panelFrac=min(0.55,420/500)=min(0.55,0.84)=0.55`(钳制生效),`x=1000*0.45/2=225`。
- **animateView 中途值**:`start.scale=1,target.scale=5`,`t=210ms/420ms=0.5`,`ease(0.5)=1-(0.5)^3=0.875`(不是 0.5——特意选半程验证不是线性),`scale=1+4*0.875=4.5`,`tx=0+100*0.875=87.5`,`ty=0+200*0.875=175`。
- **autoPanTo**:`place.lon=-90,lat=45`→`project(-90,45)={x:((-90+180)/360)*1000=250, y:((90-45)/180)*500=125}`。`visibleCenterVb()={x:500,y:250}`(hasDetailPanel=false),`scale=max(1,1.8)=1.8`,`tx=500-250*1.8=50`,`ty=250-125*1.8=25`。
- **centerOn**:`centerOn(100,50,3)`,可见中心 `{500,250}`,`tx=500-100*3=200`,`ty=250-50*3=100`。
- **拖拽增量**:mockSvg(1200,400)(与 letterbox 用例同一 fit=0.8)→`screenToVbScale()=1/0.8=1.25`。`clientX` 100px 位移 → `tx` 增量 `=100*1.25=125`。
- **onWheel 反缩放**:复用定点不变量断言(不手算具体数值,断言换算前后世界坐标相等 + `scale*1.18`/`scale/1.18`)。

## 测了什么与结果

`src/photos/composables/__tests__/usePlacesView.test.ts`,30 条用例,全绿:
- svgPoint letterbox × 3(两个真实点 + null 兜底)
- applyZoom 定点不变量(4 组)/ 钳制 / 引用不变
- zoomFrac × 1(三点)
- visibleCenterVb × 4(false / true+1000 / true+500 钳制 / wrapEl=null)
- animateView × 4(起点/精确中途/终点 + 超 duration 不外插 + 期间被 applyZoom 取消 + 连续两次调用互相取消)
- centerOn/zoomBy/setScale/reset × 2
- autoPanTo × 3(正常/null-undefined/scale 下限两档)
- zoomToCluster × 4(共点/可裂/mock 隔离验证 +0.01/自然 MAX_SCALE 场景)
- onWheel × 1(放大缩小+preventDefault+锚点不变量)
- 拖拽 × 4(down→move/no-op/geo-pin 排除/releasePointerCapture 异常)
- dispose × 1

## TDD 证据

1. RED:先写好 30 条测试,`usePlacesView.ts` 不存在,`pnpm exec vitest run` 报 `Failed to resolve import "../usePlacesView"`。
2. GREEN:实现后一次跑通,30/30 通过(未经调试反填——除下面 zoomToCluster 一处按数学分析主动新增了一条 mock 测试外,其余全部一次写对)。
3. 全量:`pnpm exec vitest run` → 275 files / 2401 tests 全绿(基线 274 files / 2371 tests,净增 1 file / 30 tests,没有弄红任何既有测试)。
4. `pnpm exec vue-tsc --noEmit` → 无输出,类型检查通过。

## 9 处删码验证逐条结果

方法:每次改动前 `cp` 一份干净版本到 scratchpad,改一处、跑测试、记录、`cp` 还原、diff 确认还原干净,再进下一处。

| # | 删的是什么 | 结果 |
|---|---|---|
| ① | `svgPoint` 去掉 `ox`/`oy` | 2 条 letterbox 用例变红(`expected 250 to be close to 0` 等) |
| ② | `applyZoom` 删 `clamped===old` early return | 「对象引用不变」用例变红(`toBe` 失败,值相同但引用不同) |
| ③ | `applyZoom` 定点换算改成只改 scale | 定点不变量 + onWheel 锚点用例变红 |
| ④ | `animateView` 开头 `stopViewAnim()` 删掉 | **只有专门新增的「连续两次 animateView」用例变红**,「期间调 applyZoom」那条依旧绿(见下方"自查发现") |
| ⑤ | `autoPanTo` 空值守卫删掉 | 抛 `TypeError: Cannot read properties of null`,「传 null 不变」用例变红 |
| ⑥ | `zoomToCluster` 的 `+0.01` 删掉 | **自然场景(共点簇+MAX_SCALE)测试依旧绿,数学上不可辨**;专门加的 `spyOn(splitScaleFor)` 隔离测试变红(见下方"自查发现") |
| ⑦ | `onPointerDown` 的 `.geo-pin` 排除删掉 | 图钉拖拽用例变红(`setPointerCapture` 被意外调用) |
| ⑧ | `onPointerMove` 的 `if (!drag) return` 删掉 | 3 条用例同时变红(no-op / geo-pin / onPointerUp 后 move),报 `Cannot destructure property 'x' of 'drag' as it is null` |
| ⑨ | `ease` 换成线性 `t=>t` | 中途值用例变红(`expected 3 to be close to 4.5`,因为提前用了精确 easeOutCubic 值,不是宽松的"在区间内"断言) |

9 处全部验证完毕后 `diff` 确认文件与最初实现逐字节一致,已还原。

## 自查发现(两处提前发现问题并主动修正测试设计)

1. **④ 的陷阱**:brief 要求删除 `animateView` 开头的 `stopViewAnim()` 要让"在途动画被取消"测试变红,但 brief Step1 列出的那条"animateView 期间调 applyZoom → 在途动画被取消"其实测的是 **`applyZoom` 自己的 `stopViewAnim()` 调用**(constraint 2 那句),不是 `animateView` 自己的。两处是不同代码行,删 `animateView` 开头那句不会让"经 applyZoom"的测试变红——实测验证了这一点(该测试删除后依旧绿)。所以额外补了一条「连续两次调用 `animateView`(不经 `applyZoom`)」的测试,专门盯住这一行,实测确认能抓住。

2. **⑥ 的陷阱**(数学分析,已用真实删码验证坐实):`zoomToCluster` 的 `next` 最终会喂给 `centerOn` 内部自己的 `Math.max(1, Math.min(MAX_SCALE, scale))` 钳制。当 currentScale 恰好是 `MAX_SCALE` 时,无论加不加 `+0.01`(`16.01` vs `16`),`centerOn` 都会把它钳回 `16`,**最终 `view.scale` 完全相同,自然场景下删掉 `+0.01` 观察不到任何差异**。删码验证也证实了这个推导:「已在 MAX_SCALE、共点簇(自然场景)」那条测试删掉 `+0.01` 后依旧全绿。为了让删码验证真正抓住这一行,补了一条用 `vi.spyOn(placesMapModule, 'splitScaleFor')` 把返回值钉死在 `currentScale` 本身(模拟"裂解阈值恰好等于当前缩放"的边界)、且 `currentScale < MAX_SCALE`(这样 `+0.01` 不会被 `MAX_SCALE` 钳制吞掉)的隔离测试,实测确认删掉 `+0.01` 会让它变红(`10` vs 期望 `10.01`)。这是遵照"若某变异没让预期测试变红,不要迁就,设计一条真能抓住它的测试"的指示主动补的,而不是削弱断言让测试"看起来"覆盖到。

3. brief 给的 Vue2 行号/魔数本次全部核对无误——七个任务里第一次没有发现偏差,已在报告"回源核对结果"一节明确写出核对过的每一处,不是漏查。

## 改动的文件

- `src/photos/composables/usePlacesView.ts`(新建,232 行)
- `src/photos/composables/__tests__/usePlacesView.test.ts`(新建,30 个用例)

## 顾虑

- `zoomToCluster` 里 `pin.members ?? []` 的空数组兜底:`Pin.members` 是可选字段(T2 接口),`splitScaleFor` 签名要求 `Place[]`(非 optional),但函数内部已处理 `!members || length<2` → `MAX_SCALE`,所以传空数组行为等价、不会抛错。这不是偏离,只是为了满足 TypeScript 严格模式的类型收窄写法,已在提交前用 `vue-tsc --noEmit` 确认无类型错误。
- T11(容器/挂载层)后续需要:把 `onWheel` 用 `addEventListener('wheel', handler, { passive: false })` 显式注册(不能用 `@wheel` 模板绑定),并在 `onUnmounted` 里调用 `dispose()`。本任务按 brief 要求没有做这部分接线,只保证 handler 本身正确并调用了 `preventDefault`。
