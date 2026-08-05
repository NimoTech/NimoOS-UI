### Task 1: 快照纯函数与视图类型(`snapshotView.ts`)

从 Vue2 `NimoOS-UI/src/service/snapshot.js` 逐字移植面板/时间线需要的纯函数。**判定逻辑、默认值、排序、分组规则一律不得改**;**不迁**文件区六个路径函数(见 Global Constraints)。

**Files:**
- Create: `src/storage/util/snapshotView.ts`
- Test: `src/storage/util/snapshotView.test.ts`

**Interfaces:**
- Consumes: `import type { SnapshotVolume } from '@nimotech/nimoos-service'`。
- Produces:
  ```ts
  export interface SnapshotVolumeView {
    volume_uuid: string; mount: string; supported: boolean; enabled: boolean
    count: number; last_at: string; paused_reason: string
  }
  export interface SnapshotRaw {
    id?: number | string; name: string; label?: string; type?: string; created_at: string | number
  }
  export interface SnapshotItemView {
    id: number | string | undefined; name: string; label: string; type: string
    typeKind: 'auto' | 'manual' | 'preop'; typeLabelKey: string; time: string; createdAt: string | number
  }
  export interface SnapshotDayGroup {
    dayKey: string; label: { i18nKey?: string; text?: string }; items: SnapshotItemView[]
  }
  export interface PolicyForm {
    hourly_keep: number; daily_keep: number; weekly_keep: number; pause_threshold_pct: number
  }
  export type SnapshotState = 'unsupported' | 'disabled' | 'enabled'

  export function asSnapshotVolume(raw: SnapshotVolume | Record<string, unknown>): SnapshotVolumeView
  export function resolveSnapshotState(v: SnapshotVolumeView | null): SnapshotState
  export function validatePolicyForm(form: PolicyForm): { valid: boolean; errors: Partial<Record<keyof PolicyForm, string>> }
  export function classifySnapshotType(type: string | undefined): 'auto' | 'manual' | 'preop'
  export function snapshotTypeLabelKey(type: string | undefined): string
  export function formatSnapshotClockTime(createdAt: string | number | Date): string
  export function snapshotDayLabel(createdAt: string | number | Date, now?: Date): { i18nKey?: string; text?: string }
  export function toSnapshotViewModel(snap: SnapshotRaw): SnapshotItemView
  export function groupSnapshotsByDay(snapshots: SnapshotRaw[], now?: Date): SnapshotDayGroup[]
  export function defaultExpandedDayKeys(groups: SnapshotDayGroup[], limit?: number): string[]
  ```

**逐字移植依据**(实现时对照 Vue2 源逐行核对):
- `resolveSnapshotState`(`snapshot.js:6-9`):`!volume || !volume.supported` → `'unsupported'`;否则 `volume.enabled ? 'enabled' : 'disabled'`。
- `validatePolicyForm`(`:15-31`):三个 keep 必须 `Number.isInteger(v) && v >= 1`;`pause_threshold_pct` 必须整数且 `1..100`。**错误值改为具名 key**:keep 三项 → `'snapErrPositiveInt'`,阈值 → `'snapErrPercent'`(见 Global Constraints 偏离 3)。
- `classifySnapshotType`(`:45-49`):`'manual'`→manual、`'preop'`→preop、**其余一律 auto**(含 `auto-hourly`/`auto-daily`/`auto-weekly`/未知)。
- `snapshotTypeLabelKey`:auto→`'snapTypeAuto'`、manual→`'snapTypeManual'`、preop→`'snapTypePreop'`(Vue2 的 `"Auto"/"Manual"/"Pre-op protection"` 英文键改具名键,同偏离 3)。
- `formatSnapshotClockTime`(`:64-69`):本地时钟 `HH:mm`,两位补零。
- `snapshotDayLabel`(`:80-89`):同日→`{ i18nKey: 'snapToday' }`、前一日→`{ i18nKey: 'snapYesterday' }`、更早→`{ text: d.toLocaleDateString() }`。日期键 `dayKeyOf` = `YYYY-MM-DD` 本地时区。
- `toSnapshotViewModel`(`:95-108`)、`groupSnapshotsByDay`(`:112-131`,**按 created_at 倒序、不改输入、天分组内也是新的在前**)、`defaultExpandedDayKeys`(`:135-137`,默认展开最近 2 组)。
- `asSnapshotVolume` 是 New-UI 新增的收窄映射(照 `raidView.asRaidArray` 范式):`SnapshotVolume` 带索引签名,直接读 `count`/`last_at`/`paused_reason` 在 TS strict 下是 `unknown`。**默认值必须让语义与 Vue2 一致**:`supported`/`enabled` 缺失 → `false`,`count` → `0`,`last_at`/`paused_reason` → `''`。

- [ ] **Step 1: 写失败测试** `src/storage/util/snapshotView.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import {
  asSnapshotVolume, resolveSnapshotState, validatePolicyForm, classifySnapshotType,
  snapshotTypeLabelKey, formatSnapshotClockTime, snapshotDayLabel, toSnapshotViewModel,
  groupSnapshotsByDay, defaultExpandedDayKeys, type SnapshotRaw,
} from './snapshotView'

describe('asSnapshotVolume', () => {
  it('缺字段一律给安全默认(supported/enabled=false, count=0, 字符串为空)', () => {
    expect(asSnapshotVolume({})).toEqual({
      volume_uuid: '', mount: '', supported: false, enabled: false,
      count: 0, last_at: '', paused_reason: '',
    })
  })
  it('原样透传后端字段', () => {
    const v = asSnapshotVolume({ volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true, count: 3, last_at: '2026-07-27T01:00:00Z', paused_reason: 'disk full' })
    expect(v.count).toBe(3)
    expect(v.mount).toBe('/DATA')
    expect(v.paused_reason).toBe('disk full')
  })
})

describe('resolveSnapshotState', () => {
  it('null 或 supported=false → unsupported;supported 时按 enabled 分二态', () => {
    expect(resolveSnapshotState(null)).toBe('unsupported')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: false, enabled: true }))).toBe('unsupported')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: true, enabled: false }))).toBe('disabled')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: true, enabled: true }))).toBe('enabled')
  })
})

describe('validatePolicyForm', () => {
  const ok = { hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }
  it('合法表单 valid=true 且无错误', () => {
    expect(validatePolicyForm(ok)).toEqual({ valid: true, errors: {} })
  })
  it('keep 为 0/小数/负数 → snapErrPositiveInt', () => {
    expect(validatePolicyForm({ ...ok, hourly_keep: 0 }).errors.hourly_keep).toBe('snapErrPositiveInt')
    expect(validatePolicyForm({ ...ok, daily_keep: 1.5 }).errors.daily_keep).toBe('snapErrPositiveInt')
    expect(validatePolicyForm({ ...ok, weekly_keep: -1 }).errors.weekly_keep).toBe('snapErrPositiveInt')
  })
  it('阈值 0 / 101 / 小数 → snapErrPercent;1 与 100 是合法边界', () => {
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 0 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 101 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 50.5 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 1 }).valid).toBe(true)
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 100 }).valid).toBe(true)
  })
})

describe('classifySnapshotType', () => {
  it('只有 manual/preop 单列,其余(含 auto-hourly/未知/undefined)全归 auto', () => {
    expect(classifySnapshotType('manual')).toBe('manual')
    expect(classifySnapshotType('preop')).toBe('preop')
    expect(classifySnapshotType('auto-hourly')).toBe('auto')
    expect(classifySnapshotType('whatever')).toBe('auto')
    expect(classifySnapshotType(undefined)).toBe('auto')
  })
  it('标签 key 与类别一一对应', () => {
    expect(snapshotTypeLabelKey('manual')).toBe('snapTypeManual')
    expect(snapshotTypeLabelKey('preop')).toBe('snapTypePreop')
    expect(snapshotTypeLabelKey('auto-daily')).toBe('snapTypeAuto')
  })
})

describe('formatSnapshotClockTime', () => {
  it('本地时钟 HH:mm 两位补零', () => {
    expect(formatSnapshotClockTime(new Date(2026, 6, 27, 9, 5))).toBe('09:05')
    expect(formatSnapshotClockTime(new Date(2026, 6, 27, 23, 59))).toBe('23:59')
  })
})

describe('snapshotDayLabel', () => {
  const now = new Date(2026, 6, 27, 12, 0)
  it('今天/昨天走 i18n key,更早给已格式化文本', () => {
    expect(snapshotDayLabel(new Date(2026, 6, 27, 1, 0), now)).toEqual({ i18nKey: 'snapToday' })
    expect(snapshotDayLabel(new Date(2026, 6, 26, 23, 0), now)).toEqual({ i18nKey: 'snapYesterday' })
    const older = snapshotDayLabel(new Date(2026, 6, 20, 8, 0), now)
    expect(older.i18nKey).toBeUndefined()
    expect(typeof older.text).toBe('string')
  })
})

describe('groupSnapshotsByDay / defaultExpandedDayKeys', () => {
  const snaps: SnapshotRaw[] = [
    { id: 1, name: 'a', type: 'auto-hourly', created_at: new Date(2026, 6, 25, 10, 0).toISOString() },
    { id: 2, name: 'b', type: 'manual', label: '升级前', created_at: new Date(2026, 6, 27, 8, 30).toISOString() },
    { id: 3, name: 'c', type: 'preop', created_at: new Date(2026, 6, 27, 20, 15).toISOString() },
    { id: 4, name: 'd', type: 'auto-daily', created_at: new Date(2026, 6, 26, 6, 0).toISOString() },
  ]
  const now = new Date(2026, 6, 27, 23, 0)
  it('按天倒序分组,组内也是新的在前', () => {
    const groups = groupSnapshotsByDay(snaps, now)
    expect(groups.map(g => g.dayKey)).toEqual(['2026-07-27', '2026-07-26', '2026-07-25'])
    expect(groups[0].items.map(i => i.name)).toEqual(['c', 'b'])
  })
  it('不改动输入数组', () => {
    const input = [...snaps]
    groupSnapshotsByDay(input, now)
    expect(input.map(s => s.name)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('条目视图带类别/标签键/时钟/备注', () => {
    const vm = toSnapshotViewModel(snaps[1])
    expect(vm.typeKind).toBe('manual')
    expect(vm.typeLabelKey).toBe('snapTypeManual')
    expect(vm.time).toBe('08:30')
    expect(vm.label).toBe('升级前')
  })
  it('无 label 归一为空串(模板直接判真假)', () => {
    expect(toSnapshotViewModel(snaps[0]).label).toBe('')
  })
  it('默认展开最近 2 组', () => {
    const groups = groupSnapshotsByDay(snaps, now)
    expect(defaultExpandedDayKeys(groups)).toEqual(['2026-07-27', '2026-07-26'])
    expect(defaultExpandedDayKeys(groups, 1)).toEqual(['2026-07-27'])
  })
  it('空列表 → 空分组、空展开键', () => {
    expect(groupSnapshotsByDay([], now)).toEqual([])
    expect(defaultExpandedDayKeys([])).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/util/snapshotView.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 `snapshotView.ts`**

对照 `NimoOS-UI/src/service/snapshot.js:1-137` 逐行移植。文件顶部注释标:
```ts
// 从 NimoOS-UI/src/service/snapshot.js 逐字移植(SP6-P5)。
// 未迁:snapshotBrowsePath / parseSnapshotBrowsePath / liveVolumePath / parseSnapshotName /
// formatSnapshotBannerTime / findVolumeForPath —— 属文件区快照浏览套件,随该期一起迁(见 P5 计划台账)。
```
骨架(其余函数照上面「逐字移植依据」补齐):
```ts
import type { SnapshotVolume } from '@nimotech/nimoos-service'

export type SnapshotState = 'unsupported' | 'disabled' | 'enabled'
// …(接口定义见 Interfaces 段,原样落盘)

const TYPE_LABEL_KEYS: Record<'auto' | 'manual' | 'preop', string> = {
  auto: 'snapTypeAuto', manual: 'snapTypeManual', preop: 'snapTypePreop',
}

export function asSnapshotVolume(raw: SnapshotVolume | Record<string, unknown>): SnapshotVolumeView {
  const r = raw as Record<string, unknown>
  return {
    volume_uuid: (r.volume_uuid as string) || '',
    mount: (r.mount as string) || '',
    supported: r.supported === true,
    enabled: r.enabled === true,
    count: Number(r.count) || 0,
    last_at: (r.last_at as string) || '',
    paused_reason: (r.paused_reason as string) || '',
  }
}

export function resolveSnapshotState(v: SnapshotVolumeView | null): SnapshotState {
  if (!v || !v.supported) return 'unsupported'
  return v.enabled ? 'enabled' : 'disabled'
}

export function validatePolicyForm(form: PolicyForm) {
  const errors: Partial<Record<keyof PolicyForm, string>> = {}
  const isPositiveInt = (v: number) => Number.isInteger(v) && v >= 1
  if (!isPositiveInt(form.hourly_keep)) errors.hourly_keep = 'snapErrPositiveInt'
  if (!isPositiveInt(form.daily_keep)) errors.daily_keep = 'snapErrPositiveInt'
  if (!isPositiveInt(form.weekly_keep)) errors.weekly_keep = 'snapErrPositiveInt'
  const pct = form.pause_threshold_pct
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) errors.pause_threshold_pct = 'snapErrPercent'
  return { valid: Object.keys(errors).length === 0, errors }
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```
`groupSnapshotsByDay` 排序照 Vue2 用 `new Date(b.created_at).getTime() - new Date(a.created_at).getTime()`(Vue2 直接相减 Date 对象,TS 下改用 `getTime()`,结果等价)。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/util/snapshotView.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/util/snapshotView.ts src/storage/util/snapshotView.test.ts
git commit -m "feat(storage): 快照纯函数与视图类型逐字移植(P5 T1)"
```

---

