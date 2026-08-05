### Task 4: `SelectionToolbar.vue` + i18n

**Files:**
- Create: `src/files/components/SelectionToolbar.vue`
- Create: `src/files/components/SelectionToolbar.test.ts`
- Modify: `src/i18n/zh_cn.ts`

**Interfaces:**
- Produces:`SelectionToolbar.vue` props `{ count: number; allSelected: boolean }`,emit `select-all` / `clear`。

- [ ] **Step 1: 加 i18n key**

在 `src/i18n/zh_cn.ts` 的 `zh_cn` 对象内(`filesNoFavorites` 之后)加:
```ts
    filesSelectedCount: '已选 {count} 项',
    filesSelectAll: '全选',
    filesClearSel: '清空',
```

- [ ] **Step 2: 写失败测试**

`src/files/components/SelectionToolbar.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SelectionToolbar from './SelectionToolbar.vue'

const i18n = createI18n({
  legacy: false, locale: 'zh_cn',
  messages: { zh_cn: { filesSelectedCount: '已选 {count} 项', filesSelectAll: '全选', filesClearSel: '清空' } },
})

describe('SelectionToolbar', () => {
  it('shows the count and emits select-all / clear', async () => {
    const w = mount(SelectionToolbar, { props: { count: 3, allSelected: false }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('已选 3 项')
    await w.get('.sel-all').trigger('click')
    expect(w.emitted('select-all')).toBeTruthy()
    await w.get('.sel-clear').trigger('click')
    expect(w.emitted('clear')).toBeTruthy()
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/SelectionToolbar.test.ts`
Expected: FAIL(`Cannot find module './SelectionToolbar.vue'`)

- [ ] **Step 4: 写实现**

`src/files/components/SelectionToolbar.vue`:
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ count: number; allSelected: boolean }>()
const emit = defineEmits<{ (e: 'select-all'): void; (e: 'clear'): void }>()
const { t } = useI18n()
</script>

<template>
  <div class="selection-toolbar">
    <span class="sel-count">{{ t('filesSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn sel-all" @click="emit('select-all')">{{ t('filesSelectAll') }}</button>
    <button class="sel-btn sel-clear" @click="emit('clear')">{{ t('filesClearSel') }}</button>
  </div>
</template>

<style scoped>
.selection-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px; border-radius: 12px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 13px; }
.sel-count { flex: 0 0 auto; }
.sel-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: transparent; color: var(--fg); cursor: pointer; font-size: 12px; }
.sel-btn:hover { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
</style>
```
(`allSelected` prop 现阶段仅备用于未来「全选↔取消全选」切换文案,P1d 保留但按钮固定为「全选」。)

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/SelectionToolbar.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/components/SelectionToolbar.vue src/files/components/SelectionToolbar.test.ts src/i18n/zh_cn.ts
git commit -m "feat(files): SelectionToolbar (count + select-all + clear) + i18n"
```

---

