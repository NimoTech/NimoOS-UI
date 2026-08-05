# Task 3 报告:PhotosToolbar.vue 补 after-tabs 槽位

## 实现了什么

在 `src/photos/components/PhotosToolbar.vue` 模板里,`.tabs` 结束的 `</div>` 与
`<div style="flex:1"></div>` 之间插入具名插槽 `<slot name="after-tabs" />`,并附上简报给定的
出处注释(回源 Vue2 `NimoOS-UI src/views/Photos/PhotosToolbar.vue:15-16`,记录 P1 task-7-brief
当年的 scope cut 与本期回改)。

同时把 `<script setup>` 顶部那句 P1 scope-cut 注释,从

```
// P1 scope cut (task-7-brief.md): no EXIF-filter `after-tabs` slot, no icon
// library — tabs/density buttons render as plain text with i18n labels.
```

订正为简报给定的:

```
// P1 scope cut (task-7-brief.md): no icon library — tabs/density buttons render as
// plain text with i18n labels. (`after-tabs` 槽位已由 SP7-P7b-T3 补回。)
```

组件其余部分(script 逻辑、其他模板、`<style>`)一行未动。

## 测了什么、结果如何

只跑了简报点名的两处:
- `pnpm exec vitest run src/photos/components/__tests__/PhotosToolbar.test.ts` —— 6/6 通过(4 条 P1 既有用例 + 2 条本任务新增)。
- `pnpm exec vue-tsc --noEmit` —— exit 0,无输出。

未跑 `pnpm test` 全量(按用户本轮明确指示,全量留到整期收尾统一跑)。

## TDD 证据

**RED**

命令:
```
pnpm exec vitest run src/photos/components/__tests__/PhotosToolbar.test.ts
```
实现前(只加了测试,`PhotosToolbar.vue` 还没插槽)的失败输出:
```
FAIL  src/photos/components/__tests__/PhotosToolbar.test.ts > P7b-T3: after-tabs 槽位 > 传入的槽位内容渲染在 .tabs 之后、计数与密度按钮之前
Error: Unable to get [data-test="after-tabs-probe"] within: <div data-v-712bbeef="" class="photos-toolbar">
  <div data-v-712bbeef="" class="tabs">...</div>
  <div data-v-712bbeef="" style="flex: 1 1 0%;"></div><span ...>3 项</span>
  <div data-v-712bbeef="" class="density">...</div>
</div>
 ❯ src/photos/components/__tests__/PhotosToolbar.test.ts:63:21 (w.get('[data-test="after-tabs-probe"]'))
Tests  1 failed | 5 passed (6)
```
符合预期:第二条新用例 FAIL,原因正是探针节点不存在(组件还没渲染 `after-tabs` 插槽内容),第一条新用例(不传槽位不多渲染)本就顺带通过——这与简报"Expected: 第二条 FAIL"一致。

**GREEN**

命令:
```
pnpm exec vitest run src/photos/components/__tests__/PhotosToolbar.test.ts && pnpm exec vue-tsc --noEmit
```
实现后输出(连续跑 3 次核对无告警残留):
```
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
`vue-tsc --noEmit` exit 0,无任何输出。

## 改了哪些文件、每个文件动了几行

- `src/photos/components/PhotosToolbar.vue`:+6/-2(改 1 行注释拆成 2 行 + 插入 4 行插槽标记与注释)。
- `src/photos/components/__tests__/PhotosToolbar.test.ts`:+31/-0(补 `i18n`/`mountToolbar` 助手 8 行 + 简报给定的 2 条新用例 23 行,原有 4 条用例一字未动)。

`git commit dd8f8b7`:`2 files changed, 37 insertions(+), 2 deletions(-)`。

## 自查发现

1. **测试文件顶部既有写法里没有 `mountToolbar()` 助手,也没有 `i18n`/`createI18n` 导入**(该文件此前的 4 条用例全部用裸 `mount(PhotosToolbar, {props})`,没有显式挂载 i18n 插件,靠 `vitest.setup.ts` 里的全局 `config.global.plugins` 兜底)。按简报授权的自由度,补齐时抄了同目录 `PhotosFilterBar.test.ts`(本期 Task 2 产物)的既有约定:`const i18n = createI18n({ legacy:false, locale:'zh_cn', messages:{ zh_cn: zh } })` + `global: { plugins: [i18n] }`。这是"抄既有写法"而非新发明约定。

2. **一处虚惊,已排查清楚**:RED 阶段跑测试时,第二条新用例(当时必然失败)会在 stderr 打出
   `[Vue warn]: Component "i18n-t" has already been registered in target app.` /
   `Directive "t" has already been registered in target app.` 等 6-7 行 Vue 警告。追查后确认:
   这是 `@vue/test-utils` 把 `vitest.setup.ts` 全局装好的 i18n 插件与该用例显式传入的本地 `i18n`
   实例合并挂到同一个 app 上(`mergeGlobalProperties` 无条件拼接两个插件数组),vue-i18n 的
   `install()` 对两个不同插件实例各自调用 `app.component`/`app.directive` 导致重名警告——**只在
   该用例仍处于失败(RED)状态时出现,一旦补上插槽实现使该用例转绿,警告随之消失**(实测连续
   跑 3 次 GREEN 状态均无任何告警)。即:这是测试本身"还没通过"时的暂态噪音,不是代码缺陷,
   最终交付的 GREEN 状态测试输出是干净的。记录于此仅为向下一位阅读者说明"RED 阶段看到 Vue
   warn 是正常的,别被吓到去改实现"。

3. 未发现其他自查问题:`git status`/`git diff` 确认只动了这两个文件,组件 `<style>`/script 逻辑/
   既有 4 条用例逐字未碰;临时调试用的 `_zzdebug*.test.ts` 文件均已在提交前删除,`git status`
   干净。

## 相对简报的偏离

无实质偏离。唯一需要说明的是"选择哪种既有写法来补齐 `mountToolbar()`/`i18n` 导入"——简报把这一点
明确留给执行者("照文件顶部既有写法补齐即可"),而该文件本身并无先例,于是采用了同目录
`PhotosFilterBar.test.ts`(本期姊妹任务)的写法,理由已如上述自查第 1 条。测试断言代码、插槽
HTML、注释文案均按简报逐字使用,未作任何改写。

## 问题与顾虑

无。DONE。

---

## Fix round 1(评审必修)

### ⚠️ 订正:上面「自查发现」第 2 条的结论是错的

原报告写的是:「只在该用例仍处于失败(RED)状态时出现,一旦补上插槽实现使该用例转绿,
警告随之消失……这是测试本身"还没通过"时的暂态噪音」。**这个结论被评审用
`--reporter=verbose` 实证证伪了:告警在 GREEN 状态下每次都在报,只是 vitest 默认 reporter
不显示"通过"用例的 stderr,我此前只用默认 reporter 反复跑,把"reporter 不显示"误读成
"告警不存在"。**

正确机理(评审原话,已复现确认):
- `PhotosToolbar.test.ts`/`PhotosFilterBar.test.ts` 都在文件顶部另建了一个独立的
  `createI18n(...)` 实例,并通过 `global: { plugins: [i18n] }` 传给 `mount()`。
- `vitest.setup.ts:24-26` 已经把 `src/i18n` 的**另一个**单例装进
  `config.global.plugins`,对这个进程里**每一次** `mount()` 都生效。
- `@vue/test-utils` 的 `mergeGlobalProperties`(`vue-test-utils.cjs.js:145`)对
  `plugins` 是**拼接**而非替换:`[...(configGlobal.plugins||[]), ...(mountGlobal.plugins||[])]`。
  于是这两个**不同对象**的 i18n 实例都会被 `app.use()` 装到同一个 app 上。
- `vue-i18n` 的 `install()`(`vue-i18n.mjs` 里的 `apply()`)对每次调用无条件执行
  `app.component('i18n-t', ...)` / `app.directive('t', ...)` 等,没有"已装过就跳过"的
  守卫;Vue 核心的 `app.component`/`app.directive`(`runtime-core.cjs.js:4149-4160`)对
  同名重复注册**无条件** `warn()`,与两次传入的是否为同一引用无关。
- 结果:只要合并后的 `plugins` 数组里出现两个不同的 i18n 实例,**每次 mount 都会稳定触发
  7 条 `[Vue warn]`**(`i18n-t`/`I18nT`/`i18n-n`/`I18nN`/`i18n-d`/`I18nD` 六个组件 +
  `t` 一个指令),跟这条用例当时是 PASS 还是 FAIL 完全无关——我之前"RED 才报、GREEN 就消失"
  的说法,是把"默认 reporter 只在测试 PASS 后惰性丢弃 stderr 缓冲"这件事,错认成了
  "代码状态改变导致告警消失"。用 `--reporter=verbose` 在修复前的 HEAD(`dd8f8b7`)上重跑,
  两条 P7b-T3 新用例(均 PASS)各打出 7 条 `[Vue warn]`,实锤复现。

### 修法

按评审给的第一条路:**去掉测试文件里另建的 `createI18n(...)` 实例**,不再显式传
`global: { plugins: [i18n] }`,直接吃 `vitest.setup.ts` 已经全局装好的那个 `src/i18n`
单例——反正原有 4 条 P1 既有用例本来就是这么跑的。验证过该单例在这套测试环境下默认
`locale` 就是 `zh_cn`(`initialLocale()` 读 `localStorage.getItem('lang')`,jsdom 环境
下取不到,回退 `zh_cn`),与两个文件里原来手搭的本地实例 locale 一致,所以
`PhotosFilterBar.test.ts` 里断言中文文案(「暂无位置数据」「暂无内容」「位置」等)的用例
不需要改动断言。

### 改了哪些文件

- `src/photos/components/__tests__/PhotosToolbar.test.ts`:删掉 `createI18n`/`zh` 导入与本地
  `i18n` 常量,`mountToolbar()` 与新增第二条用例里的 `global: { plugins: [i18n] }` 一并删除,
  补一段解释性注释。净改动 13 行(diff 中 `+7/-6`)。
- `src/photos/components/__tests__/PhotosFilterBar.test.ts`(T2 产物,评审点名一并修,防止
  T4/T5 继续照抄同一模式):同样删掉 `createI18n`/`zh` 导入与本地 `i18n` 常量,`mountBar()`
  里的 `global: { plugins: [i18n] }` 删除,补同款注释。净改动 10 行(diff 中 `+5/-5`)。
- 未碰 P7a 的既有测试文件(`PhotosFilterChip.test.ts`、`PhotosFilterPopover.test.ts` 等)——
  按协调者指示,那是上期已验收范围,同类模式(如果存在)不在本轮修复范围内。

### 验收证据(verbose,完整输出)

命令:
```
pnpm exec vitest run src/photos/components/__tests__/PhotosToolbar.test.ts src/photos/components/__tests__/PhotosFilterBar.test.ts --reporter=verbose
```
完整输出:
```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp7/NimoOS-New-UI

 ✓ src/photos/components/__tests__/PhotosToolbar.test.ts > PhotosToolbar > renders four tabs and highlights the active one via data-active 37ms
 ✓ src/photos/components/__tests__/PhotosToolbar.test.ts > PhotosToolbar > clicking a tab emits update:tab with the tab value 9ms
 ✓ src/photos/components/__tests__/PhotosToolbar.test.ts > PhotosToolbar > clicking a density button emits update:density with the density value 6ms
 ✓ src/photos/components/__tests__/PhotosToolbar.test.ts > PhotosToolbar > shows the item count text (raw number, same i18n arg shape as PhotosGrid month header — Fix 8) 4ms
 ✓ src/photos/components/__tests__/PhotosToolbar.test.ts > P7b-T3: after-tabs 槽位 > 不传槽位时不多渲染任何节点(默认形态与 P1 一致) 3ms
 ✓ src/photos/components/__tests__/PhotosToolbar.test.ts > P7b-T3: after-tabs 槽位 > 传入的槽位内容渲染在 .tabs 之后、计数与密度按钮之前 7ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 结构与展开 > 默认收起:.exif-filter 无 expanded 类,漏斗无 .on,无角标 53ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 结构与展开 > 点漏斗展开:加 expanded 类,450ms 后才加 ov 类(溢出放开) 10ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 结构与展开 > 再点漏斗收起:expanded/ov 同时撤掉,已开的弹层关闭 14ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 结构与展开 > 挂载时已有筛选值 → 自动展开,漏斗带 .on,角标显示总数 8ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 结构与展开 > 筛选值从无到有(外部写入)→ 自动展开 5ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > facet 取值 > 年份倒序去重;F1:不可解析日期不产生 NaN 选项 7ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > facet 取值 > 位置取逗号前一段、相机取「·」前一段,各自去重并按 localeCompare 升序 10ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 草稿 / 提交 / 清除 > 弹层里勾选不立刻生效,点「提交」才 emit update:filter 13ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 草稿 / 提交 / 清除 > 点「取消」丢弃草稿、关弹层、不 emit 8ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 草稿 / 提交 / 清除 > 重开弹层时草稿从已提交值重新快照(上次取消的勾不残留) 9ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 草稿 / 提交 / 清除 > 胶囊上的 × 清掉该维度;「清除全部」清三个维度并关弹层 4ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 草稿 / 提交 / 清除 > 胶囊标签:无值显示维度名,有值显示逗号拼接的取值 3ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 草稿 / 提交 / 清除 > 「清除全部」只在有筛选时出现 6ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 弹层关闭与 chipKeys > 点组件外部 mousedown 关弹层;点组件内部不关 10ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 弹层关闭与 chipKeys > 卸载后不再残留 document 监听(不抛错) 7ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 弹层关闭与 chipKeys > D19:chipKeys 只给年份+相机时,不渲染位置胶囊,角标只数可见维度 3ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > 弹层关闭与 chipKeys > 位置弹层空态用「暂无位置数据」,其余用「暂无内容」 7ms
 ✓ src/photos/components/__tests__/PhotosFilterBar.test.ts > hover 特异性硬约束 > .exif-funnel.on 的 hover 背景不被基类 .exif-funnel:hover 顶掉 1ms

 Test Files  2 passed (2)
      Tests  24 passed (24)
   Start at  13:54:57
   Duration  855ms (transform 378ms, setup 411ms, import 221ms, tests 247ms, environment 456ms)
```
`grep -c "Vue warn"` 对上面完整输出计数 = **0**。

`pnpm exec vue-tsc --noEmit`:无输出,exit 0。

### 自查

- `git status --short` 干净,只有这两个测试文件被改;`git diff` 确认没有碰
  `PhotosToolbar.vue`(生产代码,评审已过)、没有碰任何 P7a 既有测试文件。
- 断言内容(含 `PhotosFilterBar.test.ts` 里的中文空态文案)一字未改,只删了 i18n 装载相关的
  三处(import × 2、常量定义 × 1、`global.plugins` 传参 × 2),locale 一致性已实测确认。
- 提交:`5fa3f8e` `fix(photos): P7b-T3 fix round 1 —— 去掉测试里重复的 i18n 实例装载`。

### 顾虑

无。此轮已用 `--reporter=verbose` 双重确认(修复前 7 条/mount 复现、修复后 0 条),不会再犯
"默认 reporter 掩盖 stderr"这类可见性误判。
