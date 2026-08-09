# SDD ledger — plan: docs/superpowers/plans/2026-08-09-sp12-files-legacy-fixes.md

Worktree: /home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-files-fixes
Branch: sp12-files-fixes (from master 3da4135)
Spec: docs/superpowers/specs/2026-08-09-sp12-files-legacy-fixes-design.md (ade5d37)
Plan: cb6369a

Tasks: 1 contextTargets 纯函数 · 2 接线动作/菜单 · 3 shareGate 纯函数 · 4 批量共享门控+i18n · 5 F17 布局封顶 · 6 收尾门+台账

## Progress

### 裁定 (2026-08-09, 机主)
测试描述 `it()`/`describe()` 一律**英文**,本期起转向。评审在 Task 1 提出这条时它与计划文本冲突
(计划自己的 Global Constraints 写着「代码注释一律英文」,却在代码块里给了中文 `it()` —— pre-flight
扫描没抓到的自相矛盾)。取证:仓内 618 个测试文件有 495 个(80%)用中文 `it()`,即存量惯例是中文;
机主仍选择转向英文。CLAUDE.md **不改**(机主没选那个选项)。
⇒ 计划已就地修正:32 个测试描述 + 15 条代码注释转英文;两条中文 UI 文案
(`已跳过 {count} 个已共享项` / `所选文件夹都已共享`)及断言它们的测试字面量**保持中文**,
因为那是给用户看的界面文字。

Task 1: 实现 DONE (commit 4592db2, 7/7)
Task 1: 评审 spec ✅ 逻辑/接口全对,1 Important = 中文测试描述(plan-mandated,已上报机主裁定)
Task 1: fix round 1/5 进行中 —— 翻译 7 个 it() + 1 条内联注释,实现不动
Task 1: fix round 1/5 (1 addressed, 0 open; commits 4592db2..69d8fcf)
Task 1: complete (commits cb6369a..69d8fcf, review clean)

Task 2: 实现 DONE_WITH_CONCERNS (commit e22b106) —— 实现者报告 Step 6 强制 RED 自证**没能变红**
  根因 = **计划缺陷**(我的,非实现者):测试 4 断言的是组件实例上的 `ctxTargetCount` 计算属性,
  与模板绑给 FileContextMenu 的 `selected-count` 是两回事 ⇒ 改坏模板那一行,测试照绿。
  Step 6 要求的自证,Step 1 的测试根本做不到 —— 与 i18n 那条同类,又是计划的内部矛盾。
  处置:让实现者把断言改成读子组件真正收到的 prop(findComponent(...).props('selectedCount')),
  再重做一次强制 RED。**教训:「端到端断言」写在父组件实例上等于没写,必须落在数据真正流到的那一端。**
Task 2: fix round 1/5 (1 addressed, 0 open; commits e22b106..ce85005) —— 强制 RED 重做,这次真红("expected 2 to be 1")
Task 2: 评审 spec ✅ / 质量 Approved(0 Critical 0 Important);selectedOr 与 delete 内联副本均已消除
Task 2: minor (deferred): 测试自建 createI18n 与 vitest.setup.ts 的全局 i18n 双注册 → [Vue warn] 噪声。
  评审已取证:同款出现在 Files.test.ts:36 及全仓 200+ 测试文件,是**既有仓级惯例问题**,非本 diff 引入。
  (与记忆 vitest-reporter-hides-warnings 那条同源)
Task 2: minor (deferred): SelectionToolbar 的 @copy/@cut/@download 仍内联 files.entries.filter(...),
  没改读新的 selectedEntries。非正确性问题(这些路径不带 entry 参数、无单/多选歧义),纯 DRY 后续项。
Task 2: complete (commits 69d8fcf..ce85005, review clean)
Task 3: 实现 DONE (commit aa17ea1, 9/9);计划写的「10 例」是算术笔误,已订正为 9(4+5)
Task 3: complete (commits ce85005..aa17ea1, review clean, 首轮过)

Task 4: 实现 DONE (commit 89ff85b, 46/46 + parity 9/9 + tsc clean)
  **计划第三个缺陷**:测试里 `const createShare = vi.fn()` 被 `vi.mock` 工厂引用 —— vitest 把 vi.mock
  提升到 const 之上,加载即 ReferenceError。实现者按仓内既有惯例(shares.test.ts)改用 vi.hoisted() 修掉。计划已同步。
Task 4: 评审 spec ✅ / 质量 Approved(0 Critical 0 Important);四条行为分支各有会真红的断言
Task 4: minor (deferred): shares.create 失败时「已跳过 N 个」不再弹,用户只看到通用失败 toast、丢了跳过上下文
Task 4: minor (deferred): src/files/util/protect.ts:9 的 canOperate 另有一处
  `extensions?.share?.shared === 'true'` 字面量(用途不同、本期范围外),日后收紧「已共享」语义时别漏了它
Task 4: complete (commits aa17ea1..89ff85b, review clean, 首轮过)

Task 5: 实现 DONE (commit 70c24b0);守卫 5/5(改前 5/5 全红)、Step5 回归 51/51
  评审独立复核了滚动容器分析:grep 确认全仓无处硬编码 .area-body,findScrollParent 是动态解析 ⇒ 分析成立
Task 5: 评审 spec ✅ / 质量 Approved(0 Critical 0 Important)
Task 5: minor (deferred): 守卫用整条规则字面量比对,无害的格式调整(属性重排/换行)也会红。
  与 photosLayoutHeightCap 同款,是源文本锁的固有取舍,非本期新增
Task 5: minor (deferred): 守卫**没锁** .files-listwrap 的 `min-height: 0` —— 只锁了 overflow-y 存在
  与 min-height:200px 不存在。日后有人删掉那条会静默复发同一个 flex 撑破问题,只是深一层
Task 5: complete (commits 89ff85b..70c24b0, review clean, 首轮过)

Task 6: 六道门跑完,**两道红**(gate2 全量套件 1 文件失败 / gate5 oss 导出 exit 1) —— 同一根因,已亲自复现:
  开源导出剥离整个相册区,泄漏守卫禁止保留文件出现「photo」;Task 5 的守卫注释两次引用相册区那份先例
  ⇒ src/views/__tests__/filesLayoutHeightCap.test.ts:2,11 命中。**这是本期引入的真缺口,不是既有噪声。**
  判定:不加白名单。查过 forbidden.mjs 现有白名单条目**全是偶发词形碰撞**(/DATA/Photos 用户路径、
  测试夹具、大小写敏感性测试),没有一条是引用相册功能区本身;我这两条是真的指向开源树里不存在的文件
  = 悬空引用。加白名单会掩盖真缺陷并稀释白名单语义 ⇒ 改写注释。已派 Task 5 实现者修。
  ⚠️ 教训:**跨区引用的注释会被开源剥离守卫抓**,写守卫注释时别指向被剥离的区。
Task 6: gate6 前提作废 —— **sp12-plan-b 已在本任务执行期间合入 master(9100418),分支已删**。
  实现者改用对 master 预演,exit 0 + 单行 tree OID dc2ecbc = 无冲突。(另注:仓里新出现
  sp15-photos-moments / sp16-kvm-settings-fixes 两个 worktree,有别的会话在并行推进)
Task 6: 额外提交 8fbecf7 = 把我(控制器)遗留在工作区未提交的计划文档改动落盘,诊断准确、提交信息诚实
Task 5: fix round 1/5 (1 addressed, 0 open; commit 3080275) —— 改写注释去掉跨区引用,CSS/断言未动
Task 6: 两道红门已修复,控制器亲自复跑验证(HEAD 3080275):
  全量套件 **659 文件 / 10510 例 零失败** · oss 门 141/141 · parity 9/9
  合并预演对**新 master**(已含 plan-b) exit 0 + 单行 tree OID c9338f2 = 无冲突
Task 6: 交接文档已更新真实数字 (commit 0544335)
Task 6: 评审 spec ✅ / 质量 Approved,1 Important:
  交接文档把 F17 写成既成事实、没说 jsdom 不做布局证不了实际效果,配「六道门全绿」横幅会让人误以为 F17 已验证
  (实际只有源文本守卫绿、10 步真机清单一步没跑)。**与记忆里「测试因为错的理由而通过」同类。**
  另两条 Minor:gate5 命令从 export.mjs 换成 vitest oss/ 未说明;表里没写哪几行是本人实测、哪几行是转抄控制器
Task 6: fix round 1/5 进行中 —— 补「实测 vs 推断」的区分、标注真机清单未执行、补命令替换说明与数据出处
Task 6: fix round 1/5 (3 addressed, 0 open; commit a393c52) —— 四部分全到位,且没有矫枉过正
  (F11/F12 仍能看出逻辑是真被测试守着的,只是真机表现未验)
Task 6: minor (deferred): task-6-report.md 缺 a393c52 这一轮的补记(报告卫生,不影响交接文档准确性)
Task 6: complete (commits 70c24b0..a393c52, review clean)

=== 六个 task 全部完成,进整支终审 ===

=== 整支终审 (opus) 结论:Ship with follow-ups,零正确性回归 ===
终审最有价值的一击:**F11 的前提不成立,与 F14 同类**。
  `Files.vue:81-85` 的 onItemContextmenu(本批次之前就有、未被改动)在设置 ctxEntry **之前**
  就已 `if (!files.isSelected(...)) files.selectOnly(...)` 把选区收窄成被点项;
  两个视图都接了它(:623/:635)。⇒ 清单描述的「选中 B、C 右键点 A 复制粘出 B、C」**UI 上走不到**,
  旧 selectedOr 本来就返回被点项、selectedCount 本来就是 1。
  **我的取证失误:读 Files.vue 从第 86 行起,把这 5 行漏在窗口外,又没查所改代码的调用方。**
  代码改动仍保留(单点真相 + 消掉 delete 分支重复逻辑),但定性从「修复迁移回归」改为「防御性收拢」;
  验收步骤 6/7 已重写成「确认无回归」而非「确认新行为」——否则机主看不出差异会以为部署没生效。
终审还实测了 F17:用 CDP 驱动真实 chromium 建了选择器链的最小复现,
  旧 CSS 侧栏量到 8236px(=内容高度,bug 复现)、新 CSS 617px 且 .files-listwrap 接管滚动;
  fixed 框选盒在 overflow 祖先内不被裁剪、坐标不偏移(证实了设计里那条推断);
  滚动条拖拽不会误触发框选(Chrome 捕获指针,mousemove 计数 0)。
终审推翻 deferred #6:`.files-listwrap` 的 `min-height: 0` 是**冗余**的 ——
  Flexbox §4.5 自动最小尺寸只在 computed overflow 为 visible 时适用,守卫锁了 overflow-y:auto 即已覆盖。
  真正需要它的是 .files-main(overflow visible),而那条**已经**被守卫锁住。⇒ 此条关闭,非缺陷。
终审新增 Minor:selectedEntries 仍有 **5** 处内联未收(ledger 原记 3 处,漏了 onToolbarDelete:319 与 :593);
  菜单计数用 selectedEntries、工具栏计数仍用未剪枝的 files.selectedCount,两者会在选区含已消失路径时分叉
修复轮(单次,终审后只发一次):6 提交 61df865/dffdae1/89d2078/3ae7b2d/dcddd48/70a860e
控制器实测(HEAD 70a860e):聚焦套件 35 文件/276 例 · tsc clean · oss 6/141 · 全量 **659 文件/10511 例零失败**
终审修复轮 re-review:6 条全部 ADDRESSED,零新增破坏。
  复核确认强制失败自证**成立**(反转 guard 后选区仍是 {b,c},第 149 行断言必红) —— 不是编的
  三条注释类修复逐行核过只动注释、函数体字节相同;protect.ts 重构语义等价
残留(终审 re-review 的 out-of-scope,未修):
  `src/files/util/contextTarget.ts:6-13` 的 JSDoc **仍写着被推翻的 F11 说法**
  (「New-UI had regressed to ... operated on the previous selection」),与几个文件外新测试注释里
  「was never reachable through the UI」正面冲突。这是这条规则在源码里的**正典位置**,
  后人读的是它不是交接文档。按「终审后不发第二轮」的规矩交机主定夺。
残留已按机主裁定修掉 (commit 6d35239):contextTarget.ts 的 JSDoc 改成「防御性收拢」口径。
  全仓复查:旧说法已清零(仅剩布局守卫失败提示里的 "regressed to min-height",说 CSS 回退,无关且正确)

=== 收官门(控制器实测,HEAD 6d35239)===
  工作区干净 · vue-tsc clean · 全量 **659 文件 / 10511 例 零失败** · oss 泄漏守卫 141/141
  合并预演 `git merge-tree --write-tree sp12-files-fixes master` exit 0 + 单行 tree OID e29546c = 无冲突
  分支共 21 提交 (3da4135..6d35239)
