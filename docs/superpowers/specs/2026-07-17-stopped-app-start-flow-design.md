# 已停止应用:灰显 + 点击启动流程(设计)

日期:2026-07-17
状态:待用户确认

## 背景 / 问题

Vue3 新主页上,已停止的 Docker 应用:

- Dock(下边栏)和添加面板(右边栏)的图标不变灰,看不出停没停;桌面图标(AppTile)已有灰显,是唯一做对的地方。
- 点击已停止的应用,现状只弹一条 toast"未运行,请到应用页启动",用户必须切到旧版应用页手动启动。用户还观察到过"直接打开网页地址"(状态未及时刷新时前端仍以为 running)。

目标:点已停止的应用 → 弹窗问"是否启动" → 确认后原弹窗转为"正在启动…"旋转圈 → 应用 running 后弹窗消失、当前页自动跳转到应用页面。

## 设计

### 1. 灰显(下边栏 + 右边栏)

- 判定统一收敛到 apps store 新增的 `isStopped(key)`:
  - `status` 存在且 ≠ `'running'` → 停止(涵盖 exited/dead/created/paused/unknown 等);
  - 系统应用、LinkApp、无 status 来源不算(与 `desktopDecls` 的"status 缺省视为运行"同一约定)。
- `DockApp.vue` 根按钮、`AddPanel.vue` 应用 tab 的 `.lib-icon` 绑定 `.is-stopped` 类;样式与桌面 `AppTile.stopped` 同款:`opacity: .45; filter: grayscale(.6)`(filter/opacity 非颜色字面量,不违反主题 token 约定)。
- Dock 的样式落在全局 `theme.css`(`.dock-app` 家族样式本来就在那里);AddPanel 的落在组件 scoped。
- `AppTile.vue` 的内联判定改为复用 `isStopped()`,一处定义。

### 2. 点击已停止应用 → 启动流程

点击入口不变(Dock / 桌面 / 搜索都走 `useOpenAction.openApp`):

1. `openApp`:status 非 running → 不再 toast,改为 `useStartApp().prompt(key)` 弹确认框;running 但没配网页地址(无 port/index)→ 维持无动作。
2. 确认框(`StartAppDialog.vue`,复用 `ui/Dialog.vue` 弹层,挂在 Home.vue):
   - **确认态**:"「名称」已停止,是否启动?" + [取消][启动]。
   - **启动态**:点[启动]后同一弹窗切换为旋转圈(与 SearchDialog 的 `.spinner` 同款:`--ring-track` 底圈 + `--accent` 顶弧)+ "正在启动 名称…",无按钮。
3. 启动接口(共享包 `NimoOS-Service` 新增 `service.apps.start()`,后端接口已存在,不改后端):
   - v2 compose 应用:`PUT /v2/app_management/compose/{name}/status`,body 为裸 JSON 字符串 `"start"`(须显式 `JSON` content-type,axios 裸字符串会发成 text/plain);
   - v1/裸容器:`PUT /v1/container/{id}/state`,body `{state:"start"}`。
4. 后端异步变更;前端每 1s 拉一次 appgrid(`apps.loadGrid()`),最多等 30s:
   - **running** → 弹窗关闭,**当前页跳转** `window.location.href = appUrl`(同页跳转,天然规避弹窗拦截;不再用"预开空白标签页"方案)。无网页地址(无 port/index)的应用只 toast"已启动",不跳转。
   - **超时/接口错** → 弹窗关闭 + toast"启动失败"。
5. 启动态中用户按 Esc/点遮罩收起弹窗:启动继续(docker start 无法取消),完成后只 toast 成功,不再自动跳转(避免用户已去干别的事时页面突然跳走)。

### 3. 状态与数据流

- `useStartApp.ts`:模块级单例(同 useDock/useAddPanel 模式)持有 `promptKey`(当前询问的应用)与 `starting`(启动态);`prompt/cancel/confirm` 三个动作。Dialog 组件只是这份状态的视图。
- 灰显数据源即 appgrid `status` 字段,由既有 30s 轮询 + 容器事件推送(~2s)保持新鲜,本设计不新增订阅。

### 4. 文案(i18n,zh_cn + en_us 同步加,parity 测试保证)

`startAppTitle / startAppMessage / startAppConfirm / startAppCancel / startAppStarting / startAppStarted / startAppFailed`;删除不再使用的 `openAppNotRunning`。

### 5. 测试

- `NimoOS-Service/apps.test.ts`:start() 两条端点 + body/头(已写,82 项全过)。
- `apps.test.ts`(store):isStopped 判定边界(系统应用/LinkApp/缺省 status/exited)。
- `useStartApp.test.ts`:confirm 成功路径(轮询到 running → 跳转)、超时失败、启动态中收起弹窗则不跳转。计时用假定时器或注入 pollMs/timeoutMs。
- `useOpenAction.test.ts`:停止应用 → 弹 prompt(重写原 toast 断言);running 路径不变。

### 6. 不做的事(YAGNI)

- 不做"停止运行中应用"的入口(本需求只管启动)。
- 不改后端、不新增 MessageBus 订阅。
- 不处理"容器 running 但应用 HTTP 还没就绪"的探活(浏览器刷新即可,后续有需要再加健康检查)。
