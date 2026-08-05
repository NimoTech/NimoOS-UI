### Task 9: `StorageRaidDetail.vue` 详情视图 + `RaidMemberList.vue` + 详情路由

只读详情:头部(名称/RAID {level} 徽章/状态徽章,**无** recover/delete 按钮)、左列用量甜甜圈 + RAID 级别信息卡、右列阵列信息表 + 成员盘列表。**不挂快照面板**(P5 边界)。

**Files:**
- Create: `src/views/StorageRaidDetail.vue`(+ `.test.ts`)
- Create: `src/storage/components/RaidMemberList.vue`(+ `.test.ts`)
- Modify: `src/router/index.ts`(加 `/storage/raid/:id`)
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(详情表 + 级别信息文案)

**Interfaces:**
- Consumes: `store.raidDetail/raidDetailLoading/loadRaidDetail`(T3)、`resolveRaidState/raidSeverity/raidStateLabelKey/raidUsagePercent/memberSquare/mirrorPairs/levelInfo/RAID_LEVEL_INFO`(T2)、`fmtSize`。
- Produces: 路由 `storage-raid-detail`;`<RaidMemberList :members :level />`。

**新增 i18n key(双写)**:`raidDetailDevicePath`(设备路径)、`raidDetailMountPoint`(挂载点)、`raidDetailFilesystem`(文件系统)、`raidDetailUuid`(UUID)、`raidDetailChunk`(块大小)、`raidDetailState`(状态)、`raidUsageUsed`(已用)、`raidUsageFree`(空闲)、`raidLevelType`(类型)、`raidLevelTolerance`(容错)、`raidLevelRead`(读速)、`raidLevelWrite`(写速)、`raidMembers`(成员磁盘)、`raidBtrfsFreeEst`(btrfs 估算可用)、`raidBtrfsCachedAt`(缓存于)、以及 T2 占位的级别文案 key(`raidLevel{0,1,5,6,10}{Tolerance,Read,Write,Desc}`)——值逐字从 `RaidDetailPanel.vue` L267-290 与 `raidUtils.js` RAID_LEVELS 转录。

- [ ] **Step 1: 写 RaidMemberList 失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMemberList from './RaidMemberList.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidMemberList', () => {
  it('非 RAID10:平铺渲染成员', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-row').length).toBe(2)
    expect(w.text()).toContain('/dev/sda')
  })
  it('RAID10:按镜像对分组', () => {
    const w = mount(RaidMemberList, { props: { level: 10, members: [
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdd', state: 'active sync set-B', number: 3 },
      { path: '/dev/sdc', state: 'active sync set-A', number: 2 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(2)
  })
  it('重建中成员显示 rebuild_pct', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'spare rebuilding', number: 0, rebuild_pct: 33 },
    ] }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('33')
  })
})
```

- [ ] **Step 2: 跑失败,写 RaidMemberList 实现**

`level===10` → `mirrorPairs(members)` 渲染 `.rml-pair`(每对含成员行);否则平铺 `.rml-row`。每行:`memberSquare(state)` 上色圆点 + `path` + `t(memberSquare.labelKey)`(unknown 类回退原始 state)+ 可选 `member.rebuild_pct%`。全 token 色。

Run(失败→实现→通过):`pnpm exec vitest run src/storage/components/RaidMemberList.test.ts`

- [ ] **Step 3: 加详情路由**

`src/router/index.ts` 顶部 `import StorageRaidDetail from '../views/StorageRaidDetail.vue'`;`/storage/raid` 后加:

```ts
{ path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
```

- [ ] **Step 4: 写 StorageRaidDetail 失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaidDetail from './StorageRaidDetail.vue'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([{ id: 7, name: 'md7', level: 5, state: 'active', mount_point: '/DATA', uuid: 'u-7' }])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [{ path: '/dev/sda', state: 'active sync', number: 0 }] })
const raidGetUsage = vi.fn().mockResolvedValue({ filesystem: 'btrfs', btrfs_usage: { free_estimated_bytes: 55, cached_at: 1700000000 } })
vi.mock('@nimotech/nimoos-service', () => ({ service: {
  storage: { list: vi.fn().mockResolvedValue([]) }, disks: { getDiskList: vi.fn().mockResolvedValue({ disks: [] }) },
  raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), getUsage: (...a: unknown[]) => raidGetUsage(...a) },
} }))
vi.mock('../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => vi.fn() }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
  { path: '/storage/raid', name: 'storage-raid', component: Stub }, { path: '/', component: Stub },
] })

describe('StorageRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('加载详情:名称 + RAID 级别 + 用量 + 成员 + btrfs 行', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid() // 先填 raidArrays 让 detail 找得到 array
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.text()).toContain('md7')
    expect(w.text()).toContain('RAID 5')
    expect(w.text()).toContain('/dev/sda')
    expect(raidGetUsage).toHaveBeenCalledWith('7')
  })
  it('不渲染写操作按钮(recover/delete/replace)——P4 边界', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-recover').exists()).toBe(false)
    expect(w.find('.rd-delete').exists()).toBe(false)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
})
```

- [ ] **Step 5: 写 StorageRaidDetail 实现**

`<script setup>`:`route.params.id` → `onMounted(() => store.loadRaid().then(() => store.loadRaidDetail(id)))`(先 list 拿 array 名/level,再 detail);computed `detail = store.raidDetail`、`flags`、`severity`、`pct`。5000ms 单飞状态重拉(重建中):`useGuardedPoll(() => store.loadRaidDetail(id), { intervalMs: 5000, active: () => flags.value.isRebuilding })`。

template 包 `<StorageShell>`:
- 头部:返回列表(`router.push('/storage/raid')` 或 StorageShell 自带回主页;此处加一个"‹ 返回 RAID"局部返回按钮)+ 名称 + `RAID {level}` 徽章 + 状态徽章(`.rc-badge` 复用)。**无写按钮。**
- 左列:甜甜圈 `conic-gradient(var(--accent) {pct}%, var(--nrm-bg) {pct}%)` + 图例(已用 `--accent` / 空闲 `--nrm-bg`)+ 级别信息卡(`levelInfo(level)` → 类型/容错/读速/写速,`t(info.faultToleranceKey)` 等;`null` 则整卡不渲染)。
- 右列:阵列信息表(设备路径 `device_path || '/dev/'+name`、挂载点、文件系统(`status.filesystem||usage.filesystem||array.filesystem`,小写)、UUID、块大小 `chunk_kb`、状态(`t(labelKey)` 上色)、重建时:`raidRebuildFinish`/`raidRebuildSpeed` 行;btrfs:`usage.btrfs_usage.free_estimated_bytes`(fmtSize)+ `cached_at`)。
- 成员盘:`<RaidMemberList :level="detail.array.level" :members="detail.status?.members || []" />`。
- **不渲染 `<SnapshotPanel>`**(P5)——留一行注释 `<!-- 快照面板 P5 -->` 标边界。

颜色全 token。**实现步**:把 T2 占位的级别文案 key(`raidLevel*`)的中/英值从 `RaidDetailPanel.vue` L267-290 + `raidUtils.js` RAID_LEVELS 逐字转录进 zh_cn/en_us。

- [ ] **Step 6: 跑全套 + parity + tsc**

Run: `pnpm exec vitest run src/views/StorageRaidDetail.test.ts src/storage/components/RaidMemberList.test.ts src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 7: 提交**

```bash
git add src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts src/storage/components/RaidMemberList.vue src/storage/components/RaidMemberList.test.ts src/router/index.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 详情视图(用量/级别/阵列信息/成员,无写操作+无快照)+ 详情路由"
```

---

## 收尾(全 9 Task 完成后)

- [ ] **全套测试 + tsc**:`pnpm test && pnpm exec vue-tsc --noEmit` 全绿。
- [ ] **构建产物**:`pnpm build`(vue-tsc + vite build → dist/)。
- [ ] **5273 眼验**(常驻 vite preview 伺服 dist,重建即生效):`http://<设备IP>:5273/app/#/storage/raid`
  - RAID 列表:阵列卡片(名称/RAID 级别/状态徽章色/成员方块/容量条/在线盘数);空态文案;点击进详情。
  - 详情页:甜甜圈用量 + 级别信息 + 阵列信息表 + 成员盘(RAID10 看镜像对);**确认无 recover/delete/replace 按钮、无快照面板**。
  - 状态/进度活体:若真机有重建中阵列,看 5000ms 是否活体刷新(无则记"未实盘验证");若有创建中任务,看进度卡 + 1500ms 轮询 + 弹窗 6 步。
  - 热插拔:插拔盘看列表 500ms 后刷新。
  - CSS/容器查询/甜甜圈**必须眼验**(SP2 血泪:jsdom 测不出布局)。
  - 亮/暗主题都扫一遍(状态徽章、成员点、甜甜圈色)。
- [ ] **台账**:在 `.superpowers/sdd/progress.md` 追加 P3 关账行 + Minor 汇总;更新长期记忆 `vue3-migration-plan`(SP6 段 P3 关账坐标)。**roadmap 记账推迟 P6**。

## Self-Review(写完自查)

- **spec 覆盖**(设计 §4 P3):列表卡片 ✅(T4)、状态 ✅(T2/T4)、详情面板不含快照 ✅(T9)、使用率 ✅(T4/T9)、创建任务进度卡 + listTasks/getTask 轮询带在途守卫 ✅(T5/T7/T8);P1 债 useDiskHotplug ✅(T1)。
- **只读边界**:recover/delete/replaceDisk/快照 全部显式排除并在 T9 加"无写按钮"回归测试 ✅。
- **在途守卫**:`loadRaid`(T3 布尔守卫)、状态重拉 & 任务轮询(T5 递归 setTimeout 单飞)三处均有 ✅。
- **类型一致**:`RaidArray`/`RaidTask`/`RaidStatus` 全程一致;`raidStatusMap` key 统一 `String(id)` ✅。
- **无占位符**:纯函数/composable/store 给完整代码;组件给完整契约 + 关键模板/样式 + 测试;级别文案值明确指示逐字转录源坐标(数据非逻辑)✅。
- **service 零改**:仅调既有 `service.raid` 只读方法,不碰 NimoOS-Service / dist rebuild ✅。
