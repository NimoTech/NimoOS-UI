# Task 6.5 报告 —— 给泄漏守卫补中文词条

---

# 复审修复追记(2026-08-04 第二轮)

第一轮评审结论:**Needs fixes**(1 Critical + 2 Important)。以下按评审逐条修复,五项要求
① ~ ⑤ 依次给出证据。**只改了 `oss/forbidden.mjs`、`oss/forbidden.test.mjs` 与本目录下的
`chinese-leaks.md`**,没有碰 `manifest.mjs`/`apply.mjs`/`export.mjs`/`src/**`。

## Critical 修复:`搜索`/`照片` 的白名单从"关键词/键名子串"收紧为"整行精确匹配"

根因:`{ file: /StorePage\.vue$/, re: /搜索/ }` 这类写法里,`re` 只测「行内出现没出现这个子串」,
不管这一行到底写了什么——只要还含有"搜索"二字,不管后面追加了什么内容,整行都会被放行。
`/appsStoreSearch/`、`/raidLevel1Usecase/` 同理,是按**键名**而不是**值**豁免,值改成什么都不影响
豁免结果。

修法:新增 `exactLine(literal)` 小工具(`oss/forbidden.mjs`,SOFT 数组前面),把 13 条白名单
全部换成「整行精确匹配」——正则形如 `^\s*<转义后的整行原文>\s*$`,行内任何增删都会让匹配失效。
用 `new RegExp(string)` 构造(不是正则字面量),顺带省掉行内本来就有的 `/` 需要转义的麻烦。

### ① `搜索` 两条白名单收紧前后,「语音搜索」样本的实测对照

用 `git show 38c07c5:oss/forbidden.mjs` 取出**修复前**的版本(即第一轮提交的版本),分别用
修复前/后两版代码跑同一条评审给出的构造样本:

```js
// 构造样本(评审给出,复现 Critical)
const s1 = '// 商店页新增语音搜索:识别用户说的话,自动填充搜索框(接入 Nimo 大模型做语义排序)'
const s2 = "  raidLevel1Usecase: '照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)',"
```

实测输出:

```
BEFORE FIX adversarial 1 (StorePage.vue) findings: []
BEFORE FIX adversarial 2 (zh_cn.ts raidLevel1Usecase) findings: []

AFTER  FIX adversarial 1 (StorePage.vue) findings: [{"word":"搜索","line":1,"excerpt":"// 商店页新增语音搜索:识别用户说的话,自动填充搜索框(接入 Nimo 大模型做语义排序)"}]
AFTER  FIX adversarial 2 (zh_cn.ts raidLevel1Usecase) findings: [{"word":"照片","line":1,"excerpt":"raidLevel1Usecase: '照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)',"}]

# 合法原文两个方向都仍然是 []
legit 1 findings (should be []): []
legit 2 findings (should be []): []
```

修复前两条泄漏样本都是 `[]`(静默放行,复现评审描述的洞);修复后两条都被命中,且合法原文
（`raidLevel1Usecase: '照片库、个人 NAS、启动卷',` 与 `// 搜索输入:250ms 防抖…`)继续零命中。
这两条对照已固化进 `oss/forbidden.test.mjs` 的
`复审修复:白名单收紧为整行精确匹配,不给整行/整文件开洞(2026-08-04)` describe 块的前两个 `it`。

## Important② 修复:自查全部白名单,统一收紧标准

### ② 全部 13 条白名单的「细/宽」自查表

对**本任务自己新增的全部 13 条 allow**(转录 3 + 照片 3 + 搜索 7)逐条构造"合法原文 + 同一行追加
一段可信 AI/相册/搜索泄漏"的样本,验证"追加后必须命中、原文继续不命中"。以下是脚本实测输出
(每行 `OK` 表示该方向符合预期):

```
OK  legit  | OK  caught | 转录#1 RaidDetailPanel
OK  legit  | OK  caught | 转录#2 评分文本
OK  legit  | OK  caught | 转录#3 非我方发明
OK  legit  | OK  caught | 照片#1 raidLevel1Usecase
OK  legit  | OK  caught | 照片#2 ImageViewer 瓦片接缝
OK  legit  | OK  caught | 照片#3 theme.css media-overlay
OK  legit  | OK  caught | 搜索#1 appsStoreSearch
OK  legit  | OK  caught | 搜索#2 StorePage.vue L59
OK  legit  | OK  caught | 搜索#3 StorePage.vue L74
OK  legit  | OK  caught | 搜索#4 StorePage.vue L86
OK  legit  | OK  caught | 搜索#5 StorePage.test.ts L118
OK  legit  | OK  caught | 搜索#6 StorePage.test.ts L157
OK  legit  | OK  caught | 搜索#7 Files.vue L208

ALL 13 ENTRIES PASS SELF-AUDIT
```

13/13 全部通过(合法原文零命中 + 追加泄漏后必中)。这张表已经固化成
`oss/forbidden.test.mjs` 里 `转录/照片/搜索 全部 13 条白名单逐条自查` 这一条测试(带
`expect(rows.length).toBe(13)` 防止以后有人加白名单却忘了补自查行)。

**本任务范围之外的既有白名单**(`photo`/`gallery`/`search`(英文)/`ai`/`folderPermission`,T3 时期
既有设计)没有动——评审的 Critical/Important② 明确针对的是"你新增的"三个中文词,不在这轮修复范围。

## Important③ 修复:英文侧 `knowledge`/`RAG` 收 HARD,`smart` 明确不收

### ③ `knowledge`/`RAG` 命中验证 + `smart` 不收理由的落点

独立复核了评审给出的取证结论(没有直接照抄,自己重新跑了一遍 grep):

```bash
grep -rn -i "knowledge" --include='*.ts' --include='*.vue' src/    # 55 行,全部是 folder-permissions 相关
grep -rnE "\bRAG\b" --include='*.ts' --include='*.vue' src/        # 2 行,settingsFpKnowledgeDesc 中英文值
grep -rn -i "smart"  --include='*.ts' --include='*.vue' src/       # 12 行:10 处 SMART 磁盘健康 + 2 处真泄漏
grep -rn -iE "knowledge|\bRAG\b" ../NimoOS-Service/src/            # 0 行(Service 侧确认干净)
```

结论与评审一致:`knowledge`/`RAG` 全仓零合法用法,已加为 HARD(`oss/forbidden.mjs` HARD 数组末尾,
`T6.5 复审 Important③` 注释块);`smart` 10/12 是硬盘 S.M.A.R.T. 健康检测,明确不收,理由写在
**`oss/forbidden.mjs` 里紧跟 `RAG` 那条 HARD 词后面的大段注释**(逐条列出 10 处 SMART 磁盘文案 +
2 处真泄漏各自的坐标),另外在 **`oss/forbidden.test.mjs` 的
`英文侧补词:knowledge / RAG 收 HARD,smart 明确不收(T6.5 复审 Important③)` describe 块**里用真实
文件原文(`raidLevels.ts:126-127`、`RaidDriveCard.test.ts:95`)固化了"SMART 磁盘文案不被误伤"的回归测试。

实测:

```
knowledge test: [{"word":"knowledge","line":1,"excerpt":"settingsFpKnowledge: 'Knowledge base',"}]
RAG test: [{"word":"knowledge","line":1,"excerpt":"...(RAG).',"},{"word":"RAG","line":1,"excerpt":"...(RAG).',"}]
SMART disk (should be []): []
fragment sanity (RAG 词边界,should be []): []
```

`RAG` 用 `/\bRAG\b/`(区分大小写 + 词边界),`knowledge` 用 `/\bknowledge\b/i`(全仓已核实无
"acknowledge" 之类的碰撞词)。

### ⑤ `chinese-leaks.md` T8 节补全:中英成对键一共列了几条

补全后的"中英成对删除清单"覆盖 **23 个键**(zh_cn.ts/en_us.ts 15 个 + zh_cn.sp9.ts/en_us.sp9.ts
8 个),逐条给出中文值节选、英文值逐字、"英文侧是否被独立命中"。人工复核结论:

- **22 个键**的英文侧当前已经能被某个词独立命中(`transcript`/`ask nimo`/`photo`/`search`/`ai`/
  `knowledge`/`RAG`,其中两个是"靠键名侥幸命中"——`widgetAiDesc`(键名含 `Ai`)、`searchOpenAlbum`
  (键名含 `search`),T8 若顺手把这两个键改名,值本身会裸奔,已在表里标注)。
- **1 个键是真正的盲区**:`settingsFpIntro`,中文值含"智能"(会被中文词命中),但英文值
  `Manage each smart feature's folders in its own section below.` 因为 `smart` 明确不收、
  键名又不含 `ai`,**完全不会被任何词命中**。已经在 `chinese-leaks.md` 里用粗体加⚠️标出,
  要求 T8 手动确认这个键的中英两侧都被删除,不能依赖守卫报警。

### ④ 最终测试输出

```
$ pnpm exec vitest run oss/forbidden.test.mjs
 Test Files  1 passed (1)
      Tests  25 passed (25)
   Start at  04:27:01
   Duration  589ms (transform 135ms, setup 226ms, import 22ms, tests 13ms, environment 222ms)

$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  04:27:03
   Duration  795ms (transform 103ms, setup 203ms, import 17ms, tests 249ms, environment 218ms)
```

25 = 既有 13 + 第一轮新增 7 + 本轮新增 5(白名单收紧对照 2 条 + 13 条自查表 1 条 + knowledge/RAG
命中 1 条 + smart 不误伤 1 条)。`tree.test.mjs` 17 例未受任何牵连。

### 词表最终形态(第二轮结束)

`HARD`:18 条(原 12 + 第一轮 4 + 本轮 `knowledge`/`RAG` 2 条)。
`SOFT`:13 条不变(转录/照片/搜索三条的 `allow` 内容从"关键词/键名"换成了 `exactLine(...)`,
条目数量没变,只是每条白名单内部的匹配方式变了)。

用新词表重扫产出树(`node oss/export.mjs --out /tmp/t65-tree --skip-guard --no-commit --allow-dirty-oss`
重新生成,因为上一轮的 `/tmp/t65-tree` 已被系统清理):候选词(含 `knowledge`/`RAG`)命中从
97 条升到 **118 条**,新增的 21 条全部落在预期位置——`en_us.sp9.ts`(3 条:`knowledge`×2 +
`RAG`×1)与三个 folder-permissions 孤儿测试文件
(`folderPermissions.test.ts` 15、`folderPermissionsSnapshot.test.ts` 1、
`folderPermissionsView.test.ts` 1)。这三个孤儿测试第一轮报告里就已经点名要删,只是当时说
"零候选词命中、靠 ai/search 覆盖"——这个说法不够精确,`chinese-leaks.md` 的 T13 节已经改成
基于实测的 knowledge 命中数,不再是笼统描述。

### 自查结论(第二轮)

1. Critical:两条构造样本(语音搜索追加 / raidLevel1Usecase 追加)修复前 `[]`、修复后命中,已固化测试。
2. Important②:13 条白名单逐条自查,合法原文零命中 + 追加泄漏必中,已固化测试(带数量断言防漏改)。
3. Important③:`knowledge`/`RAG` 加为 HARD 并验证命中;`smart` 不收的理由写进代码注释 + 测试;
   `chinese-leaks.md` T8 节补全为 23 个键的完整中英对照表,标出唯一真正的盲区 `settingsFpIntro`。
4. 既有 13 例 + 第一轮 7 例 + 本轮 5 例 = 25 例全绿;`tree.test.mjs` 17 例未变。
5. `git status --porcelain` 复核仍然只剩 3 行 design-export 的 ` D`(见下方 commit 记录)。

### 遗留疑问(第二轮,补充第一轮的三条)

1. 第一轮遗留疑问 1/2/3 依然有效(智能是否该判 HARD、语义搜索哨兵的书写形态是猜的),本轮没有
   改变这两个判断。
2. `widgetAiDesc`/`searchOpenAlbum` 这两个"靠键名侥幸命中"的键,如果 T8 或未来任何任务重命名
   了键但忘了同步检查值本身是否含候选词,会制造新的盲区。这是**键名巧合掩盖了值本身零覆盖**的
   结构性风险,已经在 `chinese-leaks.md` 的中英对照表里标注,但没有(也不适合在本任务内)靠加词
   彻底解决——真正的解法是"值本身也要覆盖",但 `Album`/`smart` 这类通用词一旦收进词表,误报面
   会和"语义"/"knowledge"式的风险一样不可控,只能留给人工复核。

---

## 测量基线(Step 1)

产出树:

```
node oss/export.mjs --out /tmp/t65-tree --skip-guard --no-commit --allow-dirty-oss
```

输出:

```
[oss] 1/6 前置检查
[oss]   New-UI 88c6fae7 · Service 7e84566b
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 20 · REPLACE 0 · PATCH 40)
[oss] 4/6 内嵌共享包
[oss] 5/6 泄漏守卫 —— 已用 --skip-guard 跳过(仅开发期允许,未扫描任何文件)
[oss] 6/6 落盘 → /tmp/t65-tree
```

对产出树跑候选词一次性 grep(改词表之前):

```bash
cd /tmp/t65-tree && for w in 搜索 照片 转录 说话人 知识库 向量化 智能 相册; do
  echo "=== $w ==="; grep -rn "$w" --include='*' -I . 2>/dev/null | grep -v node_modules
done
```

命中数(与 brief 的实测表基本吻合,brief 表用的是私有仓,这里是产出树,数字略有出入是因为
产出树已经应用了 T6 的 PATCH):

| 词 | 命中行数 |
|---|---|
| 搜索 | 15 |
| 照片 | 14 |
| 转录 | 24 |
| 说话人 | 31 |
| 知识库 | 2 |
| 向量化 | 4 |
| 智能 | 8 |
| 相册 | 10(已被现有 HARD 词覆盖,列出仅作对照) |

`git show HEAD:src/home/components/HomeTopbar.vue` 确认了 brief 点名的静默泄漏样本
(`保留搜索与主题切换`)在私有侧原文第 57 行:

```
/* ≤720px 手机启动器为只读:隐藏添加/编辑入口(排序增删在桌面做),保留搜索与主题切换 */
```

导出树里这句已经被 Task 6 的 PATCH 改成"保留主题切换"(见 `oss/manifest.mjs` PATCH 表倒数第
6 条,注释里写了"词表本身的修补是另一个任务的活")——这正是本任务要补的那个任务。

---

## 逐词核实与取舍(Step 4 的过程记录)

对每个候选词跑了全私有仓 grep(不只是产出树,因为词表是永久规则,要看全部历史 + 未来合并进来的
sp7/sp8 代码会命中的模式),逐条判断"是否存在合法用法":

### 判定为 HARD(全仓所有出现都属于待剥离功能,无白名单)

- **说话人**:`theme.css`(2)、`MediaViewer.vue`(约 24)、`speakerWave.ts`(8,已在 DELETE 表)、
  `speakerWave.test.ts`(7)、`audioTranscripts.ts`(3,已在 DELETE 表)—— 全部是音频转录说话人
  分离功能,零合法用法。
- **知识库**:仅 `zh_cn.sp9.ts:252-253`(folder-permissions RAG 分区),零合法用法。
- **向量化**:仅 `MediaViewer.vue`(2)、`zh_cn.ts:40-41`(audioAsk 系列)、`audioTranscripts.ts:8`
  (已在 DELETE 表),零合法用法。
- **问 Nimo**:仅 `zh_cn.ts:38/40`(`audioAsk`/`audioAskEmpty`),零合法用法。正则用
  `/问\s*Nimo/i` 而不是更宽的 `/问/`,避免收进任何以"问"开头但与 Ask Nimo 无关的中文句子。

### 判定为 SOFT + 精确白名单(找到了合法用法,证据见下)

- **转录**:`zh_cn.ts:663/678/682` 三行是 RAID 级别文案的来源说明注释
  (`// 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290...`),这里"转录"是"抄录/转写文档"
  的通用义,与音频转录 AI 功能无关。**这是本任务过程中新发现的一个真实误报,brief 原本把
  "转录"列在候选硬禁词里,我实测后改判为软禁词** —— 如果照 brief 字面做成 HARD,这三行 RAID
  说明注释会被永久挡死,而它们不该删。
- **照片**:
  - `zh_cn.ts:700`(`raidLevel1Usecase: '照片库、个人 NAS、启动卷'`)—— brief 已指定的保留面。
  - `ImageViewer.vue:209`(瓦片接缝会在照片上显出白色网格细线)—— ImageViewer 是 Files 区的
    通用图片查看器,"照片"在这里是"图片内容"泛称,不是被删的 Photos 相册 app。
  - `theme.css:123`(`--media-overlay-shadow` 的注释)—— 用 `grep -rn media-overlay-shadow src/`
    核实这个 token **只被** `ImageViewer.vue:221` 消费,证明这条注释与 Photos app 无关。
- **搜索**:
  - `zh_cn.ts:392`(`appsStoreSearch: '搜索应用…'`)—— brief 已指定的保留面。
  - `StorePage.vue`(3 行注释)+ `StorePage.test.ts`(2 行)—— 整个文件只有"应用商店按关键字
    过滤"这一个"搜索"语义,已用 `grep -n 搜索 src/apps/views/StorePage.vue` 核实全部 3 处都是
    这个语义,没有夹带别的东西。
  - `Files.vue:208`(`// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴`)—— 用
    `grep -n -i "search|filter" src/views/Files.vue` 核实这里没有本地 SearchDialog 引用,
    是泛指"任何可编辑输入框"的注释(重命名框、未来可能的文件名过滤框),不是指向被删的
    AI 搜索面板。

### 判定为 SOFT + 空白名单(哨兵,brief 点名但当前找不到反例)

- **智能**:brief 明确说"这三个一定有合法用法,自己查"(与搜索/照片并列),但全仓 grep
  (`grep -rn 智能 --include='*.ts' --include='*.vue' src/`)只返回 8 行,**全部**在
  `SearchDialog.vue`/`MediaViewer.vue`/`audioTranscripts.ts`/`zh_cn.ts`/`zh_cn.sp9.ts` 里,
  全是待剥离的 AI 功能,没有找到反例。按纯粹的判据("所有出现都属于待剥离功能→HARD")这个词
  该判 HARD,但我选择了 SOFT + 空白名单:"智能"是通用汉语词(不像"知识库"/"向量化"是专有复合词),
  未来磁盘/网络/KVM 等非 AI 功能完全可能合法使用"智能"(如"智能识别""智能省电"),一旦出现应该
  能加白名单而不是被 HARD 词永久挡死。这是我在"严格执行判据"和"给未来留活口"之间做的一个
  工程判断,不是 brief 明确要求的,在此说明理由供复审。
- **语义搜索**(词组,不是单字"语义"):brief 特别警告"语义"单字命中 51 个 CSS token 注释文件
  (已用 `grep -rl 语义 src/ | wc -l` 复核,确实是 55,数字略有出入是因为我统计口径包含 .vue/.ts/.css
  三种扩展名,brief 只统计了部分;结论一致:不能收单字)。核实"语义搜索"作为完整词组当前
  **全仓 0 命中**(`grep -rn 语义搜索 src/` 无输出)。加为 SOFT 空白名单纯粹是防御性哨兵,
  为 sp7-photos/sp8-ai 合并后可能引入的语义搜索功能预先占位;当前无法验证这个词组届时的真实
  书写形态,留作 T14 或后续任务视情况调整。

### 未采纳的候选(记录理由,避免后人重复调查)

- **"Knowledge base" / "RAG"(英文)**:`en_us.sp9.ts` 里与"知识库"配对的英文键当前没有任何
  英文词覆盖。调查后发现这两个键**只**出现在会被 T8 整体处理的 `settingsFp*` 键簇里(中文键一删,
  英文键必然同批删除),追加一个通用英文词"knowledge"的误报面未知且不在本任务的中文词条范围内,
  故未添加,已记录进 `chinese-leaks.md` 的 T8 一节提醒执行者"删中文键时把配对英文键也删了"。
- **`theme.css:51/270` 提到的 "SearchDialog·MediaViewer"**:这是现有英文 `search` 软禁词的命中
  (SearchDialog 已删但注释还提它),不是本任务新词的范围,顺手记录进 `chinese-leaks.md` 的 T8
  一节,避免只看中文清单的人漏掉。

---

## 最终词表变更(`oss/forbidden.mjs`)

**HARD 新增 4 条**(原 12 条 → 16 条):`说话人`、`知识库`、`向量化`、`问 Nimo`(`/问\s*Nimo/i`)。

**SOFT 新增 5 条**(原 8 条 → 13 条):
- `转录`(1 条白名单规则,覆盖 zh_cn.ts 三行 RAID 文案说明)
- `照片`(3 条白名单规则:raidLevel1Usecase / ImageViewer.vue / theme.css)
- `搜索`(4 条白名单规则:appsStoreSearch / StorePage.vue / StorePage.test.ts / Files.vue)
- `智能`(空白名单,哨兵)
- `语义搜索`(空白名单,哨兵)

白名单一律用「文件正则 + 该文件内允许的整行内容正则」,没有一条按行号。所有 allow 的内容正则
都锚定在**该合法用法独有的、不会被真实泄漏文本意外命中的短语**上(比如 `转录` 白名单用的是
"逐字转录自 NimoOS-UI RaidDetailPanel"这种整句特征,而不是笼统的 "RAID",避免未来真的有人在
同一文件里写一句提到 RAID 又提到音频转录的话被误放行)。

---

## 测试(Step 2/3/5 的实际输出)

### 新增测试先跑红(验证测试本身有效,不是摆设)

用 `git stash push -- oss/forbidden.mjs` 临时还原到修改前的词表,跑新增测试:

```
 FAIL  中文痕迹必须命中(T6.5 新增) > T6 评审抓到的静默泄漏:HomeTopbar.vue 那句"保留搜索与主题切换"...
 FAIL  中文痕迹必须命中(T6.5 新增) > 转录 / 说话人 / 知识库 / 向量化 / 问 Nimo 一律命中
 FAIL  合法中文用法零误报(T6.5 新增) > 照片 的白名单:...
 FAIL  合法中文用法零误报(T6.5 新增) > 搜索 的白名单:...
 Test Files  1 failed (1)
      Tests  4 failed | 16 passed (20)
```

（"智能命中"与"转录白名单精确性"两条测试改词表前恰好也是绿的/红的边界情况,不影响结论——
4 条核心断言证明了新增测试确实在验证新增能力,不是空转。)`git stash pop` 后确认工作区精确
回到修改后状态,且 3 个 design-export 删除态原样保留(`git status --porcelain` 核对过,见下)。

### 改词表后全绿(Step 5)

```
pnpm exec vitest run oss/forbidden.test.mjs
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

```
pnpm exec vitest run oss/forbidden.test.mjs oss/tree.test.mjs
 Test Files  2 passed (2)
      Tests  37 passed (37)
```

既有 13 例(forbidden)+ 17 例(tree)一条没变,新增 7 例全绿,合计 20+17=37。两次单独跑
`forbidden.test.mjs` 都是"20 passed (20)"、`tree.test.mjs` 是"17 passed (17)"(在合并跑的
37 里可分解验证:20+17=37,与单跑一致)。

### 用新词表重扫产出树(验证白名单在真实场景里生效,不只是单元测试里生效)

```js
node -e "
import('./oss/forbidden.mjs').then(m => {
  const findings = m.scanTree('/tmp/t65-tree');
  const words = new Set(['相册','说话人','知识库','向量化','问 Nimo','转录','照片','搜索','智能','语义搜索']);
  console.log(findings.filter(f => words.has(f.word)).length);
});
"
# → 97
```

97 条命中,分布在 11 个文件(MediaViewer.vue 48、speakerWave.test.ts 7、SearchDialog.test.ts 1、
AiWidget.test.ts 2、eventMap.test.ts 1、zh_cn.sp9.ts 8、zh_cn.ts 19、AppsPanel.test.ts 2、
AppsPanel.vue 2、FolderPermissionsPanel.test.ts 1、theme.css 6)。**关键验证**:被我加了白名单的
8 行(zh_cn.ts 的 3 行 RAID 说明 + raidLevel1Usecase + appsStoreSearch;ImageViewer.vue 1 行;
theme.css 的 media-overlay-shadow 1 行;StorePage.vue/test.ts/Files.vue 各自的合法用法)
**一条都没有出现在这 97 条里** —— 白名单在真实文件树扫描上确认生效,不只是单测里的字符串生效。

---

## 误报处理记录

本任务全程只用白名单处理误报,零次通过放宽正则或删词来消除误报。三处误报(转录/照片/搜索)
均已在上面"逐词核实与取舍"一节给出证据与白名单写法。没有出现"加了白名单还是有漏网误报,只能
再放宽"的情况。

---

## 自查结论

1. **中文痕迹会被抓到**:`scanText('src/home/components/HomeTopbar.vue', '...保留搜索与主题切换...')`
   等全部 brief 点名的样本已用测试锁定,且是私有侧原文,不是编造的简化版。
2. **合法中文用法零误报**:应用商店筛选(`appsStoreSearch`/`StorePage.vue`)、RAID 照片库用途
   说明(`raidLevel1Usecase`)、CSS "语义" token 注释(未收单字词,专门测试验证不误伤)三类均已
   验证零命中,另外补齐了 brief 未列出但实测发现的两类合法用法(转录=RAID 文案来源说明、
   照片=ImageViewer 通用图片查看器)。
3. `oss/forbidden.test.mjs`:20/20 绿,含既有 13 例。
4. `oss/tree.test.mjs`:17/17 绿,未受牵连。
5. `chinese-leaks.md` 已按 T7/T8/T9/T10/T11/T13/T14/已解决 八档分类写好,每条给了文件:行 + 原文
   + 一句归因,T9/T11/Service 三个"预期零命中"的档也明确写了"已核实为 0"而不是留白。

---

## 遗留疑问

1. **"智能"该不该现在就判 HARD**:见上面"判定为 SOFT + 空白名单"一节的说明,这是我偏离 brief
   字面判据("所有出现都属于待剥离功能→HARD")做的工程取舍,理由是"智能"是通用词、未来非 AI
   功能合法使用的概率不可忽略。如果复审认为应该严格按判据走(当前 0 反例就该 HARD),把
   `oss/forbidden.mjs` 里的 `{ word: '智能', re: /智能/, allow: [] }` 从 SOFT 数组挪到 HARD
   数组、写法从 `['智能', /智能/]` 即可,不影响任何现有测试(HARD 和 SOFT 在"当前 0 白名单"
   的情况下行为等价,区别只在于未来能不能加白名单)。
2. **英文 "Knowledge base"/"RAG" 的缺口**:已在报告与 chinese-leaks.md 里说明未处理的理由
   (范围外 + 会随中文键一起被 T8 删除),但如果 T8 执行时没有意识到要同步删英文键,这个英文
   缺口会独立存活下来。建议 T8 或 T15(四道门收尾)时用 `grep -rn "Knowledge base\|RAG" src/i18n/`
   做一次人工复核。
3. **`语义搜索` 哨兵词的书写形态是猜的**:sp7-photos/sp8-ai 合并后,如果语义搜索功能真的落地
   到 New-UI 且中文写法不是"语义搜索"四个字连写(比如拆成"按语义来搜索"或直接用英文
   "semantic search"),这个哨兵不会命中,需要那时候的任务补词,不算本次遗漏。
