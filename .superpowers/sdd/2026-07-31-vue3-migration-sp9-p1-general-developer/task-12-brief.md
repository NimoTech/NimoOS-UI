## Task 12: 收尾 —— 全量任务门 + 浏览器自查 + 台账与 roadmap

**Files:**
- Create: `.superpowers/sdd/sp9/02-p1.md`(**gitignore,不进 git**)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md` §4 SP9(**另一个仓库,另一条分支**)

- [ ] **Step 1: 全量任务门**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -6
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test 2>&1 | tail -6
pnpm exec vue-tsc --noEmit && echo "TSC OK"
pnpm build 2>&1 | tail -6
```

判定:**tsc 零错误 · 两个仓库测试零失败 · 测试数只增不减**(New-UI 基线 269 文件 / 1935 例;Service 基线 24 文件 / 133 例)。把实际数字记进台账。

- [ ] **Step 2: 浏览器自查(无头 chromium)**

```bash
pnpm dev --host
```
浏览器开 `http://192.168.1.143:5273/app/#/settings/general`。

无头自查手法沿用 P0 台账记的办法:往 `public/` 临时放一个 `__p1check.html`,`localStorage.setItem('access_token'/'user'/'theme')` 后 `location.replace('/app/#/settings/general')`,chromium 一次导航截图。**用完必须删掉那个文件**并确认 `git status` 干净。

自查清单(**暗色 + 亮色各截一次**):

| # | 检查 | 怎么看 |
|---|---|---|
| 1 | general 页 10 行 + 设备信息卡 + 开发者入口,顺序对 | 与本计划 Task 10 的表逐行比 |
| 2 | 设备信息卡显示真实版本号,点按钮弹出 5 行设备信息 | 弹窗里 Platform 应是 `nimoos-standard-v1`、CPU `~4.6 GHz` / 12 Threads |
| 3 | 壁纸的「更改」是灰的且下方有说明 | |
| 4 | 语言下拉只有 2 项;切成 English 后**整页文案跟着变** | 切回中文 |
| 5 | 时区下拉能选,选完刷新页面后**仍是刚选的值** | 验证真落库了 |
| 6 | 硬盘待机同上 | |
| 7 | WebUI 端口显示 `80`;**改成 8080 后不要点提交**,改回 80 让提交按钮消失 | ⚠️ 绝对不要提交 |
| 8 | USB 自动挂载开关初始是**开**(本机实测 `"True"`),拨关再拨开,刷新后状态一致 | |
| 9 | 新闻流拨开**先弹确认框**;取消后仍是关 | 再拨开→接受→刷新应为开 |
| 10 | 推荐应用拨动无确认,刷新后保持 | |
| 11 | 固件更新与系统更新两行都显示「当前已经是最新版 ✓」;点「检查更新」出 toast | 本机 `need_update:false`,**不会**弹更新窗 |
| 12 | 侧栏底部有关机 / 重启两个圆按钮;点关机**弹确认框后立刻取消** | ⚠️ 绝对不要确认 |
| 13 | 开发者入口 → developer 页头部是**返回按钮**,点它回 general | |
| 14 | developer 页 HTTPS 开关初始**关**(本机 `enabled:false`),下方无配置行;**不要拨开** | ⚠️ 拨开会真的改网关 SSL 配置 |
| 15 | 窄屏 420px:行不塌、下拉不溢出、rail 收顶部横条 | |
| 16 | 亮色主题下 logo 可见、开关/按钮对比度正常 | 检查 `--set-warn-fg` 等新 token |

> 第 7 / 12 / 14 项是本期唯一三个「看得见但不能按」的地方,**只验形状不验行为**;它们的行为由单测覆盖,实机行为留给用户最终验收。

- [ ] **Step 3: 写台账 `.superpowers/sdd/sp9/02-p1.md`**

必须包含:

1. **任务门实测数字**(Service / New-UI 基线 → P1 末)
2. **实测校正 6 条**(尤其:`/gateway/components` 与 `/gateway/device-info` 是裸 JSON;命名陷阱;`updateOs`/`cancelDownload` 是 spec 表外补的;`trigger_download` 是查询参数)
3. **两处死代码的完整判据**(`is_update` 从没被写过;`SET_NOTIMPORT_LIST` / `SET_EXISTING_APPS_SWITCH` 从没被 commit、`exsitingAppsShow` 模板里从没引用)+ 用户 2026-07-31 拍板跳过
4. **移植纪律 6 条**改正记录
5. **授权偏离 #6**(Premium 推广条不做)
6. **新债务 D14 / D15**
7. **交给 P2 的事**:`SettingsRow` / `SettingsSwitch` / `.set-list` 可直接复用;`systemConfig.ts` 的串行队列是所有写 `system` blob 的唯一入口,P2-P4 新增字段要加进 `SystemBlob` 类型;`sys` 域里 `getLogs` / `getSystemPaths` / `migrate*` 已进包但**没有消费方**,P3 消费 `migrate*` 前必须抓真实 fixture 复核字段
8. **本期没做的**:三个破坏性路径(改端口 / 关机重启 / 真升级)未实机验证,留用户最终验收

- [ ] **Step 4: 同步 roadmap §4 SP9(另一个仓库)**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git log -1 --oneline          # ⚠️ 先看一眼:sp7 会话也在写这个文件
git status --short
```

分支应是 `docs/vue3-migration-sp3`。在 §4 SP9 追加 P1 小节,**必须写进去**(台账会丢,roadmap 是唯一长期载体):

- P1 完成,commit 范围,任务门数字
- 实测校正 6 条(裸 JSON 那条最要紧)
- 两处死代码判据 + 拍板结论 + 债务 D14 / D15
- 授权偏离 #6
- 移植纪律 6 条
- P3 消费 `migrate*` 前须抓真实 fixture

```bash
git commit docs/vue3-migration-roadmap.md -m "docs(sp9): P1 general+developer 完成,记实测校正/死代码判据/新债务"
```

- [ ] **Step 5: 最后一次确认没有误提交别人的东西**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short
git log --oneline -12
```

**必须确认:那 3 行 `design-export/*.html` 的 `D` 仍在 index 里、没有出现在本期任何 commit 中。**

```bash
git log --oneline --name-only -12 | grep -c design-export   # 期望输出 0
```

---

## Self-Review

**1. spec 覆盖检查(§5.1 / §5.2 逐项)**

| spec §5.1 项 | 落在哪 |
|---|---|
| 设备信息卡 + DeviceInfoPanel 191 行 | Task 4 |
| 壁纸行(D5 做样子) | Task 5 |
| 语言行(D6 做样子) | Task 5 |
| 时区行 | Task 5 |
| 硬盘待机 | Task 5 |
| WebUI 端口(改端口 + checkUiPort 探活) | Task 6 |
| USB 自动挂载 | Task 7 |
| 推荐应用 | Task 7 |
| RSS | Task 7 |
| Docker 应用开关 | **不做**,债务 D15(实测恒不渲染,用户拍板) |
| 系统更新(UpdateModal 321) | Task 8 |
| 系统更新(UpdateCompleteModal 177) | **不做**,债务 D14(实测触发器从未实现,用户拍板) |
| App 更新 | Task 8 |
| 开发者模式开关 | Task 10(P0 已建的入口行,保留) |
| 关机/重启 + 6 状态浮层 | Task 9 |
| `sys` 域补全 16 项 | Task 1(另补 `updateOs` / `cancelDownload` 共 20 项) |
| `checkUiPort` 不进包、留设置区自实现 | Task 6(`src/settings/util/checkUiPort.ts`) |
| spec §5.2 developer:HTTPS 开关 + WebUIHTTPSModal 334 | Task 11 |

无遗漏项。两处「不做」都有实测判据 + 用户拍板 + 债务编号。

**2. 占位符扫描** —— 全篇无 `TBD` / `待补` / `类似 Task N` / 无代码的「加上错误处理」类步骤。每个测试步骤都给了完整可运行的测试代码,每个实现步骤都给了完整文件内容。

**3. 类型一致性检查**

- `UpdateCheck` / `SSLConfig` / `SSLConfigInput` / `HardwareInfo` / `SystemPaths` / `MigrateStatus` 在 Task 1 定义,Task 4(`HardwareInfo`)、Task 8(`UpdateCheck`)、Task 11(`SSLConfig`)消费,字段名一致。
- `SystemBlob` / `readSystemConfig` / `patchSystemConfig` / `SYSTEM_DEFAULTS` / `__resetSystemConfigQueue` 在 Task 2 定义,Task 5、Task 7、Task 10 消费,签名一致。
- `SettingsRow` 的插槽名(`control` / `hint`)与 props(`label` / `sub` / `clickable` / `disabled`)在 Task 3 定义,Task 5-7、11 一致使用。
- `SettingsSwitch` 是**受控**组件(`modelValue` + `update:modelValue`,自己不改状态),Task 7 / 11 的「失败弹回」都依赖这一点 —— 一致。
- `UpdateKind` 已在 Task 8 Step 5 的注记里改为单独放 `src/settings/util/updateKind.ts`(`<script setup>` 不能 `export`),`UpdateDialog.vue` 与 `UpdateRow.vue` 都从那里 import。
- `PowerPhase` / `createPowerFlow` / `probeAlive` 及 5 个时间常量在 Task 9 定义,`PowerFlow.vue` 消费,一致。
- `formatSslDate` 在 Task 11 Step 3 定义于 `src/settings/util/sslDate.ts`,测试与组件都从那里 import,一致。

**4. 已在计划中标注、留给实现者当场确认的 3 个小风险**

1. `import logo from '…svg'` 的类型来源(Task 4 Step 8 注记:用文件级 `/// <reference types="vite/client" />`,不动 `tsconfig` 的 `types` 数组)。
2. `UpdateKind` 的导出位置(Task 8 Step 5 注记)。
3. `.dp-config` 的 class 落点与测试选择器(Task 11 Step 5 注记:测试用 `.dp-config .set-list-item`)。
