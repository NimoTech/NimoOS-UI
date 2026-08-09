// SP15-P1-T1: moments HTTP 层。回源核对 NimoOS-Photos/route/v1/moments.go —
// List 返回 {moments:[…]}(带包裹键,不是裸数组);Assets 带 with_members=1 时返回
// {assets,members,places},不带时是裸数组;Pin/Exclude 返回 {ok,asset_count};
// CreateAlbum 返回 201 {albumId,name,count}。
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; params?: unknown; body?: unknown; cfg?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => {
      calls.push({ method: 'get', url, params: cfg?.params }); return { data: reply }
    },
    post: async (url: string, body?: unknown) => {
      calls.push({ method: 'post', url, body }); return { data: reply }
    },
    put: async (url: string, body?: unknown) => {
      calls.push({ method: 'put', url, body }); return { data: reply }
    },
    delete: async (url: string, cfg?: unknown) => {
      calls.push({ method: 'delete', url, cfg }); return { data: reply }
    },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('photos moments API', () => {
  it('listMoments 解出 moments 数组,缺字段时兜底空数组', async () => {
    const a = harness({ moments: [{ id: 'm1' }] })
    expect(await a.photos.listMoments()).toEqual([{ id: 'm1' }])
    expect(a.calls[0]).toMatchObject({ method: 'get', url: '/photos/moments' })

    const b = harness({})
    expect(await b.photos.listMoments()).toEqual([])
  })

  it('getMomentAssets 只在为真时才带 featured / with_members 查询参数', async () => {
    const a = harness([])
    await a.photos.getMomentAssets('m1')
    expect(a.calls[0]).toMatchObject({ url: '/photos/moments/m1/assets', params: {} })

    const b = harness({ assets: [], members: [], places: [] })
    await b.photos.getMomentAssets('m1', true, true)
    expect(b.calls[0].params).toEqual({ featured: 1, with_members: 1 })
  })

  it('getMomentAssets 原样返回两种形状(裸数组 / {assets,members,places}),不在这层归一', async () => {
    const bare = harness([{ id: 'a1' }])
    expect(await bare.photos.getMomentAssets('m1')).toEqual([{ id: 'a1' }])

    const wrapped = harness({ assets: [{ id: 'a1' }], members: [{ asset_id: 'a1', manual: true, featured: false }], places: [{ name: 'X', count: 2 }] })
    expect(await wrapped.photos.getMomentAssets('m1', true, true)).toEqual({
      assets: [{ id: 'a1' }],
      members: [{ asset_id: 'a1', manual: true, featured: false }],
      places: [{ name: 'X', count: 2 }],
    })
  })

  it('pinMomentAssets / excludeMomentAssets 传 {ids} 并回传 asset_count', async () => {
    const a = harness({ ok: true, asset_count: 7 })
    expect(await a.photos.pinMomentAssets('m1', ['x', 'y'])).toEqual({ ok: true, asset_count: 7 })
    expect(a.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/m1/assets', body: { ids: ['x', 'y'] } })

    const b = harness({ ok: true, asset_count: 5 })
    expect(await b.photos.excludeMomentAssets('m1', ['x'])).toEqual({ ok: true, asset_count: 5 })
    // axios 的 delete 请求体必须放在 config.data 里,不能当第二位置参数
    expect(b.calls[0]).toMatchObject({ method: 'delete', url: '/photos/moments/m1/assets', cfg: { data: { ids: ['x'] } } })
  })

  it('deleteMoment / exportMomentAlbum / reorderMoments / recomputeMoments 打对 URL', async () => {
    const a = harness({})
    await a.photos.deleteMoment('m1')
    expect(a.calls[0]).toMatchObject({ method: 'delete', url: '/photos/moments/m1' })

    const b = harness({ albumId: 'al1', name: 'Trip', count: 12 })
    expect(await b.photos.exportMomentAlbum('m1')).toEqual({ albumId: 'al1', name: 'Trip', count: 12 })
    expect(b.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/m1/album', body: {} })

    const c = harness({})
    await c.photos.reorderMoments(['b', 'a'])
    expect(c.calls[0]).toMatchObject({ method: 'put', url: '/photos/moments/order', body: { ids: ['b', 'a'] } })

    const d = harness({})
    await d.photos.recomputeMoments()
    expect(d.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/recompute', body: {} })
  })
})
