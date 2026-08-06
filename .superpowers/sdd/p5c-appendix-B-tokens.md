# P5c 附录 B —— 色值映射表(**57 行 / 60 处**)

> **权威源**(全部 `git show main:`,Vue2 `main`@`7a6ee6b7`):
> `src/views/AI/Parser/parser-styles.scss`(74 行)· `src/views/AI/Parser/ParserTest.vue:245-369`(内联 `<style>` **125 行**)·
> `src/components/common/FolderBrowser.vue:82-143`(`<style scoped>`)· `src/views/AI/Knowledge/styles/knowledge.scss`(2561 行)。
> 本表每一行号 T0 都逐行打开核过,并用正则
> `#[0-9a-fA-F]{3,8}|rgba?\(…\)|(?<![\w-])(white|black|red|green|blue)(?![\w-])` 独立全扫。

## 🔴 五条硬约束(违反即停)

1. **表里没有的色字面量 → 停下写 `NEEDS_CONTEXT`,不许自己发明映射。**
2. **注释里也不许出现色字面量**(R5),一律改「蓝本 `file:line` + 中文描述」。
   **唯一豁免:`knowledge.scss` 那两个 token 声明块内部**(K21 扩选择器后仍是那两个块)。
3. **禁用 `theme-exception` 逃逸。**
4. **`white` / `black` 具名色也算字面量**;`transparent` 是 CSS 关键字**不算**(P5a T11 已定口径)。
   本期 `transparent` 共 **4 处**,全部照抄、不计入映射:
   `knowledge.scss:1251`(`.k-set-danger` 渐变的第二个色标)· `:1228`(`.k-set-svc` 渐变第二色标)·
   `FolderBrowser.vue:100`(`.fb-crumb { background: transparent }`)· `:121`(`.fb-row { background: transparent }`)。
5. 🔴 **`.parser-app` 块里零颜色属性、零 `--x:` 声明**(治理 §6.1 落地约束 1)。

## B.0 🔴 范围表 —— 四处来源 + 一处「实测为 0」

| # | 来源 | 总行数 | 含字面量行 / 处数 | 落到哪 |
|---|---|---|---|---|
| ① | `parser-styles.scss` | 74 | **12 / 12** | `src/ai/styles/parser-styles.scss` 的 `.parser-app.parser-status-page` 段 |
| ② | `ParserTest.vue:245-369` 内联 `<style lang="scss" scoped>` | 125 | **31 / 33** | 同文件的 `.parser-app.parser-test-page` 段 |
| ③ | `FolderBrowser.vue:82-143` `<style scoped>` | 62 | **5 / 5** | `knowledge.scss` 的 `.fb-*` 段(嵌进 `.knowledge-app`) |
| ④ | `knowledge.scss` 本期要搬的 10 段 | 187 | **9 / 10** | `knowledge.scss` 原位 |
| ⑤ | **模板 `style=` / `:style=` / `color=` 属性** | — | 🔴 **0 / 0** | — |
| | **合计** | | 🔴 **57 行 / 60 处** | |

🔴 **⑤ 必须显式记 0,不能省略这一栏** —— P5b 的 **E-11** 就是「附录只扫了 `.scss`,漏掉模板内联」。
T0 已把 4 个蓝本模板逐行复扫,实测:
- `SettingsView.vue`:`style="flex: 1"`(`:10`)· `style="align-items: flex-start"`(`:72`)·
  `style="border-top: 1px dashed var(--line); margin-top: 12px; padding-top: 12px"`(`:79`)·
  `style="margin-top: 10px"`(`:81`/`:87`/`:133`/`:144`)· `style="width: min(460px, 100%)"`(`:122`)·
  `style="color: var(--text-tertiary)"`(`:129`)· `color="var(--warning)"`(`:130`)·
  `:color="dirProbe.state === 'done' && !dirProbe.migratable ? 'var(--danger)' : 'var(--success)'"`(`:135`)·
  `color="var(--success)"`(`:141`/`:142`)· `style="color: var(--danger)"`(`:138`)·
  `style="display: block; margin-top: 2px"`(`:110`)· `style="flex: 1"`(`:161`)·
  `style="font-size: 14px; font-weight: 600; letter-spacing: -0.005em"`(`:162`)·
  `style="font-size: 12px; color: var(--text-secondary); margin-top: 2px"`(`:163`)·
  `color="var(--text-tertiary)"`(`:165`)· `style="color: var(--danger)"`(`:171`)·
  `style="padding: 8px 0"`(`:175`)
  → **每一处颜色都已经是 `var(…)`,零字面量。照抄,一个字节都不改。**
- `ParserStatus.vue`:只有 `:style="{ width: barWidth(f.count) + '%' }"`(`:86`)—— 布局量,零颜色。
- `ParserTest.vue` / `FolderBrowser.vue`:模板里**零** `style=` / `:style=` / `color=`。

## B.1 🔴 C-2 裁定 —— 两份 scss 的重名类,哪些真同、哪些不同

T0 把两份 scss 全展开成「完整选择器路径 → 声明列表」,做了双向 diff。

**① 完整路径相同的只有 3 条,声明逐字相同:**

| 完整路径 | 声明(两份逐字相同) |
|---|---|
| `.card` | `background: var(--ns-color-elevation, #fff)` · `border: 1px solid var(--ns-color-border, #e1e4e8)` · `border-radius: 6px` · `padding: 14px 16px` · `margin-bottom: 12px` |
| `.page-header` | `display: flex` · `justify-content: space-between` · `align-items: center` · `margin-bottom: 16px` |
| `.page-header h2` | `margin: 0` · `font-size: 18px` |

**② 其余同名类的完整路径不同、声明也不同 —— 🔴 合并就是界面不 1:1:**

| 名字 | `parser-styles.scss`(ParserStatus) | `ParserTest.vue` 内联 | 同? |
|---|---|---|---|
| `.row` | `.control-card .row`:`gap: 16px` + `padding: 6px 0` | `.upload-card .row`:`gap: 12px` + `margin: 8px 0` | 🔴 **不同** |
| `h3` | `.folders-card h3`:`margin: 0 0 10px` · `font-size: 14px` · **`font-weight: 500`** | `.scored-card h3` / `.chunks-card h3`:`margin: 0 0 10px` · `font-size: 14px`(**无 font-weight**) | 🔴 **不同** |
| `li` | `.failures-card .failure-list li`:`padding: 6px 0` · `border-top: 1px dashed #e1e4e8` | `.scored-card .scored-list li`:`padding: 8px 0` · `border-top: 1px dashed #eee` | 🔴 **不同**(连虚线色都不同) |
| `.hint` | (无) | 🔴 **同一文件里就有两份不同的**:`.upload-card .dropzone .hint`(`margin-left: 8px`,12px)vs `.chunks-card .chunk-head .hint`(11px) | 🔴 **不同** |
| `.empty` | `.folders-card .empty`:`color: #888` | `.chunks-card .empty`:`color: #888` | 声明同,**父卡片不同** |
| `.toggle` | `.failures-card .toggle` | `.docling-card .toggle` | 声明同,**父卡片不同** |

**→ 裁定(治理 K23)**:**两页各自一个作用域**(`.parser-app.parser-status-page` / `.parser-app.parser-test-page`),
上面 ① 那 3 条**各写一份**(逐字相同,写两份无视觉风险);② 天然各归各页。
**不许抽一个共享段。** 承 P5b §B.0.2 的「东西在哪儿就搬到哪儿」。

## B.2 🔴 `--ns-color-*` 在 Vue2 里零声明 → 映射按「真实渲染值」建(C-1)

```bash
git -C /home/nimo/NimoTech/NimoOS-UI grep -n -- "--ns-color-" main
#   main:src/views/AI/Parser/ParserTest.vue:10
#   main:src/views/AI/Parser/parser-styles.scss:9
git -C /home/nimo/NimoTech/NimoOS-UI grep -n -- "--ns-color-[a-z-]*:" main     # 零命中
```

**19 次引用、0 处声明** → 每个 `var(--ns-color-X, FALLBACK)` **真实渲染的就是 `FALLBACK`**。
本表一律按 fallback 的语义建映射,**不按 token 名猜语义**。涉及 6 个假 token:

| 假 token | 回退值 | 真实语义 | → New-UI token |
|---|---|---|---|
| `--ns-color-elevation` | `#fff` | 卡片实底 | `var(--bg-elevated)` |
| `--ns-color-border` | `#e1e4e8` | 卡片描边 / 输入框描边 / 虚线分隔 | `var(--line-faint)` |
| `--ns-color-link` | `#4a90e2` | 链接色 / 主按钮底 / 高亮描边 | `var(--accent)` |
| `--ns-color-primary` | `#4a90e2` | 进度条底(与 link 同值) | `var(--accent)` |
| `--ns-color-danger` | `#e74c3c` | 错误前景 / 错误描边 | `var(--danger)` |
| `--ns-color-success` | `#2ecc71` | 运行中指示灯 | `var(--success)` |
| `--ns-color-warning` | `#f5a623` | 暂停指示灯 | `var(--warning)` |

🔴 **落地写法:不保留 `var(--ns-color-*, …)` 这层壳,直接写 New-UI token。**
保留它等于在新仓引入一个全仓无声明的 token 名(死引用),而且 `knowledgeStyles.test.ts` 那条
「`var()` 引用闭环」守卫的同款检查会在 `parserStyles.test.ts` 里逮到它。
**注释里写「蓝本 `file:line` 原是一个无声明的 `--ns-color-*` + 回退值,回退值语义 = XXX」,不许写出回退值本身(R5)。**

## B.3 ① `parser-styles.scss` 的裸色 → token(**12 行 / 12 处**)

落点:`src/ai/styles/parser-styles.scss` 的 `.parser-app.parser-status-page { … }` 段。

| 蓝本行 | 蓝本原文(逐字) | → 映射 | 依据 |
|---|---|---|---|
| `:14` | `.test-link { color: var(--ns-color-link, #4a90e2) }` | `var(--accent)` | B.2 |
| `:20` | `.card { background: var(--ns-color-elevation, #fff) }` | `var(--bg-elevated)` | B.2。浅档 `var(--card-bg)` = `#ffffff` → **与 Vue2 逐字同值** |
| `:21` | `.card { border: 1px solid var(--ns-color-border, #e1e4e8) }` | `var(--line-faint)` | B.2 |
| `:27` | `.card.unreachable { border-color: var(--ns-color-danger, #e74c3c) }` | `var(--danger)` | B.2 |
| `:28` | `.card.unreachable { color: var(--ns-color-danger, #e74c3c) }` | `var(--danger)` | B.2 |
| `:36` | `.dot { background: var(--ns-color-success, #2ecc71) }` | `var(--success)` | B.2 |
| `:37` | `.dot.paused { background: var(--ns-color-warning, #f5a623) }` | `var(--warning)` | B.2;见 §B.7 取舍② |
| `:43` | `.resolved-hint { color: #888 }` | `var(--text-tertiary)` | 三级灰辅助文字;暗 `#6E6C68` / 浅 `var(--fg-faint)` |
| `:52` | `.folders-card .empty { color: #888 }` | `var(--text-tertiary)` | 同上 |
| `:62` | `.folder-bar { background: var(--ns-color-primary, #4a90e2) }` | `var(--accent)` | B.2。**同行的 `opacity: 0.5` 照抄**(不是颜色属性) |
| `:69` | `.failure-list li { border-top: 1px dashed #e1e4e8 }` | `var(--line-faint)` | 与 `:21` 的卡片描边同值同语义 |
| `:71` | `.error { color: var(--ns-color-danger, #e74c3c) }` | `var(--danger)` | B.2 |

## B.4 ② `ParserTest.vue:245-369` 内联 `<style>` 的裸色 → token(**31 行 / 33 处**)

落点:`src/ai/styles/parser-styles.scss` 的 `.parser-app.parser-test-page { … }` 段。
🔴 **`ParserTest.vue` 的 `<style>` 块本身不搬**(New-UI 组件零 `<style>` 块,承 P5a §5 / P5b §5);
内容整体搬进 `parser-styles.scss`,组件侧 `import '../../styles/parser-styles.scss'`。

| 蓝本行 | 蓝本原文(逐字) | → 映射 | 依据 |
|---|---|---|---|
| `:254` | `.back-link { color: var(--ns-color-link, #4a90e2) }` | `var(--accent)` | B.2 |
| `:257` | `.card { background: var(--ns-color-elevation, #fff) }` | `var(--bg-elevated)` | B.2(与 `parser-styles.scss:20` 同,K23 各写一份) |
| `:258` | `.card { border: 1px solid var(--ns-color-border, #e1e4e8) }` | `var(--line-faint)` | 同上 |
| `:264` | `.help-card .small { color: #888 }` | `var(--text-tertiary)` | 三级灰 |
| `:267` | `.dropzone { border: 2px dashed #c1c1c1 }` | `var(--line-strong)` | 比卡片描边**更重**的虚线(拖放区要看得见)→ 描边强档;暗 `#3A3A3D` / 浅 `#D8D3C7` |
| `:273` | `.dropzone.active { background: rgba(74, 144, 226, 0.08) }` | `var(--accent-soft)` | `rgba(74,144,226,·)` 就是蓝本的强调蓝;alpha 0.08 ≈ `--accent-soft`(暗 0.14 / 浅 0.11)。**同 P5b B.3 `:1891` 把 `rgba(0,122,255,0.1)` 映到 `--accent-soft` 的口径** |
| `:273` | `.dropzone.active { border-color: var(--ns-color-link, #4a90e2) }` | `var(--accent)` | B.2 |
| `:276` | `.dropzone .hint { color: #888 }` | `var(--text-tertiary)` | |
| `:287` | `.param { color: #555 }` | `var(--text-secondary)` | 二级灰(参数标签比 hint 深);暗 `#A3A09A` / 浅 `var(--fg-muted)` |
| `:290` | `.param input { border: 1px solid var(--ns-color-border, #e1e4e8) }` | `var(--line-faint)` | B.2 |
| `:295` | `.hint-line { color: #888 }` | `var(--text-tertiary)` | |
| `:296` | `.hint-line em { color: #aaa }` | `var(--text-quaternary)` | 比 `#888` **更淡**的第四档;暗 `#4D4B48` / 浅 `#BCB8AD` |
| `:298` | `.ok-hint em { color: #888 }` | `var(--text-tertiary)` | |
| `:301` | `.query-input { border: 1px solid var(--ns-color-border, #e1e4e8) }` | `var(--line-faint)` | B.2 |
| `:307` | `.submit-btn { background: var(--ns-color-link, #4a90e2) }` | `var(--accent)` | B.2 |
| `:307` | `.submit-btn { color: #fff }` | `var(--text-on-accent)` | 🔴 **实底强调色上的前景** → `--text-on-accent`,**不是** `--bg-elevated`。承 P5b B.2 `:771`/`:779`/`:839`/`:845` 的既有先例(记忆 `--on-accent 只在 accent 实底上可用`) |
| `:310` | `.ok-hint { color: #2ecc71 }` | `var(--success)` | `#2ecc71` 就是蓝本的成功绿(与 `--ns-color-success` 的回退同值) |
| `:313` | `.error-box { background: rgba(231, 76, 60, 0.08) }` | `var(--danger-soft)` | `rgba(231,76,60,·)` 就是 `#e74c3c` 的 RGB;alpha 0.08 ≈ `--danger-soft`(暗 0.16 / 浅 0.1)。同 P5b 把 `rgba(255,59,48,0.12)` 映到 `--danger-soft` 的口径 |
| `:314` | `.error-box { border-left: 3px solid var(--ns-color-danger, #e74c3c) }` | `var(--danger)` | B.2 |
| `:315` | `.error-box { color: var(--ns-color-danger, #e74c3c) }` | `var(--danger)` | B.2 |
| `:323` | `.docling-md { background: rgba(74, 144, 226, 0.05) }` | `var(--accent-softer)` | alpha 0.05 是**最淡档** → `--accent-softer`(暗 0.10 / 浅 0.06);比 `:273` 的 0.08 更淡,两档 token 也保持这个大小关系 ✅ |
| `:324` | `.docling-md { border-left: 3px solid var(--ns-color-link, #4a90e2) }` | `var(--accent)` | B.2 |
| `:332` | `.scored-card .warn { color: #f5a623 }` | `var(--warning)` | 与 `--ns-color-warning` 回退同值;见 §B.7 取舍② |
| `:334` | `.scored-list li { border-top: 1px dashed #eee }` | `var(--line-faint)` | 最淡分隔线 |
| `:339` | `.rank-line .score { color: #2ecc71 }` | `var(--success)` | 同 `:310` |
| `:340` | `.rank-line .rerank-score { color: #4a90e2 }` | `var(--accent)` | 裸写的强调蓝(不走假 token) |
| `:341` | `.rank-line .chunk-ref { color: #888 }` | `var(--text-tertiary)` | |
| `:347` | `.chunks-card .empty { color: #888 }` | `var(--text-tertiary)` | |
| `:350` | `.chunk-item { border-top: 1px dashed #eee }` | `var(--line-faint)` | 同 `:334` |
| `:355` | `.chunk-head .hint { color: #888 }` | `var(--text-tertiary)` | |
| `:359` | `.chunk-text { background: rgba(0,0,0,0.03) }` | `var(--bg-chip)` | 中性 chip 底(等宽代码块的浅底)。**同 P5b B.4 ② 把 `rgba(20,20,20,0.07)` 映到 `--bg-chip` 的口径**;暗 `#2A2A2C` / 浅 `var(--tool-bg-hi)` |
| `:365` | `.emb-preview .emb-label { color: #888 }` | `var(--text-tertiary)` | |
| `:366` | `.emb-preview code { color: #555 }` | `var(--text-secondary)` | 同 `:287` |

**行数核对**:`:273` 与 `:307` 各含 **2 处** → 31 行 / 33 处 ✅

## B.5 ③ `FolderBrowser.vue:82-143` 的裸色 → token(**5 行 / 5 处**)

落点:`knowledge.scss` 的 `.fb-*` 段,**嵌进 `.knowledge-app`**(K9 同族 —— 蓝本这段靠 Vue2 `scoped` 隔离,
搬进全局 scss 必须自己收口。FolderBrowser 只在 `.knowledge-app` 下被用到:
`SettingsView.vue:80` 与 P5d 的 `RootsView.vue`)。

🔴 **C-1 第二半已实测**:`--border` / `--bg-tertiary` 在 Vue2 `src/` 下**零声明**
(唯一 `--border:` 声明在 `public/guide/google-drive.html:9`,独立静态页,作用域无关)
→ 这三处 `var(--x, FALLBACK)` **真实渲染的都是 fallback**,按 fallback 的语义映射。
**对比**:同文件里不带 fallback 的 `var(--text-secondary)`(`:104`)/ `var(--text-primary)`(`:126`)/
`var(--text-tertiary)`(`:108`)/ `var(--danger)`(`:142`)**在 Vue2 有声明**
(`knowledge.scss:18-31` 的 `.knowledge-app` 块)→ 真的解析成 knowledge 的值,**照抄不动**。

| 蓝本行 | 蓝本原文(逐字) | 真实渲染值 | → 映射 | 依据 |
|---|---|---|---|---|
| `:85` | `.fb { border: 1px solid var(--border, rgba(127, 127, 127, 0.25)) }` | `rgba(127,127,127,0.25)` | `var(--line)` | 整个选择器盒子的外描边 → 标准描边档;暗 `#2E2E31` / 浅 `var(--card-border)` |
| `:95` | `.fb-crumbs { border-bottom: 1px solid var(--border, rgba(127, 127, 127, 0.18)) }` | `rgba(127,127,127,0.18)` | `var(--line-faint)` | 盒子**内部**的分隔线,比外描边更淡(蓝本 0.18 < 0.25)→ 淡描边档,保持大小关系 ✅ |
| `:96` | `.fb-crumbs { background: var(--bg-tertiary, rgba(127, 127, 127, 0.06)) }` | `rgba(127,127,127,0.06)` | `var(--bg-sunken)` | 面包屑条是「下沉」的工具条底;暗 `#161617` / 浅 `var(--tool-bg)` |
| `:106` | `.fb-crumb:hover { background: rgba(127, 127, 127, 0.12) }` | 同左 | `var(--line)` | **中性加深 hover**;承 P5b B.2 `:247` 把 `.k-banner-close:hover` 的 `rgba(0,0,0,0.06)` 映到 `var(--line)` 的同款口径 |
| `:128` | `.fb-row:hover { background: rgba(127, 127, 127, 0.1) }` | 同左 | `var(--line)` | 同上。⚠️ 蓝本这两处 alpha 差 0.02(0.12 vs 0.1),**同映一个 token 是有意的** —— 全仓没有「两级中性 hover」token,新造一个只为 2% 差异不值(治理 §6「优先复用既有 token,尽量不新造」)。**登记成取舍③** |

## B.6 ④ `knowledge.scss` 本期要搬的 10 段(**9 行 / 10 处**)

**要搬的 10 段(行号 T0 逐个 `sed -n` 打开核准)**:

| 段 | 范围 | 内容 | 字面量 |
|---|---|---|---|
| A | **`:969-984`** | 头注释 + `.k-section` / `-head` / `-title` / `-hint` 四个类 | 0 |
| B | `:1141-1149` | 头注释 `/* ---------- Settings page ---------- */` + `.k-set-card` | 0 |
| C | `:1159-1179` | `.k-set-row` / `-info` / `-title` / `-cn` / `-desc`(内含 `.warn` 嵌套) | 0 |
| D | `:1181-1201` | `.k-radio-group`(内含 `button` + `&[data-on="true"]`) | 0 |
| E | `:1203-1225` | `.k-sw`(内含 `&::after` + `&[data-on="true"]`) | **2** |
| F | `:1227-1247` | `.k-set-svc` / `.k-svc-state` / `.k-svc-light`(含 `&[data-state="paused"]`)/ `.k-svc-name` / `.k-svc-cn` | **2** |
| G | `:1249-1265` | `.k-set-danger`(内含 `.k-set-row-title`)/ `.k-set-soon` | **2** |
| H | `:1267-1293` | `.k-sandbox-link`(含 `&:hover`)/ `.k-sandbox-icon` | **4** |
| I | `:1317-1334` | `.k-modal-head` / `-title` / `-x`(含 `&:hover`)/ `-body` —— **K17 兑现** | 0 |
| J | **`:2250-2263`** | 头注释 + `.kn-picked`(2 行,含 `code`)/ `.kn-pick-actions` / `.kn-pick-note` / `.kn-mig-path` / `.kn-mig-req`(含 `li`)/ `.kn-checkline`(含 `input`) | 0 |

🔴 **A 段的边界是 `:969-984`,不是 brief 写的 `:969-988`(勘误 E-3)。** `.k-section-body` 是 **`:985-991`**
(Allowlist 专用,**不搬**);按 `:988` 切会**截断**它、吐出半条规则 → sass 编译报错。
🔴 **`:1151-1157` 的 `.k-progress-*` 六个类夹在 B 与 C 之间,不搬(N15)。**
🔴 **A 段与 B–I 段已经嵌在蓝本的 `.knowledge-app { … }`(`:6-1508`)里,原样落位即可;
J 段(`:2250-2263`)是顶层裸选择器 → 必须重新嵌进 `.knowledge-app`(K9)。**

| 蓝本行 | 蓝本原文(逐字) | → 映射 | 依据 |
|---|---|---|---|
| `:1217` | `.k-sw::after { background: white }` | `var(--switch-thumb)` | **新 token(§B.8)**,`tokens.scss:201`/`:345` 逐字同值,注释原文说的就是同一个 iOS 开关拨钮 |
| `:1218` | `.k-sw::after { box-shadow: 0 2px 4px rgba(0,0,0,0.18) }` | `var(--switch-thumb-shadow)` | **新 token(§B.8)**,`tokens.scss:202`/`:346` = `0 2px 4px rgba(0, 0, 0, 0.18)` **逐字同值**(整条 box-shadow 都在 token 里,写成 `box-shadow: var(--switch-thumb-shadow)`) |
| `:1239` | `.k-svc-light { box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.18) }` | `0 0 0 4px var(--success-soft)` | `rgba(52,199,89,·)` 就是蓝本的成功绿 `#34C759`;**alpha 0.18 与 `--success-soft` 暗档逐字相同**(`rgba(79,184,112,0.18)`)。两档已有 |
| `:1243` | `.k-svc-light[data-state="paused"] { box-shadow: 0 0 0 4px rgba(255, 149, 0, 0.2) }` | `0 0 0 4px var(--warning-soft)` | `rgba(255,149,0,·)` = 蓝本橙 `#FF9500`;承 P5b B.2 `:2036` 把 `rgba(255,149,0,0.14)` 映到 `--warning-soft` 的口径。两档已有 |
| `:1250` | `.k-set-danger { border-color: rgba(255, 59, 48, 0.3) }` | `var(--danger-soft-border)` | 承 P5b B.2 `:1418`(0.2)与 `:2039`(0.25)同映此 token 的既有口径。两档已有 |
| `:1251` | `.k-set-danger { background: linear-gradient(135deg, rgba(255, 59, 48, 0.04), transparent) }` | `linear-gradient(135deg, var(--danger-soft-faint), transparent)` | 承 P5b B.2 `:1417`(0.06)与 B.3 `:1972`(0.07)同映此 token。**`transparent` 照抄,渐变角度 `135deg` 逐字不变** |
| `:1287` | `.k-sandbox-icon { background: linear-gradient(135deg, #5AC8FA, #007AFF) }` | `var(--grad-sandbox)` | **新 token(§B.8)**,`tokens.scss:236` 的 `--grad-sk-blue` **整条渐变逐字同值**(**2 处**字面量一次解决) |
| `:1288` | `.k-sandbox-icon { color: white }` | `var(--text-on-accent)` | 实底彩色瓷砖上的前景;承 P5b B.2 `:771`/`:779`/`:839`/`:845` |
| `:1292` | `.k-sandbox-icon { box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.2) }` | `var(--gloss-inset-dot)` | **新 token(§B.8)**,`tokens.scss:162`/`:321` = `inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)` **整条逐字同值**(写成 `box-shadow: var(--gloss-inset-dot)`) |

**行数核对**:`:1287` 含 2 处(两个 hex)→ 9 行 / 10 处 ✅

## B.7 🔴 必须显式登记的三个取舍(**别让实现者/评审以为是 bug**)

**取舍① —— 暗色档与 Vue2 不同(K25)。**
Vue2 只有一套(实际渲染的)浅色值。New-UI 的 `.parser-app` 走两档 token,暗档会跟着变深/变亮。
**这是用户 2026-08-03 口径的直接后果,不是回归。** 与 P5b §B.0.3 的取舍同族。
评审**不要**按「与蓝本像素不同」报缺陷;要按「语义对不对、两档都可读、版式/结构/文案逐字不变」判。

**取舍② —— 浅色档里 `--warning` 与 `--success` 比 Vue2 明显更深。**
| 蓝本浅色渲染值 | New-UI 浅档 token 值 | 差异 |
|---|---|---|
| `#f5a623`(亮橙) | `--warning` = `var(--toast-warn-fg)` = **`#92600c`**(深琥珀) | 🔴 **肉眼可见**:暂停指示灯 `.dot.paused`、`.warn` 文字 |
| `#2ecc71`(emerald 绿) | `--success` = **`#15754c`**(深绿) | 可见但同族:运行指示灯 `.dot`、`.ok-hint`、`.score` |
| `#e74c3c`(alizarin 红) | `--danger` = `var(--toast-danger-fg)` = `#c0392b` | 几乎一致(同一 flat-UI 红家族的深色兄弟) |
| `#fff` | `--bg-elevated` = `var(--card-bg)` = `#ffffff` | **逐字相同** |
| `#4a90e2`(柔蓝) | `--accent` = `#3b5bdb`(更饱和的蓝) | 可见但同族 |
| `#e1e4e8`(冷灰) | `--line-faint` = `#EEEBE3`(暖灰) | 冷↔暖,极淡档,几乎不可辨 |

**原因**:浅档 token 来自 K2 为整个 AI 区定下的**暖中性纸感色板**(`theme.css` 浅档 + `tokens.scss` 浅档),
全仓 `.agent-app` / `.set-app` / `.knowledge-app` 都用这一套。
🔴 **裁定:保持一致性,不为 Parser 两页开小灶。** 唯一的替代是新造
`--warning-vue2` / `--success-vue2` 之类只给这两页用的 token —— 那既违反「优先复用既有 token」,
也会让 Parser 两页在暗档下与全站脱节。
**这一条要写进验收清单**,让用户知道「颜色不是完全一模一样是预期的」;若用户不接受 → 独立产品决策票。

**取舍③ —— `FolderBrowser` 两处 hover(alpha 0.12 / 0.1)同映 `var(--line)`。**
全仓没有「两级中性 hover」token,为 2% 的 alpha 差新造一个不值。见 §B.5 `:106`/`:128`。

## B.8 新 token(**4 个,全部有仓内逐字同值出处,零「凭空造」**)

声明位置:`knowledge.scss` 的两个 token 声明块内部
(K21 扩选择器后是 `.knowledge-app, .parser-app { … }` 与
`:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app { … }`)。
**这两个块内允许字面量,块外全文零字面量。**

| token | 暗档值 | 浅档值 | 被哪几行用到 | 值的出处(T0 逐行核过,逐字相同) |
|---|---|---|---|---|
| `--switch-thumb` | `#ffffff` | `#ffffff` | 蓝本 `knowledge.scss:1217` | `src/ai/styles/tokens.scss:201`(浅块 `:31-247`)/ `:345`(暗块 `:249-365`)。🔴 **该 token 的注释原文**:「SP8-P2a Task 6 —— iOS-style switch thumb (SetSwitch.vue / `.sw::after` in sk-shared.scss). Vue2 source (skills-styles.scss:235-249) had a literal `background: white` + `box-shadow: 0 2px 4px rgba(0,0,0,0.18)` for the round knob.」**和 `.k-sw::after` 是同一个东西** |
| `--switch-thumb-shadow` | `0 2px 4px rgba(0, 0, 0, 0.18)` | 同左 | 蓝本 `:1218` | `tokens.scss:202` / `:346` |
| `--gloss-inset-dot` | `inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)` | 同左 | 蓝本 `:1292` | `tokens.scss:162` / `:321`。注释解释了它为什么与 `--gloss-inset`(0.18)分开:保 Vue2 的确切 0.2 |
| `--grad-sandbox` | `linear-gradient(135deg, #5AC8FA, #007AFF)` | 同左 | 蓝本 `:1287` | `tokens.scss:236` 的 **`--grad-sk-blue`**,值逐字相同。🔴 **改名不改值** —— `-sk-` 是技能区专用命名,知识库区借它的名字会误导。T0 已 grep 全仓:`--grad-sandbox` 零重名 |

🔴 **四个都是 theme-invariant(两档同值)** —— 与 `.knowledge-app` 里既有的 `--purple` / `--pink` / `--teal`
(注释「两档同值,AI tokens.scss 暗色块未重定义」)、以及 `--modal-scrim`(两档同值)同族。
**浅档必须显式各写一份**(不许留空靠继承 —— `knowledge.scss` 头注释 `:69-75` 已论证过「靠继承」不成立:
暗档块 `.knowledge-app { … }` 的选择器无 `data-theme` 限定、在浅色主题下同样命中)。
→ 因为两档都写了,`knowledgeStyles.test.ts:459-489` 的「浅色档覆盖完整性」集合断言**天然通过**,
**那条「例外清单恰好 11 个」保持 11 项不变,不许扩。**

🔴 **`knowledgeStyles.test.ts:332` 的 R2「*-soft/-scrim/-hover token 两档都有值」数组**:
本期这 4 个 token 名都不含 `-soft`/`-scrim`/`-hover` 后缀 → **那条断言的数组不需要扩**;
但**建议**新加一条同款断言把这 4 个钉住两档取值(与 `--danger-hover` 那条 `:392` 同款写法)。

**除这 4 个之外不许新造 token。** 本附录 §B.3 + §B.4 + §B.5 + §B.6 合起来覆盖**全部 60 处**,
**表里没有的一律 `NEEDS_CONTEXT`**(承 P5a T11 R9 教训:自行发明 `color-mix` 蒙版比例本该先问)。

### 已存在、直接用即可的 token(T0 已核两档都有值)

`--bg-elevated` · `--bg-sunken` · `--bg-chip` · `--line` · `--line-faint` · `--line-strong` ·
`--text-primary` · `--text-secondary` · `--text-tertiary` · `--text-quaternary` · `--text-on-accent` ·
`--accent` · `--accent-soft` · `--accent-softer` · `--success` · `--warning` · `--danger` ·
`--success-soft` · `--warning-soft` · `--danger-soft` · `--danger-soft-border` · `--danger-soft-faint`

结构量(两档共享,只在基础块声明,浅块不重复):`--font-mono` · `--r-pill` · `--r-xs/sm/md/lg/xl` · `--shadow-xs/sm`

## B.9 自检命令(scss 那一刀提交前照跑,输出完整落盘)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# ① parser-styles.scss 全文零色字面量(它没有 token 声明块,一处都不许有)
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|(^|[^-[:alnum:]])(white|black|red|green|blue)([^-[:alnum:]]|$)' \
  src/ai/styles/parser-styles.scss                                  # 期望:0 命中
# ② parser-styles.scss 零顶层裸选择器(第 0 列只许这三个)
grep -nE '^[^[:space:]/}]' src/ai/styles/parser-styles.scss          # 期望只有 .parser-app / .parser-app.parser-status-page / .parser-app.parser-test-page
# ③ knowledge.scss 规则段落零色字面量(两个 token 声明块之外)
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|(^|[^-[:alnum:]])(white|black|red|green|blue)([^-[:alnum:]]|$)' \
  src/ai/styles/knowledge.scss
#   期望:命中的行全部落在两个 token 声明块内部,以及既有 --shadow-*/--glass-*/--grad-* 声明行
# ④ 禁 theme-exception
grep -c 'theme-exception' src/ai/styles/parser-styles.scss src/ai/styles/knowledge.scss   # 期望 0 0
# ⑤ 单独编译
pnpm exec sass --no-source-map src/ai/styles/parser-styles.scss /dev/null; echo "exit=$?"
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss      /dev/null; echo "exit=$?"
# ⑥ 真进了构建管线(parser-styles.scss 是新文件,必须有生产 .vue import 它)
pnpm build && grep -o "parser-status-page" dist/assets/*.css | head
# ⑦ 死引用自查:不许残留 --ns-color-*
grep -c 'ns-color' src/ai/styles/parser-styles.scss                 # 期望 0
```
