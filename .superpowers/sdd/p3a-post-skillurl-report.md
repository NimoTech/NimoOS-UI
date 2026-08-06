# SP8-P3a 验收后追加② —— `?skill=` 读完即从 URL 抹掉:实现报告

工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`。

## 1. 改了什么(逐文件)

### `src/ai/views/AgentPage.vue`(`onMounted` 内,约 :267-305)

- 之前:`const skill = route.query.skill; if (skill) store.pendingSkillId = String(skill)` ——
  只暂存,从不把 `skill` 从 URL 上抹掉。
- 现在:引入本地 `query = { ...route.query }` 副本,贯穿这一段与紧邻的
  `?search=`/`?message=` 段:
  ```js
  const query = { ...route.query }
  const skill = query.skill
  if (skill) {
    store.pendingSkillId = String(skill)
    delete query.skill
    await router.replace({ path: '/ai/agent', query: { ...query } })
  }
  // ↓ 紧邻的 seed 段原样保留,只是把读取源从 route.query 换成 query
  const seedSearch = (query.search ?? '').toString().trim()
  const seedMessage = (query.message ?? '').toString().trim()
  if (seedSearch || seedMessage) {
    const clean = { ...query }
    delete clean.search
    delete clean.message
    await router.replace({ path: '/ai/agent', query: clean })
    ...
  }
  ```
- 为什么用本地 `query` 副本而不是直接依赖 `route.query`(brief §2.1 的顺序陷阱):
  mock 出的 `router.replace` 是纯 spy,不会回写 `route.query`;真实 vue-router 里
  `route.query` 的更新也是导航确认后才异步发生的。两种情况都不能指望"上一次
  replace 生效后 route.query 已经变了"。用同一个本地对象逐步 `delete`,两次
  `router.replace` 调用互不吃掉对方结果:第一次只删 `skill`,`search`/`message`
  原样留给下面读;第二次基于已经没有 `skill` 的 `query` 再删 `search`/`message`,
  最终态里三个参数都不在了。

### `src/ai/views/AgentPage.test.ts`

- 改写了既有的 `?skill=abc → 暂存 store.pendingSkillId,不触发发送` 用例
  (原第 186 行起),补上对 URL 被抹掉的断言(改名为 `…且立刻从 URL 抹掉 skill…`)。
  **这条改写是任务本身要求的**(该用例断言的正是修复前的缺陷行为
  `expect(replace).not.toHaveBeenCalled()`,与修复后的正确行为矛盾,必须更新
  断言以匹配修正后的行为——不是削弱,是把断言从"验证旧缺陷"改成"验证新修
  正")。
- 新增 `?skill=abc&search=cats → …两次 router.replace 串起来最终态里 skill 与
  search 都没了`:验证 skill 挂号(`pendingSkillId==='abc'`)、search 的 seed
  行为照旧触发(`createSession`+`send`)、`replace` 恰好调用 2 次,且用
  `toHaveBeenNthCalledWith` 精确断言第一次只删了 `skill`(留下 `search:'cats'`),
  第二次才是空对象。
- 新增 `无任何一次性 query 参数时,不调用 router.replace`:回归覆盖"不能无脑
  每次都 replace"。
- 未改动、未削弱任何既有 `?search=`/`?message=` 用例(第 109-184 行原样保留,
  含"one-shot 保留其它 query 参数不变"那条)。

## 2. Vue2 对照

- Vue2 `Agent.vue:145-148` —— 同样只暂存 `skill`,从不 `router.replace` 抹掉,
  同缺陷。
- 紧邻的 `?search=`/`?message=` 处理(Vue2 `Agent.vue:166-192` → New-UI 现在的
  :294-317)本来就有"读完立刻 `router.replace` 抹掉"的正确成例,本次改动只是
  把 `skill` 对齐到同一模式,没有新增模式。

## 3. 承接了 Vue2 哪些行为

- `?skill=` 只暂存不发送(消费点仍在 `agentStore.ts` 的 `send()`,本次未碰)——
  原样保留。
- `?search=`/`?message=` 的既有语义(search 恒新建会话、message 复用现有会话、
  search 优先于 message、one-shot 保留其它 query 参数)——原样保留,零改动。

## 4. RED → GREEN 证据

**RED(改测试、未改实现,验证测试本身先失败于正确原因)**:
```
$ pnpm exec vitest run src/ai/views/AgentPage.test.ts
 FAIL  …?skill=abc → 暂存 store.pendingSkillId,且立刻从 URL 抹掉 skill…
 AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
   ❯ expect(replace).toHaveBeenCalledTimes(1)

 FAIL  …?skill=abc&search=cats → …
 AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
   ❯ expect(replace).toHaveBeenCalledTimes(2)

 Test Files  1 failed (1)
      Tests  2 failed | 36 passed (38)
```

**GREEN(实现修复后)**:
```
$ pnpm exec vitest run src/ai/views/AgentPage.test.ts
 Test Files  1 passed (1)
      Tests  38 passed (38)
```

**额外 RED 探针(只删除 `delete query.skill` + 对应 `router.replace` 调用,
其余代码不变,验证精确报红后原样复原)**:
```
$ pnpm exec vitest run src/ai/views/AgentPage.test.ts
 FAIL  …?skill=abc → 暂存 store.pendingSkillId,且立刻从 URL 抹掉 skill…
 AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 FAIL  …?skill=abc&search=cats → …
 AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
 Test Files  1 failed (1)
      Tests  2 failed | 36 passed (38)
```
复原后重跑:38/38 绿(`git diff --stat` 最终只含预期的两个文件改动,无残留)。

## 5. 三门完整终值

```
pnpm test                    → Test Files  291 passed (291) / Tests  2418 passed (2418)
pnpm exec vue-tsc --noEmit   → exit=0(空输出)
pnpm build                   → exit=0,built in 11.99s
                                仅既有 "(!) Some chunks are larger than 500 kB" 警告,
                                无新增第三方包警告,无 error。
```
基线为 291 文件 / 2416 例;本任务新增 2 条用例(`?skill=&search=` 组合 +
"无 query 不 replace" 回归)→ 2418,无红项,无 flaky(`persist.test.ts` 未触发)。
输出完整落盘于 `/tmp/p3a-test.log`、`/tmp/p3a-tsc.log`、`/tmp/p3a-build.log`,
未使用 `| tail`。

## 6. i18n

未新增/复用任何 i18n 键——本任务不涉及文案,只涉及 URL query 处理逻辑。

## 7. 偏离申报

1. **【逻辑照正确,brief 明确授权的本任务本体】** 修正 Vue2 `Agent.vue:145-148`
   的真缺陷(`?skill=` 不抹 URL)。三件套:①代码注释(AgentPage.vue :270-285)
   ②本报告 ③台账由协调者据本报告登记。
2. **【测试改写,非削弱】** 既有 `?skill=abc → 暂存 store.pendingSkillId,不触发
   发送` 用例的 `expect(replace).not.toHaveBeenCalled()` 断言与修复后的正确行为
   矛盾(该断言本就是在验证被判定为缺陷的旧行为),已改写为验证新行为,并保留
   "不触发发送"这条核心断言不变。`?search=`/`?message=` 相关既有用例（含
   §3 授权范围外的所有其它用例）**一条未动**。
3. 未触及公共约束 §3 的 6 条既授权偏离(与本任务范围无关)。
4. 未做 brief 第③条"停用技能提示"——按 brief 要求本轮明确不做。

## 8. 范围确认

只改了 `src/ai/views/AgentPage.vue` 与 `src/ai/views/AgentPage.test.ts`。未碰
`agentStore.ts`、`AgentComposer.vue`,未做停用技能提示。
