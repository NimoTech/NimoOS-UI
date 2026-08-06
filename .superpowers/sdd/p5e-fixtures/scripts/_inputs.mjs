/* P5e T0/T0b —— 所有分析脚本的共享输入层。
 *
 * 由 T0b 整改轮新增(评审 Important-3:8 个脚本 7 个 ENOENT,因为它们依赖
 * T0 当时留在 /tmp 暂存区的中间产物)。现在每个输入都**自己现取**:
 *   · 蓝本文件  → git -C <NimoOS-UI> show 7a6ee6b7:<path>   (不落会漂的副本)
 *   · 本仓文件  → 直接读工作树
 *   · i18n 全表 → esbuild 转译 .ts 后 **真实模块导入**(治理 §9.3-2:文本解析会少算)
 *
 * ⇒ 从干净检出 `node <script>` 即可跑通,零手工准备。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const SCRIPTS = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURES = path.resolve(SCRIPTS, '..')
export const REPO = path.resolve(SCRIPTS, '../../../..')      // .sp8/NimoOS-New-UI
export const BLUEPRINT_SHA = '7a6ee6b7'                        // P5 全期锁定(用户裁定 U-2)

function findUpstream() {
  const cands = [
    process.env.NIMOOS_UI_DIR,
    path.resolve(REPO, '../../NimoOS-UI'),                     // /home/nimo/NimoTech/NimoOS-UI
    path.resolve(REPO, '../NimoOS-UI'),
  ].filter(Boolean)
  for (const c of cands) if (fs.existsSync(path.join(c, '.git'))) return c
  throw new Error(`找不到只读蓝本仓 NimoOS-UI。试过:\n  ${cands.join('\n  ')}\n可用 NIMOOS_UI_DIR=<path> 指定。`)
}
export const UPSTREAM = findUpstream()

const CACHE = path.join(os.tmpdir(), `p5e-bp-${BLUEPRINT_SHA}`)

/** 蓝本文件内容(只读 git object,永不 checkout —— 那个仓被 SP7/SP9 并发会话共用)。 */
export function bp(relPath) {
  const flat = path.join(CACHE, relPath.replace(/[\/]/g, '_'))
  if (!fs.existsSync(flat)) {
    fs.mkdirSync(CACHE, { recursive: true })
    const buf = execFileSync('git', ['-C', UPSTREAM, 'show', `${BLUEPRINT_SHA}:${relPath}`], { maxBuffer: 64 * 1024 * 1024 })
    fs.writeFileSync(flat, buf)
  }
  return fs.readFileSync(flat, 'utf8')
}

const K = 'src/views/AI/Knowledge'
export const BP_PATHS = {
  scss: `${K}/styles/knowledge.scss`,
  searchView: `${K}/SearchView.vue`,
  fileDetailDrawer: `${K}/components/FileDetailDrawer.vue`,
  kFileViewer: `${K}/components/KFileViewer.vue`,
  searchAggregate: `${K}/searchAggregate.js`,
  zhJson: 'src/assets/lang/zh_CN.json',
  enJson: 'src/assets/lang/en_US.json',
}

/** 蓝本 Knowledge + Parser 下全部 .vue / .js(排除 __tests__),给 i18n 扫描用。 */
export function bpKnowledgeFiles() {
  const out = execFileSync('git', ['-C', UPSTREAM, 'ls-tree', '-r', '--name-only', BLUEPRINT_SHA,
    'src/views/AI/Knowledge', 'src/views/AI/Parser'], { encoding: 'utf8' })
  return out.split('\n').filter((f) => /\.(vue|js)$/.test(f) && !f.includes('__tests__'))
    .map((f) => ({ path: f, name: f.replace(/[\/]/g, '_'), text: bp(f) }))
}

/** 本仓文件。 */
export const nu = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8')

/** 与 knowledgeStyles.test.ts:24-28 逐字相同的注释剥除。 */
export const stripComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** 本仓 i18n 全表 —— esbuild 转译后**真实模块导入**(不是文本解析)。 */
export async function i18nTables() {
  const esbuild = [
    path.join(REPO, 'node_modules/.pnpm/node_modules/.bin/esbuild'),
    path.join(REPO, 'node_modules/.bin/esbuild'),
  ].find((p) => fs.existsSync(p))
  if (!esbuild) throw new Error('找不到 esbuild(应在 node_modules/.pnpm/node_modules/.bin/esbuild)。先在仓根 `pnpm install`。')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p5e-i18n-'))
  const load = async (which) => {
    const outFile = path.join(dir, `${which}.mjs`)
    execFileSync(esbuild, [path.join(REPO, `src/i18n/${which}.ts`), '--format=esm', '--platform=node', `--outfile=${outFile}`], { stdio: 'pipe' })
    return (await import(`file://${outFile}`)).default
  }
  return { zh: await load('zh_cn'), en: await load('en_us') }
}
