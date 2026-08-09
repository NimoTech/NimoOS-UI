# SP12 Plan B 挂账 —— 冲突弹窗体系已收官,真机验收未跑

**状态**:编码 + 11 轮单任务评审 + 全支终审 + 一轮修复波全部完成。六门全绿。
**已合入 master**(2026-08-09)。**未推 origin、未部署、12 步真机验收一步没跑。**

分支 `sp12-plan-b`,`a365b7e..8aecf73`,18 提交。
计划:`docs/superpowers/plans/2026-08-09-sp12-plan-b-conflict-dialog.md`
台账:`.superpowers/sdd/2026-08-09-sp12-plan-b-conflict-dialog/`(17 份报告,`git add -f` 入库)

收尾门(控制器亲自复跑,工作树干净时):

| 门 | 结果 |
|---|---|
| `pnpm exec vitest run` | 652 文件 / 10498 例全绿(分支基线 644 / 10408) |
| `pnpm exec vue-tsc --noEmit` | clean |
| `pnpm build` | ✓ 16.87s(仅既有的 chunk-size 提示) |
| `pnpm exec vitest run src/i18n/parity.test.ts` | 9/9 |
| `node oss/export.mjs --out <tmp> --no-commit --allow-dirty-oss` | 零真实泄漏 |
| `grep -nE "#[0-9a-fA-F]{3,8}\|rgba?\(" src/files/components/FileConflictDialog.vue` | 零命中 |

---

## 本期做了什么

给 New-UI 文件区补上 Vue2 已有、New-UI 缺失的「同名冲突」体系,三层切分:

- `src/files/upload/fileConflict.ts` —— 通用层(依赖注入):列现有名 / 找冲突 / 走队列 + Apply-to-all。
  不认识上传、粘贴、快照恢复中的任何一个,三者都能复用(本期只接了上传)。
- `src/files/upload/uploadConflict.ts` —— 上传专用纯函数:按 relativePath **首段**分组、拆文件/文件夹
  两队列、一轮决议落成 `conflictPolicy`、合并文件夹的二轮内层决议。
- `src/files/components/FileConflictDialog.vue` —— 展示组件,只 emit 不算逻辑。
- `src/files/composables/useUploadConflicts.ts` —— 编排:串行链 + 两轮 + 弹窗 promise 桥 + 窄降级。
- `src/views/Files.vue` —— 两条分支(普通上传 / 重传缺失文件)都先过冲突决议再入队。
- 旧的逐文件冲突路径整体拆除:`'conflict'` 状态、队列里的 precheck、`UploadPanel.vue` 内嵌弹窗、
  `upload/conflict.ts` 全部删除。

顺带修掉 Plan A 挂的两张票:unloadGuard 搬到 `App.vue`(票 A)、死 tus URL 不再反复重试(票 B)。

---

## ⚠️ 12 步真机验收清单(一步没跑)

验收方式:在本工作树起 dev server,挑一个避开 5273 / 5277 / 5288 的端口
(`pnpm dev --host --port <端口>`)。非 cutover 期**不要** `deploy.sh`。

1. 传一个目标目录**已存在同名**的**单文件** → 弹窗出现,标题「已存在同名项目」,显示文件名与目标目录,
   **没有**「合并」按钮,「覆盖」可点。
2. 选「覆盖」→ 上传完成后目标文件被替换(大小/时间变了),目录里**没有**多出 `xxx(1)`。
3. 同一场景选「保留两者」→ 目录里出现后端自动改名的第二份。
4. 同一场景选「跳过」→ 不上传,右下角 toast 显示「已跳过 1 项」。
5. 传一个目标目录**已存在同名文件夹**的**文件夹** → 弹窗出现「合并」按钮,黄色提示是
   「合并进已有文件夹,或选择保留两者/跳过」,「覆盖」是**灰的**(悬停提示「文件夹不支持覆盖」)。
6. 选「合并」→ 文件夹里**不冲突的文件**直接落进已有文件夹;**冲突的那些**逐个再弹一次窗
   (弹窗里显示的是 `Trip/1.jpg` 这种完整相对路径,不是裸文件名)。
7. 一次拖入**多个**都冲突的文件 → 弹窗显示「第 1 项,共 N 项」,勾上「应用于剩余全部项目」再选一个动作
   → **不再弹**,其余全部按该动作处理。
8. 冲突弹窗按 **Esc**(或点遮罩)→ 本次及剩余全部取消,toast 显示已跳过的条数,**已经开始传的不回滚**。
9. 传一个文件夹,其**同名的是一个文件**(不是文件夹)→ 弹窗**没有**「合并」按钮,黄色提示是
   「文件夹不支持覆盖 — 请选择保留两者或跳过」。
10. 浅色 / 深色主题各看一遍弹窗:四个按钮、黄色提示条、勾选框都不能出现白底白字或看不见的情况;
    鼠标悬停在「覆盖」上不能变白。
11. **票 A**:开始一个大文件上传 → 导航到 `/apps`(离开文件区)→ 关标签页 → 浏览器弹「离开此网站?」;
    确认离开后回到文件区,该批次的文件夹条目上**立刻**出现裂开角标(不用等 2 分钟)。
12. **票 B**:暂停一个批次 → 等 >12 分钟(让服务端 sweeper 清掉 staging)→ 按「继续」
    → 应当**一次点击就重新开始传并成功**,而不是先报一次「网络错误」再要你点第二次。

### 终审新增的 3 条,也要一起验(计划清单里没有)

13. **重传缺失文件不再对自己的文件夹弹窗**:传一个文件夹 → 传到一半中断 → 点「重传缺失文件」
    → **不应该**弹任何关于该文件夹的冲突窗,缺失的文件应直接落回**原文件夹**,
    **不能**出现 `文件夹名(1)/`。
14. **Esc 压得住第二轮**:一次拖入「一个同名文件夹 + 一个同名文件」→ 对文件夹选「合并」
    → 对文件按 **Esc** → **不应该**再为文件夹里的文件弹窗,toast 的取消计数应包含文件夹里的条目。
15. **离开页面不再静默吞文件**:拖入一个会冲突的文件夹让弹窗打开 → 按**浏览器后退**离开文件区
    → 回到文件区,应当看到「已跳过 N 项」之类的提示,**不能**是什么都没发生、文件凭空消失。

---

## 已知未修(不阻塞合并,按需另开票)

1. **票 E 只治了在飞的那一批。** `onScopeDispose` 会把**当前正在等的**弹窗兑现成取消,但排在
   `chain` 后面的下一批、或 `listFolder` 还没返回就被拆掉的那一批,仍然会永久挂起(症状同样是静默无事发生)。
   真修是把弹窗提到 `App.vue`,理由与票 A 把 unloadGuard 提上去完全一样。**建议独立开票。**
2. **重传 + 类型不匹配会静默降级。** 重传分支上,若文件夹名被一个**文件**占用,该组会被合成 `merge`,
   落到 `applyUploadResolutions` 的非可合并分支变成「保留两者」写进 `名字(1)/`,**全程不弹窗**。
   罕见(要有别的东西在 app 之外把目录替换成同名文件),已在代码里注释登记。
3. **孤儿 i18n 键**:`filesUploadSkip` / `filesUploadRename` / `filesUploadOverwrite` 已无人引用。
   清理时注意 `src/i18n/messageSyntax.test.ts` 拿 `filesUploadRename` 当 forbiddenKey **夹具**,要一起改。
4. **`size_match` 至今无人读**(`is_dir` 有用)。Task 6 加进 `UploadPrecheckResult` 时机主已裁定原样留,
   它守的是「将来别把那个整数组强转收窄成逐字段挑选」。
5. `:queue-index` 无法用「删掉看是否变红」证明(它在第一个弹窗上的真值 0 恰好等于 prop 默认值);
   要证明须在**第二个**弹窗上断言 `queueIndex === 1`。失效后果纯外观(「第 N 项」数字不对)。
6. 一次跳过整个 500 张照片的文件夹,toast 会说「已跳过 500 项」(按条目计,非按组)。与 Vue2 行为一致。
7. 受保护目录的拒绝发生在**弹窗之后**:往已有 `AppData/` 的目录里拖 `AppData/`,会先让你解决冲突、
   再告诉你被拒了。修法是把 PROTECTED 过滤挪到 `resolveEntries` 之前。

---

## 教训(下一期开工前值得看)

**计划原文被推翻 6 处,都是实质错误不是笔误** —— plan 不是权威:

1. Task 8 那条守卫用例 `not.toContain('文件已存在')` **改动前后都是绿的**(`seed('error')` 产生的条目
   本就不触发旧弹窗),而且 `filesUploadErrDuplicate` 的值「文件已存在(已跳过)」含该子串、将来会假红。
   ⇒ 机主拍板改强断言(用 `node:fs` 读源码断言旧 import/标识符已消失;**绝不能用 `?raw`**,
   本仓 vitest 下 `?raw` 返空串,曾静默废掉一道守卫)。
2. **Task 6 的 TDD 在 vitest 下拿不到 RED** —— vitest 用 esbuild 剥类型、不做类型检查,
   计划写的「Step 2 期望 vitest FAIL」不成立。真 RED 要 `tsc --noEmit`。
3. **Task 7 计划给的 `settle()` 与它自己的用例自相矛盾**:计划要求每次作答立刻整体重置 dialog 状态,
   又写了一条「作答后 `dialog.name` 仍是 'a.txt'」的断言。且 `open` 的 false→true 翻转是
   `FileConflictDialog` 里 `applyToAll` watcher 的契约,不是测试造物 —— 留着 `open` 为真会把上一条的
   勾选带进下一条。
4. **Task 11 计划断言「`item.tusUploadUrl = null` 是必要的,因为下一次 attempt 直接读 item」—— 是错的。**
   `isRetryableTusError(404)` 返 **false** ⇒ 清完 URL 立刻走 `!retryable` 返回,同一轮里根本没有下一次;
   且 store 的 `patch` 本就 `Object.assign` 同一个对象。该行是死代码,已删。
5. **计划的验收第 12 条走的是「继续」(resume),而计划只改了 retry** ⇒ 按原文实现,一次点击仍会失败。
   `resumeItem`/`resumeBatch` **不能**无条件清 `tusUploadUrl`(那会毁掉断点续传本身),
   正确位置就在 scheduler 的 404/410 分支:清完 URL **当作可重试再跑一轮**,仍受 attempt≤3 封顶(共 4 次)。
6. **冲突判定必须排在路径归一化之后。** `toSelectedFiles` 剥前导斜杠是因为受保护目录检查读
   `split('/')[0]`;而 `groupByTopSegment` 也按首段分组 ⇒ 先判定会让 `/Docs/a.txt` 归到**空首段**、
   匹配不上目录里任何名字、冲突**静默漏检**。`handleSelectedFiles` 喂的是裸 `webkitRelativePath`,
   这条路径真实存在。

**只有整支视角能看见的 3 条** —— 11 轮单任务评审全部漏过,因为每轮只看一个 commit:
重传对自己文件夹弹窗 / Esc 压不住第二轮 / 弹窗视图级导致离开页面时静默吞文件。
⇒ **全支终审不是走过场**,它是唯一能看见跨任务接缝的一道。

**`DesktopContextMenu.test.ts` 的 flake:同一个错误诊断栽了第二次。** 本期修复波给出「负载敏感的
flushPromises 竞态、需另开票」——**错的**。真根因 Plan C 早就查明并修好了:`afterEach` 里的
`document.body.innerHTML = ''` 把还开着的 portal 从 reka-ui 全局层状态底下抽走,下次挂载即拒绝打开。
master 已修、本分支基线还没有 ⇒ **合回 master 自动消失,不用开票**。
「单独跑也复现」恰恰是**文件内**用例间污染的证据(抹 body 影响的是同文件的下一例),被误读成了负载竞态。
⇒ 「时序」是太顺手的解释,必须用证据推翻。

**`.superpowers/sdd/.gitignore` 仍是裸 `*`。** 「2026-08-07 已修」那条记载在本分支上**证伪**。
台账入库必须 `git add -f`,否则删 worktree 时连同 17 份报告一起蒸发(SP7 就这么丢过一次)。
