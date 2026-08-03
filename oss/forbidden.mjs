import fs from 'node:fs'
import path from 'node:path'

// ─── 硬禁词:出现即失败,无白名单 ────────────────────────────────────────────
// 注意 E4:spec §6.1 原本把 folderPermission 放在这里,那会让守卫永久红 ——
// UserFolderPermission 是成员文件夹授权的类型名,是保留面。已降为软禁词。
export const HARD = [
  ['相册', /相册/],
  ['Nimo AI', /Nimo\s*AI/i],
  ['ask nimo', /ask\s*nimo/i],
  ['transcript', /transcript/i],
  ['qdrant', /qdrant/i],
  ['ollama', /ollama/i],
  ['embedding', /embedding/i],
  ['CLIP', /\bCLIP\b/],
  ['immich', /immich/i],
  ['photos_data', /photos_data/i],
  ['wikiRoot', /wikiRoot/i],
  ['192.168.1.115', /192\.168\.1\.115/],

  // ── T6.5:中文硬禁词 ──────────────────────────────────────────────────
  // 本库注释与界面文案全中文,原词表只有「相册」一个中文词,是个大盲区(见
  // T6.5 brief 的实测表:搜索/照片/转录/说话人/知识库/向量化/智能 命中数原本全是 0)。
  // 以下四条已在全仓 grep 核实:所有出现都属于「该剥离的 AI/音频转录功能」,
  // 没有发现任何合法用法,故直接 HARD(不给白名单)。
  ['说话人', /说话人/],       // 音频转录的说话人分离/diarization,仅见于 MediaViewer/theme.css/speakerWave 一族
  ['知识库', /知识库/],       // RAG 知识库,仅见于 settingsFp(folder-permissions,AI 消费方)i18n 键
  ['向量化', /向量化/],       // 向量化/embedding 的中文说法,仅见于 Ask Nimo 音频问答文案
  ['问 Nimo', /问\s*Nimo/i], // "Ask Nimo" 的中文说法(audioAsk/audioAskEmpty),与「Nimo AI」分开收

  // ── T6.5 复审 Important③:英文侧配对词 ─────────────────────────────────
  // 「知识库」的英文孪生词。全仓 grep 核实(含 packages/service 与 ../NimoOS-Service):
  // knowledge/RAG 的所有出现——settingsFpKnowledge(Desc)、en_us.sp9.ts 的
  // 'Knowledge base'/'…knowledge base (RAG).'、knowledgeRootItems/knowledgeExcludeItems/
  // knowledgeCell/knowledgeKindOf、FolderPermColumn 的 'knowledge' 分支、'knowledge-root'/
  // 'knowledge-exclude' 字面量——全部集中在 folder-permissions 这一个 AI 消费方(四分区面板
  // 及其 util/test),零合法用法。用 \b 词边界,不会误伤 "acknowledge" 这类词(已 grep 确认
  // 全仓没有这个词)。
  ['knowledge', /\bknowledge\b/i],
  // RAG 只出现在 settingsFpKnowledgeDesc 的英文/中文值里(en_us.sp9.ts:245、zh_cn.sp9.ts:253),
  // 同样零合法用法。要求全大写 + 词边界,避免误伤"fragment"之类含 "rag" 子串的词。
  ['RAG', /\bRAG\b/],

  // 注意:评审同时问过「smart」(对应中文「智能」)要不要收。**不收,而且不应该收**——
  // 已用 `grep -rn -i smart --include='*.ts' --include='*.vue' src/` 核实全仓 12 处命中:
  // 10 处是硬盘 S.M.A.R.T. 健康检测(`src/storage/**`,如 `SMART 未过("false")→ 风险边框`、
  // `data.disks[*].health = "true" ← SMART 通过`、`100 分起扣:SMART 未过直接 0`),
  // 与 AI 完全无关;只有 2 处是真泄漏(`en_us.sp9.ts:238` 的 `settingsFpIntro: '...smart
  // feature's...'`、`en_us.ts:236` 的 `widgetAiDesc: 'Chat and smart suggestions'`,
  // 这两处已经通过它们的中文孪生键——`settingsFpIntro`/`widgetAiDesc` 的中文值命中
  // 「智能」——被抓到,T8 删中文键时英文键会一起被处理,不会漏)。10/12 是无关的磁盘功能,
  // 词表「宁可宽」不等于「宽到把无关功能的正常代码全染红」,故不收。后人看到「智能」有词、
  // 「smart」没词,不要顺手补上——先重读这段注释。
].map(([word, re]) => ({ word, re }))

/**
 * T6.5:把一段"已知合法的整行内容"转成整行精确匹配的正则(允许行首/行尾空白)。
 * 用于 allow 条目 —— 只匹配"这一行掐头去尾就是这段文本",行内任何增删都会让
 * 匹配失效,从而回落到"未豁免、按词表规则判断",不会带着新增的泄漏一起被放行。
 * 复审 Critical(2026-08-04)的教训:之前用「文件+关键词/键名子串」豁免,等于对
 * 整行甚至整个文件开洞——只要在被豁免的那一行混入真实 AI 泄漏也照样放行(复现
 * 见 转录/照片/搜索 三个词条各自的注释)。用 new RegExp(string) 构造而不是正则
 * 字面量,顺带省掉「行内本来就有 / 」时的转义麻烦。
 */
function exactLine(literal) {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\s*${escaped}\\s*$`)
}

// ─── 软禁词 + 精确白名单 ────────────────────────────────────────────────────
// allow 的每一项是「文件正则 + 该文件里允许的整行正则」。按文件+内容豁免,
// 绝不按行号 —— 行号会漂,漂了豁免就失效,然后人就会去放宽词表。
export const SOFT = [
  {
    word: 'photo',
    re: /photo/i,
    allow: [
      { file: /src\/files\/util\/fileCategories\.ts$/, re: /APPLICATION_PHOTOSHOP/ },
      { file: /src\/files\/util\/icons\.ts$/, re: /folder-pictures|APPLICATION_PHOTOSHOP/ },
      { file: /src\/apps\/util\/importNormalize\.ts$/, re: /'pictures',\s*'photo'|除 config\/download\/pictures\/photo\/media 外/ },
    ],
  },
  {
    word: 'gallery',
    re: /gallery/i,
    allow: [
      { file: /src\/files\/util\/protect\.ts$/, re: /\/DATA\/Gallery|'Gallery'/ },
      { file: /src\/files\/util\/icons\.ts$/, re: /Gallery/ },
      { file: /src\/settings\/util\/migrateBrowse\.ts$/, re: /Gallery/ },
      { file: /src\/settings\/panels\/AppsPanel\.vue$/, re: /Gallery/ },
      { file: /src\/home\/grid\/defaultLayout\.ts$/, re: /\/DATA\/Gallery/ },
      { file: /src\/i18n\/(zh_cn|en_us)\.ts$/, re: /Gallery/ },
      // E6:Vue2 逐字移植的路径归一(应用导入时的目录归一化),/DATA/Gallery 是
      // LocalStorage 开机自建的系统目录,与相册功能无关,是保留面。
      { file: /src\/apps\/util\/importNormalize\.ts$/, re: /\/DATA\/Gallery/ },
    ],
  },
  {
    word: 'search',
    re: /search/i,
    allow: [
      { file: /src\/apps\/views\/StorePage\.vue$/, re: /query\.search|searchInput|filterStoreApps|appsStoreSearch/ },
      { file: /src\/apps\/stores\/installedApps\.ts$/, re: /filterStoreApps|searchInput/ },
      { file: /src\/i18n\/(zh_cn|en_us)\.ts$/, re: /appsStoreSearch/ },
      // findIndex / findLastIndex 等标准库方法名里没有 search;binarySearch 之类若出现须显式登记
    ],
  },
  { word: 'speaker', re: /speaker/i, allow: [] },   // 拆完应零命中,留着当哨兵

  // ── T6.5:中文软禁词 ──────────────────────────────────────────────────
  // 搜索/照片/转录 三个字面上比硬禁词常见,已实测在本仓存在合法用法(见各自
  // allow 注释的 grep 证据),按纪律「禁止放宽词表消除误报」只能精确白名单。
  //
  // 复审 Critical(2026-08-04):最初这三个词的 allow 有的按「文件 + 键名子串」
  // (如 /appsStoreSearch/、/raidLevel1Usecase/)、有的按「文件 + 单字/短词」
  // (如 StorePage.vue 整体 /搜索/)豁免 —— 两种写法都等于"对整行甚至整个文件开洞":
  // 只要在被豁免的那一行(哪怕只是追加内容)混入真实 AI 泄漏,旧写法照样放行。
  // 复审用两条构造样本复现了这个洞:
  //   - raidLevel1Usecase 值改成"照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)"
  //     ——/raidLevel1Usecase/ 只看键名,不管值写了什么,永远放行。
  //   - StorePage.vue 插入"// 商店页新增语音搜索:...(接入 Nimo 大模型做语义排序)"
  //     ——整文件通配的 /搜索/ 照样放行这一整行,包括后面那句真泄漏。
  // 改法:全部换成 exactLine() 整行精确匹配(见下方定义)。行内任何增删都会让匹配
  // 失效、退回"未豁免",不会带着新增泄漏一起被放行。两条构造样本已重新验证:
  // 收紧前放行、收紧后正确命中(证据见 oss/forbidden.test.mjs 与 task-6.5-report.md)。
  {
    word: '转录',
    re: /转录/,
    allow: [
      // zh_cn.ts:663/678/682 —— RAID 级别文案的来源说明("逐字转录自
      // RaidDetailPanel.vue/raidUtils.js"),是文档意义上的"抄录/转写",
      // 与音频转录(AI)功能无关。已用 grep 核实:这三行是本仓 转录 出现
      // 在 zh_cn.ts 里唯二不属于 audio* 转录键的地方。逐行精确匹配,不是关键词。
      { file: /src\/i18n\/zh_cn\.ts$/, re: exactLine('// 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)') },
      { file: /src\/i18n\/zh_cn\.ts$/, re: exactLine('// read/write 为该表原始 1-5 评分(5、4),转录为评分文本。') },
      { file: /src\/i18n\/zh_cn\.ts$/, re: exactLine("// desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明)") },
    ],
  },
  {
    word: '照片',
    re: /照片/,
    allow: [
      // raidLevel1Usecase:RAID 用途说明("照片库、个人 NAS、启动卷"),与相册 app 无关
      // (brief 指定保留面)。锚定整行(键名+值),不是只锚键名 —— 见上方复审 Critical 的复现证据。
      { file: /src\/i18n\/zh_cn\.ts$/, re: exactLine("raidLevel1Usecase: '照片库、个人 NAS、启动卷',") },
      // ImageViewer 是通用图片文件查看器(Files 区),"照片"在这里是"图片内容"的泛称,
      // 不是被剥离的 Photos 相册 app。--media-overlay-shadow 同一 token 只被这里消费(已 grep 核实)。
      { file: /src\/files\/viewers\/ImageViewer\.vue$/, re: exactLine('瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */') },
      { file: /src\/styles\/theme\.css$/, re: exactLine('/* 媒体(照片/视频)上方浮层的投影:内容颜色不可控,白图上纯白浮层会隐形,') },
    ],
  },
  {
    word: '搜索',
    re: /搜索/,
    allow: [
      // appsStoreSearch:应用商店筛选框(brief 指定保留面),与 NimoOS-Search 服务无关。锚定整行。
      { file: /src\/i18n\/zh_cn\.ts$/, re: exactLine("appsStoreSearch: '搜索应用…',") },
      // StorePage 这三行注释是"应用商店按关键字过滤"语义,与 AI 语义搜索无关。逐行精确匹配,
      // 不是给整个文件的"搜索"二字开洞 —— 见上方复审 Critical 的复现证据。
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 分类/作者是后端参数:query 变化即重拉;搜索纯前端不重拉') },
      { file: /src\/apps\/views\/StorePage\.vue$/, re: exactLine('// 推荐带只在「未过滤未搜索」的首屏语境显示——过滤/搜索时列表就是用户要的答案,带子是噪音') },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('搜索输入 250ms 防抖后 replace 路由 query(前端过滤,深链)', async () => {") },
      { file: /src\/apps\/views\/StorePage\.test\.ts$/, re: exactLine("it('Featured 带只在 无搜索+全部分类+全部来源 时显示', async () => {") },
      // Files.vue:粘贴上传的"焦点在输入框(重命名/搜索等)"是 Files 区自己的文件名过滤输入框,
      // 不是被删除的 SearchDialog/NimoOS-Search。
      { file: /src\/views\/Files\.vue$/, re: exactLine('// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。') },
    ],
  },
  // 智能:brief 点名的候选软禁词,但全仓 grep 核实后目前没有找到非 AI 的合法用法
  // (2026-08-04:src/home/components/SearchDialog.vue、MediaViewer.vue、audioTranscripts.ts、
  // zh_cn.ts/zh_cn.sp9.ts 里全部出现都属于要剥离的 AI 功能)。仍然放 SOFT 而不是 HARD——
  // 「智能」是通用词,未来任何非 AI 功能(如磁盘/网络的"智能识别")都可能合法用到它,
  // 一旦出现应加白名单而不是被迫放宽词表。当前 allow 为空,等同哨兵:任何命中都是待办。
  { word: '智能', re: /智能/, allow: [] },
  // 语义搜索:brief 特别警告"语义"单字词命中 51 个 CSS token 注释文件,禁止收单字。
  // 这里只收词组"语义搜索"。当前全仓 0 命中(sp7-photos/sp8-ai 合并前语义搜索功能还
  // 没有落地到 New-UI),先占位当哨兵,防止未来该功能被引入后悄悄漏进开源包。
  { word: '语义搜索', re: /语义搜索/, allow: [] },
  {
    word: 'ai',
    // 词边界:不碰中文、chain、main、Chairman。
    //
    // 第二轮复审 Important:第一轮的 alt2(要求 "AI" 前面不挨字母,即只认 "AI" 打头的
    // camelCase/PascalCase,如 AIService)漏掉了 "AI" 结尾的驼峰,比如 sendToAI/chatAI/
    // openAIRequest —— sendToAI 恰恰是本仓真实存在、且正是这次要清除的 AI 链路的核心
    // 函数名(src/home/composables/useOpenAction.ts:54 等 8 处),守卫必须抓到它。
    //
    // 改成两条子规则:
    //   alt1(大小写不敏感):独立词 ai/AI/Ai/aI,前面不挨字母、后面不挨"小写"字母 ——
    //        覆盖裸词 "ai"/"AI"、"AI 总结"、"AI-powered"、"AIService"(后面跟大写 S 不算挨着)。
    //   alt2(首字母 A 强制大写,第二个字母不区分大小写):前面挨一个小写字母、后面不挨
    //        小写字母 —— 覆盖"驼峰词尾的 Ai/AI",如 sendToAI、chatAI、openAIRequest,
    //        以及第三轮复审补的 widgetAiSend、pathFromAiPattern、askNimoAi(本仓 i18n 键/
    //        函数名的真实书写形态是首字母大写、第二个字母小写的 "Ai",不是全大写 "AI")。
    //
    // ★★★ 警告(两轮复审都在这条上栽过,后人别再栽):alt2 的第一个字母 A 必须
    // 强制大写(写成 `A[Ii]`),绝不能写成 `[Aa][Ii]`、也不能对这个 alt 整体套 /i。
    // src/settings/util/timezones.ts 里有真实存在的 Asia/Shanghai、Asia/Dubai —— 那里的
    // "ai" 是全小写,前面接小写字母、后面到词尾。一旦 alt2 允许首字母小写 a,
    // Shanghai/Dubai/Thai/bonsai 会立刻全部变成误报,而它们是本仓合法字符串。
    // 首字母强制大写这条边界,就是把"合法英文单词里的 ai"和"人为造的 Ai/AI 缩写"分开的
    // 唯一依据 —— 后人若想"顺手统一大小写",请先重新读这段注释再动手。
    //
    // 代价:const AIRPORT=1 这类"AI"后面直接接大写字母的全大写标识符仍会被 alt1 命中
    // (机场号码/常量名一类罕见样式)。按纪律「词表宁可宽」接受这个已知的假阳性,不为它
    // 收窄规则去冒漏掉真实 AI 代码的风险。
    re: /(?<![A-Za-z])[Aa][Ii](?![a-z])|(?<=[a-z])A[Ii](?![a-z])/,
    allow: [
      // E5:局部变量 ai = anchorIndex(files.ts 的 shift 选区)
      { file: /src\/files\/stores\/files\.ts$/, re: /\bai\b\s*[=<,)\]]|\[lo,\s*hi\]/ },
    ],
  },
  { word: 'parser', re: /\bparser\b/i, allow: [] },
  { word: 'wiki', re: /wiki/i, allow: [] },
  {
    word: 'folderPermission',
    re: /folderPermission/i,
    allow: [
      // E4:成员文件夹授权,与 AI 无关,保留面
      { file: /.*/, re: /UserFolderPermission/ },
    ],
  },
]

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB —— 超限的文件跳过,但留痕(见 scanTree)
const SNIFF_BYTES = 8 * 1024 // 只抽查开头 8KB 判二进制,足够且快

/**
 * 二进制启发式:开头 8KB 里出现 NUL 字节就判定为二进制。比按扩展名判断可靠 ——
 * 这棵树里确实混着真二进制(例如 src/home/apps/icons/*.png),按 utf8 硬读会
 * 产生乱码触发的垃圾误报,还慢。
 */
function looksBinary(buf) {
  const n = Math.min(buf.length, SNIFF_BYTES)
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

function allowed(rules, relPath, line) {
  return rules.some((r) => r.file.test(relPath) && r.re.test(line))
}

/** 扫一段文本。返回命中列表(空数组 = 干净)。 */
export function scanText(relPath, text) {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { word, re } of HARD) {
      if (re.test(line)) out.push({ word, line: i + 1, excerpt: line.trim().slice(0, 160) })
    }
    for (const { word, re, allow } of SOFT) {
      if (re.test(line) && !allowed(allow, relPath, line)) {
        out.push({ word, line: i + 1, excerpt: line.trim().slice(0, 160) })
      }
    }
  }
  return out
}

/**
 * 递归扫整棵树。排除法,不是白名单法:除 `.git`/`node_modules`/`dist` 目录外,
 * **每个文件都读**。跳过绝不静默 —— 每次跳过都在返回数组里追加一条
 * `word: '__skipped__'` 的记录,消费方(Task 14 的导出流程)一旦看到这个
 * 哨兵词就知道该文件没有被内容扫描过,得自己决定要不要额外处理。
 * 纪律 #3 的精神是「守卫烂掉的标准路径是静默豁免」——不留痕的跳过等于悄悄开了个口子。
 *
 * 跳过的情形:
 *   ① 符号链接(不跟随,不管指向文件还是目录) —— 第二轮复审 Important:本仓
 *      `.claude/worktrees/NimoOS-Service` 是一个指向目录的符号链接。
 *      `readdirSync(..., {withFileTypes:true})` 内部用 lstat,`Dirent.isDirectory()`
 *      对符号链接返回 false(不跟随),会落进"文件"分支;而 `fs.statSync`/
 *      `fs.readFileSync` 默认跟随符号链接,对指向目录的链接跟读会直接抛
 *      `EISDIR` 崩掉整个扫描。改成先用 `Dirent.isSymbolicLink()` 识别并跳过 ——
 *      符号链接指向的真实内容如果本就在树内,会通过它的真实路径被正常扫到,
 *      不会因为跳过链接本身而漏扫。
 *   ② 体积超过 MAX_BYTES 的
 *   ③ 开头 8KB 判定为二进制的(looksBinary)
 *   ④ 任何 stat/read/readdir 失败的(权限问题、竞态删除等)—— 兜底 try/catch,绝不静默丢帧。
 *      第三轮复审顺带加固:目录本身的 `readdirSync` 之前没包 try/catch,子目录若在遍历
 *      途中被并发删除、或没有读权限,会像符号链接那次一样让整个 scanTree 崩掉;现在也
 *      计入 __skipped__。
 */
export function scanTree(rootDir) {
  const findings = []
  const skip = (rel, excerpt) => findings.push({ file: rel, word: '__skipped__', line: 0, excerpt })

  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      skip(path.relative(rootDir, dir) || '.', `目录读取失败,未扫描:${err.message}`)
      return
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(rootDir, abs)

      if (e.isSymbolicLink()) {
        skip(rel, '符号链接,未跟随、未扫描')
        continue
      }
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist') continue
        walk(abs)
        continue
      }

      let stat
      try {
        stat = fs.statSync(abs)
      } catch (err) {
        skip(rel, `stat 失败,未扫描:${err.message}`)
        continue
      }
      if (stat.size > MAX_BYTES) {
        skip(rel, `超过 ${MAX_BYTES} 字节上限,未扫描`)
        continue
      }

      let buf
      try {
        buf = fs.readFileSync(abs)
      } catch (err) {
        skip(rel, `读取失败,未扫描:${err.message}`)
        continue
      }
      if (looksBinary(buf)) {
        skip(rel, '判定为二进制,未扫描')
        continue
      }
      for (const f of scanText(rel, buf.toString('utf8'))) findings.push({ file: rel, ...f })
    }
  }
  walk(rootDir)
  return findings
}
