# Task 10: GeneralPanel 装配 — 完成报告

## 提交

`07a6491` — `feat(settings): general 页装配(SP9-P1)`

4 files changed: `src/settings/panels/GeneralPanel.vue`, `src/settings/panels/panels.test.ts`,
`src/settings/views/SettingsPage.test.ts`, `src/settings/panels/general/GeneralPanel.integration.test.ts` (new).

## 做了什么

1. **`GeneralPanel.vue`**:把 P0 的空骨架替换为真实装配。行顺序严格对位 Vue2
   `SettingsPanel.vue` L65-324,与任务简报的表格逐行核对无误:
   `DeviceInfoCard` → Wallpaper → Language → Timezone → DiskStandby → WebUiPort →
   UsbAutoMount → SwitchRow(recommend_switch) → SwitchRow(rss_switch,带三个 confirm* key)
   → UpdateRow(kind="os", :sub="hwVersion") → UpdateRow(kind="app") → 保留的开发者入口行。
   代码里按简报要求逐条写了注释:两处「有意不做」(Premium 推广条 / Docker 容器应用行)
   各自标注了授权偏离编号/债务编号;固件行副标题来自本页自己拉的 `hardware.version`
   (不是 `os_version` 的 `current_version`),并注明本页会打第 3 次 `/sys/hardware`
   (DeviceInfoCard、UsbAutoMountRow 各打一次)是刻意保留、不引入缓存(YAGNI)。
   完全按简报 Step 3 给出的代码实现,未做任何修改。

2. **`panels.test.ts`**(简报 Step 4):
   - 通用骨架断言 `it.each(...)` 的 filter 加了 `t !== 'general'`,并在注释里写明
     "P1 起 general 已填真实内容(见 GeneralPanel.integration.test.ts),不再有
     .set-skeleton;developer 见 Task 11,目前仍是纯骨架,留在这条通用断言里"。
   - `it('general 骨架带 developer 入口行…')` 整条删除(其覆盖点已完整迁移到新的
     `GeneralPanel.integration.test.ts` 的「开发者入口行仍在最后并能 emit open-tab」用例),
     原地留注释说明为什么删、去了哪。`panels.test.ts` 保持零 mock 的纯骨架测试,未新增
     任何 service mock —— 按简报「推荐后者」的指示执行。
   - `developer` 相关两条(`.set-back` 存在 / 返回冒泡)未动。

3. **`GeneralPanel.integration.test.ts`**(新建):逐字照抄简报 Step 1 给出的测试代码,
   一字未改。10 个用例覆盖:标题、骨架占位已拆、卡片在列表前、11 行+开发者入口顺序、
   开发者入口 emit、Docker 行不存在、Premium 条不存在、固件副标题取 hardware.version、
   无裸 i18n key、全接口失败时仍渲染全部 10 行。

4. **额外必须修的文件:`src/settings/views/SettingsPage.test.ts`**(简报未提及,但任务门
   要求全量测试零失败,这是本任务改动引发的真实回归,必须一并处理):
   - 该文件挂载真实 `SettingsPage.vue`(内部 `<component :is="panel">` 换入
     `PANEL_BY_TAB[tab]`),此前 general 是纯骨架、不需要任何依赖;现在 general 变成
     真实内容,里面的 `LanguageRow` 用 `useLocaleStore()`(Pinia)、`UpdateRow`/`SwitchRow`
     用 `useToast()`(Pinia)—— 挂载时没有 active Pinia,直接抛
     `[🍍]: "getActivePinia()" was called but there was no active Pinia`,4 个用到
     `general` tab 的用例失败。**修法**:`beforeEach` 里加 `setActivePinia(createPinia())`。
   - 加了 Pinia 后仍有 5 个「Unhandled Rejection」把整个测试文件判为失败(尽管 9 个
     assertion 本身通过)。根因:`UsbAutoMountRow.vue`(既有文件,本任务不许改)第 28-35
     行用 `Promise.allSettled([service.sys.getUsbStatus().then(...), service.sys.hardwareInfo().then(...)])`
     防护单个请求失败,但 `service.sys` 是个 getter,在 `initService()` 未被调用时会**同步**
     抛 `Error('initService() not called')`——这个抛出发生在数组字面量求值阶段,
     早于任何 `.then()` 链建立,`Promise.allSettled` 包不住它,变成未处理异常炸穿整个
     测试文件。**修法**:给 `SettingsPage.test.ts` 补最小 service mock(不 mock 具体断言
     用到的返回值精度,只保证每个方法都是 resolve 的 async 函数,同 `useMessageBus` 也
     mock 掉),与「不碰既有行组件」的约束完全兼容 —— 问题出在测试环境没跑
     `initService()`,不是组件本身的逻辑缺陷(生产环境 `main.ts` 一定会先调用
     `initService()`)。这不是我引入的新 bug,是我组装页面后第一次让这条既有代码路径
     在没有 mock 的情况下被真实跑到,暴露出的既有测试基础设施缺口。

## 测试

- Step 2(先跑测试确认失败):`pnpm test src/settings/panels/general/GeneralPanel.integration.test.ts`
  → 5 failed / 5 passed(骨架还在,组件还没写)。
- 实现后同一命令:10 passed。
- `pnpm test src/settings` → **24 files / 263 tests,全绿**。
- `pnpm test`(全量)→ **286 files / 2156 tests,全绿**(基线 285 files / 2148 tests,
  净变化:+1 文件(新集成测试),+10 条新用例、-1 条从 panels.test.ts 删除的用例、
  -1 条因 `it.each` filter 排除 general 而减少的用例 = 2148 + 10 - 1 - 1 = 2156,
  与实测吻合)。
- `pnpm exec vue-tsc --noEmit` → 无输出,零错误。

## git 卫生检查

提交前后 `git status --short` 均确认:
```
D  "design-export/Audio Speaker Segmentation.html"
D  design-export/audio-waveform-design-kit.html
D  design-export/design-final.html
?? docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md
```
3 条 `D` 删除和未跟踪的 plans 文档原封未动,提交只用了显式路径(`git commit <path...>`),
没有用 `-a`/`git add -A`/`git stash`。

`git diff --name-only`(commit 前)只有三个文件:`GeneralPanel.vue`、`panels.test.ts`、
`SettingsPage.test.ts` —— 确认没有触碰任何既有行组件/卡片组件
(`DeviceInfoCard.vue`、`WallpaperRow.vue`、`LanguageRow.vue`、`TimezoneRow.vue`、
`DiskStandbyRow.vue`、`WebUiPortRow.vue`、`UsbAutoMountRow.vue`、`SwitchRow.vue`、
`UpdateRow.vue`、`SettingsSection.vue`、`settings.css` 均未改动)。

## 颜色 token 检查

`grep -n '#[0-9a-fA-F]\{3,6\}\|rgb(\|rgba('` 对 `GeneralPanel.vue` 无匹配 —— 新增的
`<style scoped>` 块是简报原样(`.set-dev-entry` 沿用 P0 已有样式),全部用 `var(--…)`。

## 关于简报的问题/风险点

1. **简报没提到 `SettingsPage.test.ts` 会受影响,但它确实会**(见上文详述)。这不是简报
   写错,只是这类"整页装配后暴露既有测试基础设施缺口"的连锁反应很难在写简报时预判 ——
   之前 general 是骨架,`SettingsPage.test.ts` 从没真正跑到 `UsbAutoMountRow` 里那条
   `service.sys` getter 同步抛错的路径。建议以后写"装配类"任务简报时,除了目标文件的
   直接测试,也提醒检查一遍"挂载整页"层级的既有测试(本仓库里凡是 mount 真实
   `SettingsPage`/`App` 之类的文件都属高风险)。
2. **`UsbAutoMountRow.vue` 的 `Promise.allSettled` 防护有一个理论盲点**:它防住的是
   "每个请求各自失败"(网络错误、4xx/5xx),防不住"访问 `service.sys` 这个 getter 本身
   同步抛错"(即 `initService()` 未调用的情况)。生产环境不会触发(`main.ts` 保证
   `initService()` 先跑),纯粹是测试环境的坑,且这个文件是"已实现、已测试、本任务不许改"
   的既有代码,所以我没有动它,只在消费它的测试文件里补了 mock 绕开。如果以后有其他
   地方挂载整页而又懒得写 mock,这个坑还会再冒出来一次 —— 值得记一笔债务,但按任务边界
   不该在本任务里"顺手"改掉别人的既有实现。
3. 简报表格里第 8 行"新闻流"写的是"开启需确认",实现里 `SwitchRow` 的三个 `confirm*Key`
   props 名称(`confirmTitleKey`/`confirmMsgKey`/`confirmOkKey`)与简报模板代码给出的
   kebab-case 模板属性名(`confirm-title-key` 等)完全对得上,没有偏差,照抄即可,没有
   踩到组件 API 漂移的坑(实现前已核对过 `SwitchRow.vue`/`UpdateRow.vue` 源码确认接口
   一致)。
