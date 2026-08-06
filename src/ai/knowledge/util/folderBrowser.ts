// SP8-P5c Task 3(半一)—— 目录选择器的三个纯函数。
// 1:1 移植自 Vue2 `NimoOS-UI` (main@7a6ee6b7)
// `src/components/common/folderBrowser.js`(34 行,`git show main:` 读取 ——
// 治理文件 §1:那个仓的工作树是旧分支不可信)。
//
// 逐处对照:
//   蓝本 :3-8   dirEntries
//   蓝本 :10-23 pickerRoots(含 :13 的兜底注释语义)
//   蓝本 :25-34 crumbsFor
//
// 【零改动移植的依据】蓝本读的是 `e.is_dir` / `e.name` / `e.path`,而共享包的
// `FolderEntry = { name: string; path: string; is_dir: boolean }`
// (`NimoOS-Service/src/types.ts:26-30`)与之逐字对上 → 字段名一个都不改,
// **不许改成 camelCase `isDir`**(治理 §12.1 C-5 已实测 `GET /v1/folder` 的
// 每项字段就是 snake_case 的 `is_dir`)。
//
// 【N7】`dirEntries` 的 `(content || [])` 与 `pickerRoots` 的 `(candidates || [])`
// 是 Go nil slice 序列化成 `null` 的必要防御,**不许删**。
//
// 【为什么兜底三根不是死代码】治理 §4.3 实测:本机 `GET /v1/wiki/candidates`
// 返回 `[]`(HTTP 200,秒回)→ `pickerRoots([])` 走的就是兜底那条,真机可验。
// 那三个 label(`System (/DATA)` / `/media` / `/mnt`)是**硬编码英文、不进
// i18n**(蓝本如此;它们是数据不是文案)。

import type { FolderEntry } from '@nimotech/nimoos-service'

/** 目录选择器的一行(蓝本 `:6` map 出来的形状)。 */
export interface DirEntry {
  name: string
  path: string
}

/** `pickerRoots` 的入参形状 —— 结构上兼容共享包的 `WikiCandidate`
 *  (`{ path, type, size?, label? }`),`label` 可缺(走 `|| c.path`)。 */
export interface PickerCandidate {
  path: string
  label?: string
}

/** 根层的一项(蓝本 `:16` / `:19-21` 两条返回路径的共同形状)。 */
export interface PickerRoot {
  path: string
  label: string
}

/** 面包屑的一项(蓝本 `:26` / `:31`)。 */
export interface Crumb {
  label: string
  path: string
}

/**
 * 蓝本 `:3-8` —— 只留目录、滤掉以 `.` 开头的隐藏项,按 name 的
 * `localeCompare` 升序排。
 */
export function dirEntries(content?: FolderEntry[] | null): DirEntry[] {
  return (content || [])
    .filter((e) => e.is_dir && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, path: e.path }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * 蓝本 `:10-23` —— 根层候选来自 Wiki 服务(LocalStorage 支撑的卷列表);
 * 那个列表为空或拿不到时选择器仍必须可用,所以回落到 NimoOS 的既知布局。
 */
export function pickerRoots(candidates?: PickerCandidate[] | null): PickerRoot[] {
  const cands = candidates || []
  if (cands.length) {
    return cands.map((c) => ({ path: c.path, label: c.label || c.path }))
  }
  return [
    { path: '/DATA', label: 'System (/DATA)' },
    { path: '/media', label: '/media' },
    { path: '/mnt', label: '/mnt' },
  ]
}

/**
 * 蓝本 `:25-34` —— 首项恒为根(`path: ''`),`path` 为空则只有根一项;
 * 否则按 `/` 切段(`filter(Boolean)` 吃掉前后多余与连续的斜杠)逐段累加。
 */
export function crumbsFor(path: string, rootLabel: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: rootLabel, path: '' }]
  if (!path) return crumbs
  let acc = ''
  for (const seg of path.split('/').filter(Boolean)) {
    acc += '/' + seg
    crumbs.push({ label: seg, path: acc })
  }
  return crumbs
}
