# SP6-P5 终审修复波报告

Base `e32e74e` → Head `2ffb128`(单 commit:`fix(storage): 快照 store 复位+换卷 watcher+过期响应守卫(P5 终审修复波)`)

整支终审(Opus,base `cc5adf0`)判 **With fixes**,列 7 项。本波一次性改完。

## 逐条

| # | 条目 | 落点 | 覆盖测试 |
|---|---|---|---|
| 1 | **Critical C1** 单例 store 无复位 + 面板无 `watch(volumeUuid)` → 换阵列时显示 A 的状态却对 B 发写请求 | `snapshot.ts:35-43` 新增 `reset()`(清 volume/policy/snapshots,两个 loading 打回 `true`,清两个 request 守卫);`SnapshotPanel.vue:46-47` `onMounted` 与 `watch(() => props.volumeUuid)` 都先 `reset()` 再 `loadVolume` | `SnapshotPanel.test.ts:87-123`(切到 B 后不残留 A 的开关/数量、B 重新拉卷;B 也是 enabled 时 `getPolicy` 以 B 重新调用)、`snapshot.test.ts` reset 语义用例 |
| 2 | **Important I2** `loadVolume`/`loadSnapshots` 无过期响应守卫 | `snapshot.ts:52/55/61/67`(volume)、`:81/85/88/92`(list):await 前认领 uuid,响应/异常回来若守卫已变则整段丢弃,`finally` 里也只有守卫仍匹配才释放 loading | `snapshot.test.ts:287-301`、`:323-335`(A 的慢响应不得覆盖 B 已落地的数据/列表) |
| 3 | **台账 7** 空 uuid 会去 `find(v => v.volume_uuid === '')` 误命中 | `snapshot.ts:46-51` 早退:不发请求、`volume=null`、释放 loading | `snapshot.test.ts:280-286`(断言 `listVolumes` 未被调用) |
| 4 | **台账 3 升级** 缺 `disabled→enabled` 接缝测试 | — | `SnapshotPanel.test.ts:124-133`(点开关后 `getPolicy` 恰好一次、以该 uuid) |
| 5 | **Important I1** 删除弹窗"失败不关闭"是未披露偏离 | `SnapshotTimeline.vue:29-32` 注释登记(行为不变:Vue2 buefy 点确认即关、失败只 toast;我们失败留在原地可重试) | 行为既有用例已覆盖 |
| 6 | **顺手** `.st-browse` 空断言(该选择器从未存在) | — | `SnapshotTimeline.test.ts:200-206` 换成 `expect(w.findAll('.st-actions button')).toHaveLength(1)` |
| 7 | **顺手** `openAdvanced` 的 `Number()` 包裹无理由说明 | `SnapshotPanel.vue:61-62` 补注释(后端可能回数字字符串,不归一会被 `Number.isInteger` 误判非法) | — |

## 控制方自行改的一行(已交复审并判定正确)

`SnapshotPanel.test.ts` `beforeEach` 补 `togglePolicy.mockResolvedValue(undefined)`。
原因:上一条「切换在途」用例用 `mockImplementation` 把它换成永不 resolve 的 promise,而 `vi.clearAllMocks()` **只清调用记录、不还原实现**,泄漏到新增的接缝测试 → toggle 永不完成 → 状态不跃迁 → `getPolicy` 0 次。复审判定:修法正确,未削弱「切换在途」用例(它在自己体内重新 `mockImplementation`)或其它用例。

## 证据

```
$ pnpm exec vitest run src/storage src/views/StorageRaidDetail.test.ts src/i18n/parity.test.ts src/styles/color-guard.test.ts
 Test Files  28 passed (28)
      Tests  379 passed (379)

$ pnpm test
 Test Files  246 passed (246)
      Tests  1505 passed (1505)

$ pnpm exec vue-tsc --noEmit
tsc exit=0 零错

$ pnpm build   → ✓ built in 13.27s,入口 dist/assets/index-CSbH2ajJ.js
$ curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5273/app/   → 200
$ 伺服 HTML 引用 assets/index-CSbH2ajJ.js == dist/index.html 引用,一致
```

**真回归自检**:临时把 `SnapshotPanel.vue:47` 的 `watch(() => props.volumeUuid, …)` 换成注释 → `SnapshotPanel.test.ts` **3 条转红**(25 中 3 失败);恢复后 25 全绿。文件已由备份还原,`TEMP-REGRESSION-CHECK` 标记计数为 0。

## 范围化复审结论(sonnet,base e32e74e → head 2ffb128)

7 条全部 **ADDRESSED**,新破坏 **none**。核查过:`reset()` → `volumeLoading=true` → 面板收起 → 内嵌 `SnapshotTimeline` 卸载重挂的时序与它自己的 volumeUuid watcher 不打架(无重复/丢失 `loadSnapshots`);过期响应守卫在 `reset()` 清空后能让在途响应必然判为过期;`StorageRaidDetail.vue` 及其测试本波未触碰,P3/P4 写按钮不变式不受影响;零字面色、无新 i18n 键、catch 只记 message、无 `.at()`、只动 New-UI 仓。

**残留(非阻塞,记台账)**:`onMounted` 里的 `reset()` 缺专属回归测试 —— 每个用例都从新的 `createPinia()` 起步,单删 `onMounted` 里那句 reset 现有测试不会红(`watch` 路径有测)。功能正确,仅覆盖缺口。
