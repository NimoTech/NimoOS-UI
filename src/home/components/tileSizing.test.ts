/// <reference types="node" />
// 显式引 node 类型而不是往 tsconfig 的 types 数组里加 "node"(与 color-guard.test.ts 一致)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import folderSrc from './FolderTile.vue?raw'

// `?raw` 对 .css 在本仓 vitest 环境下恒为空串(CSS 走副作用模块管线,不进 fs 插件),
// color-guard.test.ts / theme.sp9.test.ts 已踩过同一个坑并改用 node:fs 读——这里跟随同一模式,
// .vue 文件不受影响(FolderTile.vue?raw 照常拿到真实源码)。
const themeSrc = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/theme.css'),
  'utf8',
)

// bug.txt #6:FolderTile 的 scoped `.folder-ic { width:100%; height:100% }` 与
// theme.css 的方形规则(aspect-ratio:1)特异度同分,SFC 样式后注入而胜出,方形
// 规则整条变死规则;.folder-ic 内部 <img> 的 64px 固有宽度进而把磁贴撑出格子。
// 守卫:SFC 不得再对 .folder-ic 声明 width/height;theme.css 方形规则必须带
// min-width:0(替换元素 min-width:auto 的下限就是当年撑爆格子的元凶)。
describe('desktop tile sizing (bug.txt #6)', () => {
  const style = folderSrc.slice(folderSrc.indexOf('<style'))
  // 剥掉 CSS 注释再匹配:守卫要盯真实声明,不能被说明性注释里出现的
  // ".folder-ic"/"width"/"height" 文字段落(比如本文件下方就在讲这段历史)带偏。
  const styleWithoutComments = style.replace(/\/\*[\s\S]*?\*\//g, '')
  it('FolderTile scoped style must not redeclare .folder-ic width/height', () => {
    expect(styleWithoutComments).not.toMatch(/\.folder-ic[^{]*\{[^}]*(width|height)\s*:/)
  })
  it('theme.css square-tile rule keeps aspect-ratio and min-width:0', () => {
    const rule = themeSrc.match(/\.kind-folder \.folder-ic[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/aspect-ratio\s*:\s*1/)
    expect(rule).toMatch(/min-width\s*:\s*0/)
  })
})
