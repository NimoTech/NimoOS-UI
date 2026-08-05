# Task 11 报告 —— DeveloperPanel HTTPS 开关 + 配置弹窗

## 实现内容

- `src/settings/util/sslDate.ts`(新建):`formatSslDate` 纯函数,逐字采用简报 Step 3 给出的实现。零值(`0001` 开头)、空/undefined、Invalid Date 均返回 `---`,否则 `DD/MM/YYYY`。**偏离 Vue2 的地方**(已在代码注释登记):Vue2 的 `formatDate` 用 `try/catch` 兜底,但 `new Date('乱码')` 不抛异常、只返回 Invalid Date,`getDate()` 全是 `NaN`,Vue2 会渲染 `NaN/NaN/NaN`。这里显式判 `Number.isNaN(d.getTime())`。
- `src/settings/components/WebUiHttpsDialog.vue`(新建):对位 Vue2 `WebUIHTTPSModal.vue`(334 行)。六行(域名/生效时间/过期时间/端口/证书类型/CA下载或PEM+CRT上传)。保存顺序:custom 且选了文件 → 先 `uploadSSLCert` 成功后才 `setSSLConfig`;只选一个文件 → 拒绝,什么都不发;custom 但一个文件都没选 → 直接保存,沿用服务端已有证书。只下发 `enabled/domain/port/cert_type` 四个字段。失败(上传失败或保存失败)都不关窗、不清错误提示由用户重试。
- `src/settings/panels/DeveloperPanel.vue`(改写,原为纯骨架):HTTPS 开关行 + (仅 `enabled` 时)配置入口行 + `WebUiHttpsDialog`。开关下发失败会回滚(`enabled.value = prev`);下发的兜底值(`nimoos.local`/`443`/`auto`)逐字对位 Vue2 `toggleHTTPS`。弹窗 `saved` 事件触发 `load()` 重新拉取配置。
- `src/settings/panels/panels.test.ts`(改动,非新增):`developer` 从这期起有真实内容(不再是骨架),仿照本文件里 `general` 已有的先例(注释见文件第 49-51 行),把 developer 专属的骨架断言(返回按钮代替标题 / 点击冒泡 `open-tab`)从这个"零 mock 纯骨架"通用测试文件里移除,覆盖转移到新的 `DeveloperPanel.test.ts`(带真实的 pinia + service mock)。同时把 `it.each` 的 tab 过滤列表加上 `developer`,不再对它跑通用骨架断言。

## 两个交错路径(async-stale)守卫及消融验证

简报正文的 Step 1 给定测试代码本身**不包含**这两条交错路径回归测试 —— 它们来自任务发起方在总任务说明里追加的第 7 条行为要求(“初始异步加载不能冲掉用户已做的编辑”),我按该要求自行补上,分别放在 `WebUiHttpsDialog.test.ts` 和 `DeveloperPanel.test.ts` 里。

1. **`DeveloperPanel.vue`**:局部变量 `editedDuringLoad`(非 ref,非公共 composable)。`load()` 开头重置为 `false`,`toggle()` 一开始置 `true`,`load()` 的 `await` 之后先判该标志再决定是否赋值 `cfg.value`/`enabled.value`。
   - 回归测试:`挂载时加载还没返回,用户已经拨了开关且下发成功,迟到的加载结果不能把开关弹回去(交错路径守卫)` —— 用 `createDeferred` 卡住第一次 `getSSLConfig()`,期间点开关(`setSSLConfig` 走另一个不受影响的 mock,正常成功),再用**挂载前**拍好的旧快照 resolve 卡住的 promise,断言开关仍是 `true`。
   - **消融**:临时删掉 `if (editedDuringLoad) return`,单独跑该用例 → 失败,报错 `expected 'false' to be 'true'`(开关被迟到的旧值弹回 `false`),与预期完全吻合。恢复后复跑,11/11 通过。

2. **`WebUiHttpsDialog.vue`**:同样的局部变量模式,`watch(open, immediate)` 开头重置,域名/端口输入的 `@input`、证书类型 `<select>` 的 `@change` 都会 `markEdited()` 置 `true`,`await getSSLConfig()` 之后先判标志再整体赋值 `cfg.value`。
   - 回归测试:`打开弹窗后加载还没返回,用户先改了域名,迟到的服务端值不能覆盖用户输入(交错路径守卫)` —— 同样用 `createDeferred`,期间在 `.wh-domain` 输入框打字,再用挂载前拍好的旧快照(`domain: 'server-stale.local'`)resolve,断言输入框仍是用户打的 `user-typed.local`。
   - **消融**:删掉 `if (editedDuringLoad) return` → 失败,`expected 'server-stale.local' to be 'user-typed.local'`(用户刚打的域名被迟到的服务端旧值整体覆盖),与预期吻合。恢复后复跑,17/17 通过。

两次消融都是"删除守卫 → 跑对应单个测试文件确认失败 → 恢复守卫 → 复跑确认转绿"的完整循环,过程中没有动其它任何代码。

## 简报里发现的问题与我的处理

1. **Step 1 给定的两份测试代码直接对 `mount()` 返回的 wrapper 做 `w.find('.wh-domain')` 等 DOM 查询,但从未 mount 时不带 `attachTo: document.body`。** `WebUiHttpsDialog.vue` 内部用的 `Dialog.vue`(共享文件,本任务不可改)经由 reka-ui 的 `DialogPortal` 把内容 Teleport 到 `<body>`,不在 `mount()` 返回的 wrapper 自己的 DOM 子树内 —— 这正是仓库里 `DeviceInfoDialog.test.ts` 和 `UpdateDialog.test.ts` 已经踩过并注释登记的坑(`newui-async-stale-guard` 之外的另一条已知记忆:reka-ui Teleport 陷阱)。若逐字照抄简报给的测试代码,17 个用例会**全部**因"空 DOMWrapper"报错,不是实现的锅。按 `UpdateDialog.test.ts` 的既有模式改成 `attachTo: document.body` + `DOMWrapper(document.body)` 查询,并在 `afterEach` 里 `unmount()` + 清空 `document.body.innerHTML`。这个偏离已在测试文件顶部写了注释登记。
2. **`DeveloperPanel.test.ts` 的既定测试用例本身没有踩到 teleport 坑**(因为 `DeveloperPanel.vue` 自己不是 Dialog,虽然内部含有一个,但测试只查 panel 自身渲染的 `.dp-config`/`[role="switch"]`,这些不在 Teleport 范围内),照抄可用。
3. **简报正文已经预判并正确指出**`.dp-config` 作为 class 传给 `SettingsRow` 落在其根 wrapper 上、不在内部可点的 `<button>` 上,并要求"取前者"(改测试,不碰共用组件)。我在 `点配置入口打开弹窗` 用例里把选择器从 `.dp-config` 改成 `.dp-config .set-list-item`,验证过点击確实命中内部按钮并触发了 `dialogOpen = true`。
4. **`panels.test.ts` 的既有通用骨架测试会因 `DeveloperPanel.vue` 从骨架变real 而炸(`getActivePinia()` 报错)**——这个文件此前对 developer 的两条断言(返回按钮/冒泡 open-tab)以及 `it.each` 循环都假设它还是零 mock 骨架。简报没有提到需要改这个文件,但不改就没法让 `pnpm test` 全量通过。处理方式完全参照文件里已经写好的 `general` 先例(第 49-51 行注释):把 developer 专属断言迁出,加入 `it.each` 的排除列表,新覆盖落在 `DeveloperPanel.test.ts`。这是唯一一处越出"只改简报点名文件"范围的改动,但性质是必要的测试维护(说明写在了下面"实现内容"和 commit message 里)。

## 命令与结果

```
pnpm test src/settings/components/WebUiHttpsDialog.test.ts src/settings/panels/DeveloperPanel.test.ts
# 实现前:9 failed | 2 passed (11)   —— formatSslDate 的 4 条纯函数用例先绿,组件用例全红(符合预期)
# 加完 attachTo:body 修正后:28 passed (28)

pnpm test src/settings
# 26 files, 288 passed(含本次两个新文件 + panels.test.ts 的调整)

pnpm test        # 全量
# Test Files  288 passed (288)
# Tests  2182 passed (2182)
# 基线 286 files / 2156 tests → 现在 288 files / 2182 tests,均高于基线

pnpm exec vue-tsc --noEmit
# 无输出,0 错误

git status --short   # 提交前后
# 提交前/后均只有:3 个 design-export/*.html 的 D(staged deletion,未动)
#                   + 1 个 docs/superpowers/plans/...md 的 ??(未追踪,未动)
```

## Before / after 测试计数

- Before(基线):286 files / 2156 tests
- After:288 files / 2182 tests(+2 files,+26 tests)

## Commit

`19b61be` — `feat(settings): developer 页 HTTPS 开关 + 配置弹窗(SP9-P1)`
6 files changed(3 新建源码 + 1 新建测试 + 1 改写 panel + 1 调整既有测试文件),631 insertions(+), 16 deletions(-)。

## 确认事项

- `design-export/*.html` 的 3 处 staged deletion:提交前后均在,未 touch。
- 未追踪的 `docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md`:提交前后均在,未 add、未 commit。
- 未修改任何共享原语:`SettingsSection.vue`、`SettingsRow.vue`、`SettingsSwitch.vue`、`Dialog.vue`、`useToast()`、`settings.css` 均未改动(唯一改动的既有文件是测试文件 `panels.test.ts`)。
- 未新增任何 i18n key —— 全部复用简报点名的既有 `zh_cn.sp9.ts` / `en_us.sp9.ts` 键。
- 未出现任何颜色字面量;`WebUiHttpsDialog.vue` 的 `<style scoped>` 全部走 `var(--…)` token。

## 真机验收

未做(按要求全程未对真实后端调用 `PUT /v1/gateway/ssl` 或证书上传,也没起 dev server 去翻这个开关)。真机检查是用户的活。
