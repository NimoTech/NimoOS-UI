## Task 3: `KIcon.vue`

**Files:**
- Create: `src/ai/knowledge/components/KIcon.vue`
- Create: `src/ai/knowledge/components/KIcon.test.ts`

**Interfaces:**
- Produces: `<KIcon :name="string" :size="number" :color="string" :strokeWidth="number" />`,props 默认值逐字照蓝本(`git show main:src/components/common/KIcon.vue` 的 props 块)。

- [ ] **Step 1: 读蓝本并核对图标集**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/components/common/KIcon.vue
```
42 个 glyph,`viewBox="0 0 20 20"`、`fill="none"`、`:stroke="color"`、`stroke-linecap/linejoin="round"`、`v-html="pathHtml"`。**path 字符串逐字符照抄,一个坐标都不许改。**

- [ ] **Step 2: 写失败测试**

`KIcon.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KIcon from './KIcon.vue'

describe('KIcon', () => {
  it('渲染 svg 骨架并透传 size / color / strokeWidth', () => {
    const w = mount(KIcon, { props: { name: 'home', size: 15, color: 'var(--accent)', strokeWidth: 2 } })
    const svg = w.get('svg')
    expect(svg.attributes('width')).toBe('15')
    expect(svg.attributes('height')).toBe('15')
    expect(svg.attributes('viewBox')).toBe('0 0 20 20')
    expect(svg.attributes('stroke')).toBe('var(--accent)')
    expect(svg.attributes('stroke-width')).toBe('2')
    expect(svg.attributes('fill')).toBe('none')
  })

  it('name 命中时注入对应 path;未命中时渲染空内容(不抛)', () => {
    expect(mount(KIcon, { props: { name: 'check' } }).html()).toContain('M4 10l4 4 8-8')
    const miss = mount(KIcon, { props: { name: 'no-such-icon' } })
    expect(miss.get('svg').element.innerHTML).toBe('')
  })

  it('KnowledgeLayout 与 DashboardView 用到的 18 个 name 全部存在', () => {
    const used = ['home', 'search', 'layers', 'edit', 'file', 'history', 'drive', 'folder',
      'settings', 'clock', 'user', 'refresh', 'info', 'check', 'grid', 'plus',
      'arrowRight', 'chev', 'eye', 'spinner', 'pause', 'sparkle']
    for (const n of used) {
      const el = mount(KIcon, { props: { name: n } }).get('svg').element
      expect(el.innerHTML, `icon "${n}" missing`).not.toBe('')
    }
  })

  it('六个与 AgentIcon 同名异形的图标保持 KIcon 自己的形状(K4 防回归)', () => {
    // 设计 §2.5:code/download/grid/pause/settings/user 在两套图标里形状不同,
    // 复用 AgentIcon 会让知识库区图标肉眼可见地变样。这里钉住 KIcon 版本的特征片段。
    const d = (n: string) => mount(KIcon, { props: { name: n } }).get('svg').element.innerHTML
    expect(d('pause')).toContain('<rect')          // KIcon 是实心双矩形,AgentIcon 是两条线
    expect(d('code')).not.toContain('M11 4l-2 12') // AgentIcon 版多的那一笔斜线
    expect(d('grid')).toContain('rx="1"')          // AgentIcon 是 rx="1.2"
    expect(d('settings')).toContain('r="2.5"')     // AgentIcon 的齿轮是 lucide 版
    expect(d('user')).toContain('cy="7"')          // AgentIcon 是 cy="8" + scale
    expect(d('download')).toContain('M10 3v9')     // AgentIcon 是 M10 3v10
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test src/ai/knowledge/components/KIcon.test.ts
```
预期:FAIL,无法解析 `./KIcon.vue`。

- [ ] **Step 4: 实现**

`<script setup lang="ts">` + `const PATHS: Record<string, string> = { … }`(42 条逐字照抄)+ `const pathHtml = computed(() => PATHS[props.name] ?? '')`。
**零 `<style>` 块**。文件头注释:
```
1:1 移植自 Vue2 `src/components/common/KIcon.vue`(42 个 glyph)。
【为什么不复用 AgentIcon(偏离 K4)】实测两套图标 26 个同名里 6 个异形
(code/download/grid/pause/settings/user),而 settings/user/grid 正被 rail 与
移动端 tabs 用到;改 AgentIcon 会污染已收官的 Agent/技能/MCP 三区。
P3a/P4 的 D3「SkillIcon 不移植,统一 AgentIcon」当时核实过 SkillIcon ⊂ AgentIcon,
本期不成立。
```
`v-html` 的 lint:若 eslint 报 `vue/no-v-html`,照 `AgentIcon.vue` 的既有做法处理(先 grep 它怎么写的,不要自创)。

- [ ] **Step 5: 跑测试 + 三门**

预期 KIcon.test.ts 全绿;全量 **304 文件 / 2719 + 本文件用例数 + 1(color-guard)**。

- [ ] **Step 6: 提交**

```bash
git add src/ai/knowledge/components/KIcon.vue src/ai/knowledge/components/KIcon.test.ts
git commit -m "feat(knowledge): SP8-P5a KIcon 移植(42 glyph,不复用 AgentIcon)"
```

---

