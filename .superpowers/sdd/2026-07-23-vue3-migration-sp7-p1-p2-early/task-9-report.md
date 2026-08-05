# Task 9 报告 —— 灯箱集成(Photos.vue 接线 + 挂载灯箱 + 删除 toast/刷新 + 详情栏/缩略图条接线,SP7-P2 收官)

## Job A — Photos.vue

`src/views/Photos.vue`:

- `onOpenTile(photo, _list, startMs)` 实装:`store.months.flatMap(m => m.photos).filter(p => matchesTab(p, tab.value))` 构造当前 tab 过滤后的翻页集,`useLightbox().openAt(photo, filtered, startMs)`。
- `onLightboxDelete(id)`:`await store.deleteAssets([String(id)])` → `toast.show(t('photosDeletedToast', { count: 1 }), 4000)`。灯箱已在 `PhotoLightbox.vue` 的 `doDelete()` 里 confirm 后自行 `lb.close()`,这里不重复关。
- 模板末尾挂 `<PhotoLightbox @delete="onLightboxDelete" @toggle-fav="() => {}" />`(与 `<AreaShell>` 同级,Vue 3 fragment 根)。
- 头部注释更新为「Task 9: 灯箱集成(P2 收官)」,移除 `// TODO(SP7-P2)`。

## Job B — PhotoLightbox.vue 挂 PhotoInfoPanel + PhotoFilmstrip

`src/photos/lightbox/PhotoLightbox.vue`:

- Import `PhotoInfoPanel`(`./PhotoInfoPanel.vue`)、`PhotoFilmstrip`(`./PhotoFilmstrip.vue`)。
- **详情栏**:发现 `PhotoInfoPanel.vue` 自身样式(`.info-panel { flex: 0 0 auto; width: 360px; ... }`,无 `position`)是按"并排 flex row 的一个 flex item"设计的,并不是绝对定位覆盖层——而 T6 原来留的占位 `<aside v-if="showInfo" class="lb-info">`(已删除)是 `position:absolute` 悬浮覆盖层。两者定位模型不兼容,直接把 `<PhotoInfoPanel>` 塞进旧 `.lb-info` 壳会导致双层 aside+双套定位样式冲突。改为:把原来单飞 `flex:1` 的 `.lb-stage` 包一层新的 `.lb-body`(`display:flex; flex:1; min-height:0`),`.lb-stage` 和 `<PhotoInfoPanel>` 变成同一行内的两个 flex 子项——这正好匹配 `PhotoInfoPanel.vue` 自带的 `flex:0 0 auto` 假设,不用改 `PhotoInfoPanel.vue` 本身一行代码。挂载:`<PhotoInfoPanel :photo="lb.detail.value" :visible="showInfo" />`(读水合后的 `lb.detail`,不是 `lb.current`,满足 Task 3 的水合约定)。旧 `.lb-info`/`.lb-info-title`/`.lb-info-sub` 死样式删除,新增一行 `:deep(.info-panel) { margin: 64px 16px 16px 0; }` 只负责让出顶栏遮挡区(不重复定义外观,外观仍归 `PhotoInfoPanel.vue` 自己的 `.info-panel` 样式)。
- **缩略图条**:`<PhotoFilmstrip :list="lb.list.value" :index="lb.index.value" @select="lb.goTo" />` 挂在 `.lb-body` 之后(灯箱整个纵向 flex column 的最后一个可见区块,confirm 模态之前),emit 的是绝对下标(见 `PhotoFilmstrip.vue` 头部注释 delta 1),父级直接转 `lb.goTo(i)`。
- `lb.detail`/`lb.list`/`lb.index` 都是 `Ref<...>`(`useLightbox()` 返回原始 ref,非 `reactive`/`toRefs` 解包),模板里全按 `.value` 访问 —— 与文件里已有的 `lb.current.value`/`lb.ocrLines.value` 等写法一致,未引入新访问模式。

### PhotoLightbox.test.ts(既有 21 个测试)

`mountLb()` 新增两个 stub(`global.stubs`):

- `PhotoInfoPanel`:`template: '<aside v-if="visible" class="lb-info" />'` —— 特意保留 `class="lb-info"` 名字,使既有「详情开关」测试(断言 `.lb-info` 的 exists/不 exists)**一字不改**继续通过。真实组件类名是 `.info-panel`,只在 Photos.lightbox.test.ts / 未来专门的 PhotoInfoPanel.test.ts 里断言。
- `PhotoFilmstrip`:`template: '<div class="stub-filmstrip" />'`。

这两处 stub 是 brief 里显式允许的("stub PhotoInfoPanel/PhotoFilmstrip there if needed to keep those tests shell-focused")。

## TDD:RED → GREEN(Photos.lightbox.test.ts,新建)

**RED**(临时把 `onOpenTile`/`onLightboxDelete` 改回空函数体验证,之后原样恢复,diff 全干净,无 TDD-RED-TEMP 残留):

```
$ pnpm vitest run src/views/__tests__/Photos.lightbox.test.ts
 FAIL  ... 3 failed
   点开一张图 → 灯箱打开,翻页集 = 当前 tab(默认 photo)过滤后的集合
     AssertionError: expected false to be true  (lb.open.value)
   tab=video 时打开某视频 → 翻页集只含 isVideo
     AssertionError: expected false to be true  (lb.open.value)
   灯箱 emit delete(id) → store.deleteAssets(["id"]) + toast.show
     AssertionError: expected false to be true  (lb.open.value)
```

**GREEN**(恢复实现后):

```
$ pnpm vitest run src/views/__tests__/Photos.lightbox.test.ts src/photos/lightbox/__tests__/PhotoLightbox.test.ts
 Test Files  2 passed (2)
      Tests  24 passed (24)   # 3 新增 + 21 既有
```

新测试覆盖(3 条,mount 真实 Photos.vue + 真实 PhotoLightbox,只 mock `@nimotech/nimoos-service` 和 `useMessageBus`):

1. 默认 tab='photo':点开网格里的图 → `lb.open.value===true`,`lb.list.value` 长度 2(过滤掉视频),首项 id='a'。
2. 切到 tab='video' 再点开视频 → `lb.list.value` 长度 2 且全 `isVideo`。
3. 灯箱里点垃圾桶 → 点确认 → `store.deleteAssets` 以 `['a']` 调用(spy)、`toast.show` 以含 '1' 的字符串 + `4000` 调用、`lb.open.value` 回到 `false`(验证灯箱自己 close,Photos.vue 没有重复 close 的副作用)。

## 连带修复:Photos.integration.test.ts(未列入任务文件清单,但不改会红)

原因:该文件最后一条测试 `tile open 是空 handler(P1 不弹灯箱)` 断言的是 **P1 语义**(点开图不该有任何副作用)。P2 接线后点开图会真的调 `useLightbox().openAt()`,继而调 `service.photos.recordView/originalUrl/liveUrl` 等——该文件的 `svc.photos` mock 此前没有这几个方法,点击直接抛 `TypeError`,测试失败并伴随一个跨测试泄漏的未捕获异常(污染同文件后续断言)。

修复(在同一文件内,未新增文件):

- `svc.photos` mock 补齐 `originalUrl/liveUrl/recordView/getAsset/getAssetOcr/listFavoriteIds/favorite/unfavorite`(与 `Photos.lightbox.test.ts`/`PhotoLightbox.test.ts` 同规格)。
- 引入 `useLightbox()`,在 `beforeEach`/`afterEach` 都 `lb.__resetForTest()`(灯箱是模块级单例,不随 `createPinia()` 重置,不清会跨 `it()` 泄漏 `open`/`list`/`pushedHistory` 状态)。
- 把最后一条测试的名字与断言从「P1 空 handler」改为「P2 已接线」的冒烟断言(点开不炸 + `lb.open.value===true`),细节覆盖交给新的 `Photos.lightbox.test.ts`。

```
$ pnpm vitest run src/views/__tests__/Photos.integration.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)   # 数量不变,只改了最后一条的语义
```

## 全量验证

```
$ pnpm vitest run src/views/__tests__/Photos.lightbox.test.ts src/photos/lightbox/__tests__/PhotoLightbox.test.ts src/views/__tests__/Photos.integration.test.ts
 Test Files  3 passed (3)
      Tests  36 passed (36)

$ pnpm test
 Test Files  237 passed (237)
      Tests  1434 passed (1434)   # 1431(brief 基线)+ 3 新增,吻合

$ pnpm exec vue-tsc --noEmit
(no output — clean)

$ git diff -- src/photos/lightbox/PhotoLightbox.vue src/views/Photos.vue | grep -E '^\+' | grep -E '#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(' | grep -v theme-exception
(no output — 无新增硬编码颜色,color-guard 干净)
```

## 文件改动清单

- `src/views/Photos.vue` —— Job A(onOpenTile 实装、onLightboxDelete、挂 `<PhotoLightbox>`、头部注释更新)。
- `src/photos/lightbox/PhotoLightbox.vue` —— Job B(挂 PhotoInfoPanel + PhotoFilmstrip,`.lb-stage` 包一层 `.lb-body` 做 row flex,删旧 `.lb-info*` 死样式)。
- `src/photos/lightbox/__tests__/PhotoLightbox.test.ts` —— `mountLb()` 加两个 stub(PhotoInfoPanel/PhotoFilmstrip),保既有 21 例不变。
- `src/views/__tests__/Photos.lightbox.test.ts`(新建)—— 3 条新测试,见上文。
- `src/views/__tests__/Photos.integration.test.ts` —— 补 service mock + 最后一条测试语义更新为 P2(连带修复,理由见上)。

## T6 delta-3 的悬而未决决策(task-9-brief.md 末尾提到)

Brief 末尾写"缩放钮归顶栏还是归 PhotoImageViewer 底部工具栏——二选一并在报告注明":本任务未涉及缩放钮改动。查看 T5/T6 现状,`PhotoImageViewer.vue`(T5)已经自带底部缩放条,`PhotoLightbox.vue` 顶栏从未添加过缩放钮 —— 即已经是"归 PhotoImageViewer 底部工具栏"这一支,Task 9 未改动此处,维持现状。

## 自查 / 关注点

1. **PhotoInfoPanel 的 flex row 布局是本任务的一个非字面实现决策**:brief 字面写的是"挂载点"直接换成 `<PhotoInfoPanel>`,没细说容器结构。我读了 `PhotoInfoPanel.vue` 的样式(`flex:0 0 auto`,无 `position`)判断它是按"并排"设计的,于是把 `.lb-stage` 包进新 `.lb-body` 让二者成为同一行 flex 的两个子项,而不是照抄旧 `.lb-info` 的绝对定位覆盖层写法。这是我在读源代码后做出的工程判断,不是 brief 直接给出的规格;5277 真机验收时建议重点看一眼详情栏展开时的桌面态视觉(是否顶栏被并排挤窄、info 面板是否贴边合理),如果视觉不理想,调整只涉及 `.lb-body`/`:deep(.info-panel)` 这两小段样式,不涉及数据接线。
2. **翻页箭头/顶栏自隐 chrome 不覆盖缩略图条**:`PhotoFilmstrip` 常驻渲染,不随 `isMoving` 5 秒自隐一起收起(brief 未提及要收起,现状是"顶栏+箭头收起,缩略图条常驻")。如果验收发现体验别扭(例如全屏静态图时缩略图条一直占底部空间),这是可调项而非 bug。
3. **Photos.integration.test.ts 的连带修改超出了任务文件清单**,但不改就会导致 `pnpm test` 红(见上文根因),已按"保证全量测试通过"这条硬约束处理,改动仅限该文件内的 mock 补全 + 一条测试的名字/断言更新,未删除/新增测试用例数量。
4. `onLightboxDelete` 里 `count: 1` 是写死的(brief 明确要求"count:1",单张删除语义),不是从 `deleteAssets` 的返回值(`successCount`)取——这是 brief 字面要求,和批量删除路径(`onBatchDelete` 用真实 `count`)刻意不同,写在这里避免以后有人"顺手"改成一致而引入偏差。

## 5277 真机验收说明(转述给用户)

```
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI
pnpm dev --host --port 5277
```

浏览器打开 `http://192.168.1.143:5277/`(先登录),再进 `http://192.168.1.143:5277/app/#/photos`。

看点:

- 点开时间线里任意一张图 → 灯箱打开,顶部标题/计数正确,鼠标静止 5 秒顶栏和翻页箭头收起,移动鼠标复现。
- 底部有一条缩略图带,点某张缩略图 → 灯箱跳到那张(不是相对翻页,是绝对跳转)。
- 点顶栏的信息图标(圆圈里个 i)→ 右侧弹出详情栏(EXIF/相机参数/位置小地图/文件路径),再点一次收起。
- 切到"视频"tab 再点开一个视频,翻页(左右箭头/键盘方向键)应该只在视频之间跳,不会跳回照片。
- 点垃圾桶图标 → 确认删除 → 灯箱自动关闭 + 出现"已删除 1 张照片"的 toast(4 秒后消失)→ 回到时间线,该照片已经从网格消失(`refreshTimelineQuiet` 静默刷新,不应有整页 loading 闪烁)。
- 收藏心形图标点击应能切换实心/空心(P3 会把这个状态往外广播,这次只测本地切换)。

至此 SP7-P2(灯箱)全部任务收口。

---

## 追加:整分支评审 findings 修复(2026-07-23)

评审对 `PhotoLightbox.vue` 提了 4 条 finding,#4(`_hydrateSeq` 双跳)按指示原样不动;其余三条修复如下。

### Finding #1(Important)—— chrome 在打开瞬间被隐藏,根因

`isMoving`(驱动顶栏 `v-if` + 左右翻页箭头 `v-if`)只在 `onMounted()` 里调一次 `onMouseMove()` 来点亮 + 起 5s 自隐计时。但本组件是**父级只挂载一次的持久组件**(自己靠 `v-if="lb.open.value"` 门控显隐,不是每次打开重新 mount)。于是真实时序是:

1. 应用启动时组件挂载,此时灯箱通常是关的 —— `onMounted` 照样跑,`onMouseMove()` 照样把 `isMoving` 置 true 并起 5s 计时。
2. 用户还没点开任何照片,5s 过去,计时到期,`isMoving` 回到 `false`。此后只要用户不移动鼠标,这个 `false` 会一直挂着——因为组件从未重新 `mount`,`onMounted` 不会再跑第二次。
3. 用户点开一张照片(`openAt()` → `lb.open.value = true`),`v-if="lb.open.value"` 让灯箱容器出现,但 `isMoving` 还停留在上一次的 `false`——顶栏和翻页箭头因为各自的 `v-if="isMoving"` 全部不渲染。看起来就是"点开图,什么工具栏都没有,必须先动一下鼠标才出现"。

这和 brief 里已经写明的"视频起播位续播"坑是**同一根因**(持久挂载 + `onMounted` 只在应用生命周期跑一次,业务却期待"每次打开都重新初始化"),只是这次连累的是 chrome 可见性而非 seek 时间点。

### 三处修复

在**既有**的 `watch(() => lb.open.value, ...)` 打开分支(`{ immediate: true }`,本来就用于捕获视频续播锚点)里追加两行:

```ts
watch(
  () => lb.open.value,
  (isOpen) => {
    if (isOpen) {
      startApplied = false
      startPhotoId = lb.current.value?.id ?? null
      onMouseMove()       // Finding #1:每次 open 都重新点亮 chrome + 重新起 5s 计时
      showInfo.value = false // Finding #2:每次 open 详情栏复位收起
    }
  },
  { immediate: true },
)
```

- **Finding #1**:每次 `open` 由假变真都补调一次 `onMouseMove()`,保证"刚打开"这一刻 `isMoving` 必为 `true`(顶栏 + 箭头必可见),且 5s 计时器是全新起跑的,不会用到应用启动时那次早已过期的计时。
- **Finding #2**:`showInfo` 原是组件级 `ref`,`close()` 不会重置它,导致"这次打开切开了详情栏 → 关闭 → 下次重开,详情栏还开着"。同一 open-watch 分支里显式 `showInfo.value = false`,每次打开都从收起态开始。
- 顺带把 `isMoving`/`hideTimer`/`onMouseMove` 的声明从原来靠后的位置**上移到这个 watch 之前**(不是逻辑必需,是防御性排雷:`watch(..., { immediate: true })` 的回调在 `<script setup>` 顶层执行到这一行时就可能同步触发——如果那一刻 `lb.open.value` 恰好已经是 `true`(brief 注释提到的"组件在灯箱已开时才挂载的边缘情况"),回调里调用的 `onMouseMove()` 就会引用到还没执行到其 `let` 声明行的 `hideTimer`,命中 TDZ 抛 `ReferenceError`。上移声明后这个理论风险被彻底消除,不依赖对 Vue `immediate` watcher 调度时机的猜测)。
- **Finding #3**:`.lb-sub`(标题下方的计数/日期/时间)和 `.lb-confirm-body`(删除确认弹窗正文)两处 `var(--text-3, var(--fg))` 改为 `var(--fg-muted)`。`grep -n "fg-muted\|text-3" src/styles/theme.css` 确认 `--fg-muted` 在两套主题块(深色 L43 / 浅色 L172)都有定义,`--text-3` 全仓库无定义处(fallback 恒退化成 `--fg`,丢失既定的"次级/弱化文字"层级);`PhotoInfoPanel.vue` 已用 `--fg-muted` 承担同样的弱化角色,这里对齐,未新增 token 也未写字面量颜色。

### 回归测试(会捕获 #1 的用例)

`src/photos/lightbox/__tests__/PhotoLightbox.test.ts` 新增 describe 块「PhotoLightbox 持久挂载:onMounted 时灯箱未开」,两条:

1. **持久挂载路径**:`mountLb()` 时 `lb.open.value` 为 `false`(不在 mount 前调 `openAt`)→ `vi.useFakeTimers()` + `vi.advanceTimersByTime(5000)` 让 `onMounted` 起的计时提前过期(模拟"应用启动很久后才第一次点开照片")→ 再 `lb.openAt(...)` → 断言 `.lb-top`、`.lb-nav-next` 均可见。
2. **showInfo 复位**:先打开一次、点开详情栏、`lb.close()`、再 `openAt` 第二张 → 断言 `.lb-info` 不存在(默认收起)。

**RED 先行确认**(`git stash push` 只暂存 `.vue` 的修复,保留新测试,跑一遍,再 `stash pop` 恢复):

```
$ git stash push -- src/photos/lightbox/PhotoLightbox.vue
$ pnpm vitest run src/photos/lightbox/__tests__/PhotoLightbox.test.ts
 FAIL  ... 2 failed | 21 passed (23)
   mount 时灯箱已关、且早于任何 openAt 的 5s 计时已过期 —— openAt 后工具栏 + 翻页箭头必须可见
     AssertionError: expected false to be true   (.lb-top 不存在)
   open 时 showInfo 复位为 false,即便上一次打开曾切到 true
     AssertionError: expected true to be false    (.lb-info 仍存在,上次开合态泄漏)
$ git stash pop   # 恢复三处修复
```

两条新测试如预期 RED,既有 21 条不受影响、全绿——证实新测试确实覆盖了 finding #1(以及 #2),且没有依赖修复就会假阳性通过。

**GREEN(修复恢复后)**:

```
$ pnpm vitest run src/photos/lightbox/__tests__/PhotoLightbox.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)   # 21 既有 + 2 新增

$ pnpm test
 Test Files  237 passed (237)
      Tests  1436 passed (1436)

$ pnpm exec vue-tsc --noEmit
(no output — clean)

$ git diff -- src/photos/lightbox/PhotoLightbox.vue | grep -E '^\+' | grep -E '#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\('
(no output — 无新增硬编码颜色,color-guard 干净)
```

### 改动文件清单(本次追加)

- `src/photos/lightbox/PhotoLightbox.vue` —— open-watch 分支补 `onMouseMove()` + `showInfo.value = false`;chrome 自隐声明块上移防 TDZ;两处 `var(--text-3, var(--fg))` → `var(--fg-muted)`。
- `src/photos/lightbox/__tests__/PhotoLightbox.test.ts` —— 新增 2 条回归测试(持久挂载路径 chrome 可见 + showInfo 复位)。
