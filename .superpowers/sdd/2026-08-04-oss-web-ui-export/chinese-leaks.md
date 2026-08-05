# 中文 AI/相册/搜索泄漏 —— T7-T14 交接清单

产出于 Task 6.5(2026-08-04 复审后更新一版)。数据来源:
`node oss/export.mjs --out /tmp/t65-tree --skip-guard --no-commit --allow-dirty-oss`
生成的产出树 + 更新后的 `oss/forbidden.mjs`(HARD:说话人/知识库/向量化/问 Nimo/**knowledge/RAG(复审新加)**;
SOFT+白名单:转录/照片/搜索(**白名单已按复审要求收紧为整行精确匹配,不再是关键词/键名子串**);
SOFT 哨兵:智能/语义搜索)跑 `scanTree()` 的**真实输出**,逐条人工核对了归属。命令:

```js
node -e "
import('./oss/forbidden.mjs').then(m => {
  const findings = m.scanTree('/tmp/t65-tree');
  const words = new Set(['相册','说话人','知识库','向量化','问 Nimo','转录','照片','搜索','智能','语义搜索']);
  findings.filter(f => words.has(f.word)).forEach(f => console.log(f.file+':'+f.line+' | '+f.word+' | '+f.excerpt));
});
"
```

产出树此刻是**中间状态**:T7-T13 要做的删除/改写都还没发生,所以下面很多命中是"预期中、
将被后续任务自然清掉"的,不是当前代码的新缺陷。**这份清单只负责分类,不负责修。**

---

## T7 —— 设置区(`src/settings/**`)· Service 侧 · 注释洗白 · `.gitignore`

| 文件:行 | 原文 | 为什么是泄漏 |
|---|---|---|
| `src/settings/panels/AppsPanel.vue:152` | `// 「清理本地待上传缓存」= 政策三「做样子」:界面 1:1、按钮禁用、标注待相册区迁移完成后启用。` | 提到"相册区"迁移计划,暴露私有仓的分期开发状态(相册功能存在过) |
| `src/settings/panels/AppsPanel.vue:153` | `//    数据源是**相册**的 IndexedDB 上传队列(Vue2 @/views/Photos/upload/idb.js),SP7 尚未迁。` | 同上,且点名 Vue2 `Photos` 目录 |

**Service 侧(`packages/service/`)**:全仓 grep 核实,搜索/照片/转录/说话人/知识库/向量化/智能/相册/问 Nimo
**零命中**。Service 层是纯 HTTP/认证内核,不含业务文案,符合预期,不需要 T7 额外处理。

**`.gitignore`**:导出树根 `.gitignore` 里的中文注释(`# Claude Code 本地状态`、`# 时间机器验收测试台(T12)`等)
不含本清单收录的任何候选词,**不是**这次的泄漏对象(它们泄的是"用 AI 编码工具协作开发"这件事本身,
不是 AI/相册/搜索功能),但既然 brief 把 `.gitignore` 划进 T7 范围,一并提醒:这些注释本身也该在
T7 洗白时一起处理(不属本清单的词表覆盖范围,靠人工读一遍)。

**AppsPanel.vue 里的「相册」已经被现有 HARD 词命中**(相册 从一开始就在词表里,不是 T6.5 新增覆盖的盲区),
列在这里只是为了完整交接,不代表 T6.5 新发现。

---

## T8 —— i18n 四个 locale 文件 · `src/styles/theme.css`

### `src/i18n/zh_cn.ts`(19 处)

| 行 | 原文 | 归类 |
|---|---|---|
| 37 | `audioTranscript: '转录文稿',` | 音频转录 UI 文案(待删,随 T10 拆面板一起删键) |
| 38 | `audioAsk: '问 Nimo',` | Ask Nimo 中文说法(待删) |
| 40 | `audioAskEmpty: '这段音频的转录已向量化 — 关于内容尽管问 Nimo。',` | 转录+向量化+问 Nimo 三重命中(待删) |
| 41 | `audioAskDemo: '(demo 占位) 转录已向量化。接入 AI 后端后，这里会根据音频内容作答，并附上可跳转的时间戳。',` | 同上(待删) |
| 222 | `appPhotos: '照片',` | 桌面 Photos 应用标签(T6 已删 systemApps.ts 里的应用项,这个键变成孤儿) |
| 235 | `widgetAiDesc: '对话与智能建议',` | AI 小组件描述(T6 已删 AiWidget 组件用量,键变孤儿) |
| 259 | `widgetAiPrompt1: '整理最近的照片',` | AI 小组件 demo 提示词(孤儿键) |
| 279 | `addPanelTabPhoto: '照片',` | AddPanel 照片 tab 标签(T11 删 tab 后应删键) |
| 285 | `addPanelNoPhotos: '暂无照片',` | 同上 |
| 341 | `topbarSearch: '搜索',` | 搜索胶囊按钮文案(T6 已删按钮 DOM,键变孤儿) |
| 342 | `topbarSearchKbd: '搜索 (⌘K)',` | 同上 |
| 349 | `// ── 主页:搜索面板 ──` | 分节注释,标记了一整段待删 i18n 键的范围 |
| 352 | `searchSearching: '搜索中…',` | SearchDialog 专用键(SearchDialog.vue 已删,孤儿) |
| 354 | `searchOpenAlbum: '打开相册 ›',` | 同上(相册,现有词已覆盖) |
| 355 | `searchAlbumMatches: '在 AI 相册找到 {count} 个匹配(图片 / 视频)',` | 同上 |
| 362 | `searchHint: '输入关键词并回车,搜索图片、文档、视频、音频与设置',` | 同上 |
| 663 | `// 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290...` | **已加白名单,不是泄漏** —— RAID 文案来源说明,列出仅为交接可见性 |
| 678 | `// read/write 为该表原始 1-5 评分(5、4),转录为评分文本。` | 同上,已白名单 |
| 682 | `// desc:raidUtils.js 源文件中 desc 字段本身即占位字符串...,逐字转录(非我方发明)` | 同上,已白名单 |

行 663/678/682 会出现在 `scanText` 结果里**当且仅当**你直接跑没有白名单的旧词表;
用 T6.5 之后的 `oss/forbidden.mjs` 跑,这三行**不会**出现在 findings 里(已验证,见报告"误报处理记录")。
列在这里只是让 T8 的人知道:这三行提到"转录"是安全的,**不要**因为看到 grep 命中就手滑删掉这三条
RAID 说明注释。

### `src/i18n/zh_cn.sp9.ts`(8 处,全部是 folder-permissions 四分区的孤儿键;
`FolderPermissionsPanel.vue` 已在 DELETE 表整体删除,但这些键目前没人清)

| 行 | 原文 |
|---|---|
| 184 | `settingsAppsPendingDisabledHint: '待相册区迁移完成后启用',` |
| 246 | `settingsFpIntro: '在下方各分区分别管理每个智能功能的文件夹。',` |
| 247 | `settingsFpDataPending: '数据源待相册区(SP7)与 AI 区(SP8)合并后接入。',` |
| 250 | `settingsFpFilenameDesc: '纳入文件名搜索索引的文件夹。',` |
| 252 | `settingsFpKnowledge: '知识库',` |
| 253 | `settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',` |
| 262 | `settingsFpPhotos: '照片',` |
| 264 | `settingsFpPhotosDesc: '照片库监视的文件夹。',` |

### ⚠️ 中英成对删除清单(复审 Important③ 补全,2026-08-04)

上面两张表只列了中文侧命中,但 `parity.test.ts` 要求 `zh_cn`/`en_us`(含 `.sp9`)两侧键完全一致 ——
**删中文键必须连英文配对键一起删,否则会被 parity 测试挡住,或者更糟:英文键单独存活成新泄漏**。
下表覆盖上面两张表里**全部 23 个键**,逐条给出英文侧原文 + 英文侧当前是否被独立命中(不依赖中文
那一半)。这是本清单里唯一需要靠人工读一遍所有 23 行的地方——`grep` 只能告诉你中文侧命中了什么,
告诉不了你删完中文键之后英文键会不会裸奔。

| 键 | 中文值(节选) | 英文值(逐字) | 英文侧独立命中? |
|---|---|---|---|
| `audioTranscript` | 转录文稿 | `Transcript` | ✅ `transcript`(HARD) |
| `audioAsk` | 问 Nimo | `Ask Nimo` | ✅ `ask nimo`(HARD) |
| `audioAskEmpty` | 转录已向量化…问 Nimo | `This transcript is vectorized — ask Nimo…` | ✅ `transcript` + `ask nimo` |
| `audioAskDemo` | 转录已向量化。接入 AI 后端… | `…transcript is vectorized. Once the AI backend…` | ✅ `transcript` + `ai` |
| `appPhotos` | 照片 | `Photos` | ✅ `photo`(SOFT,该文件无白名单) |
| `widgetAiDesc` | 对话与智能建议 | `Chat and smart suggestions` | ✅ 但**不是靠值**——是键名 `widgetAiDesc` 本身命中 `ai`(alt2:前面挨小写 t、后面挨大写 D)。值里的 `smart` 本身**不会**被任何词命中(见下方"smart 不收"专节)——如果这个键将来改名(丢掉 `Ai`),值本身会裸奔 |
| `widgetAiPrompt1` | 整理最近的照片 | `Organize recent photos` | ✅ `photo` |
| `addPanelTabPhoto` | 照片 | `Photos` | ✅ `photo` |
| `addPanelNoPhotos` | 暂无照片 | `No photos` | ✅ `photo` |
| `topbarSearch` | 搜索 | `Search` | ✅ `search`(SOFT,该文件在此行无白名单) |
| `topbarSearchKbd` | 搜索 (⌘K) | `Search (⌘K)` | ✅ `search` |
| `searchSearching` | 搜索中… | `Searching…` | ✅ `search`(键名也命中) |
| `searchOpenAlbum` | 打开相册 › | `Open Album ›` | ✅ 键名 `searchOpenAlbum` 命中 `search`(值本身 `Open Album` 不含任何候选词——如果键改名会裸奔) |
| `searchAlbumMatches` | 在 AI 相册找到…(图片/视频) | `Found {count} matches in AI Album…` | ✅ `ai` + 键名 `search` |
| `searchHint` | 搜索图片、文档… | `…to search images, documents…` | ✅ `search` |
| `settingsAppsPendingDisabledHint` | 待相册区迁移完成后启用 | `Available after the Photos section is migrated` | ✅ `photo` |
| **`settingsFpIntro`** | 在下方各分区分别管理每个**智能**功能的文件夹。 | `Manage each **smart** feature's folders in its own section below.` | ❌ **零命中,真正的盲区**——键名不含 `ai`,值里只有 `smart`(明确不收,见下方专节)。**T8 删这个键时,英文侧不会有任何警报提醒你——必须手动确认删了** |
| `settingsFpDataPending` | 待相册区(SP7)与 AI 区(SP8)合并… | `…after the Photos (SP7) and AI (SP8) areas are merged.` | ✅ `photo` + `ai` |
| `settingsFpFilenameDesc` | 纳入文件名**搜索**索引的文件夹。 | `Folders scanned into the filename search index.` | ✅ `search` |
| `settingsFpKnowledge` | 知识库 | `Knowledge base` | ✅ `knowledge`(**本轮复审新加的 HARD 词**,此前零命中) |
| `settingsFpKnowledgeDesc` | 纳入知识库(RAG)索引的文件夹。 | `Folders indexed into the knowledge base (RAG).` | ✅ `knowledge` + `RAG`(**本轮复审新加**,此前零命中) |
| `settingsFpPhotos` | 照片 | `Photos` | ✅ `photo` |
| `settingsFpPhotosDesc` | 照片库监视的文件夹。 | `Folders watched for the photo library.` | ✅ `photo` |

**结论**:23 个键里,**只有 `settingsFpIntro` 一个是英文侧真正的盲区**(键名和值都不含任何候选词,
`smart` 按纪律不收——见下)。其余 22 个键即使 T8 只顾着删中文侧、漏删英文侧,守卫也会在下一次扫描时
通过英文侧独立报警(`widgetAiDesc`/`searchOpenAlbum` 这两个是"靠键名侥幸命中",键名一旦被顺手改掉
就会裸奔,T8 执行时注意)。**`settingsFpIntro` 这一条请 T8 手动确认中英文键都被删了,不要依赖守卫**。

`knowledge`/`RAG` 已在本轮复审追加为 HARD 词(见 `oss/forbidden.mjs` 顶部 T6.5 复审 Important③
注释块)。`smart` 明确不收——全仓 12 处命中里 10 处是硬盘 SMART 健康检测(`src/storage/**`),
收了会制造巨量误报;详见 `oss/forbidden.mjs` 里紧跟 `RAG` 那条的大段注释与
`oss/forbidden.test.mjs` 的"英文侧补词"describe 块。

### `src/styles/theme.css`(6 处)

| 行 | 原文 | 备注 |
|---|---|---|
| 1 | `/* 全局滚动条：...（复用于搜索、文件预览、Welcome 等一切滚动区）。` | 提到"搜索"(SearchDialog 的滚动区),SearchDialog 已删,注释要改措辞 |
| 69 | `/* 说话人配色(音频转录/波形,最多 5 色循环;dark 用亮版;避开金色以免与星标混淆) */` | `--spk-*` token 组的注释,token 本身也要删(见下) |
| 288 | `/* 说话人配色(白色纸感用暗版,同 hue 系) */` | 同上,light 主题块 |
| 455 | `/* ---- P4c: 应用 / 文件夹 / 照片 磁贴结构 ---- */` | `.kind-photo`/`.photo-thumb` 分节标题,PhotoTile 已删、`Kind` 已去掉 `'photo'`,这段 CSS 是死代码 |
| 472 | `/* 照片磁贴 */` | 同上 |

⚠️ **顺带发现(不在候选词表内,记录给 T8)**:`theme.css:51/270` 的注释
`/* 扩展/语义 token(SearchDialog·MediaViewer 提升为全局;...） */` 提到了已删的 `SearchDialog`
组件名。这是**现有英文 `search` 软禁词**命中的(不是本任务新加的词),T6.5 验证时顺手发现,记录以免
T8 只看中文清单而漏掉。`--wave-none`/`--wave-dim` 等 token 家族与说话人着色共用(见
`docs/superpowers/plans/2026-08-04-oss-web-ui-export.md` E11 的提醒,该文档随 `docs/` 整体删除但
提醒本身仍适用):删 `--spk-*` 时**不能**把保留下来的真实波形弄没颜色。

---

## T9 —— `src/home/grid/defaultLayout.ts`

**中文候选词零命中。** 该文件用的是英文 `kind: 'photo'` 字面量与 `key: 'ai'/'photos'`,已经在
现有词表的英文 `photo`/`ai` 规则覆盖范围内(未加白名单,已经会正确报警),不需要新的中文词条。
列出是为了明确交接:T9 不需要等 T6.5 的中文词条,现有守卫已经能看见它。

---

## T10 —— `src/files/viewers/MediaViewer.vue`

**48 处命中,是本清单里最集中的一个文件**,横跨说话人(24)/转录(19)/智能(6)/向量化(2)/搜索(1)。
逐行明细(全部待随"拆转录面板"整块删除,不需要逐条列出修法,给出行号范围即可):

- 23、80(×2)、88、98-100、181、189、201、210(×3)、211、217、223、234、254(×2)、
  267、282(×2)、294(×2)、524(×2)、531、557、577、582、598(×2)、636-637、
  710(×2)、711、718、723、747(×3)、755、758、764、771、783、796

这些行落在 T10 plan 里明确要整块删除的 `// ── 转录面板` 注释段(第 210-373 行起)与相关
template/style 块内,**不需要单独处理**——T10 的类 2 替换本来就要把这一整段拆掉。列出行号只是
证明:新词表能在 T10 动手之前就把这整块的边界照出来,方便核对"删干净了没有"(T10 完工后重新跑
一遍 `scanTree`,这 48 条应该清零)。

line 758(`搜索`)note:「沿用搜索框强调色」这句提到的"搜索框"就是被删的 SearchDialog 输入框,
拆转录面板时这句注释的措辞也要跟着改,不能留着指向一个已经不存在的组件。

---

## T11 —— `src/home/components/AddPanel.vue`

**中文候选词零命中。** 该文件用英文 `kind === 'photo'`、`usePhotosStore` 等符号,已被现有英文
`photo` 软禁词覆盖(当前无白名单,会正确报警)。T11 删照片 tab 时不需要额外中文词条支持;删完后
记得同步删 `src/i18n/zh_cn.ts:279`(`addPanelTabPhoto`)、`:285`(`addPanelNoPhotos`)两个孤儿键
(已列入上面 T8 清单,两个任务会碰到同一批键,谁先做都行,做完在 PR 里提一句避免另一个任务重复劳动)。

---

## T13 —— 所有 `*.test.ts`

以下测试文件当前**仍在导出树里**(对应的被测组件/模块已经被 DELETE 表删除,这些是孤儿测试,
manifest.mjs 注释里说的"测试同步:整体删除的 9 个"应该就是指这批 + 下面"已解决"里提到的
folder-permissions 四个 util 测试):

| 文件 | 命中数 | 被测对象状态 |
|---|---|---|
| `src/files/viewers/speakerWave.test.ts` | 7(说话人) | `speakerWave.ts` 已在 DELETE 表删除 —— 孤儿测试,整份删掉 |
| `src/home/components/SearchDialog.test.ts` | 1(相册,line 65) | `SearchDialog.vue` 已在 DELETE 表删除 —— 孤儿测试,整份删掉 |
| `src/home/components/widgets/AiWidget.test.ts` | 2(照片) | `AiWidget.vue` 已在 DELETE 表删除 —— 孤儿测试,整份删掉 |
| `src/home/util/eventMap.test.ts` | 1(相册,line 5) | 已核实 `eventMap.ts` 只被 `src/home/stores/events.ts` 消费(`grep -rln eventMap src --include='*.ts' --include='*.vue'`),是 LocalStorage 磁盘增删 / AppManagement 安装事件的通用标题映射工具,与 AI/相册无关,**不删**。这条测试只是拿 `i18nName()` 做 JSON 取字段的单测,样本值恰好写成 `'{"zh_cn":"相册"}'`;**只需把样本字符串换成任意非候选词的中文**(如 `"文档"`),不要删整份测试 |
| `src/settings/panels/AppsPanel.test.ts` | 2(相册,line 114/119) | `AppsPanel.vue` **本身不删**,是真实设置面板;这两条测试断言的是"清理本地待上传缓存"按钮的禁用态标注文案,文案改了(T7 洗白 AppsPanel.vue 的"相册"措辞后)测试断言要跟着改,不是整份删 |
| `src/settings/panels/FolderPermissionsPanel.test.ts` | 1(照片,line 101) | `FolderPermissionsPanel.vue` 已在 DELETE 表删除 —— 孤儿测试,整份删掉 |

**以下三个同类孤儿测试不含中文候选词,但复审后追加的英文 `knowledge` HARD 词已经把它们也照出来了**
(2026-08-04 更新:最初报告说这三个文件"零命中,靠 ai/search/gallery 覆盖",这个说法本身不够精确——
`grep` 复核后发现真正让它们独立报警的是里面大量的 `knowledge` 字面量,`knowledge` 当时还没进词表;
现在已经加了,补上实测命中数):

| 文件 | 命中数 | 被测对象状态 |
|---|---|---|
| `src/settings/util/folderPermissions.test.ts` | 15(knowledge) | `folderPermissions.ts` 已在 DELETE 表删除 —— 孤儿测试,整份删掉 |
| `src/settings/util/folderPermissionsSnapshot.test.ts` | 1(knowledge) | `folderPermissionsSnapshot.ts` 已在 DELETE 表删除 —— 孤儿测试,整份删掉 |
| `src/settings/util/folderPermissionsView.test.ts` | 1(knowledge) | `folderPermissionsView.ts` 已在 DELETE 表删除 —— 孤儿测试,整份删掉 |

这三个文件逻辑上必须和对应 `.ts` 一起删(否则测试会因为 import 找不到文件而炸),现在守卫也能
独立照出它们,双重保险。

上表 6 个文件里,`SearchDialog.test.ts`(相册)、`eventMap.test.ts`(相册)、`AppsPanel.test.ts`(相册)
命中的都是**原有** HARD 词「相册」,本来就会报警,不是 T6.5 新增能力;`speakerWave.test.ts`(说话人)、
`AiWidget.test.ts`(照片)、`FolderPermissionsPanel.test.ts`(照片)这 3 个是本次新词条第一次照出来的
——之前守卫对这三份孤儿测试是完全瞎的。

---

## 已解决 —— 已被 DELETE 表整体删除的文件里的命中(随文件删除,不需要额外动作)

这些文件在私有仓里当前还有内容(用于登记完整性),但已经在 `oss/manifest.mjs` 的 `DELETE`
数组里,`oss/export.mjs` 跑起来就会把整个文件抹掉,产出树里已经看不到——**不需要任何任务再处理**。

| 文件 | 命中数(私有仓 grep) | 抽样 |
|---|---|---|
| `src/home/components/SearchDialog.vue` | 29 | line 13 `// 弹窗内的统一搜索：⌘K 打开这个玻璃命令面板…`;line 19 `// Ask Nimo AI 入口在搜索输入框右侧…`;line 540 `/* 相册卡 */` |
| `src/files/viewers/audioTranscripts.ts` | 10 | line 1 `// 音频转录 / 摘要数据。`;line 8 `// 接入真实后端（NimoOS-AI + STT/分段/向量化）后…`;line 20 `/** 智能章节：把转录按主题切段… */` |
| `src/files/viewers/speakerWave.ts` | 8 | line 1 `// 音频波形 × 说话人:纯函数…`;line 64 `* MediaViewer 的转录行过滤与波形 .dim 判断共用同一 picked 集合…` |
| `src/settings/panels/FolderPermissionsPanel.vue` | 3 | line 5 `// Vue2 实际是**四个纵向堆叠的分区**(文件名索引 / 知识库 / 禁止 AI 访问的文件夹 / 照片)`;line 109 `<!-- ② 知识库 (Vue2 L38-81) -->`;line 167 `<!-- ④ 照片 (Vue2 L117-155) -->` |
| `src/home/stores/photos.ts` | 0 | 无候选词,但文件本身是相册 store,DELETE 表已覆盖 |
| `src/home/components/PhotoTile.vue` | 0 | 同上 |
| `src/home/components/widgets/AiWidget.vue` | 0 | 同上(有趣:组件本体没有中文候选词命中,是它的 `.test.ts` 有 —— 见上面 T13) |

---

## T14 —— 需要加白名单的误报 · 零散项

**本任务已经把发现的全部误报处理完了(3 个 SOFT 词 + 精确白名单),T14 在"中文误报"这个维度上
目前是 0 待办。** 已处理的白名单明细见 `task-6.5-report.md` 的"最终词表与取舍理由"一节,这里不重复。

零散项(不属于上面任何一档,但顺手记录):

1. `智能` 目前是 SOFT + 空白名单(哨兵)。当前全仓命中(见 T8/T10 两节)全部是真泄漏,没有白名单条目。
   如果 T7-T13 执行过程中发现某处"智能"是合法非 AI 用法(例如未来磁盘/网络功能提到"智能识别"),
   直接加白名单即可,**不要**因为这类新增而回来找 T6.5 或放宽词表。
2. `语义搜索` 是 SOFT + 空白名单(防御性哨兵),当前全仓 0 命中。sp7-photos/sp8-ai 合并后如果
   引入这个词组,应该会被直接拦住;如果发现拦不住(比如实际写法是"语义化搜索"或英文
   "semantic search"),需要新增词条,那是 T14(或合并后的新任务)的活,不是这次遗漏。
3. `oss/forbidden.mjs` 里 `folderPermission`(软禁词)的白名单用了 `{ file: /.*/, re: /UserFolderPermission/ }`
   全文件通配——这是 T3 时期的既有设计(不是本任务改的),本任务没有触碰。
