# SDD ledger — plan: docs/superpowers/plans/2026-08-09-sp12-files-a-batch.md

分支 `sp12-files-fixes`,worktree `.claude/worktrees/sp12-files-fixes`。
BASE(计划提交后的起点) = `d7e2034`。

## 开工前扫描(pre-flight)

- **计划内代码块的注释是中文,而 Global Constraints 要求「代码注释一律英文」。**
  裁定:**CLAUDE.md 的硬要求优先**。计划里代码块的中文注释属于计划层面的讲解,
  实现者落盘时一律写英文注释;不要逐字照抄中文。已写进每个 dispatch。
- Task 2 让 `cut` 先写成 `clipboard.operate('move', targets.map(e => e.path))`,
  Task 3 再改成传 entry —— 这是有意的时序,不是矛盾。
- 其余无自相矛盾之处。

## 进度

Task 1: 实现完成,提交 `722ca7b`(Files.vue 抽 `teardownMarquee()` + `onUnmounted` 调用 + `data-marquee-surface`;新测试文件)。26 例绿、vue-tsc 干净。
Task 1: 评审 —— spec ✅;质量 1 条 Important(测试 2 的 `not.toThrow()` 恒真,零回归保护)。
Task 1: **控制器裁定** —— 该发现与计划里那段字面测试代码冲突,但**计划自身的 Global Constraints「测试必须能因正确的理由变红」优先**。计划里那条弱断言是我(控制器)写的缺陷,不是实现者的。判:加强,不删。实现者与评审员**各自独立**做过变异验证,结论一致(删掉整个 `onUnmounted` 那条测试照样绿),证据充分。
Task 1: fix round 1/5 —— 实现者重写了测试,但回 BLOCKED 要求裁定:**我指定的单行变异(只注释 `teardownMarquee()`)让新测试变红是不可能的**。
Task 1: **控制器裁定 2** —— 实现者是对的,错的是我的变异要求。`onUnmounted` 里有两件事:`armed = false` 与 `teardownMarquee()`。只删后者时,泄漏的 mousemove/mouseup 因 `armed === false` 全部早退 ⇒ **唯一残留后果是内存泄漏,不是可观察行为**;要对这个单行变异变红就只能断言监听器数量之类的实现内部量,而那正是一开始就否掉的做法。判:**以「删掉整个 `onUnmounted` 钩子」为这条测试的变异门**。覆盖仍然完整 —— 删单行 → 测试 1(selectstart)红(第一轮已验证);删整个钩子 → 两条都红。要求在测试文件里用英文注释如实写明它盯什么、不盯什么。
Task 1: fix round 1/5 (1 addressed, 0 open; commits `722ca7b`..`49f9d44`)。复评员**自己动手**做了变异验证(注释掉整个 `onUnmounted` → 两条都红,选区从 `{'/DATA/Documents'}` 变 `{}`;恢复后 26/26 绿,工作树干净),不是转述报告。注释无过度宣称。
Task 1: complete (commits `d7e2034`..`49f9d44`, review clean)

Task 2: 实现完成,提交 `8a27872`。⚠️**实现者又把测试丢后台 Monitor 然后停下等,没回报状态** —— 但活是干完并提交了(工作树干净、`deletableEntries` 全仓零残留)。控制器自己前台跑了 56 例全绿取证。**这条坑记忆里早有记载(subagent-foreground-tests),dispatch 里明写了「前台跑」仍然复发 ⇒ 判断活干没干要看 `git status`/`git log`,不要等它回报。**
Task 2: 评审 —— spec ✅ / 质量 Approved,零 Critical/Important/Minor。评审员**自己做了变异验证**:把 `cut` 改回老的整批拒绝 ⇒ 3 条新测试**红 2 条**(正确原因);第 3 条(全不可剪)新旧逻辑在该边界重合故不红,**实现者报告里已主动如实披露**,未虚报保护力。恢复后 56/56 绿、工作树干净。
Task 2: `Files.vue` 两行改动经判定合规 —— 是 `deletableEntries`→`operableEntries` 改名的必然传播(brief 要求全仓零残留),非无关重构。
Task 2: complete (commits `49f9d44`..`8a27872`, review clean)

Task 3: 实现完成,提交 `d4b8aa1`。`OperateItem` 带上 `is_dir`,`operate()` 改收 entry。实现者做过 stash-and-revert 红检,并主动报告签名变更波及 4 个 brief 未点名的测试文件。
Task 3: 评审 —— spec ✅ / 质量 Approved。评审员逐字核对 `isCut` 与 Task 2 那三行 `cut` 未被改动;判定 4 处波及为**必要传播、无断言弱化**;自己做了变异验证(把 `is_dir` 从 `operate` 拿掉 ⇒ clipboard 测试真红,恢复后绿、树干净)。
Task 3: minor (deferred): `src/files/stores/clipboard.test.ts` 有一处被改动但未翻译的中文测试描述,违反「测试描述一律英文」。纯外观,不阻塞;**交终审统一裁**。
Task 3: complete (commits `8a27872`..`d4b8aa1`, review clean)

Task 4: 实现完成,提交 `73bebf6`。新建 `src/files/upload/pasteConflict.ts` + 测试,7 例;确认只新增 2 文件、零既有文件改动。
Task 4: 评审 —— spec ✅ / 质量 Approved。评审员**对照 Vue2 上游原文**核了移植保真度,并自己做了变异验证(删 overwrite 分支 ⇒ 1/7 真红,恢复后 7/7 绿、树干净)。关键语义(不撞名条目与显式 keep_both 同落 rename 组)实现正确且**英文理由写在三处**,防后人误当 bug 修掉。
Task 4: minor (deferred): `groupKey` 用源路径的唯一性前提**只在注释里声明,未被强制或测试**;若将来一个批次跨多个源目录且 `from` 撞车会静默错路由。当前剪贴板批次单源,不构成缺陷。
Task 4: minor (deferred): `items || []` / `resolutions || []` 空值兜底在类型签名下不可达,纯风格。
Task 4: complete (commits `d4b8aa1`..`73bebf6`, review clean)

Task 5: 实现完成,提交 `8a71526`。纯机械改名:`useUploadConflicts`→`useFileConflicts`、store id `uploadConflicts`→`fileConflicts`、`UploadConflictHost.vue`→`FileConflictHost.vue`。实现者另找出 4 个 brief 未列的引用点并修掉。
Task 5: 评审 —— spec ✅ / 质量 Approved,零问题。评审员**逐 hunk 核了全部 693 行**,确认每一处改动都落在「标识符改名 / import 路径 / brief 授权的新增注释」三类内,**没有任何条件判断、默认值、await、错误处理或 chain/resolver 逻辑被顺手改动**;`--name-status` 显示 4 处均为 `R`(真 `git mv`);旧 store id 全仓零命中;同名但不相干的 `upload/uploadConflict.ts`、`upload/fileConflict.ts` 未被误伤。43 例绿。
Task 5: 备注(非缺陷) —— `Files.uploadConflict.test.ts` / `Files.conflictHostLifetime.test.ts` 两个测试**文件名**仍含 `uploadConflict`,但它们测的确实是上传冲突,名副其实,不改。
Task 5: complete (commits `73bebf6`..`8a71526`, review clean)

Task 6: 实现完成,提交 `6c0d9c6`。`useFileConflicts` 新增 `resolvePaste`,复用既有 `ask`/`chain`/`listFolder`。23 例绿(19 既有 + 4 新)。实现者自己做过 chain 变异验证,并**主动标出**「`resolvePaste` 不像 `run()` 那样在 `finally` 复位 dialog」这一点。
Task 6: 评审 —— spec ✅ / 质量 Approved。评审员把实现者标的那条**逐路径查实,判定不是缺陷**:①逐个答完 → 每次 `settle()` 无条件置 `open=false`;②Esc 取消 → `settle(null)` 同样关掉当前那个,之后不再调 `ask()`,不存在残留弹窗;③`listFolder` 抛异常发生在任何 `ask()` **之前**,`resolver`/`dialog` 未被触碰,且 `chain = p.then(()=>undefined,()=>undefined)` 吸收掉 reject,链不会被拖垮;④下一批不吃脏状态,因为链严格串行且 `ask()` 每次**整体覆盖全部字段**。评审员独立复现了 chain 变异(23→22+1 红,红的正是「共用串行链」那条),恢复后 23/23 绿、树干净。
Task 6: minor (deferred): 粘贴成功答完后 `dialog.value` 不像 `run()` 那样精确复位成 `CLOSED`(`open:false` 但 `name`/`targetPath` 等仍是最后一个冲突的值)。当前消费者按 `open` 门控渲染故无影响。
Task 6: minor (deferred) **→ 已带进 Task 7 的 dispatch**: `run()` 对 `fetchExistingNames` 失败有优雅降级(warn + 全部按原样入队),`resolvePaste` **没有等价降级** ⇒ 网络抖动会让整批粘贴直接 reject,与上传路径**不对称**。属 brief 给定代码的原样实现,留给接线任务处理更合适。
Task 6: complete (commits `8a71526`..`6c0d9c6`, review clean)

Task 7: 实现完成,提交 `7b8f966`+`29a3af9`。粘贴收口:两档菜单收成一个「粘贴」、走 resolvePaste、拆两批 `batch.task`、删两个孤儿 i18n 键。279 例绿。
Task 7: 评审(opus) —— spec ✅(工具栏按钮、快照防线、i18n 删除都核过,变异验证他自己跑的:删掉 renameItems 那次提交 ⇒ 2 条真红);质量 **2 Important + 3 Minor**。
Task 7: **控制器裁定 —— 评审员的「顺带」那条是错的,已核实驳回**。他说 `pasteConflict.ts` 顶部「Ported from Vue2 pasteConflict.js」是失实溯源、称 Vue2 无此文件。实为:`NimoOS-UI` 当前检出 `docs/vue3-migration-sp3` 分支,**工作树里没有,但文件存在于 `origin/main`**(`git cat-file -e origin/main:src/components/filebrowser/pasteConflict.js` 通过)。**该仓比对 Vue2 上游必须用 `git show origin/main:`,看工作树会得出相反结论**(这条坑记忆里早有记载,评审员正好踩中)。注释是对的,不改。
Task 7: **控制器裁定 —— 把评审员标为 Minor 的「Esc 取消导致剪贴板被清空」升级为必修**。理由:属用户数据静默丢失,且 brief 当初只推理了「全部 skip」未覆盖 cancel 路径。同时把「接线缝无测试」也升级(本任务本身就是接线,唯一的缝没测等于白做)。
Task 7: fix round 1/5 (5 addressed, 2 new open; commits `29a3af9`..`5221028`) —— F1 目标目录跨 await 漂移(TOCTOU,会导致「对 A 目录问的答案套到 B 目录落盘」的无询问覆盖) · F2 部分失败收尾误导+**报告里的辩护理由是反的**(那批文件正躺在目的目录里,重粘贴一定会再被当冲突;move 场景下源路径已消失) · F3 Esc 清剪贴板 · F4 接线缝补测试 · F5 中文测试描述。
Task 7: 复评(opus) —— F1/F2/F3/F5 全部 ADDRESSED,复评员自跑两个方向变异(dest 改回实时读 ⇒ F1 测试真红;cancel 分支去掉 ⇒ F3 测试真红),恢复后 13 文件/316 例绿、树干净。F2 的代码修法**与报告里那句错误结论的更正**两件事都做到了(报告里原地划掉并显式 retract)。F3 的判据落在 `action === 'cancelled'` 这个硬值上,不是「两个数组都空」之类的间接推断。
Task 7: **复评发现 2 条新 Important(进 fix round 2)**:
  - **N1 F4 那条接线测试是假绿** —— `Files.test.ts` 的 `beforeEach` 缺 `vi.clearAllMocks()`,而 `service.batch.task` 是模块级 `vi.fn()`;前一条「工具栏粘贴」已留下 `{style:'rename',to:'/DATA'}` 的调用记录 ⇒ 后一条的 `toHaveBeenCalledWith` **即使分发器彻底坏掉也命中**。复评员取证:把 `case 'paste'` 改成 `case 'paste-overwrite'`,两条一起跑全绿,单独跑才红。**F4 本要防的回归在 `pnpm test` 里根本抓不到** —— 又一例「测试因为错的理由而通过」。
  - **N2 `submit()` 吞掉后端错误消息** —— `catch { return 'failed' }` 丢了 error,粘贴到只读挂载点时旧版会显示后端的「权限不足」,新版只弹死板的「操作失败」;而同函数内 `resolvePaste` 那条 catch 仍保留 `errMsg(e,...)`,两套呈现不一致。
Task 7: minor (deferred→顺手修): `filesPastePartialFailure` 文案写「请检查目标目录后**重试**」,而挂账的残留局限恰恰是「重试会再弹冲突/对已消失源路径动作」—— 文案在邀请用户走进已知坑,去掉「重试」二字。
Task 7: F2 残留局限经复评判定**如实无粉饰、可挂账**:部分失败后剪贴板保留完整原始条目表,copy 重试会再弹冲突、cut 重试会对已消失源路径动作;触发条件窄(必须一批成功一批失败)、**无数据丢失**、有专门 toast 提示。真修需跨批次持久化逐项完成态,超出本票。
Task 7: fix round 2/5 进行中 —— N1 / N2 / N3。
Task 7: fix round 2/5 (3 addressed, 2 new open; commits `5221028`..`c2233fb`)。复评员自跑变异:N1 整文件跑 1 failed/25 passed → 恢复 26 passed;N2 换回硬编码 3 failed/37 passed → 恢复 40 passed。
Task 7: **复评用真探针实测,推翻了实现者对 N1 的根因诊断**。实现者称「`wrapper.vm.$emit()` 在这个 Vue/VTU 组合下不触发父监听器」——**证伪**:独立最小复现里 `child.vm.$emit()` 后 spy 调用数=1,父监听器正常。真根因只有一个:**`Files.vue` 树里有两个 `FileContextMenu` 实例**(`:621` 侧栏收藏 / `:681` 主列表),`findComponent`/`findAll` 默认命中**侧栏那个**,而它的 `onFavoriteAction` 对 `entry === null` 是**有意 no-op** ⇒ 事件发出去了只是打错实例。与后来 DOM 层的 `.ctx-paste` 二义性是**同一个** bug。**该错误结论已被写成 `Files.test.ts:213-222` 的永久注释,必须更正**(否则既误导后人,又遮住真正可复用的教训)。
Task 7: 复评顺带 grep:`vm.$emit` 在全仓测试里 **0 处**使用 ⇒ 无同类假绿残留,不必另开票。
Task 7: **复评发现 N2 的修法把 F2 的修复抵消了(Important)** —— `errMsg(failures[0].error, t('filesPastePartialFailure'))` 的语义是「有 message 就用 message」,**只要后端说了话(只读挂载点等常态)`filesPastePartialFailure` 就整个被吞**,用户不知道已有一半落地;且全失败分支在同样情况下文案**一模一样**,两种情形彻底无法区分 —— 而这正是 F2 要解决的问题。新测试还把它**钉成了预期行为**。判:改成**拼接**(给文案加 `{reason}` 占位符),并把钉错方向的测试改成断言两者都在。
Task 7: minor (deferred): 两批都失败时只呈现 `failures[0].error`,第二个原因被丢弃(异因场景漏信息)。
Task 7: 范围外记账: `useFileOps.ts:82` 另有一处 `catch { toast.show(t('filesOpFailed')) }` 不带 `errMsg`,与 N2 想统一的呈现方式不一致,不在本 diff 内。
Task 7: fix round 3/5 进行中 —— M1 更正错误根因注释 / M2 拼接文案 / M3 挂账。
Task 7: fix round 3/5 (3 addressed, 0 open; commits `c2233fb`..`5dfb3f2`)。复评员**自己插探针跑 vitest 实测**,把新注释逐句核准(`vm.$emit` 监听器调用数=1 证实技术本身有效、`FileContextMenu` 计数=2、`findComponent === all[0]`=侧栏那个、`all[0]` emit ⇒ batch.task 0 次 / `all[1]` ⇒ 1 次),确认「注释里没有一句是无法直接确认的断言」;探针已撤。报告里 round-2 那段错误教训是**被删掉并替换**成显式 retraction,不是只加新段。
Task 7: M2 拼接后经实测确认两种情形**真的可区分**(部分失败=「部分文件已粘贴,另一部分失败(read-only filesystem),请检查目标目录」;全失败=「read-only filesystem」),框架恒在、只有括号内原因随后端变。变异验证:改回 errMsg 替换式 ⇒ 2 failed/39 passed,恢复后 41 passed、树干净。
Task 7: M3 实现者选择了修而非挂账(`[...new Set(...)].join('; ')` 去重);复评附带确认 partial 分支用 `failures[0]` 不是同类漏报(该分支下 failures 按构造最多 1 条)。
Task 7: minor (deferred): `useFileOps.test.ts:423` 的 `not.toHaveBeenCalledWith(zh.filesPastePartialFailure)` 在文案加了 `{reason}` 之后**已成恒真断言**(未插值的原始模板永远不可能被 show),该行现在守不住任何东西 —— **又一例「测试因为错的理由而通过」**;要留就该改成 `expect.stringContaining('部分文件已粘贴')`。
Task 7: minor (deferred): 报告 line 324-332(round-2 §N1 正文)那句被证伪的结论**原地未加更正标记**,更正在 130 行之后 ⇒ 顺序阅读者会先吃到假结论。
Task 7: minor (deferred): `Files.test.ts:44-45` 的 stub 注释仍写 "unlike calling `.vm.$emit()` directly … why that doesn't work",措辞仍带旧诊断味道(该说法只对 `findComponent(...)` 那条路径成立)。
Task 7: minor (deferred): 注释里 "FilesSidebar.vue's own copy (around Files.vue:621)" —— 621 行是 `<FilesSidebar>` 挂载点,`FileContextMenu` 本体在 `FilesSidebar.vue:220`,按该行号去找会扑空。
Task 7: complete (commits `6c0d9c6`..`5dfb3f2`, review clean after 3 fix rounds, 4 minors deferred)

Task 8: 实现完成,提交 `8635800`+`399c367`。面包屑最后一段改 `<span>`、hover 收窄到 `button.crumb:hover`;表头 `cursor:pointer` 收到 `.head-cell.is-sortable`。1311 例绿(含 `src/styles/` 守卫)。实现者**主动标出**「当前段仍从 `.crumb` 基类继承 `cursor:pointer`」但按 brief 字面留着没动。
Task 8: 评审 —— **spec ❌ 1 条 Important**:实现者标的那条**是真缺口**。手型光标是最强的「可以点」信号,而该元素已被证明点不动;同一任务的另一半(表头空列)做的**恰恰就是**把 `cursor:pointer` 从不可点格子上收走,两半自相矛盾;计划验收清单原话也是「无 hover 反馈」。**brief 的意图优先于它给的 diff 字面。**
Task 8: 评审实证 **我设计的那条 CSS 正则守卫可被绕过(Minor)** —— 在既有正确规则旁加一句 `.col-check, .col-star { cursor: pointer }`,**四条测试全部照过**,因为它只认字面 `.head-cell` 选择器。**控制器裁定升级为必修**:这一批已出现四次「测试因为错的理由而通过」,而这条守卫是本任务防回归的唯一手段,它自己是假的等于没有。改用既有的 `src/styles/cssCascade.ts` 按优先级真算层叠。
Task 8: 评审变异验证(自跑):面包屑改回单一 `<button>` ⇒ 恰好 2 条目标测试红,恢复后 10/10 绿、树干净。硬编码兜底色的清理**范围正确**(只动了要改的两条规则,没有顺手扫全文件)。
Task 8: fix round 1/5 进行中 —— F1 `cursor:pointer` 从 `.crumb` 基类挪到 `button.crumb` / F2 守卫改用 cssCascade 真算层叠。
Task 8: fix round 1/5 (2 addressed, 0 open; commits `399c367`..`2bb51b5`)。复评员自跑两个方向变异:F1 把 cursor 挪回基类 ⇒ 目标测试红,恢复 8/8 绿;F2 加回上一轮实证能绕过的那句 `.col-check,.col-star{cursor:pointer}` ⇒ 2/5 红,恢复 5/5 绿;并额外试了无空格变体 `.col-check{cursor:pointer;}` 也被拦住。树干净。
Task 8: 复评核实实现者的关键决策**属实** —— `cssCascade.ts` 的 `hoverBackgroundRules`/`winningHoverBackground` 确实算不了 `cursor`(硬编码 `BG_DECL` 只认 background 三件套、要求选择器含字面 `:hover`、`classSpecificity` 从不计元素类型选择器);他改为基于**未修改的** `parseCssRules` 自建守卫,是**真的按选择器匹配算层叠**,不是换写法的正则;`git diff --stat` 确认 `cssCascade.ts` 一字未动。
Task 8: minor (deferred): 新守卫仍有一类绕过 —— **选择器里不含任何字面 `.class` 时会被静默跳过**(`* { cursor: pointer }` / `[class*="col-"] { cursor: pointer }` / 裸类型选择器),因为两个 helper 都要求 `classHits.length > 0` 才考虑该选择器。复评实证这两种写法下 5 条测试全绿而真实浏览器里手型会漏到空格子上。实际风险窄(本仓无人用裸通配/属性选择器写 cursor)。
Task 8: complete (commits `5dfb3f2`..`2bb51b5`, review clean after 1 fix round, 1 minor deferred)

Task 9: 实现完成,提交 `71f8aae`。侧栏收藏项 `<img>` 改走 `iconNameFor({name, is_dir:true})`;加 `.side-fav` 语义类供测试稳固定位。12 例绿。
Task 9: 评审 —— spec ✅ / 质量 Approved。确认**未扩 `Favorite` 类型、未引入任何 usb 判断**(清单原描述已被推翻,不扩才是对的);未传 `type` ⇒ `iconNameFor` 的 usb/sata/nvme/home 分支全跳过,直落按名字查表。评审自跑变异(改回写死 `folder-default` ⇒ 「Downloads→folder-download」真红,其余 11 例仍绿;恢复 12/12)、树干净。
Task 9: 实现者主动披露的「回落用例改前改后都绿」经评审判定为**该测试性质使然、非写错**(旧实现恒返回 `folder-default`,对未映射名字恰好等于正确期望);其价值是把回落行为钉成文档式回归用例,变异保护由第一条用例承担。不整改。
Task 9: complete (commits `2bb51b5`..`71f8aae`, review clean)

Task 10: 实现完成,提交 `4960cd2`+`88e02e0`。刻度尺 `watch(selectedIndex)` → `nextTick` → `scrollIntoView({block:'nearest'})`。17 例绿(15 既有+2 新)。
Task 10: 评审 —— spec ✅ / 质量 Approved。确认无 `behavior:'smooth'`、查询用 `[data-flat-index]` 且 `data-anchor-index` 未被触碰(子刻度撞名那条注释原样保留)、`nextTick` 已等、`railEl` 空值安全退出。评审自跑变异(注释掉整段 watch ⇒ 第一条新测试真红,其余 16 绿;恢复 17/17)、树干净。
Task 10: minor (deferred): 第二条负向测试「选择没变时不滚动」偏弱 —— 只证明「改无关 prop 不触发滚动」,证明不了「选中不变却仍多滚了一次」这类回归(例如有人把滚动逻辑误挪进每次渲染都跑的 `watchEffect`)。更有力的写法:先改 `selectedIndex` 触发一次真滚动 → `mockClear()` → 再改无关 prop → 断言未被再次调用。实现者**主动披露**过该测试在实现存在前就已通过。
Task 10: complete (commits `71f8aae`..`88e02e0`, review clean)

Task 11: 实现完成,提交 `b58e798`+`8d37a33`。`snapshotBrowse` 加 `restoreProgress`,串行循环里推进,`finally` 清空;工具栏显示 `正在恢复 n/N`。228 例绿,vue-tsc 干净。
Task 11: 评审 —— spec ✅ / 质量 Approved。核实 `restoreProgress` **确在 store return 列表里**(`snapshotBrowse.ts:156`,躲过了 Pinia 漏写恒 undefined 的坑);`finally` 同时清两个状态;串行未被改成并发/批量。评审自跑变异(删 `finally` 那行 ⇒ 2 条新测试真红,恢复 34/34 绿)、树干净。
Task 11: `Files.vue` 一行 prop 绑定经判定为**必要接线非越界** —— `SnapshotSelectionToolbar` 全仓唯一挂载点就在该文件,不接线新状态永远到不了 UI。
Task 11: minor (deferred): 测试 `clears the progress even when a restore throws` **名不副实** —— `performSnapshotRestore` 与 `ensureVolumes()` 都自行 catch 转成 `{ok:false}`/`status='error'` 从不 rethrow,当前架构下 `restore()` 无可达 throw 路径;用的是 rejected mock,实际走正常完成的失败分支。**评审判定应改描述用词(throws→fails),而不是为了凑这个词去伪造一条生产代码里不存在的异常路径**。实现者已主动披露。非 tautology(变异能抓),不阻塞。
Task 11: complete (commits `88e02e0`..`8d37a33`, review clean)

Task 12: 实现完成,提交 `b576b62`。守卫改成 `if (!cached || cached.status === 'failed')`,`failed` 重试而 `missing`(404)不重试。15 例绿。
Task 12: 评审 —— spec ✅ / 质量 Approved,零问题。确认守卫**精确只放行 `failed`**(`loading`/`ready`/`missing` 都不重发,避免同卡重复发请求);确认 `previews` 不在 watch 依赖表达式里 ⇒ 写入 `failed` 不自触发、无重试风暴;确认**未加**节流/计数器/退避(过度设计)。评审自跑两方向变异:守卫改回旧写法 ⇒「failed 会重试」红;放宽成 `!== 'ready'` ⇒「missing 不重试」红;两次恢复后 15/15 绿、树干净。
Task 12: 「missing 不重试」那条测试修复前也绿,经判定为**性质使然可接受**(真保护来自方向 2 的变异),实现者已主动披露。
Task 12: complete (commits `8d37a33`..`b576b62`, review clean)

Task 13: 实现完成,提交 `be5b7e9`。删掉 `--tm-star` 两处定义 + 注释里对它的引用;`src/styles/` 1301 例绿。删前 grep 3 处、删后零命中。
Task 13: ⚠️**实现者把一条回归误判成「既存缺陷」** —— 他报告 `src/files/snapshot/` 有 31 条 Errors,称是「jsdom 不支持 scrollIntoView 的既存噪音,与本任务无关」。他用 `git stash` 对照只证明了「与 Task 13 无关」,**没证明「与 Task 10 无关」**。
Task 13: **控制器取证:这是 Task 10 引入的回归**。`git show 71f8aae:src/files/snapshot/TimeMachineRail.vue | grep -c scrollIntoView` = **0**(Task 10 之前该文件根本没有这个调用)。根因:jsdom 不实现 `scrollIntoView`,Task 10 **自己的**测试文件打了桩所以绿,但 `TimeMachineOverlay.test.ts` 也挂载刻度尺、那边没桩;且 watch 回调是 async(内含 `await nextTick()`)⇒ TypeError 变成**未处理的 Promise 拒绝**,用例仍「通过」但套件吐 31 条 Errors。危害:将来真正的失败会被埋在这堆噪音里(同仓记忆里「vitest 默认 reporter 藏告警」是同一类教训)。
Task 13: 已派回 Task 10 的实现者修复,倾向方案 (a) 在全局 `vitest.setup.ts` 补 jsdom 缺口,而非改生产代码。
Task 13 & 回归修复: 评审(合并一次) —— Task 13 spec ✅ / 两件事一起 质量 Approved。
  - Task 13:`tm-star` 零命中、注释保留了仍成立的说明只去掉 token 引用、无 `*` 紧贴 `/`、范围干净(1 文件 +1/-3 无顺手整理)、`src/styles/` 1301 例绿。
  - 回归修复(`e2883de`):选了在全局 `vitest.setup.ts` 补 `Element.prototype.scrollIntoView` no-op,**不改生产代码**。复评实测 `src/files/snapshot/` **Errors 从 31 → 0**;并**自己做了最关键那条变异验证**:注释掉整段 watch ⇒ Task 10 第一条测试**仍然真红** ⇒ **全局 no-op 没有让局部 spy 失效**(局部 `beforeEach` 重新赋值会覆盖全局默认)。
  - 掩盖风险经查:全仓只有 `TimeMachineRail.test.ts` 与 `PhotosSettings.test.ts` 碰 `scrollIntoView`,两者都自己重新赋值、不依赖全局;无测试依赖「该方法不存在」来探测 bug ⇒ 全局桩今天没掩盖任何东西。判定:真实浏览器都实现该方法,jsdom 环境缺口一次性全局补掉是合理选择。
Task 13: minor (deferred): **task-10-report.md 的「Concerns」节把一个文件归错阵营** —— 称 `src/views/PhotosSettings.vue:87` 是防御式 `el?.scrollIntoView?.(...)`,实际是 `el?.scrollIntoView({...})`(只护了 `el` 没护方法),属**无防护**阵营。正确划分是 **3 防御**(`MentionPopover.vue:282`/`SlashPopover.vue:179`/`AppSettingsPage.vue:71`)**vs 3 无防护**(`Files.vue:457`/`MediaViewer.vue:205`/`PhotosSettings.vue:87`,加上 `TimeMachineRail.vue:86`),不是报告写的 4-vs-2。结论不变(确实存在两派写法、统一不在本期范围),但报告是后人会引用的纸面记录,此处以台账为准。
Task 13: complete (commits `b576b62`..`e2e7852`, review clean)

## 13 个任务编码全部完成。以下为收尾门与整支终审。

### 收尾门(控制器亲自跑,非转述)

⚠️**第一次跑全量暴露了两类各任务单独跑时看不见的问题(4 条失败)**:
- **A. Task 3 的 `OperateItem` 加 `is_dir` 波及不全** —— `src/views/Files.contextTarget.test.ts`(2 条)+`src/views/__tests__/Files.favoriteCtx.test.ts`(1 条)仍断言旧的 `{from}` 形状。Task 3 当时扫的是 `src/files/**`,**这两个文件在 `src/views/**`,漏了**。教训:类型改动的波及面要按「谁 import 了它」找,不能按目录扫。
- **B. 开源导出泄漏守卫命中 2 处** —— `Breadcrumb.test.ts:27` 的 `substring search` 撞 `[search]`、`FilesSidebar.test.ts:81` 枚举 `Downloads/Gallery/Media/...` 撞 `[gallery]`。**均为纯词形碰撞非真泄漏**(无任何指向被剥离区域的实质引用)。按既有教训取**改写措辞**而非加白名单(白名单额度留给真绕不开的)。
- 修复提交 `cfccf31`(只动测试文件的断言与注释,未动生产代码、未动 `oss/forbidden.mjs`)。⚠️该实现者**又把测试丢后台然后停下等**,活干完提交了但没回报 —— 本批第三次,一律靠 `git log`/`git status` 判定。

五门结果(修复后):
| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | exit 0 |
| `pnpm exec vitest run`(全量) | **686 文件 / 11035 例,零失败** |
| `pnpm exec vitest run src/i18n/parity.test.ts` | 9/9 |
| `node oss/export.mjs --no-commit --allow-dirty-oss` | exit 0,**零真实泄漏**(3 个二进制预期内跳过) |
| `pnpm build` | exit 0 |

### 整支终审(opus)

**4 Important + 11 Minor,其中三条 Important 是终审员自己跑变异实测出来的:**
- **I1(需机主拍板,未修)** —— Esc 取消粘贴时**不冲突的那些文件其实已经粘过去了**。`resolveConflictQueue` 只把撞名条目排进队列,不撞名的在 `splitPasteItems` 里无条件落进 `renameItems` ⇒ Esc 只取消撞名那几个。复制 5 个粘到只有 1 个同名的目录、按 Esc ⇒ **4 个真的被复制过去**,toast 只说「已跳过 1 项」,剪贴板还保留 ⇒ 用户再按一次粘贴,那 4 个自己刚落地的文件全变成冲突;cut 场景下源路径已消失,剪贴板成了半坏的。**F3 当初「取消≠丢弃我复制的东西」的推理孤立看 Task 7 成立,放到整支看与 `splitPasteItems` 矛盾。**
- **I2** 「粘贴与上传共用一条串行链」这个整条线的立身之本**零测试保护** —— 终审员把 `resolvePaste` 换成私有链后 102/102 全绿;那条名叫「runs on the same serial chain」的测试正文只排了**两个 paste**。本批**第七例**「测试因为错的理由而通过」。
- **I3** Task 11 的可见成果(恢复进度)在 `Files.vue` 的接线无测试(删掉 prop 绑定 59 文件/865 例全绿)。
- **I4** 恢复进度只补了两个入口里的一个,**漏的 `SnapshotBanner` 那颗才是主入口**(它的 `canRestore` 恰恰只在批量场景为真)。

**修复波(唯一一轮,6 提交 `8e62ecd`/`a86c2ac`/`a811c23`/`56c617d`/`125f560`/`b58561c`)**:I2/I3/I4 + B1-B12 全部修完。**I1 按流程留给机主拍板,未动。**

**复评(opus,范围受限)**:3 Important + 12 Minor **全部 ADDRESSED,无悬而未决**。复评员自跑七组变异全部按预期变红,其中 I2 那组最关键 —— 换私有链后**新用例双双变红而旧用例仍全绿**,正好复现终审判断、证明这次不是白修。B6 专项确认「`is_dir` 不再上网」与「本地弹窗仍能判文件夹」两件事**同时成立**(剥离发生在冲突已解决之后)。B8 专项确认降级方向与 `run()` 对称(warn + 全量走 rename 组,不是静默吞)。逐条查过 B5↔B6 / B6↔弹窗 / B7↔B8 / B4↔全局桩 / I4↔parity,**无 N2/F2 那样的相互抵消**。
minor (deferred, 新增): `resolvePaste` 的 try 整个包住 `computePasteConflicts`,颗粒度比 `run()` 自己立的规矩略粗(`run()` 刻意只包网络调用、把纯函数留在 try 外,理由是「那里出错是真 bug,吞掉会静默降级」)。影响小,收进后续票。

### 收尾五门(控制器亲自跑)

| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | exit 0 |
| `pnpm exec vitest run`(全量) | **686 文件 / 11042 例,零失败** |
| `pnpm exec vitest run src/i18n/parity.test.ts` | 9/9 |
| `node oss/export.mjs --no-commit --allow-dirty-oss` | exit 0,零真实泄漏 |
| `pnpm build` | exit 0 |

### 状态

**编码收官。未部署、未推 origin、未合并 master。真机验收清单(18 步,见计划末节)一步没跑。**
**唯一待机主拍板项:I1(Esc 取消粘贴的语义)。**
