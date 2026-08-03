// SP8-P5c Task 3(半一)—— `util/folderBrowser.ts` 三个纯函数的单测。
// 蓝本 `NimoOS-UI` (main@7a6ee6b7) `src/components/common/folderBrowser.js:3-34`。
//
// 【端到端那条用例的数据来源】直接在运行时读
// `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`(治理 §4:所有 mock 一律取
// 真响应体,禁手编 —— 记忆 `newui-fixture-from-imagination-trap`)。该 fixture 是
// **HTTP 原文的三层信封** `{success,message,data:{content:[…18 项…],total,index,size}}`,
// 本文件测的是纯函数 `dirEntries(content)`,所以取的是 **`data.content` 那一层**
// (18 项的数组本身)。K28 的换层只影响组件那半(`FolderBrowser.vue`),纯函数这半
// 只吃 `content` 数组。
// ⚠️ 该 fixture 已被 `git add -f` 纳入版本库(`.gitignore` 有 `.superpowers/`,但
// 已跟踪文件不受 ignore 影响,`git ls-files` 可见)→ 运行时读取是可复现的。
// 🔴 读文件一律 `node:fs`,不用 Vite 的 `?raw`(vitest 的 CSSEnablerPlugin 会把
// 某些资源换成空串 → 断言对空内容「假通过」;先例 `knowledgeStyles.test.ts` 头注释③)。
// 期望值(12 个目录名与它们的 `localeCompare` 顺序)是**写死的字面量**,不是从
// fixture 现算出来的 —— 否则断言会自我实现、失去判别力。
import { describe, it, expect } from 'vitest'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { crumbsFor, dirEntries, pickerRoots } from './folderBrowser'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

  it('端到端:真 fixture folder-list-DATA.json 的 18 项 → 12 个可见目录(取 data.content 那一层)', () => {
    const raw: string = readFileSync(
      resolve(__dirname, '../../../../.superpowers/sdd/p5c-fixtures/folder-list-DATA.json'),
      'utf8',
    )
    const envelope = JSON.parse(raw) as { data: { content: FolderEntry[] } }
    const content = envelope.data.content // ← 三层信封里的 content 那一层
    // fixture 没漂:18 项、其中 14 项 is_dir(含 3 个隐藏)
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
