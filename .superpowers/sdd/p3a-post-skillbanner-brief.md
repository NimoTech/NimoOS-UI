# SP8-P3a 验收后追加 —— 「已挂载技能」可见提示条

> 先读 `.superpowers/sdd/p3a-common-constraints.md`(公共约束,与本文冲突时以它为准)。
> 例外:本任务是**用户明确要求新增 Vue2 没有的 UI**,所以「界面 1:1」那条在此让位于
> 用户 2026-07-30 的当面指令 —— 但仍须按 §2 三件套申报。

## 1. 背景:为什么要做

用户在 P3a 验收时问:「try in chat 后 URL 变了,但真的会使用这个 skill 吗?」

实测链路(协调者已逐环核实,是通的):

```
点「在对话中试用」→ /ai/agent?skill=<id>
  → AgentPage.vue:268-269 onMounted 把 id 存进 store.pendingSkillId(只暂存,不发送)
  → 用户【下一次 send()】时:agentStore.ts:925-927 把它塞进请求头 X-Skill-Id,
    然后 pendingSkillId = null(只消费一次)
  → Python agent(agent/main.py:2272-2299)读该头 → 从
    /var/lib/nimoos/ai/skills/.runtime/<uid>/<id>/SKILL.md 读全文
  → 把 SKILL.md 拼在用户那句话前面再交给模型:
    "(Using skill `<id>`. SKILL.md follows.)\n\n<md>\n\n---\n\n<用户消息>"
```

Vue2 完全同款(`Agent.vue:145-148` + `agentStore.js:357-359`),这套是 **P1 期就搬好的**,
P3a 只是加了那个跳转按钮。

**问题**:全程界面上**没有任何提示**说「下一条消息会带上某技能」。用户看着 URL 变了,
无法确认到底生效没有 —— 用户的提问本身就是证据。用户拍板:**做这条(方案①)**。

## 2. 要做什么

在**输入框内部、现有 chips 行之上**加一条可关闭的提示条,显示当前挂号的技能,
并在挂号存在时才渲染。

**为什么放这里**(协调者定,实现者照做):`.composer` 盒子里已有的
「可见资源 chips / 附件 chips」行,语义就是「会跟着下一条消息一起发出去的东西」——
挂号技能正是同一类东西,放在一起心智模型一致,且天然继承
`pointer-events: auto`(父级 `.composer-wrap` 是 `pointer-events: none`)。

### 2.1 落点

`src/ai/components/shell/AgentComposer.vue`,模板里 `<div class="composer">` 之内、
`<div v-if="chips.length > 0 || attachments.length > 0" class="composer-chips">` 这一行**之前**。

### 2.2 数据来源

`AgentComposer.vue:159` 已有 `const store = useProvidedAgentStore()`,
`pendingSkillId` 已由 `agentStore.ts:1196` 导出 —— **直接读写 `store.pendingSkillId`,
不要加 prop、不要加 emit、不要碰 `AgentPage.vue`。**

### 2.3 行为

- `store.pendingSkillId` 为真值时渲染,否则整条不渲染(`v-if`)。
- 内容:`AgentIcon` 的 `sparkle`(size 12)+ 文案 + 关闭按钮(`AgentIcon` 的 `x`,size 10)。
- 关闭按钮:`store.pendingSkillId = null`,提示条消失。**不做别的**(不改 URL —— 那是
  方案②,用户本轮没选)。
- **发送后自动消失**:`send()` 内部会把 `pendingSkillId` 置 null,提示条靠 `v-if` 自然消失。
  **不需要额外代码**,但**要有测试钉住这个行为**。

### 2.4 文案(本仓自造,无 Vue2 对应)

技能 id 就是 slug(如 `duplicate-sweeper`;实测 `manifest.json` 里 `id === name`),
要用 `<code>` 包起来 —— 与 `SkillDetail.vue` 里 `<code>{{ skill.name }}</code>` 的呈现一致。

用 `<i18n-t>` 具名插槽把 `<code>` 填进去(**不要**把 `<code>` 写进 i18n 值,也不要用
`v-html`)。先例:`src/ai/components/tabs/ResourcesTab.vue:165-172`、
`src/ai/components/shell/MentionPopover.vue:328`。

| 键 | zh_cn | en_us |
|---|---|---|
| `aiSkPendingBanner` | `已挂载技能 {name},将应用于下一条消息` | `Skill {name} is attached — it will apply to your next message` |
| `aiSkPendingDetach` | `取消挂载` | `Detach skill` |

`aiSkPendingDetach` 用作关闭按钮的 `:title` / `aria-label`。
两档都要加(`parity.test.ts` 断言键集一致);值里无字面 `@`,不涉及 `{'@'}` 转义。

### 2.5 样式

`AgentComposer.vue` **本来就有 `<style scoped>`**(:1230 起,`.ctx-chip` 等都在里面)——
新样式加在同一个块里,**不要**新建 scss 文件。

- 类名用 `.pending-skill`(+ 需要的子类),别蹭 `.ctx-chip`(那是 chips,语义不同)。
- 视觉:整行一条,与 `.ctx-chip` 同一视觉语言(圆角、12px 字号、6px gap),
  但用 accent 淡色底以示区别(参考 `.composer:focus-within` 用的 `--accent-softer`)。
- 🔴 **颜色一律 token**。这是 `.vue` 的 `<style>` 块,`src/styles/color-guard.test.ts`
  **会逐行扫**(且不跳注释行)—— 禁 `#hex` / `rgb()` / `rgba()` / 具名色(含 `white`/`black`),
  禁 `theme-exception` 逃逸。先 grep `src/ai/styles/tokens.scss` 找现成语义 token;
  找不到合适的就**停下来返回 NEEDS_CONTEXT**,不要自造。

## 3. 测试

扩 `src/ai/components/shell/AgentComposer.test.ts`(现有 81 例,**一条都不许删或削弱**)。
至少覆盖:

1. `pendingSkillId` 有值 → 提示条渲染,且文案里出现该 slug(在 `<code>` 里)。
2. `pendingSkillId` 为 null → 整条不渲染。
3. 点关闭按钮 → `store.pendingSkillId` 变成 null,提示条消失。
4. **发送后自动消失**:`pendingSkillId` 有值 → 触发发送 → `pendingSkillId` 被清 →
   提示条消失。(若该文件的 store 是 mock 的,就断言"清空后重渲染不再出现"这一半,
   并在报告里说明为什么另一半在此文件不可测。)

**禁空转用例**;对判别力弱的断言做 RED 验证(故意弄坏 → 看到红 → 复原 → 看到绿),
报告里贴输出。

## 4. 申报(公共约束 §2 三件套)

这是**新增 Vue2 没有的 UI**,属界面偏离,必须:
① 组件里写注释:说明 Vue2 无此元素、为什么加(用户 2026-07-30 指令 + 上面那条
「用户无法确认技能是否生效」的可复现体验问题)、以及它读的是哪个 store 字段。
② 报告里单列一条偏离。 ③ 协调者据报告登记台账。

**不要做的**(用户本轮没选,别顺手):
- 方案②:发完后从 URL 清掉 `?skill=`(`router.replace`)—— **不做**。
- 方案③:技能被停用/删除时的提示 —— **不做**。
- 不碰 `AgentPage.vue`、不碰 `agentStore.ts`、不碰技能分区那 7 个文件。

## 5. 门

```
pnpm test                    # 全量,基线 291 文件 / 2412 例
pnpm exec vue-tsc --noEmit
pnpm build
```
**输出完整落盘,不许 `| tail`。** 本任务不新增 `.vue`,color-guard 不会自动 +1。
已知 flaky:`src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`
(全量偶发、单文件隔离连跑 5 次全绿),只它红就复跑一次并说明。
