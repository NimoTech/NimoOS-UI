import { describe, it, expect } from 'vitest'
import { scanText } from './forbidden.mjs'

describe('硬禁词', () => {
  it('相册 / Nimo AI / transcript / qdrant / 内网 IP 一律命中,不给白名单', () => {
    for (const [file, text] of [
      ['src/x.ts', '// 打开相册'],
      ['src/x.ts', "t('Nimo AI')"],
      ['src/x.ts', 'import { lookupTranscript } from "./audioTranscripts"'],
      ['src/x.ts', 'const q = "qdrant"'],
      ['src/x.vue', 'http://192.168.1.115/v1'],
      ['src/x.ts', 'immich-ml'],
    ]) {
      expect(scanText(file, text).length, `${file} :: ${text}`).toBeGreaterThan(0)
    }
  })
})

describe('软禁词的精确白名单', () => {
  it('保留面不许误报', () => {
    const keep = [
      ['src/files/util/fileCategories.ts', "export const APPLICATION_PHOTOSHOP = ['psd','psb']"],
      ['src/files/util/icons.ts', "Gallery: 'folder-pictures',"],
      ['src/files/util/protect.ts', "'/DATA/Gallery',"],
      ['src/settings/util/migrateBrowse.ts', "const SYS = ['Gallery']"],
      ['src/apps/views/StorePage.vue', "route.query.search as string"],
      ['src/apps/views/StorePage.vue', 'const searchInput = ref("")'],
      // E5:局部变量 ai = anchorIndex,会被 \bai\b 硬词误伤
      ['src/files/stores/files.ts', 'const ai = list.findIndex((e) => e.path === anchor)'],
      // E6:Vue2 逐字移植的路径归一 + 系统目录显示串
      ['src/apps/util/importNormalize.ts', "{ keywords: ['pictures', 'photo'], value: '/DATA/Gallery' },"],
      ['src/settings/panels/AppsPanel.vue', 'return `${virtual}/Documents & Downloads & Gallery & Media`'],
      // E4:成员文件夹授权的类型名,必须保留
      ['src/settings/panels/account/MemberFoldersView.vue', 'type UserFolderPermission } from "@nimotech/nimoos-service"'],
      ['packages/service/src/types.ts', 'export interface UserFolderPermission {'],
      // 保留的波形 token
      ['src/files/viewers/MediaViewer.vue', "return 'var(--wave-none)'"],
    ]
    for (const [file, text] of keep) {
      expect(scanText(file, text), `${file} :: ${text}`).toEqual([])
    }
  })

  it('白名单是按文件限定的 —— 同一串出现在别的文件里仍然报', () => {
    expect(scanText('src/home/components/Foo.vue', 'const searchInput = ref("")').length).toBeGreaterThan(0)
  })

  it('speaker 是哨兵:拆完应零命中', () => {
    expect(scanText('src/files/viewers/MediaViewer.vue', 'function speakerColor(id) {}').length).toBeGreaterThan(0)
  })

  it('词边界:parse / chain / main / 中文不被误伤', () => {
    for (const [file, text] of [
      ['src/x.ts', 'JSON.parse(raw)'],
      ['src/x.ts', 'const chain = []'],
      ['src/x.ts', 'export function main() {}'],
      ['src/x.ts', '// 布局重排'],
    ]) {
      expect(scanText(file, text), text).toEqual([])
    }
  })
})
