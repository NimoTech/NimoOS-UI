# SP8-P3a 验收后追加 ② —— `?skill=` 读完即从 URL 抹掉

> 先读 `.superpowers/sdd/p3a-common-constraints.md`(公共约束)。
> 本任务是**修 Vue2 就有的真缺陷**,按公共约束 §2「逻辑照正确」三件套申报。

## 1. 缺陷

`AgentPage.vue` 的 `onMounted` 里,`?skill=` 读完**不从 URL 抹掉**:

```js
// 现状(约 :268-269)
const skill = route.query.skill
if (skill) store.pendingSkillId = String(skill)
```

而紧挨着下面几行,`?search=` / `?message=` **本来就是读完立刻 `router.replace` 抹掉的**
(约 :276-283)。三个同类「一次性交接参数」里,**只有 `skill` 漏了这一步**。

后果两条,用户 2026-07-30 都亲眼撞到了:

1. **点提示条的 × 取消挂载 → 按 F5 → 技能又挂上了。** 用户明确表达的"取消"被一次刷新撤销,
   按钮说话不算数。
2. **发完一条消息(技能已被 `send()` 消费)→ 按 F5 → 又挂一次。** 下一条消息意外带上技能。

Vue2 `Agent.vue:145-148` 同样不抹(同缺陷),**按「逻辑照正确」纪律修,不照抄**。

## 2. 要做什么

**只改 `src/ai/views/AgentPage.vue` 一处**(+ 它的测试文件)。

在 `onMounted` 里读到 `skill` 并写进 `store.pendingSkillId` **之后**,立刻把 `skill` 从 URL 抹掉,
写法**照抄紧邻的 `?search=`/`?message=` 成例**(保留其余 query 参数,用 `router.replace`)。

### 2.1 🔴 必须注意的顺序陷阱

下面那段 seed 逻辑会**再做一次** `router.replace`:

```js
const seedSearch = (route.query.search ?? '').toString().trim()
const seedMessage = (route.query.message ?? '').toString().trim()
if (seedSearch || seedMessage) {
  const clean = { ...route.query }
  delete clean.search
  delete clean.message
  await router.replace({ path: '/ai/agent', query: clean })
  ...
}
```

两次 `router.replace` 串起来必须**互不吃掉对方的结果**:

- 抹 `skill` 时**只能删 `skill`**,不能顺手动 `search`/`message`(它们要留给下面那段读)。
- 抹完之后 `route.query` 会更新;下面那段的 `const clean = { ...route.query }` 读到的是**已无 skill**
  的版本 —— 这是对的,最终三个参数都被抹掉。
- **`seedSearch`/`seedMessage` 的读取必须仍能拿到值**。若你的改法导致它们读到空,就是错的。

**三种 URL 组合都要有测试覆盖**:`?skill=` 单独 · `?skill=&search=` 同时 · `?search=` 单独(回归)。

### 2.2 不要做的

- **不碰** `agentStore.ts`(`send()` 里消费一次的逻辑不动)。
- **不碰** `AgentComposer.vue`(上一轮那条提示条不动)。
- **不做**第③条挂账(停用/删除的技能静默失效)—— 用户本轮明确只要这一条。
- 不改 `?search=`/`?message=` 的既有行为。

## 3. 测试

扩 `src/ai/views/AgentPage.test.ts`(**既有用例一条都不许删或削弱**,特别是
`?search=`/`?message=` 那几条)。至少覆盖:

1. `?skill=x` 挂载后:`store.pendingSkillId === 'x'` **且** URL 上已无 `skill`。
2. `?skill=x&search=y`:skill 挂号 · search 的 seed 行为照旧发生 · 最终 URL 上 `skill` 与 `search` **都没了**。
3. `?search=y`(无 skill)回归:行为与改动前完全一致。
4. 无任何 query 时**不该**调 `router.replace`(别无脑每次都 replace)。

**禁空转用例**;做 RED 验证(去掉抹除那几行 → 对应用例精确报红 → 复原),报告里贴输出。

> 说明:「点 × 后刷新不复活」「发送后刷新不复活」这两条**用户可见行为**,本质就是
> 「URL 上没有 skill 了」。单元测试断言到 URL 层即可,不必模拟整页刷新。

## 4. 申报

代码注释里写明:Vue2 `Agent.vue:145-148` 同样不抹 = 同缺陷;此处按「逻辑照正确」修;
并指出这是与紧邻的 `?search=`/`?message=` 对齐(引它们的行号)。报告里单列这条偏离。

## 5. 门

```
pnpm test                    # 全量,基线 291 文件 / 2416 例
pnpm exec vue-tsc --noEmit
pnpm build
```
**输出完整落盘,不许 `| tail`。** 不新增 `.vue`,color-guard 不会自动 +1。
已知 flaky:`src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`。
