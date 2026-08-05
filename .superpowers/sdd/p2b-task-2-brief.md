## Task 2: session store 补 `user` / `isAdmin` 读口

**Files:**
- Modify: `src/stores/session.ts`
- Modify: `src/stores/session.test.ts`

**Interfaces:**
- Produces: `useSessionStore().user`（`SessionUser | null`）、`useSessionStore().isAdmin`（`boolean`），其中 `export interface SessionUser { username?: string; role?: string }`。Task 12 消费 `isAdmin`。store 名是 **`useSessionStore`**（不是 `useSession`）。

**背景：** Vue2 `ChannelsSection.vue:118` 用 `this.$store.state.user.role === 'admin'` 决定是否显示「机器人配置」段（管理员专属）。New-UI 的 `src/stores/session.ts` 只有 `setUser(user: unknown)` 往 `localStorage['user']` 写 JSON，没有读出口 —— 这是 D3。

- [ ] **Step 1: 写失败的测试**

在 `src/stores/session.test.ts` 追加：

```ts
describe('SP8-P2b Task 2 —— user / isAdmin 读口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('localStorage 里有 admin 用户时 user 能读回、isAdmin 为 true', () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const s = useSessionStore()
    expect(s.user?.username).toBe('nimo')
    expect(s.isAdmin).toBe(true)
  })

  it('非 admin 角色 isAdmin 为 false', () => {
    localStorage.setItem('user', JSON.stringify({ username: 'guest', role: 'user' }))
    const s = useSessionStore()
    expect(s.isAdmin).toBe(false)
  })

  it('localStorage 无 user 时 user 为 null、isAdmin 为 false（不抛）', () => {
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)
  })

  it('localStorage 里是坏 JSON 时也不抛，退化成 null', () => {
    localStorage.setItem('user', '{不是 JSON')
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)
  })

  it('user 不是对象（比如存了字符串）时也退化成 null', () => {
    localStorage.setItem('user', '"nimo"')
    const s = useSessionStore()
    expect(s.user).toBeNull()
  })
})
```

**两点注意**：① `user` 是 `computed`，setup store `return` 出去后在组件/测试里直接 `s.user` 取值（Pinia 自动解包），不要写 `s.user.value`。② 这五条**刻意用 `localStorage.setItem` 直接布值、不走 `setUser`** —— 因为 `computed` 读 `localStorage` 不构成响应式依赖，同一实例内 `setUser` 之后 `user` 不会重算（见 Step 3 注释）。既有测试文件的 `beforeEach` 已有 `setActivePinia` + `localStorage.clear()`，本 describe 里再写一遍是为了不依赖外层顺序。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/stores/session.test.ts`
Expected: FAIL —— `s.user` / `s.isAdmin` 是 `undefined`。

- [ ] **Step 3: 实现**

在 `src/stores/session.ts` 里加（`computed` 记得从 `vue` import）：

```ts
export interface SessionUser { username?: string; role?: string }

// SP8-P2b Task 2 —— Vue2 ChannelsSection.vue:118 读 $store.state.user.role 判管理员。
// 本仓 setUser 只往 localStorage 写、没有读出口,这里补上。每次取值重新解析
// localStorage(而不是缓存进 ref):登录/切换用户都走整页重载,不存在"写了不刷新"的
// 中间态,重新解析最简单且不会读到陈旧值。坏 JSON 一律退化成 null,绝不抛。
const user = computed<SessionUser | null>(() => {
  try {
    const raw = localStorage.getItem(USER)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as SessionUser) : null
  } catch {
    return null
  }
})

const isAdmin = computed(() => user.value?.role === 'admin')
```

并把 `user`、`isAdmin` 加进 `return { … }`。

⚠️ `computed` 读 `localStorage` 不是响应式依赖 —— 同一次页面生命周期里 `setUser` 之后 `user` **不会自动重算**（computed 会缓存）。测试里四条用例各自新建 store 实例所以看不出。**这是有意的**（登录流程整页重载），但必须在注释里写明，免得后续有人依赖「setUser 后立刻读到新值」。若某天真需要，做法是把 `setUser` 改成同时写一个 `ref` 版本。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/stores/session.test.ts`
Expected: PASS

- [ ] **Step 5: 全量测试门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/stores/session.ts src/stores/session.test.ts
git commit -m "SP8-P2b Task 2: session store 补 user/isAdmin 读口(Channels 管理员段需要)"
git show --stat HEAD && git status
```

---

