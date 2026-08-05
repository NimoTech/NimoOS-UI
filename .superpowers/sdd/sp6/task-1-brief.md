### Task 1: 迁移 RAID 级别元数据与纯计算(`raidLevels.ts`)

从 Vue2 `NimoOS-UI/src/utils/raidUtils.js` 迁移级别常量与纯函数到 New-UI。**只迁矩阵/向导需要的部分**:`RAID_LEVELS`(每级 `id/name/min/tolerance/read/write/cost/desc/usecase` + `capacity(n,size)` + `layout(n)`)、`recommendRaidLevel(n)`、`isDiskAtRisk(disk)`、`groupColorKey(disk)`(混规格分组,返回 token 语义 key 而非字面色)。**不迁** `survival()`/`rebuildable()`(故障模拟器,推迟)。

**Files:**
- Create: `src/storage/util/raidLevels.ts`
- Test: `src/storage/util/raidLevels.test.ts`

**Interfaces:**
- Consumes: 无(纯常量/函数)。可 `import type { RaidDisk }` —— 若 `raidView.ts` 未导出磁盘视图类型,本 Task 在 `raidLevels.ts` 定义本地最小 `RaidDisk = { path: string; size: number; disk_type?: string; health?: string }`(对齐 Vue2 `disk.path/size/disk_type/health` 读法)并 export。
- Produces:
  - `export interface RaidLevelInfo { id: number; name: string; min: number; tolerance: string; read: number; write: number; cost: number; desc: string; usecase: string; capacity: (n: number, sizeBytes: number) => number; layout: (n: number) => Array<'data'|'mirror'|'parity'|'parity2'> }`
  - `export const RAID_LEVELS: RaidLevelInfo[]`(顺序 0,1,5,6,10)
  - `export function recommendRaidLevel(n: number): number`
  - `export function isDiskAtRisk(disk: RaidDisk): boolean`
  - `export function groupColorKey(disk: RaidDisk, groups: Array<{ key: string }>): string`(返回分组序号→token 语义,供组件映射到 `--nrm-*`/`--accent` 等,**不返回字面色**)
  - `export interface RaidDisk { path: string; size: number; disk_type?: string; health?: string }`

**逐字移植依据**(实现时对照 Vue2 源逐行核对,**读数/判定不得改**):
- `RAID_LEVELS` 各字段来自 `raidUtils.js:1-76`。`recommendRaidLevel`:2 盘→1,3 盘→5,盘数为偶→10,否则 5(`raidUtils.js:158-166`)。`isDiskAtRisk`:`disk.health === 'false'`(`raidUtils.js:108-110`,注意是**字符串** `'false'`)。
- `capacity(n,size)`/`layout(n)` 各级公式逐字对齐 `raidUtils.js`(RAID0 全 data;RAID1 1 data + (n-1) mirror;RAID5 (n-1) data + 1 parity;RAID6 (n-2) data + 2 parity2;RAID10 data/mirror 交替成对)。

- [ ] **Step 1: 写失败测试** `src/storage/util/raidLevels.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { RAID_LEVELS, recommendRaidLevel, isDiskAtRisk, type RaidDisk } from './raidLevels'

describe('RAID_LEVELS', () => {
  it('含 5 个级别,顺序 0,1,5,6,10', () => {
    expect(RAID_LEVELS.map(l => l.id)).toEqual([0, 1, 5, 6, 10])
  })
  it('每级最少盘数逐字对齐 Vue2', () => {
    const min = Object.fromEntries(RAID_LEVELS.map(l => [l.id, l.min]))
    expect(min).toEqual({ 0: 2, 1: 2, 5: 3, 6: 4, 10: 4 })
  })
  it('容量公式:4 盘 × 1000 → RAID0=4000 / RAID1=1000 / RAID5=3000 / RAID6=2000 / RAID10=2000', () => {
    const cap = (id: number) => RAID_LEVELS.find(l => l.id === id)!.capacity(4, 1000)
    expect(cap(0)).toBe(4000)
    expect(cap(1)).toBe(1000)
    expect(cap(5)).toBe(3000)
    expect(cap(6)).toBe(2000)
    expect(cap(10)).toBe(2000)
  })
  it('布局角色数量随盘数:RAID5 3盘 = 2 data + 1 parity', () => {
    const roles = RAID_LEVELS.find(l => l.id === 5)!.layout(3)
    expect(roles.filter(r => r === 'data')).toHaveLength(2)
    expect(roles.filter(r => r === 'parity')).toHaveLength(1)
  })
})

describe('recommendRaidLevel', () => {
  it('2盘→1, 3盘→5, 4盘→10, 6盘→10, 5盘→5', () => {
    expect(recommendRaidLevel(2)).toBe(1)
    expect(recommendRaidLevel(3)).toBe(5)
    expect(recommendRaidLevel(4)).toBe(10)
    expect(recommendRaidLevel(6)).toBe(10)
    expect(recommendRaidLevel(5)).toBe(5)
  })
})

describe('isDiskAtRisk', () => {
  it('health 字符串 "false" 视为风险,其余不是', () => {
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1, health: 'false' } as RaidDisk)).toBe(true)
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1, health: 'true' } as RaidDisk)).toBe(false)
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1 } as RaidDisk)).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/util/raidLevels.test.ts`
Expected: FAIL(模块/导出不存在)。

- [ ] **Step 3: 实现 `raidLevels.ts`**

对照 `NimoOS-UI/src/utils/raidUtils.js:1-166` 逐行移植 `RAID_LEVELS`(0/1/5/6/10 的 `min/tolerance/read/write/cost/desc/usecase/capacity/layout`)、`recommendRaidLevel`、`isDiskAtRisk`、`groupColorKey`。TS 化:`capacity`/`layout` 写成 `RaidLevelInfo` 里的方法;`layout` 返回 `('data'|'mirror'|'parity'|'parity2')[]`。**不移植** `survival`/`rebuildable`。文件顶部注释标 `// 从 NimoOS-UI/src/utils/raidUtils.js 逐字移植(P4);故障模拟器 survival()/rebuildable() 推迟`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/util/raidLevels.test.ts`
Expected: PASS。补跑 `pnpm exec vue-tsc --noEmit` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/util/raidLevels.ts src/storage/util/raidLevels.test.ts
git commit -m "feat(storage): 迁移 RAID 级别元数据与纯计算(P4 T1,不含故障模拟器)"
```

---

