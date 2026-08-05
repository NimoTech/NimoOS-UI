## Task 5: 设置页容器 + 路由 + 侧栏入口

**Files:**
- Create: `src/views/PhotosSettings.vue`
- Test: `src/views/__tests__/PhotosSettings.test.ts`
- Modify: `src/router/index.ts`、`src/photos/components/PhotosSidebar.vue`

**Interfaces:**
- Consumes: T3 `<PhotosStorageCard>`、T4 `<PhotosAiCard>`、T1 store、T2 键。
- Produces: 路由 `{ path: '/photos/settings', name: 'photos-settings', component: PhotosSettings }`;侧栏底部设置入口。

**回源坐标**:Vue2 `PhotosSettings.vue:1-36`(壳 + hero + 快速导航)、`:194-214`(页脚 + toast)、`:383-386`(`scrollTo`)、`:487-491`(`showToast`,2800ms)、`:497-526`(mounted 取数)、`:527-530`(卸载清理);侧栏入口 `PhotosSidebar.vue:34-35`。

**架构偏离(登记)**

Vue2 设置页是 `position:fixed;inset:0;z-index:500` 的**全屏 overlay**,自带一份 `<photos-sidebar>` 与自己的 topbar,靠 `open` prop 开合、ESC 关闭、关闭时 `$emit('close')`。New-UI 走 spec §3 既定的**真路由 + AreaShell**:
- 侧栏/回主页由 AreaShell 统一提供,**不在设置页内再挂一份侧栏**;
- 没有 `open` prop、没有 ESC 关闭(路由页靠浏览器返回键,与全区一致);
- Vue2 的 `themeMixin` / `photosThemeClass` **不迁**(相册私有主题开关不迁,台账第二笔);
- 底部 `Sign out` **不迁**(D22)。

四条偏离都要写进组件头注释。

**逐条 1:1 契约**

1. **hero**:标题 + 说明 + 两个快速导航锚点(`storage` / `ai`),点击 `scrollIntoView({ behavior: 'smooth', block: 'start' })`。
2. **toast**:2800ms 自动消失,重复触发时清掉上一个定时器(`:487-491`)。承接两张卡 emit 上来的 `toast` 事件。
3. **mounted 取数**(`:500-526`):`fetchStorage` / `fetchAbout` / `fetchAiFeatures` / `fetchRetention` / `fetchScanInterval`。**Vue2 那些 `_suppressXWatch` 抑制标志随 T1 的显式 action 模型一并消失**(T1 已登记)。
4. **`?section=` 深链**:Vue2 是 `initialSection` prop + `open` watcher(`:292-296`),由 `PhotosTimeline._applyUrlDeepLinks` 的 `q.settings` 喂进来(`:485-488`)。New-UI 走真路由后改成读自己的 `route.query.section`,`'ai'` / `'storage'` 两值,挂载后滚到对应卡。**这条同时也是 T6「Settings · AI behavior 链接接线」的落点**(那条链接要跳 `/photos/settings?section=ai`)。
5. **页脚**:`Nimo 相册 · v{version}`(version 缺失时不显示 `· v`)+ `运行于 {deviceName}`(+ `· 图库始于 {date}`,`librarySince` 缺失时整段不显示)。`librarySince` 的日期同样**跟随 i18n locale**(Vue2 `:357` 无 locale 参数,同 T4 第 5 条)。

- [ ] **Step 1: 写失败测试**

```ts
describe('PhotosSettings 容器', () => {
  it('挂载时拉齐五项数据', async () => { /* 断言五个 fetch 都被调 */ })

  it('承接卡片的 toast 事件并在 2800ms 后消失', async () => {
    vi.useFakeTimers()
    // 触发子组件 emit('toast') → 断言 toast 可见
    // advanceTimersByTime(2799) → 仍可见;+2 → 消失
    vi.useRealTimers()
  })

  it('连续两次 toast:第二次重置计时,不被第一次的定时器提前掐掉', async () => { /* … */ })

  it('?section=ai 挂载后滚到 AI 卡', async () => { /* 断言 scrollIntoView 被调用在 #ai 上 */ })

  it('?section= 缺失或非法时不滚动', async () => { /* … */ })

  it('页脚:version 缺失时不渲染 · v 片段', async () => { /* … */ })

  it('页脚:librarySince 缺失时整段不渲染', async () => { /* … */ })

  it('不挂第二份侧栏(AreaShell 已提供)—— 架构偏离的守卫', async () => {
    expect(wrapper.findComponent(PhotosSidebar).exists()).toBe(false)
  })

  it('不渲染登出入口(D22)', async () => {
    expect(wrapper.text()).not.toMatch(/登出|Sign out/)
  })
})
```

- [ ] **Step 2–4: 运行确认失败 → 实现 → 确认通过**

- [ ] **Step 5: 路由与侧栏入口测试**

```ts
it('路由表只追加不重排:/photos/settings 在最后一条 /photos/* 之后', () => {
  // ⚠️ 用 node:fs 读 src/router/index.ts 的**源文本行序**断言,不要用 router.getRoutes()
  //   —— vue-router 4 的 getRoutes() 会把动态段路由排到静态之前(P6b 查实)。
  const src = readFileSync('src/router/index.ts', 'utf8')
  expect(src.length).toBeGreaterThan(0)
  const idxSettings = src.indexOf("'/photos/settings'")
  const idxSearch = src.indexOf("'/photos/search'")
  expect(idxSettings).toBeGreaterThan(idxSearch)
})

it('侧栏底部有设置入口,指向 /photos/settings', async () => { /* … */ })
```

- [ ] **Step 6: 变异验证 + Commit**

变异验证:①删掉 toast 的 `clearTimeout` → 「连续两次 toast」应变红 ②把 `?section` 的白名单去掉、任意值都滚 → 「非法值不滚动」应变红。

```bash
git add src/views/PhotosSettings.vue src/views/__tests__/PhotosSettings.test.ts \
        src/router/index.ts src/photos/components/PhotosSidebar.vue
git commit -m "feat(photos): 设置页容器 + /photos/settings 路由 + 侧栏入口(P8a-T5)"
```

---

