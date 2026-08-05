### Task 6: `ContextUsageBar.vue`(上下文占用环)

**Files:**
- Create: `src/ai/components/blocks/ContextUsageBar.vue`
- Create: `src/ai/components/blocks/ContextUsageBar.test.ts`
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(+`aiCtxLabel`)

**Interfaces:**
- Consumes: Task 5 的 `contextUsage.ts`(`RING_R`/`RING_C`/`formatTokens`/`levelFor`/`dashArrayFor`)。
- Produces: 组件 props `{ tokens?: number; window?: number; pct?: number }`(默认全 0)。**prop 名保留 `window`**(与 Vue2 API 一致);`<script setup>` 内一律用 `props.window`,禁裸写 `window`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import ContextUsageBar from './ContextUsageBar.vue'
import { RING_C } from '../../util/contextUsage'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('ContextUsageBar(移植 Vue2 ContextUsageBar.spec.js:54-81)', () => {
  it('渲染 ok 档,提示里带格式化 token 与百分比', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 48000, window: 200000, pct: 24 }, global: g })
    const arc = w.find('.ctx-ring-arc')
    expect(arc.exists()).toBe(true)
    expect(arc.classes()).toContain('ok')
    expect(arc.attributes('stroke-dasharray')).toBe(`${((24 / 100) * RING_C).toFixed(2)} ${RING_C.toFixed(2)}`)
    const tip = w.find('.ctx-usage-tip').text()
    expect(tip).toContain('48K')
    expect(tip).toContain('200K')
    expect(tip).toContain('24%')
  })
  it('pct 75 → warn 档', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 75 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('warn')
  })
  it('pct 95 → danger 档', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 95 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('danger')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/components/blocks/ContextUsageBar.test.ts`
Expected: FAIL(组件文件不存在)。

- [ ] **Step 3: 实现**

逐字港 Vue2 `blocks/ContextUsageBar.vue`(模板 33-61、样式 63-107),几何/阈值全部改调 Task 5 模块。i18n:`'Context'` → 新键 `aiCtxLabel`(zh_cn `'上下文'`,en_us `'Context'`)。样式 `<style lang="scss" scoped>` 逐字搬,颜色 token 已全齐(`--line-strong`/`--accent`/`--warning`/`--danger`/`--text-secondary`/`--bg-elevated`/`--line`/`--shadow-pop`),**零新增裸色**。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/components/blocks/ContextUsageBar.test.ts src/i18n/parity.test.ts`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add src/ai/components/blocks/ContextUsageBar.vue src/ai/components/blocks/ContextUsageBar.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P1c1: ContextUsageBar (ring + hover tip) on pure geometry module"
```

---

