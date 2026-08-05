// SP7-P7b-T1: EXIF 过滤谓词。
// 移植自 Vue2 NimoOS-UI tests/photosFilterUtils.test.js(58 行),按 D17/F2 裁掉
// 「excludes archived ids」一条(归档六环在 Vue2 已全死、New-UI 未迁),另加 F1 回归。
import { describe, expect, it } from 'vitest'
import { applyExifFilters, matchesExifFilters, photoYear } from '../photosFilterUtils'

// 用本地化日期串(与 assetToPhoto 产出的 `date` 同形态),这样 getFullYear() 返回的
// 是名义年份,不受测试机时区影响。
const p = (over: Record<string, unknown> = {}) => ({
  id: 'x', date: 'May 1, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 35mm', ...over,
})

describe('photosFilterUtils', () => {
  it('photoYear 取出年份,无日期时返回空串', () => {
    expect(photoYear(p())).toBe('2023')
    expect(photoYear(p({ date: '' }))).toBe('')
  })

  it('photoYear 对 Invalid Date 返回空串', () => {
    expect(photoYear({ date: 'not-a-date' })).toBe('')
  })

  it('photoYear 对 null/undefined 返回空串', () => {
    expect(photoYear(null)).toBe('')
    expect(photoYear(undefined)).toBe('')
  })

  it('未设任何筛选时全部通过', () => {
    expect(matchesExifFilters(p(), {})).toBe(true)
    expect(matchesExifFilters(p())).toBe(true)
  })

  it('按年份 / 城市名段 / 机身名段过滤', () => {
    expect(matchesExifFilters(p(), { years: ['2023'] })).toBe(true)
    expect(matchesExifFilters(p(), { years: ['2024'] })).toBe(false)
    expect(matchesExifFilters(p(), { places: ['Tokyo'] })).toBe(true)
    expect(matchesExifFilters(p(), { places: ['Osaka'] })).toBe(false)
    expect(matchesExifFilters(p(), { cameras: ['Sony A7'] })).toBe(true)
    expect(matchesExifFilters(p(), { cameras: ['Canon'] })).toBe(false)
  })

  it('多个维度同时生效时是 AND 语义', () => {
    expect(matchesExifFilters(p(), { years: ['2023'], places: ['Osaka'] })).toBe(false)
    expect(matchesExifFilters(p(), { years: ['2023'], places: ['Tokyo'] })).toBe(true)
    expect(matchesExifFilters(p(), { years: ['2022'], places: ['Tokyo'] })).toBe(false)
  })

  it('无日期的照片只在年份筛选生效时才被排除', () => {
    expect(matchesExifFilters(p({ date: '' }), {})).toBe(true)
    expect(matchesExifFilters(p({ date: '' }), { years: ['2023'] })).toBe(false)
  })

  it('place/camera 为 null 时按空串参与匹配,不抛错', () => {
    expect(matchesExifFilters(p({ place: null }), { places: ['Tokyo'] })).toBe(false)
    expect(matchesExifFilters(p({ camera: null }), { cameras: ['Sony A7'] })).toBe(false)
    expect(matchesExifFilters(p({ place: null, camera: null }), {})).toBe(true)
  })

  it('applyExifFilters 过滤列表并容忍 null 入参', () => {
    const list = [
      p({ id: '1', date: 'January 1, 2023' }),
      p({ id: '2', date: 'January 1, 2022' }),
    ]
    expect(applyExifFilters(list, { years: ['2023'] }).map(x => x.id)).toEqual(['1'])
    expect(applyExifFilters(null, { years: ['2023'] })).toEqual([])
    expect(applyExifFilters(undefined, { years: ['2023'] })).toEqual([])
  })

  it('D17/F2:archiveIds 分支已移除——传了也不生效', () => {
    // Vue2 版本会因 archiveIds 命中而返回 false;本仓已把该分支整条删掉,
    // 多余的键必须被忽略(而不是悄悄恢复归档语义)。
    expect(matchesExifFilters(p({ id: 'arch' }), { archiveIds: ['arch'] } as never)).toBe(true)
  })
})
