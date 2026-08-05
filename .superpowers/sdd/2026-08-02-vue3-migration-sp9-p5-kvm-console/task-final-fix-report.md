# SP9-P5 全分支终审 —— 必修修复报告

范围:全分支终审提的 2 条必修 + 6 条清理,一次性收尾。工作树:主工作树 `master`,
起点 `49b6ff3`。

---

## 必修①:Vue2 成功 toast 全部丢了

**根因**:Vue2 六个电源动作(start/stop/restart/pause/resume/wakeup)+
`toggleAutoStart` + `deleteVM` + `handleInstallationFinished`(eject)成功时都会弹
`this.$buefy.toast.open({type:'is-success'})`。`useVmList.ts` 的注释一直说"toast 是
视图层的事",但 `KvmPage.vue` 的 `onAction`/`onEjectFinish` 从未接过——未申报的偏离。
最要命的是 `⋮ → 自动启动` 变成零反馈操作(`toggle-indicator` 圆点只在菜单内部,菜单关闭
后页面上再无任何变化)。

**修法**:

1. `useVmList.ts` 的七个动作函数(`start/stop/restart/pause/resume/wakeup/
   toggleAutostart/remove`)的返回类型从 `Promise<void>` 改成 `Promise<boolean>`——
   `true`=这次调用成功,`false`=失败或 dispose 后短路。理由与 `ejectInstallMedia` 的
   既有返回值契约(评审二轮修复,消除"串味")完全一致:`lastError` 是多个动作共用的单一
   ref,await 结束后再去读它有被并发操作污染的风险;返回值天然只属于"这次调用"。
   `ejectInstallMedia` 自己的 `Promise<string>` 契约未改动(已被上一轮评审核准,继续
   保留)。
2. `KvmPage.vue` 的 `onAction()`/`onEjectFinish()` 是唯一的 toast 消费点,复用仓库既有
   的全局 `useToast()`(`src/stores/toast.ts`),成功时 `toast.show(...)`,失败时维持
   原有的 lastError 内联展示(不动,按任务说明的红线)。
3. 新增 i18n 键(两个分片同步):`kvmToastStarted/Stopped/Restarted/Paused/Resumed/
   Deleted`、`kvmAutoStartOn/Off`、`kvmEjectSuccess`(恢复此前被判死键删除的键)。全部
   逐字对照 Vue2 `zh_CN.json`:`started`(:872)/`stopped`(:873)/`restarted`(:866)/
   `paused`(:228)/`resumed`(:870)/`deleted`(:862)/`On`(:818)/`Off`(:817)/
   `Installation media ejected...`(:1815)。
4. 核对过 Vue2 源码确认 `wakeupVM`(:1603)成功也用 `resumed`,不是单独的"已唤醒"文案
   ——不是笔误照抄,已在代码与 i18n 注释里写明依据。

**测试**:`useVmList.test.ts` 里的行为不变(返回值改动没有破坏任何既有断言,新加的
交错测试见必修②);`KvmPage.test.ts` 新增 `describe('KvmPage 必修①:成功 toast')`
共 6 条用例,覆盖 start / pause+resume+restart / autostart 两态 / delete / eject
成功 / 失败不弹 toast。**变异验证**:手动删掉 autostart 分支的 `toast.show(...)` 调用,
对应用例精确翻红(`expected [] to include 'sp9-alpine-test 自动启动 开'`);验证完
已还原。

---

## 必修②:restart 的 VNC 重连竞态(HTTP 响应 vs kvm:vm_started 事件谁先到)

**根因**(已用 `Agent`/`Read` 核对后端源码坐标,非猜测):`NimoOS-KVM/service/
vm_service.go:575-583` 的 `RestartVMWithForce = StopVM + StartVM`,两者各自
`go PublishVMEvent`(:566 / :535)——`kvm:vm_started` 事件与 restart 的 HTTP 响应几乎
同时发出,**顺序未定**。原实现("restart 只 disconnect,重连交给 vm_started 事件兜底")
隐含假设"HTTP 响应必然先到",一旦事件先到:

1. `kvm:vm_started` 处理器 → `connectCb?.()` 建好新连接;
2. 随后 restart 的 HTTP 响应才到 → `onSuccess` 无条件 `disconnectCb?.()` → 把刚建好的
   连接拆掉;
3. `vm_started` 只发一次,此后不会再有事件触发重连 → **永久黑屏,只能重选 VM 自救**。

**修法(方案 a——协调标记,理由见下)**:新增非响应式的 `restartPending: Set<string>`
(与既有 `ejectingIds` 同写法,就地一个 Set,不抽公共 guard,符合项目"异步写共享
state 必带过期守卫,就地写不抽象"的既有约定):

- `restart()` 一进入就把 `vm.id` 记进 `restartPending`。
- `onSuccess` 只在 `restartPending.has(v.id)`(说明 `vm_started` 事件还没到、没人抢先
  重连过)时才 `disconnectCb?.()`;事件已抢先重连的情况下什么都不做,保留事件建立的
  连接。
- `kvm:vm_started` 处理器里,只要真的重连了(`selectedVM.value?.id === id`),就把
  `id` 从 `restartPending` 里删掉,告诉 restart 的 onSuccess"不用你再断开了"。
- `restart()` 的 `finally` 里无条件 `restartPending.delete(vm.id)`,避免残留。

两种到达顺序都收敛到"最终连着"这个正确状态:HTTP 先到 → 照旧断开、靠后到的事件重连
(不变);事件先到 → onSuccess 什么都不做,不拆刚建好的连接。

**为什么选方案 (a) 而不是 (b)/(c)**:
- (b)(disconnect 后按 `state==='running'` 延时补一次 connect)引入了一个新的定时器
  和"要等多久"的猜测,而且如果事件恰好在这个延时窗口内也到达,还是会有两次
  connect 竞争,复杂度更高、不能从根本上消除竞态。
- (a) 不引入定时器,只是让"谁该负责断开"这件事有一个明确的仲裁者(先到先得——事件
  先到就不用 onSuccess 管了),和现有的 `ejectingIds`/`processing`/各种 epoch 计数器
  是同一种"就地小状态协调"手法,风格统一、心智负担最小。

**测试**:`useVmList.test.ts` 新增一条回归测试,精确卡住"事件先到、HTTP 响应后到"这个
交错顺序(不是顺序调用):`restartVM` 挂起 → 先 `emit('kvm:vm_started', ...)` 断言
`onC` 已调用一次(事件已建连)→ 再 resolve HTTP 响应 → 断言 `onD` **没有**被调用(连接
没有被拆)。**变异验证**:把 `if (restartPending.has(v.id) && ...)` 改回原来的
`if (selectedVM.value?.id === v.id)`(即去掉协调判断),新用例精确翻红
(`expected "vi.fn()" to not be called at all, but actually been called 1 times`);
验证完已还原。

---

## 清理(六条)

1. **i18n 死键家族**:删除 `kvmFailedStart/Stop/Restart/Pause/Resume/Delete/Autostart`
   共 7 个键(两个分片同步)——与 `kvmFailedToXxx` 家族逐字同值,而 `useVmList.ts` 的
   `errText()` fallback 实际只引用 `kvmFailedToXxx`,前者是死键(`grep` 核实过零消费方)。
   保留 `kvmFailedToXxx`(实际被引用的那套)。
2. `kvmSettingsDisabledHint` 加注释:P6 预埋键,当前无消费方,不是遗漏/死代码(两个
   分片同步)。
3. 三处过时占位图标注释(`KvmPage.vue` 的 `‹`/`▭`、`VmSidebar.vue` 的 `⬚`)统一改成
   `SendKeyToolbar.vue:73-75` 的措辞("等统一换真图标那批一起收"),不再声称
   "后续任务(T4/T8)换图标"(T4/T8 早完成且没换)。
4. `kvm.css` 文件头注释订正:不再写"P5 本任务(Task 2)只搭地基……其余段留给后续任务,
   实现体本任务不写"——console-/sendkey-/spice-/banner 系列早在 T5-T8 全部实现
   (465-1153 行),注释是 Task 2 刚搭地基时写的旧状态,过期未更新。
5. `kvmStyles.test.ts` 白名单的 `sendkey-btn--fullscreen` 核实后**保留**并加注释——
   它确实在 `SendKeyToolbar.vue:106` 作为真实 class 使用(测试选择器钩子,用来把全屏
   按钮和其它 `.sendkey-btn` 区分开),只是没有专属 CSS 规则(复用基类样式),不是死
   条目。
6. `OverflowMenu.vue` 的 `defineExpose({ reset })` 已确认无外部消费方(T5 评审把
   `ConsoleHeader` 里的调用删掉后就没人再调了,只剩 `OverflowMenu.test.ts` 自己的单测在
   调)—— YAGNI 残留,已删除 `defineExpose`(`reset()` 保留为内部函数,`confirmThenEmit`/
   `direct` 仍要用),连带删掉那条只为它存在的测试。`ConsoleHeader.vue` 里引用这件事
   的旧注释也一并订正。

---

## 收尾验证(全部跑过,数字如下)

```
pnpm vitest run src/kvm/                                     → 15 文件 / 202 例 passed
pnpm test                                                     → 339 文件 / 2874 例 passed
                                                                 (1 个已知 P4 遗留 Errors,非本期引入,见下方说明)
pnpm exec vue-tsc --noEmit                                    → 零错误
pnpm build                                                    → 通过
pnpm vitest run color-guard/theme.sp9/kvmStyles/i18n-parity   → 196 例全绿
grep 确认 kvmFailedXxx 死键零消费方                              → 确认
```

`pnpm test` 非零退出码仍是 P4 遗留缺陷(`SettingsPage.test.ts` 缺 `avatarPath` mock,
`src/settings/` 完全没碰),数字口径按台账既有约定——看例数不看退出码。基线 339 文件/
2868 例 → 本轮 339 文件/2874 例(+6:必修①新增 6 条 KvmPage 测试;必修②新增 1 条
useVmList 测试;清理项6 删除 1 条 OverflowMenu 死测试;合计 +6+1-1=+6)。

---

## 变更文件清单

- `src/kvm/composables/useVmList.ts`(必修①返回值契约 + 必修②restartPending 协调)
- `src/kvm/composables/useVmList.test.ts`(必修②回归测试)
- `src/kvm/views/KvmPage.vue`(必修①toast 消费 + 清理项3 注释订正)
- `src/kvm/views/KvmPage.test.ts`(必修①toast 测试 6 条 + pinia 装配)
- `src/kvm/components/VmSidebar.vue`(清理项3)
- `src/kvm/components/ConsoleHeader.vue`(清理项6 关联注释订正)
- `src/kvm/components/OverflowMenu.vue`(清理项6:去掉 `defineExpose({ reset })`)
- `src/kvm/components/OverflowMenu.test.ts`(清理项6:删对应死测试)
- `src/kvm/styles/kvm.css`(清理项4)
- `src/kvm/styles/kvmStyles.test.ts`(清理项5)
- `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`(必修①新增键 + 清理项1/2)

## 顾虑(留给机主/后续期）

- `onEjectFinish` 把 `ejectInstallMedia` 返回 `''` 一律当"成功"处理弹 toast——正常
  路径下 `ejectBusy` 已经挡住了重入,所以 `''` 唯一的另一种可能是组件已卸载(dispose
  后短路),这种情况下弹不弹 toast 都没有观众,不影响正确性,但严格说不是"确认成功"
  才弹,是"没有确认失败"就弹。为了不破坏已被上一轮评审核准的 `ejectInstallMedia`
  返回值契约(`''`=成功/被重入挡下/dispose 短路三态合一),没有引入新的返回形状去
  精确区分这三种情况——按 YAGNI 与"不做无关重构"的红线处理,留痕于此。
