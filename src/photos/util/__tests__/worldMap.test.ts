import { describe, it, expect } from 'vitest'
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
