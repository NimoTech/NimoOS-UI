# SP8-P3b —— 公共约束(实现者与评审者都必须先读)

**任务 brief 与本文件冲突时,以本文件为准。**
计划:`NimoOS-UI/docs/superpowers/plans/2026-07-30-vue3-migration-sp8-p3b-skills-write.md`
设计:`NimoOS-UI/docs/superpowers/specs/2026-07-30-vue3-migration-sp8-p3b-skills-write-design.md`

## 1. 工作区

- 可写:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。**本期只动这一个仓。**
- 只读:`/home/nimo/NimoTech/NimoOS-UI`(Vue2 老仓,读蓝本与语言包)、
  `/home/nimo/NimoTech/NimoOS-AI`(后端契约)、`/home/nimo/NimoTech/.sp8/NimoOS-Service`(共享包签名)。
- **禁碰**:`/home/nimo/NimoTech/NimoOS-New-UI`(SP6)、`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7)。
- **不碰真机**:不跑 `./scripts/deploy.sh`,不写 `/var/lib`。**本期不动 NimoOS-AI 后端**(用户拍板)。
- 禁用 `git add -A` / `git add .` —— 只许显式列路径;提交后 `git show --stat HEAD` + `git status` 自查。
- 一个任务 = 一个语义提交。**不要** rebase / reset / stash / merge / push。

## 2. 移植纪律(用户 2026-07-27 拍板)

- **界面 / 视觉 / 交互严格 1:1 照 Vue2**(DOM 结构、class、文案、尺寸、动效、键位、组件拆分)。
- **逻辑 / bug 不照抄**:Vue2 的缺陷、竞态、吞错改成正确逻辑,但必须三件套齐全:
  ① 代码注释注明「Vue2 原文 `file:line` 是什么问题、此处改成什么」
  ② 实现者报告里显式申报 ③ 台账登记(协调者据报告写)。
  **未申报的偏离本身就是缺陷。**
- 判据:「这条改动是在修一个**可复现的错误行为**吗?是 → 改并登记;否 → 照 Vue2。」
- 禁止与需求无关的重构 / 改名 / 换库 / 顺手优化。
- **brief 给的测试代码若与「1:1 照 Vue2」冲突,是测试错,不是实现让步**(P2a Task 7 教训)。
  发现冲突 → **立即申报**,不要默默让步。
- **brief/计划里标了「已核」的数据,评审仍须回权威源复核** —— 计划作者(协调者)也会错;
  P2a 的 4 条 Important 里 3 条根因在计划。本期计划已点名 3 处必须回源复核(见 §3 末)。

## 3. 本期已授权的偏离(照做,并按 §2 三件套申报)

用户 2026-07-30 拍板 4 条 + 协调者按既有先例自定 2 条 + 承 P3a 的既有口径:

1. **D2 沙箱输出累积成整段** —— 后端逐词发 `message_delta`(`NimoOS-AI/agent/agent.py:1266,1284`),
   Vue2 `TestPanel.vue:160-163` 每片一行带绿勾;本仓把连续文本片累积成一段,工具调用仍单独一行。
2. **D3 内置技能卸载文案说实话** —— 后端 `service/skills.go:330-340` 只写 `uninstalled=1` 标记,
   **全仓无恢复接口**;Vue2 `SkillDetail.vue:161` 却承诺「以后可从内置目录重新安装」。
3. **D4 停用技能点「在对话中试用」先提示** —— 收 P3a 挂账③(`skills_runtime.go:57` 把 disabled
   排除出运行时视图 → `X-Skill-Id` 照发但 agent 找不到 SKILL.md → 零反馈)。
4. **D5 测试次数只在成功完成时 +1** —— Vue2 `SkillsSection.vue:204-214` 一点运行就 +1,
   而后端 `service/skills.go:352 RecordRun` **全仓零调用点**、沙箱又必失败 = 双重谎报。
5. **HTTP 层失败不回显后端 body** —— 承 P2b「错误不再回显后端 JSON」,改本地化文案 + 状态码。
   (SSE `error` **事件**的 `content` 是后端人类可读文本,原样显示,不算回显。)
6. **新建表单提交前做与后端同款校验** —— Vue2 `AddSkillModal.vue:137-139` 只查非空,
   填完一屏才被后端一句英文顶回来。
7. **>1 MiB 脚本文件不再静默丢弃** —— Vue2 `:164-167` 直接 `continue`,用户看不到文件消失。
8. **颜色圆点不用内联 `:style`** —— Vue2 `:61` 是 `:style="{ background: c.bg }"`,违反本仓配色纪律。
9. **`SkillIcon.vue` 不移植**,统一用 `src/ai/components/icons/AgentIcon.vue`(承 P3a)。
10. **`.sk-toast` 不移植**,改用全局 `useToast().show`(承 P3a);Vue2 的 `console.error` 不照抄。
11. **弹窗外壳用 `SkModal`**(reka Dialog),不照抄 Vue2 的裸 `.sk-modal-bg` + `@click.self`(承 P2b)。
12. **复制走 `useCopyFeedback`**(内含 `copyText` 非安全上下文兜底 + 打勾态),
    不照抄 Vue2 `SkillDetail.vue:243-253` 手写的那份兜底。

**除这 12 条外的任何偏离都要先申报再做**;拿不准就在报告里写 `NEEDS_CONTEXT` 并停下。

**计划已点名、必须自己回权威源复核的 3 处**:
- 技能 ID 正则(`NimoOS-AI/service/skills_store.go` 的 `ValidateSkillID` + `agent/main.py:2489`)。
- Task 1 里「哪些色字面量需要新 token」(逐行自己扫,别信计划的举例)。
- Task 5 的行内错误类名是否真实存在(`grep`,先例 `.chan-field-err`)。

## 4. 数据契约(最容易翻车)

- 后端 `NimoOS-AI/route/v2/skills.go` 全是 `c.JSON(code, out)` —— **裸数组 / 裸对象,无信封**。
  - `POST /skills` → **201 裸 skill**(`:105`)
  - `PATCH /skills/:id` → **200 裸 skill**(`:131`,走 `h.Get(c)`)
  - `DELETE /skills/:id` → **204 无内容**(`:143`)—— 不许读返回值
- 共享包 `service.ai.*` 已 `return res.data` 剥掉 axios 层 → **消费端单层取数**。
  Vue2 `SkillsSection.vue:134,151,188` 三处都多剥了一层,恒 `undefined`。
- **测试 mock 一律裸数组 / 裸对象**;写 `{ data: … }` 就是把缺陷编码进断言。
- 「同一方法在两个测试文件里被 mock 成不同形状」= red flag,必有一处错。
- Go 的 nil slice 序列化成 `null` → `(skill.files || [])` 这类兜底是**必要防御,不许删**。
- **沙箱 SSE 在真机上必然 422**(三段根因见设计 §2 D1)—— 这是**已知后端票**,
  不是实现缺陷,不要为了"让它能跑"去改后端或伪造请求头。

## 5. 代码范式

- `<script setup lang="ts">`;`useI18n()` from `'vue-i18n'`;后端走
  `import { service } from '@nimotech/nimoos-service'`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。从
  `src/ai/components/settings/skills/` 出发:图标 `../../icons/AgentIcon.vue` ·
  同级 `./SkillTile.vue` · 上级 `../SkModal.vue` / `../SetSwitch.vue` ·
  util `../../../util/…` · services `../../../services/…` · types `../../../types/…` ·
  composables `../../../composables/…` · 应用级 store(toast)`../../../../stores/…`。
  从 `src/ai/components/settings/sections/` 出发:同级 skills 组件 `../skills/…`。
- 状态一律**组件本地 `ref`**,不塞 store、不新建 store(照 Vue2 的 `data` 归属,沿用 P2b 的 D2 决定)。
- toast 真签名:`show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`
  (`src/stores/toast.ts:18-27`)—— 默认 1500,要 3000 得显式传。
- **用到的每一个 CSS 类都要先 `grep` 确认真实存在**(`src/ai/styles/*.scss`)。
  凭空造的类渲染成无样式,而单测永远抓不到。目标:组件里**零 `<style>` 块**。
- 样板参考(已评审通过):`src/ai/components/settings/sections/{BlacklistSection,ExecutionSection,MemorySection,ChannelsSection}.vue`;
  SSE 先例 `src/ai/services/agentTransport.ts`;错误映射先例 `src/ai/util/channelsFormat.ts:65-76`。

## 6. 配色(硬约束)

- 一切可见颜色必须是 `var(--…)` token,**禁 `#hex` / `rgb()` / `rgba()` / 具名色**
  (`white`/`black` 也算,虽然 color-guard 认不出)。
- `src/styles/color-guard.test.ts` **逐行扫 `.vue` 的 `<style>` 块且不跳注释行** ——
  注释里也不许出现 Vue2 的原始色字面量,改写成「引 Vue2 `file:line` + 中文描述颜色」。
- **⚠️ color-guard 不扫 `.scss`**(P3a 用 RED 探针实证过:往 `.sk-tile` 注入 `#ff00ff` 全量仍绿)。
  Task 1 那 8 段 scss 的颜色纪律**没有回归网,靠评审逐行人肉扫**。
- **禁止用 `theme-exception` 逃逸**(豁免会延续到下一个 `;` 或 `}`,连带豁免后面真正的声明)。
- **内联 `:style` 里的颜色同样违规**(本期命中:Vue2 `AddSkillModal.vue:61` 的颜色圆点底色 →
  改 `data-color` + SCSS 规则,见 §3 偏离 8)。尺寸/字体的内联 style 不受限,照抄。
- 新增 token 必须在浅色与 `[data-theme="dark"]` 两块都有值(纯装饰、主题无关的渐变除外 ——
  照 `tokens.scss:220-221` 的 `--grad-photo`/`--grad-file` 与 P3a 的 7 个 `--grad-sk-*` 现状办)。
- 新增豁免必须登记进 `tokens.scss` 头部例外清单 + `docs/THEMING.md`。

## 7. i18n

- 新键**同时**加进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`parity.test.ts` 断言键集一致)。
- 值**逐字照计划 Task 2.3 的表**,**不许自行翻译、不许改标点**。
  英文档取 Vue2 的 key 字面量(`en_US.json` 大量缺键,Vue2 实际显示的就是 key 本身)。
- 写之前 `grep` 确认键不存在(重复属性 = TS 错误);能复用的复用
  (`aiCancel` / `aiCfgRefresh` / `aiSkDescription` / `aiSkTrigger` / `aiSkTagManual` / `aiCopied`)。
- 值里的字面 `@` 写成 `{'@'}`(`messageSyntax.test.ts` 全键守卫会拦,P1c1 踩过真故障)。
  本期两条文案含尖括号(`aiSkScriptsHint` / `aiSkErrDescAngle`)—— **必须实测渲染**。
- 报告里列清「复用了哪些 / 新增了哪些 / 哪些是 Vue2 没有的新文案」。

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p3b-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p3b-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p3b-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集** —— 守卫散落在 `src/styles/color-guard.test.ts` 与
  `src/i18n/{parity,messageSyntax}.test.ts`,只有全量能抓。
- **输出完整落盘,不许 `| tail`**(P2b 教训:一条红被 `tail -6` 截掉,失败用例名永久丢失;
  P3a 靠这条纪律让同一条红留下了名字并定性)。
  报告里贴 `Test Files` / `Tests` 两行汇总 + 任何红项的**完整用例名**。
- 基线:**291 文件 / 2418 例绿 · tsc exit 0 · build 成功**(协调者 2026-07-30 复跑确认)。
- **算术**:`color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量 +1**
  (与该组件自带用例数无关)。本期新增 2 个 `.vue`(TestPanel / AddSkillModal)。
- 已知噪声:`src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`
  是既有 IndexedDB 并发 flaky(P3a 已定性,与本期无关),只它红就复跑一次并说明。
- `pnpm build` 只允许既有第三方包警告 + >500KB chunk 警告。

## 9. 测试质量

- **禁空转用例**:把生产代码里对应那行删掉还能过,就是空转。
- **无判别力的断言要做 RED 验证**:故意弄坏 → 看到红 → 复原 → 看到绿,报告里贴两段输出。
  典型高危:单元素数组上测 `.some`/`.every`、`not.toThrow()` 套异步、选择器在组件里根本不存在。
- vitest mock 骨架用 **`vi.hoisted()`**(裸 `const` 放 `vi.mock` 之前会因 ESM 提升抛
  TDZ ReferenceError;先例 `src/ai/stores/agentStore.test.ts:4-19`)。
- 异步断言用 **`flushPromises()`**,不要单个 `await nextTick()`(P1c1 T5 教训:
  单个 nextTick 会读到 scheduler 未刷新的旧 props 而**假通过**)。
- 测 reka-ui Teleport 组件(`SkModal`),挂载后必须先 `await nextTick()` 再查 `document`。
- **不许削弱或删除既有断言**来让测试变绿。本期 T6/T7 要**反转**(不是删除)
  `SkillDetail.test.ts:57` 与 `:146` 那两条「不渲染写操作控件(P3b 范围)」的用例,
  报告里必须贴改前/改后原文。

## 10. 报告契约(实现者)

完整报告写进 `.superpowers/sdd/p3b-task-N-report.md`,至少包含:
逐文件改了什么 · Vue2 `file:line` → New-UI 的对照 · 承接了 Vue2 哪些行为 ·
RED→GREEN 证据 · 三门完整终值(含红项完整用例名与归属)· i18n 复用/新增键清单 ·
**每一条偏离显式申报**(含 §3 那 12 条里本任务命中的)· §3 末三处回源复核的结论。

返回给协调者的只有 **≤15 行**:状态(DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED)·
提交 sha · 一行测试结果 · 顾虑。

## 11. 评审者附加要求

- **评审最低 sonnet,禁 haiku**(haiku 在本期项目上误报过两次)。
- **不许采信实现者报告**:自己打开 Vue2 蓝本逐项对标记/类名/顺序/禁用条件、自己 grep、自己跑测试。
- i18n 值回 Vue2 生产语言包 `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`
  **逐字符复核**,含标点与省略号;并确认每个键在两档里都在、且没被定义两次。
  §3 那 9 条「Vue2 没有的新文案」不在语言包里,按设计文档核。
- 用到的每个 CSS 类自己 grep 确认存在。**Task 1 的 scss 要逐行扫色字面量**(无守卫)。
- **至少做一次 RED 验证**:最小化破坏生产代码 → 确认对应用例精确报红 → 精确还原
  (`git status` 必须干净),评审里写明破坏了什么、已还原。
- 检查用例是否空转、既有用例是否被削弱/删除、提交是否只含本任务文件。
- **不许改仓库**(RED 探针除外且必须还原),**不许提交任何东西**。
- 评审全文写进 `.superpowers/sdd/p3b-task-N-review.md`;返回给协调者 **≤25 行**:
  两个判定(Critical / Important 各几条)· 每条发现一行(带严重度)· RED 探针 + 已还原 ·
  自己实测的测试数字(红项要归属)。
