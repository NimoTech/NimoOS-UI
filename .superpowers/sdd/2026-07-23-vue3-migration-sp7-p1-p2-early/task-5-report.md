# Task 5 报告 — `PhotoImageViewer.vue`(静图缩放/平移/旋转 + OCR 覆盖层)

> 注:本文件此前保存的是另一轮任务编号下的旧报告(相册壳 PhotosSidebar/Photos.vue/路由,
> commit `7d1b164`,P1 阶段)。当前 SP7-P2 的 Task 5 是"PhotoImageViewer.vue"这一独立任务,
> 按本次任务简报要求整篇覆盖重写。旧报告对应的工作仍在仓库历史里(`7d1b164`),未受影响。

## 状态:完成(GREEN)

commit: `41c691b feat(photos): 灯箱静图查看器(缩放/平移/旋转骨架 + OCR 覆盖层)`

## 一个"解决歧义"的说明(先讲,影响全篇)

task-5-brief.md 的 delta 4 写"工具栏钮不在本组件渲染(父壳统一)",但派发本任务的上层指令
明确写了 **RESOLVED AMBIGUITY**:按 T6 delta-3 推荐方案,PhotoImageViewer **自带**底部缩放
工具栏,T6 顶栏不再重复缩放控件。我以上层指令为准,组件内保留了 `.img-toolbar`(放大/缩小/
旋转/复位,i18n 用 Task 4 的 `photosZoomIn/photosZoomOut/photosRotate/photosReset`),
同时按 brief 要求 `defineExpose({ zoomIn, zoomOut, rotate, resetTransform })` 供父壳按需驱动
(如果 T6 最终决定不渲染任何工具栏按钮,直接调这些暴露方法也完全可行)。

## 逐条 delta 确认

1. **数据契约 → assetId**:props 改为 `{ assetId: string|number; mimeType: string; ocrLines?: Array<{box:number[]}> }`;
   去掉 `filterImages/imageIndex/items/index/current/prev/next/disablePrev/disableNext` 与
   `<ViewerShell>` 包裹 —— 组件模板只剩 `.img-stage` 舞台内容,无 chrome。
   `src` 计算:`browserCanDisplayImage(props.mimeType) ? service.photos.originalUrl(assetId) : service.photos.thumbnailUrl(assetId,'large')`。
   已用 mock 测试覆盖 `image/jpeg`→originalUrl、`image/heic`→thumbnailUrl(id,'large')。**确认完成。**

2. `watch(index, resetTransform)` → `watch(() => props.assetId, () => { resetTransform(); recomputeOcrRects() })`。
   测试:`assetId` 变化后 `translate` 复位到 `(0px, 0px)`。**确认完成。**

3. **OCR 覆盖层**(关键设计,详见下节"OCR-in-transform 如何验证")。**确认完成。**

4. 工具栏渲染 **保留在本组件**(上层指令覆盖 brief,见上文说明),同时 `defineExpose`
   `zoomIn/zoomOut/rotate/resetTransform` 供父壳(T6)按需驱动。**确认完成(按覆盖后的方案)。**

5. 键盘翻页 `onKey`(ArrowLeft/Right)**未实现在本组件** —— 组件只保留 wheel + pointer 处理器,
   不监听 `keyup`,不含任何 prev/next 逻辑。**确认完成。**

6. 样式:`.img-stage`/`.img-el` 沿用 files ImageViewer 原值,**保留了"勿加 will-change"瓦线注释**;
   新增 `.img-wrap`(transform 上下文的收缩包裹壳)、`.ocr-overlay`(absolute + pointer-events:none)、
   `.ocr-hit`(高亮框,`border: var(--accent)`、`background: var(--accent-soft)`、
   `box-shadow` 用 `var(--accent-soft-bd)` —— 均为已有 theme token,无新增 token 需求)。
   `pnpm test` 里的 `src/styles/color-guard.test.ts` 对本文件的检查通过(无裸色字面量)。
   **确认完成。**

## OCR-in-transform 的实现方式与验证(与 brief 字面稍有出入,已说明理由)

brief 原话是"`.img-wrap` 带 `imgStyle` transform,内含 `<img>` + `.ocr-overlay`"。我做了架构上的
调整,原因是纯 CSS 层面的一个真实坑:如果把包含 `width/height`(委托落盘尺寸)的完整 `imgStyle`
放到 `.img-wrap` 上,而 `<img>` 本身不再带任何内联样式,`.img-wrap` 在"未落盘"阶段(只有
`transform`,没有显式 `width/height`)就会退化为一个尺寸不确定的容器,而 `<img>` 若要继续用
`max-width/max-height:100%` 做"大图自动收缩进舞台"这一原有行为,其百分比参照的正是这个尺寸
不确定的 `.img-wrap`(不是 flex 舞台本身),CSS 规范里这类"父级尺寸不确定"下子元素的百分比宽高
会退化成 auto/intrinsic,导致大图不再正确收缩进舞台可视区——这是会在真机上出问题的回归,不是
过度设计。

改为的方案:
- **`<img class="img-el">` 保留 files ImageViewer 原封不动的 `:style="imgStyle"`**(transform +
  委托落盘的 width/height + suppressTransition),缩放/平移/旋转/落盘的全部逻辑与原组件零差异,
  沿用 `.img-el` 原有的 `max-width/max-height:100%; object-fit:contain` 收缩规则。
- **`.ocr-overlay` 绑定同一个 `imgStyle`**(`:style="imgStyle"`,和 `<img>` 完全相同的响应式对象)。
- **`.img-wrap`** 是一个 `position:relative; display:inline-flex` 的纯"收缩包裹壳"—— 不参与变换,
  只让自己的未变换包围盒与 `<img>` 的未变换包围盒重合(`.img-wrap` 除 `<img>` 外唯一参与布局的内容
  是 `.ocr-overlay`,但它是 `position:absolute` 脱离文档流,不影响 `.img-wrap` 的收缩尺寸)。
  `.ocr-overlay` 用 `inset:0` 精确覆盖 `.img-wrap`(= `<img>`)的盒子。

结果:`<img>` 与 `.ocr-overlay` 的未变换包围盒完全重合,且二者绑定**同一个** `transform` 值 ——
默认 `transform-origin: 50% 50%`(各自盒子的中心)在两者尺寸/位置完全相同的前提下,对相同输入
产生像素级相同的变换结果。缩放/平移/旋转对二者视觉上严丝合缝同步,且完全避开了上面那个 CSS
百分比退化坑。这与 brief "OCR 随变换移动、不用叠加 offsetLeft/offsetTop" 的**设计意图**一致,
只是"谁携带 transform"从"包一层的 wrap"换成了"img 与 overlay 各自携带同一份"——功能等价,
且规避了真实的布局回归。已在组件里以中文注释写明这个决策理由(`.img-wrap` 上方注释、
`.ocr-overlay` 上方注释)。

**验证方式**(测试用例,均 GREEN):
1. `mapOcrBoxesToRects` 边界验证:喂 `ocrLines=[{box:[0,0,1,0,1,1,0,1]}]`,`img` 伪造
   `clientWidth/clientHeight=200/200`、`naturalWidth/naturalHeight=100/50`,触发 `<img @load>`
   后 `.ocr-overlay .ocr-hit` 恰好 1 个,`left:0px / top:50px / width:200px / height:100px`
   —— 与 `ocrHighlight.test.ts` 里同一组入参的期望值完全一致(内容框居中留边)。
2. `ocrLines=[]` 与 `ocrLines` 缺省(不传 prop)两种情况下 `.ocr-hit` 数量均为 0。
3. **同步变换验证**:先造好一条 OCR 命中,再调用 `zoomIn()`(暴露方法),断言 `<img>` 与
   `.ocr-overlay` 的 `style` 属性**都**包含 `scale(1.1)`——证明覆盖层确实跟着缩放走,而不是
   停在原地。另外断言 `.img-wrap` 同时是 `<img>` 和 `.ocr-overlay` 的祖先节点(不是舞台的旁支
   兄弟,几何上共享同一定位原点)。

## TDD RED → GREEN

RED(组件不存在,导入报错):
```
$ pnpm vitest run src/photos/lightbox/__tests__/PhotoImageViewer.test.ts
Error: Failed to resolve import "../PhotoImageViewer.vue" ...
 Test Files  1 failed (1)
```

实现后 GREEN:
```
$ pnpm vitest run src/photos/lightbox/__tests__/PhotoImageViewer.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

全量:
```
$ pnpm test
 Test Files  233 passed (233)
      Tests  1385 passed (1385)
```

类型检查:
```
$ pnpm exec vue-tsc --noEmit
(无输出,clean)
```

## 测试清单(19 个,`src/photos/lightbox/__tests__/PhotoImageViewer.test.ts`)

- src 计算:originalUrl(可原生解码)/ thumbnailUrl(HEIC 等回退,size='large')—— 2 例
- wheel 缩放(deltaY 正负)—— 1 例
- defineExpose(zoomIn/rotate/resetTransform)—— 1 例
- 工具栏按钮 click(放大/旋转)—— 1 例
- 指针拖拽守卫:工具栏按下不进入舞台拖拽 / 舞台空白处可拖拽 / buttons=0 自愈 / dragstart 阻止 —— 4 例
- clampPan 边界(右下夹 852/602、左上夹 -852/-602)—— 2 例
- 停手落盘(150ms 落盘 width/height、防抖不提前落盘、复位清除落盘尺寸)—— 3 例
- 换图复位变换(assetId 变化)—— 1 例
- OCR 覆盖层(命中矩形吻合、空数组无命中、缺省 prop 无命中、随变换同步)—— 4 例

## 文件改动

- 新建 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/PhotoImageViewer.vue`
- 新建 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/__tests__/PhotoImageViewer.test.ts`
- 复用(未改动):`src/photos/util/browserCanDisplayImage.ts`(Task 1)、
  `src/photos/lightbox/util/ocrHighlight.ts` 的 `mapOcrBoxesToRects`(Task 1)、
  `src/i18n/{zh_cn,en_us}.ts` 的 `photosZoomIn/Out/Rotate/Reset`(Task 4,只读未改)。

## 自查

- 逐条比对 files `ImageViewer.vue:18-152,184-241`:两级缩放模型、`COMMIT_DELAY=150`、
  `PAN_KEEP=48` clampPan、pointer-capture 吞 click 守卫、丢 pointerup 自愈、
  `@dragstart.prevent`+`draggable=false`+`user-select:none`、wheel clamp `[0.1,8]`、
  5s 工具栏自隐(`isMoving`)——逐项照抄,零逻辑差异,只把选择器从 `filterImages/index` 换成
  `props.assetId`。
- `git diff` 检查:样式全部走 `var(--…)` token(`--accent`/`--accent-soft`/`--accent-soft-bd`/
  `--border`/`--fg`/`--tool-bg-hi`/`--popup-bg`/`--blur`/`--media-overlay-shadow`),无新增
  hex/rgb 字面量;`color-guard.test.ts` 对本文件的用例通过。
- `resizeObserver`/`ResizeObserver` 按仓库既有惯例(`SnapCarousel.vue`)用
  `typeof ResizeObserver !== 'undefined'` 守卫,jsdom 无此全局也不报错。
- 未引入未使用的 import;`onBeforeUnmount` 清理了 `hideTimer/commitTimer/suppressTimer/resizeObserver`。

## 关注点(非阻塞,供 T6/后续参考)

1. **工具栏归属的分歧已按上层指令解决**(见开头说明),但如果后续 T6 设计又反悔想要"父壳统一
   工具栏、本组件不渲染任何按钮",只需删掉模板里的 `.img-toolbar` 块并保留 `defineExpose` 即可,
   缩放/平移逻辑完全不受影响。
2. **OCR-overlay 的"共享 transform"实现与 brief 字面表述有出入**(见上方详细理由),功能与验收
   标准(overlay 随缩放/平移/旋转同步移动、rects 不叠加 offsetLeft/offsetTop)完全满足,但如果
   评审坚持要求"transform 必须字面上只出现在包裹层一处",需要在真机上先验证
   "wrap 无显式宽高时,img 的 max-width/max-height:100% 是否仍能正确收缩进舞台"这一具体 CSS
   行为,再决定要不要换回原字面方案——我评估后判断当前实现更稳妥,但这属于可讨论的设计取舍,
   未做真机截图验收(仅 jsdom + 逻辑推导)。
3. 未做真机(浏览器)视觉验收——本任务范围是组件实现 + 单元测试,T6 集成后建议连同 useLightbox
   的真实 OCR 数据跑一次真机眼验,确认高亮框在各种宽图/高图/旋转角度下都贴合文字。
