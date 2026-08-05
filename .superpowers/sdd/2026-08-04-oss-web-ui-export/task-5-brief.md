### Task 5: `export.mjs` 编排骨架 + DELETE 表 + Service 内嵌 + 产出树测试基建

**Files:**
- Create: `oss/manifest.mjs`, `oss/export.mjs`, `oss/tree.test.mjs`
- Modify: 无

**Interfaces:**
- Consumes: `apply.mjs` 的 `checkClean`/`applyDelete`/`applyReplace`/`applyPatch`/`sha256`;`forbidden.mjs` 的 `scanTree`
- Produces:
  - `manifest.mjs` 导出 `DELETE: string[]`、`REPLACE: [] `(T10-T13 填)、`PATCH: []`(T6-T9 填)、`NEW_UI`/`SERVICE`/`OUT` 三个绝对路径常量、`DIRTY_ALLOW: RegExp[]`
  - `export.mjs` 支持 `--out <dir>`、`--skip-guard`、`--keep-temp`,把树建在临时目录并按需落盘
  - `oss/tree.test.mjs` 的 `buildTree()`:整个测试文件共用一次构建结果(`beforeAll`),后续任务往里加断言

本任务后,产出树已经是「删干净但还没打补丁」的形态 —— 还编译不过,这是预期的。守卫在 T14 才接进来。

- [ ] **Step 1: 写失败测试(产出树基建 + DELETE 断言)**

创建 `oss/tree.test.mjs`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const OSS = path.dirname(new URL(import.meta.url).pathname)
let tree

beforeAll(() => {
  tree = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-out-'))
  execFileSync('node', [path.join(OSS, 'export.mjs'), '--out', tree, '--skip-guard', '--no-commit'], {
    stdio: 'pipe', encoding: 'utf8',
  })
}, 180_000)
afterAll(() => fs.rmSync(tree, { recursive: true, force: true }))

const read = (rel) => fs.readFileSync(path.join(tree, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(tree, rel))

describe('类 1 · 整体删除', () => {
  it('oss/ 自己不在产物里', () => expect(exists('oss')).toBe(false))

  it('AI/相册/搜索的组件与 store 全没了', () => {
    for (const rel of [
      'src/home/components/SearchDialog.vue',
      'src/home/components/PhotoTile.vue',
      'src/home/components/widgets/AiWidget.vue',
      'src/home/stores/photos.ts',
      'src/home/apps/icons/photos.svg',
      'src/home/apps/icons/ai.svg',
      'src/files/viewers/audioTranscripts.ts',
      'src/files/viewers/speakerWave.ts',
      'src/settings/panels/FolderPermissionsPanel.vue',
      'src/settings/panels/folderPerm',
      'src/settings/util/folderPermissions.ts',
      'src/settings/util/folderPermissionsSnapshot.ts',
      'src/settings/util/folderPermissionsView.ts',
      'src/settings/util/folderBrowser.ts',        // E3:零消费方,改为整体删除
      'src/settings/util/folderBrowser.test.ts',
      'public/demo/fish_video_poster.jpg',
    ]) expect(exists(rel), rel).toBe(false)
  })

  it('保留面还在', () => {
    for (const rel of [
      'src/files/viewers/waveform.ts',                        // 真实波形,解码 PCM,不涉 AI
      'src/settings/panels/account/MemberFoldersView.vue',    // 成员文件夹授权
      'src/files/util/protect.ts',
      'src/apps/views/StorePage.vue',
      'scripts/deploy.sh',
      'public/widget-kit.css',
    ]) expect(exists(rel), rel).toBe(true)
  })

  it('文档与 AI 辅助开发痕迹整体不导出(E7/E8)', () => {
    expect(exists('docs')).toBe(false)
    expect(exists('CLAUDE.md')).toBe(false)
    expect(exists('design-export')).toBe(false)
  })
})

describe('内嵌共享包', () => {
  it('Service 落到 packages/service/,package.json 的 file: 指过去', () => {
    expect(exists('packages/service/src/index.ts')).toBe(true)
    expect(exists('packages/service/src/photos.ts')).toBe(false)
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@nimotech/nimoos-service']).toBe('file:./packages/service')
  })

  it('lockfile 里不再有 ../NimoOS-Service 路径', () => {
    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/tree.test.mjs`
Expected: FAIL —— `Cannot find module .../oss/export.mjs`

- [ ] **Step 3: 写 `oss/manifest.mjs`(DELETE 表 + 常量,REPLACE/PATCH 先留空)**

```js
import path from 'node:path'

// ⚠️ 关于范围(E10):用户 2026-08-04 拍板 —— sp7-photos / sp8-ai 两支在快照发布后
// 仍要合进 master。本清单目前只覆盖 master 上的 AI/相册残留面;两支合流后必须为
// src/photos/** 与 src/ai/** 两个完整功能区扩张(路由、i18n 分片、数十个测试文件)。
// 单源 + 导出脚本这套架构正是为此选的,不要退回一次性快照。

const HERE = path.dirname(new URL(import.meta.url).pathname)
export const OSS_DIR = HERE
export const NEW_UI = path.resolve(HERE, '..')
export const SERVICE = path.resolve(HERE, '../../NimoOS-Service')
export const DEFAULT_OUT = path.resolve(HERE, '../../NimoOS-Web')

// 主工作树 index 里长期躺着 3 个 design-export/* 的删除态,不属任何一方(spec §10.3)
export const DIRTY_ALLOW = [/design-export\//]

/** 类 1 · 整体删除。路径不存在即 exit 1(清单过期了要知道)。 */
export const DELETE = [
  'oss',                                  // 第一条:机制自己不进产物

  // 主页:搜索面板 / 照片磁贴 / AI 组件
  'src/home/components/SearchDialog.vue',
  'src/home/components/PhotoTile.vue',
  'src/home/components/widgets/AiWidget.vue',
  'src/home/stores/photos.ts',
  'src/home/apps/icons/photos.svg',
  'src/home/apps/icons/ai.svg',

  // 音频转录(waveform.ts 保留 —— 它解码 PCM 画真实波形,不涉 AI)
  'src/files/viewers/audioTranscripts.ts',
  'src/files/viewers/speakerWave.ts',

  // 设置「文件夹权限」整个 tab。folderBrowser 删完后零消费方(E3),一并删
  'src/settings/panels/FolderPermissionsPanel.vue',
  'src/settings/panels/folderPerm',
  'src/settings/util/folderPermissions.ts',
  'src/settings/util/folderPermissionsSnapshot.ts',
  'src/settings/util/folderPermissionsView.ts',
  'src/settings/util/folderBrowser.ts',
  'src/settings/util/folderBrowser.test.ts',

  // 文档 / AI 辅助开发痕迹 / 设计稿(E7/E8:用户拍板一份文档都不带)
  'docs',
  'CLAUDE.md',
  'design-export',

  // 搜索 demo 的鱼(SearchDialog 写死的 demo 素材)
  'public/demo/fish_video_poster.jpg',

  // 测试同步:整体删除的 9 个(T13 填齐;Service 侧的 photos.test.ts 在 SERVICE_DELETE)
]

/** Service 侧的整体删除(相对 packages/service/)。 */
export const SERVICE_DELETE = [
  'src/photos.ts',
  'src/photos.test.ts',
]

/** 类 2 · 整文件替换,各带私有侧哈希钉。T10-T13 填。 */
export const REPLACE = []

/** 类 3 · 锚点补丁。命中次数必须恰好 1 次。T6-T9 填。 */
export const PATCH = []

/** Service 侧的锚点补丁(相对 packages/service/)。T7 填。 */
export const SERVICE_PATCH = []
```

- [ ] **Step 4: 写 `oss/export.mjs`**

```js
#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  DELETE, SERVICE_DELETE, REPLACE, PATCH, SERVICE_PATCH,
  NEW_UI, SERVICE, DEFAULT_OUT, OSS_DIR, DIRTY_ALLOW,
} from './manifest.mjs'
import { checkClean, applyDelete, applyReplace, applyPatch } from './apply.mjs'
import { scanTree } from './forbidden.mjs'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const OUT = path.resolve(opt('--out', DEFAULT_OUT))
const SKIP_GUARD = flag('--skip-guard')
const NO_COMMIT = flag('--no-commit')
const KEEP_TEMP = flag('--keep-temp')

const log = (m) => console.log(`[oss] ${m}`)
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim()

// ── 1. 前置检查 ───────────────────────────────────────────────────────────
log('1/6 前置检查')
checkClean(NEW_UI, DIRTY_ALLOW)
checkClean(SERVICE, [])
const headNewUi = git(NEW_UI, 'rev-parse', 'HEAD')
const headService = git(SERVICE, 'rev-parse', 'HEAD')
log(`  New-UI ${headNewUi.slice(0, 8)} · Service ${headService.slice(0, 8)}`)

// ── 2. 取源(git archive:.git / node_modules / dist / .superpowers / tmlab 自动排除)──
log('2/6 取源')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-export-'))
const archiveInto = (repo, dest) => {
  fs.mkdirSync(dest, { recursive: true })
  execFileSync('sh', ['-c', `git -C '${repo}' archive HEAD | tar -x -C '${dest}'`])
}
archiveInto(NEW_UI, tmp)
const svcDir = path.join(tmp, 'packages/service')
archiveInto(SERVICE, svcDir)

try {
  // ── 3. 应用清单:顺序固定 DELETE → REPLACE → PATCH ──────────────────────
  log(`3/6 应用清单(DELETE ${DELETE.length} · REPLACE ${REPLACE.length} · PATCH ${PATCH.length})`)
  applyDelete(tmp, DELETE)
  applyDelete(svcDir, SERVICE_DELETE)
  applyReplace(tmp, REPLACE, path.join(OSS_DIR, 'files'))
  applyPatch(tmp, PATCH)
  applyPatch(svcDir, SERVICE_PATCH)

  // ── 4. 内嵌 Service:改 package.json 的 file: 一行 + lockfile 路径 ────────
  log('4/6 内嵌共享包')
  const pkgPath = path.join(tmp, 'package.json')
  const pkg = fs.readFileSync(pkgPath, 'utf8')
  const FROM = '"@nimotech/nimoos-service": "file:../NimoOS-Service"'
  const TO = '"@nimotech/nimoos-service": "file:./packages/service"'
  if (pkg.split(FROM).length - 1 !== 1) throw new Error(`package.json 的 file: 锚点未唯一命中:${FROM}`)
  fs.writeFileSync(pkgPath, pkg.replace(FROM, TO))
  const lockPath = path.join(tmp, 'pnpm-lock.yaml')
  const lock = fs.readFileSync(lockPath, 'utf8')
  if (!lock.includes('../NimoOS-Service')) throw new Error('pnpm-lock.yaml 里没有 ../NimoOS-Service,锚点已漂')
  fs.writeFileSync(
    lockPath,
    lock.replaceAll('file:../NimoOS-Service', 'file:packages/service')
        .replaceAll('directory: ../NimoOS-Service', 'directory: packages/service'),
  )

  // ── 5. 泄漏守卫(在临时目录上跑,不过就一个字节都不落盘)────────────────
  if (SKIP_GUARD) {
    log('5/6 泄漏守卫 —— 已用 --skip-guard 跳过(仅开发期允许)')
  } else {
    log('5/6 泄漏守卫')
    const findings = scanTree(tmp)
    if (findings.length) {
      for (const f of findings.slice(0, 60)) console.error(`  ✗ ${f.file}:${f.line} [${f.word}] ${f.excerpt}`)
      throw new Error(`泄漏守卫命中 ${findings.length} 处,一个字节都不落盘。` +
        `修法只有两条:真泄漏就补剥离清单;误报就往 forbidden.mjs 加**精确白名单** —— 禁止放宽词表。`)
    }
    log('  零命中')
  }

  // ── 6. 落盘 + 零历史提交 ────────────────────────────────────────────────
  log('6/6 落盘')
  fs.mkdirSync(OUT, { recursive: true })
  execFileSync('rsync', ['-a', '--delete', '--exclude', '.git', `${tmp}/`, `${OUT}/`])
  fs.writeFileSync(
    path.join(OUT, '.export-report.txt'),
    `NimoOS-New-UI HEAD: ${headNewUi}\nNimoOS-Service HEAD: ${headService}\n` +
    `DELETE ${DELETE.length} · REPLACE ${REPLACE.length} · PATCH ${PATCH.length}\n` +
    `⚠️ 本文件含私有仓 commit hash,已在 .gitignore 里,不进 git。\n`,
  )
  if (!NO_COMMIT) {
    if (!fs.existsSync(path.join(OUT, '.git'))) git(OUT, 'init', '-b', 'main')
    execFileSync('git', ['-C', OUT, 'add', '-A'])
    const has = execFileSync('sh', ['-c', `git -C '${OUT}' rev-list --count HEAD 2>/dev/null || echo 0`],
      { encoding: 'utf8' }).trim() !== '0'
    execFileSync('git', ['-C', OUT, 'commit', ...(has ? ['--amend'] : []), '--no-edit',
      ...(has ? [] : ['-m', 'NimoOS Web UI'])], { stdio: 'pipe' })
    const n = git(OUT, 'rev-list', '--count', 'HEAD')
    if (n !== '1') throw new Error(`零历史被破坏:rev-list --count HEAD = ${n},必须是 1`)
  }
  log(`完成 → ${OUT}`)
} finally {
  if (KEEP_TEMP) log(`临时目录保留:${tmp}`)
  else fs.rmSync(tmp, { recursive: true, force: true })
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run oss/tree.test.mjs`
Expected: PASS(2 个 describe / 6 例)。构建约 10–30 秒。

- [ ] **Step 6: 手工确认 DELETE 过期会响**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
node -e "
const m = require('node:fs');
let s = m.readFileSync('oss/manifest.mjs','utf8');
m.writeFileSync('/tmp/mf.bak', s);
m.writeFileSync('oss/manifest.mjs', s.replace(\"'docs',\", \"'docs', 'src/does-not-exist.ts',\"));
"
node oss/export.mjs --out /tmp/oss-probe --skip-guard --no-commit; echo "EXIT=$?"
cp /tmp/mf.bak oss/manifest.mjs
```

Expected:打印 `DELETE 清单过期:src/does-not-exist.ts 不存在`,`EXIT=1`,且 `/tmp/oss-probe` 未被创建或未被写入内容。

- [ ] **Step 7: 提交**

```bash
git add oss/manifest.mjs oss/export.mjs oss/tree.test.mjs
git commit -m "feat(oss): 导出编排骨架 + DELETE 表 + 共享包内嵌 + 产出树测试基建"
```

---

