import { describe, it, expect, afterEach } from 'vitest'
import { readPickedDirectory, supportsDirectoryPicker, type DirectoryHandleLike } from './dirPicker'

// Minimal stand-ins for FileSystemDirectoryHandle / FileSystemFileHandle. Only the
// three members the walk actually touches are modelled: kind, name and values()/getFile().
function fileHandle(name: string, body = 'x') {
  return { kind: 'file' as const, name, getFile: async () => new File([body], name) }
}
function dirHandle(name: string, children: any[] = []): DirectoryHandleLike {
  return {
    kind: 'directory',
    name,
    async *values() { for (const c of children) yield c },
  } as unknown as DirectoryHandleLike
}

describe('supportsDirectoryPicker', () => {
  afterEach(() => { delete (globalThis as any).showDirectoryPicker })

  it('is false when the File System Access API is absent (plain-HTTP LAN origin)', () => {
    delete (globalThis as any).showDirectoryPicker
    expect(supportsDirectoryPicker()).toBe(false)
  })

  it('is true only when showDirectoryPicker is actually callable', () => {
    ;(globalThis as any).showDirectoryPicker = undefined
    expect(supportsDirectoryPicker()).toBe(false)
    ;(globalThis as any).showDirectoryPicker = async () => ({})
    expect(supportsDirectoryPicker()).toBe(true)
  })
})

describe('readPickedDirectory', () => {
  // The whole point of this entry point: an empty folder is representable here,
  // which <input webkitdirectory> can never do.
  it('reports an empty picked folder as an empty dir, not as an empty batch', async () => {
    const tree = await readPickedDirectory(dirHandle('MyFolder'))
    expect(tree.files).toEqual([])
    expect(tree.emptyDirs).toEqual(['MyFolder'])
  })

  it('prefixes relativePath with the picked folder name, like webkitRelativePath does', async () => {
    const tree = await readPickedDirectory(dirHandle('MyFolder', [fileHandle('a.txt'), fileHandle('b.txt')]))
    expect(tree.files.map((f) => f.relativePath)).toEqual(['MyFolder/a.txt', 'MyFolder/b.txt'])
    expect(tree.files[0].file.name).toBe('a.txt')
    expect(tree.emptyDirs).toEqual([])
  })

  it('recurses into subdirectories and keeps empty ones', async () => {
    const tree = await readPickedDirectory(dirHandle('Root', [
      fileHandle('top.txt'),
      dirHandle('sub-empty'),
      dirHandle('sub-with-file', [fileHandle('deep.txt')]),
    ]))
    expect(tree.files.map((f) => f.relativePath)).toEqual(['Root/top.txt', 'Root/sub-with-file/deep.txt'])
    expect(tree.emptyDirs).toEqual(['Root/sub-empty'])
  })

  it('records only the leaf empty dir — a parent that contains it is not itself empty', async () => {
    const tree = await readPickedDirectory(dirHandle('Root', [dirHandle('mid', [dirHandle('leaf')])]))
    expect(tree.files).toEqual([])
    expect(tree.emptyDirs).toEqual(['Root/mid/leaf'])
  })

  it('skips a file whose bytes cannot be read rather than aborting the whole batch', async () => {
    const bad = { kind: 'file' as const, name: 'locked.txt', getFile: async () => { throw new Error('NotReadableError') } }
    const tree = await readPickedDirectory(dirHandle('Root', [bad, fileHandle('ok.txt')]))
    expect(tree.files.map((f) => f.relativePath)).toEqual(['Root/ok.txt'])
  })
})
