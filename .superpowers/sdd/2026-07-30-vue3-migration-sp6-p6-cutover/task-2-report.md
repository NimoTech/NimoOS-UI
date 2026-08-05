# Task 2 Report: Vue2 `Home.vue` 存储入口改跳(SP6-P6)

## 结果

DONE. Commit: `ed9a2ac4dc16abb5143e54a8a932e5b5bb7bbf34` (repo: `NimoOS-UI`, branch `docs/vue3-migration-sp3`).

## Step 2:确认失败

跑 `pnpm vitest run src/views/__tests__/Home.storageCutover.spec.js`(未实现前):

- 第 1 条「未回退时整页跳 /app/#/storage,不开老弹窗」—— **FAIL**(`hrefs` 为 `[]`,不是 `['/app/#/storage']`)。
- 第 2 条「埋点 widget_storagemanager 仍然上报」—— **已 PASS**(旧代码本就无条件调用 `$messageBus`)。
- 第 3 条「回退 flag == "1" 时开老弹窗,不跳转」—— **已 PASS**(与 brief 文字描述不同:brief 写"预期第 1、3 条 FAIL",但逻辑上第 3 条的三个断言——`hrefs=[]`、`modal.open` 调用一次、`$messageBus` 被调用——描述的正是旧代码"无论如何都开弹窗"的现状,旧代码天然满足,故第 3 条当时就通过,只有第 1 条真的失败。已在此如实记录,未按 brief 文字"修正"出第 3 条的失败)。

总计:2 passed / 1 failed,与预期实质一致(仅 brief 对哪几条 FAIL 的文字描述有出入)。

## 环境阻塞与处理(brief 未预料到)

`import Home from '@/views/Home.vue'` 这一行本身(与 shallowMount 与否无关)在当前 vitest 配置下会在模块加载期崩溃:`Home.vue` 静态 import 链上的 `SideBar.vue`(经 `widgets/Settings.vue` 用 webpack `require.context`)、`SettingsPanel.vue`(直接 `import '@/assets/lang'`,内部也是 `require.context`)、`CoreService.vue`(`import noticeBlock from '@/components/noticBlock/noticeBlock'`,无扩展名)、`AppSection.vue`(同样无扩展名 `.vue` import)在 Vite/Vitest 下均无法解析(这些是 webpack 专属约定,生产构建走 `vue.config.js`/webpack 没有问题)。

处理方式:仅在新测试文件内部用 `vi.mock(...)` 对 `Home.vue` 的 7 个直接子组件(`SideBar`/`SearchBar`/`CoreService`/`AppSection`/`UpdateCompleteModal`/`SettingsPanel`/`KVMFullPage`)打最小 stub,阻止 Vite 去 transform 它们的真实源码——不影响本任务要测的方法体逻辑,也没有改动任何共享测试基础设施(`vitest.config.mjs` 未动)。已在测试文件里写注释说明这是与"避免 shallowMount"不同的另一个取舍,原因是环境限制而非测试策略选择。

## Step 4:实现后

```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

三条全绿。

## Step 5:变异验证

1. `if (target) {` → `if (false) {`:重跑 → 第 1 条「未回退时整页跳…」变红(`AssertionError: expected [] to deeply equal ['/app/#/storage']`),其余两条仍绿。改回后确认。
2. `this.$messageBus('widget_storagemanager')` 从跳转分支之前挪到 modal-open 分支(即从「二者都执行」改成「只在老弹窗分支执行,跳转分支不执行」):重跑 → 第 2 条「埋点仍然上报」变红(`Number of calls: 0`)。改回后确认。

两条变异均按预期让对应断言变红,revert 后三条恢复全绿。

## 最终 diff(`src/views/Home.vue`)

- import 区加一行:`import { resolveEntryTarget } from '@/router/strangler'`。
- `showStorageManagerPanelModal` 方法体:`$messageBus` 埋点保持在最前;新增 `const target = resolveEntryTarget('/storage')` + `if (target) { window.location.href = target; return }`;原 `$buefy.modal.open({...})` 整块原样未动一行。
- 2 空格缩进,与文件其余部分一致。

## 提交

```
commit ed9a2ac4dc16abb5143e54a8a932e5b5bb7bbf34
feat(storage): Vue2 桌面存储入口改跳 /app/#/storage(SP6-P6)

新盘通知卡「Storage Manager」按钮经 EventBus casaUI:openStorageManager 打到这里。
埋点保留在跳转前;老弹窗代码原样留作安全网,flag strangler:disabled:/storage 可逆回退。
```

只包含两个文件:`src/views/Home.vue`、`src/views/__tests__/Home.storageCutover.spec.js`。仓库里其余未跟踪/已修改的无关文件(`docs/superpowers/...`、`FRONTEND_API_GUIDE.md` 等)均未加入本次提交。

## 未做/遗留

- `mounted()`/`beforeUnmount()`/`CoreService.vue` 均未改动,符合要求。
- 未触碰 `vitest.config.mjs` 或任何共享测试基础设施——`.vue` 无扩展名 import / `require.context` 在 Vite 下不可解析是仓库级已知环境缺口(不止 `Home.vue` 一处),留给后续如需要再统一处理,本任务用局部 `vi.mock` 绕过,未做基础设施改动。
- 全量 `pnpm test` 未跑(按任务要求,已知基线 1425 passing / 8 failing 与本任务无关,不重复验证)。
