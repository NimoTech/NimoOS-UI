### Task 3: 选盘组件 `RaidDriveCard` + `RaidDriveBay`

迁移 Vue2 选盘 UI(`NimoOS-UI/.../RaidDriveBay.vue` + `RaidDriveCard.vue`)。`RaidDriveCard` = 单盘可选卡片(整卡点击 toggle + 右上勾选圈 + 容量/类型/健康风险标记);`RaidDriveBay` = 过滤段(All/SSD/HDD)+ 全选健康/清空 + 4 列网格 + 底部汇总条(已选盘数 + 原始容量)。

**Files:**
- Create: `src/storage/components/RaidDriveCard.vue`、`src/storage/components/RaidDriveBay.vue`
- Test: `src/storage/components/RaidDriveCard.test.ts`、`src/storage/components/RaidDriveBay.test.ts`

**Interfaces:**
- Consumes: `isDiskAtRisk`、`RaidDisk`、`groupColorKey`(T1);`fmtSize`(`../../home/util/format`)。
- Produces:
  - `RaidDriveCard` props `{ disk: RaidDisk; selected: boolean; groupKey?: string }`,emits `{ (e:'toggle'): void }`。
  - `RaidDriveBay` props `{ disks: RaidDisk[]; modelValue: RaidDisk[] }`(选中盘,v-model),emits `{ (e:'update:modelValue', v: RaidDisk[]): void }`。内部维护过滤态(`'all'|'ssd'|'hdd'`)、`selectAllHealthy()`、`clear()`。

- [ ] **Step 1: 写失败测试**(`RaidDriveBay.test.ts`,DriveCard 同理)

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDriveBay from './RaidDriveBay.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const disks = [
  { path: '/dev/sda', size: 1000, disk_type: 'SSD', health: 'true' },
  { path: '/dev/sdb', size: 2000, disk_type: 'HDD', health: 'true' },
  { path: '/dev/sdc', size: 1000, disk_type: 'SSD', health: 'false' }, // 风险盘
]

describe('RaidDriveBay', () => {
  it('点卡片 toggle → emit update:modelValue 含该盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.findAllComponents({ name: 'RaidDriveCard' })[0].vm.$emit('toggle')
    const evt = w.emitted('update:modelValue')!.at(-1)![0] as any[]
    expect(evt.map(d => d.path)).toEqual(['/dev/sda'])
  })
  it('全选健康 → 只选非风险盘(排除 health="false")', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-select-all').trigger('click')
    const evt = w.emitted('update:modelValue')!.at(-1)![0] as any[]
    expect(evt.map(d => d.path).sort()).toEqual(['/dev/sda', '/dev/sdb'])
  })
  it('过滤 SSD → 只显示 SSD 盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-ssd').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(2)
  })
  it('汇总条:已选 2 盘 → 显示盘数与容量合计', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [disks[0], disks[1]] }, global: { plugins: [i18n] } })
    expect(w.find('.rdb-summary').text()).toContain('2')
  })
})
```

- [ ] **Step 2: 运行确认失败** — `pnpm exec vitest run src/storage/components/RaidDriveBay.test.ts` → FAIL。

- [ ] **Step 3: 实现两组件**

对照 Vue2 `RaidDriveBay.vue`(:16-21 过滤/操作、:80-83 filteredDisks、:120-130 toggle/selectAllHealthy、汇总条)+ `RaidDriveCard.vue`(整卡 `@click="$emit('toggle')"`、勾选圈 `.rdc__check--on`、容量/类型/风险标)。改写为 `<script setup>`:
- `RaidDriveBay` 内 `filter = ref<'all'|'ssd'|'hdd'>('all')`,`filteredDisks = computed`;toggle 用 `props.modelValue` 增删后 `emit('update:modelValue', next)`;`selectAllHealthy` = `disks.filter(d => !isDiskAtRisk(d))`;`clear` emit `[]`。全选/清空/过滤按钮各带稳定 class(`.rdb-select-all`/`.rdb-clear`/`.rdb-filter-all|-ssd|-hdd`)。
- 网格 CSS 用 `grid-template-columns: repeat(auto-fill, minmax(...))`;颜色全 token;混规格分组色经 `groupColorKey` → 映射到 `--nrm-*`/`--accent`(禁字面色)。
- `RaidDriveCard` 根 `@click="emit('toggle')"`,选中态 class 切换,勾选圈 SVG √;风险盘用 `--remove-fg` 标记;容量 `fmtSize(disk.size)`。

- [ ] **Step 4: 运行确认通过** — 两测试 PASS;`vue-tsc --noEmit` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidDriveCard.vue src/storage/components/RaidDriveCard.test.ts src/storage/components/RaidDriveBay.vue src/storage/components/RaidDriveBay.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 选盘 DriveBay+DriveCard(P4 T3)"
```

---

