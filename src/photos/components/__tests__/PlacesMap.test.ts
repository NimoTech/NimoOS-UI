// P6a-T6: PlacesMap.vue —— 地点页的 SVG 地图舞台。
// 逐条对应 task-6-brief.md 的「必含测试清单」,补充覆盖结构规格 1-8 与删码清单 5 处。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { visitedDots, type Place } from '../../util/placesMap'
import { WORLD_DOTS } from '../../util/worldMap'
import PlacesMap from '../PlacesMap.vue'
// 原始源码文本(Vite `?raw`)—— 一部分测试要读源文本本身(颜色 attribute 守卫、
// theme-exception 注释合规),不是 DOM 断言能覆盖的,同 PlacesRail.test.ts:19 的既有先例。
import placesMapRaw from '../PlacesMap.vue?raw'
// Task 5 (Plan E #106 perf port): `.world-dot`'s CSS rule moved out of PlacesMap.vue's own
// <style> block into PlacesWorldDots.vue's (the dots now render inside that child component's
// own template, not this one's — see that file's own header comment on why the rule had to move
// with the elements). The raw-source rule-lookup test below is repointed at the new home.
import placesWorldDotsRaw from '../PlacesWorldDots.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

// 注意:cssCascade.ts 的 extractStyleBlock() 会先剥掉 CSS 注释再返回(给"选择器优先级"
// 那组测试用,注释会污染选择器解析)。theme-exception 合规检查恰恰要看注释本身的原文,
// 所以这里自己抓一次未剥注释的 <style> 块,不复用那个工具函数。
function rawStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('未找到样式块')
  return m[1]
}

function place(over: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: new Date(2026, 2, 7),
    trips: 1, home: false, thumbs: ['t1'], coverAssetId: '', ...over,
  }
}

// 单个不激活、不最近的小地点(用于 hitR 删码验证④)。
const PLAIN = place({ id: 'plain', city: 'Plain City', lon: 100, lat: 20, count: 3, recent: false })
// 激活 + 最近的单点(五层结构齐备:pulse/core/label 都要出现)。
const ACTIVE_RECENT = place({ id: 'active-recent', city: 'Activeville', lon: -70, lat: 40, count: 10, recent: true })
// 两个彼此极近、都不激活/不最近的点 —— 在 scale=1 下必然合并成一个簇。
const CLUSTER_A = place({ id: 'clus-a', city: 'Cluster A', lon: 10, lat: 10, count: 5, recent: false })
const CLUSTER_B = place({ id: 'clus-b', city: 'Cluster B', lon: 10.01, lat: 10.01, count: 5, recent: false })
// 一个真实落地(伦敦附近,land mask 覆盖)的点,用来断言陆地点阵的 is-visited 计数
// ——不是只判断「有没有」,是判断「数量精确等于 visitedDots() 算出来的」(删码⑤的靶)。
const LONDON = place({ id: 'london', city: 'London', lon: 0, lat: 51, count: 1, recent: false })

function mountMap(over: Partial<InstanceType<typeof PlacesMap>['$props']> = {}) {
  return mount(PlacesMap, {
    props: {
      places: [PLAIN, ACTIVE_RECENT],
      activeId: 'active-recent',
      view: { tx: 0, ty: 0, scale: 1 },
      themeVars: {},
      ...over,
    },
  })
}

describe('结构规格 1: <svg> viewBox / preserveAspectRatio', () => {
  it('viewBox 是 "0 0 1000 500",preserveAspectRatio 是 xMidYMid meet', () => {
    const w = mountMap()
    const svg = w.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 1000 500')
    expect(svg.attributes('preserveAspectRatio')).toBe('xMidYMid meet')
  })

  it('themeVars 落到 <svg> 的 style 上(background 与 --map-dot 都在)', () => {
    const w = mountMap({ themeVars: { background: 'rgb(1, 2, 3)', '--map-dot': 'rgba(4, 5, 6, 1)' } })
    const el = w.find('svg').element as SVGSVGElement
    expect(el.style.background).toContain('rgb(1, 2, 3)')
    expect(el.style.getPropertyValue('--map-dot')).toBe('rgba(4, 5, 6, 1)')
  })
})

describe('结构规格 2: 外层 <g> 的 transform', () => {
  it('逐字为 translate(12 34) scale(2)', () => {
    const w = mountMap({ view: { tx: 12, ty: 34, scale: 2 }, places: [] })
    const g = w.find('svg > g')
    expect(g.attributes('transform')).toBe('translate(12 34) scale(2)')
  })
})

describe('结构规格 3: 陆地点阵(删码⑤靶)', () => {
  it('渲染数量 === WORLD_DOTS.length', () => {
    const w = mountMap({ places: [] })
    expect(w.findAll('.world-dot').length).toBe(WORLD_DOTS.length)
  })

  it('visited 项带 .is-visited、非 visited 不带 —— 精确计数,不只判断存在', () => {
    const w = mountMap({ places: [LONDON] })
    const expected = visitedDots([LONDON])
    const expectedVisited = expected.filter(d => d.visited).length
    const expectedNotVisited = expected.length - expectedVisited
    // 伦敦这条 fixture 必须真的命中至少一个陆地格,否则这条测试对删码⑤是钝的。
    expect(expectedVisited).toBeGreaterThan(0)
    expect(w.findAll('.world-dot.is-visited').length).toBe(expectedVisited)
    expect(w.findAll('.world-dot:not(.is-visited)').length).toBe(expectedNotVisited)
  })

  // 评审 I1:.world-dot 的 fill 回落必须是专用 token --map-dot-bg-fallback,不能是 --fg-faint
  // ——深色 --fg-faint(0.52)会亮到盖过 is-visited 点,浅色 --fg-faint 是不透明暖灰,铺在地图
  // 黑底画布上会变成一块不透明色块(两条都是 Vue2 最常见路径,不是罕见分支)。
  // Task 5 (Plan E #106 perf port): 这条规则现在住在 PlacesWorldDots.vue 自己的 <style> 块里
  // (点阵 <circle> 已抽成那个子组件,scoped 属性只挂它自己模板产出的元素——留在 PlacesMap.vue
  // 会变成一条谁都匹配不到的死规则),读源文本的靶子跟着挪过去,断言内容不变。
  it('.world-dot 的 fill 回落引用 --map-dot-bg-fallback,不是 --fg-faint(删码:换回 --fg-faint 必红)', () => {
    const rules = parseCssRules(extractStyleBlock(placesWorldDotsRaw))
    const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === '.world-dot')
    expect(rule, '.world-dot 独立规则未找到').toBeTruthy()
    expect(rule!.body).toMatch(/fill:\s*var\(--map-dot-bg,\s*var\(--map-dot-bg-fallback\)\)/)
    expect(rule!.body).not.toContain('--fg-faint')
  })
})

describe('结构规格 4: 图钉五层结构(漏渲染主守卫)', () => {
  it('非簇且 active 的图钉:pin-hit/pin-pulse/pin-bg/pin-core/geo-pin-label 各 1', () => {
    const w = mountMap({ places: [PLAIN, ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.findAll('.geo-pin').find(g => g.classes().includes('is-active'))!
    expect(pin.findAll('.pin-hit').length).toBe(1)
    expect(pin.findAll('.pin-pulse').length).toBe(1)
    expect(pin.findAll('.pin-bg').length).toBe(1)
    expect(pin.findAll('.pin-core').length).toBe(1)
    expect(pin.findAll('.geo-pin-label').length).toBe(1)
  })

  it('簇图钉:pin-core/pin-pulse/geo-pin-label 都为 0(照 Vue2 的 v-if,删码①靶)', () => {
    const w = mountMap({ places: [CLUSTER_A, CLUSTER_B], activeId: null, view: { tx: 0, ty: 0, scale: 1 } })
    const clusterPin = w.findAll('.geo-pin').find(g => g.classes().includes('is-cluster'))
    expect(clusterPin, '两个近距地点在 scale=1 下应合并成一个簇图钉').toBeTruthy()
    expect(clusterPin!.findAll('.pin-core').length).toBe(0)
    expect(clusterPin!.findAll('.pin-pulse').length).toBe(0)
    expect(clusterPin!.findAll('.geo-pin-label').length).toBe(0)
    // 簇图钉本身仍然要有 pin-hit + pin-bg(v-if 只吃 core/pulse/label,不吃这两层)。
    expect(clusterPin!.findAll('.pin-hit').length).toBe(1)
    expect(clusterPin!.findAll('.pin-bg').length).toBe(1)
  })

  it('.pin-scale 存在且 pin-pulse/pin-bg/pin-core 都在它内部(删码②靶)', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    expect(pin.find('.pin-scale').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-pulse').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-bg').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-core').exists()).toBe(true)
  })

  it('pin-hit 的 r 等于 p.hitR,且在小图钉(count=3)上严格大于 p.r(删码④靶)', () => {
    const w = mountMap({ places: [PLAIN], activeId: null, view: { tx: 0, ty: 0, scale: 1 } })
    const pin = w.find('.geo-pin')
    const hit = pin.find('.pin-hit')
    const bg = pin.find('.pin-bg')
    const hitR = Number(hit.attributes('r'))
    const bgR = Number(bg.attributes('r'))
    // count=3 < 40 → tierRadius=7,scale=1 → r=7,hitR=max(7, 9/1)=9。
    expect(hitR).toBe(9)
    expect(bgR).toBe(7)
    expect(hitR).toBeGreaterThan(bgR)
  })

  it('.pin-core 的半径是 .pin-bg 半径的 0.55 倍', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    const bgR = Number(pin.find('.pin-bg').attributes('r'))
    const coreR = Number(pin.find('.pin-core').attributes('r'))
    expect(coreR).toBeCloseTo(bgR * 0.55, 10)
  })
})

describe('结构规格 4: 条件类可叠加', () => {
  it('active → .is-active;recent → .is-recent;簇 → .is-cluster;三者可叠加', () => {
    // ACTIVE_RECENT 单独一个点:active + recent,不是簇。
    const w1 = mountMap({ places: [PLAIN, ACTIVE_RECENT], activeId: 'active-recent' })
    const activePin = w1.findAll('.geo-pin').find(g => g.classes().includes('is-active'))!
    expect(activePin.classes()).toContain('is-recent')
    expect(activePin.classes()).not.toContain('is-cluster')

    // 簇里若某成员既是 activeId 又 recent:三个条件类同时出现在同一个簇图钉上。
    const clusA = place({ id: 'ca2', city: 'CA2', lon: 50, lat: -30, count: 5, recent: true })
    const clusB = place({ id: 'cb2', city: 'CB2', lon: 50.01, lat: -30.01, count: 5, recent: false })
    const w2 = mountMap({ places: [clusA, clusB], activeId: 'ca2', view: { tx: 0, ty: 0, scale: 1 } })
    const clusterPin = w2.findAll('.geo-pin').find(g => g.classes().includes('is-cluster'))!
    expect(clusterPin.classes()).toContain('is-active')
    expect(clusterPin.classes()).toContain('is-recent')
    expect(clusterPin.classes()).toContain('is-cluster')
  })
})

describe('结构规格 4: 标签反缩放(删码③靶)', () => {
  it('view.scale = 4 时,font-size=2.75px、stroke-width=0.85、y = 4.5(全部手算写死)', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent', view: { tx: 0, ty: 0, scale: 4 } })
    const pin = w.find('.geo-pin')
    const label = pin.find('.geo-pin-label')
    expect(label.exists()).toBe(true)
    const style = (label.element as unknown as HTMLElement).style
    // 手算,不读 DOM 的 p.r 反推(评审 Minor 3:若 p.r 本身算错,读 DOM 反推的旧写法测不出来)。
    // ACTIVE_RECENT.count = 10 → tierRadius(10) = 7(< 40 档)→ p.r = 7 / scale = 7 / 4 = 1.75。
    // font-size = 11 / 4 = 2.75, stroke-width = 3.4 / 4 = 0.85, y = p.r + 11/4 = 1.75 + 2.75 = 4.5。
    expect(style.fontSize).toBe('2.75px')
    expect(style.strokeWidth).toBe('0.85')
    expect(Number(label.attributes('y'))).toBeCloseTo(4.5, 10)
  })
})

// jsdom 既不做 Vue transition 的真实进出场态,也不会把 name="pin-merge" 落成 DOM 属性
// (那是纯 JS 侧的过渡配置,不进 DOM)——mount 后没法断言"动画真的播了"。ambiguity-resolved
// 第 5 条给的替代方案:①断言 <transition-group> 存在且 name="pin-merge"(只能读模板源文本,
// 不能读渲染结果);②在样式块里程序化断言四条动画规则存在且带预期属性。
describe('结构规格 4: pin-merge 入场/离场动画(源码级断言,理由见上方注释)', () => {
  it('渲染出的 transition-group 是 name="pin-merge"、tag="g"、class="pins-layer"', () => {
    // @vue/test-utils 默认把 <transition-group> stub 成 <transition-group-stub>(不渲染成真实
    // <g>),但 stub 元素会把 tag/name 等 prop 原样落成 DOM attribute——用它们断言比正则抠模板
    // 源文本更可靠(不依赖属性书写顺序/引号风格)。
    const w = mountMap({ places: [] })
    const layer = w.find('.pins-layer')
    expect(layer.exists()).toBe(true)
    expect(layer.attributes('name')).toBe('pin-merge')
    expect(layer.attributes('tag')).toBe('g')
  })

  it('四条动画规则都存在且带预期属性(active 用 transition,enter-from/leave-to 用 scale(0.25)+opacity:0)', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const activeRule = rules.find(r =>
      r.selectors.includes('.pin-merge-enter-active .pin-scale')
      && r.selectors.includes('.pin-merge-leave-active .pin-scale'))
    expect(activeRule, '.pin-merge-enter-active/.pin-merge-leave-active 的 .pin-scale 规则未找到').toBeTruthy()
    expect(activeRule!.body).toMatch(/transition:\s*transform[^;]*,\s*opacity/)

    // 这条规则的选择器必须是 Vue3 的 enter-from/leave-to(不是 Vue2 的 .pin-merge-enter)——
    // 若有人照抄 Vue2 类名,这里会因为选择器字符串不匹配而找不到规则,测试变红。
    const hiddenRule = rules.find(r =>
      r.selectors.includes('.pin-merge-enter-from .pin-scale')
      && r.selectors.includes('.pin-merge-leave-to .pin-scale'))
    expect(hiddenRule, '.pin-merge-enter-from/.pin-merge-leave-to 的 .pin-scale 规则未找到(Vue2→Vue3 类名改名是否漏做?)').toBeTruthy()
    expect(hiddenRule!.body).toMatch(/transform:\s*scale\(0\.25\)/)
    expect(hiddenRule!.body).toMatch(/opacity:\s*0\b/)
  })
})

// 评审 Minor 1:transform-box: fill-box / transform-origin: center 缺任一条,合并/裂变动画会
// 绕 SVG 用户坐标原点缩放,图钉会飞出屏幕——但 jsdom 不做布局也不做变换计算,DOM 断言测不到
// 视觉后果,只能在样式源码层面钉住这两条声明确实存在。同理 .geo-pin:hover 的 var(--pin-glow)
// 引用此前也是零覆盖(删掉整条规则 19/19 仍然全绿),一并补上。
describe('结构规格 4/8: .pin-scale 几何声明 + hover 发光引用(补测,原先零覆盖)', () => {
  it('.pin-scale 规则同时含 transform-box: fill-box 与 transform-origin: center', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === '.pin-scale')
    expect(rule, '.pin-scale 独立规则未找到').toBeTruthy()
    expect(rule!.body).toMatch(/transform-box:\s*fill-box/)
    expect(rule!.body).toMatch(/transform-origin:\s*center/)
  })

  it('.geo-pin:hover 引用 var(--pin-glow) 做外发光', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const rule = rules.find(r => r.selectors.includes('.geo-pin:hover'))
    expect(rule, '.geo-pin:hover 规则未找到').toBeTruthy()
    expect(rule!.body).toMatch(/filter:\s*drop-shadow\([^)]*var\(--pin-glow\)/)
  })
})

describe('emit: 点击 / 悬停 / 离开', () => {
  it('点图钉 emit pick-pin 带 pin 与事件', async () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    await pin.trigger('click')
    expect(w.emitted('pick-pin')).toHaveLength(1)
    const [emittedPin, ev] = w.emitted('pick-pin')![0] as [{ id: string }, MouseEvent]
    expect(emittedPin.id).toBe('active-recent')
    expect(ev).toBeInstanceOf(MouseEvent)
  })

  it('mouseenter emit hover-pin,mouseleave emit hover-clear', async () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    await pin.trigger('mouseenter')
    expect(w.emitted('hover-pin')).toHaveLength(1)
    const [emittedPin] = w.emitted('hover-pin')![0] as [{ id: string }]
    expect(emittedPin.id).toBe('active-recent')

    await pin.trigger('mouseleave')
    expect(w.emitted('hover-clear')).toHaveLength(1)
  })
})

describe('expose: svgEl 交给 T7/T11 做坐标换算与 pointer capture', () => {
  it('defineExpose 出的 svgEl 就是渲染出的 <svg> 元素', () => {
    const w = mountMap()
    expect((w.vm as unknown as { svgEl: SVGSVGElement }).svgEl).toBe(w.find('svg').element)
  })
})

describe('样式块零颜色 attribute(防日后有人图省事写回 attribute)', () => {
  it('组件源文本不出现任何颜色 attribute 写法(评审 Minor 2:原列表偏窄,补齐 stroke="#/fill="rgb/绑定字符串 var(', () => {
    expect(placesMapRaw).not.toContain('fill="#')
    expect(placesMapRaw).not.toContain('fill="var(')
    expect(placesMapRaw).not.toContain('stroke="var(')
    // 补的四种:原列表只挡了裸 attribute 的 hex/var 两种写法,漏了 stroke 的 hex、rgb() 函数、
    // 以及 :fill="'var(--x)'" 这种把 var() 包成字符串再绑定的写法(同样绕开 CSS 规则,不受
    // color-guard 的样式块扫描)。
    expect(placesMapRaw).not.toContain('stroke="#')
    expect(placesMapRaw).not.toContain('fill="rgb')
    expect(placesMapRaw).not.toContain('stroke="rgb')
    expect(placesMapRaw).not.toContain(':fill="\'var(')
    expect(placesMapRaw).not.toContain(':stroke="\'var(')
  })
})

describe('theme-exception 注释合规(照 color-guard 的豁免窗口规则)', () => {
  it('.geo-pin-label 规则内的裸颜色字面量都被紧邻的 theme-exception 注释豁免窗口覆盖', () => {
    const styleText = rawStyleBlock(placesMapRaw)
    const start = styleText.indexOf('.geo-pin-label {')
    expect(start).toBeGreaterThan(-1)
    const bodyStart = styleText.indexOf('{', start)
    const bodyEnd = styleText.indexOf('}', bodyStart)
    const ruleLines = styleText.slice(start, bodyEnd + 1).split('\n')

    // 逐字复刻 src/styles/color-guard.test.ts 的豁免窗口状态机(该文件:exempt 在遇到
    // theme-exception 注释后打开,遇到下一个 ; 或 } 就关闭)。踩过的坑:把注释整块挂在
    // 规则最前面、选择器上方——规则体第一行(font-family)就带 `;` 提前关窗,后面
    // fill/stroke 的裸 rgba() 其实裸奔,color-guard 会真的红。这里不只断言"有注释",
    // 而是真的按该状态机跑一遍,确认每处裸色都真被盖住。
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(rgba?|hsla?)\s*\(/
    let exempt = false
    const offenders: string[] = []
    const comments: string[] = []
    ruleLines.forEach((line) => {
      if (line.includes('theme-exception')) {
        exempt = true
        comments.push(line)
      }
      if (!exempt && (HEX.test(line) || FUNC.test(line)))
        offenders.push(line)
      if (line.includes(';') || line.includes('}'))
        exempt = false
    })
    expect(offenders, `裸颜色未被豁免窗口覆盖:\n${offenders.join('\n')}`).toEqual([])
    // 必须真的用上了豁免机制(不是规则里干脆没有裸色,那样上面的空数组毫无意义)。
    expect(comments.length).toBeGreaterThan(0)
    for (const c of comments) {
      expect(c).not.toContain(';')
      expect(c).not.toContain('}')
      expect(c.toLowerCase()).not.toContain('<style')
    }
  })
})
