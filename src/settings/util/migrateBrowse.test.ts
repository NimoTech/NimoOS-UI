import { describe, it, expect } from 'vitest'
import {
  browseRootPath, browseDestPaths, browseCrumbs, filterBrowseFolders,
  isProtectedFolder, parentPath,
} from './migrateBrowse'
import type { FolderEntry } from '@nimotech/nimoos-service'

const DN = { '/DATA': 'NimoOS-HD', '/media/Backup': 'Backup' }

describe('browseRootPath', () => {
  it('系统盘(挂载点 /)限制在 /DATA,不让用户看到 / 下的兄弟目录', () => {
    expect(browseRootPath('/')).toBe('/DATA')
  })
  it('其它分区就是挂载点本身', () => {
    expect(browseRootPath('/media/Backup')).toBe('/media/Backup')
  })
})

describe('browseDestPaths —— 与 migrate.go 追加的子目录逐字一致', () => {
  it('app_data → 单个 AppData', () => {
    expect(browseDestPaths('app_data', '/media/Backup')).toEqual(['/media/Backup/AppData'])
  })
  it('images → .docker 与 .containerd 两个', () => {
    expect(browseDestPaths('images', '/media/Backup')).toEqual([
      '/media/Backup/.docker', '/media/Backup/.containerd',
    ])
  })
  it('database → 四个用户目录', () => {
    expect(browseDestPaths('database', '/media/Backup')).toEqual([
      '/media/Backup/Documents', '/media/Backup/Downloads',
      '/media/Backup/Gallery', '/media/Backup/Media',
    ])
  })
  it('base 尾部斜杠被吃掉,不产生 //', () => {
    expect(browseDestPaths('app_data', '/media/Backup/')).toEqual(['/media/Backup/AppData'])
  })
})

describe('browseCrumbs', () => {
  it('根用 displayNames 的显示名,后续段用目录名', () => {
    expect(browseCrumbs('/DATA', '/DATA/a/b', DN)).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
      { name: 'a', path: '/DATA/a' },
      { name: 'b', path: '/DATA/a/b' },
    ])
  })
  it('current 就是 root 时只有一段', () => {
    expect(browseCrumbs('/DATA', '/DATA', DN)).toEqual([{ name: 'NimoOS-HD', path: '/DATA' }])
  })
  it('current 不在 root 之下时返回空数组(防越权渲染)', () => {
    expect(browseCrumbs('/DATA', '/etc', DN)).toEqual([])
  })
  it('displayNames 里没有该根时回退最后一段目录名', () => {
    expect(browseCrumbs('/media/X', '/media/X', {})).toEqual([{ name: 'X', path: '/media/X' }])
  })
})

describe('filterBrowseFolders', () => {
  const mk = (name: string, path: string, extra: Partial<FolderEntry> = {}): FolderEntry =>
    ({ name, path, is_dir: true, is_symlink: false, ...extra })
  const items: FolderEntry[] = [
    mk('AppData', '/DATA/AppData'),
    mk('AppDataOld', '/DATA/AppDataOld'),
    mk('Documents', '/DATA/Documents'),
    mk('.docker', '/DATA/.docker'),
    mk('.hidden', '/DATA/.hidden'),
    mk('link', '/DATA/link', { is_symlink: true }),
    mk('readme.txt', '/DATA/readme.txt', { is_dir: false }),
    mk('Backup', '/DATA/Backup'),
  ]
  it('只留真目录:排除文件、符号链接、点开头', () => {
    const names = filterBrowseFolders(items, 'app_data', '/media/Other').map((f) => f.name)
    expect(names).toContain('Backup')
    expect(names).not.toContain('readme.txt')
    expect(names).not.toContain('link')
    expect(names).not.toContain('.hidden')
  })
  it('迁 app_data 时不屏蔽 AppData,但屏蔽 Documents 等其它类型的目标名', () => {
    const names = filterBrowseFolders(items, 'app_data', '/media/Other').map((f) => f.name)
    expect(names).toContain('AppData')
    expect(names).not.toContain('Documents')
  })
  it('迁 database 时屏蔽 AppData,保留 Documents', () => {
    const names = filterBrowseFolders(items, 'database', '/media/Other').map((f) => f.name)
    expect(names).not.toContain('AppData')
    expect(names).toContain('Documents')
  })
  it('把源路径自身及其子树排除掉(不能迁到自己里面)', () => {
    const names = filterBrowseFolders(items, 'app_data', '/DATA/AppData').map((f) => f.name)
    expect(names).not.toContain('AppData')
  })
  it('只排除源路径自身及其子树,不误伤名字相近的兄弟目录(/DATA/AppDataOld 不属于 /DATA/AppData)', () => {
    const names = filterBrowseFolders(items, 'app_data', '/DATA/AppData').map((f) => f.name)
    expect(names).not.toContain('AppData')      // 源目录自身仍被排除
    expect(names).toContain('AppDataOld')       // 兄弟目录不该被牵连
  })
})

describe('isProtectedFolder —— 与后端 isProtectedName 名单一致', () => {
  it.each(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd'])(
    '%s 受保护(不许重命名/删除)', (n) => expect(isProtectedFolder(n)).toBe(true),
  )
  it('普通目录不受保护', () => expect(isProtectedFolder('Backup')).toBe(false))
})

describe('parentPath', () => {
  it('回到父目录', () => expect(parentPath('/DATA/a/b', '/DATA')).toBe('/DATA/a'))
  it('已经在根就停在根', () => expect(parentPath('/DATA', '/DATA')).toBe('/DATA'))
  it('不会越过根', () => expect(parentPath('/DATA/a', '/DATA')).toBe('/DATA'))
})
