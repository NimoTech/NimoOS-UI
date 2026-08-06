# SP8-P6 Task 7 报告 —— 开源导出清单为 AI 区扩张(New-UI 侧)

- 工作区:`/home/nimo/NimoTech/NimoOS-New-UI`,分支 `master`,BASE = `f1c659f`
- 改动文件:**只有 `oss/manifest.mjs` 一个**(产品码一行未动)
- 计数:`DELETE` 67 → **72**(+5);`PATCH` 221 → **245**(+24);
  `REPLACE` 4、`SERVICE_DELETE` 10、`SERVICE_PATCH` 8 均未动(Service 侧留给 T8)

---

## 0. 结论速览

| 项 | 结果 |
|---|---|
| 清单锚点(New-UI 侧 245 条 PATCH + 72 条 DELETE) | **全部恰好命中 1 次 / 路径全部存在** |
| 泄漏守卫 New-UI 侧命中 | **0**(扩张前为 7) |
| 泄漏守卫 Service 侧命中 | 977(**全部归 T8**) |
| 产物树 `pnpm install` + `vue-tsc --noEmit` | **通过** |
| 产物树 `vitest run` | **374 文件 / 3683 用例全绿** |
| 私有仓自身测试(排除 `oss/`) | 595 文件 / 9785 用例全绿 |
| `oss/` 自测 6 个文件 | 5 通过,`tree.test.mjs` 余 2 条失败,**均为 Service 侧泄漏** |

---

## 1. Step 1 实测:AI 面的真实边界

```
$ find src/ai -type f | wc -l
276
$ ls src/ai
assets  components  composables  knowledge  markdown  services
stores  styles  types  types.ts  util  views
```

`src/ai` 之外引用 AI 的文件(`grep -rln` 排除 `src/ai/` 自身),共 **8 个**:

| 文件 | 引用什么 | 处置 |
|---|---|---|
| `src/components/AppToast.vue` | `useAiTheme`(store 在 src/ai) | PATCH ×4 |
| `src/components/AppToast.test.ts` | 同上 | PATCH ×3 |
| `src/router/index.ts` | 3 个 import + 4 条 `/ai` 路由 | PATCH ×2 |
| `src/router/index.test.ts` | knowledge 路由断言 | PATCH ×1 |
| `src/i18n/zh_cn.ts` | `import ai from './zh_cn.ai'` | PATCH(既有条目重抓) |
| `src/i18n/en_us.ts` | 同上 | PATCH(既有条目重抓) |
| `src/i18n/__tests__/shardDisjoint.test.ts` | 四分片守卫 | **DELETE** |
| `src/i18n/__tests__/photosSlice.test.ts` | 也 import 了 ai 分片 | 已在既有 DELETE 表(相册轮) |

> 补充:第一版 `grep` 用的宽模式(`\bai\b|/ai|AI`)命中 110 多个文件,绝大多数是
> `raid` / `available` / `S.M.A.R.T.` 之类误报。上表是收窄到**真实 import 路径 +
> i18n 分片名**之后的结果,已逐个 `grep -n` 核过引用行。

此外通过 `grep -rln "\bai[A-Z]"` 扫到 `src/i18n/messageSyntax.test.ts` 也是纯 AI 面
(见 §2 第 5 条),它不 import `src/ai`,所以不在上表 8 个之内 —— **这正是"只按
import 路径列清单会漏"的那类陷阱**,单独记一笔。

---

## 2. `DELETE` 新增 5 条 —— 逐条理由

| # | 条目 | 理由 / 取证 |
|---|---|---|
| 1 | `src/ai` | 整个功能区的域根,276 个文件全在里面(组件/store/composable/知识库/parser/技能/MCP/样式/util/类型/测试)。与相册 `src/photos` 同一形状,一条目录规则整块剥除。**AI 专用 theme token 也在这里**(`src/ai/styles/tokens.scss`),随目录一起走。 |
| 2 | `src/i18n/zh_cn.ai.ts` | AI 区 1207 个 `ai*` 键。分片当初就是为了这里能一行删掉。 |
| 3 | `src/i18n/en_us.ai.ts` | 同上,英文侧。 |
| 4 | `src/i18n/__tests__/shardDisjoint.test.ts` | T4(`1c0c4aa`)新建的**四分片**守卫。剥掉 photos + ai 后产出树只剩 base + sp9 两片,它守的三件事全被保留下来的 `parity.test.ts` 覆盖:① base×sp9 不相交 == parity 的「分片不得覆盖基座已有 key(静默改文案)」逐字同义;② 两语言键集一致 == parity 第一条;③「四片键数之和 == 真实 messages 键数」在两片时退化成前两条的推论。改成两片版需约 10 条锚点(4 个 import + 4 个 describe 体 + 2 段注释),换来一份与 parity 重复的守卫 —— 与既有 `photosSlice.test.ts` 同一判断。 |
| 5 | `src/i18n/messageSyntax.test.ts` | 整份 1814 行是 **AI 文案**的 vue-i18n 语法守卫:13 个 describe 里 12 个直接点名 `aiComposer*` / `aiSlash*` / `aiSk*` / `aiKb*`。唯一看起来通用的末条「bare @ guard」同样只服务 AI —— **实测** `grep -c "@"`:`zh_cn.ai.ts` 13、`en_us.ai.ts` 12,而 `base` / `photos` / `sp9` 这 6 个分片文件**全是 0**。产出树里它会遍历一组永远不含 `@` 的键,是零判别力的空壳。 |

**「删完之后零消费方」取证**(§1 表格 + 下列命令):

```bash
# 4/5 两条:删掉后没有任何保留文件 import 它们
/usr/bin/grep -rn "shardDisjoint\|messageSyntax" src --include=*.ts --include=*.vue   # 零命中(除自身)
# src/ai 域外无残余 import —— 见 §7 产物树 vue-tsc 全绿(编译期硬证据)
```

---

## 3. 两组被前面几刀打断的既有锚点 —— 修复前后对照

用一次性核对脚本(逐条 `split(find).length - 1`)对 BASE 源码实测,**共 7 条 hits=0**。
dispatch 预告的是「i18n 四条 + useOpenAction 的 SYS_ROUTE 一块」,实测有出入,如下。

### 3.1 第一组 · i18n(dispatch 说 4 条断,**实测断 3 条 + 1 条需扩**)

| manifest 位置 | 状态 | 说明 |
|---|---|---|
| `zh_cn.ts` 结构锚点 | **断**(hits=0) | T3 把出口从 3 行改成 4 行(多一片 ai) |
| `en_us.ts` 结构锚点 | **断**(hits=0) | 同上 |
| `zh_cn.ts` 文件头注释 | **断**(hits=0) | T3 整段重写(多了 ai 分片行、多了末尾「sp9 走第二条装配路径」一段) |
| `en_us.ts` 文件头注释 | **未断**(hits=1) | ⚠️ dispatch 说它断了,实测没断。但 T3 在它**下面加了第二行**点名 `en_us.ai.ts` —— 只换第一行会把那行 AI 说明留在公开仓,所以把锚点**从 1 行扩到 2 行**。 |

修复前后(结构锚点,zh 侧;en 侧同形):

```diff
- find: "import base from './zh_cn.base'\nimport photos from './zh_cn.photos'\n\nexport default { ...base, ...photos }\n"
+ find: "import base from './zh_cn.base'\nimport photos from './zh_cn.photos'\nimport ai from './zh_cn.ai'\n\nexport default { ...base, ...photos, ...ai }\n"
  replace: "import base from './zh_cn.base'\n\nexport default { ...base }\n"     # 未变
```

`zh_cn.ts` 文件头:`find` 换成 T3 定稿的 16 行全文;`replace` 从原来的一行扩成
**保留末尾那段「sp9 分片不在本出口里」的装配提醒**(改写成只提 base 的版本)——
理由:那段与相册/AI 无关,且 `zh_cn.sp9.ts` 是保留面,提醒在产出树里依然成立。

### 3.2 第二组 · `useOpenAction.ts`(dispatch 说 `SYS_ROUTE` 一块,**实测 4 条全断**)

T5(`c547c9d`)动了本文件四处,四条既有锚点因此**全部** hits=0:

| # | 锚点 | T5 做了什么 |
|---|---|---|
| 1 | `SYS_ROUTE` 整块(含上方注释) | 注释加了「AI 区(/ai,SP8-P6)」「SP1-SP9 迁移至此收官」,`photos / vm 这两条` → `photos / ai / vm 这三条`,表里加 `ai: '/#/ai/agent'` |
| 2 | `cutoverDisabled` 函数(含上方注释) | 注释加了一行 `// /ai = SP8-P6,同理一把键管两侧(Vue2 侧在 migratedRoutes)。` |
| 3 | `openApp()` 的 if 链 | 加了 `if (key === 'ai' && !cutoverDisabled('/ai')) { router.push('/ai/agent'); return }` |
| 4 | `openItem()` widget 分支 + `sendToAI()` | widget 分支从一行 `window.location.href` 改成 4 行 flag 分支;`sendToAI` 从 3 行改成 11 行(应用内 `router.push` + flag 回退) |

四条的 `find` 全部按现场 `sed -n` 抓到的 T5 定稿文本重写;**`replace` 四条一字未改** ——
开源版的目标形态与 SP9-P8 那轮定下的一致(无 cutover flag、无 AI、无相册,
`SYS_ROUTE` 只剩 `vm` / `settings` 且指应用内路由)。dispatch 提示的三处(`openApp`
的 ai 行、`openItem` widget 分支、`sendToAI`)确认都在 `replace` 里被摘掉。

---

## 4. `PATCH` 新增 24 条 —— 逐条理由

### 4.1 路由(3 条)

| 条目 | 理由 |
|---|---|
| `src/router/index.ts` 三个 import | `AgentPage` / `SettingsPage` / `knowledgeRoutes` 都在 `src/ai` 下,不摘直接构建失败 |
| `src/router/index.ts` 四条路由 | `/ai` redirect + `/ai/agent` + `/ai/settings` + `...knowledgeRoutes` |
| `src/router/index.test.ts` knowledge 用例 | 断言 `/ai/knowledge`、`/ai/knowledge/notes`、`/ai/parser/test` 存在,路由已摘,留着必红。锚点从块前空行开始吃,避免留下孤立空行。 |

> brief Step 4 提示「若 T5 补了 `/ai/skills`、`/ai/mcp` 两条 redirect 要多一条补丁」——
> **实测不存在**:T5 提交信息写明「Step 6 按 T1 实证结论跳过:REDIRECT_BEFORE_GUARD=true,
> 守卫看不到裸路径,不补路由」。`grep -n "'/ai" src/router/index.ts` 只有 3 行。

### 4.2 `AppToast`(7 条)

`AppToast.vue` 是**全局**提示条(开源版保留),但 SP8-P2b 给它接了 AI 区明暗跟随。

- `.vue` ×4:模板两个绑定 + 顶部解释注释(合一条)、`useAiTheme` import、`const aiTheme`、z-index 注释洗白
- `.test.ts` ×3:`useAiTheme` import、`describe('AppToast —— AI 区 toast 作用域')` 整块 4 条用例、z-index 注释洗白

z-index **数值 10100 保留不动**:它仍高于产出树里最高的 `.sk-modal-bg = 1100`,
且 `AppToast.test.ts` 末条守卫断言 `> 10000`;只把理由注释改写成不点名 AI 的版本。

### 4.3 `useOpenAction.test.ts`(2 条)

T5 追加的两处:`beforeEach` 里 `localStorage.removeItem('strangler:disabled:/ai')`,
与文件末尾 7 条用例的 `describe('AI 区 cutover(SP8-P6)')`(测 `openApp('ai')` /
widget 小组件 / `sendToAI`,三者在开源版都已被产品码补丁摘掉)。
本文件既有的 11 条锚点实测未受合流影响,仍全部 hits=1。

### 4.4 `package.json` 依赖(4 条,共摘 6 个包)

逐个用 `grep -rl <包名> src | grep -v '^src/ai/'` 实测消费方:

| 包 | 总消费文件 | src/ai 之外 | 处置 |
|---|---|---|---|
| `@tiptap/pm` / `@tiptap/starter-kit` / `@tiptap/vue-3` / `tiptap-markdown` | 1 / 1 / 4 / 2 | **0 / 0 / 0 / 0** | 删(brief 指定) |
| `dompurify` | 1 | **0**(唯一消费方 `src/ai/markdown/renderMarkdown.ts`) | 删 |
| `@types/dompurify` | 0 | 0 | 删(随 dompurify) |
| `markdown-it` | 6 | **4**(文件预览器 / 应用商店详情 / 预装提示 / 更新弹窗) | **不删** |
| `vue-advanced-cropper` / `composerize` / `yaml` | — | 3 / 3 / 19 | **不删** |

> `dompurify` 与 `@types/dompurify` 超出 brief 明写的 4 个 tiptap,但属同一类
> (都由 sp8-ai 合流引入、都零域外消费方),故一并摘;已在 manifest 注释里写明。

### 4.5 `AppToast.zIndex.test.ts` 取数阈值(1 条)

**这条是产物树实跑 `vitest` 才抓到的**(`vue-tsc` 抓不到)。详见 §6 轮 4。

### 4.6 注释洗白(7 条)

sp8-ai 合流往**保留面**文件里带进来的 7 处点名,即泄漏守卫在 New-UI 侧的全部命中。
全是注释,代码行为一字不改:

| 文件:行 | 命中词 | 原文要点 | 洗成 |
|---|---|---|---|
| `AppToast.zIndex.test.ts:24` | `photo` | 「这正是 photosSlice.test.ts / knowledgeStyles.test.ts 文件头记的同一个坑」 | 「本仓另有几处样式守卫踩过同一个坑」 |
| `clipboard.ts:7-8` | `ai` | 「AI 设置页页面上的复制正常,「创建令牌」弹窗里三个都复制不到东西」 | 「设置页页面上的复制正常,弹窗里的复制按钮一个都复制不到东西」 |
| `clipboard.test.ts:51-52` | `ai` | 同上(测试侧复述) | 同款措辞 |
| `userProfile.ts:6-7` | `ai` | 「every subscriber (incl. the AI sidebar) re-fetched it」 | 「every subscriber re-fetched it」 |
| `userProfile.ts:15-16` | `ai` | 「a local ref inside AgentSidebar (only the AI sidebar's `<img>` …)」 | 「a local ref inside one sidebar component (the only `<img>` …)」 |
| `userProfile.ts:23` | `ai` | 「no changes needed in the AI area」 | 「no changes needed anywhere else」 |
| `vite.config.ts:59` | `ai` | 「/app/#/ai/* 验收」 | 「/app/#/ 验收」 |

---

## 5. theme.css 复核结论(brief D8 纠正的独立验证)

**结论:`src/styles/theme.css` 本次一行都不用改。** brief 的收窄结论成立,已独立复核:

```
$ /usr/bin/grep -rn -- "--toast-warn\|--toast-danger" src
src/components/AppToast.vue:54  .toast[data-tier="warning"] { background: var(--toast-warn-bg); … }
src/components/AppToast.vue:55  .toast[data-tier="danger"]  { background: var(--toast-danger-bg); … }
src/styles/theme.css:289-292    (深色主题 4 个定义)
src/styles/theme.css:346-349    (浅色主题 4 个定义)
src/ai/styles/tokens.scss:379-382  (AI 侧覆写 —— 随 src/ai 一起删)
```

`--toast-warn-*` / `--toast-danger-*` 是 **SP8-P1c2 的通用 severity 分级**,消费方就是
保留下来的 `AppToast.vue` 自己(`[data-tier]` 两条 CSS 规则),**不是 AI 专用,必须留**。

其余核对:
- `--orb-*` / `--spk-*`:确认已由既有 PATCH(manifest「E11」那节 + 「I3」孤儿 token 那节)处理完,本次不重复。
- AI 专用 token 全部在 `src/ai/styles/tokens.scss`,随 `src/ai` 整域删除。
- `grep -n -- "--ai-\|--agent\|--chat" src/styles/theme.css` → 零命中,`theme.css` 里没有其它 AI 专用 token。

---

## 6. 每一轮导出失败的原文与处理

导出脚本第一处失败即 abort,所以只能一轮解一类。前置条件已确认:
**New-UI 与 Service 两个工作树都干净**(New-UI 仅 3 行 ` D design-export/...`,
属 `DIRTY_ALLOW`;Service `git status --short` 空输出,全程未往里写任何文件)。

### 轮 0 · 静态锚点核对(先于跑导出)

写了一次性脚本逐条核对 `find` 在当前源码里的命中次数,不改任何文件:

```
--- DELETE: 67 条, 0 条路径不存在 ---
--- SERVICE_DELETE: 10 条, 0 条路径不存在 ---
PATCH[5]   hits=0 src/home/composables/useOpenAction.ts
PATCH[6]   hits=0 src/home/composables/useOpenAction.ts
PATCH[7]   hits=0 src/home/composables/useOpenAction.ts
PATCH[8]   hits=0 src/home/composables/useOpenAction.ts
PATCH[110] hits=0 src/i18n/zh_cn.ts
PATCH[111] hits=0 src/i18n/en_us.ts
PATCH[112] hits=0 src/i18n/zh_cn.ts
--- PATCH: 221 条, 7 条失配 ---
--- SERVICE_PATCH: 8 条, 0 条失配 ---
```

**处理**:即 §3 的两组修复。修完复跑 → `PATCH: 237 条, 0 条失配`。

### 轮 1 · `--skip-guard` 跑通清单应用

```
[oss] 3/6 应用清单(DELETE 72 · REPLACE 4 · PATCH 237)
[oss] 完成 → …/osstree
```
**无失败** —— 所有 DELETE 路径存在、所有 PATCH 恰好命中一次。

### 轮 2 · 开泄漏守卫

```
[oss] 失败:泄漏守卫命中 984 处,一个字节都不落盘。
```
脚本只打印前 60 条且全是 Service 侧,看不出 New-UI 侧有没有。**处理**:改用自写脚本
在 `--skip-guard` 落盘的产物树上跑 `scanTree` 并**按区分组**:

```
总命中 984
  SERVICE: 977
  NEW-UI: 7
```

New-UI 侧 7 处明细即 §4.6 那张表。补 7 条洗白补丁后复扫 → **NEW-UI: 0,SERVICE: 977**。

### 轮 3 · 产物树 `pnpm install` + `vue-tsc --noEmit`

```
install=0
vue-tsc=0
```
一次通过。**这证明 DELETE/PATCH 集合在编译期是自洽的**(没有指向已删模块的残余 import)。

### 轮 4 · 产物树 `vitest run` —— **抓到一条 `vue-tsc` 抓不到的真失败**

```
FAIL src/components/AppToast.zIndex.test.ts > 取数有效:.vue 与 .css/.scss 都读到了非空内容,且扫得出 z-index
AssertionError: 独立样式表一个都没读到(`?raw` 恒空的老坑): expected 5 to be greater than 5
 Test Files  1 failed | 373 passed (374)
      Tests  1 failed | 3682 passed (3683)
```

**根因**:该断言的阈值 `> 5` 是按私有仓 **14** 个独立样式表定的(5 个 `.css` + 9 个
`.scss`),而那 9 个 `.scss` **全部**在 `src/ai/styles/` 下:

```
$ find src -name '*.scss'
src/ai/styles/{agent-styles,knowledge,mcp-styles,parser-styles,popover,
               settings-styles,skills-styles,sk-shared,tokens}.scss     # 9/9
$ find src -name '*.css'
src/{files/viewers/viewers,kvm/styles/kvm,settings/styles/settings,
     styles/theme,styles/theme.sp9}.css                                 # 5
```

删掉 `src/ai` 后产物树只剩 5 个 → `expect(5).toBeGreaterThan(5)` 必红。

**处理**:补一条 PATCH 把阈值改成 `> 4`,并在被写入的代码里留注释说明。
**这不是放宽守卫**:产物树共 5 个样式表,阈值 4 的语义正是「5 个一个不少地读到了
非空内容」;`?raw` 恒空的老坑一旦复发(读到 0 个)照样立刻打红,判别力与私有侧等价。
—— 是按产出树的真实规模重新钉紧,不是删钉子。

### 轮 5 · `oss/tree.test.mjs` 守卫 —— 又抓到 2 条我自己写的违规

```
FAIL 类 2 · 冻结分身注释不泄露内部开发状态 > PATCH 的 replace 内容也不含固定清单里的词
AssertionError: PATCH[112] src/i18n/zh_cn.ts :: /\bSP\d(?!\.ts)/i:
  expected '// 中文文案(默认 / fallback locale)。\n//\n/…' not to match /\bSP\d(?!\.ts)/i
```

该守卫禁止 `PATCH` 的 **replace payload** 出现内部期号/分支代号等词,期号只在
**文件名形式**下豁免(`(?!\.ts)`)。用脚本把全部 245 条 replace 过一遍词表,查出 2 处:

| 位置 | 命中 | 处理 |
|---|---|---|
| `PATCH[112]` `zh_cn.ts` 文件头 replace | `sp9` | 措辞从「sp9 那一片」改成「**zh_cn.sp9.ts** 那一片」(走文件名豁免) |
| `PATCH[244]` `vite.config.ts` replace | `Vue2` | 锚点从 2 行**收窄到只吃带 `ai` 的那一行**;含 `Vue2` 的上一行属「保留原文」,不经 replace 写入,不受该守卫管辖,也不在泄漏词表里 |

修完复跑词表脚本 → `replace payload 违规 0 处`。

> 这两条是这套机制价值的活样本:补丁"响了一声",而且响在**我自己新写的措辞**上,
> 不是在别人的代码上。全程没有为了让脚本跑过去而删哈希钉、放宽词表或放松 `find`。

### 轮 6 · 全部复跑

| 检查 | 结果 |
|---|---|
| 锚点核对 | `DELETE 72 / 0 不存在`、`PATCH 245 / 0 失配`、`SERVICE_* 全绿` |
| replace payload 词表 | 0 处违规 |
| 泄漏分区扫描 | **NEW-UI 0** / SERVICE 977 |
| 产物树 install + vue-tsc | 通过 |
| 产物树 vitest | **374 文件 / 3683 用例全绿** |
| 私有仓 vitest(排除 `oss/`) | 595 文件 / 9785 用例全绿 |
| `oss/` 自测 | `apply` / `forbidden` / `export-rsync` / `media-wave` / `dist-scan` 全绿;`tree.test.mjs` 余 2 条失败(见 §7) |

> 私有仓测试第一次跑出过 `1 failed`,同命令复跑为 `0 failed`,失败项未落进
> reporter 输出。判定为既有 flaky(`src/photos/stores/__tests__/favorites.test.ts`
> 一带的 jsdom `Not implemented: navigation` 噪音),与本刀无关 —— 本刀只改了
> `oss/manifest.mjs`,而 `src/**` 的测试没有任何一个 import 它。

---

## 7. 剩余失败清单及归属判定

`oss/tree.test.mjs` 余 **2 条**失败,判定 **100% 属 Service 侧(T8)**:

| 失败用例 | 命中内容 | 归属 |
|---|---|---|
| `泄漏守卫 > 不带 --skip-guard 也能跑通` | 977 处,分区统计 `SERVICE: 977 / NEW-UI: 0` | **Service** |
| `泄漏守卫 > 手工抽查(独立于词表的第二重验证)` | 4 个文件,全部 `packages/service/.superpowers/sdd/2026-07-23-…/*.md` | **Service** |

977 处按文件聚合(前几名):

```
373  packages/service/src/ai.test.ts
 52  packages/service/src/ai.ts
 40  packages/service/src/wiki.test.ts
 40  packages/service/src/wiki.ts
 19  packages/service/src/notes.test.ts
  9  packages/service/src/index.ts
  7  packages/service/src/notes.ts
~437 packages/service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/*.md(11 个文件)
```

**归属判定依据**:全部 977 条的 `file` 字段都以 `packages/service/` 开头
(分区脚本逐条判定,New-UI 侧计数为 0)。它们要靠 `SERVICE_DELETE` / `SERVICE_PATCH`
解决,而本刀按 dispatch 的分界**一条都没动 Service 段**。

给 T8 的现成线索(我扫出来但没动的):

1. **`packages/service/.superpowers` 整个目录要进 `SERVICE_DELETE`**(~437 处)。
   New-UI 的 `DELETE` 表早有 `.superpowers` 一条,注释写着「08-05 起入库,git archive
   才拿得到,从前不用列」—— Service 仓是**同一原因、同一时间点**,只是那一轮没跟着补。
2. **`src/ai.ts` / `src/ai.test.ts`**(425 处)、**`src/wiki.ts` / `src/wiki.test.ts`**
   (80 处)、**`src/notes.ts` / `src/notes.test.ts`**(26 处)三对要进 `SERVICE_DELETE`。
3. **`src/index.ts`**(9 处)是接线点,须打 `SERVICE_PATCH` 摘掉这三个域的
   `import` / `export type` / getter —— **与 photos/search 那两轮同型**;
   只删域文件不打接线补丁,内嵌共享包会直接构建失败,而词表守卫和 tree 测试全绿
   (manifest 里 SP9-P7 那节注释已经把这个坑写明了)。

---

## 8. Concern / 挂账

1. **lockfile 漂移(新引入,建议发布前统一处理)**
   摘掉 6 个依赖后,`pnpm-lock.yaml` 的 `importers` 记录不会跟着删(`export.mjs` 只
   重写 `file:` 路径)。`tree.test.mjs` 的「产物树能构建」门用的是
   `pnpm install --no-frozen-lockfile`,**不受影响**(已实测通过);但产出仓里
   `CI=true pnpm install` 会因 `ERR_PNPM_OUTDATED_LOCKFILE` 失败。
   已写进 manifest 注释。建议 T8/发布前决定:要么补 lockfile 补丁,要么在产出仓
   README/CI 说明里明确用 `--no-frozen-lockfile`。

2. **`sortablejs` + `@types/sortablejs` 在产出树里是孤儿依赖(既有债,未动)**
   实测消费方 4 个,全部是相册文件(`src/photos/composables/useAlbumDragSort.ts`、
   `src/views/PhotosAlbumDetail.vue` 及其测试),全在既有 DELETE 表里。
   这是 SP7 相册轮遗留的,不是本次合流引入,故本刀未动 —— 但它和 tiptap 是同一类,
   建议一并清掉。

3. **`sass` devDep 在产出树里也失去了直接理由**
   9 个 `.scss` 全在 `src/ai/styles/`,删完产出树 `.scss` 数为 0。未动:`sass` 是
   构建期依赖,留着无害,删它风险大于收益。记一笔供发布前定夺。

4. **`shardDisjoint.test.ts` / `messageSyntax.test.ts` 走整体删除,是判断题不是事实题**
   §2 已列出「为什么删而不是打补丁」的完整论证与覆盖等价性取证。若评审认为
   产出树仍应保留一份两片版守卫,可改成 `REPLACE`(带私有侧 sha256 哈希钉),
   代价是新增 2 个冻结分身文件、且私有侧每次改动都会打红导出。

5. **`en_us.ts` 文件头锚点 dispatch 说断了、实测没断**
   已按「扩锚点到 2 行」处理(见 §3.1)。记在这里是因为 dispatch 的另一条纪律
   ——「同样的报错文字 ⇒ 同样的根因不成立」——反过来也成立:
   **同样的预告不等于同样的现场**,7 条失配是逐条核出来的,不是照单接收的。
