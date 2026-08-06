## Task 10: `KnowledgeLayout.vue`

**Files:**
- Create: `src/ai/knowledge/views/KnowledgeLayout.vue`
- Create: `src/ai/knowledge/views/KnowledgeLayout.test.ts`

**Interfaces:**
- Consumes: T3 `KIcon` · T4 `knowledge.scss` · T5 `deferred.ts` · T6+T7 `useKnowledgeStore` · T8 i18n 键 · `useUserProfile()`(先 grep `src/composables` 确认真实导出名与字段)
- Produces: 路由布局组件(`<router-view/>` 出口)

- [ ] **Step 1: 读蓝本**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/KnowledgeLayout.vue
```
逐行对标:根 `.knowledge-app` → `aside.k-rail`(head/section/nav 9 项/状态块/foot)→ `.k-main`(topbar/banner/`<router-view/>`)→ `.k-mobile-tabs`(前 4 项 + More)。
**`.k-toast` 那一段(`:95-99`)不移植**(K3);`store.state.toast` 字段不存在(P4)。

- [ ] **Step 2: 写失败测试**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import KnowledgeLayout from './KnowledgeLayout.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'

// 真实 i18n(不许手写子集 —— P1c2 记账 minor:手写子集会让键名拼错抓不到)
const Stub = { template: '<div class="stub-child"/>' }
function makeRouter(path = '/ai/knowledge') {
  const router = createRouter({ history: createWebHashHistory('/app/'), routes: [
    { path: '/ai/knowledge', component: KnowledgeLayout, children: [
      { path: '', name: 'KnowledgeDashboard', component: Stub },
      { path: 'queue', name: 'KnowledgeQueue', component: Stub },
      { path: 'notes', name: 'KnowledgeNotes', component: Stub },
      { path: 'settings', name: 'KnowledgeSettings', component: Stub },
    ] },
  ] })
  router.push(path)
  return router
}
async function mountLayout(path?: string) {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(KnowledgeLayout, { global: { plugins: [router, i18n] } } as never)
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('KnowledgeLayout — rail', () => {
  it('渲染 9 个导航项,顺序与 Vue2 一致', async () => {
    const { w } = await mountLayout()
    const items = w.findAll('.k-rail-item')
    expect(items).toHaveLength(9)
    expect(items.map((i) => i.find('.k-rail-item-en').text())).toEqual(
      ['Dashboard', 'Search', 'Wiki', 'Notes', 'Indexed Files', 'Queue', 'Index Roots', 'Allowlist', 'Settings'])
  })

  it('每项 href 是 hash 深链,dashboard 不带子路径', async () => {
    const { w } = await mountLayout()
    const hrefs = w.findAll('.k-rail-item').map((i) => i.attributes('href'))
    expect(hrefs[0]).toBe('#/ai/knowledge')
    expect(hrefs[1]).toBe('#/ai/knowledge/search')
    expect(hrefs[8]).toBe('#/ai/knowledge/settings')
  })

  it('当前 tab 的 data-active 为 "true",其余为 "false"', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    const items = w.findAll('.k-rail-item')
    expect(items[5].attributes('data-active')).toBe('true')
    expect(items[0].attributes('data-active')).toBe('false')
  })

  it('点导航项走 router.push,已在当前页则不 push', async () => {
    const { w, router } = await mountLayout('/ai/knowledge/queue')
    const push = vi.spyOn(router, 'push')
    await w.findAll('.k-rail-item')[5].trigger('click')
    expect(push).not.toHaveBeenCalled()
    await w.findAll('.k-rail-item')[3].trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/knowledge/notes')
  })
})

describe('KnowledgeLayout — 徽标', () => {
  it('failed > 0 时 queue 出数字徽标,=0 时不出', async () => {
    const { w } = await mountLayout()
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 3, done: 0 } }
    await flushPromises()
    const queueItem = w.findAll('.k-rail-item')[5]
    expect(queueItem.find('.k-badge').text()).toBe('3')
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 0, done: 0 } }
    await flushPromises()
    expect(w.findAll('.k-rail-item')[5].find('.k-badge').exists()).toBe(false)
  })

  it('草稿 > 0 时 notes 徽标带 data-tone="warn"', async () => {
    const { w } = await mountLayout()
    useKnowledgeStore().setNotesDraftCount(2)
    await flushPromises()
    const badge = w.findAll('.k-rail-item')[3].find('.k-badge')
    expect(badge.text()).toBe('2')
    expect(badge.attributes('data-tone')).toBe('warn')
  })
})

describe('KnowledgeLayout — 索引器状态块', () => {
  it('三态:unreachable → error/离线;paused → paused/已暂停;否则 running/已收录数', async () => {
    const { w } = await mountLayout()
    const s = useKnowledgeStore()
    s.unreachable = true
    await flushPromises()
    expect(w.find('.k-rail-svc-dot').attributes('data-state')).toBe('error')
    expect(w.find('.k-rail-svc-meta').text()).toBe('离线')

    s.unreachable = false
    s.controlState = { ...s.controlState, paused: true }
    await flushPromises()
    expect(w.find('.k-rail-svc-dot').attributes('data-state')).toBe('paused')
    expect(w.find('.k-rail-svc-meta').text()).toBe('已暂停')

    s.controlState = { ...s.controlState, paused: false }
    s.stats = { ...s.stats, indexed_files: 1234 }
    await flushPromises()
    expect(w.find('.k-rail-svc-dot').attributes('data-state')).toBe('running')
    expect(w.find('.k-rail-svc-meta').text()).toContain('1,234')   // toLocaleString
  })
})

describe('KnowledgeLayout — topbar / banner', () => {
  it('标题与副标题按当前 tab 取 TITLES,dashboard 的副标题不带子路径', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-topbar-title').text()).toBe('概览')
    expect(w.find('.k-topbar-sub').text()).toBe('Dashboard · /ai/knowledge')
  })

  it('N8:rail 第 9 项是「系统设置」而 topbar 标题是「高级设置」', async () => {
    const { w } = await mountLayout('/ai/knowledge/settings')
    expect(w.findAll('.k-rail-item')[8].find('.k-rail-item-cn').text()).toBe('系统设置')
    expect(w.find('.k-topbar-title').text()).toBe('高级设置')
  })

  it('unreachable 时出警示条,否则不出', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-banner').exists()).toBe(false)
    useKnowledgeStore().unreachable = true
    await flushPromises()
    expect(w.find('.k-banner').attributes('data-tone')).toBe('warn')
  })

  it('刷新按钮重载 overview 并 toast', async () => {
    const { w } = await mountLayout()
    const s = useKnowledgeStore()
    const load = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    const toast = vi.spyOn(s, 'toast')
    await w.find('.k-topbar .k-btn.ghost').trigger('click')
    await flushPromises()
    expect(load).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('已刷新')
  })
})

describe('KnowledgeLayout — 移动端 tabs', () => {
  it('只渲染前 4 项 + More,More 在后 5 个 tab 任一激活时高亮', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    const tabs = w.findAll('.k-mobile-tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[4].attributes('data-active')).toBe('true')
    expect(tabs[0].attributes('data-active')).toBe('false')
  })

  it('More 跳到 allowlist(照抄 Vue2)', async () => {
    const { w, router } = await mountLayout()
    const push = vi.spyOn(router, 'push')
    await w.findAll('.k-mobile-tab')[4].trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/knowledge/allowlist')
  })
})

describe('KnowledgeLayout — 生命周期', () => {
  it('挂载时拉一次 overview 与草稿数', async () => {
    setActivePinia(createPinia())
    const s = useKnowledgeStore()
    const load = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    const draft = vi.spyOn(s, 'refreshNotesDraftCount').mockResolvedValue()
    await mountLayout()
    expect(load).toHaveBeenCalledTimes(1)
    expect(draft).toHaveBeenCalledTimes(1)
  })

  it('10 秒轮询;document.hidden 时跳过;卸载时清定时器', async () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    const s = useKnowledgeStore()
    const load = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    vi.spyOn(s, 'refreshNotesDraftCount').mockResolvedValue()
    const router = makeRouter(); await router.isReady()
    const w = mount(KnowledgeLayout, { global: { plugins: [router, i18n] } } as never)
    expect(load).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10000)
    expect(load).toHaveBeenCalledTimes(2)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    vi.advanceTimersByTime(10000)
    expect(load).toHaveBeenCalledTimes(2)          // 跳过
    hidden.mockReturnValue(false)
    vi.advanceTimersByTime(10000)
    expect(load).toHaveBeenCalledTimes(3)
    w.unmount()
    vi.advanceTimersByTime(30000)
    expect(load).toHaveBeenCalledTimes(3)          // 已清
    vi.useRealTimers()
  })
})
```

- [ ] **Step 3: 跑测试确认失败**
- [ ] **Step 4: 实现**

- `<script setup lang="ts">`;`NAV`/`TITLES` 两个常量逐字照抄(9 项 + 9 条)
- `currentTab` 的 `if (p.includes('/knowledge/notes'))` 在最前、其余用 `endsWith` —— **照抄这个不对称**(蓝本如此)
- `userName`:`useUserProfile()`,空值回落 `t('aiKbYou')`(K8)
- **零 `<style>` 块**;`knowledge.scss` 在本组件 `import '../../styles/knowledge.scss'`(照 `SettingsPage.vue:68-72` 的做法)
- 用到的每个 CSS 类先 `grep src/ai/styles/knowledge.scss` 确认存在;凭空造的类渲染成无样式而单测抓不到

- [ ] **Step 5: 跑测试 + 三门**(新增 1 个 `.vue` → **306 文件**)
- [ ] **Step 6: 提交**

```bash
git add src/ai/knowledge/views/KnowledgeLayout.vue src/ai/knowledge/views/KnowledgeLayout.test.ts
git commit -m "feat(knowledge): SP8-P5a KnowledgeLayout 外壳(rail 9 项 + 10s 轮询)"
```

---

