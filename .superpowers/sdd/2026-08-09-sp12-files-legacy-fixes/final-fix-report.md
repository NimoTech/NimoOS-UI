# SP12 Files 区终审修复批 —— 落盘报告

> 2026-08-09。分支 `sp12-files-fixes`,worktree `.claude/worktrees/sp12-files-fixes`。
> 六个提交:`61df865` `dffdae1` `89d2078` `3ae7b2d` `dcddd48` `70a860e`。追加第七个提交
> `6d35239`(见「六」)。工作树在全部修复之后为 clean。

---

## 一、六项修复逐条落地

### Fix 1 —— F11 前提不成立:改口而不改代码,并补一个走真实路径的测试

**结论**:`src/views/Files.vue:81-85` 的 `onItemContextmenu`(本批次之前就存在,未被
本批次的代码改动触及)在记录 `ctxEntry` **之前**就先调用 `files.selectOnly()` 把选区
收窄成被点项(`files.ts:145` 整段替换选区)。也就是说,右键点未选中项时,选区在菜单打开
前已经只剩被点项——旧的 `selectedOr()` 因此本来就会返回被点项,`selectedCount` 本来就是
1。**清单描述的"批量操作误伤未选中项"这个用户可见缺陷,通过 UI 永远走不到。**
`contextTargets`/`ctxTargets` 的改动仍然值得保留,但理由改成"防御性单点真相收拢"
(消灭 `delete` 分支曾经内联的第二份重复逻辑),不是"修复一个用户能碰到的 bug"。

**(a) 新增走真实 UI 路径的测试**——提交 `61df865`,文件
`src/views/Files.contextTarget.test.ts`:

```ts
it('Real contextmenu on an unselected row collapses selection to it, and a subsequent copy acts on it alone', async () => {
  const w = await mountFiles()
  const files = useFilesStore()
  files.setView('list')
  await w.vm.$nextTick()
  files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])

  const rowA = w.find('[data-path="/DATA/a.txt"]')
  expect(rowA.exists()).toBe(true)
  rowA.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  await w.vm.$nextTick()

  expect(files.isSelected('/DATA/a.txt')).toBe(true)
  expect(files.selected.size).toBe(1)

  const ctxEntry = (w.vm as any).ctxEntry
  expect(ctxEntry?.path).toBe('/DATA/a.txt')
  ;(w.vm as any).onCtxAction('copy', ctxEntry)

  const clip = useClipboardStore()
  expect(clip.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a.txt' }] })
})
```

它对渲染出的行元素派发一个真实的 `contextmenu` DOM 事件(通过 `[data-path]` 定位),而不是
像既有四个测试那样直接写 `(w.vm as any).ctxEntry = a` 构造一个 UI 到不了的状态。既有四个
测试原样保留——它们仍然守着 dispatch 接线本身(`onCtxAction` 各分支 → `contextTargets` →
菜单 prop)。

**(b)/(c)/(d) 文档改口**——提交 `dffdae1`:
- `docs/superpowers/specs/2026-08-09-sp12-files-legacy-fixes-design.md` §2 整段重写:
  标题从"这是迁移回归,不是承 Vue2"改成"复核结论:用户可见缺陷不成立;改动作为防御性收拢
  保留",引用 `Files.vue:81-85` + `files.ts:145` 作证据,原来"New-UI 有两处平行走样"的
  措辞改写成"单独看会走样,但上游已经收窄,从未被观察到过"。
- `docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md`:「一」的 F11 小节、
  「二」的 F14 取证链都按同一口径改写;文档顶部追加一段"2026-08-09 追加修订"说明这次改口;
  §5/§四 的真机验收步骤 6、7 改写成"这一步验的是既有行为没有被破坏,不是一项新能力……
  跑不出预期现象说明部署没生效,不能反过来当作新行为生效的证据"。
- 「二」新增一句:F11 归入 F14 同类——都是"诊断前提不存在"的清单条目,成因不同(F14 是
  后端从不返回假设的响应形状,F11 是上游代码已经把输入收窄到假设的分支永远触发不到)。

**Fix 1(a) 的强制失败证明**(应协调者要求,在当前 HEAD `70a860e` 上重新做的一遍,
每一步都是前台命令,逐字记录):

第 1 步 —— 反转 `onItemContextmenu` 的判据(`!files.isSelected(...)` → `files.isSelected(...)`):

```diff
-  if (!files.isSelected(payload.entry.path)) files.selectOnly(payload.entry.path)
+  if (files.isSelected(payload.entry.path)) files.selectOnly(payload.entry.path)
```

第 2 步 —— 只跑新测试所在文件,前台,记录失败输出(逐字):

```
=== RUNNING TEST WITH INVERTED GUARD ===

 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-files-fixes

 ❯ src/views/Files.contextTarget.test.ts (5 tests | 1 failed) 369ms
     × Real contextmenu on an unselected row collapses selection to it, and a subsequent copy acts on it alone 92ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/views/Files.contextTarget.test.ts > Files.vue context-menu target (F11) > Real contextmenu on an unselected row collapses selection to it, and a subsequent copy acts on it alone
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/views/Files.contextTarget.test.ts:149:45
    147|
    148|     // Selection contract: right-clicking unselected A drops B, C and …
    149|     expect(files.isSelected('/DATA/a.txt')).toBe(true)
       |                                             ^
    150|     expect(files.selected.size).toBe(1)

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

The other four pre-existing tests in the same file kept passing (they don't touch this
guard), confirming the failure is isolated to the new test asserting exactly the thing
the guard controls.

第 3 步 —— 复原判据到原样,再跑一次,记录通过输出(逐字):

```
=== RUNNING TEST WITH GUARD RESTORED ===

 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-files-fixes


 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  15:10:53
   Duration  2.76s
```

第 4 步 —— `git status --porcelain` 输出为空、`git diff --stat` 输出为空,反转-复原
在工作树上没有留下痕迹。

**结论**:测试不是摆设——它确实断言了"UI 契约"本身(选区收窄这一步),反转判据能让它
真的变红,不是靠巧合或者断言写得太宽松才通过。

---

### Fix 2 —— `Files.vue` 的 `onShare` 注释改写

提交 `89d2078`。原注释三处失实:(1) 说批量路径不弹链接对话框,但 `:132`
`if (targets.length === 1) shareDlg.value = …` 判据是**过滤后**的数量——一批 3 个文件夹、
2 个已共享的情况下,过滤后剩 1 个真实目标,现在**会**弹;(2)"multiple names to display to
user" 把原意"多个名字无从展示"说反了;(3)"entry non-null, outside selection" 与 Fix 1
的结论矛盾——被点项此刻必然在选区内。新注释按代码实际行为重写,并在其中显式表态是否认可
这个"过滤后剩 1 个就弹"的行为(见下方「我的立场」)。

**我的立场(协调者点名要的判断)**:我认同当前"按过滤后数量判断"的行为,认为它优于
"按过滤前数量判断"。理由:

- `shareDlg` 弹出的唯一目的是把**刚创建成功的那一个分享**的链接递给用户去复制/分享。这个
  目的只关心"这次操作最终新增了几个分享",不关心用户点击入口时选中了几个文件夹——如果
  按过滤前数量判断("批量入口选了 >1 项就永远不弹"),会出现"批量选 3 个、2 个已共享、
  只新增了 1 个分享,但用户拿不到这个分享的链接,得自己去共享列表页找"这种更差的体验,
  而且没有对应的收益。
- 该判据与单项右键路径的判据是**同一条规则**,不是两套并存的逻辑:单项右键的 `ctxTargets`
  经过滤后几乎总是长度 1(因为 `showShare` 已经把"多选且被点项在选区内"的路径挡在 UI 之外,
  这条路径的 `entry` 只会在 `selectedCount<=1` 时给出),批量入口的 `ctxTargets(null, sel)`
  只是没有这层前置收窄——用同一个"过滤后长度是否为 1"判据去统一处理两条入口,恰恰是不用
  为"这次调用是单项右键还是批量"单独分叉的原因。分叉出"批量入口一律不弹"反而是在人为制造
  不一致:同样是"最终只新增了一个分享"的结果,只因为调用路径不同就有不同的用户体验。
- 唯一的反面论据是"批量操作不应该弹模态打断用户",但这里的模态只在过滤后**恰好剩一个**时
  出现,大多数真实批量场景(全部可共享、或跳过后仍剩 >=2 个)根本不会碰到它,不是每次批量
  操作都会被打断。

结论:不改行为,只把注释按上面的理由写清楚(已落在提交 `89d2078` 里)。

---

### Fix 3 —— `FileGridView.vue` 滚动祖先注释

提交 `3ae7b2d`。原注释仍写"AreaShell 的 `.area-body` 在实践中"是最近的可滚动祖先;F17
把 `.files-layout` 封顶之后,实际的滚动容器变成了 `Files.vue` 的 `.files-listwrap`。改写
注释指出这一点,同时保留原意——`findScrollParent` 是动态解析而非写死,换了宿主依然可用。

---

### Fix 4 —— `protect.ts` 改调用 `shareGate.isAlreadyShared`

提交 `dcddd48`。`canOperate` 原来自带一份字面量 `entry.extensions?.share?.shared === 'true'`
比较,现在改成调用 `isAlreadyShared(entry)`(`src/files/util/shareGate.ts:12-14`,同一个
比较式)。语义完全等价,`src/files/util/protect.test.ts` 的 6 个用例全部照旧通过(见下方
验证结果第 1 条,涵盖了这个文件)。

---

### Fix 5 —— `filesLayoutHeightCap.test.ts` 注释改口

提交 `70a860e`。原注释说实际布局效果"is verified on device"——事实上从未在真机上验证过。
改成"still needs to be verified on device (not yet done as of this writing — see the
handoff doc's acceptance checklist)",避免这条闸自己的说法把交接文档小心维持的"尚未验证"
状态给盖过去。

---

### Fix 6 —— 交接文档新增窄屏验收步骤

包含在提交 `dffdae1` 里(与 Fix 1 的文档改口是同一批提交,因为都落在同两个 `.md` 文件上)。
`.files-topbar` 在 `≤768px` 时 `flex-direction: column` 且允许换行(`Files.vue:735-739`),
F17 把它钉住之后不再随内容滚走,窄屏下换行后的高度可能吃掉文件列表的可用空间。在设计文档
§5 与交接文档「四、真机验收清单」都新增了第 11 步:窄屏(≤768px)打开 `/files`,确认顶栏
换行后没有把列表区挤没。

---

## 二、四项由协调者在本分支 HEAD 上跑出的验证结果(非本 agent 亲自测量)

以下四项数字由协调者(controller)在提交 `70a860e`(六个提交全部落地、工作树 clean 之后
的 HEAD)上跑出,经消息转述后原样写入本表——**本报告的产出者(本 agent)没有亲自重跑这
四条**,只对 Fix 1(a) 的强制失败/复原做了亲自的前台重跑(见「一」)。

| # | 命令 | 结果 | 归属 |
|---|---|---|---|
| 1 | `pnpm exec vitest run src/views/Files.contextTarget.test.ts src/views/Files.share.test.ts src/views/__tests__/filesLayoutHeightCap.test.ts src/files/util/ src/files/components/FileContextMenu.test.ts` | **PASS** —— 35 files / 276 tests,全绿。该范围包含 `src/files/util/protect.test.ts`,即 Fix 4 的重构由此覆盖 | 协调者亲测,转述 |
| 2 | `pnpm exec vue-tsc --noEmit` | **PASS** —— exit 0,无输出 | 协调者亲测,转述 |
| 3 | `pnpm exec vitest run oss/` | **PASS** —— 6 files / 141 tests,全绿;泄漏守卫满足,本批次的文档改写没有重新引入被剥离区域的引用 | 协调者亲测,转述 |
| 4 | `pnpm test` | **PASS** —— 659 files / 10511 tests,零失败(本批次之前是 10510 个 test,新增的 1 个正是 Fix 1(a) 的真实 DOM contextmenu 测试) | 协调者亲测,转述 |

补充说明:本 agent 在早些时候(提交之前、以及提交刚完成但工作树尚未确认为 clean 时)也
在本地跑过 `pnpm test`,跑出过两次不同的、与本批次改动**均无关**的失败(一次是
`DesktopContextMenu.test.ts` 里一个依赖 reka-ui 内部微任务时机的用例,另一次是
`src/i18n/__tests__/photosSlice.test.ts` 一个用例超时),两次失败发生在不同文件、连续两次
全量跑,和本批次触碰的文件(`Files.vue`/`FileGridView.vue`/`protect.ts`/两个测试文件/两个
文档)完全不相交,像是整套件在系统负载下的既有 flaky 现象,不是这批修复引入的回归。协调者
在同一 HEAD 上跑出的第 4 项(659/10511 全绿)是本报告采信的权威数字。

---

## 三、过程问题的坦白

协调者指出我在本任务执行期间**两次把 `pnpm test`丢进后台跑、并且写了一个轮询/等待通知的
循环**,这违反了"全量测试必须前台跑、直接等,不要后台+轮询"的要求。这是我的操作失误——
`pnpm test` 单次运行 ~230-280 秒,超过了工具默认的前台超时(120 秒)会被自动挪到后台,
正确的处理方式应该是提高该次调用的 timeout 参数(工具允许最多 600000ms),而不是任其自动
转后台再手写等待/轮询逻辑。已按协调者要求改为直接前台等待完成的方式重做了 Fix 1(a) 的强制
失败证明(见「一」)。全量 `pnpm test` 的权威数字采用协调者转述的第 4 项,没有再次尝试
自己重跑一遍去"验证协调者的数字"——那样只是重复消耗时间,而且我自己此前两次全量跑都撞上了
与本批次无关的 flaky 失败,不能拿来跟协调者的干净结果对比出什么结论。

---

## 四、对修复清单的不同意见

**只有 Fix 2 一处**——已经在上面「Fix 2」小节写清楚:我同意维持"按过滤后目标数判断是否
弹链接对话框"的现状,认为这比"按过滤前选区大小判断"更一致、体验更好,理由见上。这不是
"发现了错误需要拒绝执行",只是任务本身也要求我对这一点给出独立判断,所以在这里正式记录:
**没有改动行为**,只是把注释按这个立场写清楚。

其余五项(Fix 1/3/4/5/6)执行时没有发现与任务描述矛盾或不可执行之处——F11 的复核结论、
`FileGridView.vue`/`filesLayoutHeightCap.test.ts` 的两处过时注释、`protect.ts` 的重复
判定、窄屏验收步骤缺失,四项事实核对下来都与任务描述一致,按原计划实施。

---

## 五、涉及文件一览

- `src/views/Files.contextTarget.test.ts`(新增测试,Fix 1a)
- `docs/superpowers/specs/2026-08-09-sp12-files-legacy-fixes-design.md`(Fix 1b + Fix 6)
- `docs/superpowers/2026-08-09-sp12-files-legacy-fixes-handoff.md`(Fix 1c/1d + Fix 6)
- `src/views/Files.vue`(Fix 2,注释改写,行为未变)
- `src/files/components/FileGridView.vue`(Fix 3,注释改写)
- `src/files/util/protect.ts`(Fix 4,调用 `shareGate.isAlreadyShared`)
- `src/views/__tests__/filesLayoutHeightCap.test.ts`(Fix 5,注释改写)

未触碰:`src/files/upload/**`、`UploadPanel.vue`、`src/files/stores/uploads.ts`、
`useUploadConflicts.ts`、`src/files/stores/shares.ts`。

---

## 六、二次复审补丁 —— `contextTarget.ts` 的 JSDoc 仍写着已被推翻的说法

提交 `6d35239`。协调者二次复审发现:`src/files/util/contextTarget.ts:6-13` 的函数级
JSDoc **没有跟着改口**——它仍然写"New-UI had regressed to 'any non-empty selection
wins', so right-clicking an unselected file and hitting Copy operated on the previous
selection instead (pending-ledger F11)",把已经在 Fix 1 里推翻的旧诊断当既定事实陈述。
这是本函数的**权威定义处**——维护者查 `contextTargets` 只会读这里,不会去翻交接文档,
留错版本在这儿正是这整批修复要防的那种失效模式。

**改法**(只改注释,不动函数体/签名/测试):保留"忠实复刻 Vue2 `ContextMenu.vue:271-279`
判据"与"动作分发和菜单单/多选形态必须读同一个函数,避免漂移"这两句——它们准确且是真实的
存在理由;把"New-UI had regressed / operated on the previous selection instead"整段替换
成:这条本会走样的旧逻辑**从未在 UI 里被观察到过**,因为 `Files.vue` 的
`onItemContextmenu`(`:81-85`)在菜单打开前、这个函数被调用前,就已经通过
`files.selectOnly()`(`files.ts:145`)把选区收窄成被点项。措辞与新增测试的注释、以及
design/handoff 文档里已经改口的说法保持一致口径。

**验证**(三条全部前台跑):

```
$ pnpm exec vitest run src/files/util/contextTarget.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ pnpm exec vue-tsc --noEmit
(exit 0, 无输出)

$ pnpm exec vitest run oss/          # 先在干净工作树上跑(commit 6d35239 之后)
 Test Files  6 passed (6)
      Tests  141 passed (141)
```

补充:第一次在**未提交**状态下跑 `oss/` 会因为 `export.mjs` 的 `checkClean` 认定工作树
不干净而失败(`git archive HEAD` 需要干净树,`--allow-dirty-oss` 只放行 `oss/` 目录自身
的改动,不放行 `src/**`)——这不是本次改动引入的问题,是导出流程的既有约束;提交
`6d35239` 之后在干净树上重跑,141 例全绿,注释里的新增措辞也没有引入任何被剥离区域的
引用(`grep -i photo src/files/util/contextTarget.ts` 无命中)。
