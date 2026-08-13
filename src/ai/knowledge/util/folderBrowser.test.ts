// SP8-P5c Task 3 (part 1) — unit tests for `util/folderBrowser.ts` three pure functions.
// Blueprint `NimoOS-UI` (main@7a6ee6b7) `src/components/common/folderBrowser.js:3-34`.
//
// [Data source for end-to-end test case] `data.content` layer of `folder-list-DATA.json`
// (18 items) **copied verbatim into this file** (see FIXTURE-COPY block below),
// not reading that directory at runtime — coordinator ruling (see T3 report §8):
// `.superpowers/` covered by gitignore, enters repo only via `git add -f`, SP7 lost
// entire directory once; tests under `src/` cross-depend on it, once merged without it
// or someone runs `git clean -X`, mysteriously dies with "file not found". Governance §4
// "forbid hand-written" means "don't invent data by imagination" (memory
// `newui-fixture-from-imagination-trap`), copy + cite source also satisfies + test
// self-contained. Copy-blueprint original equivalence verified programmatically by
// one-off script (report §9). Expected values (12 dir names and their `localeCompare`
// order) are **hardcoded literals**, not computed from copy — else assertion
// self-fulfills, losing discriminative power.
import { describe, it, expect } from 'vitest'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { crumbsFor, dirEntries, pickerRoots } from './folderBrowser'

/**
 * `GET /v1/folder?path=/DATA` 每一项的原文形状(11 个字段,顺序与后端一致)。
 * 逐字取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`(2026-08-03 真机抓取)。
 */
interface RawFolderItem {
  name: string
  size: number
  is_dir: boolean
  is_symlink: boolean
  modified: string
  sign: string
  thumb: string
  type: number
  path: string
  date: string
  extensions: null
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE-COPY-BEGIN  ——  folder-list-DATA.json 的 data.content(18 项)
// 取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`(2026-08-03 真机抓取),
// 逐字抄入以免测试跨界依赖 gitignore 目录 —— 协调者裁定,见 T3 报告 §8。
// 🔴 那份 fixture 是 **HTTP 原文的三层信封**
//   `{success,message,data:{content:[…18 项…],total,index,size}}`;
//   这里抄的是 **`data.content` 那一层**(= `unwrap()` 之后 `service.folder.getList()`
//   给出的 `{ content }` 里的数组本身)。这个降层动作就是 K28 的落地证据。
// 🔴 字段一个没精简、顺序一个没改;等价性由一次性脚本程序化校验(报告 §9)。
// ─────────────────────────────────────────────────────────────────────────────
const DATA_CONTENT: RawFolderItem[] = [
  {"name": ".snapshots", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T22:08:06.07507098+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.snapshots", "date": "2026-07-30T22:08:06.07507098+08:00", "extensions": null},
  {"name": ".system_data", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T22:16:28.530622772+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.system_data", "date": "2026-07-30T22:16:28.530622772+08:00", "extensions": null},
  {"name": ".wiki.md", "size": 2558, "is_dir": false, "is_symlink": false, "modified": "2026-07-31T17:06:29.558792532+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.wiki.md", "date": "2026-07-31T17:06:29.558792532+08:00", "extensions": null},
  {"name": "Amalfi Coast", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-07T12:19:56.792668321+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Amalfi Coast", "date": "2026-07-07T12:19:56.792668321+08:00", "extensions": null},
  {"name": "AppData", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-23T11:23:08.733979447+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/AppData", "date": "2026-07-23T11:23:08.733979447+08:00", "extensions": null},
  {"name": "Documents", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-22T17:03:25.553912817+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Documents", "date": "2026-07-22T17:03:25.553912817+08:00", "extensions": null},
  {"name": "Downloads", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2022-07-06T09:00:46.243995396+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Downloads", "date": "2022-07-06T09:00:46.243995396+08:00", "extensions": null},
  {"name": "Gallery", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-23T14:37:56.926239751+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Gallery", "date": "2026-07-23T14:37:56.926239751+08:00", "extensions": null},
  {"name": "Image", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T18:18:59.58279995+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Image", "date": "2026-07-30T18:18:59.58279995+08:00", "extensions": null},
  {"name": "KVM", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T20:33:51.818325425+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/KVM", "date": "2026-07-30T20:33:51.818325425+08:00", "extensions": null},
  {"name": "Media", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-21T14:29:41.551348808+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Media", "date": "2026-07-21T14:29:41.551348808+08:00", "extensions": null},
  {"name": "NIMO", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-04T10:56:17.701403032+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/NIMO", "date": "2026-07-04T10:56:17.701403032+08:00", "extensions": null},
  {"name": "Notes", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-18T16:05:53.980766082+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Notes", "date": "2026-07-18T16:05:53.980766082+08:00", "extensions": null},
  {"name": "lost+found", "size": 16384, "is_dir": true, "is_symlink": false, "modified": "2022-07-06T08:56:00+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/lost+found", "date": "2022-07-06T08:56:00+08:00", "extensions": null},
  {"name": "nimo.tar.gz", "size": 12886696675, "is_dir": false, "is_symlink": false, "modified": "2026-06-12T11:49:39.693706674+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/nimo.tar.gz", "date": "2026-06-12T11:49:39.693706674+08:00", "extensions": null},
  {"name": "todo-widget", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-18T15:29:16.289637517+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/todo-widget", "date": "2026-07-18T15:29:16.289637517+08:00", "extensions": null},
  {"name": "todo-widget.html", "size": 4251, "is_dir": false, "is_symlink": false, "modified": "2026-07-18T15:21:03.066935239+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/todo-widget.html", "date": "2026-07-18T15:21:03.066935239+08:00", "extensions": null},
  {"name": "我如何高效的使用claudecode.md", "size": 6808, "is_dir": false, "is_symlink": false, "modified": "2026-07-04T14:22:27.546329309+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/我如何高效的使用claudecode.md", "date": "2026-07-04T14:22:27.546329309+08:00", "extensions": null},
]
// FIXTURE-COPY-END

/** 造一项 `GET /v1/folder` 的条目(字段名与真 fixture 逐字一致:`is_dir` 而非 `isDir`)。 */
function entry(name: string, isDir: boolean, path?: string): FolderEntry {
  return { name, is_dir: isDir, path: path ?? `/DATA/${name}` }
}

describe('dirEntries(content) —— 蓝本 folderBrowser.js:3-8', () => {
  it('【N7 兜底】content 为 undefined 时返回空数组,不抛', () => {
    expect(dirEntries(undefined)).toEqual([])
  })

  it('【N7 兜底】content 为 null(Go nil slice 序列化结果)时返回空数组,不抛', () => {
    expect(dirEntries(null)).toEqual([])
  })

  it('content 为空数组时返回空数组', () => {
    expect(dirEntries([])).toEqual([])
  })

  it('全是文件(is_dir 全 false)时返回空数组 —— 只留目录', () => {
    const out = dirEntries([entry('a.txt', false), entry('b.md', false)])
    expect(out).toEqual([])
  })

  it('全是隐藏目录(name 以 . 开头)时返回空数组 —— startsWith(".") 被滤掉', () => {
    const out = dirEntries([entry('.snapshots', true), entry('.system_data', true)])
    expect(out).toEqual([])
  })

  it('混合输入只留「可见目录」,且每项只有 name / path 两个字段', () => {
    const out = dirEntries([
      entry('.hidden-dir', true),
      entry('visible-dir', true),
      entry('file.txt', false),
      entry('.hidden-file', false),
    ])
    expect(out).toEqual([{ name: 'visible-dir', path: '/DATA/visible-dir' }])
    // 只 map 出 name / path —— is_dir 不该被带出来
    expect(Object.keys(out[0]!).sort()).toEqual(['name', 'path'])
  })

  it('name 恰好是 "." 开头的单字符 "." 也被滤掉(边界:startsWith 而非 === )', () => {
    expect(dirEntries([entry('.', true, '/DATA/.')])).toEqual([])
  })

  it('name 里含 . 但不在开头的目录保留(边界另一侧)', () => {
    expect(dirEntries([entry('a.b', true)])).toEqual([{ name: 'a.b', path: '/DATA/a.b' }])
  })

  it('排序真的生效:乱序进 → localeCompare 升序出', () => {
    const out = dirEntries([entry('zeta', true), entry('alpha', true), entry('mid', true)])
    expect(out.map((e) => e.name)).toEqual(['alpha', 'mid', 'zeta'])
  })

  it('localeCompare 不是码点序:大小写混排时 lower 会插到 upper 之间', () => {
    // 码点序会给出 ['KVM','Media','lost+found'](大写全在小写前);localeCompare 给
    // ['KVM','lost+found','Media'] —— 这条用例专门钉死用的是 localeCompare。
    const out = dirEntries([entry('Media', true), entry('lost+found', true), entry('KVM', true)])
    expect(out.map((e) => e.name)).toEqual(['KVM', 'lost+found', 'Media'])
  })

  it('端到端:folder-list-DATA.json 抄本的真实 18 项 → 12 个可见目录(取 data.content 那一层)', () => {
    const content = DATA_CONTENT // ← 三层信封里的 content 那一层(抄本)
    // 抄本没漂:18 项、其中 14 项 is_dir(含 3 个隐藏)
    expect(content).toHaveLength(18)
    expect(content.filter((e) => e.is_dir)).toHaveLength(14)

    const out = dirEntries(content)
    expect(out).toHaveLength(12)
    expect(out.map((e) => e.name)).toEqual([
      'Amalfi Coast', 'AppData', 'Documents', 'Downloads', 'Gallery', 'Image',
      'KVM', 'lost+found', 'Media', 'NIMO', 'Notes', 'todo-widget',
    ])
    expect(out.map((e) => e.path)).toEqual([
      '/DATA/Amalfi Coast', '/DATA/AppData', '/DATA/Documents', '/DATA/Downloads',
      '/DATA/Gallery', '/DATA/Image', '/DATA/KVM', '/DATA/lost+found',
      '/DATA/Media', '/DATA/NIMO', '/DATA/Notes', '/DATA/todo-widget',
    ])
    // 三个 . 开头的项被滤掉(两个隐藏目录 + 一个隐藏文件)
    expect(out.map((e) => e.name)).not.toContain('.snapshots')
    expect(out.map((e) => e.name)).not.toContain('.system_data')
    expect(out.map((e) => e.name)).not.toContain('.wiki.md')
    // 排序真的改了顺序:fixture 原序里 lost+found 在 Notes 之后,输出里在 KVM 之后
    const rawNames = content.map((e) => e.name)
    expect(rawNames.indexOf('lost+found')).toBeGreaterThan(rawNames.indexOf('Notes'))
    expect(out.map((e) => e.name).indexOf('lost+found')).toBeLessThan(
      out.map((e) => e.name).indexOf('Media'),
    )
  })
})

describe('pickerRoots(candidates) —— 蓝本 folderBrowser.js:10-23', () => {
  // 治理 §4.3 实测:本机 GET /v1/wiki/candidates 返回 [] → 真机走的就是兜底这条,
  // 兜底三根不是死代码。三个 label 是硬编码英文、不进 i18n(蓝本如此)。
  const FALLBACK = [
    { path: '/DATA', label: 'System (/DATA)' },
    { path: '/media', label: '/media' },
    { path: '/mnt', label: '/mnt' },
  ]

  it('【N7 兜底】candidates 为 undefined 时给出兜底三根', () => {
    expect(pickerRoots(undefined)).toEqual(FALLBACK)
  })

  it('【N7 兜底】candidates 为 null 时给出兜底三根', () => {
    expect(pickerRoots(null)).toEqual(FALLBACK)
  })

  it('candidates 为空数组(本机 wiki/candidates 实测值)时给出兜底三根,顺序照抄', () => {
    const out = pickerRoots([])
    expect(out).toEqual(FALLBACK)
    expect(out.map((r) => r.path)).toEqual(['/DATA', '/media', '/mnt'])
  })

  it('有候选且带 label 时逐项映射成 {path, label},丢掉其余字段', () => {
    const out = pickerRoots([
      { path: '/media/usb1', label: 'USB Stick' },
      { path: '/mnt/pool', label: 'Pool' },
    ])
    expect(out).toEqual([
      { path: '/media/usb1', label: 'USB Stick' },
      { path: '/mnt/pool', label: 'Pool' },
    ])
    expect(Object.keys(out[0]!).sort()).toEqual(['label', 'path'])
  })

  it('候选缺 label 时 label 回落成 path(走 `|| c.path`)', () => {
    expect(pickerRoots([{ path: '/media/usb2' }])).toEqual([
      { path: '/media/usb2', label: '/media/usb2' },
    ])
  })

  it('候选的 label 是空串时也回落成 path(`||` 的假值语义,不是 `??`)', () => {
    expect(pickerRoots([{ path: '/mnt/x', label: '' }])).toEqual([
      { path: '/mnt/x', label: '/mnt/x' },
    ])
  })

  it('有候选时绝不混入兜底三根(边界另一侧)', () => {
    const out = pickerRoots([{ path: '/media/usb1', label: 'USB' }])
    expect(out).toHaveLength(1)
    expect(out.map((r) => r.path)).not.toContain('/DATA')
  })
})

describe('crumbsFor(path, rootLabel) —— 蓝本 folderBrowser.js:25-34', () => {
  it('path 为空串时只有根一项,label 用传入的 rootLabel、path 是空串', () => {
    expect(crumbsFor('', '卷')).toEqual([{ label: '卷', path: '' }])
  })

  it('单段路径:根 + 一段', () => {
    expect(crumbsFor('/DATA', 'Volumes')).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
    ])
  })

  it('多段路径:逐段累加成绝对路径', () => {
    expect(crumbsFor('/DATA/Documents/Sub', 'Volumes')).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
      { label: 'Documents', path: '/DATA/Documents' },
      { label: 'Sub', path: '/DATA/Documents/Sub' },
    ])
  })

  it('前后多余的 / 被 filter(Boolean) 吃掉,结果与干净路径一致', () => {
    expect(crumbsFor('/DATA/Documents/', 'Volumes')).toEqual(
      crumbsFor('/DATA/Documents', 'Volumes'),
    )
  })

  it('连续 // 被 filter(Boolean) 吃掉,不产生空 label 的段', () => {
    const out = crumbsFor('//DATA//Documents//', 'Volumes')
    expect(out).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
      { label: 'Documents', path: '/DATA/Documents' },
    ])
    expect(out.some((c) => c.label === '')).toBe(false)
  })

  it('不以 / 开头的相对路径也被补成绝对路径(蓝本 acc += "/" + seg 的直接后果)', () => {
    expect(crumbsFor('DATA/Documents', 'Volumes')).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
      { label: 'Documents', path: '/DATA/Documents' },
    ])
  })

  it('rootLabel 原样透传,不做任何加工', () => {
    expect(crumbsFor('/x', '  Volumes  ')[0]).toEqual({ label: '  Volumes  ', path: '' })
  })
})
