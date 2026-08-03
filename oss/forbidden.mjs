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
  ['photos_data', /photos_data/],
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
    re: /(?<![A-Za-z])ai(?![A-Za-z])/,              // 词边界:不碰中文、chain、main
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

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.vue', '.css', '.scss', '.json', '.yaml', '.yml',
  '.md', '.html', '.svg', '.sh', '.txt', '.gitignore',
])

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

/** 递归扫整棵树。二进制文件按扩展名跳过(图片资源靠 DELETE 表管)。 */
export function scanTree(rootDir) {
  const findings = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(rootDir, abs)
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist') continue
        walk(abs)
      } else if (TEXT_EXT.has(path.extname(e.name)) || e.name.startsWith('.git')) {
        for (const f of scanText(rel, fs.readFileSync(abs, 'utf8'))) findings.push({ file: rel, ...f })
      }
    }
  }
  walk(rootDir)
  return findings
}
