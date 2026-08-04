// SP7-P8b:深链键覆盖闸。
//
// 为什么需要它:cutover 之后 Vue2 `/photos` 被 strangler.js 整页重定向到 `/app/#/photos`,
// Vue2 那 13 个 query 键再也不会被它自己的组件接住 —— 漏掉任何一个,就是一批老书签静默
// 变哑。而这类漏项**三道门根本抓不到**:没有任何行为用例会"因为少了一个键"而变红。
// SP9-T9 栽过同一形态的坑(白名单只做单向检查,漏搬的整块 CSS 三道门全绿溜过去),所以这里
// 立的是**双向**闸:
//   正向 —— Vue2 键集清单里的每个键,都必须在分发器里被读到;
//   反向 —— 除 active/spot 两个附属键外,每个键都必须进 watch 数组(否则只有整页挂载时
//           才认,手改地址栏毫无反应 —— P8a 真机验收正是这么抓到 query-only 缺陷的);
//   自检 —— 清单本身非空且无重复(防清单被误清空之后闸恒绿)。
//
// 本闸读源码文本而不 import 模块:要断言的是"watch 数组里登记了哪些 getter"这种**结构**
// 事实,运行时拿不到(watch 的依赖列表不是可观察值)。行为正确性由 usePhotosDeepLinks.test.ts
// 的 55 条用例负责,两者分工不重叠。
// 读盘一律 node:fs —— 本仓测试环境里 `?raw` 恒空(color-guard 曾因此空转)。
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Vue2 `/photos` 支持的全部 query 键,逐个带回源坐标(NimoOS-UI 仓)。
// 回源核实:PhotosTimeline.vue:368-374(mounted 分发)+ :475-506(_applyUrlDeepLinks)
// + PhotosAlbumsView.vue:264 + PhotosSmartViewsView.vue:337-348。
const VUE2_QUERY_KEYS: Array<[key: string, source: string]> = [
  ['photoset', 'PhotosTimeline.vue:368-374 mounted 分发'],
  ['active', 'PhotosTimeline.vue:368-374 —— photoset 的附属键'],
  ['asset', 'PhotosTimeline.vue:368-374 mounted 分发'],
  ['view', 'PhotosTimeline.vue:479-481 NAV_KEYS'],
  ['tab', 'PhotosTimeline.vue:482-484 TAB_KEYS'],
  ['settings', 'PhotosTimeline.vue:485-488'],
  ['q', 'PhotosTimeline.vue:491-494'],
  ['place', 'PhotosTimeline.vue:496-498 → :527-554'],
  ['spot', 'PhotosTimeline.vue:496-498 —— place 的附属键'],
  ['person', 'PhotosTimeline.vue:500-502 → :509-523'],
  ['photo', 'PhotosTimeline.vue:504-506 → :556-571'],
  ['album', 'PhotosAlbumsView.vue:264(相册列表页自己 mounted 读)'],
  ['smartview', 'PhotosSmartViewsView.vue:337-348(智能视图页自己 mounted 读)'],
]

// 附属键:随主键一起被读(active 随 photoset、spot 随 place),不需要各自独立的处理分支;
// 但 spot 仍然进了 watch 数组(只改 spot 是真实用户操作),active 没有(它只在 photoset
// 那一次性交接里被读,单独改它没有意义)。
const ATTACHED_NO_WATCH = new Set(['active'])

const SRC = fs.readFileSync(path.resolve(__dirname, '../usePhotosDeepLinks.ts'), 'utf8')

describe('深链键覆盖闸 · 正向(Vue2 键集 → 分发器)', () => {
  it('每个 Vue2 query 键都在分发器里被读到', () => {
    const missing = VUE2_QUERY_KEYS
      .filter(([k]) => !SRC.includes(`query.${k}`))
      .map(([k, source]) => `${k} —— 回源 ${source}`)
    expect(missing).toEqual([])
  })
})

describe('深链键覆盖闸 · 反向(分发器 → watch 数组)', () => {
  it('每个键都进了 watch 数组(附属键 active 除外)', () => {
    const watchStart = SRC.indexOf('  watch(')
    expect(watchStart, 'watch( 块没找到——本闸的取数方式失效了,先修闸再改代码').toBeGreaterThan(0)
    const watchBlock = SRC.slice(watchStart)

    const missing = VUE2_QUERY_KEYS
      .filter(([k]) => !ATTACHED_NO_WATCH.has(k))
      .filter(([k]) => !watchBlock.includes(`route.query.${k}`))
      .map(([k]) => k)
    expect(missing).toEqual([])
  })

  it('watch 数组里没有清单外的键(反向也不许多出来——多出的就是没登记的新键)', () => {
    const watchStart = SRC.indexOf('  watch(')
    const watchEnd = SRC.indexOf('    ],', watchStart)
    const watchBlock = SRC.slice(watchStart, watchEnd)

    const watched = [...watchBlock.matchAll(/route\.query\.(\w+)/g)].map((m) => m[1])
    const known = new Set(VUE2_QUERY_KEYS.map(([k]) => k))
    const extra = watched.filter((k) => !known.has(k))
    expect(extra).toEqual([])
  })
})

describe('深链键覆盖闸 · 自检', () => {
  it('清单非空、无重复(防被误清空后闸恒绿)', () => {
    const keys = VUE2_QUERY_KEYS.map(([k]) => k)
    expect(keys.length).toBe(13)
    expect(new Set(keys).size).toBe(13)
  })

  it('每条都带回源坐标(没有坐标的条目将来无法核对)', () => {
    const noSource = VUE2_QUERY_KEYS.filter(([, source]) => !source || !source.includes('.vue:'))
    expect(noSource).toEqual([])
  })
})
