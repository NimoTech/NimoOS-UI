### Task 11: `DropItem` 取消菜单项

**Files:**
- Modify: `src/files/drop/components/DropItem.vue`, `src/files/drop/components/DropPage.vue`
- Test: `src/files/drop/components/DropItem.test.ts`(不存在则新建)

**Interfaces:**
- Produces: `DropItem` 新增 emit `'cancel-transfer': []`
- Consumes: store 的 `cancelTransfer(peerId)`

**注意**:`DropItem` 已有 reka-ui `ContextMenu`(`:71-89`),里面当前只有一项「发送文件」。本任务是**往已有菜单加第二项**,不是新造组件。

- [ ] **Step 1: 加 i18n 键**

`zh_cn.base.ts`: `filesDropMenuCancel: '取消发送',`
`en_us.base.ts`: `filesDropMenuCancel: 'Cancel sending',`

- [ ] **Step 2: 写失败测试**

```ts
// src/files/drop/components/DropItem.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '../../../i18n'
import DropItem from './DropItem.vue'
import type { PeerInfo } from '../protocol'

const device: PeerInfo = {
  id: 'p2', rtcSupported: true,
  name: { model: 'desktop', deviceName: 'box', displayName: 'Box' },
}

function mountItem(props: Record<string, unknown>) {
  return mount(DropItem, {
    props: { device, isSelf: false, isFloat: false, ...props },
    global: { plugins: [i18n] },
  })
}

describe('DropItem cancel entry', () => {
  it('offers cancelling only while a transfer is running', () => {
    const idle = mountItem({})
    expect(idle.html()).not.toContain(i18n.global.t('filesDropMenuCancel'))
  })

  it('emits cancel-transfer when the menu entry is chosen', async () => {
    const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
    const entries = w.findAllComponents({ name: 'ContextMenuItem' })
    const cancel = entries.find((e) => e.text() === i18n.global.t('filesDropMenuCancel'))
    expect(cancel).toBeTruthy()
    await cancel!.vm.$emit('select')
    expect(w.emitted('cancel-transfer')).toBeTruthy()
  })
})
```

⚠️ reka-ui 的 `ContextMenuItem` 只有在菜单**打开**时才渲染进 portal。若上面 `findAllComponents` 取不到,改用「直接断言组件树里 `#menu` 插槽的 vnode」的写法 —— **不要为了让测试好写而把菜单项挪出 ContextMenu**。若两种写法都取不到,停下来报告,由控制器裁定。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/components/DropItem.test.ts`
Expected: 第二条 FAIL

- [ ] **Step 4: 写实现**

`DropItem.vue`:

```ts
const emit = defineEmits<{ 'select-files': [files: File[]]; 'cancel-transfer': [] }>()
```

菜单插槽里加第二项:

```vue
      <template #menu>
        <ContextMenuItem class="ui-ctx-item" @select="pick">{{ t('filesDropMenuSend') }}</ContextMenuItem>
        <ContextMenuItem
          v-if="transfer"
          class="ui-ctx-item danger"
          @select="emit('cancel-transfer')"
        >{{ t('filesDropMenuCancel') }}</ContextMenuItem>
      </template>
```

`.ui-ctx-item.danger` 是 `components/ui/ContextMenu.vue` 里既有的非 scoped 规则(危险色随主题切换),**不要新写颜色**。

`DropPage.vue` 的 `<DropItem>` 挂载点加一行接线:

```vue
        @cancel-transfer="drop.cancelTransfer(p.peer.id)"
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/ src/i18n/parity.test.ts`
Expected: 全绿

- [ ] **Step 6: 变异验证**

把 `v-if="transfer"` 删掉,重跑 → 「offers cancelling only while a transfer is running」必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/drop/components/DropItem.vue src/files/drop/components/DropItem.test.ts src/files/drop/components/DropPage.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(drop): add a cancel entry to the device context menu

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

