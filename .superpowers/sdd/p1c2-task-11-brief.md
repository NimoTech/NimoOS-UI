### Task 11: `SystemTab`(实时指标 + 存储条)

**Files:** Create `src/ai/components/tabs/SystemTab.vue` + `.test.ts`;Modify `src/ai/views/AgentPage.vue` + `.test.ts`、`src/i18n/{zh_cn,en_us}.ts`

**用户拍板的有意偏离**:Vue2 是 `mounted` 一次性拉 `/sys/utilization` 且不刷新;本期**复用 New-UI 现成的实时通道** `useUtilization()`(首帧 HTTP + MessageBus `nimoos:system:utilization` 持续推送)。因此:
- 2×2 磁贴的数值改从 `useUtilizationStore()` 的 `data` 取。Vue2 `metrics` computed(`:38-53`)读的是**原始 payload 形状**(`sm.cpu.percent[0]`、`sm.mem.used/total`、`sm.net[0].speed`、`sm.cpu.temperature`)——先读 `@nimotech/nimoos-service` 导出的 `Utilization` 类型与 `parseUtil`,**按包里的真实字段接**,并把取值+格式化抽成纯函数 `systemTiles(data)` + 单测(4 个磁贴的 label/value/sub,含缺字段时的 `'—'` 兜底,与 Vue2 一致)。
- **存储条**:Vue2 `Agent.vue:221-239` 的 `toStoragePayload` 逐字港成纯函数(汇总各盘 `size`/`used` → TB;非数组/空/总量 0 → `null` 触发"存储信息不可用"空态;`breakdown[0].color` 是**字符串 `'var(--accent)'`** —— 这个 token 间接层必须保留,`StorageCard` 会把它写进 inline background)。数据源 = Task 1 的 `service.disks.list()`,在 `AgentPage.onMounted` 里**一次性**拉(与 Vue2 同,存储容量不需要实时)、`try/catch` 吞错置 `null`。
- 组件里 `useUtilization()` 的挂载/卸载订阅由 composable 自己管;**注意 SystemTab 是 `v-else-if` 条件渲染**(切 tab 会卸载/重挂),要确认 `useUtilization` 的 `onMounted`/`onUnmounted` 在这种反复挂载下行为正确(它每次挂载会 `fetchOnce` + 订阅,卸载时退订 —— 可接受;在报告里写明)。
i18n:`aiSysHeader`("NimoOS · Health")、`aiSysCpu/Memory/Network/Temp`、`aiSysLan`、`aiSysOf`("of {n} GB")、`aiStorageUnavailable`。

- [ ] **Step 1: 写失败测试**:纯函数 6 例(4 磁贴正常值 / cpu.percent 缺失落 `'—'` / mem 换算 GB);`toStoragePayload` 4 例(正常汇总 / 非数组 → null / 空数组 → null / 总量 0 → null);组件 3 例(有 storage 渲染 StorageCard 且 breakdown 颜色是 `var(--accent)` 字符串 / 无 storage 出空态 / 磁贴随 store 数据变化而更新)。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑测试 + tsc + 零裸色 grep + parity 绿。**
- [ ] **Step 5: Commit** `SP8-P1c2: SystemTab (live utilization + storage card)`

---

