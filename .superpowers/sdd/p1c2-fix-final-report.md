# P1c-2 终审修复 pass —— 报告

Base = `035e25c`,提交 = `650b2ad`(分支 `sp8-ai`)。

## 逐 fix 改动

### F1(Important）—— 无 id 授权资源的 × 分流

- `src/ai/components/tabs/ResourcesTab.vue:80-93`(emits 声明处）：`defineEmits` 新增
  `remove-resource-by-path`（载荷 `path: string`），注释引 Vue2 `tabs/ResourcesTab.vue:21`
  + `dispatchEvent.ts:310-314` + `agentStore.ts:488`，说明流式注入资源无 id 的成因，并点名与
  `AgentComposer.removeChip()`（`AgentComposer.vue:555-565`）同款处理。
- `ResourcesTab.vue:143-157`（新增 `onRemoveResource()` 函数）：按 **`r.id !== undefined`**
  分流 —— 有 id 走 `emit('remove-resource', r.id)`；无 id 走
  `emit('remove-resource-by-path', r.path)`。分流后各分支类型自然收窄，去掉了原来的
  `r.id as string | number` 断言。
- `ResourcesTab.vue` 模板（原 :155，现约 :171）：`@click="emit('remove-resource', r.id as
  string | number)"` → `@click="onRemoveResource(r)"`。
- `src/ai/components/shell/AgentRightPanel.vue`：`defineEmits` 新增
  `remove-resource-by-path`（:70 附近），模板里 `<ResourcesTab>` 新增
  `@remove-resource-by-path="emit('remove-resource-by-path', $event)"`（原 6 个 emit 透传
  旁边），并顺带把文件头 / 模板处两条写死"6 个 emit"的旧注释补了一句说明现在是 7 个。
- `src/ai/views/AgentPage.vue`：`<AgentRightPanel>` 挂载处新增
  `@remove-resource-by-path="(path) => store.removeVisibleResourceByPath(path)"`，紧邻
  `@remove-resource` 处理器，写法与相邻 6 个处理器一致（内联箭头，理由同文件里已有的
  "Vue3 裸方法引用会被 vnode 固化"注释）。`removeVisibleResourceByPath` 是 agentStore.ts 里
  T5（1c-1）已经造好的既有 action（`agentStore.ts:549`），本次未新增/未改动 store 代码
  （store 文件不在白名单内，也确认不需要改）。

### F2（Minor）—— `isRevertingItem` 守卫申报

`ResourcesTab.vue:130-135`：在 `isReverting`/`isRevertingBatch`/`isRevertingItem` 上方注释
里补了一段：申报 `isRevertingItem` 比 Vue2:232 多出的 `stagedId !== undefined &&` 守卫，
说明运行时等价（`reverting['item:undefined']` 键永不存在），純防御性显式化，**未改代码行为**
（`stagedId !== undefined && !!props.reverting['item:' + stagedId]` 这行本身逐字未动）。

### F3（Minor）—— `systemTiles.ts` 类型收窄申报

`src/ai/util/systemTiles.ts` 文件头注释追加一段，申报 `mem.used`/`mem.total`/
`cpu.temperature` 三处 `typeof x === 'number'` 收窄（对应 Vue2 SystemTab.vue 的
`!= null` 判空），说明两者在当前后端契约下等价、但若后端未来发字符串数字会分叉
（Vue2 会渲染，本仓落 `—`），并明确"收窄本身是对的，只是之前没写进申报清单"。
**代码行的判断逻辑本身一行未改**（第 41/42/47 行 `typeof === 'number'` 保持不变）。

### F4（Minor）—— 删同义反复断言

`src/ai/components/shell/AgentRightPanel.test.ts`：删掉
`expect(() => mountPanel()).not.toThrow()`（原 :178），紧邻的
`expect(Object.keys(mountPanel().props()).length).toBe(11)` 真断言保留，加了一行注释
说明删除理由。

---

## F1 判别力自检 —— RED / GREEN 真实输出

把 `ResourcesTab.vue` 里的分流条件从 `r.id !== undefined` 临时改成真值判断 `r.id`，
只跑 `id: 0` 那条新增用例：

**RED（`if (r.id)`）：**

```
 ❯ src/ai/components/tabs/ResourcesTab.test.ts (24 tests | 1 failed | 23 skipped) 41ms
     × resource with id: 0 (legitimate falsy id) × emits remove-resource with payload 0, not remove-resource-by-path 39ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ai/components/tabs/ResourcesTab.test.ts > ResourcesTab — authorized resources section (new) > resource with id: 0 (legitimate falsy id) × emits remove-resource with payload 0, not remove-resource-by-path
AssertionError: expected undefined to be truthy

- Expected:
true

+ Received:
undefined

 ❯ src/ai/components/tabs/ResourcesTab.test.ts:202:42
    200|     const removeButtons = w.findAll('.rt-x')
    201|     await removeButtons[0].trigger('click')
    202|     expect(w.emitted('remove-resource')).toBeTruthy()
       |                                          ^
    203|     expect(w.emitted('remove-resource')![0]).toEqual([0])
    204|     expect(w.emitted('remove-resource-by-path')).toBeFalsy()

 Test Files  1 failed (1)
      Tests  1 failed | 23 skipped (24)
```

改回 `r.id !== undefined` 后：

**GREEN：**

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI

 Test Files  1 passed (1)
      Tests  1 passed | 23 skipped (24)
   Start at  13:18:13
   Duration  896ms (transform 393ms, setup 178ms, import 369ms, tests 25ms, environment 214ms)
```

---

## 三道门 —— 真实尾巴

### `pnpm test`（全量）

第一次全量跑时 `src/files/upload/persist.test.ts`（不在白名单内，未被本次改动触碰）
出现 1 例失败（`dropPersisted removes record + blob and frees budget`，IndexedDB 相关的
断言错误）。单独跑该文件两次均全绿；重新跑一次全量 `pnpm test` 也全绿——判定为并行执行下
跨测试文件共享 fake IndexedDB 导致的既有 flaky，与本次 7 个白名单文件的改动无关。

最终确认尾巴（第二次全量跑）：

```
> nimoos-new-ui@ test /home/nimo/NimoTech/.sp8/NimoOS-New-UI
> vitest run


 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI

 Test Files  259 passed (259)
      Tests  1866 passed (1866)
   Start at  13:19:44
   Duration  59.58s (transform 14.22s, setup 45.11s, import 63.68s, tests 25.63s, environment 113.30s)
```

（基线 259 files / 1862 tests；本次新增 4 条测试 = 1866，文件数不变，符合预期。）

### `pnpm exec vue-tsc --noEmit`

```
(无输出，退出码 0)
```

### `pnpm build`

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 11.82s
```

（只有既有的 500KB chunk 警告，符合门的允许范围。）

---

## `git show --stat HEAD`

```
commit 650b2ad2a754cafbab15e8068770166e231b09bc
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 13:21:37 2026 +0800

    SP8-P1c2 fix: route id-less authorized resources through removeVisibleResourceByPath, declare 2 narrowings

 src/ai/components/shell/AgentRightPanel.test.ts | 12 +++++++++-
 src/ai/components/shell/AgentRightPanel.vue     |  9 ++++++-
 src/ai/components/tabs/ResourcesTab.test.ts     | 28 ++++++++++++++++++++++
 src/ai/components/tabs/ResourcesTab.vue         | 32 +++++++++++++++++++++++--
 src/ai/util/systemTiles.ts                      |  8 +++++++
 src/ai/views/AgentPage.test.ts                  | 23 ++++++++++++++++++
 src/ai/views/AgentPage.vue                      |  5 +++-
 7 files changed, 112 insertions(+), 5 deletions(-)
```

---

## 新申报的偏离清单

本次除 F1-F4 明确要求的申报外，无其它未申报偏离。附带做的、超出 brief 逐字要求但仍在白名单
文件内的小动作，如实列出：

1. **`AgentRightPanel.vue` 两处旧注释更新（非功能性）** —— 文件头"ResourcesTab 的 6 个
   emit"和模板处"7 个 prop + 6 个 emit"两条旧注释，各追加一句说明现在多了第 7 个 emit
   `remove-resource-by-path`。纯注释维护（避免旧注释与新增 emit 数量对不上造成误导），
   不涉及任何运行时代码或结构性重构。
2. **`AgentPage.vue` Task 13 注释块的"7 个事件"计数更新** —— 同上，补一句注明新增第 8 个
   事件及其处理器写法与相邻处理器一致，纯注释，不改代码行为。

以上两处均为紧邻本次改动位置的注释准确性维护，未触及 brief 未提及的任何逻辑/结构，也未修改
白名单外的文件。
