### Task 10: DropPage.vue + DropCenter.vue + DropAddButton.vue — 页面组装

**Files:**
- Create: `src/files/drop/components/DropPage.vue`、`src/files/drop/components/DropCenter.vue`、`src/files/drop/components/DropAddButton.vue`
- Test: `src/files/drop/components/DropPage.test.ts`

**Interfaces:**
- Consumes: Task 6-9 全部;`FilesShell`/`FilesSidebar`(对齐 SharesPage 用法);Task 8 `contentsBox`/`positionFor`/`DISPLAY_ORDER`。
- Produces: 路由组件 `DropPage`(Task 11 注册)。

- [ ] **Step 1: 写失败测试**

```ts
// src/files/drop/components/DropPage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import DropPage from './DropPage.vue'
import { useDropStore } from '../stores/drop'
import { i18n } from '../../../i18n'

vi.mock('../serverConnection', () => ({ ServerConnection: class { connect = vi.fn(); destroy = vi.fn(); send = vi.fn() } }))
vi.mock('../peersManager', () => ({ PeersManager: class { handleServerMessage = vi.fn(); sendFiles = vi.fn(() => true); destroy = vi.fn() } }))
vi.mock('@nimotech/nimoos-service', () => ({ refreshAccessToken: vi.fn(async () => {}), service: {} }))

const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div/>' } }] })

describe('DropPage', () => {
  let pinia: ReturnType<typeof createPinia>
  beforeEach(() => { pinia = createPinia(); setActivePinia(pinia) })
  const mountPage = () => mount(DropPage, { global: { plugins: [pinia, i18n, router], stubs: { FilesShell: { template: '<div><slot/></div>' }, FilesSidebar: true } } })

  it('mount 调 store.init,unmount 调 destroy', async () => {
    const s = useDropStore()
    const initSpy = vi.spyOn(s, 'init')
    const destroySpy = vi.spyOn(s, 'destroy')
    const w = mountPage()
    await flushPromises()
    expect(initSpy).toHaveBeenCalledOnce()
    w.unmount()
    expect(destroySpy).toHaveBeenCalledOnce()
  })
  it('渲染 peers(self 标记)与接收卡挂载点', async () => {
    const s = useDropStore()
    s.peers.push(
      { id: 'me', name: { model: 'desktop', deviceName: 'd', displayName: 'Me' }, rtcSupported: true },
      { id: 'b', name: { model: 'tablet', deviceName: 'd', displayName: 'Pad' }, rtcSupported: true },
    )
    s.selfId = 'me'
    const w = mountPage()
    await flushPromises()
    expect(w.findAllComponents({ name: 'DropItem' }).length).toBe(2)
    expect(w.text()).toContain('Pad')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/files/drop/components/DropPage.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现三组件**

```vue
<!-- src/files/drop/components/DropCenter.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { dropAsset } from '../dropIcons'
const { t } = useI18n()
</script>

<template>
  <div class="drop-center">
    <img class="drop-center-ic" :src="dropAsset('drop_icon')" alt="" />
    <p class="drop-center-hint">{{ t('filesDropHint') }}</p>
  </div>
</template>

<style scoped>
.drop-center {
  position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  pointer-events: none; opacity: 0.85;
}
.drop-center-ic { width: 48px; height: 48px; }
.drop-center-hint { margin: 0; font-size: 13px; color: var(--fg-muted); }
</style>
```

```vue
<!-- src/files/drop/components/DropAddButton.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dropAsset } from '../dropIcons'

const { t } = useI18n()
const open = ref(false)
const address = `${window.location.origin}/app/#/files/drop` // spec §6:直达完整地址
</script>

<template>
  <div class="drop-add">
    <button class="drop-add-btn" :title="t('filesDropLanTitle')" @click="open = !open">
      <img :src="dropAsset('add_btn')" alt="+" />
    </button>
    <div v-if="open" class="drop-add-pop">
      <h4 class="drop-add-title">{{ t('filesDropLanTitle') }}</h4>
      <p class="drop-add-hint">{{ t('filesDropLanHint') }}</p>
      <code class="drop-add-addr">{{ address }}</code>
    </div>
  </div>
</template>

<style scoped>
.drop-add { position: absolute; right: 24px; top: 24px; z-index: 20; }
.drop-add-btn {
  width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--card-border);
  background: var(--card-bg); cursor: pointer; display: grid; place-items: center;
}
.drop-add-btn img { width: 20px; height: 20px; }
.drop-add-pop {
  position: absolute; right: 0; top: 52px; min-width: 260px; padding: 12px 14px;
  border-radius: var(--radius, 12px); background: var(--popup-bg);
  border: 1px solid var(--card-border); color: var(--fg); animation: itemIn 0.2s ease both;
}
.drop-add-title { margin: 0 0 4px; font-size: 14px; }
.drop-add-hint { margin: 0 0 8px; font-size: 12px; color: var(--fg-muted); }
.drop-add-addr { font-size: 12px; word-break: break-all; user-select: all; }
</style>
```

```vue
<!-- src/files/drop/components/DropPage.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FilesShell from '../../components/FilesShell.vue'
import FilesSidebar from '../../components/FilesSidebar.vue'
import DropItem from './DropItem.vue'
import DropCenter from './DropCenter.vue'
import DropAddButton from './DropAddButton.vue'
import ReceivePrompt from './ReceivePrompt.vue'
import { useDropStore } from '../stores/drop'
import { contentsBox, positionFor, DISPLAY_ORDER } from '../dropLayout'

const { t } = useI18n()
const drop = useDropStore()

const areaEl = ref<HTMLElement | null>(null)
const box = ref(contentsBox(1200, 700))
const isNarrow = ref(false)

function resize() {
  const el = areaEl.value
  if (!el) return
  isNarrow.value = el.clientWidth < 720 // 窄屏流式(替代 vue-breakpoint-mixin)
  box.value = contentsBox(el.clientWidth, el.clientHeight)
}

// self 已由 store 置顶(index 0);展示顺序表决定圆环占位(Vue2 initIndexArray)
const placed = computed(() =>
  drop.peers.map((p, i) => ({
    peer: p,
    isSelf: p.id === drop.selfId,
    position: positionFor(DISPLAY_ORDER[i] ?? i, box.value.radius, box.value.center),
  })),
)

onMounted(() => {
  window.addEventListener('resize', resize)
  resize()
  drop.init()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  drop.destroy()
})
</script>

<template>
  <FilesShell>
    <div class="files-layout">
      <FilesSidebar />
      <main ref="areaEl" class="drop-main" :class="{ narrow: isNarrow }">
        <h2 class="drop-title">{{ t('filesDropTitle') }}</h2>
        <div class="drop-pulse" aria-hidden="true"><i /><i /><i /></div>
        <div class="drop-area" :style="!isNarrow ? { width: box.width + 'px', height: box.height + 'px' } : undefined">
          <DropItem
            v-for="p in placed"
            :key="p.peer.id"
            :device="p.peer"
            :is-self="p.isSelf"
            :is-float="!isNarrow"
            :position="p.position"
            :transfer="drop.transfers[p.peer.id]"
            @select-files="(files) => drop.sendFiles(p.peer.id, files)"
          />
        </div>
        <DropCenter v-if="!isNarrow" />
        <DropAddButton />
        <ReceivePrompt />
      </main>
    </div>
  </FilesShell>
</template>

<style scoped>
.drop-main { position: relative; flex: 1; overflow: hidden; display: flex; flex-direction: column; align-items: center; }
.drop-title { align-self: flex-start; margin: 16px 20px; font-size: 18px; color: var(--fg); }
.drop-area { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); }
.drop-main.narrow .drop-area {
  position: relative; left: auto; bottom: auto; transform: none;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; padding: 24px; width: 100%;
}
/* 脉冲波纹背景:CSS 替代 Vue2 GSAP DropBg */
.drop-pulse { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); pointer-events: none; }
.drop-pulse i {
  position: absolute; left: 50%; bottom: -40px; transform: translateX(-50%);
  border: 1px solid var(--card-border); border-radius: 50%;
  animation: dropPulse 6s linear infinite; opacity: 0;
}
.drop-pulse i:nth-child(1) { width: 300px; height: 300px; }
.drop-pulse i:nth-child(2) { width: 300px; height: 300px; animation-delay: 2s; }
.drop-pulse i:nth-child(3) { width: 300px; height: 300px; animation-delay: 4s; }
@keyframes dropPulse {
  0% { transform: translateX(-50%) scale(0.4); opacity: 0; }
  20% { opacity: 0.6; }
  100% { transform: translateX(-50%) scale(3.2); opacity: 0; }
}
</style>
```

注意:`@keyframes dropPulse` 在 scoped 内自用可行;若 DropItem 需复用则移 theme.css。`files-layout` class 复用 SharesPage 既有布局样式(全局或 FilesShell 内,以仓内为准)。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/files/drop/components/DropPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/files/drop/components/DropPage.vue src/files/drop/components/DropCenter.vue src/files/drop/components/DropAddButton.vue src/files/drop/components/DropPage.test.ts
git commit -m "feat(drop): DropPage 雷达布局+窄屏流式+CSS 脉冲背景+局域网地址"
```

---

