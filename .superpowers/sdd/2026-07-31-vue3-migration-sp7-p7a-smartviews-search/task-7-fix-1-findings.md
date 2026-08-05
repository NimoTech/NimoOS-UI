## Fix round 1 —— 1 Important + 1 并入的 Minor(另 1 条 Minor 记台账,是 brief 的预测偏差、不用你改)

评审判 **Spec ✅**(节点清点表独立重做过、14 组节点 + 18 条 scss 规则逐条核对**零漏渲染**;两条腿审计做到了;6 条删码里 5 条独立复核**全部成立、无一被推翻** —— 这是本期头一个删码清单零翻车的任务)。**Task 质量 Needs fixes**,原因只有下面这一条。

### I1(Important)—— `.sv-cond-add[data-open="true"]` 那条 cssCascade 断言是**零价值恒真断言**,不是「意义打了折扣」

评审做了两次变异实测:①把 `.sv-cond-add[data-open="true"]` 的 `background` 改成明显错误的值 → 那条用例**仍绿**;②**整条规则删掉** → **仍绿**。

**根因(控制器已复核)**:`src/photos/components/__tests__/cssCascade.ts` 的 `hoverBackgroundRules` 里有个**空数组恒真(vacuous truth)漏洞** —— 它用 `pseudoHits.every(p => p === ':hover')` 判定「这条规则是不是 hover 态规则」,而**纯属性选择器 / 纯类选择器里根本没有 `:` 伪类** ⇒ `pseudoHits` 是空数组 ⇒ `.every()` 恒真 ⇒ **`.sv-cond-add { background: transparent }` 与 `.sv-cond-add[data-open="true"] { … }` 这些非 hover 规则也被当成 hover 候选收进来**。而 `classSpecificity` 又不给方括号计分,于是 `.sv-cond-add:hover`(算 2)恒胜 ⇒ `winningHoverBackground(style, ['sv-cond-add'])` **永远返回 `.sv-cond-add:hover` 那条**,`[data-open="true"]` 写什么、甚至删掉都不影响结果。`expect(win.specificity).toBe(2)` 只是在反复验证 `.sv-cond-add:hover` 自己。

**控制器量过影响面**:其余 13 个 `winningHoverBackground` 消费方传的全是**类变体**(`is-active` / `cad-btn-danger` / `mrd-btn-primary` / `cp-tab` / `rail-place` …),那些场景里 `:hover` 规则的优先级**严格高于**同名非 hover 规则、且断言都额外要求「胜出选择器含 `:hover`」⇒ **这个漏洞目前只咬到你这一处属性选择器变体**,不是全区性假绿。

**并且 —— 控制器回源发现一件更要紧的事**:Vue2 `photos-smartview.scss:294-303` 的 `.sv-cond-add:hover` 与 `.sv-cond-add[data-open="true"]` **三条声明逐字相同**(同样的 `border-color: var(--accent)`、同样的 accent 文字色、同样的 `background: var(--accent-soft)`)。**所以这里本来就不存在级联冲突可守** —— 「打开态」与「hover 态」在 Vue2 里视觉上就是同一个样子。你注释里写的「值本来就相同、无真实白底白字风险」**这个判断是对的**;问题只在于你留下的是一条**恒真断言**而不是一条诚实断言。

**改法(两件事都做)**:

1. **把那条零价值断言换成能真正证伪的形式** —— 钉住 Vue2 真正编码的那个不变量:**「打开态与 hover 态的背景一致」**。即分别取出 `.sv-cond-add[data-open="true"]` 与 `.sv-cond-add:hover` 两条规则体(用 `parseCssRules` 锚定),断言两者的 `background`(以及 `border-color`)**相等**;并断言 `[data-open="true"]` 那条规则**存在**(删掉即红)。这比现在的 `specificity` 断言有意义得多,而且直接对应 Vue2 的设计意图。**顺手把注释改成说明这个不变量,别再说「按硬约束写了 cssCascade 断言」**(那句话现在是误导)。
2. **把 `cssCascade.ts` 的 vacuous-truth 漏洞修掉(控制器授权改这个共享文件)** —— 在 `hoverBackgroundRules` 的循环里加一条:**选择器字符串不含 `:hover` 就 `continue`**(1 行)。理由:这个 helper 名字叫 `hoverBackgroundRules`,收非 hover 规则本身就是错的;修完每条既有断言只会**更强**不会更弱。**顺带给 `classSpecificity` 加属性选择器计数**(正则加 `\[[^\]]*\]` 一项,也是 1 行)—— T6 已因这个限制被迫改过一次生产码形状,补上以后就不必再迁就工具。
   - **⚠ 改共享文件的硬要求:必须跑全量 `pnpm exec vitest run` 并在报告里贴出「改前 / 改后」的通过数,证明 13 个既有消费方的断言结论一条都没变**(若某条变红,说明它此前也是靠这个漏洞苟活的 —— 那是重要发现,立刻停下来报给我,不要自行改那条断言)。

### M1(并入本轮)—— `submit()` / `addSuggestion()` 内部的 `busy` guard 零覆盖

评审变异实测:把这两处 `if (props.busy) return` 分别删掉,20 个用例**全部保持绿色**。这个 guard 本身**是合理的**(primary 按钮的 `disabled` 属性拦不住 input 上的 `keydown.enter`,是一条真实的绕过路径,你的判断对),但既然当作偏离登记进了报告,就该配一条能证伪的用例:**`busy: true` 时在 input 里按 Enter → 断言无 `add` 事件**(`addSuggestion` 同理,点建议 chip)。现在删掉不变红,将来有人顺手去掉这行不会被拦住。

### 不用你改的(控制器已记台账)

- brief Step 4 删码清单第 ④ 条预测「1 条红」实测 **3 条红** —— 评审复核确认是**合理连带**(3 条分别对应「不去重」/「8 条上限失效」/「12/12 不触发整块隐藏」三个真实独立的观察点),不是断言过宽。**这是 brief 的预测偏差,不是你的问题。**
- brief 结构规格 7 称「`.sv-cond` 基类有 hover」不成立(Vue2 `scss:96-102` 无任何 `:hover`)—— **你的申报成立,控制器已回源核实并记台账**。你没生造一个 Vue2 不存在的基类 hover,这个处置是对的。

### 本轮要求

- 两条都要有**能变红**的断言;样式类一律**先锚定规则体、再断言属性**。
- 逐个删码验证新加的断言(一次一处,**Edit 手工还原,禁 `git checkout --`**)。
- **改了 `cssCascade.ts` ⇒ 必须跑全量并贴改前/改后通过数。** 其余情况只跑相关测试文件 + `color-guard` + 一次 `vue-tsc --noEmit`。
- **注释三禁**:`<style>` 块内注释不写字面 `#hex`;任何注释不写字面 `rgba(`;`<script>` 注释不写字面 `<style>` 一词。
- **fix 报告追加到同一份 `task-7-report.md` 末尾**,别新建文件。
- 返回值仍只要:状态 / commit 起止 / 一行测试小结 / concerns。
