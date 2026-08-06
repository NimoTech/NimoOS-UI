# P1c-2 终审修复 pass —— 1 Important + 3 Minor

Base = `035e25c`(HEAD,分支 `sp8-ai`)。仓库 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`。
来源:opus 全支线终审(范围 `3614196..035e25c`)。

## 文件白名单(只许动这些)

```
src/ai/components/tabs/ResourcesTab.vue
src/ai/components/tabs/ResourcesTab.test.ts
src/ai/components/shell/AgentRightPanel.vue
src/ai/components/shell/AgentRightPanel.test.ts
src/ai/views/AgentPage.vue
src/ai/views/AgentPage.test.ts
src/ai/util/systemTiles.ts
```

**共享 worktree 铁律**:绝不 `git add -A` / `git add .`,一律按显式路径 stage。
不许动 `agentStore.ts`、`tokens.scss`、`agent-styles.scss`、i18n、Service 仓、Vue2 老仓。

## 移植纪律

界面/视觉/交互 = 严格 1:1 照 Vue2;逻辑 = 按正确的来,但**每处偏离都要**①代码注释引 Vue2 行号
②报告申报。未申报的偏离本身即缺陷(本期已三次栽在这)。禁与需求无关的重构。

包管理器 **pnpm**。**绝不碰真机**(不跑 `deploy.sh`、不写 `/var/lib`)。

---

## F1(Important)—— 右栏授权段的 × 对无 id 资源发坏请求,且未申报

**已核实的事实,不必再论证:**

- `visibleResources` 里有两种来源:`loadVisibleResources()` 从服务端整表覆盖(**带真 id**),以及
  `appendVisibleResource({path, kind})`(`agentStore.ts:488`)—— 后者由流式事件
  `visible_resource_added` 触发(`src/ai/services/dispatchEvent.ts:310-314` 只塞 `{path, kind}`,
  与 Vue2 `agentStream.js:539-542` 一致),**没有 id**。
- `ResourcesTab.vue:155` 现在写的是 `@click="emit('remove-resource', r.id as string | number)"`。
  那个 `as` 断言把 `undefined` 硬转成非空类型 → `AgentPage` 侧 `store.removeVisibleResource(undefined)`
  → `DELETE .../visible-resources/undefined` 失败 → 因为右栏 7 个处理器都没有 catch(与 Vue2 同),
  **用户点 × 什么都不会发生、无任何提示**,只在 console 留一条 unhandled rejection。
- **本期 T5 已经为 composer 的 chip × 修过同一个坑**:见 `AgentComposer.vue:540-568` 的
  `removeChip()` —— 按 `c.id !== undefined` 分流,无 id 走 `store.removeVisibleResourceByPath(c.path)`
  (该 store 动作正是 T5 为此新造的:先拉服务端列表拿真 id,拿到就按 id 删,服务端已无该项就只清本地)。
  **右栏授权段漏了这一处。** 那段注释本身把理由写得很清楚,先去读它。

**要做的:**

1. `ResourcesTab.vue`:`defineEmits` 追加一个 `remove-resource-by-path`(载荷 `path: string`)。
   授权段的 × 按 **`r.id !== undefined`** 分流 —— **必须用 `!== undefined`,不能用真值判断**
   (`id === 0` 是合法 id,必须走 id 分支;composer 那边已经是这么写的)。去掉那个 `as string | number`
   断言(分流之后类型自然收窄,不需要断言)。
2. `AgentRightPanel.vue`:把新事件透传出去(它现在透传 ResourcesTab 的 6 个 emit,变 7 个)。
3. `AgentPage.vue`:新事件接 `store.removeVisibleResourceByPath(path)`,写法与相邻 6 个处理器保持一致。
4. **注释**:在 `ResourcesTab.vue` 分流处写清楚 —— Vue2 `tabs/ResourcesTab.vue:21` 无条件传 `r.id`,
   对流式注入的无 id 资源会打 `/visible-resources/undefined`;此处按项目「逻辑照正确」纪律分流,
   与 `AgentComposer.removeChip`(1c-1 挂账票 1 的还款)同款处理。
5. **测试**:
   - `ResourcesTab.test.ts`:带 id 的资源点 × → emit `remove-resource` 且载荷是那个 id;
     **无 id** 的资源点 × → emit `remove-resource-by-path` 且载荷是 path、且**没有**发出
     `remove-resource`。另加一条 `id: 0` 的资源 → 必须走 `remove-resource`(载荷 `0`),
     这条专门钉住"不能用真值判断"。
   - `AgentRightPanel.test.ts`:新事件的透传断言。
   - `AgentPage.test.ts`:集成断言打到 `store.removeVisibleResourceByPath`。
   - **判别力自检**:把分流条件从 `!== undefined` 改成真值判断(`r.id ?`),你的 `id: 0` 用例必须变红;
     跑一次看到红、改回、再看到绿,**把两段真实输出贴进报告**。本期已三次抓到空转断言。

**不要做的**:不要给右栏 7 个处理器加 toast/catch。Vue2 那边右栏也是直接接 store 动作、无人接
rejection(`agentStore.js:754/773/788/799/812/830` 同样无 try),这属于台账已登记的跨期 Minor
(T13②),不在本次范围。本次只修"正常路径发坏请求"这一件事。

## F2(Minor)—— `isRevertingItem` 多出的 undefined 守卫未申报

`ResourcesTab.vue:126` 的 `isRevertingItem` 带了 `stagedId !== undefined &&` 守卫,Vue2 `:232` 没有
(它会去查 `reverting['item:undefined']`)。运行时等价(那个键永不存在),防御也可取,但该函数上方的
注释写的是"三种键命名空间,逐字照抄",与实际不符。补一行注释申报这处多出来的守卫即可,**不要改代码行为**。

## F3(Minor)—— `systemTiles.ts` 的类型收窄未申报

`src/ai/util/systemTiles.ts:47-53`:Vue2 `tabs/SystemTab.vue` 的 `metrics` computed 用 `!= null` 判
`mem.used` / `mem.total` / `cpu.temperature`,这里改成了 `typeof === 'number'`。后端若某天发字符串数字,
Vue2 会渲染、本仓落 `—`。该文件头注释只申报了 `cpu.percent` 那处缺陷修复,这三处收窄没提。
**补进头注释的申报清单,不要改代码行为**(收窄本身是对的:字段类型声明就是 number)。

## F4(Minor)—— 删掉同义反复断言

`AgentRightPanel.test.ts:178` 的 `expect(() => mountPanel()).not.toThrow()` 是同义反复(同步挂载不会抛,
异步 rejection 也不经这里)。删掉即可 —— 紧跟其后的 props 计数断言才是真断言,不要一并删。

---

## 门(全部要跑,报真实尾巴)

```
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      # 全量!基线 259 files / 1862 tests
pnpm exec vue-tsc --noEmit
pnpm build                     # 只允许既有 500KB chunk 警告
```

⚠️ **必须跑全量 `pnpm test`,不许只跑 `src/ai/` 子集** —— 本期正因子集跑法漏掉了
`src/styles/color-guard.test.ts`,让它连红了三个提交。

## 提交

`git status --short` 确认无白名单外文件被 stage,按显式路径 stage,提交:

`SP8-P1c2 fix: route id-less authorized resources through removeVisibleResourceByPath, declare 2 narrowings`

然后 `git show --stat HEAD` 贴进报告。

## 报告

写 `.superpowers/sdd/p1c2-fix-final-report.md`,中文:逐 fix 的改动(file:line)、F1 的 RED/GREEN
真实输出、三道门的真实尾巴、`git show --stat HEAD`、以及你新申报的偏离清单。
