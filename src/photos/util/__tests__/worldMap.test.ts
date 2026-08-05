import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import PhotosMiniMap from '../../components/PhotosMiniMap.vue'
import { MAP_H, MAP_W, WORLD_DOTS, project } from '../worldMap'

describe('project', () => {
  it('(0,0) 投影到画布正中心', () => {
    expect(project(0, 0)).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
  })

  it('(-180,90) 投影到左上角原点', () => {
    expect(project(-180, 90)).toEqual({ x: 0, y: 0 })
  })

  it('(180,-90) 投影到右下角', () => {
    expect(project(180, -90)).toEqual({ x: MAP_W, y: MAP_H })
  })
})

describe('WORLD_DOTS', () => {
  it('非空(陆地掩膜解析出至少一个点)', () => {
    expect(WORLD_DOTS.length).toBeGreaterThan(0)
  })

  it('每个点的投影坐标都落在画布范围内', () => {
    for (const d of WORLD_DOTS) {
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThanOrEqual(MAP_W)
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeLessThanOrEqual(MAP_H)
    }
  })
})

/* P6a-T2:补 P5-T4 parked 的 viewBox 最小跨度钳制分支。
   PhotosMiniMap.vue 内部常量:LON_PAD=20 / LAT_PAD=15 / MIN_LON_SPAN=40 / MIN_LAT_SPAN=30。
   钳制条件是 padding 后的跨度仍 < MIN_*_SPAN;单点情形下 padding 后恰好等于阈值
   (LON_PAD*2 === MIN_LON_SPAN),不触发 —— 只有贴近 ±180 / ±90 让 padding
   被单侧裁掉一截,跨度才会跌破阈值,这就是"钳制分支"真正可达的唯一路径。

   下面每个用例的期望 viewBox 都是手推 PhotosMiniMap.vue 的算法(不是跑组件反填):
   先手算 padding+clamp+widen 之后的 minLon/maxLon/minLat/maxLat(整数或半整数,
   过程见各 it 内注释),再用**已受信的** project() 转成像素坐标 —— project 本身
   已被上面的 describe('project') 钉住,不是本次测试的对象。

   核对时发现:注释草稿里"拉回 40 度宽"并不精确 —— 加宽这一步是围绕新中点对称
   展开 ±MIN_SPAN/2,而新中点本身仍贴着边界,所以加宽后又在同一侧被再夹一次,
   最终跨度 < MIN_SPAN(收敛趋近但永远达不到)。已在报告里记录为发现。 */
describe('PhotosMiniMap viewBox 最小跨度钳制(边界点位)', () => {
  function viewBoxNums(points: Array<{ latitude: number, longitude: number, color?: string }>): number[] {
    const w = mount(PhotosMiniMap, { props: { points: points.map(p => ({ color: '#fff', ...p })) } })
    const vb = w.get('svg').attributes('viewBox') ?? ''
    return vb.split(' ').map(Number)
  }

  it('经度贴近 +180 时右侧 padding 被裁,触发 lon 钳制(纬度不受影响)', () => {
    // 单点 (lon=179, lat=0)。
    // lon: raw [179,179] → pad → min=max(159,-180)=159, max=min(199,180)=180
    //      span=21<40 → widen: mid=169.5, min=max(149.5,-180)=149.5, max=min(189.5,180)=180
    //      最终 [149.5, 180](span=30.5,仍 <40 —— 见上方注释的发现)
    // lat: raw [0,0] → pad → min=-15, max=15,span=30,不 <30 → 不触发,原样保留
    const [vx, vy, vw, vh] = viewBoxNums([{ latitude: 0, longitude: 179 }])
    const topLeft = project(149.5, 15)
    const bottomRight = project(180, -15)
    expect(vx).toBe(topLeft.x)
    expect(vy).toBe(topLeft.y)
    expect(vw).toBe(bottomRight.x - topLeft.x)
    expect(vh).toBe(bottomRight.y - topLeft.y)
    // 右边界确实撞到 +180(project(180,_).x === MAP_W),这是钳制被触发的直接证据
    expect(vx + vw).toBe(MAP_W)
    // 加宽后跨度小于 40 度(见上方发现),但仍大于裁剪前的 21 度
    expect(vw).toBeLessThan((40 / 360) * MAP_W)
    expect(vw).toBeGreaterThan((21 / 360) * MAP_W)
  })

  it('纬度贴近 +90 时上侧 padding 被裁,触发 lat 钳制(经度不受影响)', () => {
    // 单点 (lon=0, lat=89)。
    // lat: raw [89,89] → pad → min=max(74,-90)=74, max=min(104,90)=90
    //      span=16<30 → widen: mid=82, min=max(67,-90)=67, max=min(97,90)=90
    //      最终 [67,90](span=23,仍 <30)
    // lon: raw [0,0] → pad → [-20,20],span=40,不 <40 → 不触发
    const [vx, vy, vw, vh] = viewBoxNums([{ latitude: 89, longitude: 0 }])
    const topLeft = project(-20, 90)
    const bottomRight = project(20, 67)
    expect(vx).toBe(topLeft.x)
    expect(vy).toBe(topLeft.y)
    expect(vw).toBe(bottomRight.x - topLeft.x)
    expect(vh).toBe(bottomRight.y - topLeft.y)
    // 上边界确实撞到 +90(project(_,90).y === 0)
    expect(vy).toBe(0)
    expect(vh).toBeLessThan((30 / 180) * MAP_H)
    expect(vh).toBeGreaterThan((16 / 180) * MAP_H)
  })

  it('贴近 -180 / -90 的对侧同样触发钳制(两轴同时)', () => {
    // 单点 (lon=-179, lat=-89)。
    // lon: raw [-179,-179] → pad → min=max(-199,-180)=-180(裁), max=min(-159,180)=-159
    //      span=21<40 → widen: mid=-169.5, min=max(-189.5,-180)=-180(再裁), max=min(-149.5,180)=-149.5
    //      最终 [-180,-149.5](span=30.5)
    // lat: raw [-89,-89] → pad → min=max(-104,-90)=-90(裁), max=min(-74,90)=-74
    //      span=16<30 → widen: mid=-82, min=max(-97,-90)=-90(再裁), max=min(-67,90)=-67
    //      最终 [-90,-67](span=23)
    const [vx, vy, vw, vh] = viewBoxNums([{ latitude: -89, longitude: -179 }])
    const topLeft = project(-180, -67)
    const bottomRight = project(-149.5, -90)
    expect(vx).toBe(topLeft.x)
    expect(vy).toBe(topLeft.y)
    expect(vw).toBe(bottomRight.x - topLeft.x)
    expect(vh).toBe(bottomRight.y - topLeft.y)
    // 左边界撞 -180、下边界撞 -90
    expect(vx).toBe(0)
    expect(vy + vh).toBe(MAP_H)
  })
})
