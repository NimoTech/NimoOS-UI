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
].map(([word, re]) => ({ word, re }))

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
  {
    word: 'ai',
    // 词边界:不碰中文、chain、main、Chairman。评审 Important #1:原正则没有大小写标志,
    // 独立大写 AI(类名、注释、i18n 文案里最常见的书写形态)完全漏检。
    // 不能简单套用整条 /i 标志了事 —— 那样 [A-Za-z] 类里的大小写区分也会被吃掉,
    // 导致 "AIService" 这种「大写缩写 + 新 PascalCase 单词」永远匹配不到(见 alt2)。
    // 两条子规则用显式大小写字符类拼接,只在需要的地方做大小写不敏感:
    //   alt1:独立词 ai/AI/Ai/aI(前后都不挨字母)—— 覆盖 "AI 总结"、"AI-powered"、"const ai ="
    //   alt2:精确 "AI"(全大写)后面紧跟一个大写字母 —— 覆盖 "AIService" 这种缩写紧贴新词、
    //        中间没有分隔符的写法(camelCase/PascalCase 惯例里这就是词边界)
    re: /(?<![A-Za-z])[Aa][Ii](?![A-Za-z])|(?<![a-zA-Z])AI(?=[A-Z])/,
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
 * **每个文件都读**。只跳过两类,且跳过绝不静默 —— 每次跳过都在返回数组里追加
 * 一条 `word: '__skipped__'` 的记录,消费方(Task 14 的导出流程)一旦看到这个
 * 哨兵词就知道该文件没有被内容扫描过,得自己决定要不要额外处理。
 * 纪律 #3 的精神是「守卫烂掉的标准路径是静默豁免」——不留痕的跳过等于悄悄开了个口子。
 *
 *   ① 体积超过 MAX_BYTES 的
 *   ② 开头 8KB 判定为二进制的(looksBinary)
 */
export function scanTree(rootDir) {
  const findings = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(rootDir, abs)
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist') continue
        walk(abs)
        continue
      }
      const stat = fs.statSync(abs)
      if (stat.size > MAX_BYTES) {
        findings.push({ file: rel, word: '__skipped__', line: 0, excerpt: `超过 ${MAX_BYTES} 字节上限,未扫描` })
        continue
      }
      const buf = fs.readFileSync(abs)
      if (looksBinary(buf)) {
        findings.push({ file: rel, word: '__skipped__', line: 0, excerpt: '判定为二进制,未扫描' })
        continue
      }
      for (const f of scanText(rel, buf.toString('utf8'))) findings.push({ file: rel, ...f })
    }
  }
  walk(rootDir)
  return findings
}
