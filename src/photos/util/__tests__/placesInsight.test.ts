import { describe, expect, it, vi } from 'vitest'
import { INSIGHT_KEY_MAP, insightKey, joinCompanionNames } from '../placesInsight'

describe('insightKey', () => {
  it('四个后端 key 各映射到对应 New-UI 键', () => {
    expect(insightKey('photos.places.insight.mostPhotographed')).toBe('photosPlacesInsightMostPhotographed')
    expect(insightKey('photos.places.insight.topSpot')).toBe('photosPlacesInsightTopSpot')
    expect(insightKey('photos.places.insight.companions')).toBe('photosPlacesInsightCompanions')
    expect(insightKey('photos.places.insight.home')).toBe('photosPlacesInsightHome')
  })
  it('未知 key 返回 null(调用方据此跳过卡片,不把后端 key 渲染给用户)', () => {
    expect(insightKey('photos.places.insight.whatever')).toBeNull()
    expect(insightKey('')).toBeNull()
  })
  it('映射表恰好四条,与后端 places.go 的 insights() 一一对应', () => {
    expect(Object.keys(INSIGHT_KEY_MAP)).toHaveLength(4)
  })
})

describe('joinCompanionNames', () => {
  it('数组用 " · " 拼接(与到访记录里 faces 的拼法同口径)', () => {
    expect(joinCompanionNames(['小明', '小红'])).toBe('小明 · 小红')
  })
  it('单元素数组不带分隔符', () => {
    expect(joinCompanionNames(['小明'])).toBe('小明')
  })
  it('字符串原样返回(后端某天改成单字符串也不炸)', () => {
    expect(joinCompanionNames('小明')).toBe('小明')
  })
  it('null / undefined / 数字 → 空串', () => {
    expect(joinCompanionNames(null)).toBe('')
    expect(joinCompanionNames(undefined)).toBe('')
    expect(joinCompanionNames(42)).toBe('')
  })
  it('数组元素非字符串时按 String() 归一,空元素被剔除', () => {
    expect(joinCompanionNames(['小明', '', null, 7])).toBe('小明 · 7')
  })
})
