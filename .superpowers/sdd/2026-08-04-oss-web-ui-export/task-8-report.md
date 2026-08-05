# Task 8 报告 —— i18n 四个 locale + theme.css

## 做了什么

只改了 `oss/manifest.mjs`(追加 20 条 PATCH)与 `oss/tree.test.mjs`(追加 1 个 describe、5 个 it)。
未碰 `src/**` 任何产品代码——按机制设计,剥离全部发生在 `oss/export.mjs` 跑的时候。

- `src/i18n/zh_cn.ts` / `en_us.ts`:各 8 条锚点补丁,成对删除 44 个键。
- `src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts`:各 2 条锚点补丁,成对删除 26 个键
  (`settingsTabFolderPermissions` + folder-permissions 四分区 25 个 `settingsFp*` 键)。
- `src/styles/theme.css`:17 条锚点补丁——1 条改分节标题文字、6 条整段删除(spk×2、wave-dim×2、
  orb×2)、1 条删 `@keyframes pulse`、1 条删"照片磁贴"标题+`.kind-photo`+`.photo-thumb`、
  3 条删单行 `.ic-photos`/`.ic-ai`/`.ic-search`、1 条删 `.photo-thumb.has-img` 两行、
  4 条把 `.kind-photo` 从共享选择器列表里摘掉(不能整段删,因为同一条规则还服务 app/folder)。
- `src/styles/theme.sp9.css`:核查后确认零改动(见下)。

## 重数后的实际键数(与 brief/交接清单不一致,已按实测为准)

用 `oss/manifest.mjs` 里 T7 之前的私有仓源码逐一 grep + 消费方核实(见下),结果:

| 文件 | brief/清单原文数字 | 实测数字 | 差异原因 |
|---|---|---|---|
| `zh_cn.ts`/`en_us.ts` 主分片 | 33(brief 原文)→ 44(brief 更正后) | **44** | 与更正后的数字一致(11 个 audio 转录键是 brief 最初漏登记的) |
| `zh_cn.sp9.ts`/`en_us.sp9.ts` | 8(chinese-leaks.md)/ 10(brief) | **26** | `FolderPermissionsPanel.vue` 与 `folderPerm/` 已在 DELETE 表整体删除,导致该面板用到的**全部** 26 个 `settingsFp*`/`settingsTabFolderPermissions` 键都变成零消费方孤儿——chinese-leaks.md 的 8 条、brief 的 10 条都只是"命中中文候选词的样本",不是"面板用到的全部键"。用 `grep -rn "settingsFp\|settingsTabFolderPermissions" src --include='*.vue' --include='*.ts' \| grep -v "src/i18n/"` 核实:唯一消费方是 `FolderPermissionsPanel.vue`(DELETE)、`FolderPermissionsPanel.test.ts`(T13 的孤儿测试)、`folderPerm/FolderPickerDialog.{vue,test.ts}`(在 DELETE 表的 `src/settings/panels/folderPerm` 整目录内)——**没有任何存活组件引用这批键**,全部清除是合理且必要的(否则会在导出包里留下大段"知识库/RAG/AI agent/禁止 AI 访问"字样,比清单点名的还严重)。 |

**总计 140 个键位删除(main 44×2 + sp9 26×2)**,不是 brief 字面的 33×2 或 44+10×2=64。

## 每条锚点命中次数(私有侧源码,程序化验证,非目测)

用脚本对 `oss/manifest.mjs` 里本任务新增的全部 37 条 PATCH(20 条 i18n + 17 条 theme.css)逐条跑
`sourceText.split(find).length - 1`,全部**恰好命中 1 次**:

```
checked: 37 bad: 0
```

(theme.css 的 4 条"从共享选择器列表摘掉 kind-photo"补丁不是单纯删除,是 find→replace 的合并编辑,
同样验证了命中 1 次。)

## 产出树上两个 locale 的键集比对(最关键的自查)

```bash
node oss/export.mjs --out /tmp/t8-tree --skip-guard --no-commit --allow-dirty-oss
```

对产出树跑一次性脚本提取键名做集合比较:

```
main zh keys: 713   main en keys: 713
sp9  zh keys: 413   sp9  en keys: 413
main zh-en diff: []   main en-zh diff: []
sp9  zh-en diff: []   sp9  en-zh diff: []
main dup zh: false    main dup en: false
sp9  dup zh: false    sp9  dup en: false
```

私有侧原始键数 757(main)/439(sp9),产出树 713/413,差值 44/26 与上表完全吻合;**两侧键集合完全
相等,无遗漏、无多余、无重复**——这是产出树上的真实 parity,不是私有侧 `parity.test.ts` 的空转。

## `--wave-none` 恰好 2 次的证据

```
$ grep -c -- "--wave-none" src/styles/theme.css   # 在 /tmp/t8-tree 内
2
```

同时对全部 10 个应删 token/类逐一 grep 验证均为 0:
`--spk-`=0、`--wave-dim`=0、`--orb-core`=0、`--orb-glow`=0、`@keyframes pulse`=0、
`.ic-photos`=0、`.ic-ai`=0、`.ic-search`=0、`.photo-thumb`=0、`.kind-photo`=0。

## `theme.sp9.css` 核查结论

```bash
grep -n -i "spk\|wave-\|orb-\|photo\|\bai\b\|search\|knowledge\|transcript\|speaker\|说话人\|转录\|相册\|智能\|照片\|搜索\|知识库" src/styles/theme.sp9.css
# (无输出)
```

通读全文(169 行)确认内容全部是 P3 设置侧 rail token 与 P5/P6 KVM 固定深色控制台 token,与
AI/相册/搜索/说话人/转录无关。**结论:干净,本任务未改动该文件**,且已加入 `tree.test.mjs` 的
回归断言(防止未来有人往这里加东西却没被扫到)。产出树 diff 也确认该文件在导出前后逐字节相同。

## 23 键对照表的逐键落实情况

交接清单 `chinese-leaks.md` 的 23 键成对删除表(main 15 + sp9 8)全部落实,是本次 44+26 键的子集。
逐键在 PATCH 里能找到对应锚点(main 15 个在 zh_cn.ts/en_us.ts 的 8 条锚点内、sp9 8 个在
zh_cn.sp9.ts/en_us.sp9.ts 的 2 条锚点内),已用上面的"产出树 diff=0"验证全部消失。

**`settingsFpIntro`(唯一真盲区)**:单独核实——

```bash
grep -rn "smart feature" src/i18n/    # 产出树 /tmp/t8-tree,应为空
grep -rn "settingsFpIntro" src/i18n/  # 产出树,应为空
```

两条命令均无输出(见上方"额外自查"章节的实际运行结果)。这个键的英文值 `Manage each smart
feature's folders in its own section below.` 是唯一一处守卫看不见、必须靠人工核对的删除项——
已确认随 `folder-permissions 块` 的整体删除锚点一起清除,产出树里彻底没有这句话。

其余 22 个键(不同程度靠键名或值命中的样本)全部在产出树 grep 检查中确认清零(见上方
"key orphan sample checks" 输出:`settingsFp\|settingsTabFolderPermissions\|widgetAi\|
appPhotos\|appAi:\|topbarSearch\|searchOpenAlbum\|audioTranscript` → no hits)。

## 保留面验证

```
audioSkipBack / audioSkipForward / audioSpeed / appsStoreSearch
```

四个键在产出树 `zh_cn.ts`/`en_us.ts` 里均存在,值未变(播放器控件与应用商店搜索框是保留功能,
不属剥离范围)。

## 测试输出

```
$ pnpm exec vitest run oss/tree.test.mjs src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  37 passed (37)
```

`oss/tree.test.mjs`:27(既有)+ 5(本任务新增 describe 的 5 个 it)= 32 例全绿。
`src/i18n/parity.test.ts`(私有侧):5 例全绿——如交接材料所说,这个恒绿证明不了产出树的 parity,
真正的证据是上面"产出树上两个 locale 的键集比对"一节。

## 自查结论

1. i18n:main 44 键 + sp9 26 键,共 140 处删除,私有侧锚点全部命中 1 次,产出树两侧键集合完全
   相等(diff=[]),盲区键 `settingsFpIntro` 单独核实清除。
2. theme.css:17 条锚点,10 个应删 token/类全部归零,`--wave-none` 精确保留 2 处(两套主题块各 1)。
   4 处"合并选择器"编辑未破坏 CSS 结构(抽查了合并后的规则块,语法完整、其余 app/folder 选择器
   未受影响)。
3. `theme.sp9.css`:grep + 通读双重核实无关内容,产出树逐字节未变,已补测试防回归。
4. 未做后续任务的活:没碰 `AddPanel.vue`(T11)、没碰 `MediaViewer.vue`(T10)、没碰任何 `*.test.ts`
   的孤儿测试删除(T13)、没碰 `oss/forbidden.mjs` 白名单(T14)。

## 遗留疑问 / 交给后续任务的提醒

1. **交接清单的 sp9 键数(8/10)与实测(26)有较大出入**,已在上表写明原因并核实。如果 T13/T14
   核对台账数字时看到"26"而不是"10",不是笔误,是本任务重新核验后的更正值。
2. `addPanelTabPhoto`/`addPanelNoPhotos` 这两个键虽然已经从 i18n 删除,但**私有仓当前的
   `AddPanel.vue` 还在用它们的兄弟逻辑(`kind === 'photo'` 判断、tab 列表)**——这是 T11 的范围。
   T11 执行时不需要再管 i18n(已经在这里清掉了),但要注意如果 T11 的 REPLACE 全文件版本里还残留
   对 `t('addPanelTabPhoto')`/`t('addPanelNoPhotos')` 的调用,产出树运行时会拿到 `vue-i18n` 的缺
   键告警(不是构建错误,是运行时 warning)——T11 的替换文件本身就该去掉这两个 tab,交接一致。
3. 本任务过程中没有发现交接清单之外的新增 i18n/主题残留(`theme.sp9.css` 核查、`.ic-*` 序列完整性、
   合并选择器后的 CSS 结构,均已逐项验证)。

---

## 复审 Important 修复(第二轮)

### 问题

`settingsAppsPendingDisabledHint` 是**活键**——消费方 `src/settings/panels/AppsPanel.vue:195`
(`{{ t('settingsAppsPendingDisabledHint') }}`),`AppsPanel.vue` 是保留组件,所以第一轮判断"不是
孤儿、不删"是对的(复审也确认了这一点)。但漏看了它的**值**:中文 `'待相册区迁移完成后启用'`、
英文 `'Available after the Photos section is migrated'`——这段文案会**直接显示给最终用户**,
向开源版用户暗示存在一个本版本里不存在的"相册区"功能与迁移计划。这与 T7 已经洗白的紧邻两句
开发注释(`AppsPanel.vue:152-153`)性质相同,但那两句是给开发者看的注释、这条才是给用户看的界面
文案,反而更该改却被漏掉。

### 修法:改值不删键

新增 2 条 PATCH(`oss/manifest.mjs`,插在 sp9 两个文件的补丁块与 theme.css 补丁块之间):

```
src/i18n/zh_cn.sp9.ts: '待相册区迁移完成后启用'                              → '该功能所需的后端能力尚未提供'
src/i18n/en_us.sp9.ts: 'Available after the Photos section is migrated'   → 'Requires backend support that is not available yet'
```

顺带删掉了中文那行末尾暴露分期开发状态的注释 `// 🆕(本期新增标注,做样子)`(注释本身在生产构建里
会被压缩器剥掉、不会寄到用户手上,但既然改这一行,顺手清掉更干净)。

**新锚点命中次数**(私有侧源码,程序化验证):

```
zh find occurrences: 1
en find occurrences: 1
```

**改后的中英值**(逐字):

- 中文:`该功能所需的后端能力尚未提供`
- 英文:`Requires backend support that is not available yet`

语义一致性:两句都只说"这个功能依赖的后端能力还没就绪",不提功能区名字、不提迁移计划、不提任何
版本差异。用项目真正的 `oss/forbidden.mjs` scanner(而非自造的粗糙子串匹配)核实两条新值均为
**0 命中**(`m.scanText(path, value)` → `[]`)——最早用 `.includes('AI')` 做的土办法把
`available` 里的 "ai" 子串误判成命中,换用真实 scanner 后确认是假警报。

`oss/tree.test.mjs` 补了一个新 it(`'复审 Important:settingsAppsPendingDisabledHint 是活键…'`):
断言键仍然存在(防止未来有人把它误判成孤儿删掉,那会是 Critical)、且值不再匹配 `/相册/` 或
`/Photos/`、且不再匹配 `/(本期|做样子)/`。

### 「活键的值含痕迹」全量自查(不只靠守卫命中)

复审明确要求"这次不要只靠守卫命中来判断"——守卫对英文 `smart`、对"本期""做样子"这类措辞是不收的。
因此按两层分别核查:

**第一层:项目真实 `oss/forbidden.mjs` scanner**(而不是自造词表),扫产出树四个 locale 文件全文
(含注释,基线对照):

```bash
node -e "
import('./oss/forbidden.mjs').then(m => {
  const fs = require('fs');
  for (const f of ['src/i18n/zh_cn.ts','src/i18n/en_us.ts','src/i18n/zh_cn.sp9.ts','src/i18n/en_us.sp9.ts']) {
    const t = fs.readFileSync('/tmp/t8-tree2/'+f, 'utf8');
    console.log(f, m.scanText(f, t).length, '命中');
  }
});
"
```

结果:

```
src/i18n/zh_cn.ts     0 命中
src/i18n/en_us.ts     1 命中 —— raidLevel1Usecase: 'Photo library, personal NAS, boot volumes'(见下方说明)
src/i18n/zh_cn.sp9.ts 1 命中 —— 文件头注释 "// SP9(收尾视图:… Search)文案分片。"(见下方说明)
src/i18n/en_us.sp9.ts 1 命中 —— 文件头注释 "// SP9 (final views: … Search) locale shard."(同上)
```

**第二层(复审点名要做的"不靠守卫"自查)**:自己写脚本,只提取**保留键的值**(排除注释,排除已被
本任务/前序任务删除的键),对值做正则扫描,覆盖复审给的全部候选:`相册`/`知识库`/`转录`/`智能`/
`\bAI\b`/`Album`/`knowledge base`/`transcript`/`本期`/`做样子`/`迁移…(完成|计划)后?(启用|接入)`/
`migrat\w* (after|once|when)`/`\bSP\d\b`/`Vue2`。对产出树(`/tmp/t8-tree2`,含本次修复)跑:

```
src/i18n/zh_cn.ts: 0 hits
src/i18n/en_us.ts: 0 hits
src/i18n/zh_cn.sp9.ts: 0 hits
src/i18n/en_us.sp9.ts: 0 hits
TOTAL VALUE HITS: 0
```

（脚本先做了自检:抽取到的"键:值"行数 zh_cn.ts 713/713、sp9 两侧 413/413 与已知键总数吻合,
确认regex 没有静默漏配;漏配的 3 行手工核对——`filesViewerDontSave`/`snapUnsupported` 是双引号
包裹的值、`filesUploadOversize` 是键值分两行写——内容分别是"Don't save"/卷不支持快照/大文件上传
提示,均与本次候选词无关。）

**结论:没有发现第二条"活键值含痕迹"——`settingsAppsPendingDisabledHint` 是这一类里唯一一条。**

### 第一层扫出的 2 处,判断为不在本任务范围(未修改,原样报告)

1. **`raidLevel1Usecase`(en_us.ts)`'Photo library, personal NAS, boot volumes'`**——这是 RAID 1
   用途场景说明,与被剥离的 Photos/相册 app **无关**(中文侧 `'照片库、个人 NAS、启动卷'` 已经在
   `oss/forbidden.mjs` 里用 `exactLine()` 精确白名单豁免,见文件里紧邻 `照片` 词条的注释)。
   **英文侧缺一条对应的白名单条目**,导致 `photo` 软禁词在 en_us.ts 上仍会报警——这是
   `oss/forbidden.mjs` 本身的一个遗留缺口,不是 i18n 内容问题(内容本身合法、该保留)。
   本任务铁律"绝不改 `oss/forbidden.mjs`",所以**未动它**,原样报告给 T14(交接清单"需要加白名单
   的误报"一节)补一条英文侧 `exactLine` 白名单。
2. **两个 sp9 文件的文件头注释**提到 "SP9" 与 "Search"(`// SP9(收尾视图:系统设置 / KVM /
   Search)文案分片。`)——这是**开发注释**,不是 i18n 键的值,生产构建(`vite build` 的压缩步骤)
   会把注释整体剥掉,不会出现在最终发给用户的 JS 产物里,性质与"值会直接显示给用户"完全不同。
   同时这类"提到 Search"的注释在项目里描述的是 SP9 路线图里**尚未开工**的 P7 Search 设置页(与
   已删除的首页搜索弹窗 `SearchDialog.vue` 是两回事),且 chinese-leaks.md 的 T7(注释洗白)/T8
   两节都没有点名这两行。为避免越权动 T7 范围之外的注释洗白,**本任务未修改**,只如实记录在这里,
   供后续统一决定是否需要在 T7/T14 补一刀"扫描全仓开发注释里的私有 sprint 代号"。

## 测试(第二轮,追加断言后)

```
$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  33 passed (33)

$ pnpm exec vitest run oss/tree.test.mjs src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  38 passed (38)
```

32(第一轮)→ 33(新增 1 例)全绿,私有侧 `parity.test.ts` 5 例保持绿。

---

## 复审第二轮修复:sp9 头注释(SP9/Search/sp7-sp8/spec §)

### 自我更正

第一轮报告里我写"生产构建会被压缩器剥掉、不会寄给用户",用这个理由把 sp9 两个文件的头注释移交
出去、没有修改。**这个判断是错的**——本项目 `oss/export.mjs` 导出的是**源码树本身**,发布物就是
`.ts` 源文件原样进公开仓库,中间**没有 vite 压缩这一步**。所以那两行注释会逐字出现在公开仓库里,
任何人 `git clone` 后打开文件就能看到。而且第 1 行本来就被 `oss/forbidden.mjs` 的真实 scanner
判了真实命中(不是靠白名单放行的误报)——按项目自己的检测口径,这行注释从一开始就被当作"会被
扫描、需要过 guard 的可发布内容"对待,我的豁免理由被项目自己的工具证伪了。以后不再用"注释会被
构建剥掉"当理由跳过任何 `oss/export.mjs` 会原样导出的文件。

### 改了什么

两个 sp9 locale 文件的**头注释**(`export default {` 之前的部分),原文(私有侧,`sed -n` 现场抓取):

```
src/i18n/zh_cn.sp9.ts:1-2
// SP9(收尾视图:系统设置 / KVM / Search)文案分片。
// 与 sp7/sp8 并行开发,分片可让三线几乎不在 i18n 上相撞(spec §4.2 / §9.3)。

src/i18n/en_us.sp9.ts:1
// SP9 (final views: Settings / KVM / Search) locale shard. See zh_cn.sp9.ts.
```

改后(逐字):

```
src/i18n/zh_cn.sp9.ts:1-2
// 设置 / KVM 等页面的文案分片。
// 拆成独立文件是为了减少多人协作时的 i18n 合并冲突。

src/i18n/en_us.sp9.ts:1
// Settings / KVM locale shard. See zh_cn.sp9.ts.
```

第 3 行(`// 约定:扁平 key、值必须是字符串(parity.test.ts 断言 typeof v === 'string')。`)原样保留
——`parity.test.ts` 是仓内正常引用,不构成泄漏。

**新锚点命中次数**(私有侧源码,程序化验证):

```
zh occurrences: 1
en occurrences: 1
```

### 守卫对改后内容的扫描结果

用真实 `oss/forbidden.mjs`(不是自造词表)先对原文做了健全性检查(确认它本来就会报警),
再对改后文本单独扫描:

```
zh ORIG scan (sanity, should have hits): [{"word":"search","line":1,"excerpt":"// SP9(收尾视图:系统设置 / KVM / Search)文案分片。"}]
en ORIG scan (sanity, should have hits): [{"word":"search","line":1,"excerpt":"// SP9 (final views: Settings / KVM / Search) locale shard. See zh_cn.sp9.ts."}]
zh replace scan: []
en replace scan: []
```

对产出树(`node oss/export.mjs --out /tmp/t8-tree3 …`)四个 locale 文件跑一遍完整扫描:

```
src/i18n/zh_cn.ts     0 命中
src/i18n/en_us.ts     1 命中 —— raidLevel1Usecase(与本次修复无关,已在第二轮报告里交给 T14 的既有遗留)
src/i18n/zh_cn.sp9.ts 0 命中   ← 本轮修复前是 1 命中(头注释 Search),现在归零
src/i18n/en_us.sp9.ts 0 命中   ← 同上
```

产出树 key 数复核(确认这是纯注释改动,没有影响任何键):`zh main 713/en main 713`、
`zh sp9 413/en sp9 413`,与第二轮报告数字一致,无漂移。

### 测试

补了一个新 it(`'复审第二轮:sp9 两个 locale 文件的头注释…'`),只扫**头注释块**
(`content.split('export default {')[0]`),不是整份文件——文件里其余"SP9-P4 account"/
"SP9-P6 …"这类章节标题注释是 coordinator 明确排除的"全仓 30 文件"那一大类,本轮不动。
断言用了 `/SP9(?!\.ts)/i` 排除"zh_cn.sp9.ts / en_us.sp9.ts"这种指代文件名本身的合法引用
（英文头注释改写后仍会说 "See zh_cn.sp9.ts."）——第一版断言没排除这个,被自己的测试当场
抓了个假红(误把文件名里的 "sp9.ts" 当成期号 "SP9"),修完 selector 后才是真断言。

```
$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  34 passed (34)

$ pnpm exec vitest run oss/tree.test.mjs src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  39 passed (39)
```

33(第二轮)→ 34(新增 1 例)全绿,私有侧 `parity.test.ts` 5 例保持绿。
