### Task 6: 删除阵列 —— type-to-confirm 弹窗 + 详情头按钮(路线 B)

新建 `RaidDeleteDialog.vue`(仿 `FormatDialog.vue`,但输入框是普通文本,提交条件 = `输入 === 阵列名`,**无密码**);详情页 `.rd-head` 加红色 Delete 按钮触发;确认后 `store.removeRaid(id)` → 成功回列表。**更新 P3 的按钮计数不变式测试**(加了写按钮,baseline 必变)。

**Files:**
- Create: `src/storage/components/RaidDeleteDialog.vue`
- Test: `src/storage/components/RaidDeleteDialog.test.ts`
- Modify: `src/views/StorageRaidDetail.vue`、`src/views/StorageRaidDetail.test.ts`(更新计数不变式)

**Interfaces:**
- Consumes: `Dialog`;`useStorageStore().removeRaid`/`raidRemoving`;`useRouter`。
- Produces: `RaidDeleteDialog` props `{ open: boolean; name: string; busy?: boolean }`,emits `{ (e:'update:open', v:boolean): void; (e:'confirm'): void }`(无 payload)。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDeleteDialog from './RaidDeleteDialog.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidDeleteDialog', () => {
  const mountIt = () => mount(RaidDeleteDialog, {
    props: { open: true, name: 'vault' }, global: { plugins: [i18n] },
    attachTo: document.body,
  })
  it('输入不等于阵列名 → 删除按钮禁用', async () => {
    const w = mountIt()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vaul'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(true)
  })
  it('输入等于阵列名 → 启用,点击 emit confirm(无 payload)', async () => {
    const w = mountIt()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(false)
    ok.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([])
  })
  it('开/关都清空输入', async () => {
    const w = mountIt()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.setProps({ open: false }); await w.setProps({ open: true })
    expect((document.body.querySelector('.rdd-input') as HTMLInputElement).value).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现弹窗 + 详情头按钮 + 更新计数不变式**

- `RaidDeleteDialog.vue`:仿 `FormatDialog.vue` 骨架,`confirmText = ref('')`,`watch(() => props.open, () => confirmText.value = '')`。主文案用 `raidRemoveMsg`(逐字采用 Vue2 本意的删除主句,见附录 B)+ danger 小字 ⚠️ `raidRemoveWarning`。输入框 `.rdd-input` `type="text"` `:placeholder="t('raidRemoveTypeName', { name })"`;删除按钮 `.rdd-ok.danger` `:disabled="confirmText !== name || busy"` `@click="emit('confirm')"`;取消 `.rdd-cancel`。
- `StorageRaidDetail.vue`:`.rd-head`(`:99-104`)右侧加 Delete 按钮(红,`.rd-delete`)→ `deleteOpen = true`;挂 `<RaidDeleteDialog :open="deleteOpen" :name="detail.array.name" :busy="store.raidRemoving" @update:open="deleteOpen=$event" @confirm="onDelete" />`;`onDelete = async () => { const ok = await store.removeRaid(id); if (ok) { deleteOpen=false; router.push('/storage/raid') } }`。
- **更新计数不变式测试**:P3 终审加的"按钮计数 === 2"不变式(`StorageRaidDetail.test.ts`)现在会因新增按钮变化。把它改成**语义化断言**而非硬计数:断言 `.rd-delete` 存在(active/degraded 阵列),并断言不该出现的按钮(如 replace 在非 degraded 时)缺席;同时在 recover 尚未加(T8)前,先只对 delete 生效。**T8 完成后再回来把 recover 按钮纳入该测试**(在 T8 Step 记一笔)。

- [ ] **Step 4: 运行确认通过** → 弹窗测试 + 详情页测试 PASS;`vue-tsc` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidDeleteDialog.vue src/storage/components/RaidDeleteDialog.test.ts src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 删除 type-to-confirm 弹窗+详情头按钮(P4 T6,路线B)"
```

---

