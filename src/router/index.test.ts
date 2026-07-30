import { describe, it, expect, vi } from 'vitest'

// router/index.ts pulls in Welcome.vue → lottie-web, which calls canvas getContext();
// jsdom has no canvas backend. Same mock as Welcome.test.ts to make router importable here.
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(() => ({ addEventListener: vi.fn(), destroy: vi.fn() })) } }))

import { router } from './index'
// 评审 M5:原来这里的注释声称"完整的顺序/未重排断言见 PhotosPlaces.test.ts",但那份文件
// 只用 `?raw` 取 PhotosPlaces.vue 自己的样式块做 pointer-events 断言,从未读过 router/index.ts
// 的源文本——那句话是不实的。真正的顺序/未重排断言就近放在这里,用 `?raw` 读原始文本核对。
import routerIndexRaw from './index.ts?raw'

describe('router', () => {
  it('/files/shares 命中 files-shares 而非 catch-all files-path', () => {
    const m = router.resolve('/files/shares')
    expect(m.name).toBe('files-shares')
  })
  it('/files/NimoOS-HD/Documents 仍命中 files-path', () => {
    const m = router.resolve('/files/NimoOS-HD/Documents')
    expect(m.name).toBe('files-path')
  })
  it('/photos/favorites 命中 photos-favorites 路由', () => {
    const m = router.resolve('/photos/favorites')
    expect(m.name).toBe('photos-favorites')
  })
  it('/photos/trash 命中 photos-trash 路由', () => {
    const m = router.resolve('/photos/trash')
    expect(m.name).toBe('photos-trash')
  })
  it('/photos/albums 命中 photos-albums 路由', () => {
    const m = router.resolve('/photos/albums')
    expect(m.name).toBe('photos-albums')
  })
  it('/photos/albums/7 命中 photos-album-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/albums/7')
    expect(m.name).toBe('photos-album-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/people 命中 photos-people 路由', () => {
    const m = router.resolve('/photos/people')
    expect(m.name).toBe('photos-people')
  })
  it('/photos/people/7 命中 photos-person-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/people/7')
    expect(m.name).toBe('photos-person-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/places 命中 photos-places 路由', () => {
    const m = router.resolve('/photos/places')
    expect(m.name).toBe('photos-places')
  })

  // P6a-T11:只追加,不重排——新路由必须夹在 /photos/people/:id 与 /login 之间,且两者
  // 本身的相对顺序不能被打乱(评审 M5:之前这条断言只存在于一句不实的注释里,这里补真的)。
  it('/photos/places 追加在 /photos/people/:id 之后、/login 之前(只追加,不重排)', () => {
    const peopleDetailIdx = routerIndexRaw.indexOf(`{ path: '/photos/people/:id'`)
    const placesIdx = routerIndexRaw.indexOf(`{ path: '/photos/places'`)
    const loginIdx = routerIndexRaw.indexOf(`{ path: '/login'`)
    expect(peopleDetailIdx).toBeGreaterThan(-1)
    expect(placesIdx).toBeGreaterThan(peopleDetailIdx)
    expect(loginIdx).toBeGreaterThan(placesIdx)
  })
})
