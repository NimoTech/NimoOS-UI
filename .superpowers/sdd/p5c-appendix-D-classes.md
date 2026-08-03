# P5c 附录 D —— CSS 类白名单(`WHITELIST_187` → **226**,新增 **39** 类;另建 `parserStyles.test.ts`)

> **权威源**:蓝本 `git show main:` 的四个模板 + `src/views/AI/Knowledge/styles/knowledge.scss` +
> `src/views/AI/Parser/parser-styles.scss` + `ParserTest.vue:245-369` 的内联 `<style>` +
> `FolderBrowser.vue:82-143` 的 `<style scoped>`。
> T0 用脚本从模板抽了全部 `class="…"` 与 `:class="…"`(数组/对象两种语法都解析),
> 与各 scss 段里的选择器做**双向 diff**。

## D.0 计数(T0 实测,**不是估的**)

| 项 | 起点 | 本期增量 | 收官 | 常量名 |
|---|---|---|---|---|
| `knowledgeStyles.test.ts` 的类白名单 | **187**(`WHITELIST_187`,数组实测 187 项 ✅) | **+39** | 🔴 **226** | `WHITELIST_187` → **`WHITELIST_226`** |
| `knowledgeStyles.test.ts` 的非 `k*` 辅助类登记表 | **9**(`NON_K_HELPER_CLASSES`,实测 `danger ghost mono outline primary right second spin suffix`) | **+1**(`warn`) | 🔴 **10** | 名字不带数字,只改内容 |
| 「浅色档 token 覆盖」例外清单 | **11** | **+0** | **11** | 🔴 **不许扩**(新 token 两档都声明了,见附录 B §B.8) |
| `parserStyles.test.ts` 的类白名单 | 无(新建) | **+70** | **70** | `PARSER_WHITELIST_70` |
| `@keyframes` | 现状不变 | **+0** | 不变 | 🔴 本期 10 段**零** `animation:` 引用(T0 已扫) |

**DoD 里凡引用「187 / 9」的,一律改用 226 / 10。**
(常量名跟着数字改是本档既定习惯 —— 名字本身就是防漂移断言的一部分,承 P5b D.0。)

## D.1 `knowledge.scss` 侧新增 **39** 类

来自 `SettingsView.vue`(44 个类)+ `FolderBrowser.vue`(8 个类)= 去重 **47 个前缀类 + 5 个非前缀辅助类**。
其中 **8 个已在 `WHITELIST_187`**:`k-btn` · `k-modal` · `k-modal-bg` · `k-modal-foot` · `k-scroll` ·
`k-scroll-inner` · `k-view` · `kn-badge`(P5a/P5b 搬的)→ **不重复计、不重复定义**。

对应蓝本段(附录 B §B.6 的 10 段):

```
fb  fb-crumb  fb-crumbs  fb-err  fb-list  fb-name  fb-row  fb-stub          (8,来自 FolderBrowser.vue:82-143)
k-modal-body  k-modal-head  k-modal-title  k-modal-x                        (4,K17 兑现,蓝本 :1317-1334)
k-radio-group                                                               (1,蓝本 :1181-1201)
k-sandbox-icon  k-sandbox-link                                              (2,蓝本 :1267-1293)
k-section  k-section-head  k-section-hint  k-section-title                  (4,蓝本 :969-984,🔴 不含 -body)
k-set-card  k-set-danger  k-set-row  k-set-row-cn  k-set-row-desc
k-set-row-info  k-set-row-title  k-set-soon  k-set-svc                      (9,蓝本 :1141-1149/:1159-1179/:1249-1265)
k-svc-cn  k-svc-light  k-svc-name  k-svc-state                              (4,蓝本 :1227-1247)
k-sw                                                                        (1,蓝本 :1203-1225)
kn-checkline  kn-mig-path  kn-mig-req  kn-pick-actions  kn-pick-note  kn-picked  (6,蓝本 :2250-2263,K9 嵌套)
```

粘贴用(TS 数组片段,按字母序):

```ts
  // ---- P5c:附录 D.1(39 个)----
  'fb', 'fb-crumb', 'fb-crumbs', 'fb-err',
  'fb-list', 'fb-name', 'fb-row', 'fb-stub',
  'k-modal-body', 'k-modal-head', 'k-modal-title', 'k-modal-x',
  'k-radio-group', 'k-sandbox-icon', 'k-sandbox-link', 'k-section',
  'k-section-head', 'k-section-hint', 'k-section-title', 'k-set-card',
  'k-set-danger', 'k-set-row', 'k-set-row-cn', 'k-set-row-desc',
  'k-set-row-info', 'k-set-row-title', 'k-set-soon', 'k-set-svc',
  'k-svc-cn', 'k-svc-light', 'k-svc-name', 'k-svc-state',
  'k-sw', 'kn-checkline', 'kn-mig-path', 'kn-mig-req',
  'kn-pick-actions', 'kn-pick-note', 'kn-picked',
```

**T0 双向 diff 结论**:这 39 个与「10 段 scss 里定义的全部 `.k…` / `.kn…` / `.fb…` 选择器」完全一致;
差集只有上面那 8 个已在白名单的。
🔴 **`k-section-body`(蓝本 `:985-991`)不在此列 —— 它是 Allowlist 专用,本期不搬**(brief §2.2,勘误 E-3 已订正边界)。
🔴 **`k-progress-card` / `-row` / `-label` / `-nums` / `-bar` / `-fill`(蓝本 `:1152-1157`)不在此列**(N15)——
「没有搬多」那条断言要能守住它们不出现。

## D.1.1 🔴 `NON_K_HELPER_CLASSES` 必须从 9 扩到 10(**加 `warn`**)

`SettingsView.vue` 用到 5 个非 `k*` 前缀的辅助类:

| 类 | 蓝本位置 | 现状 |
|---|---|---|
| `danger` / `ghost` / `outline` / `primary` | `SettingsView.vue:14`/`:99`(`:class="['k-btn', … ? 'primary' : 'outline']"`)、`:88`/`:150`/`:151`/`:181`(`class="k-btn danger"` 等) | **已在** 9 项登记表(`.k-btn` 的四个变体,P5b 搬的) |
| 🔴 **`warn`** | 模板 `SettingsView.vue:56` / `:110`;规则 `knowledge.scss:1174`(`.k-set-row-desc` 内的 `.warn { … }` 嵌套) | 🔴 **不在登记表** |

`knowledgeStyles.test.ts:203` 那条断言是 **集合相等**(`expect(nonKClassNames(css)).toEqual([...NON_K_HELPER_CLASSES].sort())`)
→ **`.warn` 一进 `knowledge.scss` 就会让它当场红**。必须登记:

```ts
    // .k-set-row-desc 内的警示行(蓝本 :1174),写作嵌套 `.warn { … }`,P5c 搬入
    'warn',
```

⚠️ **不要顺手把 `parser-app` 塞进这个登记表** —— 治理 §6.4-2 已裁定走
`nonKClassNames` 的**排除条件**(与既有的 `c !== 'knowledge-app'` 同款处理),
登记表保持「真·嵌套辅助类」的语义。

## D.2 `parserStyles.test.ts`(新建)的类白名单 —— **70** 类

来自 `ParserStatus.vue`(35 个)+ `ParserTest.vue`(48 个)= 去重 **70**。
T0 双向 diff:**70/70 都在蓝本 scss 里有定义;scss 里也没有一个模板未用的类**(双向零差集 ✅)。

**共用两页的(3)**:`card` · `page-header` · `toggle`
——⚠️ 按 **K23**,它们在**两个作用域下各有一份规则**(`.card` / `.page-header` / `.page-header h2` 三条声明逐字相同,
见附录 B §B.1)。白名单只登记类名一次,但 `parserStyles.test.ts` 要有一条断言钉住「两个作用域下都存在 `.card` 与 `.page-header`」。

```
# ParserStatus 侧(.parser-app.parser-status-page)
parser-status-page  page-header  header-actions  test-link  refresh-btn
card  unreachable  control-card  row  status-text  dot  paused  pause-btn
concurrency-row  device-row  resolved-hint  radio  checkbox
queue-card  kv
folders-card  empty  folder-list  folder-row  folder-path  folder-count  folder-bar
failures-card  toggle  failure-list  path  error

# ParserTest 侧(.parser-app.parser-test-page)
parser-test-page  page-header  back-link
card  help-card  small
upload-card  dropzone  active  has  pick-btn  hint  file-meta  clear-btn
row  params-row  param  reset-btn  hint-line  query-input  checkbox  submit-btn  ok-hint  error-box
docling-card  toggle  docling-md
scored-card  warn  scored-list  rank-line  rank-no  score  rerank-score  chunk-ref  rank-text
chunks-card  empty  chunk-list  chunk-item  chunk-head  chunk-text  emb-preview  emb-label
```

🔴 **`active` / `has` / `paused` 是 `:class="{ … }"` 对象语法里的状态类**
(`ParserTest.vue:23` `:class="{ active: dragActive, has: !!file }"`、
`ParserStatus.vue:21` `:class="{ paused: store.state.controlState.paused }"`),
蓝本里写作 `&.active` / `&.has` / `&.paused`。**照抄对象语法**(不许改成 `data-*` 属性 —— 那是界面/DOM 不 1:1)。

粘贴用:

```ts
  const PARSER_WHITELIST_70 = [
    'active', 'back-link', 'card', 'checkbox',
    'chunk-head', 'chunk-item', 'chunk-list', 'chunk-ref',
    'chunk-text', 'chunks-card', 'clear-btn', 'concurrency-row',
    'control-card', 'device-row', 'docling-card', 'docling-md',
    'dot', 'dropzone', 'emb-label', 'emb-preview',
    'empty', 'error', 'error-box', 'failure-list',
    'failures-card', 'file-meta', 'folder-bar', 'folder-count',
    'folder-list', 'folder-path', 'folder-row', 'folders-card',
    'has', 'header-actions', 'help-card', 'hint',
    'hint-line', 'kv', 'ok-hint', 'page-header',
    'param', 'params-row', 'parser-status-page', 'parser-test-page',
    'path', 'pause-btn', 'paused', 'pick-btn',
    'query-input', 'queue-card', 'radio', 'rank-line',
    'rank-no', 'rank-text', 'refresh-btn', 'rerank-score',
    'reset-btn', 'resolved-hint', 'row', 'score',
    'scored-card', 'scored-list', 'small', 'status-text',
    'submit-btn', 'test-link', 'toggle', 'unreachable',
    'upload-card', 'warn',
  ]
```

⚠️ **`warn` 同时出现在两份白名单里**(`knowledge.scss` 的 `.k-set-row-desc .warn` 与
`parser-styles.scss` 的 `.scored-card .warn`)—— **两处声明不同**
(前者 `display:inline-flex; align-items:center; gap:4px; color:var(--warning); font-weight:500`,
后者 `color:var(--warning); font-size:12px; margin-bottom:6px`),各自嵌在自己的作用域里,**不串号**。
🔴 **两个文件都要有,别以为重名就删一个。**

**元素选择器**(不进白名单,`parserStyles.test.ts` 的非类扫描要登记):
`h2`(`.page-header h2`,两页各一)· `h3`(`.folders-card h3` / `.scored-card h3` / `.chunks-card h3`)·
`b`(`.queue-card .kv b`)· `li`(`.failure-list li` / `.scored-list li`)· `p`(`.help-card p`)·
`em`(`.hint-line em` / `.ok-hint em`)· `strong`(`.file-meta strong`)· `input`(`.param input`)·
`code`(`.emb-preview code`)。
🔴 **这 9 个元素选择器在 New-UI 全都必须嵌在作用域里**(K9)—— 裸 `h2 { }` 会泄漏到全站。

## D.3 属性态清单(**逐处照蓝本**,测试两侧都要覆盖)

| 宿主类 | 属性 | 蓝本位置 | 取值 | 蓝本套 `String()`? |
|---|---|---|---|---|
| `.k-svc-light` | `data-state` | `SettingsView.vue:9` | `paused` / `running` | — (三元返字符串) |
| `.k-radio-group button` | `data-on` | `SettingsView.vue:31`(并发 1/2/4) | `"true"` / `"false"` | ✅ **套** |
| `.k-radio-group button` | `data-on` | `SettingsView.vue:45`(auto)· `:46`(cuda/gpu)· `:47`(cpu) | `"true"` / `"false"` | ✅ **套** |
| `.k-sw` | `data-on` | `SettingsView.vue:59`(OCR)· `:115`(自动捕获) | `"true"` / `"false"` | ✅ **套** |
| `.kn-badge` | `data-s` | `SettingsView.vue:83`(`archived`)· `:84`(`curated`)· `:85`(`draft`) | 静态字面量 | — |
| `.fb-crumb` | `data-last` | `FolderBrowser.vue:5` | `"true"` / `"false"` | ✅ **套** |

**T0 已核**:蓝本 scss 里出现的每一个 `[data-*]` 都写成 **`="值"`** 形式,**没有任何「属性存在性」裸形 `[data-x]`**:
`knowledge.scss:1195`(`.k-radio-group button[data-on="true"]`)· `:1221`(`.k-sw[data-on="true"]`)·
`:1241`(`.k-svc-light[data-state="paused"]`)· `FolderBrowser.vue:107`(`.fb-crumb[data-last="true"]`)。
`.kn-badge[data-s="draft|archived|curated|failed"]` 四档 P5b 已搬(现状 `knowledge.scss` 里就有)。

### D.3.1 断言口径(承 P5b §D.3.1/§D.3.2,原文继续生效)

```ts
expect(el.attributes('data-on')).toBe('true')     // 真侧
expect(el.attributes('data-on')).toBe('false')    // 假侧 —— 🔴 不许写 toBeUndefined()
```

- **两侧都要断言**,不能只测一边。
- 🔴 **`data-*` 不是特殊布尔属性** → Vue 3 的 `patchAttr` 只在 `null`/`undefined` 时删属性,
  `false` 会渲染成 `"false"`(`@vue/runtime-dom@3.5.39 runtime-dom.cjs.js:560-577`)。
  **所以套不套 `String()` 渲染完全一致 → 逐处照抄蓝本(P5b E-9 已裁定),不许统一。**
- 🔴 **每个属性名自己回蓝本 scss `grep` 一次,别信附录**(P5a `.k2-cc` 那次事故的真实教训是属性名错)。
- 本期 `data-on` 有 **6 个宿主点**(并发 3 个按钮共用一条 `v-for`、设备 3 个按钮、2 个开关)——
  P5a T12 的 I-3 就是「4 个宿主只覆盖了 1 个」。**并发档、设备档、两个开关四类各要有真假两侧。**

## D.4 蓝本自身的未定义类 —— 🔴 **本期 0 个**

用「模板抽类 ∖ (白名单 ∪ D.1 ∪ D.2 ∪ 元素选择器)」差集扫描:

| 侧 | 模板抽出 | 有 scss 定义 | 无定义 |
|---|---|---|---|
| `SettingsView.vue` + `FolderBrowser.vue` | 47 前缀类 + 5 辅助类 | **52 / 52** | **0** |
| `ParserStatus.vue` + `ParserTest.vue` | 70 | **70 / 70** | **0** |

→ **本期没有 N10 / N13 同族的条目。** 与 P5b(2 个:`k-empty-btn` / `k-status-badge-cn`)不同。
🔴 **这一条要在报告里显式写出来**,不然评审无法区分「真的 0 个」与「T0 没扫」。
差集扫描命令见 §D.7。

## D.5 🔴 重名 / 串号扫描(**本期风险最高的一节**)

Parser 两页有 **60+ 个裸类名**(`.card` `.row` `.empty` `.hint` `.error` `.path` `.toggle` `.warn` `.dot`
`.radio` `.checkbox` `.small` `.score` `.param` `.page-header` …)。
T0 把这 80 个类名/元素名逐个对 `src/ai/styles/{agent,settings,skills,sk-shared}-styles.scss` +
`src/ai/styles/tokens.scss` + `src/styles/theme.css` 全扫,命中 **4 处**:

| 命中 | 完整选择器 | 会不会捞到 Parser 页? | 处置 |
|---|---|---|---|
| 🔴 `agent-styles.scss:529` | **`.agent-app .card`**(`background` / `border` / `border-radius` / **`overflow: hidden`** / **`box-shadow: var(--shadow-xs)`**) | 🔴 **只要页面根挂了 `.agent-app` 就会**;`overflow` 与 `box-shadow` 我方不声明 → **无论源序都会漏进来**,阴影是肉眼可见的 1:1 破口 | **这就是治理 §6.1 否决「借 `.agent-app` 拿 token」的第二条硬理由。** 走 `.parser-app` 后 **不命中** ✅ |
| `settings-styles.scss:126` | `.set-actions .hint` | ❌ 需要 `.set-actions` 祖先 | 无风险 |
| `skills-styles.scss:365` / `:375` | `.sk-meta-cell .val .dot` | ❌ 需要 `.sk-meta-cell .val` 祖先 | 无风险 |
| `theme.css:414` | `.grid-item.dragging .card` | ❌ 需要 `.grid-item.dragging` 祖先 | 无风险 |

**另外两条必须核的全局规则**(`theme.css`,`:root` 级,**所有页面都吃**):
- `theme.css:311` `* { box-sizing: border-box }` —— 与蓝本 Vue2 一致(Vue2 全局也有),无差异。
- `theme.css:325-327` `.bar-btn { … }` —— Parser 两页**没有**用 `.bar-btn`,无冲突。
- 🔴 `theme.css:318` **`body { overflow: hidden }`** —— 这不是串号,是 **K22 的成因**:
  顶层路由页不自建滚动容器就看不到超出视口的内容。

🔴 **落笔前必跑的重名自查(scss 那一刀提交前照跑)**:

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# ① 新类名与既有作用域零重名(把 D.2 的 70 个名字塞进 NAMES)
NAMES="card row path error empty toggle hint warn param score dot radio checkbox small page-header ..."
for n in $NAMES; do
  hits=$(grep -rnP "(^|[ ,>~+({])\.$n(?![a-zA-Z0-9_-])" \
    src/ai/styles/agent-styles.scss src/ai/styles/settings-styles.scss \
    src/ai/styles/skills-styles.scss src/ai/styles/sk-shared.scss \
    src/ai/styles/knowledge.scss src/styles/theme.css 2>/dev/null)
  [ -n "$hits" ] && { echo "### .$n"; echo "$hits"; }
done
# ② 期望:除上表那 4 处(都需要额外祖先、或已被 .parser-app 规避)之外零命中
```

## D.6 `@keyframes` —— 本期 **零新增**

T0 已扫本期 10 段(附录 B §B.6):**没有任何 `animation:` / `animation-name:` 引用**。
`.k-modal-bg` 的 `animation: k-fade-in 180ms` 与 `.k-modal` 的 `animation: k-modal-pop 200ms`
在蓝本 `:1304` / `:1315`,属于 **P5b 已搬的段**(`.k-modal-bg` / `.k-modal` 都在 `WHITELIST_187` 里)
→ 🔴 **`k-fade-in` / `k-modal-pop` 已存在,不要重复定义。**
`parser-styles.scss` 与 `ParserTest.vue` 的内联 `<style>` 里也零 `@keyframes`、零 `animation`
(只有 `transition: background 0.15s`(`ParserTest.vue:271`)与 `transition: … 150ms/200ms`,不是 keyframes)。

→ `knowledgeStyles.test.ts:552-600` 的 keyframes 存在性守卫**不需要改**;
**N11 的悬空 `fade-in` 例外照旧,不许动。**

## D.7 自检命令(scss / 视图任务提交前照跑)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# ① 白名单里每个类都有对应规则(常驻版就是 knowledgeStyles.test.ts:123)
# ② 没有搬多 —— 🔴 正则必须扩到覆盖 fb- 前缀
node -e '
const fs=require("fs");
const css=fs.readFileSync("src/ai/styles/knowledge.scss","utf8");
const found=[...new Set(css.match(/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g)||[])].map(s=>s.slice(1)).sort();
console.log(found.length, found.join(" "));'
# 期望:全部 ∈ WHITELIST_226;🔴 k-section-body / k-progress-* 六个 一个都不许出现
grep -nE '\.k-section-body|\.k-progress-' src/ai/styles/knowledge.scss    # 期望 0 命中
# ③ 「蓝本未定义类」差集扫描(D.4 的 0 个是怎么得出来的)
#    模板抽类 ∖ (WHITELIST_226 ∪ NON_K_HELPER_CLASSES ∪ 元素选择器)  → 期望空集
# ④ parser-styles.scss 零顶层裸选择器
grep -nE '^[^[:space:]/}]' src/ai/styles/parser-styles.scss
# 期望只有:.parser-app { / .parser-app.parser-status-page { / .parser-app.parser-test-page {
# ⑤ 单独编译两个 scss
pnpm exec sass --no-source-map src/ai/styles/parser-styles.scss /dev/null; echo "exit=$?"
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss      /dev/null; echo "exit=$?"
# ⑥ 真进构建管线
pnpm build && grep -o "parser-status-page\|k-sandbox-icon" dist/assets/*.css | sort -u
```

🔴 **每一条「扩正则 / 加登记项」都要配 RED 探针**(治理 §6.4 / §9 已列):
- 扩「没有搬多」正则 → 临时塞一条 `.fb-foo { }` → 必须报红 → 还原。
- 加 `warn` 进 `NON_K_HELPER_CLASSES` → 临时塞一条 `.bogus { }` 进 `knowledge.scss` →
  集合相等断言必须精确指名 `bogus` → 还原。
- `parserStyles.test.ts` 的四条断言各一次 RED 探针(塞字面量 / 塞顶层裸选择器 /
  往 `.parser-app` 里塞一个颜色属性 / 删掉一个作用域下的 `.card`)。
- **`git status` 探针后必须干净。**
