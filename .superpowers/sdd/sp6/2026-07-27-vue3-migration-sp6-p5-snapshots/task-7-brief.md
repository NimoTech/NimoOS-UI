### Task 7: 接进 RAID 详情页 + 收尾门

把面板填进 `StorageRaidDetail.vue` 左栏的 `<!-- 快照面板 P5 -->` 占位处,并锁死两件事:**卷 UUID 正确传入**、**快照端点 404 不影响详情页其余部分**。

**Files:**
- Modify: `src/views/StorageRaidDetail.vue`(`:184`)
- Modify: `src/views/StorageRaidDetail.test.ts`

**Interfaces:**
- Consumes: `SnapshotPanel`(T3–T5);详情页已有的 `array.uuid`(`raidView.asRaidArray` 保证是 string,缺失为 `''`)。

- [ ] **Step 1: 写失败测试**(追加到 `StorageRaidDetail.test.ts`)

先在该文件顶部的 `vi.mock('@nimotech/nimoos-service', …)` 工厂里补 snapshot 域(现有 mock 只有 storage/disks/raid,不补会在挂载时抛 `Cannot read properties of undefined`):
```ts
const snapListVolumes = vi.fn().mockResolvedValue([])
const snapList = vi.fn().mockResolvedValue([])
// …在 vi.mock 工厂的 service 对象里加:
//   snapshot: { listVolumes: (...a: unknown[]) => snapListVolumes(...a),
//               list: (...a: unknown[]) => snapList(...a),
//               getPolicy: vi.fn().mockResolvedValue({}), patchPolicy: vi.fn(),
//               togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn() },
```
用例:
```ts
it('左栏挂载快照面板,并按本阵列 uuid 查卷', async () => {
  snapListVolumes.mockResolvedValue([{ volume_uuid: 'u-7', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z' }])
  await router.push('/storage/raid/7'); await router.isReady()
  const store = (await import('../storage/stores/storage')).useStorageStore()
  await store.loadRaid()
  const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
  expect(w.findComponent({ name: 'SnapshotPanel' }).exists()).toBe(true)
  expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
})

it('快照端点 404 → 面板落"不支持"态,详情页其余内容照常渲染', async () => {
  snapListVolumes.mockRejectedValue(new Error('404'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  await router.push('/storage/raid/7'); await router.isReady()
  const store = (await import('../storage/stores/storage')).useStorageStore()
  await store.loadRaid()
  const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
  expect(w.find('.sp-unsupported').exists()).toBe(true)
  expect(w.text()).toContain('md7')          // 阵列名还在
  expect(w.text()).toContain('/dev/sda')     // 成员列表还在
  expect(w.find('.rd-delete').exists()).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认失败** → FAIL(面板未挂载)。

- [ ] **Step 3: 实现接线**

`StorageRaidDetail.vue`:
```ts
import SnapshotPanel from '../storage/components/SnapshotPanel.vue'
```
把 `:184` 的 `<!-- 快照面板 P5 -->` 换成:
```vue
          <SnapshotPanel :volume-uuid="array.uuid ?? ''" />
```
> `SnapshotPanel` 需 `defineOptions({ name: 'SnapshotPanel' })`(测试用 `findComponent({ name })` 定位);若 T3 未加,在此补上。

- [ ] **Step 4: 收尾门(全部要跑,贴输出)**

```bash
pnpm test                                   # 全量,全绿
pnpm exec vue-tsc --noEmit                  # 零错
pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
pnpm build                                  # dist 重建
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5273/app/   # 期望 200
```
5273 常驻预览挂了就重起:
```bash
cd /home/nimo/NimoTech/.sp6/NimoOS-New-UI && nohup pnpm exec vite preview --host > ../preview-5273.log 2>&1 &
```

- [ ] **Step 5: Commit**

```bash
git add src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts
git commit -m "feat(storage): RAID 详情页挂载快照面板(P5 T7)"
```

---

## 收尾门(所有 Task 完成后)

1. `pnpm test` 全量全绿 + `pnpm exec vue-tsc --noEmit` 零错 + color-guard(零裸色)+ parity(键对齐)。
2. `pnpm build` 重建 dist;5273 常驻 vite preview 自动伺服新哈希(curl 核对 `index-*.js` 哈希与 dist 一致)。
3. **可眼验的**(单盘设备):`/storage/raid` 空态、详情页路由本身;**不可眼验的**:快照面板本体(需 ≥2 盘 btrfs 阵列 + 新后端)——按用户 2026-07-27 拍板,**以单测 + 整支终审为准,面板眼验挂账**。
4. 整支终审(Opus,base = P4 关账 `cc5adf0` + 本计划 commit)→ Ready to merge 判定后关账。**禁区**:不部署、不合并、不改 roadmap(P6)。

## Ledger 挂账(收尾写进 `.superpowers/sdd/progress.md`)

1. **文件区快照套件整体未迁(新登记,SP4 遗留缺口)**:`SnapshotBanner.vue` / `SnapshotTimeWheel.vue`(621 行)/ `SnapshotActionBar.vue` / `SnapshotSettingsModal.vue` / `snapshotBrowse.js` / `snapshotStackMath.js` + `FilePanel.vue`/`ContextMenu.vue` 里的只读浏览分支 + `service/snapshot.js` 六个路径纯函数 + 后端 `GET /v2/snapshot/file-versions` + `POST /v2/snapshot/restore`。**因此时间线的 [浏览] 按钮本期缺席**。建议作为独立一期(SP6-P5b 或并入文件区后续期)。
2. **后端未部署**:设备 `nimoos-local-storage` 仍是 2026-06-22 版,`/v2/snapshot/*` 全 404;P5 代码走优雅降级(面板显示"不支持")。部署时机由用户定。
3. **快照卷 == RAID 阵列**(后端 `currentVolumes()` = `VolumesFromRAIDArrays`):单盘设备无阵列 → 无快照卷,面板无法实盘验收,随多盘设备与 P3/P4 一并补。
4. **Vue2 bug 已修正不照抄**:`savePolicy` 后摘要显示 `undefined`(后端 PUT 返回 `data:null`,Vue2 把信封当策略对象)。New-UI 用刚保存的表单值合并本地 policy。
5. **有意偏离**:slot+`refreshSignal`+`@deleted` 三段式 → store 直连;校验错误文案从"英文原文当键"→ 具名 i18n key;`b-switch`/`b-numberinput`/`$buefy.dialog.confirm` → 手写开关 / 原生 number input / 共享 `Dialog`;manual 类别色由紫改 `--accent`、preop 由琥珀改 `--dem-fg`(主题 token 化的必然结果)。
6. **`service.snapshot.restore()` 与 `updatePolicy()` 本期无调用方**(restore 属文件区;updatePolicy 只经 `patchPolicy` 间接使用)——不是死代码,是下一期的接口面。

---

## 附录 A:P5 新增 i18n key(zh_cn / en_us 双写)

| Task | key | zh_cn | en_us |
|---|---|---|---|
| T2 | `snapToggleOn` | 已开启快照保护 | Snapshot protection enabled |
| T2 | `snapToggleOff` | 已关闭快照保护 | Snapshot protection disabled |
| T2 | `snapToggleFailed` | 快照保护设置失败 | Failed to update snapshot protection |
| T2 | `snapPolicySaved` | 快照计划已更新 | Snapshot schedule updated |
| T2 | `snapPolicySaveFailed` | 快照计划更新失败 | Failed to update snapshot schedule |
| T2 | `snapCreated` | 快照已创建 | Snapshot created |
| T2 | `snapCreateFailed` | 快照创建失败 | Failed to create snapshot |
| T2 | `snapDeleted` | 快照已删除 | Snapshot deleted |
| T2 | `snapDeleteFailed` | 快照删除失败 | Failed to delete snapshot |
| T3 | `snapTitle` | 快照保护 | Snapshot Protection |
| T3 | `snapUnsupported` | 此卷的文件系统不支持快照 | This volume's filesystem does not support snapshots |
| T3 | `snapDisabledHint` | 自动为此卷创建快照,可随时恢复到过去的某个时间点 | Automatically snapshot this volume so you can restore from an earlier point in time |
| T3 | `snapNoneYet` | 暂无快照 | No snapshots yet |
| T3 | `snapNever` | 从未 | Never |
| T3 | `snapStatus` | 已有 {n} 个快照 · 最近 {time} | {n} snapshots so far · last at {time} |
| T3 | `snapPaused` | 快照保护已暂停:{reason}。请释放此卷空间或调低保留数量以恢复自动快照。 | Snapshot protection paused: {reason}. Free up space on this volume or lower the retention counts to resume automatic snapshots. |
| T3 | `snapKept` | 关闭保护后,已有快照仍会保留 | Existing snapshots are kept when protection is turned off |
| T3 | `snapPolicySummary` | 每小时快照:保留 {hourly} · 每天:保留 {daily} · 每周:保留 {weekly} | Hourly snapshots: keep {hourly} · Daily: keep {daily} · Weekly: keep {weekly} |
| T4 | `snapAdvanced` | 高级设置 | Advanced settings |
| T4 | `snapHourlyKeep` | 每小时保留数 | Hourly keep count |
| T4 | `snapDailyKeep` | 每天保留数 | Daily keep count |
| T4 | `snapWeeklyKeep` | 每周保留数 | Weekly keep count |
| T4 | `snapPauseThreshold` | 卷使用率超过多少时暂停(%) | Pause when volume usage exceeds (%) |
| T4 | `snapErrPositiveInt` | 必须是大于 0 的整数 | Must be a positive whole number |
| T4 | `snapErrPercent` | 必须是 1 到 100 之间的整数 | Must be a whole number between 1 and 100 |
| T4 | `snapSave` | 保存 | Save |
| T4 | `snapCreateNow` | 立即创建快照 | Create Snapshot Now |
| T4 | `snapLabelPlaceholder` | 可选备注(例如:升级前) | Optional note (e.g. before upgrade) |
| T5 | `snapHistory` | 快照历史 | Snapshot History |
| T5 | `snapEmptyHint` | 创建第一个快照,开始积累可恢复的历史 | Create your first snapshot to start building a restore history |
| T5 | `snapToday` | 今天 | Today |
| T5 | `snapYesterday` | 昨天 | Yesterday |
| T5 | `snapTypeAuto` | 自动 | Auto |
| T5 | `snapTypeManual` | 手动 | Manual |
| T5 | `snapTypePreop` | 操作前保护 | Pre-op protection |
| T6 | `snapDelete` | 删除 | Delete |
| T6 | `snapDeleteTitle` | 删除快照 | Delete Snapshot |
| T6 | `snapDeleteMsg` | 仅删除 {time} 的这个快照,你当前的文件不受影响。 | This deletes only the snapshot from {time}. Your current files are not affected. |

> 「取消」复用 P2 已有的 `storageCancel`,不新增。

## 附录 B:Vue2 源文件坐标(逐字核对用)

- `NimoOS-UI/src/service/snapshot.js`:纯函数 `:1-137`(迁)、`:139-230` 路径函数(**不迁**)、`:232-284` API 对象(已在 P0 进包)。
- `NimoOS-UI/src/components/Storage/raid/SnapshotPanel.vue`:模板 `:1-105`、逻辑 `:107-257`、样式 `:259-303`。
- `NimoOS-UI/src/components/Storage/raid/SnapshotTimeline.vue`:模板 `:1-50`、逻辑 `:52-179`、样式 `:181-362`。
- `NimoOS-UI/src/components/Storage/raid/RaidDetailPanel.vue:80-89`:面板与时间线在 Vue2 里的挂载与接线(slot + refreshSignal + @deleted)。
- 后端:`NimoOS-LocalStorage/route/snapshot.go`(`:71-78` 路由表、`:300-336` PUT policy 返回 `data:nil`、`:133-143` `currentVolumes()` = RAID 阵列)。
