import { describe, it, expect } from 'vitest'
import { readDroppedEntries } from './dropEntries'

function fileEntry(name: string, fullPath: string, content = 'x') {
  const f = new File([content], name)
  return {
    isFile: true, isDirectory: false, name, fullPath,
    file: (cb: (f: File) => void) => cb(f),
  }
}
function dirEntry(name: string, fullPath: string, children: any[]) {
  let read = false
  return {
    isFile: false, isDirectory: true, name, fullPath,
    createReader: () => ({
      // Set the "already read" flag before invoking cb (not after): a real
      // readEntries callback is always async, but if a caller ever invokes it
      // synchronously and recurses from inside cb, setting the flag first
      // avoids a reentrant infinite loop here.
      readEntries: (cb: (e: any[]) => void) => { const wasRead = read; read = true; cb(wasRead ? [] : children) },
    }),
  }
}
function dtWithEntries(entries: any[]): any {
  return {
    items: entries.map((e) => ({ kind: 'file', webkitGetAsEntry: () => e })),
    files: [],
  }
}

describe('readDroppedEntries', () => {
  it('flattens a dropped folder, preserving relativePath (leading slash stripped)', async () => {
    const dt = dtWithEntries([
      dirEntry('MyFolder', '/MyFolder', [
        fileEntry('a.txt', '/MyFolder/a.txt'),
        dirEntry('sub', '/MyFolder/sub', [fileEntry('b.txt', '/MyFolder/sub/b.txt')]),
      ]),
    ])
    const out = await readDroppedEntries(dt)
    const rels = out.map((o) => o.relativePath).sort()
    expect(rels).toEqual(['MyFolder/a.txt', 'MyFolder/sub/b.txt'])
    expect(out[0].file).toBeInstanceOf(File)
  })

  it('does not filter hidden dotfiles or media files out of a dropped folder', async () => {
    // Unlike Photos' collectFilesFromDataTransfer, the file manager's drop path
    // must accept everything the OS handed it — no media-type allowlist, no
    // dotfile skip.
    const dt = dtWithEntries([
      dirEntry('Folder', '/Folder', [
        fileEntry('.hidden', '/Folder/.hidden'),
        fileEntry('photo.jpg', '/Folder/photo.jpg'),
        fileEntry('video.mp4', '/Folder/video.mp4'),
        fileEntry('notes.txt', '/Folder/notes.txt'),
      ]),
    ])
    const out = await readDroppedEntries(dt)
    const rels = out.map((o) => o.relativePath).sort()
    expect(rels).toEqual(['Folder/.hidden', 'Folder/notes.txt', 'Folder/photo.jpg', 'Folder/video.mp4'])
  })

  it('single dropped file → relativePath is the name', async () => {
    const dt = dtWithEntries([fileEntry('c.txt', '/c.txt')])
    const out = await readDroppedEntries(dt)
    expect(out).toHaveLength(1)
    expect(out[0].relativePath).toBe('c.txt')
  })

  it('falls back to flat dt.files when entries API unavailable', async () => {
    const f = new File(['x'], 'd.txt')
    const dt: any = { items: null, files: [f] }
    const out = await readDroppedEntries(dt)
    expect(out).toEqual([{ file: f, relativePath: 'd.txt' }])
  })

  it('null → empty', async () => {
    expect(await readDroppedEntries(null)).toEqual([])
  })
})
