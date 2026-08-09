# SP12 Plan A 挂账 —— 收官状态、欠的验收、后续期入口

> 写于 2026-08-09，给**新上下文接 SP12 下一期**的人看。
> 读这一份就够开工；要细节再去 `.superpowers/sdd/2026-08-08-sp12-plan-a-upload-batch-swap/`。

---

## 1. Plan A 现在是什么状态

**编码全完成，三门全绿，未部署、未推 origin、真机验收一步没跑。**

- plan：`docs/superpowers/plans/2026-08-08-sp12-plan-a-upload-batch-swap.md`
- 提交范围：`095ea3e..9ae9cf6`（master 主工作树，17 个提交）
- 台账 16 份：`.superpowers/sdd/2026-08-08-sp12-plan-a-upload-batch-swap/`
  （靠 `git add -f` 进的库 —— `.superpowers/sdd/.gitignore` 那行裸 `*` 还在，见 §5）

收尾门（2026-08-08 由控制器亲自复跑，不是转述实现者的话）：

| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | clean |
| `pnpm test` | 645 文件 / 10413 例，全过 |
| `pnpm exec vitest run src/i18n/parity.test.ts` | 9/9 |
| `pnpm build` | 成功 |
| `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss` | 零真实泄漏（3 个二进制预期内跳过） |

两个**已知非缺陷**，下期跑测试时别去追：
- 全量套件会打 jsdom `Not implemented: navigation` 噪声，来自不相干的 photos 测试
- `src/home/components/DesktopContextMenu.test.ts` **只在单独跑那一个文件时**失败
  （SP11 遗留的 reka-ui 隔离 flake：第二次挂载的 portal 在 `afterEach` 清 body 之后不再出现），
  全量套件里是绿的

---

## 2. 欠的：真机验收 8 步

机主说「后面一起验收」。验收方式 = `pnpm dev --host --port 5273`（不是 `deploy.sh`），
清单在 plan 的「真机验收」节。**第 2 步已被改写过**，原文那样验不出来 —— 原因值得记住：

> 后端只给**列表里已经存在的条目**打角标（`route/v1/file.go:431-443` 按 `info[i].Name` 查
> `broken` map），而 tus 只在文件传完时才把文件物化到目标目录。所以一个传了一半的**裸文件**
> 既没有列表条目也没有父文件夹，角标无处可挂，那个批次在 UI 上连入口都没有。
> 角标实际需要**传文件夹且至少 1 个文件传完**：传完的兄弟文件把文件夹建出来，
> 再由后端 `BrokenChildren` 把角标挂在文件夹条目上。

其余要点：第 6 步网格与列表**都要看**（两处独立实现，且列表用的是内联 flex chip、
网格用的是角落浮层，观感本就不同）；第 7 步浅色深色**都要看**（角标颜色走 token，jsdom 照不出）；
第 8 步「刷新页面不再恢复上传队列」是**本期有意删除**的能力，不是 bug。

---

## 3. 两张必开的后续票（终审判为不塞进本期）

### 票 A —— `installUnloadGuard` 装错了生命周期

`src/views/Files.vue` 在 `onMounted` 装、`onUnmounted` 拆，但**上传队列是应用级的**
（Pinia store，导航走了照传，也没有任何东西在 unmount 时取消队列）。后果：开着上传离开
`/files` 再关标签页 → **中断信号不发、离站提示也不弹**，角标只能等服务端 120s 空闲兜底，
本期「关窗即刻标中断」的目标在这条路径上直接落空。

修法：装到应用级（`App.vue` / `main.ts`），与 store 的生命周期对齐。

### 票 B —— 重试会撞死 URL 死循环

`src/files/stores/uploads.ts` 的 `retryItem` / `retryBatch` 会重置 `progress` / `bytesSent`
（等于对用户承诺「重来一次」），**却不清 `item.tusUploadUrl`**。`scheduler.ts` 仍把它当
`resumeUrl` 传下去，对已删的 staging 发 HEAD 拿到 404；`isRetryableTusError` 正确地不重试
（<500），`humanize(404)` 把它标成「网络错误」。于是每次点继续都在敲同一个死 URL，
**唯一出路是取消 + 重选**，而提示还在把用户往网络问题上引。

这条以前也在，但 **SP12 让 staging 被清成了常态**：中断即清，sweeper 120s + 600s 宽限后清。
可复现且不用刷新页面：暂停一个批次 → 等 >12 分钟 → 按继续。

修法：`uploadOne` 的 catch 里遇 404/410 就 `patch({ tusUploadUrl: null, bytesSent: 0, progress: 0 })`
让重试路径重新 create；和/或在 `retryItem` / `retryBatch` 里直接清掉。

### 顺带：plan 里那张后端票该往前排

`last_progress_at` 只在**单个文件整体传完**时刷新（`MarkItemDone`），分片进度不刷新。
TUS 那边宣称支持 20 GB，而单文件卡住 120s 就被判中断、720s（120+600）后 staging 被清、任务终止，
**后端没有续期端点，前端无法用心跳规避**。票 B 没修之前，用户撞上它就是个死胡同。
建议后端在 tus 分片写入时也刷 `last_progress_at`。

---

## 4. SP12 还剩什么（下一期从这里挑）

spec `docs/superpowers/specs/2026-08-08-vue3-migration-sp12-files-catchup-design.md` 把 SP12 拆成
11 个任务。**Plan A 吃掉了 T2/T3/T4/T5/T6**（外加 spec 里没有的「重传缺失文件」）。剩 6 个：

| 任务 | 对应 Vue2 issue | 一句话 | 依赖 |
|---|---|---|---|
| **T1** 统一冲突弹窗 `FileConflictDialog` | #77 半 | 四动作（overwrite/keep_both/skip/merge）+ `applyToAll`；纯函数决议层与展示组件分离 | 无。**是 T7/T8 的地基** |
| **T7** 上传同名冲突 | #85 | 按 `relativePath` 首段分组的第一轮冲突编排 | T1 |
| **T8** Windows 式文件夹合并 | #86 | 两队列 + `mergeable`；merge 触发第二轮 `upload-precheck` 逐文件决议 | T1 + T7 |
| **T9** 加载健壮性三修 | #88 | `retryRequest` 有限重试 / 骨架屏卡死 / RAID 用量兜底 / 错误文案归一 | 无，可单独成期 |
| **T10** 进度并入上传框 | #89 | 上传框加「文件操作」分组，删 `OperationStatusBar.vue` 及其挂载 | 无 |
| **T11** 网格虚拟滚动 | #94 | 纯函数 `chunkRows` + 可视窗口；**框选的 `ItemRect[]` 来源要改**（屏外没 DOM 了） | 无 |

**Plan A 有意留给 Plan B 的地**：`src/files/upload/conflict.ts` 与 `UploadPanel.vue` 里那套
**逐文件冲突 Dialog 原样没动**。所以现在上传冲突不是功能空窗，是旧形态；
T7/T8 要用「按顶层分组 + 统一冲突弹窗」**整体替换**它，不是在它上面加。

spec §7 记的未决项仍未决：粘贴与快照恢复接入统一冲突弹窗**另开票**（不在 SP12）；
#90 P2P 重修不在本期。

---

## 5. 开工前必须知道的几条现场约束

- **主工作树 commit 必须带 pathspec。** 工作区常年有 3 个 `design-export/*.html` 的 staged 删除，
  外加 `oss/*` 的改动（别人的活），`git commit -a` 会把它们卷走。
- **台账想入库要 `git add -f`。** `.superpowers/sdd/.gitignore` 仍是一行裸 `*`，压过父级
  `.superpowers/.gitignore` 里 2026-08-05 定的「`.md`/`.png` 入库、`.diff` 不入库」规则。
  真要修这条得连 `oss/manifest.mjs:539` 的 `find` 逐字锚点一起动，**别顺手改**。
- **代码注释一律英文**（工作区 CLAUDE.md 硬要求）；对话、spec/plan 文档仍中文。
- **颜色一律 theme token**，且新语义要在 `:root` 与 `:root[data-theme="light"]` **两个块**都给值。
- **i18n 新键两个 locale 都要加**，`src/i18n/parity.test.ts` 会红。
- **改 `packages/service/` 后要重启 dev server + 浏览器硬刷新**；`vite.config.ts` 的
  `optimizeDeps.exclude` 不要删。
- 派实现者做任务时**明确要求前台跑测试**：本期有四个实现者把 `pnpm test` 丢后台，
  turn 直接结束、活干一半，每次都要再唤醒一轮。`pnpm test` 约 3 分钟，等就是了。

---

## 6. 本期最值钱的三条教训

1. **计划里写死的数字会先于计划腐烂。** plan 把「toast 是 z-index 60、弹窗遮罩 1000」抄进了
   要落地的代码注释，而这个事实在 plan 写下之前就已作废 —— `AppToast.vue:49` 早已是 10100，
   还有 `src/components/AppToast.zIndex.test.ts` 守着。计划评审没抓到，任务级评审也没抓到
   （它只看单个 diff），是**全分支终审去读了那个文件**才逮到。
   ⇒ 援引「因为 X 所以 Y」的先例前，先去现场核 X 还在不在。
2. **grep 姊妹仓要打 `origin/<branch>`，不是它的工作树。** 终审断言「Vue2 里根本没有这个先例，
   注释是编的」，实则 `NimoOS-UI` 本地检出停在 `docs/vue3-migration-sp3`，**早于 origin/main**。
   到 `origin/main` 上一查，`IconContainerMixin.js:71` 那条布尔/字符串双认逐字存在（注释是对的），
   而 #91 确有其事但机理不同（是网格卡片给内层 `<span>` 设了 `pointer-events:none` 把点击整个吞了，
   不是双触发）。前者原样留下，后者改对。
3. **手写转发的事件链要有一条端到端测试。** `FileTile → FileGridView → Files.vue` 三跳，
   两个中间层都是显式声明 emits 再逐个手工转发。`vue-tsc` 只能抓 payload 类型写错，
   **抓不到少写一行 `@open-batch`** —— 删掉任一行，功能整条静默死掉而全套测试照绿。
   补测试时做了强制 RED 自证（删转发→红、还原→绿，两个视图各一遍）。
   凡是这种手工转发链，下期照办。
