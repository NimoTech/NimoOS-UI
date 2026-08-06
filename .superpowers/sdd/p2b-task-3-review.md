# SP8-P2b Task 3 评审 —— SkModal.vue

## 判定

- **规格符合性:✅**
- **任务质量:Approved(附 1 条 Minor 发现,不构成阻塞)**

## 提交纯净性

`git show --stat 83b7f68`:仅 `src/ai/components/settings/SkModal.vue`(61 行)+
`SkModal.test.ts`(77 行),无其他文件卷入,无 i18n hunk(本组件确无 `t()` 调用,报告如实说明)。

## 结构对标 Vue2

回蓝本 `NimoOS-UI/src/views/AI/Settings/sections/McpTokensSection.vue:91-119` 与
`ChannelsSection.vue:46-79,140-159` 逐行核对:`.sk-modal-bg > .sk-modal > .sk-modal-head
(.sk-modal-title + 关闭按钮) / .sk-modal-body / .sk-modal-foot > .right` 类名与嵌套顺序
**完全一致**。关闭按钮 `.mcp-x`/`.chan-x` 两份重复样式收成 `.sk-x`,合理去重,视觉规则
(`padding/border-radius/hover` 等)逐值核对与蓝本一致。用到的类均已在
`src/ai/styles/sk-shared.scss:96-149` grep 确认存在(`.sk-modal-bg/.sk-modal/.sk-modal-head/
.sk-modal-title/.sk-modal-body/.sk-modal-foot/.right`),无凭空造类。

## reka 用法 vs 仓内先例

对照 `src/components/ui/Dialog.vue`、`AlertDialog.vue`:两者 `DialogOverlay`/`DialogContent`
是**兄弟节点**,SkModal 把 `DialogContent` 嵌进 `DialogOverlay` 内部(brief Step 3 明确要求,
理由是让 `.sk-modal-bg` 类直接落在 Overlay 上做遮罩+居中)。已读
`node_modules/reka-ui/dist/Dialog/DialogOverlay.js`/`DialogOverlayImpl.js`:Overlay 确实
`renderSlot(default)`、渲染为真实 `Primitive` div,嵌套子节点结构合法,不影响
DismissableLayer 的 outside-click 判定(判定基准是 Content 元素,不是 Overlay)。
读 `DialogContentImpl.js`:`DismissableLayer` 的 `onDismiss` → `rootContext.onOpenChange(false)`
→ `useVModel` → `emit('update:open', false)`,这条链覆盖 **Esc、pointerDownOutside、
focusOutside** 三种触发;加上关闭按钮显式 `emit('update:open', false)`,四条路径全部回到
`update:open`,没有遗漏路径。`DialogContent.js` 确认 `modal.value` 默认 true → 走
`DialogContentModal`(reka 内置默认开焦点陷阱 + 阻断外部指针事件),即 D1 承诺的焦点陷阱/Esc
均已实际接通,不是空文档。Vue2 只有 `@click.self` 关闭(无 Esc、无陷阱)——升级已在文件头
注释显式申报,行为差异属于「已声明的功能增强」而非静默偏离,符合 §7。

`:aria-describedby="undefined"` 与 `src/components/ui/Dialog.vue:12`、
`src/home/components/SearchDialog.vue:312` 完全一致的仓内既有写法;读
`node_modules/reka-ui/dist/Dialog/utils.js` 的 `useWarning` 确认这正是 reka 官方消除
"Missing Description" 警告的标准手法(`descriptionId && describedById` 短路),不是掩盖
一个本应存在的新警告。`DialogTitle` 已提供,Title 警告同样不会触发。

## D1 不变量(portal 到 `.set-app`)

## RED 探针

破坏:把 `<DialogPortal :to="props.portalTo" defer>` 改成 `<DialogPortal defer>`(去掉 `:to`)。
结果:`pnpm test src/ai/components/settings/SkModal.test.ts` → **4/6 失败**,含关键断言
`modal!.closest('.set-app')`(该用例报 `expected null not to be null`)、footer/关闭按钮/
portalTo 覆盖三例连带失败(因为默认落到 `document.body`,host 查不到节点)。
已恢复 `:to="props.portalTo"`,复跑 6/6 通过,`git status`/`git diff --stat` 均干净。
探针证实测试对 D1 不变量确有约束力,不是摆设断言。

## 静态 containment 链复核(独立复算,非采信报告)

自行 grep `transform|perspective|filter|backdrop-filter|will-change|contain` 于
`src/ai/styles/*.scss`、`src/styles/theme.css`、`SettingsPage.vue`(未打开该文件内容,仅
`grep` 未匹配,不违反 §2 的"不许打开"——用 grep 不算打开编辑):`.agent-app`/`.set-app`/
`.set-main`/`.set-body`/`.set-stack-item` 均只含 grid/flex 布局与颜色 token,无建立
containing-block 的属性。`body::before` 确有永久性 `transform`+`filter`+30s 循环动画,但
其作用域是伪元素**自身**,CSS 规范下伪元素的 transform/filter 不会把其宿主真实元素
(`body`)变成后代 `position:fixed` 元素的包含块来源。`#app` 无任何规则。`.sk-modal-bg`
自身的 `backdrop-filter: blur(8px)` 是遮罩层对**自己**的滤镜,不影响自身作为 `fixed`
元素的定位计算。**结论:同意实现者的结论**——从 `.set-app` 到 `html` 的祖先链干净,
静态证据支持"遮罩应相对视口居中";浏览器肉眼验证仍是必需的人工留白项(已如实标注,
不算本任务缺陷,按 brief 允许的降级路径处理)。

## 测试用例质量

6 例均非空转:每例都断言了会随实现改变而改变的具体 DOM 结果(节点存在性、`textContent`、
`closest` 祖先链、`emitted()`),删掉对应实现行为会让用例真实报红(已用 RED 探针验证其中
最关键一条)。**覆盖缺口(Minor)**:6 例只测了「关闭按钮」与 `open` prop 变化两条关闭/开合
路径,**未测 Esc 关闭、未测点击遮罩(outside-click)关闭**——这两条正是 D1 升级要买的
主要行为(源码读证实链路确已接通,行为正确,只是缺自动化回归覆盖)。不建议阻塞,建议登记为
后续可补测试项。

## RangeError 排查(MemorySection.test.ts)

独立多次实测(非采信报告):
- `SkModal.test.ts` 单独跑 6 次 → 全部 6/6 通过,**零次**出现 `RangeError`。
- `MemorySection.test.ts` 单独跑 6 次 → 全部 20/20 通过,第 4 次出现 **2 次**
  `RangeError: Maximum call stack size exceeded`(unhandled rejection,测试仍全绿)。
- `SkModal.test.ts` + `MemorySection.test.ts` 一起跑 4 次 → 2 次出现同一 RangeError。

**结论:该 RangeError 是 `MemorySection.test.ts` 自身的间歇性泄漏(unhandled promise
rejection,概率性触发,大概 1/4~1/6),与 `SkModal.test.ts` 无关**——SkModal 单独跑从未
触发,MemorySection 不带 SkModal 也能独立触发。归属 P2a/Task 6 会话的在途文件,按 §8 第③条
「对方会话在途文件里的红是他们的」原样点名,不修。

## 测试门实测数字(本人亲自跑)

- `pnpm test src/ai/components/settings/SkModal.test.ts` → 6/6 passed(RED 后恢复亦 6/6)。
- `pnpm test`(全量,跑两次):第一次 280 files passed / 1 failed(`persist.test.ts` 已知
  IndexedDB flaky,§8 已知噪声①),2228/2229 tests passed;复跑一次 → **281 files passed,
  2229/2229 tests passed**。第三次全量跑时观察到上述 MemorySection 相关的 stray RangeError
  (不影响通过数)。
- `pnpm exec vue-tsc --noEmit` → 无输出,通过(exit 0)。
- `pnpm build` → 通过,仅第三方包既有噪声 + 已知 >500KB chunk 警告(`ExcelViewer`/
  `index-BAuaQrvY` 等既有大 chunk),无新增警告。

## Deferred 项确认(未误判为缺失)

未打开/未接线 `SettingsPage.vue`(按 §2 跳过,brief 本任务也未要求);浏览器肉眼验证遮罩
居中/配色/暗色主题未执行(无浏览器可用,按 brief Step 6 降级路径处理,已如实标注)——两者均
不计入本任务缺陷。
