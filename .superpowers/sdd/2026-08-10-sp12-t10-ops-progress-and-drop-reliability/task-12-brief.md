### Task 12: `DropItem` 进度看门狗

**Files:**
- Modify: `src/files/drop/components/DropItem.vue`, `src/files/drop/components/DropItem.test.ts`, `src/files/drop/components/DropPage.vue`

**Interfaces:**
- Produces: `DropItem` 新增 emit `'transfer-stalled': []`

**为什么还要看门狗**:Task 8 的超时只覆盖「发送端等 ack」。接收端、以及连接**没有关闭但数据不再流动**(网络黑洞)的情况,通道层不会报任何事件 —— 只有「进度多久没动」这个信号能发现。

- [ ] **Step 1: 写失败测试(追加)**

```ts
import { vi } from 'vitest'

describe('DropItem stall watchdog', () => {
  it('reports a stall when progress stops moving for long enough', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
      vi.advanceTimersByTime(20000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps quiet while progress is still advancing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
      vi.advanceTimersByTime(10000)
      await w.setProps({ transfer: { progress: 55, sending: true, count: 1 } })
      vi.advanceTimersByTime(10000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not run at all when no transfer is in flight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({})
      vi.advanceTimersByTime(60000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops its timer on unmount so a torn-down card cannot fire', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
      w.unmount()
      vi.advanceTimersByTime(60000)
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/components/DropItem.test.ts`
Expected: 第一条 FAIL

- [ ] **Step 3: 写实现**

`DropItem.vue` 的 `<script setup>`:

```ts
import { onBeforeUnmount, watch } from 'vue'

const emit = defineEmits<{ 'select-files': [files: File[]]; 'cancel-transfer': []; 'transfer-stalled': [] }>()

// Task 8's ack timeout only covers a sender waiting for an acknowledgement.
// A connection that stays open while bytes stop flowing raises no channel
// event at all, so "progress has not moved" is the only signal left.
const STALL_CHECK_MS = 5000
const STALL_LIMIT_MS = 15000

let lastMovedAt = Date.now()
let stallTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.transfer?.progress,
  () => { lastMovedAt = Date.now() },
)

function stopWatchdog() {
  if (stallTimer === null) return
  clearInterval(stallTimer)
  stallTimer = null
}

function startWatchdog() {
  stopWatchdog()
  lastMovedAt = Date.now()
  stallTimer = setInterval(() => {
    const t = props.transfer
    if (!t || t.progress <= 0 || t.progress >= 100) return
    if (Date.now() - lastMovedAt < STALL_LIMIT_MS) return
    stopWatchdog()
    emit('transfer-stalled')
  }, STALL_CHECK_MS)
}

watch(
  () => !!props.transfer,
  (active) => { if (active) startWatchdog(); else stopWatchdog() },
  { immediate: true },
)

onBeforeUnmount(stopWatchdog)
```

⚠️ `props` 在 `<script setup>` 里已经通过 `const props = defineProps<...>()` 拿到,别重复声明。

`DropPage.vue` 的 `<DropItem>` 再加一行:

```vue
        @transfer-stalled="drop.cancelTransfer(p.peer.id)"
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/components/DropItem.test.ts`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `onBeforeUnmount(stopWatchdog)` 删掉,重跑 → 「stops its timer on unmount」必须真红。恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/components/DropItem.vue src/files/drop/components/DropItem.test.ts src/files/drop/components/DropPage.vue
git commit -m "feat(drop): notice a transfer whose progress has stopped moving

An open connection that stops carrying bytes raises no channel event, so the
progress clock is the only stall signal available.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

