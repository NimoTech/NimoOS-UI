import { describe, expect, it, vi } from 'vitest'
import { INSIGHT_KEY_MAP, insightKey, joinCompanionNames } from '../placesInsight'

describe('insightKey', () => {
  it('each of the four backend keys maps to its corresponding New-UI key', () => {
    expect(insightKey('photos.places.insight.mostPhotographed')).toBe('photosPlacesInsightMostPhotographed')
    expect(insightKey('photos.places.insight.topSpot')).toBe('photosPlacesInsightTopSpot')
    expect(insightKey('photos.places.insight.companions')).toBe('photosPlacesInsightCompanions')
    expect(insightKey('photos.places.insight.home')).toBe('photosPlacesInsightHome')
  })
  it('unknown key returns null (caller uses this to skip the card, never renders the raw backend key to the user)', () => {
    expect(insightKey('photos.places.insight.whatever')).toBeNull()
    expect(insightKey('')).toBeNull()
  })
  it('the map has exactly four entries, one-to-one with the backend places.go insights()', () => {
    expect(Object.keys(INSIGHT_KEY_MAP)).toHaveLength(4)
  })
})

describe('joinCompanionNames', () => {
  it('joins an array with " · " (same convention as the faces join in visit records)', () => {
    expect(joinCompanionNames(['小明', '小红'])).toBe('小明 · 小红')
  })
  it('a single-element array has no separator', () => {
    expect(joinCompanionNames(['小明'])).toBe('小明')
  })
  it('a plain string is returned as-is (won\'t break if the backend switches to a single string one day)', () => {
    expect(joinCompanionNames('小明')).toBe('小明')
  })
  it('null / undefined / number → empty string', () => {
    expect(joinCompanionNames(null)).toBe('')
    expect(joinCompanionNames(undefined)).toBe('')
    expect(joinCompanionNames(42)).toBe('')
  })
  it('non-string array elements are normalized with String(), empty elements are dropped', () => {
    expect(joinCompanionNames(['小明', '', null, 7])).toBe('小明 · 7')
  })
})
