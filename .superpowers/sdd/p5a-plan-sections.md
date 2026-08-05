## Global Constraints

- **设计文档**:`NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`(@`6a8f7825`)。**本计划与设计冲突时以设计为准**(P3b 教训 5)。
- **公共约束**:`.superpowers/sdd/p5a-common-constraints.md`(T0 产出,照 `p4-common-constraints.md` 改)。**任务 brief 与它冲突时以它为准。**
- **可写仓**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)与 `/home/nimo/NimoTech/.sp8/NimoOS-Service`(分支 `sp8-ai`)。**只读**:`/home/nimo/NimoTech/NimoOS-UI`(Vue2 蓝本 + 语言包)、`/home/nimo/NimoTech/NimoOS-AI`(后端契约)。**禁碰**:`/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)、`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7)。
- **蓝本一律 `git show main:<path>` 读**,不许读 `NimoOS-UI` 工作树(它是 2026-07-15 旧版,没有 `NotesView.vue`/`WikiView.vue`)。
- **不碰真机**:不跑 `./scripts/deploy.sh`,不写 `/var/lib`,不改任何后端仓。
- **提交纪律**:一个任务 = 一个语义提交;禁 `git add -A` / `git add .`,只许显式列路径;提交后 `git show --stat HEAD` + `git status` 自查;**不要** rebase / reset / stash / merge / push。
- **移植纪律**(用户 2026-07-27 拍板,长期有效):界面/视觉/交互/组件拆分严格 1:1;**逻辑/bug 不照抄** —— Vue2 的缺陷改成正确逻辑,但三件套齐全:① 代码注释注明 Vue2 `file:line` 是什么问题 ② 实现者报告显式申报 ③ 台账登记。**未申报的偏离本身就是缺陷。** 禁与需求无关的重构。
- **brief 给的测试代码若与「1:1 照 Vue2」冲突,是测试错,不是实现让步** —— 立即申报,不要默默让步(P2a `v-show`→`v-if` 事故)。
- **配色**:一切可见颜色走 `var(--…)`;`color-guard.test.ts` 逐行扫 `.vue` 的 `<style>` 块**且不跳注释行**,注释里也不许出现色字面量;**它不扫 `.scss`**(P3a RED 探针实证)→ `knowledge.scss` 靠人肉评审;禁 `theme-exception` 逃逸。目标:组件里**零 `<style>` 块**。
- **i18n**:新键前缀 **`aiKb*`**(已 grep 确认两档 0 命中);同时加 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`;中文值**逐字照 §附录 A 的表**,不许自行翻译改标点;字面 `@` 写成 `{'@'}`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。
- **三门(每任务提交前全过,全量,输出完整落盘不许 `| tail`)**:
  ```bash
  cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
  pnpm test                  > /tmp/p5a-tN-test.log  2>&1; echo "exit=$?"
  pnpm exec vue-tsc --noEmit > /tmp/p5a-tN-tsc.log   2>&1; echo "exit=$?"
  pnpm build                 > /tmp/p5a-tN-build.log 2>&1; echo "exit=$?"
  ```
- **基线**:New-UI `sp8-ai`@`99ee99a` = **303 文件 / 2719 例绿 · tsc exit 0 · build 成功**;Service `sp8-ai`@`c8f1919` = **190/190 绿**。
- **算术**:`color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量 +1**。本期新增 4 个 `.vue`:T3(`KIcon`)· T5(`KnowledgeDeferred`)· T10(`KnowledgeLayout`)· T12(`DashboardView`)。**其余任务不新增 `.vue`。**
- **已知噪声**:`src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`(既有 IndexedDB 全量并发 flaky,P3a 已定性)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态(P3b 记录一次)。只它们红就复跑一次并说明,不要顺手改。
- **测试质量**:禁空转用例(把生产代码对应那行删掉还能过 = 空转);无判别力断言必须做 RED 探针(故意弄坏 → 看到红 → 复原 → 看到绿,报告贴两段输出);「A 与 B 二选一」的分支两边都要对照用例;mock 骨架用 `vi.hoisted()`;异步断言用 `flushPromises()` 而非单个 `await nextTick()`。
- **评审**:每任务 fresh implementer + 独立评审,**评审最低 sonnet,禁 haiku**;评审不许采信实现者报告,须自读蓝本、自己 grep、自跑测试、自做至少一次 RED 探针并还原;不许改仓库、不许提交。

## 🔴 执行顺序(不是任务编号顺序)

任务编号按主题分组便于阅读,**实际派工必须照下面这条链**,因为存在跨任务依赖:

```
T0 → T1 → T2 → T3 → T4 → T5 → T8 → T6 → T9 → T7 → T10 → T11 → T12
```

- **T8(i18n)提前到 T6 之前**:T6 的 `fmtAgo` 走 i18n,它的测试断言里是中文值,没有键就只能硬编码英文绕过(禁止)。
- **T9(dashboardHelpers)必须在 T7 之前**:T7 的 `loadNotesSummary` 依赖 `summarizeNotes`。
- T3/T4/T5 相互独立,可并行;但**多 agent 共用一个 worktree 时 `git add -A` 会卷进他人在途文件**(P1c2 教训④)→ 派工按文件白名单隔离,同一时刻只允许一个 agent 提交。
- T1/T2 在 Service 仓,与 New-UI 侧任务无文件交集,可与 T3–T5 并行。

---


## 本期已授权偏离(每条命中都要按纪律三件套申报)

| # | 偏离 | 依据 |
|---|---|---|
| **K1** | **单层取数**:共享包 `service.*` 已 `return res.data`,Vue2 的 `r.data.xxx` 在本仓要写成 `body.xxx`。命中点见 §数据契约。 | 同一模具第五次(P2a/P3a/P3b/P4) |
| **K2** | **主题**:`.knowledge-app` 不照抄蓝本自带的冷蓝/oklch token 值,改 token 映射层(§附录 B);不照抄 `[data-theme="dark"] .knowledge-app` 选择器(在 Vue2 与 New-UI 都永不命中)。 | 用户 D5 |
| **K3** | **`.k-toast` 不移植**,改全局 `useToast().show()`。蓝本 `KnowledgeLayout.vue:96-99` 的 toast **无条件**渲染绿勾(`<KIcon name="check" color="white">`),失败提示也顶个成功勾。 | 承 P4 D2 |
| **K4** | **`KIcon` 移植成独立组件**,不复用 `AgentIcon`(实测 `code`/`download`/`grid`/`pause`/`settings`/`user` 六个同名图标异形,其中 `settings`/`user`/`grid` 被 rail 与移动端 tabs 用到)。 | 设计 §2.5 |
| **K5** | **HTTP 失败不回显后端 body**,改 i18n 键;表单类错误走行内。 | 承 P2b/P3b/P4 D5 |
| **K6** | **`console.error` 不照抄**。 | 承 P3a/P3b/P4 D4 |
| **K7** | **占位页机制**:未迁的 8 个 tab 走 `KnowledgeDeferred.vue`,rail 保持 9 项 1:1。P5f 清空 `DEFERRED_TABS` 但**保留机制**并由用例钉住。 | 承 P2a + P4 I2 |
| **K8** | **rail 页脚用户名改走本仓既定写法**(蓝本 `KnowledgeLayout.vue:176-181` 读 Vuex `$store.state.user.user_name` 并 try/catch 兜 `'You'`;本仓无 Vuex)。**照 `src/ai/components/settings/SettingsRail.vue:75-86` 的既有先例逐字复用**:`interface StoredUser { nickname?; username?; role? }` + `computed` 里 `JSON.parse(localStorage.getItem('user'))` 套 try/catch 兜 `{}` + `user.nickname \|\| user.username \|\| t('aiCfgYou')`。**注意:`useUserProfile()`(`src/stores/userProfile.ts`)里只有 `avatarVersion`/`bumpAvatarVersion`,没有用户名 —— 别去那里找。** 回落文案**复用既有键 `aiCfgYou`**(实测 zh=`你` / en=`You`,与蓝本的 `'You'` 语义一致),不新增键。 | 架构差 + i18n 硬约束 |
| **P1** | **`Vue.observable` → Pinia setup store** 的机械替换(`state.x` → `x.value`、`Vue.set` → 赋值、`actions.foo()` 互调 → 直接调本地函数)。等价物,非行为改动。 | 承 P2a settingsStore 先例 |
| **P2** | **定时器句柄移出 state**:蓝本把 `indexedFiles.pollTimer` 放在响应式 state 里。本仓改成模块级 `let indexedPollTimer`(与 `_toastTimer` 同款),理由:Pinia state 会被 devtools 序列化,句柄不是数据。行为等价(`startIndexedPolling` 的 `if (s.pollTimer) return` 语义原样保留)。 | 协调者按硬约束自定 |
| **P3** | **`knowledgeStore` 里两处直调 axios 改走包**:`api.get('/ai/agent/notes', {status:'draft',limit:200})` → `service.notes.list({status:'draft',limit:200})`;全部 `api.*('/ai/parser/...')` → `service.ai.parser*`。 | P0 既定「REST 一律走包」 |
| **P4** | **`.k-toast` 退役后 `store.state.toast` 与 `actions.toast()` 的去处**:`toast()` 保留为 store action(蓝本多处调用点依赖它),内部改调 `useToast().show(msg, 2400)`(蓝本自己的超时是 2400ms),`state.toast` 字段删除。 | K3 的连带 |

## 明确「照抄、不改」的 8 条(改了就是回归)

- **N1** `loadAllowlist()` 里 `enabled: !!e.enabled` 的布尔归一化 —— 后端**真发** SQLite 整数 0/1(实测 `{"ext":".bash","enabled":1,"source":"default"}`),不归一化 chip 永不视觉翻转。**照抄,连注释一起。**
- **N2** `DashboardView` 读 `stats.rate_per_min` / `done_last_10m` / `eta_s` —— 后端**实测不下发**这三个字段,`|| 0` 兜底后速率/ETA/10 分钟完成数恒为 0 与空串。**不是前端 bug,照抄**;验收清单里说明。
- **N3** `DashboardView.created()` 的 `Promise.all([loadOverview, loadRoots, loadNotesSummary]).finally(ready = true)` —— Wiki 后端挂死时整页骨架卡到 axios 60 s 超时。**用户 2026-07-31 明示不修**。
- **N4** `loadDistillJobs(filter)` 的「无过滤刷三桶 / 有过滤只刷该桶」不对称 —— 蓝本注释解释了它是防截断的有意设计。
- **N5** `d.total = jobs.length` 当截断判据(而不是比 `counts`)—— 蓝本注释说明这是刻意的免竞态选择。
- **N6** `loadWikiNode`/`loadWikiRaw` 只把 404 转 `null`、其余错误上抛。
- **N7** Go nil slice 序列化成 `null` → `(x || [])` 这类兜底是必要防御,**不许删**。
- **N8** rail 第 9 项显示 `$t('Settings')` = 「系统设置」,而 topbar 标题用 `titleKey: 'Advanced Settings'` = 「高级设置」—— 同一个页面两处不同措辞,是 Vue2 现状。**照抄,不许统一。**

## 数据契约(最容易翻车)

**Parser(经 `service.ai.parser*`,后端实测形状)**
```
parserStats()   → {queue_depth:{pending,running,failed,done}, indexed_files, total_vectors_text,
                   total_vectors_visual, last_cursor_ms, models:[{name,version,modality,dim}]}
                  ⚠️ 无 rate_per_min / done_last_10m / eta_s(见 N2)
parserState()   → {paused, concurrency, device, ocr_enabled, resolved_device}   ← 只有这 5 个字段
parserJobs({status,limit})            → {jobs:[{id,root_id,path,op,sub_modality,priority,attempts,
                                        last_error,locked_until,created_at,picked_at,done_at}]}
parserFiles(params)                   → {total,limit,offset,files:[{file_id,paths:[{root_id,path,mtime_ms}],
                                        sha256_full,size,mime,modalities_done,parser_version,indexed_at,
                                        tombstoned_at,vector_count,last_error,status}]}
parserAllowlistExtensions()           → {extensions:[{ext,enabled:0|1,source}]}   ← enabled 是整数
parserAllowlistFolders()              → {rules:[]}
parserControl({action,...})           → body
```
**Notes(经 `service.notes.*`,Python agent,后端实测形状)**
```
list({type,status,limit}) → 内部读 {notes:[…]} 并 map(normalizeNote) → 返回 Note[]
  实测单条:{id,user_id,path,title,description,type,status,created_by,revision,
            created_at,updated_at,source_refs:[{session_id}],tags:[…]}
getSettings()            → 实测只回 {notes_root,auto_extract};**不含** distill_roots/
                           distill_daily_cap/background_model(设备 agent 落后蓝本 157 行)
distill 四条端点         → 设备实测 404 `{"detail":"Not Found"}`(设计 §6.4)。
                           **本期只做 store 层与单测,不列真机验收项。**
```
**Wiki(经 `service.wiki.*`)**:`/roots` 响应 **PascalCase 且无 json tag**(`ID`/`Path`/`WatchMode`…),POST body 必须用 Go 字段名(下划线会被静默丢弃)。`/tree`、`/node`、`/raw` 是 snake_case。`getRoots()` 内部 `(body || []).map(normalizeRoot)`。**设备上 `/roots`、`/tree`、`/node` 超时,`/candidates` 实测返 `[]`。**

**🔴 单层取数命中清单(K1)**:`knowledgeStore` 里 `stats.data` → `stats` · `control.data` → `control` · `r.data.jobs` → `body.jobs` · `r.data.files`/`r.data.total` → `body.files`/`body.total` · `exts.data.extensions` → `body.extensions` · `folders.data.rules` → `body.rules` · `r.data.notes` → 改走 `service.notes.list()`(它内部已 map) · `createRoot` 的 `r.data` → 包内已剥,直接返回。
**测试 mock 一律照真实响应形状**;写 `{ data: … }` 就是把缺陷编码进断言。「同一方法在两个测试文件里被 mock 成不同形状」= red flag。

