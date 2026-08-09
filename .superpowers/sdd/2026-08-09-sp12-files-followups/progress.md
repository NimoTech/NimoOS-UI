# SDD 台账 —— SP12 Files 后续批次(在 sp12-files-fixes 分支上继续)

工作树:`.claude/worktrees/sp12-files-fixes` · 分支 `sp12-files-fixes`
起点:F17/F11/F12 那批收官的 HEAD `6d35239`(21 提交)

## 0. 开工前的取证与两处改判

机主要求「继续在 files fix 分支上做 Files 同步任务」。开工前把清单
(`NimoOS-UI/docs/vue3-pending/01-文件区-SP4.md`)剩下的条目逐条对 Vue2 `origin/main` 取证,
**两条被推翻**(同 F14/F11 的教训:清单条目照挑必踩空):

- **F3 收藏项右键菜单 —— 不是同步缺口**。Vue2 `src/components/filebrowser/sidebar/` 整个目录
  零 `contextmenu`/`ctxMenu` 命中,`TreeListItem.vue` 只有悬停删除 ×,与 New-UI 现状一致。
  它是 roadmap 排的**新功能**,不是「Vue2 有我们漏做」。
- **F4 视频封面 —— 不是同步缺口,且后端做不到**。Vue2 `mixin.js:31`
  `hasThumbImageType = ['png','jpg','jpeg','bmp','gif','webp','svg']`,视频照样落通用图标;
  core 侧 `grep -rn "ffmpeg\|ffprobe" --include=*.go` **零命中**,`GetFileImage` 的 thumbnail
  分支只走 Go 图片解码,解码失败**会 fall through 去发原文件全量字节**
  (`NimoOS/route/v1/file.go:1155-1168`)—— 也就是说给视频开缩略图 = 每个网格瓦片下载整个视频。
  Photos 服务只有按 asset id 的缩略图端点,没有按路径的。⇒ **F4 需要后端先做,前端单方面做不了**。

机主在此基础上选定本批四项:票 E · plan-b 收尾两小件 · F10 · F3/F4。

## 1. 基座:先把 master 合进来

分支停在 master `3da4135`,而 master 已走到 `6f8f742`(含 plan-b 冲突弹窗 `9100418`、SP14、SP16)。
票 E 与 plan-b 收尾要改的代码在旧基座上**一行都不存在**,机主拍板合 master 进来。

- 合并预演 exit 0 → `git merge` 无冲突(合并提交 `83d279b`)
- **顺带落盘**:F17/F11/F12 那批的 14 份台账**从来没进过 git** —— 旧基座上
  `.superpowers/sdd/.gitignore` 还在静默吞它们,master 的 `0eec6ad` 才修掉。已补提交 `194f4a6`。
- **⚠️ 新教训(值得进记忆)**:merge/checkout 也会断 pnpm 硬链接。合完 `vue-tsc` 报
  `agentStore.ts:1134` 参数个数不对,而该文件与 master 一字不差 —— 根因是 git 的原子重命名换掉了
  `packages/service/` 那一侧,`node_modules/.pnpm` 还留着旧 inode 的旧 `ai.ts`(`confirmAgentAction`
  还是 3-4 参版本)。`stat -c '%i %n'` 两侧 inode 不同即可确诊,`pnpm install` 重链后 tsc 干净。
  CLAUDE.md 原文只把这条记在「编辑器保存/Edit 工具」名下,**checkout 类操作同样触发**。
- 合并结果上重跑五门:tsc 0 · 全量 **679 文件/10951 例** · parity+oss 8/155 · build 0

## 2. 四项改动

| # | 内容 | 提交 |
|---|---|---|
| 1 | plan-b 收尾 a:受保护目录的拒绝挪到冲突弹窗**之前** | `7d2bcf6` |
| 2 | plan-b 收尾 b:删三个孤儿 i18n 键 | `81e690a` |
| 3 | F10:多选删除改成「删可删的 + 告知跳过」,并把警告挪到确认框 | `df74cc6` |
| 4 | 票 E:冲突弹窗提到 App 级 | `9dedba4` |
| 5 | F3:收藏项右键菜单 | `98736f9` |
| — | 收尾:守卫夹具换 `Downloads`(见 §3) | `36ea94c` |

### 1 受保护目录前置(plan-b outstanding #7)
新纯函数 `splitProtectedUploads`(`src/files/util/protect.ts`),与
`uploads.addFilesToQueue` 里那条 `PROTECTED.includes(relativePath.split('/')[0])` **逐字等价**;
`Files.vue:commitSelectedFiles` 在 `resolveEntries` 之前分流并 toast。store 侧的检查**保留**
作最后一道防线,它的返回值照旧上报(现在应恒为空)。
RED 自证:改前两条视图测试真红(第一条因为旧代码真去弹窗了、`await` 挂到 5007ms 超时)。

### 2 孤儿 i18n 键
`filesUploadOverwrite` / `filesUploadRename` / `filesUploadSkip` —— plan-b 换代后
`UploadPanel.vue` 的旧逐文件弹窗被删,这三个按钮文案随之无人引用(全仓 `grep -rnw` 只剩定义本身
+ 一处测试夹具)。删除后 `messageSyntax.test.ts` 的撞车表**如期变红**(它断言 forbiddenKey
必须是 string),证明那张表是真在生效的;同步删掉那一行并把对数 27→26 / en 25→24。
同语义(重命名: Renamed vs Rename)仍由 `filesRename`、`photosPersonMenuRename` 两对守着。

### 3 F10 多选删除
- 新纯函数 `deletableEntries`(与 `shareableFolders` 同形)
- `useFileOps.remove` 由「有一个不可删就整批 return」改成「删可删的 + toast 跳过数」,
  只有**全都不可删**才走原来的 `filesProtectedDelete` 文案
- **确认框是重点**:原来先按原始条数报「确定删除选中的 8 项」,用户点完确认才吃到受保护 toast、
  实际删 0 项。现在 `askDelete()` 先分流,新键 `filesDeleteConfirmWithProtected` 同时报
  「要删几项 + 另有几项受保护会跳过」,全可删时仍用原文案
- 断言落在**渲染出的 AlertDialog 的 message prop** 上,不是内部计算属性 —— 算得对但没接到弹窗
  上的实现不会通过

### 4 票 E:弹窗提到 App 级
plan-b 交接文档「已知未修 #1」明确建议独立开票:`onScopeDispose` 只能兜住**当前正在等**的那一批,
排在 `chain` 后面的下一批、或 `listFolder` 还没返回就被拆掉的那一批,轮到它时会 `ask()` 到一个
已经不存在的弹窗上,**永久挂起**(用户拖进去的文件静默蒸发)。

做法与票 A 把 unloadGuard 提到 `App.vue` 同理:
- 新 `src/files/stores/uploadConflicts.ts` = `defineStore('uploadConflicts', () => useUploadConflicts())`
  —— composable **一行未改**,它自己那 20 个测试照旧直接构造它;store 只是给它一个「生命周期属于
  app 而不是某个视图」的宿主。Pinia setup store 的 effect scope 属于 pinia 实例 ⇒ 那个 dispose
  钩子改成在 app 拆除时才响,而测试每次 `createPinia()` 仍拿到干净实例
- 新 `UploadConflictHost.vue`(零逻辑,只渲染弹窗)挂在 `App.vue`,与 `AppToast` 并列
- `Files.vue` 改读 store、模板里删掉弹窗
- **注意 Pinia 解包**:store 消费方读 `store.dialog.open`,不是 `store.dialog.value.open`
- 变异验证:把 `Files.vue` 改回 `useUploadConflicts()` 自己 new 一份 ⇒ 三条生命周期测试**全红**
- 既有的 `Files.uploadConflict.test.ts`(9 例)随之改成挂 App 形状的 wrapper(Files + Host 并列),
  与 `App.vue` 同构;测试驱动的是 `w.findComponent(Files).vm`

### 5 F3 收藏项右键菜单
收藏项只存 `{name, path}`,而菜单要 `is_dir` + `extensions.share/mounted`。
**只有文件夹能被收藏**(`FileContextMenu` 的 `showFavorite` 就是 `!!entry?.is_dir`)⇒ `is_dir` 已知;
`extensions` 只能来自父目录 listing。菜单在原生 contextmenu 上**同步**打开,来不及先 await,
所以:右键即合成 `{name, path, is_dir: true}` 打开菜单,listing 回来后**若菜单还在讲同一个收藏项**
才替换(防连点两个收藏项时被前一个的迟到响应覆盖);listing 失败就用合成项撑着 —— 无 extensions
读起来正好等于「既没共享也不是挂载点」,而已共享的文件夹即使误显示「共享」,F12 那层过滤也会
以 toast 收场,不会打到后端报 SHARE_ALREADY_EXISTS。

动作不在侧栏处理:`FilesSidebar` 只 `emit('ctx-action', action, entry)`,`Files.vue` 用**同一个**
`onCtxAction` 分发,新增第三个参数 `targets`(默认 `ctxTargets(entry)`)让侧栏把被点收藏项**强制**
成唯一目标 —— 否则收藏项恰好也在列表选区里时,右键它会作用到整个选区(F11 那个失败模式,高一层)。
- **测试差点因为错的理由通过**:第一版让收藏项**不在**选区里,那样默认路径与强制路径返回的都是
  同一个单项,断言两边都过。改成把收藏项**放进**选区后,去掉强制目标 ⇒ 两条真红。

## 3. 收尾门(控制器实测,HEAD `36ea94c`)

| 门 | 结果 |
|---|---|
| `vue-tsc --noEmit` | exit 0,零输出 |
| `pnpm test` 全量 | **683 文件 / 10983 例 零失败**(exit 0) |
| `vitest run oss/ src/i18n/parity.test.ts` | 8 文件 / 155 例 |
| `pnpm build` | exit 0(唯一提示是既有 >500kB chunk 体积告警) |
| `git merge-tree --write-tree HEAD master` | exit 0 + 单行 tree OID `e1f1c20` = 无冲突 |

**中途红过一次,是本批引入的真缺口**:全量跑里 `oss/tree.test.mjs` 的泄漏守卫命中 3 处
`Gallery`(我在新测试里拿 `/DATA/Gallery` 当「受保护目录」举例)。查 `oss/forbidden.mjs:230-238`,
`gallery` 词条已有一批**精确白名单**,命中的都是 `/DATA/Gallery` 这类用户路径(偶发词形碰撞),
`protect.ts` 的 `PROTECTED` 列表就在其中。本可照此加白名单,但这几个夹具要的只是**某个**受保护目录名,
换成 `Downloads` 更便宜 ⇒ 不花白名单额度。(与上一批「跨区引用注释」那次不同:那次是真悬空引用,
必须改写;这次是纯碰撞,换个词即可。)

另:未提交的工作区改动会让 `oss/export.mjs` 的 `checkClean` 拒绝导出(`--allow-dirty-oss` 只放行
`oss/` 下的脏),表现为另外 3 条 export 测试红。**跑 oss 门前先提交**。

分支现共 **29 提交**(`3da4135..36ea94c`,含 1 个合并提交)。

## 4. 没做 / 挂账

- **F4 视频封面**:见 §0,需后端先做(core 加 ffmpeg 抽帧 + 缓存,或 Photos 开按路径的端点)。
  建议开 NimoOS core 票。**前端单方面能做的只有 `<video preload=metadata>` 抽帧,会让每个网格瓦片
  拉视频头部若干 MB,在 NAS 大目录上不可接受,不建议。**
- **`cut` 仍是 all-or-nothing**(`useFileOps.ts:89` 那条 `some(...)`)。与 F10 同族,本批只做删除。
  照抄 `deletableEntries` 的模式即可,注意剪切的语义是「移动」,跳过项的文案要另拟。
- **plan-b 已知未修 #2/#5/#6** 未动(重传+类型不匹配静默降级 / `:queue-index` 的取证缺口 /
  「已跳过 500 项」按条目计)。
- 本批**一步真机验收都没跑**,清单见交接文档。
