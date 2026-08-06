### Task 1: D3 实证 —— vue-router 3.6.5 的 redirect 与 beforeEach 时序

**Files:**
- Create: `VUE2/src/router/__tests__/aiRedirectTiming.spec.js`
- Test: 同上

**Interfaces:**
- Produces: 一个明确结论 —— `REDIRECT_BEFORE_GUARD = true | false`。T5 读这个结论决定要不要给 New-UI 补两条 redirect 路由。

**背景:** Vue2 的 `/ai/skills`、`/ai/mcp` 是 `redirect` 记录(`VUE2/src/router/route.js:214-221`),
目标是 `{ path: '/ai/settings', query: { section: 'skills' | 'mcp' } }`。
T6 会加一条 `/ai` 前缀绞杀条目。若守卫**先于** redirect 解析看到 `/ai/skills`,落点会是
`/app/#/ai/skills` —— New-UI **没有这条路由,也没有 catch-all,会白屏**。

🔴 **不许靠读 vue-router 源码或文档下结论**(P5f 沉淀 R21:凭一条检索确立结论必须换独立口径复证)。
这一刀就是那条独立口径:**真跑一个 router 实例**。

- [ ] **Step 1: 写实证用例**

```javascript
// VUE2/src/router/__tests__/aiRedirectTiming.spec.js
import Vue from 'vue'
import VueRouter from 'vue-router'

// D3(SP8-P6):钉死一个前提 —— Vue2 的 /ai/skills、/ai/mcp 是 redirect 记录,而 P6 给
// strangler.js 加了 /ai 前缀条目。绞杀守卫看到的究竟是 redirect 之前的 /ai/skills,
// 还是解析之后的 /ai/settings?section=skills,直接决定 cutover 的落点对不对。
// 这条用例不 mock matcher,真跑一个 router 实例观察 beforeEach 收到的 to.fullPath。
Vue.use(VueRouter)

describe('vue-router 3.x:redirect 与 beforeEach 的时序', () => {
  it('beforeEach 收到的 to.fullPath 是 redirect 解析之后的目标', async () => {
    const seen = []
    const router = new VueRouter({
      mode: 'abstract',
      routes: [
        { path: '/ai/settings', name: 'AISettings', component: { render: (h) => h('div') } },
        { path: '/ai/skills', redirect: { path: '/ai/settings', query: { section: 'skills' } } },
      ],
    })
    router.beforeEach((to, from, next) => { seen.push(to.fullPath); next() })

    await new Promise((resolve) => router.push('/ai/skills', resolve, resolve))

    // 关键断言:守卫一次都没见到裸的 /ai/skills。
    expect(seen).not.toContain('/ai/skills')
    expect(seen).toContain('/ai/settings?section=skills')
  })
})
```

- [ ] **Step 2: 跑它,如实记录结果**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/router/__tests__/aiRedirectTiming.spec.js --reporter=verbose 2>&1 | tail -25
```

🔴 **这一步没有「预期」** —— 这是实证,两种结果都合法。**把完整输出贴进报告**,包括 `seen` 数组的实际内容
(断言失败时 vitest 会打印出来;若两条断言都过,在报告里注明「守卫只见到 redirect 之后的路径」)。

- [ ] **Step 3: 按结果二选一收尾**

**若用例通过**(守卫只见到解析后的路径):用例保留在版本库里当前提守卫,**T5 不需要补 redirect 路由**。
在用例文件头补一行注释:`// 实证于 2026-08-06:结论 = redirect 先于 beforeEach 解析,New-UI 无需补 /ai/skills、/ai/mcp 路由。`

**若用例失败**(守卫见到了 `/ai/skills`):把断言反转成钉住真实行为(`expect(seen).toContain('/ai/skills')`),
并在文件头写明:`// 实证于 2026-08-06:结论 = 守卫先于 redirect 看到原始路径 ⇒ New-UI 必须补两条 redirect 路由,见 T5 Step 6。`

- [ ] **Step 4: 复跑确认绿**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/router/__tests__/aiRedirectTiming.spec.js --reporter=verbose 2>&1 | tail -10
```

Expected: 1 passed

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/router/__tests__/aiRedirectTiming.spec.js
git commit -m "test(p6-t1): D3 实证 —— vue-router redirect 与 beforeEach 的时序"
```

---

