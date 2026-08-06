# SP8-P1c-2 全支线终审 brief(Task 13 Step 6)

范围:`git diff 3614196..035e25c`(48 文件 / +4590 / -65),即 P1c-2 全期 13 个任务 + 3 次修复 pass。
Diff 包:`.superpowers/sdd/review-3614196..035e25c.diff`(256 KB)。
仓库:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,HEAD `035e25c`。

## 只读

**共享 worktree,评审绝对只读**:不得改工作树/索引/HEAD/分支,不得 `git add`/`commit`/`checkout`/`stash`,
不得编辑任何文件(含 Vue2 老仓)。可以跑测试与类型检查(不改源)。需要旧版本就
`git show <sha>:<path>`,不要移动 HEAD。

## 不许采信报告

本期已三次抓到实现者报告的不实陈述或空转断言(T8 谎称 token 两块都有值、T11 谎称与 Vue2 一致、
T11/T12 共三条无判别力断言),外加一次 haiku reviewer 的误报(Pinia setup-store 自动解包 ref)。
**任何"逐字一致""两块都有值""与 Vue2 行为相同""N 条测试"之类的说法,一律自己去读源文件/grep/跑一遍确认。**

## 背景

New-UI = Vue 3 + TS 重写,`/app/` 下与 Vue 2 老应用并存。本期 P1c-2 补齐 AI 助手页的
**右栏 4 tab(Activity / Context / System / Resources)+ 顶栏(AI 改标题 / ModelPicker /
右栏折叠 / ThinkingBar)** 及支撑 store 域。

Vue2 真值源(**只读**):`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Agent/`
本期计划(含「本期做 / 不做」边界节):`/home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-07-27-vue3-migration-sp8-p1c2-rightpanel.md`
SDD 台账(13 个任务的逐条裁定、已修项、已记账 Minor):`.superpowers/sdd/progress.md`,**从 `== SP8-P1c-2 开始` 往下读**
各任务 brief / report:`.superpowers/sdd/p1c2-task-N-{brief,report}.md`(N=1..13)、`p1c2-fix-t8-t9-report.md`、`p1c2-fix-t12-{brief,report}.md`

## 移植纪律(用户 2026-07-27 拍板)

- 界面/视觉/交互 = 严格 1:1 照 Vue2。
- 逻辑 = 按正确的来:Vue2 的 bug/竞态/吞错不照搬,改成正确逻辑,但**必须**①代码注释注明 Vue2 行号与问题
  ②报告申报 ③台账登记。**未申报的偏离本身即缺陷。**
- 禁与需求无关的重构/改名/换库。

## 必须重点核的 6 条(Task 13 Step 6 原定清单)

1. **工厂形态与 `useProvidedAgentStore` 纪律** —— `useAgentStore(agentType?)` 保工厂形态
   (store id `` `ai-agent-${agentType ?? 'general'}` ``);所有 store-consuming 组件走
   `useProvidedAgentStore()`,**只有 `AgentPage.vue`** 调 `useAgentStore()` + `provideAgentStore()`。
   本期新增的 6 个组件(AgentRightPanel / 4 个 tab / ModelPicker / ThinkingBar)是否都是哑组件?
2. **store 五个新域逐字对 Vue2**,尤其:
   - thinking 四动作(Vue2 `store/agentStore.js:656-698`)—— **乐观更新且 PATCH 失败不回滚**是有意保留,核实它确实是有意且有注释
   - `regenerateTitle`(Vue2 `:210-244`)—— in-flight 状态是**对象 `{id, background}`** 而非布尔;
     守卫顺序;顶栏比较处是否已 `String(r.id) === props.sessionId`(T9 的 F1 修复)
   - `reverting` **三键命名空间**(裸 runId / 裸 batchId / `'item:' + stagedId`)—— store 写入键与
     ResourcesTab 读取键必须一致,错一个就"转圈永不出现"或"按钮永不恢复"
   - `rightTab` / `toggleRight`(Vue2 `:157-158`)
   - `removeVisibleResourceByPath`(1c-1 挂账 1 的还款)
3. **三处有意偏离都带注释与登记**:①SystemTab 改吃 New-UI 实时 utilization 通道(Vue2 是 mounted 一次性拉)
   ②ModelPicker「去设置」只弹占位 toast、不路由 ③头像版本改为应用级共享 store + `bumpAvatarVersion()`。
   另核 T12 的 0 字节暂存项 `0 B`(Vue2 显 `—`)与 T13 的 `activitySteps` 会话边界清空(Vue2 从不清)
   这两处**修 Vue2 缺陷**类偏离,注释与申报是否齐备。
4. **1c-1 三张挂账票确实还清**(见计划「1c-1 结转挂账」节 1/2/3):无 id 的 chip 可删、staged 分组
   reactivity 加固、`popSegment` 不 focus 的补断言。
5. **toast 分档对其他区域零回归** —— `show(text, duration?, tier?)` 第三参可选默认 info;
   全仓 ~40 处既有调用点(首页/文件/应用)行为必须一字不变;`.toast` 基础 CSS 规则不得被改。
6. **ResourcesTab 与移植过来的 Vue2 测试断言一致** —— Vue2 `NimoOS-UI/tests/resourcesTabBatch.test.js`
   (164 行,9 条断言)一条都不许丢或被削弱。

## 另需你判的

7. **T13 的接线**(commit `59e294b`,本期最后一块):`AgentPage.vue` 挂 `<AgentRightPanel>`,
   props/事件对 Vue2 `Agent.vue:44-64`。实现者报称 Vue2 12 prop → 本仓 11 个(`systemMetrics` 按用户
   决定删掉),7 事件全接,另称「brief 说 ResourcesTab 有 7 个 emit,实测只有 6 个」。**逐条核**:
   有没有漏接的 prop/事件、事件名与 store 动作签名是否真的对得上、`session-id` 归一化成 string 后
   下游(尤其 ResourcesTab 的 `rawUrl` 与顶栏改标题禁用态)是否都还正确。
8. **`activitySteps` 清空点是否完备且不过头** —— 落在 `createSession` / `deleteSession` 活跃分支 /
   `selectSession`,是否覆盖了所有会话边界、有没有误清(例如同会话内重连/重新 attach 时不该清)。
9. **测试判别力抽查** —— 本期新增 ~600 例。挑你最怀疑的 5 条,判断它们是否可能空转
   (选择器在组件里不存在、`not.toThrow()` 套异步、单元素数组分不清 `.some`/`.every`、
   断言的是 mock 自己的返回值等)。找到就报。
10. **主题**:本期新增的每个 token 在 `src/ai/styles/tokens.scss` 的浅色 `.agent-app` 块与
    `[data-theme="dark"]` 块**两处都要有值**(T8 就栽在这)。`src/styles/theme.css` 新增的 toast 档位
    token 同理(该文件是主 OS 主题,两个主题块)。diff 里不得有新裸色。
11. **i18n**:本期新键(约 60+)双 locale 齐全;文案里的 `@` 必须写成 `{'@'}`;
    抽查中文值不是英文复制品或占位符。

## 台账累积的 Minor 清单 —— 请你 triage

对每条给:**仍然成立 / 已失效 / 应升级为 Important**,以及是否该在本期收掉。

- T3:测试里 `null as unknown as string` 的多余双 cast(纯化妆)
- T4:①报告称"13 个新用例"实为 12 ②无冒号 key 那条只断言未调服务,没顺带断言 `regeneratingTitleFor` 仍为 null
- T5:①未直接测 `listVisibleResources` 自身抛错时错误穿透(composer 层是 mock 掉整个 store 动作测的)
  ②`removeVisibleResourceByPath` 在 await 后重读 `activeSessionId`,切会话中途有竞态窗口
  (与既有 `removeVisibleResource` 同款模式,非新增)
- T6:①toast 各档边框仍用中性 `--chip-border`,只有底色/文字随档变 ②真机像素对比度未核(纸面推理成立)
- T10:①报告两处不实/计数偏差 ②`ms === 10000` 边界未直测
- T11:报告称新增 20 例实为 17
- T12:①`r.id as string | number` / `it.staged_id as string | number` 两处断言抹掉了源字段的 `| undefined`
  (与 Vue2 同样不做防御)②`{s}` 英文复数后缀作 i18n 参数传给 zh 消息(zh 不引用,vue-i18n 容忍)
- T13:实现者申报的三处 TS-only 收窄/桥接 computed;七个 store action 的 rejection 无人接
  (Vue2 `agentStore.js:754/773/788/799/812/830` 同样无人接)
- 1c-1 遗留仍开着的:`pickItem` 的 `focus()` 早于 `setSelectionRange`(当前安全);
  SlashPopover 无 folders prop watcher

## 门(你自己跑一遍,报真实尾巴)

```
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test
pnpm exec vue-tsc --noEmit
```
协调者刚跑过:`259 files / 1862 tests passed`、tsc 零错误、`pnpm build ✓ built in 11.69s`(只有既有 500KB 警告)。
若你跑出不同结果,那本身就是发现。

## 输出格式(中文)

### 优点
### 逐条裁定
对上面 11 个必核点逐一给 **成立 / 不成立 / 部分成立**,每条附你实际看到的证据(file:line、grep 输出、
测试输出片段)。不要复述报告的说法当证据。
### Minor 清单 triage
逐条给结论。
### 问题
#### Critical(必须修) / #### Important(应当修) / #### Minor(记账即可)
每条:file:line、错在哪、为什么要紧、怎么修。
### 报告不实陈述
逐条列出各任务报告里与事实不符的说法(没有就写「无」)。
### 结论
**Spec 符合度:** ✅ / ❌
**质量:** Approved / Needs fixes
**可否交用户 :5288 验收:** 可 / 需先修 N 项
**一句话理由:**
