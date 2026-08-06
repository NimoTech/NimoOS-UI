# SP8-P5a Task 11 报告 —— knowledge.scss 仪表盘 k2-* 段

## 范围与产出

修改 2 个文件:
- `src/ai/styles/knowledge.scss`(+239 行):在 T4 落地的 token 层之后新增一段
  `.knowledge-app { ... }`(仪表盘 k2-* 规则,1:1 移植自蓝本
  `src/views/AI/Knowledge/styles/knowledge.scss`(main@7a6ee6b7)`:2282-2452`)+
  `@keyframes k2pulse/k2spin` + 一个浅色档专用规则(`.k2-ob-layer .k2-tag`)。
  另在 T4 的两个 token 声明块里各补 2 个 R2 token(`--danger-soft-border`,
  `--modal-scrim`)。
- `src/ai/styles/knowledgeStyles.test.ts`(+76/-17):白名单 `WHITELIST_38`→
  `WHITELIST_102`(扩容,未删减任何既有断言);R2 断言 4→6 个 token;修了一个
  自查发现的守卫 bug(见下方"额外发现")。

未新增 `.vue` 文件,未新增测试文件 —— 三门算术符合预期(见下方"三门")。

## 65→64:白名单计数订正(申报)

brief 原文「D.2 共 65 个(64 个 k2-* + k-suggest-chip)」是笔误。实测:

```
sed -n '/### D.2/,/### D.3/p' .superpowers/sdd/p5a-task-11-brief.md \
  | grep -oE 'k2?-[a-z0-9-]+' | sort -u | wc -l
→ 64
```
去重后精确 64 个(63 个 `k2-*` + 1 个 `k-suggest-chip`,`k-suggest-chip` 在原文
里出现两次——一次在类清单里、一次在结尾"(含…)"的复述句里,复述句本身把
"63 个 k2-*"错数成了"64 个 k2-*")。

独立交叉核对(不依赖 brief 的转述,直接读蓝本):
```
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/styles/knowledge.scss \
  | sed -n '2282,2452p' | grep -oE '\.k2?-[a-z0-9-]+' | sed 's/^\.//' | sort -u | wc -l
→ 64
```
两份集合 `diff` 零差异(完全相同的 64 个类)。

**结论**:白名单是 **38(T4)+ 64(T11)= 102**,不是 brief 文本里写的 103。已按 102
落地到 `WHITELIST_102` 常量,变量名同步改名以避免误导后续读者。

## 白名单落地(102 个)自检

D.4 命令①(64 个新类逐个存在性检查,用 `grep -qP '\.$c(?![a-zA-Z0-9-])'` 避免
"字母↔连字符边界" 的 `\b` 老坑):**全部通过,无 MISSING 输出**。

D.4 命令②(全文 `k-`/`k2-` 类清单,101 个 + `knowledge-app` = 102):
```
$ grep -oE '\.k2?-[a-z0-9-]+' src/ai/styles/knowledge.scss | sort -u | wc -l
101
```
逐一核对:101 个全部在白名单内(T4 的 37 个 `k-*`,不含 `knowledge-app` 本身;
T11 的 64 个)。`knowledge-app` 本身不匹配 `\.k2?-` 正则(第三个字符是 `n` 不是
`-`/`2`),单独由白名单里的 `'knowledge-app'` 条目、以及测试里独立的
`.knowledge-app(?![\w-])` 存在性检查覆盖,101+1=102,与 `WHITELIST_102.length`
一致。**没有搬多。**

## 属性态五组核对

| 组 | 蓝本选择器 | 落地位置 |
|---|---|---|
| `[data-tone]` | `k2-chip`/`k2-entry-ico`/`k2-entry-badge`/`k2-qchip` | 全部照抄(live/warn/accent/wiki/vec/note/danger/note 各态) |
| `[data-layer]` | `k2-layer`/`k2-ob-layer` 三色(wiki/vec/note) | 全部照抄 |
| `[data-disabled]` | `k2-entry` | 照抄 |
| `[data-ok]` | `k2-live-ico` | 照抄 |
| `k2-cc` 按钮的按下态 | **蓝本实际是 `[data-on="true"]`,不是 `[data-active]`** | 按蓝本搬 `[data-on="true"]`,已在文件头注释显式申报这处「附录 D.3 与蓝本冲突,以蓝本为准」 |

## 混合规则

本段(蓝本 :2282-2452)内所有复合选择器(如 `.k2-suggest .k-suggest-chip`、
`.k2-layer:hover .k2-layer-chev`、`.k2-ob-layer .k2-tag`)两端的类都在 D.2
白名单内,**没有需要拆分的混合规则**。

## R2 —— 本任务补声明的 token

在 T4 已有的 4 个之外新增 2 个(两档都补):

| token | 暗色档值 | 浅色档值 | 用途 |
|---|---|---|---|
| `--danger-soft-border` | `rgba(240,119,107,0.24)`(tokens.scss:309) | `rgba(215,73,59,0.16)`(tokens.scss:132) | `k2-qchip[data-tone=danger]:hover` |
| `--modal-scrim` | `rgba(0,0,0,0.5)`(tokens.scss:338,两档同值) | `rgba(0,0,0,0.5)`(tokens.scss:182) | `k2-ob-layer .k2-tag` 暗色蒙版的 `color-mix` 派生源 |

附录 B 表里另外 4 个候选(`--success-soft-border`/`--purple-soft`/
`--danger-soft-faint`/`--teal-soft`)逐行核对蓝本 :2282-2452 后确认本段
**未使用**,未声明(避免声明用不到的 token)。

`knowledgeStyles.test.ts` 的 R2 断言数组已从 4 扩到 6(`for (const tok of […])`
一次性覆盖 T4+T11 全部 6 个,未新开 describe/it)。

## `.k2-chip[data-tone]` 文字色 —— 判断依据(需要说明的偏离)

蓝本 `.k2-chip[data-tone="live"/"warn"]` 的文字色是独立的 oklch 字面值
(浅/暗两档各给一份不同明度),不在附录 B 的裸色对照表里。判断:这两组数值
本质是"成功态绿"/"警告态橙"在两档各自的明度调整,与本档已声明的
`--success`/`--warning`(浅档偏深、暗档偏亮,同一模式)语义相同,**复用这两个
既有 token**(而非新增/而非 NEEDS_CONTEXT)。已在代码注释里逐条写明依据。

## `.k2-ob-layer .k2-tag` —— 蒙版处理(需要说明的偏离)

蓝本基础值(浅色档映射)是半透明白色蒙版,`[data-theme="dark"]` 覆写值
(暗色档映射)是半透明黑色蒙版,两者都不在附录 B 表内。改用 `color-mix()`
从已声明的同色 token 派生对应透明度(浅色档用 `--text-on-accent`,暗色档用
新补的 `--modal-scrim`),数值上与蓝本裸值精确等值(50% mix 后 alpha 减半)。
手法与 T4 的 `.k-empty-illust` 高光同款,不新增自定义属性、不写死字面量。
浅色档规则单独写在文件末尾(`:root[data-theme="light"] .knowledge-app
.k2-ob-layer .k2-tag { ... }`),因为浅色档当前没有另一个可续写的
`.knowledge-app` 规则块。

## `k2pulse`/`k2spin` 落点

两个 `@keyframes` 落在 T11 新增 `.knowledge-app { ... }` 规则块**之后**、
`:root[data-theme="light"] .knowledge-app .k2-ob-layer .k2-tag` 之**前**,
顶层全局(不嵌进任何选择器),与 T4 的 keyframes 同一理由(模板里的
`animation: k2pulse …` 引用不带作用域前缀)。

## 额外发现并修复(评审级 bug,已修 + RED 验证)

`knowledgeStyles.test.ts` 里 8 条"具名色"检查(`\bwhite\b` 等)用的是标准
JS `\b`。JS 正则的 `\b` 在字母↔连字符过渡处同样成立,于是 `/\bwhite\b/`
会被完全合法的 CSS 属性 `white-space` 撞对(`white` 右边紧跟 `-`,同样满足
"单词边界")。T4 的原文件从未用过 `white-space`,这个坑一直潜伏;T11 的
仪表盘段落多处照抄蓝本的 `white-space: nowrap`,直接触发。

修法:8 条全部改成 `(?<![\w-])WORD(?![\w-])` 双向负向断言(与文件里"没有
搬多"测试已经用过的 `(?![\w-])` 同一手法,这里补上左侧的 `(?<![\w-])`)。
验证:改回 `\bwhite\b` 后 `white-space` 相关的用例会假阳性报红(已用
node 单独验证 `/\bwhite\b/.test('white-space: nowrap;')` === `true`);
改成新写法后同一输入不再匹配,而 `color: white;` 这类真实字面量两侧都是
空格/分号(非单词字符也非连字符),两个负向断言仍然命中,继续能报红。

同时修正了注释里残留的色字面量(R5:规则段落的注释一律不许出现色字面量,
含引用蓝本原文/附录桶名时也不行)——发现于色扫复查阶段,已全部改写成
"蓝本 `file:line` + 中文描述颜色",不改动被描述的规则本身。

## RED 探针(4 次,全部完整还原)

**探针 1 —— 删掉一条白名单类的规则**:删除 `.k2-prog-pct { ... }` 整条 →
`102 个白名单类全部有对应规则` 精确报红,`missing` 数组恰好是
`["k2-prog-pct"]`。还原后 `git status --short` 干净、10/10 重新全绿。

**探针 2 —— 规则段落塞色字面量**:把 `.k2-paused-note` 的 `color: var(--warning)`
改成 `color: #ff0000` → `声明层之外出现 #hex` 精确报红。还原后一致。

**探针 3 —— 删掉 R2 新增 token**:删掉浅色档的 `--modal-scrim:` 一行 → R2 断言
精确报红(`浅色档缺 --modal-scrim:`)。还原后一致。

**探针 4(必做)—— 加一个白名单外的类**:在 `.k2-skel-card` 后追加
`.k2-bogus { color: var(--text-primary); }` → `没有搬多` 精确报红,
`extra` 数组恰好是 `["k2-bogus"]`。还原后 `diff` 与备份文件零差异,
`git status --short` 只剩预期的两处修改。

## 三门(全量)

```
pnpm test                  → Test Files 312 passed (312) / Tests 2831 passed (2831), exit=0
pnpm exec vue-tsc --noEmit → exit=0(无输出)
pnpm build                 → exit=0(仅既有 >500KB chunk 警告)
```
无红项,无需归属噪声。算术核对:基线 312 文件/2831 例(sp8-ai@2677f61),本任务
未新增 `.vue`/未新增测试文件,文件数、用例数与基线完全一致(测试内容有变化但
数量不变,因为只扩了既有 `it()` 内的数组/循环,没加新 `it()`)。

## sass 直接编译校验

```
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /tmp/.../p5a-t11-check.css
exit=0
wc -l → 1626 行
```

## build 产物校验

```
grep -oE '\.k2-[a-z0-9-]+' dist/assets/index-DfgHL4qe.css | sort -u | wc -l → 63
grep -o 'knowledge-app' dist/assets/index-DfgHL4qe.css | wc -l → 191
```
（63 = 64 个新类中除 `k-suggest-chip` 外的 `k2-` 前缀类，`k-suggest-chip` 不匹配
`\.k2-` 前缀正则，属预期。）

## §3.5 照抄不改 8 条 —— 本任务命中项

本任务未直接触碰 N1-N8 涉及的字段/逻辑(那些在 store/组件层,不在 scss)。
唯一相关的是 K2(主题映射规则)与 R2/R4(token 声明层约定)—— 均延续 T4 已
定的模式,未新开例外。

## 偏离清单(汇总)

1. **65→102 计数订正**(见上,已用两条独立命令交叉核对)。
2. **`k2-cc` 按钮属性态**:附录 D.3 写 `[data-active]`,蓝本实际是
   `[data-on="true"]`——以蓝本为准,按 `data-on` 落地。
3. **`.k2-chip[data-tone]` 文字色**:复用 `--success`/`--warning`(判断依据见上),
   非新增 token。
4. **`.k2-ob-layer .k2-tag` 蒙版**:`color-mix()` 派生,新增 2 个 R2 token
   (`--danger-soft-border`、`--modal-scrim`),未使用附录 B 表里另外 4 个候选。
5. **修复 `knowledgeStyles.test.ts` 里的 `\b` 假阳性 bug**(8 条具名色检查),
   已 RED 验证前后行为。
6. **修正注释里残留的色字面量**(R5 合规性自查,过程性修正,非结果偏离)。

## Git

```
$ git add src/ai/styles/knowledge.scss src/ai/styles/knowledgeStyles.test.ts
$ git commit -m "feat(knowledge): SP8-P5a knowledge.scss 仪表盘 k2-* 段"
```
（提交 sha 与 `git show --stat HEAD` / `git status` 见对协调者的简报。）

---

# 追加(Opus 独立评审后的 fixup)—— I-2 / I-3(Important)

评审(opus)结论:Spec ✅ · 任务质量通过 · Critical 0。实现者报的四处「与附录不符」
（65→64、103→102、`k2-cc` 是 `data-on`、`\b` 假阳性修法)全部裁定成立。留 2 条
Important(均为守卫覆盖缺口,不改样式取值)+ 若干 Minor/⚠️。本 fixup 只处理这些
守卫缺口,**未改任何一处样式规则/token 取值**。

## I-2 —— 色扫豁免区间被头注释里的同名引用撞开(65 行裸奔)

**根因**:`knowledgeStyles.test.ts` 的 `declBlockRange()` 用
`text.indexOf('.knowledge-app {')` 定位声明块起点 —— 纯子串搜索。头注释
`:8`/`:46`/`:51`/`:179` 都用反引号逐字引用过 `` `.knowledge-app { … }` ``(为了
向读者解释选择器写法),`indexOf` 命中的是这些注释里最早出现的一处(`:8`),不是
真正的声明块(`:73`/现在的 `:74`)。实际豁免区变成 `:8-157`,把 `:8-72` 这 65 行
头注释也一并豁免掉,评审探针在 `:20` 塞色字面量能 10/10 全绿证实了这一点。

**改前**(`declBlockRange`,子串搜索):
```ts
function declBlockRange(text: string, selectorLiteral: string): [number, number] {
  const at = text.indexOf(selectorLiteral)
  expect(at, `找不到声明块 ${selectorLiteral}`).toBeGreaterThanOrEqual(0)
  const braceAt = text.indexOf('{', at)
  const end = text.indexOf('\n}', braceAt)
  expect(end, `${selectorLiteral} 声明块未闭合`).toBeGreaterThan(0)
  return [at, end + 2]
}
```

**改后**(行首锚定 + 整行精确匹配,排除注释里的同名引用):
```ts
function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function declBlockRange(text: string, selectorLiteral: string): [number, number] {
  const lineAnchored = new RegExp(`^${escapeForRegExp(selectorLiteral)}$`, 'm')
  const m = lineAnchored.exec(text)
  expect(m, `找不到声明块 ${selectorLiteral}(行首锚定,已排除注释里的同名引用)`).not.toBeNull()
  const at = m!.index
  const braceAt = text.indexOf('{', at)
  const end = text.indexOf('\n}', braceAt)
  expect(end, `${selectorLiteral} 声明块未闭合`).toBeGreaterThan(0)
  return [at, end + 2]
}
```
真正的两个声明块选择器在源码里都独占一行、零缩进、行尾紧跟 `{`
(`.knowledge-app {` / `:root[data-theme="light"] .knowledge-app {`),注释里的引用
前面总有 ` * ` 或反引号,不可能独占一整行 → 行首锚定正则天然排除。`exec()` 不带
`g` 标志只返回第一个匹配 —— 文件里另有两处顶层 `.knowledge-app {`(T4 壳段 `:240`、
T11 仪表盘 `:642`)同样是独占一行的字面量,但都排在 token 声明块之后,不会被
误选为"第一个匹配"。

## 4 行头注释改前/改后(移除色字面量,按 R5 口径改成"行号 + 中文描述颜色")

**`:36`(R4 讨论,改前含 `rgba(40,35,25,…)`)**:
- 改前:`取的是 AI tokens.scss:107-110 那套浅色暖投影(rgba(40,35,25,…))。但阴影的 rgba`
- 改后:`取的是 AI tokens.scss:107-110 那套浅色暖调半透明投影。但阴影本身带颜色,不是`

**`:40`(R4 讨论,改前含 `rgba(0,0,0,…)`)**:
- 改前:`基础块改取 AI tokens.scss:360-363(暗色投影 rgba(0,0,0,…)),浅色块另外声明一份`
- 改后:`基础块改取 AI tokens.scss:360-363 的暗色调半透明投影,浅色块另外声明一份`

**`:58`/`:59`(自查坑订正说明,改前直接写出三个 token 的具体字面值)**:
- 改前:
  ```
  * `--accent: #3b5bdb`(theme.css:183)/ `--accent-soft: rgba(59,91,219,0.11)`
  * (theme.css:274)/ `--success: #15754c`(theme.css:281)。这与附录 B 表里"全局无
  ```
- 改后:
  ```
  * 三项分别取自 theme.css:183(强调色)/ theme.css:274(强调色半透明变体)/
  * theme.css:281(成功色)(具体取值见下方浅色声明块本身 —— 那里属于 §6 豁免的
  * token 声明层,允许出现字面量)。这与附录 B 表里"全局无
  ```

改后复查(`sed -n '1,68p' | grep -nE '#hex|rgba?\(|oklch\(|具名色…'`)→ 无输出,头注释
区段(1-68 行,现为 1-69 行,含新插入的 `declBlockRange` 修法记录不在此范围)零字面量。

## `var()` 闭环守卫的实现

新增 `describe('knowledge.scss —— var() 引用闭环(评审 Important I-3)', …)`,含 2 条
断言:
1. 抽取全文所有 `var(--x[, fallback])` 引用(排除带 fallback 的),逐个确认 `--x`
   能在①本档任意位置声明过(含两个 token 声明块 + 规则内局部声明如 `.k2-layer`
   的 `--ly`/`--ly-soft`/`--ly-ln`)或②全局 `src/styles/theme.css` 声明过,两处都
   没有才报红并指名 token。
2. 钉住 `--g` 是本档唯一登记的"消费方 inline 注入"例外
   (`.k2-glue-id i { background: var(--g, var(--text-quaternary)); }`,蓝本 `:2327`
   逐字,颜色由 T12/后续消费方通过模板 `:style` 传入,不强制本档/全局声明,但
   fallback `--text-quaternary` 本身仍受正常检查覆盖)。

**例外登记清单(仅 1 条)**:

| token | 理由 |
|---|---|
| `--g` | `.k2-glue-id i` 的圆点色由消费方(未来 T12 的 `DashboardView.vue`)通过模板 inline `:style="{ '--g': color }"` 传入,是**有意设计的动态染色点**,不是本档/全局该声明的静态 token。已带 `var(--g, var(--text-quaternary))` fallback,未传值时回退到既有灰度 token,不会渲染成透明。 |

（附录 B 唯一的另一类例外 `--accent-soft-2` 不需要在这份"消费方注入"清单里 ——
它是"全局已声明、本档故意不重复声明"的例外,闭环检查里 `declaredGlobal` 天然能
解析到,不属于"未声明"范畴,已用 A.3 现有断言钉住。）

全文实测:43 个 `var()` 唯一 token 名(评审口径,跨整档统计)全部可解析,0 个
"两处都找不到"。

## `[data-layer]` 三色完整性守卫

`describe('knowledge.scss —— [data-layer] 三色完整性(评审 Minor M-2)', …)`:遍历
`['k2-layer','k2-ob-layer'] × ['wiki','vec','note']` 六个组合,逐个用
`\.${host}\[data-layer="${layer}"\]` 检查存在,缺哪个精确指名哪个。

## keyframes 存在性守卫

`describe('knowledge.scss —— animation 引用与 @keyframes 声明一一对应(评审 Minor M-3)', …)`:
抽取全文所有 `animation: X` / `animation-name: X` 引用(实测 4 个唯一名:
`k-shimmer`/`k2pulse`/`k2spin`,`k-pulse` 只出现在注释里已被 stripComments 剥掉,
不计入),逐个确认同档有 `@keyframes X` 声明,缺失才报红(反向:声明了没人用的
7 个 T4 keyframes 不报红,按评审建议是"冗余不是缺陷")。

## 五次 RED 探针(全部完整还原)

| # | 破坏什么 | 结果 | 报红用例/断言消息 | 还原 |
|---|---|---|---|---|
| 1(头注释正向)| 在 `:20`(R2 说明段落)插入 `探针注入 #ff0000 rgba(1,2,3,0.4)` | **精确报红** | `token 声明层之外,全文(含注释)零色字面量… > 声明层之外出现 #hex` | ✅ `diff` 与备份零差异 |
| 2(声明块内反向)| 不注入,直接对当前(未修改)文件跑守卫 —— 两个声明块内合计 72 处既有 `#hex`/`rgba(` 字面量 | **10/10 全绿**,证明豁免区间收窄后仍然正确豁免声明层本身,没有把豁免整个废掉 | —— | 未改文件,无需还原 |
| 3(`var()` 不存在)| `.k2-prog-pct` 的 `var(--ly-vec)` → `var(--k2-nonexistent)` | **精确报红**,`unresolved` 数组恰为 `["--k2-nonexistent"]` | `knowledge.scss —— var() 引用闭环(评审 Important I-3) > 全文所有 var(--x) 引用都能…` | ✅ `diff` 零差异 |
| 4(`[data-layer]` 删一色)| 删除整条 `.k2-layer[data-layer="vec"] { … }` | **精确报红**,`missing` 数组恰为 `["k2-layer[data-layer=\"vec\"]"]` | `knowledge.scss —— [data-layer] 三色完整性(评审 Minor M-2) > k2-layer 与 k2-ob-layer 的…` | ✅ `diff` 零差异 |
| 5(删 keyframes)| 删除整行 `@keyframes k2spin { to { transform: rotate(360deg); } }` | **精确报红**,`missing` 数组恰为 `["k2spin"]` | `knowledge.scss —— animation 引用与 @keyframes 声明一一对应(评审 Minor M-3) > 每一个 animation: X 引用都有对应的 @keyframes X` | ✅ `diff` 零差异 |

每次探针后 `cp` 备份还原,`git status --short` 只剩预期的两处修改(无新增/遗留
临时改动)。

## 重跑后三门 + sass(全量,完整落盘)

```
pnpm test                  → Test Files 312 passed (312) / Tests 2835 passed (2835), exit=0
pnpm exec vue-tsc --noEmit → exit=0(无输出)
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss …/p5a-t11-fix.css → exit=0
pnpm build                 → exit=0(仅既有 >500KB chunk 警告)
grep -oE '\.k2-[a-z0-9-]+' dist/assets/*.css | sort -u | wc -l → 63(不变)
```
算术:2831(fixup 前)+ 4(本轮新增的 `var()` 闭环 2 条 + `[data-layer]` 1 条 +
keyframes 1 条)= **2835**,与实测一致。文件数 312 不变(未新增 `.vue`/测试文件)。
无已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)出现,零红项。

## 未改代码的两条(协调者已追认,知悉即可)

- **I-1**(`.k2-ob-layer .k2-tag` 的 `color-mix` 蒙版映射越了附录 B 桶):协调者
  裁定 R9 追认,数值精确等值、无发明新 token,不改代码,已知悉;下次遇到"表里
  没这个桶"会先写 `NEEDS_CONTEXT` 而不是自行决定。
- **M-1**(`:747` hover 取 `--danger-soft-border` 越了桶边界):协调者追认这个
  选择是对的(避免 hover 与常态同色、丢失反馈),不改代码。

## Git

新提交(fixup,同一任务续作,未 rebase/amend):
```
$ git add src/ai/styles/knowledge.scss src/ai/styles/knowledgeStyles.test.ts
$ git commit -m "fix(knowledge): 收 Important I-2/I-3 —— 色扫豁免区间行首锚定 + var()/data-layer/keyframes 闭环守卫"
```
（提交 sha 与 `git show --stat HEAD` / `git status` 见对协调者的简报。）
