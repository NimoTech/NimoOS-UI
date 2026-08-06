# SP8-P5a 整期全支线终审(opus,2026-08-01)

范围:New-UI `sp8-ai` `99ee99a..466b7f8`(**实测 21 个提交**,台账写 17,见 G)· Service `sp8-ai`
`c8f1919..03d3028`(**实测 4 个提交**,台账写 3)。

方法纪律:实现者报告与 13 份单任务评审**一律未采信**。所有蓝本一律 `git show main:` 读;
所有数字自己跑;所有集合关系自己写脚本算;两次独立 RED 探针。

## 总判定

**可以交用户验收。** 零 Critical、零 Important。

发现共 5 条 Minor + 1 条覆盖缺口 + 2 条 ⚠️ 观察,全部**不影响人眼验收**(其中 3 条是台账
自己挂账的注释/文档错字,2 条是本次新发现的申报遗漏)。建议在验收前后随手收进**一个
纯文档提交**——特别是 H6,它在 `p5a-common-constraints.md` 里,而那个文件是**本期唯一
被 git 跟踪的台账文件**(`.superpowers/sdd/.gitignore` 是 `*`,该文件被显式 add 过),
P5b 的实现者会照它做算术。

---

## A. 12 条已授权偏离 —— 三件套核查

| # | 代码注释(蓝本 file:line + 改成什么) | 报告申报 | 台账 | 判定 |
|---|---|---|---|---|
| K1 单层取数 | `knowledgeStore.ts:18-25` 逐点列出 7 个命中改写;`:478-479` `:611` 就地复述 | T1/T2/T6/T7/T9/T10/T12 | ✓ | ✅ |
| K2 主题映射层 | `knowledge.scss:11-15`(+ 头注释 43-67 三同名 token 订正)· `KnowledgeLayout.vue:27-30` | T4/T7/T11 | ✓ | ✅ |
| K3 `.k-toast` 不移植 | `KnowledgeLayout.vue:11`(蓝本 `:92-96`)· `knowledgeStore.ts:39-44` · 反向守卫 `knowledgeStyles.test.ts:89-92` | T0/T4/T7/T10 | ✓ | ✅ |
| K4 `KIcon` 独立组件 | `KIcon.vue:3-7`,点名 6 个同名异形 glyph | T3/T7 | ✓ | ✅ |
| K5 失败不回显 body | `knowledgeStore.ts:587-589`(蓝本 `:244-253` 原文拼 `e.message`) | T6/T7/T12 | ✓ | ✅ |
| K6 `console.error` 不照抄 | `knowledgeStore.ts:477-478`;生产码 `console.` 命中数 = **0** | T6/T7/T12 | ✓ | ✅ |
| K7 占位页机制 | `deferred.ts:1-4` · `KnowledgeDeferred.vue:2-13` · `knowledgeRoutes.ts:14-28` | T5/T7/T10 | ✓ | ✅ |
| K8 rail 用户名走 localStorage | `KnowledgeLayout.vue:153-156`(蓝本 `:176-181` 读 Vuex) | T10 | ✓ | ✅ |
| P1 Pinia 替换 | `knowledgeStore.ts:27-31` 四条机械映射表 | T6/T7 等 | ✓ | ✅ |
| P2 定时器句柄移出 state | `knowledgeStore.ts:33-37` + `:201` 定义处 + `:447-449` 守卫处 | T6/T7 | ✓ | ✅ |
| P3 直调 axios 改走包 | **⚠️ 见 Minor-1**:改动本身在 `:18-25`/`:478-479` 讲清了,但全仓 `grep -n 'P3\b' src/ai/knowledge` = **0 命中**,标号没落 | T6/T7 | ✓ | ⚠️ 实质齐、标号缺 |
| P4 `toast()` 保留为 action | `knowledgeStore.ts:39-44` + `:297-300`;`parser.test.ts:207` 钉死 `(msg, 2400)` | T0/T2/T3/T4/T5/T6/T8/T9/T10/T12 | ✓ | ✅ |

独立复核的要点:
- **K4 的要害自己验过**:`git diff 99ee99a..HEAD -- src/ai/components/icons/AgentIcon.vue` 空 → 一个字节没动。
  另用 Python 把蓝本 `KIcon.vue` 与移植版的 `PATHS` 体各自解析成字典比对:**42 键 vs 42 键,
  键集差 0,值串差 0**(不是复述实现者的 md5,是本次独立重做)。
- **K8 结构**:`interface StoredUser` → `computed` + `JSON.parse(localStorage.getItem('user'))`
  套 try/catch 兜 `{}` → `nickname || username || t('aiCfgYou')`,与 `SettingsRail.vue` 同构;
  未新增 i18n 键(`aiCfgYou` 是全知识库区唯一的非 `aiKb*` 引用键,已验证)。

## B. 8 条「照抄不改」

全部**原样**,逐条回蓝本字符级比对,**零回归**。

- **N1** ✅ `knowledgeStore.ts:373` `enabled: !!e.enabled`,蓝本 `:222-225` 的注释也搬了
  (措辞按本仓语境重写,语义等价);fixture 用整数 `1`/`0`(`parser.test.ts:102`),
  所以那层归一化真测得到。
- **N2** ✅ `DashboardView.vue:139/141/143` 三处 `|| 0` / `fmtEta(undefined)`;`ParserStats`
  故意不声明这三个字段;`DashboardView.test.ts:447-463` 用**整行精确匹配**钉住
  「渲染 0」而不是「隐藏这一块」。
- **N3** ✅ `DashboardView.vue:210-214` `Promise.all([...]).finally(ready=true)` 原样;
  fail-fast 判别钉子在 `:631-656`(loadRoots 立即 reject + loadOverview 永久悬挂)。
- **N4** ✅ `knowledgeStore.ts:559-563` 三条 `if (!filter || filter === 'x')` 不对称原样,
  蓝本大段注释一并搬入 `:540-551`。
- **N5** ✅ `:566` `d.total = rows.length`(蓝本 `d.total = jobs.length`,只改了局部变量名
  以避开 store 里同名的 `jobs` ref —— 语义同一)。
- **N6** ✅ `:645-664` 只把 404 转 null,其余 `throw e`;两侧用例齐(404 → null / 500 → 上抛)。
- **N7** ✅ 六处兜底全在:`body.jobs || []` · `(exts.extensions || [])` · `folders.rules || []`
  · `body.files || []` · `body.total || 0` · `summarizeNotes` 的 `notes || []`;
  包侧 `wiki.ts:151/156/162` 的 `|| []`(Go nil slice → null)也在,且有专门用例。
- **N8** ✅ rail 第 9 项 `aiKbNavSettings`=「系统设置」,topbar `aiKbTitleAdvancedSettings`=
  「高级设置」;`KnowledgeLayout.test.ts:218-226` 有正向 + `not.toBe` 双钉子。
  `messageSyntax.test.ts` 的键表也把两个键分开圈住,没被合并。

## C. 跨任务一致性(单任务评审看不到的层)

1. **mock 形状** —— 全仓知识库测试里 `{ data:` 命中数 **0**。三个 mock 服务包的文件:
   - `parserStats`/`parserState`:`parser.test.ts:24-27` 与 `KnowledgeLayout.test.ts:24-37`
     两处**都是裸 body、字段集一致** ✓
   - `notes.list`:`notesWiki.test.ts:55/72/81` 与 `KnowledgeLayout.test.ts:39` 两处**都返回数组**
     (不是 `{notes:[…]}`,因为包内已 map)✓
   - `wiki.getRoots`:`notesWiki.test.ts:35-46`(ROOT)与 `DashboardView.test.ts:31-57`
     (ROOTS/ROOTS_MIXED)两处**都是 camelCase 归一化后形状**(`watchMode`/`lastScanAt`/
     `needsReconcile`/`level`/`enabled`),与 `wiki.ts:85-98` `normalizeRoot` 的输出逐字段吻合 ✓
   - `DashboardView.test.ts` 不 mock 服务包,而是 spy 三个 store action —— 组件本身不碰
     `service.*`,这是正确的隔离层次,不算形状分歧。
   **红旗数:0。**
2. **命名与签名** —— 逐个 grep,每个标识符全仓**唯一定义 + 一处导出**,消费端签名一致:
   `useKnowledgeStore`(store id `'ai-knowledge'`)· `DISTILL_JOBS_LIMIT=500` ·
   `fmtAgo(ms)` · `DEFERRED_TABS` · `isDeferred(id)` · `KnowledgeTabId`(9 项联合)·
   `summarizeNotes(notes)` · `progressPercent(backlog, peak)` · `fmtEta(etaS)` ·
   `updatePeak(peak, backlog)` · `buildListParams` · `anyIndexing`。零改名、零重复签名。
3. **重复实现** —— 无。四个纯函数只在 `util/dashboardHelpers.ts` 各一份;两个只在
   `util/indexedFiles.ts` 各一份;`fmtAgo` 只在 store 里一份(`DashboardView` 是 import,
   不是自己再写一遍);`isDeferred` 的成员检查只有 `deferred.ts` 一处。
4. **`knowledge.scss` 102 个类** —— 组件模板里出现的 106 个 class(含 `suffix`/`second`/
   `spin`/`ghost`/`primary`/`outline` 等修饰子类)**全部在 scss 里有规则**,反向缺口 0。
   白名单里**没被任何组件用到的只有 2 个**:`k-empty-tips` / `k-empty-tip` ——
   这是 R1 裁定时明说「后续批次空态要用」而提前搬的,属**已授权的预留**,不是缺陷。
   (`k-badge-dot` 有模板引用,只是 `badges` 永不产出 `kind:'dot'` —— 蓝本同样,照抄正确。)
5. **i18n 96 键** —— 自写脚本核:
   - `zh_cn.ts` 96 条 / `en_us.ts` 96 条,**键集完全相同、各自零重复定义**;
   - **死键 0 条** —— 96 条全部被 4 个生产文件(`knowledgeStore.ts` / `KnowledgeLayout.vue`
     / `DashboardView.vue` / `KnowledgeDeferred.vue`)真实引用(扫描前已剥块注释/行注释/
     HTML 注释,防注释撞对);
   - 反向:组件里每个 `t('…')` 键都在两档里,`used-but-undeclared` = 0;
   - **值的权威性**:把 `en_us.ts` 的值当 Vue2 语言包的键去查 `git show
     main:src/assets/lang/zh_CN.json`,**95/96 命中,且 95 条的中文值与 zh_CN.json
     逐码点完全一致(mismatch = 0)**;唯一未命中的是 `aiKbDeferredHint`(本期新造文案,
     Vue2 无源,符合附录 A)。`aiKbDeferredTitle`「即将上线」意外地也在 Vue2 包里并且吻合。
6. **路由终态** —— 父路由 `/ai/knowledge` → `KnowledgeLayout`;`''` → `DashboardView`;
   其余 8 子路由 + `/ai/parser` + `/ai/parser/test` → `KnowledgeDeferred`(共 10 条)。
   子路由 path 顺序 `'' search wiki indexed-files queue roots allowlist notes settings`
   与蓝本 `route.js:186-195` **逐条吻合**(含 wiki 在 search 后、notes 在 allowlist 后
   两处陷阱);11 个 name 全 PascalCase 逐字照抄。`DEFERRED_TABS` 8 项、**不含 dashboard** ✓。
   rail `NAV` 9 项 id 与 9 条路由(dashboard 对应 `''`)**一一对应** ✓。
   `router/index.ts` 足迹只有 +2 行(import + 展开)。

## D. 配色(本期最大风险)

1. **色字面量** —— 自写扫描器(hex / rgb(a) / hsl(a) / lab / lch / hwb / oklab / oklch /
   `color()` / 21 个具名色,左右双向 `(?<![\w-])…(?![\w-])`),对**未剥注释的原文**跑,
   只切掉两个 token 声明块(`:74-158` 暗 / `:161-235` 浅):
   **声明层之外命中数 = 0**(含文件头 68 行注释块、含 T11 段全部行尾注释)。
2. **`var()` 闭环** —— 62 个唯一 `var(--x)` 引用,逐个在「本档任意声明(含 `.k2-layer`/
   `.k2-ob-layer` 规则体内的 `--ly`/`--ly-soft`/`--ly-ln`)∪ 全局 `theme.css`」里查:
   **唯一解析不到的是 `--g`**,即已登记的模板 inline 注入例外(`DashboardView.vue:379/382/385`
   三处静态 `style="--g: var(--ly-*)"`,测试 `:404-406` 精确钉住)。**闭环无破口。**
   借全局解析的 13 个:`--accent-soft-2 --accent-text --bg --card-bg --card-border --fg
   --fg-faint --fg-muted --on-accent --toast-danger-fg --toast-warn-fg --tool-bg --tool-bg-hi`,
   逐个在 `theme.css` 的**两档**里都确认有值。
3. **两档完整性 —— 无第二处漏声明。** 集合差:暗块 56 个声明 / 浅块 45 个,
   **只在暗块出现的 11 个**逐个判定:
   - `--r-xs/-sm/-md/-lg/-xl/-2xl/-pill`(7)+ `--font-sans`/`--font-mono`(2)= **真结构量**,
     附录 B 明令两档共享 ✓
   - `--grad-iri` / `--grad-iri-soft`(2)= 品牌彩虹渐变。**回源核实:`tokens.scss` 自己
     也只在 `:119-120` 声明一次、暗色块 `:250+` 不重定义**,`.agent-app` 在两档共用同一份
     —— 与本档做法一致,属 `theme.css` 例外清单第 1 类(品牌识别色、皮肤无关),**不是漏**。
   → **R4(`--shadow-*` 两档分声明)之外没有第二处同类事故。**
4. **四个 `.vue`**:`<style>` 块 **0 个**(仅注释里提到「零 `<style>` 块」);
   `style="…"` 内联属性里**颜色字面量 0 处**(全是 `flex`/`min-width`/`display`/`height`/
   `width` 与 `--g: var(--ly-*)`)。
5. **类名串号 / 泄漏** —— 把 102 个白名单类逐个拿去 `agent-styles.scss` /
   `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` / `tokens.scss` /
   `theme.css` 里查:**重名 0**。另查这四档的**顶层未作用域选择器**:
   `skills-styles.scss` 有 42 个、`sk-shared.scss` 有 11 个裸 `.sk-*` 顶层规则(它们随
   `SettingsPage.vue` 的 import 进了同一份全局 CSS),但**全部是 `.sk-` 前缀**,与
   `.k-*`/`.k2-*` 无交集,不会捞走知识库区。`.knowledge-app` 是顶层路由、**不嵌在
   `.agent-app` 里**,所以 `.agent-app .x` 那类作用域规则也命中不了它。
   顺手多查一层:**`@keyframes` 名字也不撞** —— `k-float/k-pulse/k-pulse-orb/k-shimmer/
   k-fade-in/k-modal-pop/k-toast-rise/k2pulse/k2spin` 在全仓各只出现一次。
6. **R9 ① 的数值我自己算过,结论「精确等值」成立**:
   - 浅档 `color-mix(in srgb, var(--text-on-accent) 50%, transparent)`,浅档
     `--text-on-accent: var(--on-accent)` = `theme.css:186` `#ffffff` → `rgba(255,255,255,0.5)`
     == 蓝本 `:2416` `rgba(255, 255, 255, 0.5)` **完全相等**。
   - 暗档 `color-mix(in srgb, var(--modal-scrim) 50%, transparent)`,`--modal-scrim` =
     `rgba(0,0,0,0.5)` → alpha `0.5×0.5 = 0.25` → `rgba(0,0,0,0.25)` == 蓝本 `:2451`
     `rgba(0, 0, 0, 0.25)` **完全相等**。
   顺带确认一处**没踩的坑**:暗档 `--text-on-accent` 写的是字面 `#ffffff`(tokens.scss:275),
   **没有**写 `var(--on-accent)` —— 全局暗档的 `--on-accent` 是 `#16203a`(深蓝),若图省事
   写成 `var()`,`.k-badge`/`.k-btn.primary` 的前景与 `.k-empty-illust` 的高光在暗色下会
   全部变深蓝。这处是对的。

### D 的两条 ⚠️(不构成缺陷,建议进 P5b brief)

- **⚠️-D1(覆盖缺口,RED 探针 1 实证)**:浅色档除「3 个同名 token + 6 个 `*-soft/scrim`
  + 4 个 `--shadow-*`」这 13 个被点名钉住的以外,**任何一个颜色 token 从浅块消失都没有
  守卫**。探针:删掉 `knowledge.scss:208` `--line-strong: #D8D3C7;` → `knowledgeStyles` +
  `color-guard` **209/209 全绿**。真机后果 = 浅色主题下 `.k2-root-add` 的虚线边框取暗档
  `#3A3A3D`。**现在没有实际漏项**(见 D3),但 P5b 起 scss 会继续长,建议把守卫改成
  「暗块声明的每个**颜色**token(排除 `--r-*`/`--font-*`/`--grad-iri*` 白名单)必须在
  浅块也有」的集合断言,一次性覆盖将来所有 token。
- **⚠️-D2(观察)**:浅色档里 `--warning`/`--danger`/`--success` 的**前景**取自
  `theme.css`(`#92600c` / `#c0392b` / `#15754c`),而它们的 `*-soft` **底色**取自
  `tokens.scss`(`rgba(200,134,10,…)` / `rgba(215,73,59,…)` / `rgba(46,158,84,…)`)——
  同色系但 RGB 不同源;**暗色档三对都是同源的**(`#E0A53B`↔`rgba(224,165,59,…)` 等)。
  在 10–24% alpha 的底色上肉眼基本不可辨,且两条取值都是附录 B / R2 明令,不算偏离。
  只记一笔:若 P5b 出现大面积 warning/danger 实底,再统一(正解是浅档 `--warning: #C8860A`
  等取 `tokens.scss` 同源值)。`--accent`↔`--accent-soft` 浅档是同源的(都是 59,91,219)✓。

## E. 测试质量总检

1. **没有第 7 例「文本判据没锚定 / 没排除注释」。** 把本期新增/改动的每一条文本类判据
   逐个过了一遍(重点是最像会栽的几处):
   - `knowledgeStyles.test.ts:85` 白名单存在性:`\.${c}(?![\w-])` —— 右边界是负向前瞻,
     `.k-topbar` 不会被 `.k-topbar-title` 撞对(这正是 T4 那次事故的修法),9 个前缀类都真钉住。
   - `:225-226` R2 的 `toContain('--danger-soft:')`:**结尾的冒号就是右锚**,
     `--danger-soft-border:` 满足不了它;`--warning-soft:` vs `--warning-soft-border:` 同理。
     且比对的是 `stripComments` 后的 body,注释撞不上。
   - `:164-203` 色扫:跑在**未剥注释的 `rawSource`** 上,只切两个声明块;区间起点是
     `^selectorLiteral$` 行首整行锚定 + `.exec()` 取第一个匹配。
   - `:397-399` import 守卫:`trimmed.startsWith('import') && trimmed.includes(needle)`
     —— 注释行过不了「整行以 import 开头」这一关。
   - `KIcon.test.ts:41` `toContain('rx="1"')`:**收尾的双引号是右锚**,AgentIcon 的
     `rx="1.2"` 满足不了(我逐字符验过),这条不是第 7 例。`:44` `M10 3v9` 同理
     (AgentIcon 是 `M10 3v10`)。
   - `router/index.test.ts:22-24` `toContain` 作用于**数组**,是元素精确匹配,不是子串。
   - `messageSyntax.test.ts` 两条新守卫:键表长度各有 `toBe(94)`/`toBe(13)` 防漂移;
     例外 `aiKbServiceOfflineBanner` 是 `toBe` 全值强断言而不是「跳过扫描」;
     占位符解析用的 `g` 正则每轮 `while` 都跑到 `null`(lastIndex 自动归零),无跨调用污染。
2. **空转** —— 未发现。RED 探针 2 反向确认了色扫**不是**只对第一个 `.knowledge-app {`
   块生效(见下)。
3. **弱断言残留:1 条 Minor** —— `KnowledgeLayout.test.ts:207`
   `expect(...text()).toContain('1,234')`:`'11,234'.includes('1,234')` 为真,所以「读错
   字段拿到 11234」这类错它抓不到(能抓到的只有「`toLocaleString()` 被去掉」)。
   同文件其余数值/文案断言都是 `toBe` 整串。`DashboardView.test.ts` 里唯一剩下的
   `toContain` 是 `:440` `not.toContain('NaN')` —— 负向存在性检查,不是弱断言。
4. **既有断言有没有被削弱** —— 有机械证明:`git diff 99ee99a..HEAD --stat` 是
   **27 文件 / 5635 insertions / 0 deletions**,Service 侧 **5 文件 / 906 insertions /
   0 deletions**。整期**一行都没删过**,不可能削弱或删除任何既有断言。T5→T10→T12
   那两次断言反转也是「旧文本原样留成注释 + 新断言追加」,不是覆盖。
5. **占位机制能力钉子** —— 现在有效:`deferred.test.ts:26-27` 用
   `isDeferred(DEFERRED_TABS[0])` 驱动函数体,把 `isDeferred` 改成恒 `false` 会精确报红。
   **但要给 P5f 留话**:`DEFERRED_TABS` 清空那天,`:12` 的 `for…of` 变成 0 次迭代
   (静默空转),`:27` 的 `listed` 断言会**硬报错**(`isDeferred(undefined)` → false)。
   硬报错比静默空转好——它会逼 P5f 处理,不会烂在那里;但正解是那时改成用
   **本地构造的非空列表**注入/驱动 `isDeferred`,而不是依赖那个即将变空的常量。
   → 写进 P5f 交接项。

## F. 三门与产物(本次实测)

| 门 | 命令 | 结果 |
|---|---|---|
| New-UI 测试 | `pnpm test` | **313 files / 2866 tests 全绿**,exit 0 |
| New-UI 类型 | `pnpm exec vue-tsc --noEmit` | exit 0,**输出为空** |
| New-UI 构建 | `pnpm build` | exit 0,只有既有 >500 kB chunk 告警,**零 sass 告警** |
| Service 测试 | `pnpm test` | **26 files / 227 tests 全绿**,exit 0 |
| 产物 | `grep -c knowledge-app dist/assets/*.css` | `index-DfgHL4qe.css:1` ✓;`.k2-` 唯一类 **63** ✓ |

**首跑即全绿,两条已知噪声(`persist.test.ts` IndexedDB flaky · `AgentComposer` vue-i18n
teardown)本次一次都没出现,无需复跑。**

**收官算术自洽:**
- `.vue`:`git ls-tree 99ee99a` **169** → `HEAD` **173** = **+4**(T3 `KIcon` · T5
  `KnowledgeDeferred` · T10 `KnowledgeLayout` · T12 `DashboardView`);
  单跑 `color-guard.test.ts` = **175 例**(173 个逐文件 + 2 条固定),即 +4 例,吻合。
- 测试文件:`--diff-filter=A` 新增 `.test.ts` **恰好 10 个**、删除 0 → 303 + 10 = **313** ✓
  (治理文件 §8 写的「收官 307」漏算这 10 个,见 H6)。
- 用例数:2719 + 147 = **2866** ✓,其中 4 例来自 color-guard,143 例来自 10 个新文件
  + `messageSyntax.test.ts` 的 5 条 + `router/index.test.ts` 的 1 条。

## G. 提交卫生

- **New-UI 21 个提交**:T0 三个文档提交 + 每任务一个 `feat/test` 语义提交 + 每轮评审一个
  `fix` 提交。文件数 27,**逐个在本期范围内**,没有一个是无关文件 → 无 `git add -A` 污染。
- **Service 4 个提交**(`notes` 域 + 其修复轮、`wiki` 域 + 其修复轮),5 个文件全在范围内。
- **两个仓 `git status --short` 都是空**(探针后我已 `cp` 还原并复验)。
- **`reflog` 21 / 4 条全部是 `commit:`** —— 无 `rebase`、无 `reset`、无 `pull/push` 痕迹。
- **`NimoOS-UI` 零本期提交** ✓:分支仍是 `docs/vue3-migration-sp3`,`git log` 头部是
  SP7/SP9 的文档提交;`git status --short` 只有一个未跟踪的 `FRONTEND_API_GUIDE.md`
  (**mtime 2026-07-09 10:24**,远早于本期,与我们无关,未被碰过)。
- 一处**值得记一笔**的:`.superpowers/sdd/.gitignore` 是 `*`,但
  `p5a-common-constraints.md` 被显式 add 进了版本库(`git ls-files .superpowers` 只有它)。
  这是协调者 T0 的有意安排(治理文件要能被后续批次引用),不是事故 —— 但意味着
  **H6 那个「307」错数字在 git 历史里**,修它要一个提交。

## H. 挂账 triage

| # | 挂账 | 我的裁定 |
|---|---|---|
| 1 | T2 `WikiCandidate` 被 `res.data as X` 架空 | **维持协调者的 park,不改。** 我回源核过:`res.data as X` 在本包是 10 文件 20 处的通行惯例(`cloud.ts:11`/`samba.ts:12,25`/`driver.ts:11` 与 `wiki.ts:156` 形状完全相同);且 `WikiCandidate` 的字段(`Path`/`Type` 恒有、`Size`/`Label` omitempty)确与 `NimoOS-Wiki/service/roots/candidates.go` 吻合,不是编造;类型的约束力落在消费端,而消费端(P5d Wiki 页)还没写。要 wiki.ts 单独换写法 = 与需求无关的重构。**→ 无需动作** |
| 2 | T4 `--accent-soft-2` 暗档色相略错配 | **维持 park → 留 P5b。** 我核了可达面:`.k-banner[data-tone="info"]` 在 P5a **根本不渲染**(`KnowledgeLayout.vue:277` 只出 `data-tone="warn"`),唯一真实生效处是 `.k-btn.primary` 的 `0 2px 6px var(--accent-soft-2)` —— 暗档解析到 `rgba(138,180,255,0.24)`,与本档 `--accent: #5E97F2` 同为蓝、只是更亮,6px 模糊 + 24% alpha 下不可辨。**建议**:P5b 若要出现大面积强调实底,再按协调者给的正解在两档各声明本地值(暗 `rgba(94,151,242,0.24)` / 浅 `rgba(59,91,219,0.2)`)。 |
| 3 | T11 R9 追认两条 | **维持追认。**① 我**独立算过 color-mix**,两档都与蓝本裸值**精确相等**(见 D6),没有「自行发明映射」造成的数值偏差,只是流程上该走 `NEEDS_CONTEXT`——已记入教训即可。② `:748` hover 取 `--danger-soft-border`:蓝本常态 0.10α → hover 0.18α;本仓常态 `--danger-soft`(暗 0.16 / 浅 0.10)→ hover `--danger-soft-border`(暗 0.24 / 浅 0.16),**两档都保住了「hover 比常态浓」的反馈差**,落 `--danger-soft` 会同色。**→ 无需动作** |
| 4 | T2 `wiki.ts` 注释引「蓝本 `wiki.js:89-92`」 | **必修(Minor,纯注释)。已复核仍是错的**:`wiki.ts:176` 那句还在;`git show main:src/service/wiki.js` 实测 `:88-91` 是 `getRaw` 方法体,四个写方法是 **`:93-96`**。改成 93-96。 |
| 5 | T9 `updatePeak` 头注释与死代码 | **必修(Minor,纯注释)。已复核仍是错的**:`dashboardHelpers.ts:6` 还写着「供 T12 消费 `progressPercent`/`fmtEta`/`updatePeak`」,而 `DashboardView.vue` 只 import 前两个;`updatePeak` 在蓝本与移植里都是死代码(只被自己的单测引用,`backlogPeak` 全靠 store 内联 `Math.max`)。改成如实说明「蓝本即死代码,为完整性搬入,当前无生产消费者」。`Math.max` 天然对称、补不出判别用例这条我同意,不要求补测试。 |
| 6 | 文档两处订正 | **必修(Minor,纯文档),而且是本组里最该修的一条**:① `p5a-common-constraints.md` §8「收官应为 **307** 文件」——**实测 313**(漏算本期新增的 10 个测试文件),而这个文件**在版本库里**,P5b 的实现者会照它算基线;顺手把 §8 的基线段落改成「起点 303/2719 → P5a 收官 313/2866」。② 附录 D.2 表述改「63 个 `k2-*` + `k-suggest-chip` = 64 个类」。③ **本终审新增**:台账收官段写「New-UI 17 个提交 / Service 3 个提交」,实测是 **21 / 4**。 |

### 本终审新发现的两条 Minor(建议与 H4/H5/H6 一并收进同一个文档提交)

- **Minor-1(申报标号缺失)**:偏离 **P3**(两处直调 axios 改走包)在代码里**没有任何
  地方写出「P3」这个标号**。改动本身在 `knowledgeStore.ts:18-25`(`service.ai.*` 已剥壳)
  与 `:478-479`(`service.notes.list` 替掉 `r.data.notes`)讲清了,报告(T6/T7)与台账也都有
  ——三件套的①在**实质上齐、形式上缺标号**。修法:在文件头注释里给 P3 补一行,与
  K1/P1/P2/P4 的写法看齐(它们都写了标号)。
- **Minor-2(未申报的机械偏离)**:`DashboardView.vue:533` 把蓝本 `:361` 的
  `v-if="e.badge > 0"` 写成 `v-if="(e.badge || 0) > 0"`。行为在任何输入下等价
  (`undefined > 0` 与 `(undefined||0) > 0` 都是 false),原因是 `EntryItem.badge` 是
  optional、strict 模式下不能直接比大小 —— 与同文件 `:128-134` 已申报的 M-1
  (`queueDepth` 兜底)是**同一类 TS 逼出来的机械改写**,但这一处**没写注释、没申报**。
  修法:补一行行内注释,或并进 `:128-134` 那段一起说明。

## 两次独立 RED 探针

1. **探针 1(暴露覆盖缺口)** —— 删掉 `knowledge.scss:208` 浅色块的
   `--line-strong: #D8D3C7;` 一整行 → `pnpm vitest run src/ai/styles
   src/styles/color-guard.test.ts` = **3 files / 209 tests 全绿,无人报红**。
   证实 ⚠️-D1:浅档 token 漏声明只有那 13 个被点名的能抓到。**已 `cp` 原文还原,
   `git status --short` 空。**
2. **探针 2(验证守卫真有判别力)** —— 往**第三个**顶层 `.knowledge-app {` 块
   (`:642` 起的 T11 仪表盘段)里的 `.k2-live-title` 插入 `color: #ff0000;` →
   `knowledgeStyles.test.ts:172` **精确报红**(`声明层之外出现 #hex`),
   `1 failed | 33 passed`。证实豁免区间**只**覆盖第一个(token)块,`:240` 壳段与
   `:642` 仪表盘段虽然选择器字面量相同也照样被扫。**已还原,`git status --short` 空。**

## 「⚠️ 待协调者裁定」

无。上面所有 ⚠️ 都已给出明确定性(D1 = 覆盖缺口 / 建议进 P5b brief;D2 = 观察、不改;
Minor-1/2 = 建议随文档轮补注释),没有需要协调者另行拍板的悬案。
