# SP4-P4a 文件查看器(轻) — subagent-driven 执行台账

计划:`NimoOS-UI/docs/superpowers/plans/2026-07-06-vue3-migration-sp4-p4a-viewers.md`
spec:`NimoOS-UI/docs/superpowers/specs/2026-07-06-vue3-migration-sp4-p4a-viewers-design.md`
起点 BASE:`59dc605`(master,本地无 remote)

## ⚠️ 并行 WIP 夹带说明(用户 2026-07-06 拍板允许)
执行 P4a 时工作树已有未提交并行改动,用户同意让它们随 P4a 提交(均未推远程,可恢复):
- **auth 登录环修复**([[newui-login-redirect-loop]]):`src/main.ts`、`src/router/guard.ts`、`src/router/index.ts`、`src/router/guard.test.ts` + 未跟踪 `src/router/onAuthFail.ts/.test.ts`
- **home widget WIP**:`src/home/components/widgets/ClockWidget.vue/.test.ts`、`WidgetCard.vue`、`src/home/grid/gridMath.ts/.test.ts`
- 其它:`src/files/composables/useFileOps.ts`、未跟踪 `src/files/util/clipboard.ts/.test.ts`
- **具体夹带点**:P4a Task 3 会 `git add src/main.ts`,把 auth 那笔的 main.ts 改动一并提交进 P4a 的 ViewerShell 提交。其余并行文件不被 P4a 任务 `git add`,保持未提交留在树里。
- **恢复**:起点干净状态 = `59dc605` 之上不含以上改动;auth/widget WIP 的内容可从执行期间的 commit 里按文件挑出(`git log -p -- src/router/onAuthFail.ts` 等)。

## 任务进度
- [x] Task 1: panelMap 纯模块 — 完成(commit e4f9120, review clean;Spec✅ 质量 Approved)
- [x] Task 2: useViewer 单例 — 完成(commit d127e2c, review clean;Spec✅ Approved,Minor:toBe→toStrictEqual 合理)
- [x] Task 3: ViewerShell + c-zoom-in — 完成(commit 76f3d10, review ✅ Approved;⚠️ 该提交按批准夹带 main.ts auth WIP)
- [x] Task 4: ViewerHost + Files.openEntry 接线 — 完成(commit e8ca15b, review ✅ Approved)
- [x] Task 5: ImageViewer — 完成(commit 271b796, review ✅ Approved;v-viewer v3 API 与计划一致)
- [x] Task 6: CodeViewer(CM6) — 完成(commit 620b67c, review ✅ Approved 零问题;读 getContent/存 update try-catch/脏确认无竞态,零改共享包)
- [x] Task 7: MediaViewer(Artplayer/APlayer) — 完成(commit 33fd528, review ✅ Approved;实例销毁+objectURL 回收+元数据失败不阻断都对)
- [ ] Task 8: MarkdownViewer
- [x] Task 9: 全量集成 + 部署 + roadmap — 完成

## Minor findings 汇总(交最终 whole-branch review 分诊)
(执行中累积)

### Task 1
- Task 1: complete (commits 59dc605..e4f9120, review clean)
- ⚠️ Important(plan-mandated) → **用户拍板:现在抽共享常量**。新增 Task 1.5(重构):抽 `src/files/util/fileCategories.ts` 共享分类数组,`icons.ts`(TYPE_MAP)+`panelMap.ts`(typeMap)都 import;重跑 icons + panelMap 测试保 last-match-wins 不变。排在 Task 2 review 后、Task 3 前。**已完成:commit ad3755e,review ✅ Approved 零问题,icons 4/4+panelMap 7/7+tsc 0,键顺序与 dockerfile→text-dockerfile 不变。**
- Minor: task-1-report.md 行数统计与 diff 不符(纯报告卫生,代码无碍)。

### Task 2
- Task 2: complete (commits e4f9120..d127e2c, review clean)
- Minor(无需处理): 测试 toBe(img)→toStrictEqual(img)——ref(object) 被 reactive 包成代理,值相等断言正确;未测「已打开再开另一项」覆盖缺口。

### Task 1.5
- Task 1.5(重构): complete (commit ad3755e, review clean, 零 issue)

### Task 3
- Task 3: complete (commits ad3755e..76f3d10, review clean)
- ⚠️ 提交 76f3d10 的 main.ts 含 auth WIP(makeAuthFailHandler/onAuthFail),已批准夹带。
- Minor(留最终 review 分诊): ViewerShell 两个 <button> 无 type="button"(默认 submit),若将来置于 <form> 内会误提交;来自 brief 示例,低风险。

### Task 4
- Task 4: complete (commits 76f3d10..e8ca15b, review clean)
- 决策落地: 下载接线统一在 ViewerHost(useFileOps().download([entry])),各查看器只 emit download。故 T5 ImageViewer 无需再接下载。
- Minor(留分诊): Files.openEntry.test.ts 未用的 vi import(来自 brief 片段);ViewerHost.onDownload 读单例 currentItem 而非 payload(等价)。

### Task 5
- Task 5: complete (commits e8ca15b..271b796, review clean)
- Minor(留分诊): ImageViewer 的 items 在 setup 期 const 计算一次,不响应 props.list 变化——但每次打开重建组件、list 生命周期内稳定,实际不可见。

### T6 前置 curl 结论(controller 已核实 2026-07-06)
- `GET /v1/file/content` = **标准信封** `{success:200,message,data:<内容字符串>}`;`service.file.getContent(path)` unwrap 后**直接返回内容字符串**(共享包 FileContent 类型是 type lie,运行时是 string)。
- `GET /v1/file`(download,GetDownloadSingleFile)= 原始字节(text/*),unwrap 会崩——**不用它读代码**。
- **决策:CodeViewer/MarkdownViewer 用 `coerceContent(await service.file.getContent(path))`(res 即字符串,不访问 .content)。零改共享包。** 无裸信封坑(不同于 appgrid/precheck)。

### Task 6
- Task 6: complete (commits 271b796..620b67c, review clean, 零 issue)

### 构建修复(T7 期间发现)
- 🔧 T6 引入的 @uiw/codemirror-theme-monokai 依赖 @babel/runtime,pnpm 严格 node_modules 未提升→`vite build` 挂(tsc 不报,故 T6 tsc 门槛没抓到;full build 本排 T9)。已 `pnpm add @babel/runtime` 修,build 恢复绿。教训:CM6 主题类包常有隐式 @babel/runtime 依赖;per-task 门槛只 tsc 漏了 vite build 这类解析问题。

### Task 7
- Task 7: complete (commits 620b67c..33fd528, review clean;另 build 修复 cea9389)
- Minor(留分诊): MediaViewer .media-wrap 的 :class audio 无对应 scoped 样式(死类,cosmetic)。

### Task 8
- Task 8: complete (commits cea9389..c3e492d, review clean)
- Minor(留分诊): 无 XSS 回归测试(html:false 已正确可见);MarkdownViewer/CodeViewer 的 getContent 失败无 try/catch→静默空白(既有 sibling 模式,非本任务引入)。→ 交 whole-branch 终审分诊是否补。

## Whole-branch 终审(opus, 59dc605..c3e492d) = With fixes
架构/契约/纯逻辑测试/refactor 都赞;揪出 3 个跨切面 Important(per-task 看不到):
- **#1 图片翻页后下载错文件**:ViewerHost.onDownload 读 currentItem(初始项),ImageViewer 本地 index 翻页→翻页后下载首张。修:ImageViewer emit('download', current);其余 viewer emit props.item;ViewerHost.onDownload(entry?) 用 entry??currentItem。
- **#2 async onMounted 无 unmount 守卫→孤儿自动播放器/泄漏**:await import/fetchFromUrl 期间关闭,onBeforeUnmount 时实例仍 null 跳过销毁,promise 后建成停不掉的播放器。MediaViewer(音/视频)+CodeViewer(EditorView on null host)。修:disposed 标志,每个 await 后 if(disposed)return+销毁已建实例。
- **#3 ESC 关闭缺失**:spec D-DISPATCH+plan Task 2 三处要求,但 Task 2 code 块漏写(prose 有 code 无),实现者照抄。修:ViewerHost 加 keydown Escape→open 时 close()。
Minor(择要修):Code/Markdown getContent 失败 try/catch+toast;视频白名单 hoist fileCategories(panelMap+mediaKind 同步);coerceContent 防御(typeof/`.content`);ViewerShell/Dialog 按钮 type=button;删死 .audio 类+未用 vi import;renderMarkdown XSS 回归测试。
→ 派 1 个 fix subagent 带完整清单(skill 规矩:一个 fixer 不逐条),修完重跑 test/tsc/build + 再复审。

### 终审修复复审 = Ready to merge: Yes
fix commit d1d4abb 复审通过:3 Important 全修好(翻页下载 payload / disposed 守卫每 await 后且构造前无 await / ESC 配对监听),minor 全到位,无回归,仅 2 个可忽略风格 nit(onDownload 数组包裹写法、报告 type=button 数量笔误)。

## ✅ SP4-P4a 完成(subagent-driven,2026-07-06)
- New-UI `master` HEAD = **d1d4abb**;全量 455/455 测试 + vue-tsc 0 + vite build 绿 + 部署 /app/ HTTP 200。
- 提交序:e4f9120(panelMap)→d127e2c(useViewer)→ad3755e(fileCategories 重构)→76f3d10(ViewerShell,含 auth WIP 夹带)→e8ca15b(ViewerHost+接线)→271b796(ImageViewer)→620b67c(CodeViewer)→cea9389(babel/runtime 修 build)→33fd528(MediaViewer)→c3e492d(MarkdownViewer)→d1d4abb(终审修复)。
- roadmap `docs/vue3-migration-sp3`@46085dee 已勾 P4a。均本地无 remote,推 GitHub 由用户。
- ⏳ **待用户真机眼验**(jsdom 测不出):见下方清单。未翻 strangler(Vue2 /files 全程安全网,P8 才翻)。

## 真机验收反馈修复(2026-07-06)
- ✅ **#3 改代码脏确认框被盖、退不出**(用户猜「层级太低」正确):Dialog/AlertDialog z-index 101<查看器 overlay 200→确认框渲染在其下。已提到 1000/1001(commit bf51807,已部署)。
- ℹ️ **#4 视频点进度条跳到最后**:非我方 bug——后端 `/v3/file` 用 `http.ServeFile` 完整支持 Range/seek。多为该视频编码(moov atom 非 faststart)未完全加载前 seek 索引不准,符合「有时候/加载不完全」。前端无解,属逐视频编码差异。
- ✅ **#1 图片查看器两个 ✕**:全仓代码只有 ViewerShell 一个 ✕(`✕` U+2715);FilesShell 是「‹ 回主页」非 ✕;overlay 无定位祖先应覆盖全视口。**代码读不出第二个 ✕ 来源,需用户截图**。疑点:viewerjs `button:false` 若 v3 inline 下失效会多一个 viewerjs 原生 ✕(但仅图片)。
- ✅ **#2 图片背板放大图**:疑 viewerjs inline 下 slot 原始 `<img>`(全分辨率无约束)可见=放大背板,`.viewer-canvas` 棋盘格被盖。Vue2 `_filebrowser.scss` 曾 `.viewer{display:none}` 隐藏源图。**需截图确认 DOM 再精准修,避免盲改**。md 正常。

## #1+#2 修复(2026-07-06,截图确认后)
截图确认:#1 第二个 ✕ = viewerjs 自带 `.viewer-button`(button:false 在 v3 inline 下失效);#2 = viewerjs inline slot 源图(全尺寸)当背板铺底、棋盘格被盖。两者均 viewerjs inline 固有毛病,CSS 硬盖有 init 时 display:none 被 viewerjs 跳过致画布空白的风险。
**修:弃 v-viewer/viewerjs,ImageViewer 改单 <img>+CSS transform 自实现(缩放/旋转/平移/滚轮/拖拽/换图复位/棋盘格),工具栏·翻页·自动隐藏行为不变。移除 v-viewer+viewerjs 依赖。** commit 见 git。tsc 0 + imageNav 3/3 + build 绿 + 部署 /app/ 200。⏳ 待用户真机复验。
- 注:这是对 spec「图片用 v-viewer」的有意偏离——viewerjs inline 两个毛病无法干净修,自实现 UX 一致且确定性无 bug。
