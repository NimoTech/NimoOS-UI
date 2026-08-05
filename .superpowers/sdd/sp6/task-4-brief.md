### Task 4: 级别对比矩阵 `RaidMatrix`(仅主体,无故障模拟器)

迁移 Vue2 `RaidMatrix.vue` 的**矩阵主体**(`:12-121`)。行:Layout(磁盘条按 role 上色)/Min drives/Survives failure of(容错 pill)/Usable capacity(+利用率%)/Read/Write/Cost(各 5 段 pip 计量条)/Best for/Actions(Select + Details)。**决策 2:不迁 `:123-200` 的故障模拟器 modal 及相关 `survival` 逻辑。**

**Files:**
- Create: `src/storage/components/RaidMatrix.vue`
- Test: `src/storage/components/RaidMatrix.test.ts`

**Interfaces:**
- Consumes: `RAID_LEVELS`、`RaidLevelSpec`(T1);`fmtSize`;`useI18n`。
- Produces: props `{ diskCount: number; sizeBytes: number; selectedLevel: number | null }`,emits `{ (e:'update:selectedLevel', id: number): void; (e:'details', id: number): void }`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMatrix from './RaidMatrix.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidMatrix', () => {
  it('渲染 5 个级别列', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.findAll('.rm-col')).toHaveLength(5)
  })
  it('点 Select → emit update:selectedLevel(级别 id)', async () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    await w.findAll('.rm-select')[2].trigger('click')  // 第3列 = RAID5
    expect(w.emitted('update:selectedLevel')!.at(-1)).toEqual([5])
  })
  it('不渲染故障模拟器入口(推迟)', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.find('.rm-simulator').exists()).toBe(false)
    expect(w.text().toLowerCase()).not.toContain('failure simulator')
  })
})
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现 `RaidMatrix.vue`**

对照 Vue2 `RaidMatrix.vue:12-121` 的 grid 结构逐行迁 `<script setup>`:9 行 × 5 列。Layout 条按 `lv.layout(diskCount)` 的 role 上色(data→`--accent`,mirror→`--sem-fg`,parity→`--dem-fg`,parity2→`--remove-fg`,均 token);容量 = `lv.capacity(diskCount, sizeBytes)` + 利用率 `capPct`;read/write/cost 用 5 段 pip(填充数 = `lv.read`,token 化)。`Select` 按钮 `.rm-select` emit `update:selectedLevel`;`Details` 按钮 `.rm-details` emit `details`。选中列高亮(`selectedLevel === lv.id`)。**删掉 Vue2 的 `openModal`/`failDrive`/`modalStatus`/`RestoreAll`/`Reset` 全部模拟器代码**,顶部注释标 `<!-- 故障模拟器 P4 决策2 推迟 -->`。表头/单元格不再挂 `@click="openModal"`。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidMatrix.vue src/storage/components/RaidMatrix.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 级别对比矩阵主体(P4 T4,故障模拟器推迟)"
```

---

