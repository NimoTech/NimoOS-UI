### Task 5: `Breadcrumb.vue`(虚拟路径分段 + 尾部 ☆)

**Files:**
- Create: `src/files/components/Breadcrumb.vue`
- Create: `src/files/components/Breadcrumb.test.ts`

**Interfaces:**
- Consumes:`FavoriteStar`(Task4)。
- Produces:`Breadcrumb.vue` props `{ virtualPath: string; currentRealPath: string }`,emit `navigate(virtualPath)`。纯展示,不读 store。

- [ ] **Step 1: 写失败测试**

`src/files/components/Breadcrumb.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Breadcrumb from './Breadcrumb.vue'

const opts = { global: { stubs: { FavoriteStar: true } } }

describe('Breadcrumb', () => {
  it('renders clickable segments from the virtual path', () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    expect(w.findAll('.crumb').map((c) => c.text())).toEqual(['NimoOS-HD', 'Documents', 'Reports'])
  })

  it('emits navigate with the accumulated VIRTUAL path (never a real /DATA path)', async () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    await w.findAll('.crumb')[1].trigger('click') // "Documents"
    const ev = w.emitted('navigate')
    expect(ev).toBeTruthy()
    expect(ev![0][0]).toBe('/NimoOS-HD/Documents')
    expect(ev![0][0]).not.toContain('/DATA')
  })

  it('renders a favorite star for the current folder', () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents', currentRealPath: '/DATA/Documents' }, ...opts })
    expect(w.find('.crumb-star').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/Breadcrumb.test.ts`
Expected: FAIL(`Cannot find module './Breadcrumb.vue'`)

- [ ] **Step 3: 写实现**

`src/files/components/Breadcrumb.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import FavoriteStar from './FavoriteStar.vue'

const props = defineProps<{ virtualPath: string; currentRealPath: string }>()
const emit = defineEmits<{ (e: 'navigate', virtualPath: string): void }>()

interface Seg { label: string; vpath: string }
const segments = computed<Seg[]>(() => {
  const parts = props.virtualPath.replace(/^\/+/, '').split('/').filter(Boolean)
  const segs: Seg[] = []
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    segs.push({ label: p, vpath: acc })
  }
  return segs
})
const lastName = computed(() => (segments.value.length ? segments.value[segments.value.length - 1].label : ''))
</script>

<template>
  <nav class="breadcrumb">
    <template v-for="(seg, i) in segments" :key="seg.vpath">
      <span v-if="i > 0" class="crumb-sep">›</span>
      <button class="crumb" :class="{ current: i === segments.length - 1 }" @click="emit('navigate', seg.vpath)">{{ seg.label }}</button>
    </template>
    <FavoriteStar v-if="currentRealPath && lastName" class="crumb-star" :path="props.currentRealPath" :name="lastName" />
  </nav>
</template>

<style scoped>
.breadcrumb { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; min-width: 0; }
.crumb { background: none; border: none; cursor: pointer; color: var(--fg-muted, #9aa4bf); font-size: 14px; padding: 2px 4px; border-radius: 6px; }
.crumb:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); }
.crumb.current { color: var(--fg); font-weight: 600; }
.crumb-sep { color: var(--fg-muted, #9aa4bf); font-size: 12px; }
.crumb-star { margin-left: 4px; }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/Breadcrumb.test.ts`
Expected: PASS(3 用例)

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/components/Breadcrumb.vue src/files/components/Breadcrumb.test.ts
git commit -m "feat(files): Breadcrumb (virtual-path segments + current-folder favorite star)"
```

---

