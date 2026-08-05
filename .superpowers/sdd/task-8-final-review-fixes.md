# SP5-P5 终审修复报告

来源:SP5-P5 全分支终审(4 条 finding),master 分支直接提交修复。

## 1. [Important] D4 name-guard stale-store window

**文件**:`src/apps/composables/useCustomInstall.ts`(~line 66)

**问题**:`if (!installedApps.apps.length) await installedApps.refresh().catch(() => {})` 只在 store 为空时才刷新。若 store 已非空(例如用户在这个页面停留期间,另一个标签页或旧版 Vue2 UI 装了同名应用),D4 同名硬挡会读到陈旧数据,放过冲突,后端静默覆盖已装应用的工作目录。

**修复**:改为无条件 `await installedApps.refresh().catch(() => {})`(保留 `.catch` 兜底,离线/失败不阻塞安装流程),再做同名检查。

**测试改动**:
- 更新既有「同名已装(D4)」测试:该测试直接给 `installed.apps` 赋值预置冲突,但无条件 refresh 会用 `svc.compose.list` 的返回值覆盖 store。为其显式 `mockResolvedValueOnce({ sonarr: {...} })`,让 refresh 后仍保留冲突,而不是被默认的 `{}` mock 刷没。
- 新增回归测试「store 非空但陈旧(不含刚被别处装上的同名应用)→ 无条件 refresh 后仍检出 D4 冲突」:store 预置一个不相关的 `other-app`,`svc.compose.list` 返回同时含 `other-app` 和 `sonarr` 的列表,断言 `installYaml` 检出冲突、不发任何 `install` 调用。此测试在修复前会因「非空即跳过刷新」而失败(冲突检测不到)。

## 2. [Important] Long-syntax non-tcp/udp protocol coerced to tcp

**文件**:`src/apps/util/composeSettings.ts`(~line 91,`classifyPortEntry` 对象分支)

**问题**:长语法 ports 条目 `{ target, published, protocol: 'sctp' }` 若 target/published 都是纯数字,会被误判为「可编辑行」,`protocol` 被强制归一化为 `tcp`(`=== 'udp' ? 'udp' : 'tcp'`),保存时静默把 sctp 端口改写成 tcp——短语法正则本就只认 `tcp|udp`,长语法这里行为不一致。

**修复**:在判断是否走「可编辑行」分支之前,先看 `protocol` 是否显式给出且既非 `tcp` 也非 `udp`(大小写不敏感);是则直接 `return { extra: p }` 原样透传,不进可编辑行、不被夹成 tcp。

**测试**:新增「长格式 protocol 非 tcp/udp(如 sctp)→ 原样透传,不被夹成 tcp 可编辑行」——`{target: 132, published: 132, protocol: sctp}` 断言：`ports` 为空、`portsExtra` 恰好含该原始对象,`buildYaml` 回写后该条目在 YAML 里逐字段原样保留(`protocol: sctp`),未被改写。

## 3. [Minor] Vacuous deep-link test

**文件**:`src/apps/views/CustomAppsPage.test.ts`(~line 68)

**问题**:`?tab=link` 深链测试断言 `[data-test="tab-link"]` 存在,但那是恒渲染的 tab 切换按钮(不管当前 tab 是什么都在 DOM 里),测试实际没验证深链是否真的切到了 tab3 面板。

**修复**:读 `CustomAppsPage.vue` 确认 tab3 面板的 `data-test` 是 `tab-link-panel`(第 216 行 `<section v-else class="custom-panel" data-test="tab-link-panel">`),把断言改成这个,同时把测试标题里的「占位」改成「面板」并加注释说明改动原因。

## 4. [Minor] Unhandled rejection on link delete

**文件**:`src/apps/views/CustomAppsPage.vue`(~line 154 `confirmDeleteLink`)

**问题**:`confirmDeleteLink` 直接 `await deleteLinkApp(...)` 无 try/catch,失败(如后端 `setCustomStorage` 报错)会变成未捕获 rejection,用户无任何提示,删除静默失败。

**修复**:参照 `onSubmitLink` 的模式包一层 try/catch:成功前先清空 `linkError`,失败时把错误信息写入既有的 `linkError` ref(与地址栏表单共用同一条错误展示位)。

**测试**:新增「删除失败(deleteLinkApp reject)→ linkError 就地提示,不静默丢失」:mock `svc.users.setCustomStorage` reject 一次,点确认删除后断言 `[data-test="link-error"]` 显示错误文案,且原列表行仍在(未被误清空)。此测试在修复前会产生 vitest 捕获的 Unhandled Rejection 并且断言失败(`link-error` 找不到)。

---

## 测试命令与结果

### 迭代期间(覆盖 4 处改动的三个测试文件)

```bash
pnpm vitest run src/apps/composables/useCustomInstall.test.ts src/apps/util/composeSettings.test.ts src/apps/views/CustomAppsPage.test.ts
```
结果:`3 passed (3 files)`,`59 passed`(含新增/调整的 4 条测试)。

修复前逐项验证过 red 状态:
- sctp 测试:`expected [...] to deeply equal []` — 未修复时 `svc.ports` 含被夹成 tcp 的行。
- 删除失败测试:`Cannot call text on an empty DOMWrapper` + Vitest 捕获的 `Unhandled Rejection: Error: boom` —— 证明修复前确实是未处理的 rejection。
- D4 相关两条测试在编码 useCustomInstall.ts 修复时是先改实现再补测试(该改动最先做),故这两条测试提交时已经是绿的;逻辑上若还原 `if (!installedApps.apps.length)` 判断,新增的「store 非空但陈旧」测试会失败(store 非空即跳过 refresh,冲突检测不到)。

### 提交前一次全量回归

```bash
pnpm vitest run
```
结果:`Test Files 205 passed (205)`,`Tests 1097 passed (1097)`。

```bash
pnpm exec vue-tsc --noEmit
```
结果:无输出,类型检查通过。
