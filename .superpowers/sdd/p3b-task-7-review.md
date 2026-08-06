# SP8-P3b Task 7 独立评审 —— SkillDetail.vue D4 弹窗 + 挂 TestPanel

提交:`d8078aa`(`sp8-ai`,BASE `c13e102`)。评审方法:不采信报告,自行对照 Vue2 蓝本
(`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillDetail.vue`)、自行读当前源码
(`src/ai/components/settings/skills/SkillDetail.vue`、`.test.ts`)、自行读设计文档
(`NimoOS-UI/docs/superpowers/specs/2026-07-30-vue3-migration-sp8-p3b-skills-write-design.md`
§9.4/§10.2)、自行跑测试、自行做 RED 探针。

## 判定

① 规格合规:✅(对照任务书逐条落地;但发现任务书与设计文档 §9.4 之间存在一处未申报的
文字差异,见 Important-1,不算实现者缺陷)
② 代码质量:通过(附 2 条 Important 覆盖缺口、1 条 Minor)

## 发现清单

- **[Important-1] 设计文档 §9.4 要求「启用并试用」失败时留在弹窗内,任务书/实现改成立即关弹窗,无三件套申报** —— `SkillDetail.vue:288-294`(`confirmEnableAndTry` 点击即 `tryModalOpen.value = false`,不区分成功/失败)。设计文档原文(`…skills-write-design.md:290`):「启用并试用(先 toggle(id,true),成功才跳转;**失败则留在弹窗 + danger toast**,不跳转)」。任务书 §1 却把它简化成「发 toggle 后关弹窗」,并引用"spec §9.4 要求"只覆盖了"失败不跳转"这一半,漏了"留在弹窗"这一半。danger toast 那半由未来 Task 8(`SkillsSection.vue onToggle`)兜底,不缺;但"失败后弹窗已经关闭、用户只能重新点一次试用按钮才能回到 D4"这个 UX 落差,目前只存在于任务书的简化措辞里,没有在代码注释/报告里作为"偏离设计文档"申报。建议协调者确认这是有意简化还是遗漏。
- **[Important-2] pendingTry 一次性语义的关键分支缺测试覆盖,两次独立 RED 探针均未被抓到** —— `SkillDetail.vue:308-316`(`watch(() => props.skill?.enabled, …)`)。
  - 探针 A:删掉「跳转前清空 `pendingTryId`」那一行(`pendingTryId.value = null` 紧邻 `router.push`前那句),只留 push——`pnpm vitest run SkillDetail.test.ts`:45/45 全绿,零红。随即手写一条探针用例复现真实场景(D4 成功跳转后,用户之后手动把同一技能关了再开)—— 该场景下 `push` 被多调用一次,证实这正是任务描述点名的"以后每次 enabled 变 true 都跳转"残留 bug,但现有 7 条新用例一条都没有覆盖"成功跳转之后再次 toggle 同一技能"这个场景(test 5 只测了「切到别的技能再切回来」,不是「同一个技能事后再开关」)。
  - 探针 B:删掉 `if (enabled === true)` 判断,变成 id 匹配就无条件 push——同样 45/45 全绿。说明当前测试从未验证过"enabled 变 false 时不应该 push"这一支(因为测试用"新对象但字段值不变"模拟失败,Vue watch 对未变化的值根本不会触发回调,所以这个断言对该判断分支没有判别力)。
  - 两次探针都已还原,`git status` 干净。生产代码本身当前是对的(两处判断都存在且正确),这是一条**测试覆盖缺口**,不是功能缺陷,但恰好缺在任务书点名要求"自己独立推演"的最高风险点上,建议补两条用例:①同一技能成功跳转后再手动开关一次不应重复 push;②enabled 从 true 变回 false 时不应 push。
- **[Minor] `s.id !== pendingTryId.value` 分支确认为当前架构下不可达的防御性代码** —— `SkillDetail.vue:311`。独立推演结论见下。报告已如实申报"从未被 RED 验证过",不是谎报;分支本身失败即清空、不误跳转,是 fail-closed,不构成缺陷,但目前是零覆盖的死分支。建议留着(不依赖 Vue 内部调度顺序这个理由本身成立),但不必强行造一个不自然的测试去"够到"它。

## `pendingTry` 一次性语义独立推演结论

三条清除路径(跳转前/取消/skill.id 变化)逐一在源码里核对存在且逻辑自洽,`git checkout`
前用两次 RED 探针（见上）证实"跳转前清空"与"enabled===true 判断"两处都是**生产代码里真实存在
且必要**的防线——删掉任一处都会在真实场景下复现"以后每次开关都被误跳转"，只是现有测试
**抓不到**这两处删除（已作为 Important-2 报告）。

关于报告自陈"`s.id === pendingTryId` 这条核对从未被现有测试逼到"：**独立复核后认同**。
`props.skill` 是整体替换（非深层 reactive 的字段级更新），`watch(() => props.skill?.id, …)`
与 `watch(() => props.skill?.enabled, …)` 两个 watcher 都订阅同一个 `skill` 属性；Vue
调度器按 effect 创建顺序（更早创建=更小 job id）在同一次 flush 内执行，id-watch 在源码里
先声明（:163 vs :308），所以只要 `skill` 整体被替换（id 与 enabled 同时可能变化），
id-watch 恒先跑完并清空 `pendingTryId`，enabled-watch 读到的 `pendingTryId` 必已是 `null`
或与新 `s.id` 一致——`s.id !== pendingTryId.value` 分支在此架构下没有输入能让它为真。
这不是"用例没写够"，是**分支本身在当前代码结构下结构性不可达**（除非把两个 watch 的注册
顺序倒过来，或 Vue 改变了同 tick 内 watcher 的调度语义）。判定：**防御性冗余，可保留，
不需要，也不应该为了"覆盖"它去写一个依赖内部实现细节反转的伪造测试**。不会出现"以后每次
enabled 变 true 都跳转"的残留——三条清除路径叠加下，`pendingTryId` 处于非空的时间窗口
严格限定在"点击启用并试用"到"三条路径任一触发"之间，验证成立。

## 既有用例反转核查

`:146`(P3a 占位用例)已按公共约束 §9 要求**反转**而非删除：diff 逐字比对确认改前
`expect(...).toBe(false)` 全部变成改后的正向存在 + DOM 顺序断言（`.sk-section-title`
数组 `['描述','沙箱测试','SKILL.md','附带文件']`），且这四个标题分别来自四个不同
`.sk-section`（TestPanel 自己只渲染一个 `.sk-section-title`，已 grep 确认），顺序断言
有效钉住"夹在描述段与 SKILL.md 段之间"这个位置要求,不是只查 `.exists()`。另一处
`hints[2]→hints[3]` 的下标位移已核实为 TestPanel 自带一个 `.sk-section-hint` 造成的
结构性位移（非削弱），旧断言的判别力（"精确定位第三个 hint 并比对文案"）原样保留。
**零断言被丢弃或削弱。**

## 两种弹窗外壳并存 / D4 三件套

代码头注释「两种弹窗外壳并存,不是不一致」（`SkillDetail.vue:77-83`）与就地注释
（`:490-492`）均已写明理由；确认 D4 模板（`:493-503`）确实走 `SkModal`
（`:open`/`@update:open`/`#footer`），不是删除确认弹窗那套裸 reka 原语。D4 三件套：
代码注释✅（`:67-75`「偏离申报 3」）、报告申报✅（报告 §9 偏离②）、台账登记待协调者
按报告落笔（不在本次评审范围内可验）。

## 范围 / 配色 / 越界核查

- `git show --stat d8078aa`:仅 `SkillDetail.vue` + `SkillDetail.test.ts` 两个文件,未碰
  `TestPanel.vue`、`SkModal.vue` 或其它文件。`git log --oneline -5` 确认这是独立的一个提交。
- Diff 内新增的可见颜色:零。新增两个按钮 `class="sk-btn ghost"` / `class="sk-btn primary"`
  均已 grep 确认在 `sk-shared.scss:29` 定义、且在 `ChannelsSection.vue`/`AddSkillModal.vue`
  等既有文件里有先例用法,不是凭空造的类。组件本身零 `<style>` 块。
- `SkModal.vue`(本任务的依赖,非本次改动)内有 `<style scoped>`,但那是 P2b Task 3 已评审
  通过的既有文件,不在本次 diff 范围内,不予追责。

## RED 探针 + 已还原

三次探针,均已确认还原(`git status` 显示 `nothing to commit, working tree clean`,
`git diff --stat` 空输出):
1. 删「跳转前清空 pendingTryId」一行 → 45/45 仍绿(证实 Important-2 的覆盖缺口)。
2. 追加一条临时探针用例复现"同技能事后再开关"场景 → 该用例精确报红
   (`expected "vi.fn()" to not be called at all, but actually been called 1 times`),
   证实生产代码里那一行是真实防线,只是没有常驻用例盯着它。探针用例与探针 1 的改动
   一并已 `git checkout` 撤销。
3. 删 `if (enabled === true)` 判断(改成无条件 push) → 45/45 仍绿(证实覆盖缺口的第二个角度)。

## 自测数字

- `pnpm test`:296 files / 2539 tests,全绿,exit 0(与报告一致)。
- `pnpm exec vue-tsc --noEmit`:exit 0,空输出(与报告一致)。
- `pnpm build`:未重跑(任务允许"不必重跑全量"),报告给出 exit 0 + 11.93s,无理由怀疑。

## 算术核对

本任务未新增 `.vue` 文件(只改 `SkillDetail.vue` 一个既有文件),`color-guard.test.ts`
用例数应不变;`pnpm test` 总数从上一任务终值 2532 → 本次 2539,增量 7,与报告列出的
7 条新用例(D4 五条 + P3a 回归一条 + test 转发一条)一致。核对通过。
