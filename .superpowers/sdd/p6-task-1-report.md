# SP8-P6 · Task 1 报告 —— D3 实证:vue-router 3.6.5 的 redirect 与 beforeEach 时序

日期:2026-08-06
工作区:`/home/nimo/NimoTech/NimoOS-UI`,分支 `docs/vue3-migration-sp3`
BASE:`79de66a3`
提交:`12723358`(test(p6-t1): D3 实证 —— vue-router redirect 与 beforeEach 的时序)

## 背景

Vue2 的 `/ai/skills`、`/ai/mcp` 是 `redirect` 记录(`src/router/route.js:214-221`),目标是
`{ path: '/ai/settings', query: { section: 'skills' | 'mcp' } }`。T6 会给 `strangler.js` 加一条
`/ai` 前缀绞杀条目,把整个 AI 区重定向到新应用。若绞杀守卫(`beforeEach`)在 vue-router 内部解析
`redirect` **之前**就看到了裸的 `/ai/skills`,落点会是 `/app/#/ai/skills` —— 新应用没有这条路由
也没有 catch-all,用户会看到白屏。这一刀不许靠读源码/文档下结论,必须真跑一个 router 实例观察。

## Step 1: 实证用例

新增文件:`VUE2/src/router/__tests__/aiRedirectTiming.spec.js`(与 brief 给出的代码逐字一致,
未 mock matcher,`mode: 'abstract'`,真实 `VueRouter` 实例 + 真实 `router.push` + 真实 `beforeEach`)。

搭建方式**未作任何调整** —— brief 给出的代码在本仓库(vitest + jsdom 环境,已装 `vue@2.x` +
`vue-router@3.6.5`)一次跑通,没有遇到环境报错(不存在 `Vue.use` 缺配置、`mode: 'abstract'` 异常等问题)。

## Step 2: 第一次运行 —— 完整原始输出

```
$ pnpm exec vitest run src/router/__tests__/aiRedirectTiming.spec.js --reporter=verbose

 RUN  v4.1.4 /home/nimo/NimoTech/NimoOS-UI

stdout | src/router/__tests__/aiRedirectTiming.spec.js
Download the Vue Devtools extension for a better development experience:
https://github.com/vuejs/vue-devtools
You are running Vue in development mode.
Make sure to turn on production mode when deploying for production.
See more tips at https://vuejs.org/guide/deployment.html

 ✓ src/router/__tests__/aiRedirectTiming.spec.js > vue-router 3.x:redirect 与 beforeEach 的时序 > beforeEach 收到的 to.fullPath 是 redirect 解析之后的目标 6ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  11:19:02
   Duration  526ms (transform 160ms, setup 224ms, import 13ms, tests 7ms, environment 177ms)
```

**两条断言都通过**,即:

- `expect(seen).not.toContain('/ai/skills')` → 通过(`seen` 数组里从未出现裸的 `/ai/skills`)
- `expect(seen).toContain('/ai/settings?section=skills')` → 通过(`seen` 数组里出现的是解析后的完整路径)

由于用例第一次运行就是绿的,vitest 没有打印 `seen` 数组的具体内容(失败断言才会打印实际值和期望值的
diff;通过的断言不输出被比较的值)。但**测试逻辑本身**保证了:若 `seen` 里出现过 `/ai/skills`,
第一条断言(`not.toContain`)必然失败并把 `seen` 完整打印出来 —— 而它没有失败,说明 `seen` 数组里
不含裸路径。这就是本刀要的证据:守卫（`beforeEach`）观察到的 `to.fullPath` 只有 redirect 解析后的
`/ai/settings?section=skills`,不含解析前的原始路径。

## Step 3: 结论

**用例通过 ⇒ 守卫只见到 redirect 解析后的路径。**

```
REDIRECT_BEFORE_GUARD = true
```

（含义:vue-router 3.6.5 里,静态 `redirect` 记录的解析发生在全局 `beforeEach` **之前** ——
`beforeEach` 拿到的 `to` 对象已经是重定向目标,而不是用户实际访问的原始路径。）

已在用例文件头补注释(按 brief Step 3 「通过」分支的措辞):

```javascript
// 实证于 2026-08-06:结论 = redirect 先于 beforeEach 解析,New-UI 无需补 /ai/skills、/ai/mcp 路由。
```

## Step 4: 复跑确认绿

```
 ✓ src/router/__tests__/aiRedirectTiming.spec.js > vue-router 3.x:redirect 与 beforeEach 的时序 > beforeEach 收到的 to.fullPath 是 redirect 解析之后的目标 7ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  11:19:14
   Duration  515ms (transform 153ms, setup 209ms, import 13ms, tests 7ms, environment 178ms)
```

1 passed,与预期一致。

## Step 5: 提交

```
VUE2 (NimoOS-UI, 分支 docs/vue3-migration-sp3):
commit 12723358
test(p6-t1): D3 实证 —— vue-router redirect 与 beforeEach 的时序
1 file changed, 29 insertions(+)
create mode 100644 src/router/__tests__/aiRedirectTiming.spec.js
```

未触碰 `docs/vue3-pending/`、`FRONTEND_API_GUIDE.md`(两个未跟踪文件保持原样,未 add)。
未改动任何产品代码(`src/router/route.js`、`src/router/strangler.js` 一字未动)。

## 对 T5 / T6 的具体影响

- **T5**:根据 brief 的口径,`REDIRECT_BEFORE_GUARD = true` ⇒ **T5 不需要**在 New-UI 里为
  `/ai/skills`、`/ai/mcp` 补两条 redirect 路由。原因:Vue2 侧的 `beforeEach`(绞杀守卫所在处)
  永远看不到裸的 `/ai/skills` 或 `/ai/mcp` —— vue-router 会先把它们解析成
  `/ai/settings?section=skills` / `/ai/settings?section=mcp`,再把解析后的 `to` 交给
  `beforeEach`。因此 T6 给 `strangler.js` 加的 `/ai` 前缀绞杀条目,实际接收到的路径永远是
  `/ai/settings?...`,不会是 `/ai/skills` 原始形态,不存在"新应用没有这条路由导致白屏"的风险。
- **T6**:加 `/ai` 前缀绞杀条目时,只需确保 New-UI 新应用里有 `/ai/settings`(带
  `?section=skills|mcp` 查询串处理)这一条路由即可覆盖两个入口 —— 不需要额外处理
  `/ai/skills`、`/ai/mcp` 这两个路径字面量本身。
- 若后续行为有变(例如 vue-router 版本升级、或 Vue2 侧 `route.js` 里给这两条 redirect 记录加了
  `beforeEnter` 钩子等改变时序的东西),这条前提需要重新实证 —— 本报告的结论只对当前
  `vue-router@3.6.5` + 当前 `route.js:214-221` 的静态 `redirect` 写法成立。
