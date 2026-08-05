# Task 2 报告:快照 store(`src/storage/stores/snapshot.ts`)

## TDD 证据

### RED

Step 1 测试文件逐字采用 brief 内容,创建后先跑:

```
$ pnpm exec vitest run src/storage/stores/snapshot.test.ts
...
Error: Failed to resolve import "./snapshot" from "src/storage/stores/snapshot.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

失败原因:`./snapshot` 尚不存在。符合预期(store 不存在)。

### GREEN

实现 `src/storage/stores/snapshot.ts`(逐字采用 brief Step 3 给出的实现),加 9 个 i18n 键到
`zh_cn.ts`/`en_us.ts` 后:

```
$ pnpm exec vitest run src/storage/stores/snapshot.test.ts
 Test Files  1 passed (1)
      Tests  17 passed (17)

$ pnpm exec vitest run src/i18n/parity.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ pnpm exec vue-tsc --noEmit
(无输出,零错)

$ pnpm test
 Test Files  243 passed (243)
      Tests  1456 passed (1456)
```

全量测试通过,无既有测试被破坏。

## 文件改动

- 新增 `src/storage/stores/snapshot.ts` — `useSnapshotStore` setup-store,7 个 action(`loadVolume`/`loadPolicy`/`loadSnapshots`/`toggle`/`savePolicy`/`createSnapshot`/`removeSnapshot`)+ 9 个 state ref,与 brief Produces 接口逐字一致。
- 新增 `src/storage/stores/snapshot.test.ts` — brief Step 1 给出的测试,逐字采用,17 个用例全绿。
- 修改 `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` — 紧跟 `raidCreateConfirmOk` 之后插入 9 个新键:`snapToggleOn/Off/Failed`、`snapPolicySaved/SaveFailed`、`snapCreated/CreateFailed`、`snapDeleted/DeleteFailed`。两文件同步加,`parity.test.ts` 绿。

## 请求形状核对(对照 `node_modules/@nimotech/nimoos-service/dist/snapshot.d.ts`)

- `listVolumes()`、`list(volumeUuid)`、`getPolicy(volumeUuid)`、`togglePolicy(volumeUuid, enabled)`、`create(data)`、`patchPolicy(volumeUuid, patch)`、`remove(name, volumeUuid)` —— 签名与共享包声明逐一核对一致,未改共享包。
- `create` body:有备注 `{volume_uuid, label}`(trim 后非空才带 label);无备注仅 `{volume_uuid}`,测试断言 `Object.keys(...) === ['volume_uuid']`,锁死不出现 `label: ''`/`label: undefined` 这类残留键。
- `savePolicy` 一律走 `patchPolicy(uuid, {...form})`(读-改-写),未拼过任何 PUT 全量 body。
- `remove(name, uuid)` 参数顺序按共享包声明(name 在前),测试锁死不可颠倒。

## 每一处对 Vue2 的偏离(逐字登记)

1. **savePolicy 不照抄 Vue2 的 bug(brief 已指出的那一处)**:Vue2 `SnapshotPanel.savePolicy` 把 `patchPolicy` 响应的整个信封赋给 `this.policy`(`res.data?.data || res.data`),但 `NimoOS-LocalStorage` 的 `PUT /v2/snapshot/policy` 实际返回 `data: null`,导致 Vue2 保存后摘要行显示"保留 undefined"。本实现改为:保存成功后用**刚写入的表单值**与旧 `policy` 合并(`{ ...(policy.value ?? {}), ...form }`),不再依赖响应体。已在代码内以注释登记(`snapshot.ts` savePolicy 内的 `⚠️ Vue2 bug 不照抄`注释),测试 `后端 PUT 返回 null 时,本地 policy 用刚保存的表单值` 锁死该行为。

2. **createSnapshot/removeSnapshot 的刷新触发方式,由父子组件信号改为 store 内直接调用**:Vue2 中 `SnapshotPanel.createSnapshot` 成功后只 `fetchVolume()`(自己的卷摘要),时间线的刷新靠父组件把 `refreshSignal`(基于 `count`/`last_at` 的字符串信号)传给 `SnapshotTimeline` 的 prop,后者 watch 到变化后自己 `fetchSnapshots()`;`SnapshotTimeline.doDelete` 成功后则是反向 `$emit('deleted', item)` 冒泡给父组件,父组件再更新自己的卷摘要。Vue3 版把 store 变成两侧数据的唯一持有者,不再需要这层组件间信号 —— `createSnapshot` 成功后直接 `Promise.all([loadVolume(uuid), loadSnapshots(uuid)])`;`removeSnapshot` 成功后直接 `loadVolume(uuid)`。行为等价(两侧最终都会刷新),只是省掉了一层字符串信号/事件冒泡,原因是 store 架构本身消除了这个必要性,不是逻辑改动。已在代码注释中说明。

3. **策略表单校验(`validatePolicyForm`)与 `manualLabel` 状态不在本 store 内**:Vue2 `SnapshotPanel` 把 `policyForm`/`fieldErrors`/`advancedOpen`/`manualLabel` 等 UI 状态和 `validatePolicyForm` 校验调用都放在组件里,`savePolicy()` 方法内部先校验再决定是否发请求。本 task 的 brief 接口把 `savePolicy(uuid, form)` 定义为纯网络层 action(不做表单校验、不管理表单/校验错误 UI 状态),校验函数 `validatePolicyForm` 已在 T1(`snapshotView.ts`)提供为纯函数,留给 T3–T6 组件层在调用 store 前先校验。这不是本 task 引入的偏离,而是 brief 明确划的组件/store 边界,此处仅记录以便 T3–T6 实现者知悉需要在组件里接上校验。

4. **i18n toast 文案从英文原文改为具名 key**:Vue2 里 `$t("Snapshot protection enabled")` 这类调用直接把英文原文当 key(靠 vue-i18n 的 fallback/相同 key 机制)。New-UI 现有约定(`storage.ts`/`raidView.ts`/`snapshotView.ts` 均如此)一律用短具名 key(如 `snapToggleOn`),该约定在 T1 里已作为"偏离 3"登记过,本 task 延续同一约定,不重复视为新偏离,仅顺带说明。

无其它对 Vue2 逻辑的偏离;`toggle` 失败回滚到"切换前的值"(`!enabled`)、`fetchPolicy`/`loadPolicy` 失败置 null、`loadSnapshots` 非数组响应归一空数组、各 action 的单飞守卫(在途重入直接返回 false/undefined,不重复发请求)均逐字照 Vue2 语义实现。

## 自查(simplify 角度)

- 未做无关重构:未触碰 `storage.ts`/`raidView.ts`/`snapshotView.ts` 等既有文件(除新增 i18n 行)。
- 未修改 `@nimotech/nimoos-service` 包或 `node_modules`。
- 日志只记 `(e as Error)?.message`,未打印整个 error 对象(测试 `JSON.stringify(warn.mock.calls)` 断言不含 `config`/密文字段)。
- 单飞守卫(`toggling`/`policySaving`/`creatingSnapshot`/`deletingName`)均在 `try/finally` 内正确复位,测试覆盖了并发第二发被吞、失败后守卫复位两类场景。

## Commit

```
64183c4(示例占位,见下方实际输出) feat(storage): 快照 store 六 action + 守卫 + 请求形状单测锁死(P5 T2)
```
(实际 SHA 见下方回复)

---

## Fix round 1(评审反馈:spec ❌)

**Finding**:`src/i18n/zh_cn.ts:715-723` 里 6 个 toast 键的中文值与 brief 附录 A 的 T2 行不一致(`parity.test.ts` 只校验键名,未校验值,故未曾变红)。附录 A 原文是绑定约束,必须逐字采用。

**改法**:只改这 6 个键的中文值,不动 en_us(评审确认已全对)、不动 `snapPolicySaved`/`snapCreated`/`snapDeleted`(评审确认已正确)。

| key | 改前 | 改后(附录 A 原文) |
|---|---|---|
| snapToggleOn | 快照保护已开启 | 已开启快照保护 |
| snapToggleOff | 快照保护已关闭 | 已关闭快照保护 |
| snapToggleFailed | 更新快照保护状态失败 | 快照保护设置失败 |
| snapPolicySaveFailed | 更新快照计划失败 | 快照计划更新失败 |
| snapCreateFailed | 创建快照失败 | 快照创建失败 |
| snapDeleteFailed | 删除快照失败 | 快照删除失败 |

改动文件:仅 `src/i18n/zh_cn.ts`(6 行字符串替换)。

**验证命令与输出**:

```
$ pnpm exec vitest run src/i18n/parity.test.ts src/storage/stores/snapshot.test.ts
 Test Files  2 passed (2)
      Tests  20 passed (20)

$ pnpm exec vue-tsc --noEmit
(无输出,零错)
```

`snapshot.test.ts` 17 例 + `parity.test.ts` 3 例,共 20 例全绿,与改动前数量一致(store 逻辑本身未动,i18n 值改动不影响 store 测试因该测试用 `t: (k) => k` 的 mock,不读真实文案)。

**未处理事项(评审已记台账,非本轮范围)**:「日志不带整个 error」的断言目前只覆盖 `loadVolume` 一处(`toggle`/`savePolicy`/`createSnapshot`/`removeSnapshot` 四处 catch 未独立断言同一约束),评审判定为 Minor 且已记台账,本轮不改。

**Commit**:`fix(i18n): 快照 toast 中文文案对齐计划附录 A(P5 T2)`(SHA 见下方回复)。
