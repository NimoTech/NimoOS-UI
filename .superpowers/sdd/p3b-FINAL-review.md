# SP8-P3b 全支线终审(T9)

审阅范围:`4bfabfc`..`f6792a8`(11 提交,25 文件,+3594/-64)。
方法:不采信任何 report/review 结论;逐项回权威源(Vue2 蓝本 `NimoOS-UI/src/views/AI/Skills/*`、
后端 `NimoOS-AI/`、共享包 `.sp8/NimoOS-Service/src/ai.ts`)自读 + 自跑 + 探针实证。

**总判定:Ready to merge = With fixes(1 Critical / 2 Important / 5 Minor)。**

---

## 0. 我自己实测的门(非复核报告)

| 门 | 结果 |
|---|---|
| `pnpm test`(全量,输出落盘) | **296 文件 / 2554 例:1 红** —— `src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`,即台账已定性的 IndexedDB flaky。**单档复跑 14/14 绿**,归属既有噪声,与本期无关。 |
| `pnpm exec vue-tsc --noEmit` | exit 0 |
| `pnpm build` | exit 0,仅既有 >500KB chunk 警告 |
| 色字面量(全支线新增行) | 与协调者结论一致:`data-color="blue"` 是属性选择器;`--gloss-inset-dot` 是 tokens.scss **定义处**且浅(:369)/暗(:379)双块都有值,非豁免;剩 1 处是注释里的 Vue2 rgba(见 M1)。**scss 无守卫,已逐行人肉扫 `skills-styles.scss` 新增 303 行 + `sk-shared.scss` 新增 5 行:零裸色。** |
| i18n(**我自己程序化回源**) | 用脚本把 74 个新键从两档解析出来,与 Vue2 `src/assets/lang/{zh_CN,en_US}.json` **成对**比对:`zh_CN[en_value] === zh_value`,**mismatch = 0**;57 键逐字命中权威源;余 17 键全部是已申报的「Vue2 没有的新文案」(D3 卸载正文 / 11 个错误键 / D4 三键 / >1MiB 提示 / `aiSkTestHttpFailed` / `aiSkTestCompleted`——后者的英文即 Vue2 key 字面量,zh_CN.json 里确无该键)。零缺失、零重复。 |
| 后端仓是否被偷改 | `NimoOS-AI` 工作树只有 `builtin-skills/desktop-app-builder/SKILL.md` + `skills_seed.go`(seed 11→12)两处**与本期无关的既存改动**(desktop-app-builder 那条独立线);`.sp8/NimoOS-Service` 干净。全支线 diff 里零 `X-Agent-Provider-*` 注入。**D1 遵守。** |

---

## 1. 五条拍板偏离的落地核查

| | 结论 | 证据 |
|---|---|---|
| **D1 沙箱只做前端** | ✅ 落地 | `skillTestTransport.ts:1-34` 头注登记三段根因并明令禁止伪造头;两个后端仓无本期改动;全支线零 provider 头。实现者还订正了任务书行号(`agent/main.py` 2481→2477),我复核 `main.py:2477-2484` 确为 `Header(...)` 必填,`route/v2/skills_files.go:154-160` 确无注入,`route/v2/agent.go:124-146` 确有注入 —— 订正正确。 |
| **D2 连续文本累积成整段** | ✅ 落地 | `sandboxRun.ts:44-55` 上一步为 text 则追加;`TestPanel.test.ts:120` 三事件断言 2 行且首行 `'Hello'`。对照 Vue2 `TestPanel.vue:162` 确为逐片 push。 |
| **D3 卸载文案说实话** | ✅ 落地 | Vue2 `SkillDetail.vue:161` 原文「You can reinstall it later from the built-in catalog.」;本仓 `zh_cn` 「此界面无法恢复,需要重装系统或手工把技能目录放回。」/ `en_us` 「This interface cannot restore it — ...」。我复核 `route/v2.go:208-215` 九条 skills 路由确无 restore,`service/skills.go:330-340` 确只写标记。 |
| **D4 先弹窗、成功才跳转** | ⚠️ **主路径落地,有一条清除路径漏了** | 主路径实证见 §2(探针 A 绿)。漏洞见 **I1**:X/Esc/遮罩关窗不清 `pendingTryId`。 |
| **D5 只在成功完成时 +1** | ⚠️ **主路径落地,有一个反例** | `TestPanel.vue:125` 条件正确,SSE-error / HTTP-fail 两条路径都有钉住用例。反例见 **I2**:`error` 事件 content 为空时被当成功,反而 +1。后端 `RecordRun` 零调用点我已 grep 复核(`service/skills.go:352` 仅定义)。 |

---

## 2. 跨任务数据流核查(重点 2)

**链路:`SkillDetail`「启用并试用」→ emit toggle → `SkillsSection.onToggle` → `splice` 替换列表项 → `activeSkill` 重算 → props.skill 新对象 → `watch(enabled)` → 关弹窗 + 跳转。**

我顺着代码走了一遍(`SkillDetail.vue:302-331` / `SkillsSection.vue:171-185,143`),并**写了一次性集成探针实测**(挂真实 `SkillsSection`,mock 共享包与 router,走真 DOM 点击、真 reka Teleport):

- 探针 A:`updateSkill` resolve 裸 skill(enabled:true)→ `push({path:'/ai/agent',query:{skill:'a'}})` 被调、`.sk-modal` 消失。**链路完整,无断点。**T8 台账那条「跨组件链路无端到端整合测试」是**覆盖缺口而非缺陷** —— 我已实证。
- 关键环节复核:`splice(idx,1,updated)` 是新对象引用 ⇒ `activeSkill` computed 必重算 ⇒ `watch(() => props.skill?.enabled)` 必触发;`watch(() => props.skill?.id)` 因 id 未变不触发(不会误清挂号)。两个 watch 的调度顺序无依赖(代码里显式核对 `s.id === pendingTryId`)。
- **但链路上有一条隐性前提没有兜底**:`onToggle` 里 `if (idx !== -1 && updated)` 为假时(后端返回空体/非对象)**列表不更新但仍报成功 toast**,D4 弹窗会永远关不掉且没有任何错误提示。见 M5。

---

## 3. 单层取数口径(重点 3)

回源核对 `.sp8/NimoOS-Service/src/ai.ts:325-362`:`listSkills/createSkill/updateSkill/deleteSkill` **全部 `return res.data`**(已剥 axios),`exportSkillURL` 是同步 URL builder。
后端 `route/v2/skills.go`:`POST:105` 201 裸 skill、`PATCH:131` 走 `h.Get(c)` 200 裸 skill、`DELETE:143` 204 无内容 —— 我自己读的源码,与设计一致。

本期全部消费点(`SkillsSection.vue:153,174,193,219` + `SkillDetail.vue:215`)**均单层,零第二层 `.data`**。Vue2 `SkillsSection.vue:134,151,188` 三处错误全部未被照抄,且各有一条**反向信封用例**钉住(`SkillsSection.test.ts` 的两条「单层取数口径(反)」)。测试 mock 全部是裸数组/裸对象。**本项复发缺陷模具:未复发。**

## 4. 资源清理对称性(重点 4)

| 资源 | 挂 | 摘 | 判定 |
|---|---|---|---|
| `AbortController`(TestPanel) | `run()` 内同步 new | `onBeforeUnmount`(`:142-144`)+ `watch(skill.id)`(`:132-138`) | ✅ 两道都在,且**不在 await 之后挂**;`:key="skill.id"` 场景 watcher 不触发,兜底在 onBeforeUnmount(有 `卸载时调用 abort` 用例钉住,我做过 RED)。 |
| `document mousedown`(SkillDetail 菜单) | `useClickOutside` → `onMounted` | `onUnmounted` | ✅ 同步挂/摘、无 async 缝,不重演 P1c1 Task 7 那个「await 后挂 → 永不摘」。我读了 `composables/useClickOutside.ts` 全文。 |
| `setTimeout(focus,0)`(AddSkillModal:133) | 每次 open | 无句柄、无清理 | ⚠️ 台账 T5 minor。我复核:一次性、`nameInputEl.value?.focus()` 在卸载后是 no-op、无累积。**非缺陷,继续挂。** |
| toast timer | 走全局 store,非本期 | — | — |

## 5. 测试空转抽查(重点 5)

抽查了我认为最关键的 6 条:
- `SkillsSection.test.ts` 两条反向信封用例:有判别力(改回双层剥则值变 `'renamed'`)。
- 「删的不是当前选中项」用例:T8 已把 fixture 换成 `[a,b,c]`/选 c/删 b,两种实现结果确实分道。✅
- `onTest` 隔离用例:补了「对 b 也调一次」,硬编码 `idx=0` 会红。✅
- `TestPanel.test.ts` 的 D5 两条(SSE error / HTTP fail 都不 emit):有判别力。✅
- **`SkillDetail.test.ts:316` 标题与断言不符** —— 标题写「外部 mousedown 关闭菜单,**菜单内部点击不触发外部关闭逻辑**」,但用例体只测了外部 mousedown,内部点击那半句**零断言**。见 M2。
- **`skillsErrorKey.test.ts:103,107,111,115` 是把缺陷编码进断言的用例** —— 见 C1。

**RED 探针(要求项,已精确还原)**:删掉 `SkillDetail.vue:328` 的 `tryModalOpen.value = false` →
`SkillDetail.test.ts` **精确 1 例报红**(`D4「启用并试用」:父组件把 enabled 真的改成 true(toggle 成功)后,弹窗关闭 + push 同一步发生`),47 passed / 1 failed。
按备份逐字节还原(md5 `ace994c7bf3fd31ec50f1c2c973fbfeb` 前后一致),临时探针档已删,**`git status` 干净**。

## 6. 既有行为是否被削弱(重点 6)

对全支线 `*.test.ts` 做了删除行审计,唯四处删除全部是**结构性翻转/位移**,零断言丢失:
- P3a `:57`「不渲染 `.sw`/`.sk-pill-more`」→ 翻成 `true`,`.sk-menu` 仍 `false`(默认关闭)。
- P3a「TestPanel 不渲染」→ 翻成渲染。
- `hints` 从 3 个变 4 个、下标 2→3(TestPanel 段头自带一个 `.sk-section-hint`),文案断言 `'2 个文件'` 原样保留。
- `SkModal.test.ts` 原 6 条断言**逐字未改**,只追加 2 条;`v-if="slots.footer || slots.footerLeft"` 对三个既有消费方(只传 `footer`)恒真,行为不变。P2b 的 `SkModal` 未被削弱。

---

## 7. 判定清单

### Critical(必须修才能合并)

**C1 —— `src/ai/util/skillsErrorKey.ts:63`:提交前校验比后端**严**,把后端本来接受的名称直接堵死。**

后端 `service/skills_store.go:221` 是 `id := slugify(r.Name)` **先 slug 再校验**(`slugify` 在 `:17-35`:转小写、非 `[a-z0-9]` 一律折成单个 `-`、首尾去 `-`);源码注释 `:82-85` 明写「allows digit-leading IDs so slugify of names like `123 skill` don't get rejected」。
本仓却拿**原始 name** 去测 `SKILL_ID_RE`,且 `AddSkillModal.submit()`(`:157-162`)命中就 `return`,**请求根本不发**。

我的探针实测(已删):
```
validateSkillForm('invoice tagger') → 'aiSkErrBadId'   // 后端会建成 invoice-tagger
validateSkillForm('Invoice Tagger') → 'aiSkErrBadId'   // 同上
validateSkillForm('invoice_tagger') → 'aiSkErrBadId'   // 同上
```
**为什么是问题**:Vue2 里这三个名字都能建成功(Vue2 只查非空,后端 slug 后放行);本期新增的「逻辑照正确」栅栏把它们变成了**创建失败**——这是**用可复现的行为倒退换来的**校验,与公共约束 §3.6 授权的「与后端**同款**校验」不符,属未申报的偏离。用户只是在名称里打了个空格或大写就再也建不出技能。
更糟的是 `skillsErrorKey.test.ts:103/107/111/115` **把这条错误规则钉成了断言**(第六次踩「手编 fixture / 凭想象定契约」)。

**建议修法**:把 Go 的 `slugify` 逐条移植成前端纯函数(约 12 行),`validateSkillForm` 改成
`const id = slugify(name); if (!SKILL_ID_RE.test(id)) return 'aiSkErrBadId'`;
上述 4 条用例改成 `null`,另补真·非法用例(纯中文名 → slug 为空 → `aiSkErrBadId`;65 字符 → `aiSkErrBadId`)。`aiSkErrBadId` 文案随之应改成描述「会被转成 xxx」或保持现状均可(不阻断)。

### Important(应当修)

**I1 —— `SkillDetail.vue:508-524`(D4 弹窗)+ `:322-331`:X/Esc/遮罩关窗不清 `pendingTryId`,留下一枚「延迟触发的跳转地雷」。**

三条清除路径只覆盖了「取消按钮」(`cancelTryModal`)与「skill.id 变化」;而 `SkModal` 自带 `.sk-x` 关闭按钮 + reka 的 Esc / 遮罩关闭,这三种关法只把 `tryModalOpen` 置 false,`pendingTryId` **悬着**。

探针实测(已删):停用技能 → 点「启用并试用」→ toggle 失败(弹窗按设计留开)→ 用 `.sk-x` 关窗 → 之后用户在顶部条开关把它启用 → **`router.push` 被调 1 次**,用户被莫名甩进 `/ai/agent`。
**为什么是问题**:这正是文件头注释「清除路径①」自称要防的那个场景(「以后这个技能任何一次开关开都被误读成待跳转」),只是漏了一条入口。文案上还表现为「我只是打开了开关,页面自己跳走了」。

**建议修法**:`@update:open` 改成 `(v) => { tryModalOpen = v; if (!v) pendingTryId = null }`(或加 `watch(tryModalOpen)`),`cancelTryModal` 可随之收敛为只 `tryModalOpen = false`。补一条用例:X 关窗后再 `setProps(enabled:true)` → `push` 不被调用。

**I2 —— `TestPanel.vue:226-232` + `util/sandboxRun.ts:65`:`error` 事件 content 为空时,失败被渲染成成功并 +1(违反 D5 与设计 §5)。**

设计 §5 写的是「`error = String(ev.content ?? '')`(空则留空,**由 UI 填本地化兜底文案**)」—— reducer 照做了,**UI 那半没做**:`v-if="state === 'done' && sandbox.error"` 在 error 为空串时为假,于是走进成功分支。
Vue2 `TestPanel.vue:167` 是 `this.error = ev.content || $t('Run failed')`,不会有这个洞。后端 `agent/agent.py:999` 是 `{"type":"error","content": str(e)}`,`str(e)` 对无消息异常就是空串。

探针实测(已删):喂 `{type:'error'}` → 结果面板渲染 **「用时  毫秒 沙箱已关闭,没有文件被修改。」**,且 `calls` 3→4。
**为什么是问题**:一次失败被伪装成成功,同时踩穿 D5「只在成功完成时 +1」这条用户拍板线。

**建议修法**:给 `SandboxState` 加 `failed: boolean`(reducer 命中 `error` 事件即置 true,与 error 文本解耦),TestPanel 的失败分支判 `sandbox.failed`、正文 `sandbox.error || t('aiSkTestFailed')`,`emit('test')` 条件改 `!sandbox.failed`。补两条用例(空 content 的 error 事件:显示失败态 / 不 emit test)。

### Minor(可挂账,除 M1 建议顺手)

- **M1(= 台账 T4 deferred)`skills-styles.scss:517` 与 `TestPanel.vue:27`**:注释里原样敲了 Vue2 的 `rgba(255,59,48,0.18)`。违反公共约束 §6「注释里也不许出现 Vue2 原始色字面量,应改写成『引 file:line + 中文描述颜色』」的字面要求,且与同档两行之上 success 态注释的风格不一致。不触发任何守卫、不影响渲染。**2 行改动,建议合并前顺手清掉。**
- **M2 `SkillDetail.test.ts:316`**:用例标题承诺「菜单内部点击不触发外部关闭逻辑」,用例体没有对应断言 —— 标题虚报覆盖面,后人会误以为这半边有回归网。补 2 行(在 `.sk-menu button` 上 dispatch mousedown,断言菜单仍在)即可。
- **M3 `TestPanel.vue:66` / `SkillDetail.vue:148` / `SkillsSection.vue:236`**:设计 §6 与 Vue2 `SkillsSection.vue:204` 的事件都带 id(`emit('test', { id })` / `onTest({id})`),本仓落成裸 `emit('test')` + 父组件读 `activeId`。**未申报的偏离**(§2 判定「未申报的偏离本身就是缺陷」)。我做过探针 D 验证其**当前无害**:Vue 3 的 `emit` 对 `isUnmounted` 实例是 no-op,且 TestPanel 只为 activeSkill 渲染,故 `activeId` 恒等于面板技能;探针 D 绿(切技能中断在跑的沙箱不会把 +1 记到新技能头上)。**补一句申报注释即可,或改回带 id。**
- **M4 `src/ai/types/skill.ts:44,48`**:注释写 `POST /v2/ai/skills`,真实路径是 `/v1/ai/skills`(共享包 `ai.ts:16` `PREFIX='/ai'` 挂在 `/v1` base;Go 侧 `route/v2.go:209` 是 v2 handler 挂在 /v1/ai 组下)。纯文档漂移。
- **M5 `SkillsSection.vue:174-177`**:`updated` 为假值时**不替换列表项却照发成功 toast**。今天 PATCH 恒返 200 裸 skill 故不触发;但一旦触发,与 D4 叠加会得到「弹窗永远关不掉 + 一条成功提示」。可在 `else` 分支走 danger toast,或至少登记。

---

## 8. 台账已延后 Minor 的 triage

| 台账条目 | 裁定 | 理由 |
|---|---|---|
| **T2 minor** `validateSkillForm` 多重违规优先级 ≠ Go 的逐 rune 扫描 | **继续挂** | 单一违规场景与后端完全一致且已覆盖;只有多种违规同现时分类文案可能不同,不影响可否创建。⚠️ 修 C1 会碰同一函数,**不要顺手扩到这条**(要对齐得整体改成逐 rune),避免范围蔓延。 |
| **T4 minor** 注释里的 Vue2 rgba 字面量 | **合并前修** | 见 M1:白纸黑字的硬约束、2 行改动、零风险。 |
| **T5 minor** `setTimeout(focus,0)` 无句柄无清理 | **继续挂** | 我独立复核:一次性宏任务、卸载后 `?.focus()` no-op、无累积。非缺陷。 |
| **T7 minor** `s.id !== pendingTryId` 分支结构性不可达 | **继续挂** | 防御性冗余、fail-closed。**且修 I1 之后它更该留着**(多一条独立清除路径不影响该守卫的价值)。不要为覆盖它去写依赖 watcher 调度顺序的伪造测试。 |
| **T8 minor** D4 跨组件链路无端到端整合测试 | **合并前修(与 I1 的修复打包)** | 我用一次性探针证明这条集成测试**成本极低**(挂真 `SkillsSection` + `.set-app` host 即可,约 15 行),而它正是**唯一能抓到 I1 那类跨组件洞**的网。修 I1 时顺手落一条常驻用例。 |
| P3a 承继①`.scss` 无颜色守卫 | **继续挂** | 全仓基建票(扩 color-guard 会引爆 tokens.scss 头部 5 类存量豁免),不在本分区做。本期靠人肉扫已完成(§0)。 |
| P3a 承继②`types/skill.ts` 头注坐标笼统 | **继续挂**(顺带记 M4 的路径笔误,一起改) | 纯文档。 |
| P3a 承继③「点条目切 activeSkill」用例按 DOM 下标 | **继续挂** | 风险方向是假红非假绿。 |
| T6 记录的新噪声:`AgentComposer.test.ts` vue-i18n teardown 竞态 | **继续挂(观察)** | 我全量跑一次未复现(唯一红是 `persist.test.ts`)。保留登记,再现两次即立票。 |
| 设计 §14 其余(pendingSkillId 不绑会话 / sp8-ai 未合 master / 设备侧票 / P2b 5 条真机验收) | **继续挂** | 均超出本期范围;合并顺序仍须用户拍板。 |

---

## 9. 结论

代码质量整体高:1:1 复刻严谨(我逐段比对了顶部条、菜单四项+分隔线、确认弹窗、TestPanel 三种结果态、AddSkillModal 六字段与 payload,均逐字对得上)、单层取数口径零复发、资源清理对称、i18n 逐码点回源零 mismatch、既有断言零削弱、scss 零裸色。

**放行条件:修 C1(必须)+ I1、I2(应当),并把 M1 顺手清掉、把 T8 那条集成用例随 I1 一起落地。**
修完建议只跑受影响档 + 一次全量,不需要重开评审轮次 —— 三条问题的判据都已在本文写死(含可复用的探针构造方式)。
