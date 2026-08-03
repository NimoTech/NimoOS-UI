import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const OSS = path.dirname(new URL(import.meta.url).pathname)
let tree

beforeAll(() => {
  tree = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-out-'))
  execFileSync('node', [path.join(OSS, 'export.mjs'), '--out', tree, '--skip-guard', '--no-commit', '--allow-dirty-oss'], {
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

describe('类 3 · 桌面侧补丁', () => {
  it('系统应用清单只剩 5 个,photos/ai 的 import 与 glyph 都没了', () => {
    const s = read('src/home/apps/systemApps.ts')
    expect(s).not.toMatch(/photos|iconAi|G\.ai/)
    expect(s.match(/\{ key: '/g)).toHaveLength(5)
    for (const k of ['files', 'storage', 'vm', 'settings', 'appstore']) expect(s).toContain(`key: '${k}'`)
  })

  it('Dock 默认收藏 = files/storage/vm/appstore', () => {
    expect(read('src/home/composables/useDock.ts'))
      .toContain("const DEFAULT_FAV = ['files', 'storage', 'vm', 'appstore']")
  })

  it('SYS_ROUTE 指内部路由,cutoverDisabled 恒 false,sendToAI 整个没了', () => {
    const s = read('src/home/composables/useOpenAction.ts')
    expect(s).toContain("vm: '/kvm', settings: '/settings'")
    expect(s).not.toMatch(/sendToAI|'#\/photos'|ai\/agent|strangler:disabled/)
    expect(s).toContain('function cutoverDisabled(): boolean { return false }')
  })

  it("Kind 联合类型去掉 'photo'", () => {
    expect(read('src/home/grid/types.ts'))
      .toContain("export type Kind = 'widget' | 'app' | 'folder' | 'appwidget'")
  })

  it('小组件注册表与 WidgetCard 不再有 ai', () => {
    expect(read('src/home/widgets/registry.ts')).not.toMatch(/\bai:/)
    expect(read('src/home/components/widgets/WidgetCard.vue')).not.toMatch(/AiWidget/)
  })

  it('GridItem / MobileHome 不再引用 PhotoTile', () => {
    for (const rel of ['src/home/components/GridItem.vue', 'src/home/components/MobileHome.vue']) {
      expect(read(rel), rel).not.toMatch(/PhotoTile|'photo'|m-photo/)
    }
  })

  it('layout store 去掉 bindPhotos,homeUi 去掉 search 四项', () => {
    expect(read('src/home/stores/layout.ts')).not.toMatch(/bindPhotos/)
    const h = read('src/home/stores/homeUi.ts')
    expect(h).not.toMatch(/searchOpen|setSearch|openSearch|closeSearch/)
  })

  it('顶栏没有搜索胶囊与 ⌘K 监听,Home.vue 不挂 SearchDialog', () => {
    const t = read('src/home/components/HomeTopbar.vue')
    expect(t).not.toMatch(/search-btn|topbarSearch|metaKey/)
    const h = read('src/views/Home.vue')
    expect(h).not.toMatch(/SearchDialog|usePhotosStore|loadAssets|bindPhotos/)
  })

  it('AddPanel 的 tab 联合类型与尺寸表去掉 photo', () => {
    const a = read('src/home/composables/useAddPanel.ts')
    expect(a).toContain("const curTab = ref<'widget' | 'app' | 'folder'>('widget')")
    expect(a).not.toMatch(/'photo'/)
  })

  it('复审修复:顶栏 ≤720px 注释不再提"搜索",且没有死 import', () => {
    const t = read('src/home/components/HomeTopbar.vue')
    expect(t).not.toMatch(/搜索/)
    expect(t).toContain('保留主题切换')
    expect(t).not.toMatch(/onMounted|onUnmounted/)
  })

  it('复审修复:layout.ts 不再 import isAssetId', () => {
    expect(read('src/home/stores/layout.ts')).not.toMatch(/isAssetId/)
  })
})
