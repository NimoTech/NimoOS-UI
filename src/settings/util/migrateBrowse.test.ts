import { describe, it, expect } from 'vitest'
import {
  browseRootPath, browseDestPaths, browseCrumbs, filterBrowseFolders,
  isProtectedFolder, parentPath,
} from './migrateBrowse'
import type { FolderEntry } from '@nimotech/nimoos-service'

const DN = { '/DATA': 'NimoOS-HD', '/media/Backup': 'Backup' }

describe('browseRootPath', () => {
  it('the system disk (mount point /) is restricted to /DATA, so the user cannot see sibling directories under /', () => {
    expect(browseRootPath('/')).toBe('/DATA')
  })
  it('other partitions use the mount point itself', () => {
    expect(browseRootPath('/media/Backup')).toBe('/media/Backup')
  })
})

describe('browseDestPaths — matches the subdirectories appended by migrate.go verbatim', () => {
  it('app_data → a single AppData', () => {
    expect(browseDestPaths('app_data', '/media/Backup')).toEqual(['/media/Backup/AppData'])
  })
  it('images → both .docker and .containerd', () => {
    expect(browseDestPaths('images', '/media/Backup')).toEqual([
      '/media/Backup/.docker', '/media/Backup/.containerd',
    ])
  })
  it('database → four user directories', () => {
    expect(browseDestPaths('database', '/media/Backup')).toEqual([
      '/media/Backup/Documents', '/media/Backup/Downloads',
      '/media/Backup/Gallery', '/media/Backup/Media',
    ])
  })
  it('trailing slash in base is stripped, does not produce //', () => {
    expect(browseDestPaths('app_data', '/media/Backup/')).toEqual(['/media/Backup/AppData'])
  })
  it('points the photos cache at <target>/.system_data/photos (matches migrate.go)', () => {
    expect(browseDestPaths('photos_data', '/media/Backup')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
    expect(browseDestPaths('photos_data', '/media/Backup/')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
  })
})

describe('browseCrumbs', () => {
  it('the root uses the display name from displayNames, later segments use directory names', () => {
    expect(browseCrumbs('/DATA', '/DATA/a/b', DN)).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
      { name: 'a', path: '/DATA/a' },
      { name: 'b', path: '/DATA/a/b' },
    ])
  })
  it('has only one segment when current is the root', () => {
    expect(browseCrumbs('/DATA', '/DATA', DN)).toEqual([{ name: 'NimoOS-HD', path: '/DATA' }])
  })
  it('returns an empty array when current is not under root (prevents rendering out-of-scope paths)', () => {
    expect(browseCrumbs('/DATA', '/etc', DN)).toEqual([])
  })
  it('falls back to the last path segment when displayNames has no entry for the root', () => {
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
  it('keeps only real directories: excludes files, symlinks, and dot-prefixed entries', () => {
    const names = filterBrowseFolders(items, 'app_data', '/media/Other').map((f) => f.name)
    expect(names).toContain('Backup')
    expect(names).not.toContain('readme.txt')
    expect(names).not.toContain('link')
    expect(names).not.toContain('.hidden')
  })
  it('migrating app_data does not block AppData, but blocks target names of other types like Documents', () => {
    const names = filterBrowseFolders(items, 'app_data', '/media/Other').map((f) => f.name)
    expect(names).toContain('AppData')
    expect(names).not.toContain('Documents')
  })
  it('migrating database blocks AppData, keeps Documents', () => {
    const names = filterBrowseFolders(items, 'database', '/media/Other').map((f) => f.name)
    expect(names).not.toContain('AppData')
    expect(names).toContain('Documents')
  })
  it('excludes the source path itself and its subtree (cannot migrate into itself)', () => {
    const names = filterBrowseFolders(items, 'app_data', '/DATA/AppData').map((f) => f.name)
    expect(names).not.toContain('AppData')
  })
  it('only excludes the source path itself and its subtree, without catching similarly named sibling directories (/DATA/AppDataOld is not part of /DATA/AppData)', () => {
    const names = filterBrowseFolders(items, 'app_data', '/DATA/AppData').map((f) => f.name)
    expect(names).not.toContain('AppData')      // The source directory itself is still excluded
    expect(names).toContain('AppDataOld')       // Sibling directories must not be caught up in it
  })
  it('drops dot-prefixed folders before the blocked list is ever consulted (Vue2 #105)', () => {
    // #105 found the dot entries in the blocked list to be dead code: the dot filter
    // below already removed them. Same holds here, which is why photos_data adds no
    // `.system_data` entry to `blocked`.
    const items = [
      mk('.system_data', '/DATA/.system_data'),
      mk('.docker', '/DATA/.docker'),
      mk('Backup', '/DATA/Backup'),
    ]
    for (const type of ['app_data', 'images', 'database', 'photos_data'] as const) {
      expect(filterBrowseFolders(items, type, '').map((i) => i.name)).toEqual(['Backup'])
    }
  })
})

describe('isProtectedFolder — matches the backend isProtectedName list', () => {
  it.each(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd'])(
    '%s is protected (rename/delete not allowed)', (n) => expect(isProtectedFolder(n)).toBe(true),
  )
  it('an ordinary directory is not protected', () => expect(isProtectedFolder('Backup')).toBe(false))
})

describe('parentPath', () => {
  it('goes back to the parent directory', () => expect(parentPath('/DATA/a/b', '/DATA')).toBe('/DATA/a'))
  it('stays at the root once already there', () => expect(parentPath('/DATA', '/DATA')).toBe('/DATA'))
  it('never goes above the root', () => expect(parentPath('/DATA/a', '/DATA')).toBe('/DATA'))
})
