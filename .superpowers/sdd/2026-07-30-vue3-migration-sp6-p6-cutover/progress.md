# SDD ledger — plan: docs/superpowers/plans/2026-07-30-vue3-migration-sp6-p6-cutover.md

Spec: docs/superpowers/specs/2026-07-30-vue3-migration-sp6-p6-cutover-design.md
两仓:实现横跨 NimoOS-UI(Task 0-3)与 NimoOS-New-UI(Task 4-5)。直接在两仓 master 上做
(用户明确授权,不开 worktree)。docs commit:New-UI master@4e4b522。

## Pre-flight 扫描(dispatch Task 0 前)

- **已知可争议点(预先记录,非阻塞)**:Task 1 给 `migratedEntries` 保留 `enabled` 字段,
  但表里目前没有 `enabled: false` 的条目,故 `!entry.enabled` 分支无测试覆盖;plan Step 5
  明确指示**不要**为它补测试(YAGNI)。保留该字段的理由 = spec §3 D2 要求与既有
  `migratedRoutes` 表结构对称(那张表的 `enabled` 由 `isEnabled` 消费)。
  若评审提 Minor,记 deferred;若提 Important,按 plan-mandated 走裁决,不擅自改。
- 其余任务间无矛盾,与 Global Constraints 无冲突。

## 进度

Task 0: complete (NimoOS-UI ea959bd8..7c4020d4, review clean)
  - 分支更正:NimoOS-UI **无 master**,迁移期工作分支 = `docs/vue3-migration-sp3`(领先 main 163),
    strangler.js 全部历史在该分支。plan Global Constraints 已更正。
  - 基线记录:Vue2 仓 `pnpm test` = **1425/1433,8 条预先失败**
    (`nimoTaskBar.test.js` + `settingsStore.test.js`,已在 pre-task commit 的一次性 worktree 复现)。
    后续任务/评审看到这 8 条红**不要去追**,只需确认数字未变坏。
  - 台账 ⚠️ 已自行核实:`enter-next` 确在现网 Home chunk(控制端本会话早前 grep 过)。
Task 1: complete (NimoOS-UI 7c4020d4..5e97862, review clean)
  - migratedEntries + resolveEntryTarget 落在 strangler.js 末尾,append-only 已核(cat -A 验 tab)。
  - strangler.spec.js 16/16;变异 A 变红、变异 B 不变红(预期,已裁定不补测试)。
  - 评审自查确认:SSR 无 localStorage 那条测试非空洞、契约无 undefined 返回路径、/ 与 /files 行为零变化。
Task 2: complete (NimoOS-UI ed9a2ac4, review clean)
  - Home.vue 早退 + Home.storageCutover.spec.js 3/3;两处变异各变红对应断言。
  - 偏离(已评审通过,合理):新 spec 内加了 7 个子组件 vi.mock —— Home.vue 静态 import 链
    (require.context 等)在 vitest 下模块加载即崩,与 mount 策略无关;仅作用于该 spec 文件。
  - **⚠️ 并发会话警报**:同一仓同一分支上有**另一个会话**在提交(`3ec29ca8` SP7-P5 验收关账
    docs,12:14:34,比本任务提交早 85 秒)。影响:①每个任务的 BASE 必须现取 HEAD,不能用
    上一任务的 hash 推断;②评审包要按「本任务的提交」范围出,否则会把别人的 diff 塞进去;
    ③**Task 6 部署 Vue2 时构建的是工作树** —— 届时须先看 git status,确认没把并发会话
    半成品带上线。
Task 3: complete (NimoOS-UI 2e6858fb, review clean)
  - Disks.vue + MountActionButton.vue 各加早退,4 文件单提交;埋点非对称已核(前者留、后者不加)。
  - Tab 缩进/引号风格照原文;两处实现除埋点外完全同型。
  - 全量 1440 passed / 8 failed(仍是那 8 条预先失败)。计数核对:1425 基线 + Task1 6 + Task2 3
    + Task3 5 ≈ 1439/1440,**不是**并发提交带来的(实现 agent 的那句归因有误,已裁定无害)。
  - 两条 Minor(评审判非缺陷,记录备查):新 spec 各加了 vi.mock 子组件桩(躲 wallpaper 资源
    解析崩溃,同 Task 2 先例);变异验证只在报告中留证、最终 diff 不可见(变异按设计已撤回)。
Task 4: complete (New-UI c8bac32, review clean)
  - storage 分支受 cutoverDisabled('/storage') 门控,回退落既有 SYS_ROUTE 兜底 → /#/legacy。
  - appsCutoverDisabled 合并为带参 cutoverDisabled(from);/apps 四条老用例未改动仍绿。
  - 全量 1572/1572 + vue-tsc 零错;spec 12/12。
  - **跨仓不变式已逐字核**:New-UI 的 `strangler:disabled:/storage` 与 Vue2 strangler.js
    的 migratedEntries('/storage' → flagKey 派生)字符级一致。
  - plan 的 Step 5 变异指令第二条点错了字面量(改 appstore 的 '/apps' 只会让 appstore 自己那条
    变红);实现 agent 改为变异 storage 分支参数,评审判定该变异确实证明「两把 flag 互不干扰」。
  - 并发会话的 3 个 design-export 暂存删除全程未被卷入(显式 pathspec 提交)。
Task 5: complete (无提交 —— 零 i18n 欠账,审计由控制端独立复跑验证)
  - 模板扫描 3 命中 = StorageRaidDetail.vue 两个多行 <!-- --> 注释的续行(sed 只剥单行注释);
    .ts 1 命中 + .vue script 1 命中 = 行尾 // 注释(正则被同行代码里的 '' 满足)。**全为假阳性**。
  - New-UI 门:parity+color-guard 125/125、全量 247 文件 1572/1572、vue-tsc 零错、pnpm build 成功。
  - Vue2 门:1440 passed / 8 failed(仍是原那 8 条:nimoTaskBar 5 + settingsStore 3),src/ 干净。
  - SP6 台账已写 .superpowers/sdd/sp6/progress-p6.md(留白待部署与验收结果)。

## 最终整支评审(opus,2026-07-30)= Ready to deploy
核过并确认成立:回退闭环(含 /legacy 不被 migratedRoutes 的精确 `/` 条目命中、Vue2 auth 守卫
不会因 version 键缺失强制登出)· 三处安全网 byte-identical 且无第四个 StorageManagerPanel 调用方
· 埋点非对称正确(MountActionButton 的 stubThis 不给 $messageBus,加了就抛 = 隐式守卫)
· New-UI 侧 /storage 只有 useOpenAction 一个导航入口 · 桩隔离无跨文件泄漏(两仓 vitest isolate 默认)
· 桩 this 测试确实有约束力(真 resolveEntryTarget + 真 localStorage)。

5 条 Minor 处置:
- [修] F1 Disks.spec.js 回退分支缺 $messageBus 断言 → 把埋点挪进 if(target) 也能全绿,静默杀掉
  回退路径埋点。护的是 Global Constraints 里的「两条路径都上报」。
- [修] F2 三处 spec 只断言 modal.open 调用次数、未断言 component 身份。
- [挂账] F3 跨仓字面量无自动守卫(重命名 migratedEntries[0].from 会让 Vue2 停止认 New-UI 写的 flag;
  两侧注释互指是唯一缓解)→ 后端/工程票,需跨仓测试基建。
- [挂账] F4 **NimoOS-UI/vitest.config.mjs:83 的 `moduleNameMapper` 是 Jest 选项,vitest 直接忽略**
  = 死配置,这正是新 spec 必须加 vi.mock 资源桩的真因;改到 resolve.alias 后future spec 就能真 mount。
- [挂账] F5 strangler.spec.js:83 `delete globalThis.localStorage` 无 try/finally(仅文件内、仅抛错时泄漏)。

## 修复波(最终评审 F1/F2)+ 部署
Fix wave: NimoOS-UI 5c325a42(仅 3 个 spec 文件 +12 行,零生产代码改动)
  - F1 ADDRESSED:Disks.spec.js 回退分支补 $messageBus 断言;变异(埋点移进 if)实测变红。
  - F2 ADDRESSED×2(Disks / MountActionButton:断言 component toBe StorageManagerPanel,
    该文件有三个不同弹窗目标,判别有效);**Home.spec.js 只到 floor level** —— 只断言
    component 是函数,换掉箭头函数里的 import 目标仍会绿。
  - **PARKED(裁定)**:再评审给了更强配方 = 断言 `component.toString()` 含
    'StorageManagerPanel.vue'(不触发真 dynamic import 也能查出换靶)。按「无第二轮修复波」
    规则挂账,不阻塞部署 —— 该失败模式需要有人刻意改箭头函数内的 import 路径,而弹窗块
    byte-untouched;真机验收 B 组会实际开一次老弹窗。**后续期顺手补这一行。**

部署(2026-07-30 13:07/13:08,均成功):
  - New-UI:`./scripts/deploy.sh` → /var/lib/nimoos/www/app/,入口 chunk **index-DqQrYxNE.js**
  - Vue2:`nimo_os_docs/scripts/deploy-ui.sh` → /var/lib/nimoos/www/(Hash 0017d5c593c93239)
  - 核实:/app/ 未被 Vue2 部署覆盖(13:07 vs 13:08);Vue2 产物里 `/app/#/storage` 与
    `strangler:disabled:/storage` 均可查到(FilePanel chunk + Home chunk)。
  - **顺带上线(用户 2026-07-30 拍板)**:SP8-P0 的 SSE 401 自愈(e2581e7f/e7637215/9f5e7a22,
    src/service/ai.js + agentStream.js)—— roadmap「P0 代码就绪未部署」那条挂账随本次清掉。
    验收须多验一条:AI 对话 token 过期后自愈不掉线。万一出问题可单独回滚这 3 个提交重部署。
