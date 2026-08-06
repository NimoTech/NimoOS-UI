### Task 8: `SlashMenu.vue`(`/init` 斜杠面板)

**Files:**
- Create: `src/ai/components/shell/SlashMenu.vue`
- Create: `src/ai/components/shell/SlashMenu.test.ts`
- Modify: `src/i18n/{zh_cn,en_us}.ts`

**Interfaces:**
- Produces: props `{ folders?: Array<{ id?: string|number; path: string }> }`;emits `init(target: string)` / `close()`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import SlashMenu from './SlashMenu.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('SlashMenu', () => {
  it('点 /init 后展开目录选择;只有一个目录时自动选中', async () => {
    const w = mount(SlashMenu, { props: { folders: [{ id: 1, path: '/DATA/docs' }] }, global: g })
    await w.find('.slash-row').trigger('click')
    expect(w.find('.slash-init').exists()).toBe(true)
    const confirm = w.findAll('.slash-init-actions button')[1]
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    expect(w.emitted('init')).toEqual([['/DATA/docs']])
  })

  it('无可见目录时给出提示且确认键禁用', async () => {
    const w = mount(SlashMenu, { props: { folders: [] }, global: g })
    await w.find('.slash-row').trigger('click')
    expect(w.find('.slash-status').exists()).toBe(true)
    expect(w.findAll('.slash-init-actions button')[1].attributes('disabled')).toBeDefined()
  })

  it('多个目录时需先选一个才可确认', async () => {
    const w = mount(SlashMenu, { props: { folders: [{ path: '/a' }, { path: '/b' }] }, global: g })
    await w.find('.slash-row').trigger('click')
    const confirm = w.findAll('.slash-init-actions button')[1]
    expect(confirm.attributes('disabled')).toBeDefined()
    await w.findAll('input[type="radio"]')[1].setValue()
    expect(w.findAll('.slash-init-actions button')[1].attributes('disabled')).toBeUndefined()
    await w.findAll('.slash-init-actions button')[1].trigger('click')
    expect(w.emitted('init')).toEqual([['/b']])
  })

  it('点遮罩自身 emit close', async () => {
    const w = mount(SlashMenu, { props: { folders: [] }, global: g })
    await w.find('.slash-menu').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/components/shell/SlashMenu.test.ts`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现**

逐字港 Vue2 `shell/SlashMenu.vue` 全 70 行。要点:`@click.self="$emit('close')"` 保留;`/init` 字面量不翻译;`pointer-events:auto` 保留(祖先 none)。**Vue2 没有 Escape 关闭 —— 保持 1:1 不加**(记账到台账,1c-2 或后续期若做键盘一致性再统一加)。
三处裸色换 token:`rgba(0,0,0,0.3)` 遮罩 → `var(--modal-scrim)`;`0 16px 48px rgba(0,0,0,0.18)` → `var(--shadow-pop)`;`.primary{color:white}` → `var(--text-on-accent)`。硬编码半径 `14px/8px/6px` → `var(--r-md)`/`var(--r-xs)`/`var(--r-xs)`(视觉近似,写注释说明;**如实现者认为会造成可见差异,则保留原像素值并在报告里说明** —— 视觉 1:1 优先)。
i18n:`aiSlashInitDesc`('为某个目录生成 agent.md'/'Generate agent.md for a directory')、`aiSlashNoFolders`('还没有可见目录 —— 先用 @ 选一个'/'No visible directories — use @ to select one first')、`aiSlashInitialize`('初始化'/'Initialize');取消键复用既有 `aiCancel`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/components/shell/SlashMenu.test.ts src/i18n/parity.test.ts`
Expected: 全绿。`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/ai/components/shell/SlashMenu.vue` → 无输出。

- [ ] **Step 5: Commit**

```bash
git add src/ai/components/shell/SlashMenu.vue src/ai/components/shell/SlashMenu.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P1c1: SlashMenu (/init) 1:1 port"
```

---

