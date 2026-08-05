### Task 9: DropItem.vue + ReceivePrompt.vue — 设备气泡与接收确认卡

**Files:**
- Create: `src/files/drop/components/DropItem.vue`、`src/files/drop/components/ReceivePrompt.vue`
- Test: `src/files/drop/components/DropItem.test.ts`、`src/files/drop/components/ReceivePrompt.test.ts`

**Interfaces:**
- Consumes: Task 6 `dropIconUrl`、Task 7 store(`transfers`/`sendFiles`/`saveCurrent`/`ignoreCurrent`/`deviceName`)、Task 8 `positionFor`、`files/util/format.ts` `renderSize(bytes)`、reka-ui `ContextMenu`(`components/ui/ContextMenu.vue` 包装 + `ContextMenuItem`,类 `ui-ctx-*` 非 scoped)。
- Produces:
  - `DropItem` props `{ device: PeerInfo; isSelf: boolean; isFloat: boolean; position?: {left,top}; transfer?: TransferState }`,emits `select-files(files: File[])`;
  - `ReceivePrompt` 无 props(直接读 store 队头),自渲染或隐藏。

- [ ] **Step 1: 写失败测试**

```ts
// src/files/drop/components/DropItem.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import DropItem from './DropItem.vue'
import { i18n } from '../../../i18n'

const device = (over = {}) => ({ id: 'a', name: { model: 'desktop', deviceName: 'd', displayName: 'MyPC' }, rtcSupported: true, ...over })
const mountItem = (props = {}) =>
  mount(DropItem, {
    props: { device: device(), isSelf: false, isFloat: true, ...props },
    global: { plugins: [createPinia(), i18n] },
  })

describe('DropItem', () => {
  it('显示设备名与在线图标', () => {
    const w = mountItem()
    expect(w.text()).toContain('MyPC')
    expect(w.find('img.drop-ic').attributes('src')).toContain('desktop_online')
  })
  it('离线灰显且不可点', () => {
    const w = mountItem({ device: device({ offline: true }) })
    expect(w.find('.drop-bubble').classes()).toContain('offline')
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
  })
  it('self 显示 self 图标且无 file input 交互', () => {
    const w = mountItem({ isSelf: true })
    expect(w.find('img.drop-ic').attributes('src')).toContain('self')
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
  })
  it('选文件 emit select-files', async () => {
    const w = mountItem()
    const input = w.find('input[type=file]')
    const file = new File(['x'], 'x.txt')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(w.emitted('select-files')![0][0]).toEqual([file])
  })
  it('传输中显示进度环与计数文案', () => {
    const w = mountItem({ transfer: { progress: 40, sending: true, count: 2 } })
    expect(w.find('.drop-ring').exists()).toBe(true)
    expect(w.text()).toContain(i18n.global.t('filesDropSending', { num: 2 }))
  })
})
```

```ts
// src/files/drop/components/ReceivePrompt.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReceivePrompt from './ReceivePrompt.vue'
import { useDropStore } from '../stores/drop'
import { i18n } from '../../../i18n'

vi.mock('../serverConnection', () => ({ ServerConnection: class { connect = vi.fn(); destroy = vi.fn(); send = vi.fn() } }))
vi.mock('../peersManager', () => ({ PeersManager: class { handleServerMessage = vi.fn(); sendFiles = vi.fn(); destroy = vi.fn() } }))
vi.mock('@nimotech/nimoos-service', () => ({ refreshAccessToken: vi.fn(async () => {}) }))

describe('ReceivePrompt', () => {
  let pinia: ReturnType<typeof createPinia>
  beforeEach(() => { pinia = createPinia(); setActivePinia(pinia) })
  const mountP = () => mount(ReceivePrompt, { global: { plugins: [pinia, i18n] } })

  it('队列空不渲染', () => {
    expect(mountP().find('.receive-card').exists()).toBe(false)
  })
  it('队头渲染名称/大小,忽略出队,HTML 不含 /DATA', async () => {
    const s = useDropStore()
    s.receiveQueue.push({ file: { name: 'a.txt', mime: '', size: 2048, blob: new Blob(['x']) }, from: 'p' })
    const w = mountP()
    expect(w.find('.receive-card').exists()).toBe(true)
    expect(w.text()).toContain('a.txt')
    expect(w.text()).toContain('2 KB')
    expect(w.html()).not.toContain('/DATA')
    await w.find('.receive-ignore').trigger('click')
    expect(s.receiveQueue.length).toBe(0)
  })
  it('保存键调 saveCurrent', async () => {
    const s = useDropStore()
    const spy = vi.spyOn(s, 'saveCurrent').mockImplementation(() => {})
    s.receiveQueue.push({ file: { name: 'a', mime: '', size: 1, blob: new Blob(['x']) }, from: 'p' })
    await mountP().find('.receive-save').trigger('click')
    expect(spy).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/files/drop/components/DropItem.test.ts src/files/drop/components/ReceivePrompt.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 DropItem.vue**

```vue
<!-- src/files/drop/components/DropItem.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ContextMenuItem } from 'reka-ui'
import ContextMenu from '../../../components/ui/ContextMenu.vue'
import { dropIconUrl } from '../dropIcons'
import type { PeerInfo } from '../protocol'
import type { TransferState } from '../stores/drop'

const props = defineProps<{
  device: PeerInfo
  isSelf: boolean
  isFloat: boolean
  position?: { left: string; top: string }
  transfer?: TransferState
}>()
const emit = defineEmits<{ 'select-files': [files: File[]] }>()
const { t } = useI18n()

const inputEl = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const disabled = computed(() => props.isSelf || !!props.device.offline)
const icon = computed(() => dropIconUrl(props.device.name.model, !!props.device.offline, props.isSelf))
const tip = computed(() => {
  if (props.isSelf) return t('filesDropSelfTip')
  if (props.device.offline) return t('filesDropOfflineTip')
  if (props.transfer) {
    return props.transfer.sending
      ? t('filesDropSending', { num: props.transfer.count })
      : t('filesDropReceiving', { num: props.transfer.count })
  }
  return t('filesDropSendTip')
})
// SVG 进度环参数(r=38, 周长 2πr)
const CIRC = 2 * Math.PI * 38
const dash = computed(() => props.transfer ? (props.transfer.progress / 100) * CIRC : 0)

function onChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (files.length) emit('select-files', files)
  if (inputEl.value) inputEl.value.value = ''
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  if (disabled.value) return
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) emit('select-files', files)
}
function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (!disabled.value) dragOver.value = true
}
function pick() { if (!disabled.value) inputEl.value?.click() }
</script>

<template>
  <div
    class="drop-item"
    :class="{ floating: isFloat, offline: device.offline, self: isSelf }"
    :style="isFloat ? position : undefined"
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="dragOver = false"
  >
    <!-- ContextMenu 包装(components/ui/ContextMenu.vue,已核实 API):默认 slot=触发区、#menu=菜单项、无 disabled prop。
         self/离线不包菜单(对齐 Vue2 showContextMenu 的 early-return),v-if 分流。 -->
    <ContextMenu v-if="!disabled">
      <button
        class="drop-bubble"
        :class="{ 'drag-over': dragOver }"
        :title="tip"
        @click="pick"
      >
        <img class="drop-ic" :src="icon" alt="" />
        <span class="drop-dot" />
        <svg v-if="transfer" class="drop-ring" viewBox="0 0 84 84">
          <circle class="ring-track" cx="42" cy="42" r="38" />
          <circle class="ring-bar" cx="42" cy="42" r="38"
            :stroke-dasharray="`${dash} ${CIRC}`" transform="rotate(-90 42 42)" />
        </svg>
      </button>
      <template #menu>
        <ContextMenuItem class="ui-ctx-item" @select="pick">{{ t('filesDropMenuSend') }}</ContextMenuItem>
      </template>
    </ContextMenu>
    <button v-else class="drop-bubble" :class="{ offline: device.offline }" :title="tip" disabled>
      <img class="drop-ic" :src="icon" alt="" />
    </button>
    <span v-if="transfer" class="drop-count">{{ tip }}</span>
    <span class="drop-name">{{ device.name.displayName }}</span>
    <input ref="inputEl" type="file" multiple hidden :disabled="disabled" @change="onChange" />
  </div>
</template>

<style scoped>
.drop-item { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 96px; }
.drop-item.floating { position: absolute; transform: translate(-50%, -50%); z-index: 10; }
.drop-bubble {
  position: relative; width: 80px; height: 80px; border-radius: 50%;
  background: var(--card-bg); border: 1px solid var(--card-border);
  display: grid; place-items: center; cursor: pointer;
  animation: pop 0.4s ease both;
  transition: transform 0.2s ease;
}
.drop-bubble:not(:disabled):hover, .drop-bubble.drag-over { transform: scale(1.12); }
.drop-bubble:disabled { cursor: default; }
.drop-bubble.offline { opacity: 0.45; }
.drop-ic { width: 44px; height: 44px; pointer-events: none; }
.drop-dot {
  position: absolute; top: 4px; right: 4px; width: 8px; height: 8px;
  border-radius: 50%; background: var(--good);
}
.drop-ring { position: absolute; inset: -3px; pointer-events: none; }
.ring-track { fill: none; stroke: var(--card-border); stroke-width: 2; }
.ring-bar { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; }
.drop-count { font-size: 12px; color: var(--fg-muted); }
.drop-name {
  max-width: 96px; font-size: 13px; color: var(--fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;
}
</style>
```

注意(已核实仓内实况):①token 全用现有:`--good`(在线点)、`--fg-muted`(弱化文字)、`--on-accent`(accent 底上文字)、`--card-bg`/`--card-border`/`--popup-bg`/`--accent`——两套主题块均已有值,**本期不新增 token**;②`components/ui/ContextMenu.vue` API=默认 slot 触发区 + `#menu` 菜单项、无 disabled prop(上方代码已按此写,self/离线 v-if 分流不包菜单);③**不要**在触发子树加 `@contextmenu.prevent`(P2a 坑)。

- [ ] **Step 4: 实现 ReceivePrompt.vue**

```vue
<!-- src/files/drop/components/ReceivePrompt.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDropStore } from '../stores/drop'
import { renderSize } from '../../util/format'

const { t } = useI18n()
const drop = useDropStore()
const head = computed(() => drop.receiveQueue[0] ?? null)
</script>

<template>
  <transition name="fade">
    <div v-if="head" class="receive-card">
      <p class="receive-text">
        {{ t('filesDropSavePrompt', { name: head.file.name, size: renderSize(head.file.size), device: drop.deviceName(head.from) }) }}
      </p>
      <div class="receive-actions">
        <button class="receive-ignore" @click="drop.ignoreCurrent()">{{ t('filesDropIgnore') }}</button>
        <button class="receive-save" @click="drop.saveCurrent()">{{ t('filesDropSave') }}</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.receive-card {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  min-width: 320px; max-width: 90%; padding: 14px 18px; border-radius: var(--radius, 12px);
  background: var(--popup-bg); border: 1px solid var(--card-border);
  color: var(--fg); z-index: 50; animation: itemIn 0.25s ease both;
}
.receive-text { margin: 0 0 10px; font-size: 14px; word-break: break-all; }
.receive-actions { display: flex; justify-content: flex-end; gap: 10px; }
.receive-actions button {
  padding: 6px 16px; border-radius: 8px; border: 1px solid var(--card-border);
  background: transparent; color: var(--fg); cursor: pointer; font-size: 13px;
}
.receive-save { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
</style>
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run src/files/drop/components/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/files/drop/components/DropItem.vue src/files/drop/components/ReceivePrompt.vue src/files/drop/components/DropItem.test.ts src/files/drop/components/ReceivePrompt.test.ts
git commit -m "feat(drop): 设备气泡(自画 SVG 进度环/拖放/右键)+ 页内接收确认卡"
```

---

