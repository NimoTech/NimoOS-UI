# SP17 设置区补迁 —— 交接与真机验收清单

**状态**:4 个 Task 全部编码完成,逐个评审 clean(见 `.superpowers/sdd/2026-08-09-sp17-settings-catchup/progress.md`),**未合并 master、未部署、未推 origin、未做真机验收**。
**分支**:`sp17-settings-catchup`(base = New-UI `master@6f8f742`,即本分支与 `master` 的 merge-base)
**worktree**:`.claude/worktrees/sp17-settings-catchup`
**代码末位**:`b0f7233`

对应的 roadmap 记录在 `NimoOS-UI` 仓(Vue2)`docs/vue3-migration-roadmap.md` §4 「SP17 — 设置区补迁」一节——那边是给跨期读者看的概览,本文档是给接手真机验收/合并的人看的操作清单,两者内容有意重叠但角度不同。

## 本期做了什么(逐 Task 提交范围)

| Task | Vue2 来源 | 提交 |
|---|---|---|
| 1. 共享 service 包新增 `getLanDiscovery()`(裸 JSON,无信封) | `#93` 的一部分 | `00871cf` |
| 2. 设置侧栏新增「局域网设备」标签 | `#93` | `7b68025`、`3590881`(oss 导出清单同步)、`e16d931`(两处测试标题补译英文) |
| 3. App 数据存储位置新增「相册缓存」行 + 清理浏览黑名单死代码 | `#103`、`#105` | `1e99477`、`82a1f69`、`dd0b01e`(均为 oss 导出清单同步/修复) |
| 4. 桌面 KVM 磁贴按服务可用性门控 | `#125` | `b0f7233` |

**两处刻意偏离 Vue2(机主已拍板,代码注释同步登记,均在 `LanDevicesPanel.vue` 里)**:
- 局域网扫描失败时显示一行错误提示(`.set-lan-error`),而不是 Vue2 的静默空态。
- 扫描带世代守卫(generation guard):发起新一次扫描时给请求打一个递增序号,只有最新序号的响应才会落地,防止一次慢的旧请求把更新的结果覆盖回去。

## 收尾门实测结果(Task 6,2026-08-09,New-UI@`6ee3699`——即代码末位 `b0f7233` 之后只叠了两个文档提交,干净工作树,五道门按 task-6-brief 的顺序逐条独立重跑,不是抄前面 Task 的报告)

| # | 门 | 命令 | 结果 |
|---|---|---|---|
| 1 | 类型检查 | `pnpm exec vue-tsc --noEmit` | **0 错误**(无任何输出,exit code 0) |
| 2 | 全量测试 | `pnpm test` | **675 个文件全绿(675 passed)/ 10943 个用例全绿(10943 passed),0 failed**。耗时 204.27s。已知 flake `src/files/upload/persist.test.ts:55` 本次随大盘一起跑**未复现**(整体全绿,未触发需要单独隔离重跑的分支) |
| 3 | i18n 键对齐 | `pnpm exec vitest run src/i18n/parity.test.ts` | **1 个文件全绿(1 passed)/ 9 个用例全绿(9 passed)** |
| 4 | 开源导出 | `node oss/export.mjs --out <scratchpad>/sp17-oss --no-commit --allow-dirty-oss` | exit code 0。清单:DELETE 73 · REPLACE 4 · PATCH 278。**零真实泄漏命中**;3 个文件按二进制跳过扫描(预期内,不计入泄漏判定):`src/assets/wallpaper/wallpaper01.jpg`、`src/assets/wallpaper/wallpaper02.jpg`、`src/home/apps/icons/settings.png` |
| 5 | 构建 | `pnpm build` | **成功**。`vite build` 自报 `built in 18.44s`;含前置 `vue-tsc --noEmit` 的整条命令总耗时 38.16s。只有常规 chunk 体量警告(最大一块 `index-BQnRorZI.js` 7,366.96 kB / gzip 2,066.56 kB),不是错误 |

> **与更早提交(`45be595`/`6ee3699`)里旧表格的对照**:全量测试(675/10943)与类型检查(0 错误)两项数字**与旧表一致,没有出入**。构建耗时旧表写的是 36.82s,本次是 38.16s——同一命令、不同次运行的正常抖动,不代表回归。**开源导出这一门旧表记的其实是另一条命令** `pnpm exec vitest run oss/`(oss 守卫自身的单元测试,7 文件 / 146 例,全绿,这条本身没错但不是 task-6-brief 指定的第 4 步),**不等于**本 brief 第 4 步要求的 `node oss/export.mjs --out ... --no-commit --allow-dirty-oss`(对整棵源码树做一次真实导出+泄漏扫描)。本任务已按 brief 原文命令补跑,结果见上表第 4 行,两条命令都是绿的,互不矛盾,只是覆盖面不同。
>
> 各 Task 自己的报告(`task-1..4-report.md`)记录的中间数字略有出入(如 675/10934、675/10937)——这是因为每个 Task 在自己完工时各自重跑过一次全量测试,数字随后续 Task 新增的测试逐步递增,彼此不矛盾。**上表是 Task 6 在四个 Task 全部完成后,按本期五道收尾门的口径独立跑出的最终状态,是本文档里唯一应该被引用的数字。**

## 真机验收清单

**前提**:设备已跑着后端各服务(Gateway/UserService/LocalStorage/…/KVM 若已安装),浏览器能访问设备。以下步骤是在本 worktree 起一个**独立的 dev server**,**不执行 `./scripts/deploy.sh`**——设备上 `/var/lib/nimoos/www/app/` 这一个部署目录被多条并行分支分时占用,部署会覆盖别人正在验收的版本;`5273`/`5277`/`5288` 三个端口已被其它并行分支占用,故本分支固定用 `5279`。

1. 起 dev server:
   ```bash
   cd <本仓>/.claude/worktrees/sp17-settings-catchup
   pnpm dev --host --port 5279
   ```
   浏览器打开 `http://<设备IP>:5279/app/`,登录。

2. **局域网设备列表出现**:设置 → 侧栏应能看到新标签「局域网设备」。点开应看到若干台设备的列表;本机那一行带「当前设备」标签,且点它不会触发任何跳转(不是可点的链接)。
   - 2026-08-09 开工当天实测局域网有 **6** 台设备(含本机),其中一台 hostname 是 `debian`——验收时这个数字可能因当时网络环境不同而变化,不必强求一致,但**列表不应为空**。

3. **重新扫描 · 正常路径**:点「重新扫描」按钮 → 列表应刷新、不报错。

4. **重新扫描 · 失败路径**:打开浏览器 devtools,把 Network 面板设成 Offline(或直接拔网线/断 Wi-Fi),再点「重新扫描」→ 应出现一行「扫描失败,请稍后重试。」**而不是**Vue2 那种「未发现其他 NimoOS 设备」的静默空态。这是本期两处刻意偏离之一,必须验到「出现的是错误行」才算过,别把它和空态弄混。验完恢复网络,重新走一次步骤 3,确认能回到正常路径。

5. **相册缓存行出现**:设置 → 应用 → 「App 数据存储位置」应变成**四行**,第四行标签是「相册缓存」,这一行的容量与路径都**不应是空的**。真机预期路径 `/DATA/.system_data/photos`,大小约 5.8 GB(2026-08-09 实测;验收时可能因设备上实际数据量变化而不同,但不应是 0 或空白)。

6. **相册缓存迁移浏览(不要真的迁移)**:点第四行的「更改」按钮 → 打开迁移弹窗,在浏览步骤里选任意一个目标目录 → 弹窗应显示目标落点路径,形如 `<所选目录>/.system_data/photos`。**验完立刻关掉弹窗,不要点「开始迁移」**——那会真的搬动设备上的相册数据文件。

7. **KVM 磁贴可见 · 默认路径**:回到桌面。本机 KVM 服务是可用的(`GET /v1/kvm/settings` 返回 200),所以磁贴应该正常显示、点击能正常打开。

8. **KVM 磁贴隐藏 · 服务不可用路径**:在浏览器 devtools 里把 `/v1/kvm/settings` 这一条请求拦成失败(Network 面板右键该请求 → Block request URL,或用请求拦截插件/代理),刷新桌面页面。**磁贴应在页面首次加载完成后几秒内就消失,不需要等 30/45/60 秒的任何轮询节拍**——`src/views/Home.vue` 的 `refreshApps()` 现在在探测*确认* KVM 不可达的同一次调用里就会 `layout.evict('vm', { force: true })` 强制清位(见 `src/home/stores/apps.ts` 的 `probeKvm()`/`kvmAvailable` 与 `src/views/Home.vue` 的 `refreshApps()`),不再依赖 `layout.sweepGone()` 的 45 秒宽限期——那条宽限期兜底仍然存在,但只用于"应用从列表里悄悄消失"这类含糊信号,probe 明确失败属于确定信号,走的是立即清位这条快路径(同 `APP_UNINSTALL_END` 那一类)。**通过标准**:刷新后,首次 `loadGrid()` 完成(浏览器里几乎感觉不到延迟,是网络请求往返的时间,不是计时器)磁贴就从桌面消失;不应看到磁贴还停留大几十秒才消失——如果停留了,才是真的坏。
   - 另需注意:探测不只发生在 30 秒轮询上——切到别的标签页再切回来(`window.focus`)、容器事件去抖刷新之后也都会重新触发一次 `loadGrid()`/`probeKvm()`,所以在这个场景下"多久探测一次"没有单一答案,不要用"每 30 秒探测一次"简化描述这个机制。
   - 恢复拦截(取消 Block)后再刷新一次页面 → 磁贴**不会**自动回来(布局已经把它移除了,这是预期行为,不是缺陷);打开「添加应用」面板,应能看到 KVM 磁贴,点击可以把它重新加回桌面。

## 未做的事与原因

以下六条**不是本期遗漏**,是逐条核实过的「不做/不适用」结论,附证据——下一期接手的人不必重新探一遍:

- **`#97` Terminal Security 区:不做。** 2026-08-09 实测 `GET /v1/sys/wsssh` → `404 {"message":"Not Found"}`,后端仍未提供该接口。New-UI 早已删掉旧 wsssh 终端,见 `src/settings/panels/TerminalPanel.vue:5-9` 的注释(引用 `NimoOS/route/v1.go:106` 已被注释掉、`GET /v1/terminal/settings` 同样 404)。既有债务 D7/D25 继续挂账,本期未动。
- **`#121` 图标死链:早已处理,不是缺口。** `src/apps/util/importNormalize.ts:76` 的注释已写明 `icon.nimoos.io` 这个域名从未存在过(Vue2 遗留死链,`ERR_NAME_NOT_RESOLVED`),New-UI 从未注入这个 icon 字段。
- **`#121` Discord 链接:无对应物。** New-UI 没有 Vue2 那个 `ContactBar` 的对位组件——那是 Vue2 主壳自己的装饰件,不在迁移范围内。
- **`#119` 清死域名:不适用。** 该提交改的是 Vue2 自己的 `README.md` 和多份多语言 locale 文件里的死域名引用;New-UI 只有 `zh_cn`/`en_us` 两份 locale,没有对应的键。
- **`awesome.casaos.io`:不是缺口。** 这条链接在 Vue2 `origin/main` 里同样还在(`src/components/Apps/AppStoreSourceManagement.vue:92`),两边一致,没有谁掉队。
- **`#128` 默认应用图标美术:不适用。** New-UI 没有 `default.png`/`default.svg` 这份资产,走 CSS `.store-icon-fallback` 兜底;换美术是新设计工作,不是移植缺口。

**两条对 roadmap SP12 清单的实测校正**(细节见 `NimoOS-UI` 仓 `docs/vue3-migration-roadmap.md` §4「SP17」一节):SP12 的「零散四条」把 `#122`(files 区的死代码清理)也算了进去,但那条属于 Files 区、归 SP12 对应的 Files 补迁 worktree;`#136`(MCP test button ghost collision)已由 SP14 做掉。**本期真正剩下的零散项只有 `#125` 一条**,已随 Task 4 做完。另外,Knowledge/Notes(`#78`–`#104`)在 SP8 移植 AI 区时已吸收主体,不是本期工作。

## 已知遗留(挂账,不在本期范围)

- **相册缓存迁移的真实执行路径从未被跑过**——不是隐患,是一处坦白的覆盖缺口。真机验收
  第 6 步刻意停在"打开迁移弹窗、看到目标路径"就关掉,不点「开始迁移」,所以
  `service.sys.migrateAppPath(type, targetMount)` 传 `type: 'photos_data'` 这条真实调用
  从未被验证过(编码期也没有单测覆盖这个具体 type 值)。共享包里的签名是
  `migrateAppPath(type: string, targetMount: string)`(`packages/service/src/sys.ts:55`)——
  `type` 是裸 `string`,编译期不约束取值,`'photos_data'` 传下去与 `'app_data'` 一样合法,
  TS 不会替我们发现拼写错误。后端契约已读代码确认过(`NimoOS/service/migrate.go:29,371`
  接受 `photos_data` 并落到 `<target>/.system_data/photos`),所以这不是"没查过会不会崩"的
  隐患,而是"没有自动化证据"——下一期若要关这个缺口,应该给 `migrateAppPath` 的 `type`
  参数收紧成 `AppPathKey`(见 `src/settings/util/appPaths.ts`)这类联合类型,并补一条真的
  调用 `type: 'photos_data'`、断言请求体的测试。
- **`SettingsShell.test.ts`/`panels.test.ts` 等约 8 个既有设置面板测试文件有 `[Vue warn]` 插件重复注册噪音**(Task 2 报告已 root-cause:这些文件各自用局部 `createI18n()` 挂载,和 `vitest.setup.ts` 装的全局默认 i18n 实例重复注册了 `i18n-t`/`I18nT` 等组件)。本期新写的测试文件没有这个问题(已避开同一坑),但既有文件没有动——修复面是仓库级的测试装配问题,超出单个设置标签的范围,建议独立开票统一清理。
- **全仓 37 个源文件 / 54 处注释仍把共享包指路到 `NimoOS-Service/src/*.ts`**(SP13 遗留的票②,本期未碰,详见 `NimoOS-UI` 仓(Vue2)`docs/vue3-migration-roadmap.md:1185` 的 SP13 节「票②」——**不是本仓**,New-UI 这个仓里没有这份 roadmap 文件)。

## 下一步(给合并/验收的人)

1. 走完上面的真机验收清单,记录哪些通过、哪些不通过。
2. 验收通过后,决定是否合并进 `master`(本期未做,评审记录见 `.superpowers/sdd/2026-08-09-sp17-settings-catchup/progress.md` 与各 `review-*.diff`)。
3. 合并后如需部署,走本仓约定的唯一入口 `./scripts/deploy.sh`,不要手写 rsync。
