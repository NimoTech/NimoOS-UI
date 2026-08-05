# Task 3 报告 —— `useVmList` 数据层

状态:完成(评审修复已并入,定向复审的新缺陷也已修复)。首轮 commit `376009a`,
评审修复 commit `48d6c63`,定向复审新缺陷修复 commit `201f626`。

## 行号核对(brief vs 实际)

逐段读了 `NimoOS-UI/src/components/KVM/KVMFullPage.vue` 当前版本,brief 的行号**普遍偏前几行到十几行**:

| 段落 | brief 行号 | 实际行号 |
|---|---|---|
| `sockets:` 选项 | 766-826 | 768-829 |
| `fetchVMs`/`fetchVM`/`setVMState` | 890-940 | 879-940(`fetchVMs` 从 879 起,`setVMState` 到 940 止) |
| `getErrMsg` | 836-839 | 841-844 |
| 电源动作(start/stop/restart/pause/resume/wakeup/delete) | 1520-1610 | 1530-1620 |
| `selectVM` | 1370 | 1369-1374 |

实现里的行号注释已全部按核对后的实际行号写(不是 brief 草稿的行号)。

## Step 1-2:写测试、确认失败

测试文件按 brief 逐字抄录(未改一行),写入 `src/kvm/composables/useVmList.test.ts`。

```
pnpm vitest run src/kvm/composables/useVmList.test.ts
```
输出:`Error: Failed to resolve import "./useVmList"` —— 0 test,如预期失败(FAIL,Step 2 达标)。

## Step 3:实现

写 `src/kvm/composables/useVmList.ts`。按 brief 要点实现:就地 `listEpoch`/`alive` 守卫(未抽公共 guard)、`connectCb`/`disconnectCb` 单回调槽、`errText` 剥 `[xxx]` 前缀、`restart` 只断开不重连并写了登记注释。

## Step 4:跑测试 —— 首轮暴露并修复了两个真实 bug

第一次跑测试(28 用例)有 **3 个失败**,不是测试有问题,是我的初版实现有两处真实 bug,系统性调试(单步推演微任务执行顺序)后定位并修复:

**Bug A —— `fetchVMs` 自动选中第一台时不应经过 `selectVM()`/`fetchVM()`。**
初版照抄 Vue2 的调用链(`fetchVMs` 自动选中→调用 `selectVM`→触发 `fetchVM`→打 `getVM()`)。问题:测试里 `api.getVM` 的默认 mock 返回值与 `getVMList` 返回的列表数据是不相关的两份 fixture(现实中两者应该一致,但 mock 不保证),而且这条链在“自动选中”这个分支里，会在调用方 `await fetchVMs()` 返回之后才完成合并（多一层微任务嵌套），造成：
  - 「后发先至」交错测试断言时,幕后还有一个未等待完的 `getVM()` 合并链条,把已经赋值的新鲜列表数据用不相关的默认 mock 覆盖掉。
  - 「start 失败时不改状态」测试里,`fetchVMs` 完成后 `selectedVM.value.state` 已被自动详情拉取的默认 mock(`state: 'running'`)悄悄覆盖,导致后续断言看到的不是 `getVMList` 里设的 `'stopped'`。

  修法:自动选中分支直接 `selectedVM.value = vms.value[0]`,不再额外打 `fetchVM`/`getVM`。**这是与 Vue2 的偏离,已在代码里登记注释**(见下方“已登记偏离”)。用户显式点选(`selectVM()`)仍然照 Vue2 触发 `fetchVM`/`getVM` 合并,未受影响。

**Bug B —— `fetchVM` 合并时把 `id` 字段也覆盖了。**
Vue2 `fetchVM`(:912-913 / :925-926)用 `$set` 逐字段覆盖但**显式跳过 `id`**(`if (key !== 'id')`)。我的初版直接 `vms.value[idx] = merged`(`merged` 来自 `preserveSpice(fresh, old)`,`fresh.id` 会覆盖掉原数组项的 `id`)。这在「选中后单独拉一次详情合并进列表」测试里暴露:`api.getVM` 的 mock 固定返回 `id:'b'`,导致数组里 `id:'vm-1'` 那一项被错误地改名成 `id:'b'`,产生重复 id,后续 `findIndex` 命中错了下标。
  修法:合并前用 `{ ...fresh, id: target.id }` 保留原 id,再 `preserveSpice`。

两处都改完后重跑:

```
pnpm vitest run src/kvm/composables/useVmList.test.ts
```
输出:`Test Files 1 passed (1)` / `Tests 28 passed (28)`。Step 4 达标。

## Step 5:变异验证(3 处,逐一做、逐一改回)

**变异 1 —— 删 `preserveSpice` 调用(`fetchVMs` 里 `oldSelected` 分支)**

```ts
selectedVM.value = fresh ? /* MUTATION 1: preserveSpice deleted */ fresh : null
```
跑测试:**28 个全绿,「刷新时保活 spicePort」没有翻红。**

这是一个需要如实报告的发现,不是我想蒙混过关:排查后确认是**测试自身 fixture 的一个盲点**,不是实现的缺陷——

- `beforeEach` 里 `api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })` 只在 `beforeEach` 执行时求值**一次**,之后每次调用 `getVMList()` 返回的都是**同一个对象引用**(`vi.fn().mockResolvedValue(v)` 语义等价于 `mockImplementation(() => Promise.resolve(v))`,不做深拷贝)。
- 测试里 `s.selectedVM.value!.spicePort = 5901` 直接修改的就是这个被 `vms.value[0]` 和 `selectedVM.value` 共享引用的同一个对象。
- 第二次 `await s.fetchVMs()` 拿到的“新数据”其实还是**同一个已经被手工改成 5901 的对象**——不是真的模拟了一次“后端吐 spicePort=0 的全新响应”。所以无论 `preserveSpice` 被删没删,`fresh === oldSelected`(同一个对象),`fresh.spicePort` 本来就已经是 5901,测试断言天然满足,压根没走到需要“保留旧值覆盖新值”的分支。
- 验证:我在推演后又反向确认——即便把 `fetchVMs` 改成对响应做防御性浅拷贝(`vms.value = res.data.map(v => ({...v}))`),这个测试依然不会翻红,因为浅拷贝发生在“已经被手工改过”的那次调用之后,拷贝的还是被污染的值。换句话说,**这个测试无法在当前 fixture 写法下检测 preserveSpice 是否被调用**,是 Step 1 测试代码本身的局限,不是 Task 3 实现的问题。

我没有修改这个测试(brief 要求逐字照用),`preserveSpice` 的纯函数正确性已经由 Task 1 的 `spicePreserve.test.ts` 独立覆盖过;`fetchVMs`/`fetchVM` 里确实在调用它(代码里可见),只是这条测试用例恰好测不出它被删掉。**如实登记这一条,供后续任务/评审知悉**,不算我这边未申报的偏离(实现没有偏离 brief 要点,只是测试判别力有盲区)。

删除操作已改回(确认 diff 干净):
```
selectedVM.value = fresh ? preserveSpice(fresh, oldSelected) : null
```

**变异 2 —— 删过期守卫**

```ts
const res = await service.kvm.getVMList()
// MUTATION 2: epoch guard deleted — if (!alive || myEpoch !== listEpoch) return
```
跑测试:**2 个失败**——
- `过期守卫 > 后发的 fetchVMs 先返回时,先发的迟到结果不得覆盖(交错路径)`:`expect(s.vms.value[0].name).toBe('fresh')` 处翻红(迟到的 `'stale'` 覆盖了 `'fresh'`)。
- `过期守卫 > dispose 之后到达的结果不再写入`:`expect(s.vms.value).toEqual([])` 处翻红(dispose 后到达的 `'late'` 数据被写入了)。

符合预期,守卫确实在起作用。已改回。

**变异 3 —— `restart` 里补一句立刻重连**

```ts
if (selectedVM.value?.id === v.id) {
  disconnectCb?.()
  connectCb?.(v) // MUTATION 3
}
```
跑测试:**1 个失败**——`电源动作 > restart 只断开、不立刻重连(修 Vue2 竞态,靠 vm_started 事件兜底)` 在 `expect(onC).not.toHaveBeenCalled()` 处翻红(`Number of calls: 1`)。

符合预期。已改回。

三次变异后都确认恢复到 28/28 全绿,再进入 Step 6。

## Step 6:全量 + 提交

```
pnpm test
```
输出尾部:
```
 Test Files  330 passed (330)
      Tests  2727 passed (2727)
     Errors  1 error
```
那 1 个 `Unhandled Rejection`(`service.users.avatarPath is not a function`,源自 `src/settings/views/SettingsPage.test.ts`)是任务交底里明确写的 P4 遗留缺陷,与本任务无关,未去碰 `src/settings/`。数字核对:基线 329 文件/2699 例 → 现在 330 文件/2727 例,恰好 +1 文件 +28 例(本任务新增测试数),**只增不减、零新增 failed**,符合硬约束。

```
pnpm exec vue-tsc --noEmit
```
无输出,类型检查通过。

`git status --short` 确认那 3 个 `design-export/*` staged 删除原封未动,只用显式 pathspec 提交了两个新文件:

```
git add src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts
git commit -m "feat(kvm): useVmList 数据层(事件驱动/spice 保活/电源动作/过期守卫)"
```
commit:`376009a`。

## 与 Vue2 的偏离(已在代码注释登记)

1. **`restart` 不再立刻重连 VNC**(brief 明确要求的修正)。Vue2 `restartVM`(:1557-1571)请求返回后立刻 `disconnectVNC()+connectVNC()`,VM 刚重启端口大概率未监听,导致 `vncError` 永久卡屏。改为只断开,重连交给 `kvm:vm_started` 事件兜底(后端确实发,`NimoOS-KVM/common/constants.go:17`)。
2. **`fetchVMs` 自动选中第一台不再触发 `fetchVM`/`getVM` 详情请求**(本次调试中新发现、必须做的偏离,已写入代码注释)。Vue2 `fetchVMs`(:898-899)自动选中时调用 `this.selectVM(this.vms[0])`,间接打一次 `getVM()`。但 `GET /v1/kvm/vms` 列表接口本身已返回完整的 `KvmVM` 字段(与 `GET /vms/:id` 同构),多打一次详情请求不仅冗余,还会在“自动选中”和“调用方 `await` 返回”之间制造一段调用方控制不到的额外异步窗口——两条测试(交错路径 / start 失败不改状态)都因这个窗口而失败,修正后即通过。用户显式点选(`selectVM()`)行为不变,仍然照 Vue2 触发详情合并。

## 自查发现并修正的其它问题

- `fetchVM` 合并时曾把目标对象的 `id` 字段一并覆盖成 `fresh.id`(违反 Vue2 `$set` 显式跳过 `id` 的语义),已修为 `{ ...fresh, id: target.id }` 再走 `preserveSpice`。

## 顾虑 / 交接项(首轮)

- ~~Step 5 变异 1 的测试判别力盲区~~ —— **已在评审修复轮解决,见下方追加章节**。
- `onVncShouldConnect`/`onVncShouldDisconnect` 是单回调槽,若后续 Task(ConsoleStage 之外)也想订阅需要升级为数组——目前按 brief 要求保持单槽。

---

# 评审修复追加(commit `48d6c63`)

评审认可实现主体(七个事件逐条一致、`errText` 正则同源、零 `setInterval`、`dispose()` 摘全订阅、注释行号抽查 7 处全准、两处已申报偏离均通过),但指出 4 条必修 + 1 条顺手。逐条记录如下,**每条修复后都用「删掉/删除相应实现代码 → 跑单测确认翻红 → 改回」的方式重新验证过判别力**,不是只解释就带过。

## 1(Critical)spicePort 保活测试原来测不出东西 —— 已修

**根因确认**:评审判断准确。`beforeEach` 里 `api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })` 只在调用时求值一次,之后每次调用 `getVMList()` 都返回**同一个对象引用**;测试第 79 行 `s.selectedVM.value!.spicePort = 5901` 直接改的就是这个共享对象,第二次 `fetchVMs()` 拿到的“新数据”其实还是那个已经被改过的旧对象——所以删不删 `preserveSpice` 结果都一样。

**修法**(按评审给的方案):在测试里第二次 `fetchVMs()` 之前插入
```ts
api.getVMList.mockImplementation(() =>
  Promise.resolve({ data: [VM({ spicePort: 0, spiceTlsPort: 0 })], total: 1 }))
```
让每次调用返回**新构造**的对象、`spicePort` 显式为 0。

**变异验证**(把 `useVmList.ts:68` 的 `preserveSpice(fresh, oldSelected)` 换成裸 `fresh`):
```
pnpm vitest run src/kvm/composables/useVmList.test.ts -t "刷新时保活"
```
实际输出:
```
AssertionError: expected +0 to be 5901 // Object.is equality
- Expected: 5901
+ Received: 0
 ❯ src/kvm/composables/useVmList.test.ts:90:43
```
翻红,且报的正是评审预告的 `expected +0 to be 5901`。改回后重跑该用例通过。

## 2(Important)`toggleAutostart` 第二条空测试 —— 已修

**根因确认**:`vm.autostart = next` 写在 `await service.kvm.setAutostart(...)` **之后**,失败时 `try` 块在 `await` 处就抛出、根本没走到那一行——`catch` 里 `vm.autostart = original` 面对的是从未被改过的值,是死代码(Vue2 :1516-1528 原样如此)。

**处理方式**:按“界面照 Vue2、逻辑照正确”,选评审指定的那条路——**删掉死代码**,不做“先乐观写、失败再改回”的真回滚(那会让开关先跳一下再弹回,是新的可见行为,违反界面 1:1)。测试标题和内部注释改成断言真实发生的事:失败后 autostart 维持原值(不是回滚生效)、`lastError` 被写入。

**变异验证**(删掉 catch 分支里 `lastError.value = errText(...)` 这一行):
```
pnpm vitest run src/kvm/composables/useVmList.test.ts -t "toggleAutostart"
```
实际输出:
```
AssertionError: expected '' to be truthy
- Expected: true
+ Received: ""
 ❯ src/kvm/composables/useVmList.test.ts:325:31
```
翻红。改回后重跑通过。

## 3(Important)过期守卫覆盖不全 —— 已修

在 `runAction`(电源动作公共模板)、`toggleAutostart`、`remove`、`ejectInstallMedia` 四处的 `await` 之后各补一句 `if (!alive) return`(全部就地写,没有抽公共 guard 函数)。同时补了一条交错用例:动作在途时调 `dispose()`,断言迟到结果不写 `selectedVM.state`、不触发 `connectCb`。

**变异验证**(删掉 `runAction` 里的 `if (!alive) return`):
```
pnpm vitest run src/kvm/composables/useVmList.test.ts -t "dispose 后,在途的电源动作"
```
实际输出:
```
AssertionError: expected 'running' to be 'stopped' // Object.is equality
Expected: "stopped"
Received: "running"
 ❯ src/kvm/composables/useVmList.test.ts:147:39
```
翻红(迟到的 `start` 成功结果在 dispose 后仍然把 state 写成了 running)。改回后重跑通过。

## 4(Important)`ejectInstallMedia` 丢了 Vue2 的重入守卫 —— 已修

补上等价于 Vue2 `handleInstallationFinished`(:862-864)`if (!vm || this.finishingInstall) return` 的重入守卫,复用现成的 `processing` 集合当标记位(评审建议的方案),不新开状态。补了一条用例:动作在途时再调用一次,断言 `setBootFromDisk` 只被调用一次。

**变异验证**(删掉 `if (processing.value.has(vm.id)) return`):
```
pnpm vitest run src/kvm/composables/useVmList.test.ts -t "ejectInstallMedia 重入守卫"
```
实际输出:
```
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
 ❯ src/kvm/composables/useVmList.test.ts:353:33
```
翻红。改回后重跑通过。

## 5(Minor,顺手)

- 删掉了 `useVmList.ts:72-79` 注释里站不住的半句(“避免自动选中和调用方 await 之间出现额外异步窗口”)。Vue2 的 `fetchVMs` 本身是非 async 的 `.then()`,那次 `selectVM` 调用同样是 fire-and-forget、同样有窗口,这句站不住。保留的理由只有一条:后端 `ListVMs`/`GetVM` 字段集完全同构,再打一次详情请求纯属冗余往返(已在注释里补了具体的后端文件行号 `vm_service.go:245`/`:270`)。
- `fetchVM` 补了一个独立的 `vmFetchEpoch` 代际守卫(与 `listEpoch` 各管一段,没有合并成公共 guard),防止连点多台 VM 时先发但迟到的详情响应覆盖后发已经写好的数据。补了一条用例:先选 vm-1(慢)、再选 vm-b(快),断言 vm-b 的详情正确落地;vm-1 的迟到详情到达后不覆盖列表数据。

**变异验证**(把 `fetchVM` 里的 `if (!alive || myVmEpoch !== vmFetchEpoch) return` 改成只剩 `if (!alive) return`):
```
pnpm vitest run src/kvm/composables/useVmList.test.ts -t "fetchVM 过期守卫"
```
实际输出:
```
AssertionError: expected 'stale-a-detail' not to be 'stale-a-detail' // Object.is equality
 ❯ src/kvm/composables/useVmList.test.ts:165:37
```
翻红。改回后重跑通过。

## 修复轮验证汇总

```
pnpm vitest run src/kvm/
```
```
Test Files  6 passed (6)
     Tests  67 passed (67)
```
（本文件用例数从 28 → 31,新增 3 条:eject 重入守卫、dispose 时在途电源动作、fetchVM 代际守卫。）

```
pnpm test
```
```
Test Files  330 passed (330)
     Tests  2730 passed (2730)
    Errors  1 error
```
数字核对:修复前一轮是 330 文件/2727 例,现在 330 文件/2730 例,+3 与本轮新增用例数一致,唯一的 1 个 `Unhandled Rejection` 仍是 `SettingsPage.test.ts` 的 P4 遗留缺陷(`service.users.avatarPath is not a function`),未去碰 `src/settings/`。

```
pnpm exec vue-tsc --noEmit
```
无输出,通过。

`git status --short` 确认改动只落在 `src/kvm/composables/useVmList.ts` 和 `useVmList.test.ts` 两个文件,3 个 `design-export/*` staged 删除原封未动。用显式 pathspec 提交:
```
git add src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts
git commit -m "fix(kvm): useVmList 评审修复 —— ..."
```
commit:`48d6c63`。

## 顾虑 / 交接项(修复轮后)

- ~~无新增顾虑~~ —— **定向复审在这轮修复的 diff 里逮到一处新缺陷,已修复,见下方追加章节**。原「单回调槽」交接项仍然有效(见首轮章节)。

---

# 定向复审新缺陷修复追加(commit `201f626`)

复审对上一轮(commit `48d6c63`)做了定向复审:确认 5 条全部 ADDRESSED、4 个变异复审者亲手重做过都按预期翻红、`toggleAutostart` 的死回滚确认是真删干净(不是只改了测试)。但在**这轮修复本身引入的 diff** 里逮到一处新问题:

## `ejectInstallMedia` 的重入守卫复用了共享的 `processing` Set

**问题**:`useVmList.ts` 里 `ejectInstallMedia` 用 `if (processing.value.has(vm.id)) return` 判重,但 `processing` 是 `runAction`(电源动作)/`toggleAutostart`/`remove` **共用**的、只按 `vm.id` 去重、**不区分动作类型**的状态。Vue2 的 `finishingInstall`(KVMFullPage.vue:862 附近)是一个独立标志,不与电源动作共享状态。

两个方向的后果:
1. 电源动作(start/stop/pause/...)在途时,`processing` 里已经有这个 vm id;此时点“我已安装完成”会被误判成“已在进行”直接 `return`,`setBootFromDisk` 根本不发,还**不写 `lastError`**——用户点了没反应,且完全静默查不出原因。
2. 反过来,任一电源动作的 `finally { processing.value.delete(vm.id) }` 会在 `ejectInstallMedia` 仍在途时提前把 id 移除,导致重入守卫本身失效。

复审亲手验证:`start()` 挂起时调 `ejectInstallMedia()`,`api.setBootFromDisk` 被调用 **0 次**。

**修法**:给 `ejectInstallMedia` 一个**独立**的重入标记,不复用 `processing`——新增模块内部变量
```ts
// ejectInstallMedia 自己的重入标记 —— 不与 processing 共用,不需要响应式(没有 UI 消费它),
// 纯内部去重用途。
const ejectingIds = new Set<string>()
```
`ejectInstallMedia` 改用 `ejectingIds.has(vm.id)` / `ejectingIds.add/delete(vm.id)`,注释里写清楚为什么不能共用 `processing`(见代码内注释,内容同上面两条后果)。恢复了 Vue2 `finishingInstall` 本来就是独立标志、不与电源动作共享状态的语义。

**补的两条用例**:
- 「电源动作在途时调用 ejectInstallMedia,setBootFromDisk 照常被调用(不跨动作误拦)」
- 「eject 在途时电源动作走完清了 processing,eject 的重入守卫依旧生效」

原有「eject 在途时再点一次不发第二次请求」的用例保持不动、继续绿。

## 变异验证(两次,均贴实际输出)

**变异 A —— 把新的独立守卫（`ejectingIds` 的判重 + add + delete）整个删掉**,确认原有「在途时再点一次不发第二次请求」翻红:
```
pnpm vitest run src/kvm/composables/useVmList.test.ts -t "在途时再点一次不会发第二次请求"
```
实际输出:
```
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
 ❯ src/kvm/composables/useVmList.test.ts:353:33
```
翻红。改回后重跑通过。

**变异 B —— 把守卫改回复用 `processing`**(即复审逮到的原缺陷),确认新增的两条「不跨动作误拦」用例翻红:
```
pnpm vitest run src/kvm/composables/useVmList.test.ts -t "不复用 processing"
```
实际输出(两条都红,且现象与复审描述一致):
```
FAIL ejectInstallMedia 不复用 processing:电源动作在途时调用,setBootFromDisk 照常被调用(不跨动作误拦)
AssertionError: expected "vi.fn()" to be called with arguments: [ 'vm-1', true ]
Number of calls: 0
 ❯ src/kvm/composables/useVmList.test.ts:366:33

FAIL ejectInstallMedia 不复用 processing:eject 在途时电源动作走完清了 processing,eject 的重入守卫依旧生效
Error: Test timed out in 5000ms.
 ❯ src/kvm/composables/useVmList.test.ts:371:3
```
第一条与复审预告的"setBootFromDisk 被调用 0 次"完全吻合。第二条不是断言失败而是**超时**——复现原因:两次 `ejectInstallMedia` 都会真正调用 `service.kvm.setBootFromDisk`(因为 `processing` 被 `stop()` 的 `finally` 提前清空,守卫没拦住第二次调用),而测试的 `mockImplementation` 每次调用都会把 `resolveEject` 重新指向"当次调用"的 resolver——第二次调用把它覆盖掉了,导致测试代码里 `await` 第二次调用时永远等不到（当时还没执行到调用 `resolveEject()` 那一行),于是挂死超时。这本身就是复用 `processing` 会产生的连锁效应的一种表现形式,同样判定为翻红有效。改回独立 `ejectingIds` 后重跑两条都通过。

## 验证汇总

```
pnpm vitest run src/kvm/
```
```
Test Files  6 passed (6)
     Tests  69 passed (69)
```
（本文件用例数 31 → 33,新增 2 条。）

```
pnpm test
```
```
Test Files  330 passed (330)
     Tests  2732 passed (2732)
    Errors  1 error
```
数字核对:上一轮 330 文件/2730 例,这轮 330 文件/2732 例,+2 与本轮新增用例数一致。唯一 1 个 `Unhandled Rejection` 仍是 `SettingsPage.test.ts` 的 P4 遗留缺陷,未去碰 `src/settings/`。

```
pnpm exec vue-tsc --noEmit
```
无输出,通过。

`git status --short` 确认改动只落在 `useVmList.ts`/`useVmList.test.ts`,3 个 `design-export/*` staged 删除原封未动。显式 pathspec 提交:
```
git add src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts
git commit -m "fix(kvm): ejectInstallMedia 重入守卫改用独立标志,不再复用共享 processing"
```
commit:`201f626`。

## 顾虑 / 交接项(定向复审修复后)

- 无新增顾虑。原「单回调槽」交接项仍然有效。
