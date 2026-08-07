import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createUsers } from './users'

function http(map: Record<string, unknown>, seen?: { url?: string; body?: unknown }): AxiosInstance {
  return {
    get: async (url: string) => { if (seen) seen.url = url; return { data: map[url] } },
    post: async (url: string, body: unknown) => { if (seen) { seen.url = url; seen.body = body }; return { data: map[url] } },
  } as unknown as AxiosInstance
}

describe('createUsers', () => {
  it('getCustomStorage unwraps enveloped data', async () => {
    const u = createUsers(http({ '/users/current/custom/home_layout': { success: 200, data: [{ k: 1 }] } }))
    expect(await u.getCustomStorage('home_layout')).toEqual([{ k: 1 }])
  })
  it('setCustomStorage posts to the key path with the data body', async () => {
    const seen: { url?: string; body?: unknown } = {}
    const u = createUsers(http({ '/users/current/custom/home_layout': { success: 200, data: 'ok' } }, seen))
    await u.setCustomStorage('home_layout', [{ k: 2 }])
    expect(seen.url).toBe('/users/current/custom/home_layout')
    expect(seen.body).toEqual([{ k: 2 }])
  })
  it('getEvents returns a bare array as-is', async () => {
    const arr = [{ uuid: 'a', name: 'app:install-end', properties: '{}', timestamp: 1 }]
    const u = createUsers(http({ '/v2/users/events': arr }))
    expect(await u.getEvents()).toEqual(arr)
  })
  it('getEvents unwraps an envelope', async () => {
    const arr = [{ uuid: 'b', name: 'x', properties: '{}', timestamp: 2 }]
    const u = createUsers(http({ '/v2/users/events': { success: 200, data: arr } }))
    expect(await u.getEvents()).toEqual(arr)
  })
  it('login posts credentials and unwraps token+user', async () => {
    const seen: { url?: string; body?: unknown } = {}
    const u = createUsers(http({
      '/users/login': { success: 200, data: { token: { access_token: 'a', refresh_token: 'r', expires_at: '99' }, user: { username: 'nimo' } } },
    }, seen))
    const res = await u.login('nimo', 'pw')
    expect(seen.url).toBe('/users/login')
    expect(seen.body).toEqual({ username: 'nimo', password: 'pw' })
    expect(res.token.access_token).toBe('a')
    expect(res.user.username).toBe('nimo')
  })
  it('register posts username/password/key', async () => {
    const seen: { url?: string; body?: unknown } = {}
    const u = createUsers(http({ '/users/register': { success: 200, data: null } }, seen))
    await u.register('nimo', 'pw', 'K1')
    expect(seen.url).toBe('/users/register')
    expect(seen.body).toEqual({ username: 'nimo', password: 'pw', key: 'K1' })
  })
  it('getStatus unwraps initialized+key', async () => {
    const u = createUsers(http({ '/users/status': { success: 200, data: { initialized: false, key: 'K9' } } }))
    expect(await u.getStatus()).toEqual({ initialized: false, key: 'K9' })
  })
})

// ── SP9-P4 追加 ───────────────────────────────────────────────────────────
// fixture 全部来自 2026-08-01 真机 curl(见 plan §Fixtures),不得手编。

function httpAll(map: Record<string, unknown>, calls?: { url: string; body?: unknown }[]): AxiosInstance {
  const rec = (url: string, body?: unknown) => { calls?.push({ url, body }) }
  return {
    get: async (url: string) => { rec(url); return { data: map[url] } },
    post: async (url: string, body: unknown) => { rec(url, body); return { data: map[url] } },
    put: async (url: string, body: unknown) => { rec(url, body); return { data: map[url] } },
    delete: async (url: string) => { rec(url); return { data: map[url] } },
  } as unknown as AxiosInstance
}

describe('createUsers — SP9-P4 users 域补全', () => {
  // 真机响应逐字:{"success":200,"message":"ok","data":{...}}
  const CURRENT = {
    success: 200, message: 'ok',
    data: {
      id: 1, username: 'nimoos', role: 'admin', email: '', nickname: '',
      avatar: '', description: '',
      created_at: '0001-01-01T00:00:00Z', updated_at: '0001-01-01T00:00:00Z',
    },
  }

  it('getUserInfo 走 /users/current 并剥一层信封', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/current': CURRENT }, calls))
    const info = await u.getUserInfo()
    expect(calls[0].url).toBe('/users/current')
    expect(info.username).toBe('nimoos')
    expect(info.role).toBe('admin')
    expect(info.avatar).toBe('')
  })

  it('getMembers 剥信封;真机返回空数组', async () => {
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: [] } }))
    expect(await u.getMembers()).toEqual([])
  })

  it('getMembers 非数组 data 一律回退成 [](后端 nil slice 防线)', async () => {
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: null } }))
    expect(await u.getMembers()).toEqual([])
  })

  it('getMembers 保留 folder_count / created_at / role 原字段名', async () => {
    const one = { id: 3, username: 'alice', role: 'user', folder_count: 2, created_at: '2026-07-01T10:20:30Z' }
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: [one] } }))
    expect(await u.getMembers()).toEqual([one])
  })

  it('getMemberFolders 拼 /users/members/<id>/folders 并剥信封', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/members/7/folders': { success: 200, message: 'ok', data: [] } }, calls))
    expect(await u.getMemberFolders(7)).toEqual([])
    expect(calls[0].url).toBe('/users/members/7/folders')
  })

  it('getMemberFolders 非数组 data 回退成 []', async () => {
    const u = createUsers(httpAll({ '/users/members/7/folders': { success: 200, message: 'ok', data: null } }))
    expect(await u.getMemberFolders(7)).toEqual([])
  })
})

describe('createUsers — SP9-P4 写端点(⛔ 未经 curl 实证,类型只照 Go struct 对)', () => {
  it('changePassword 用 old_password / password 两个 snake_case 键 PUT', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/current/password': { success: 200, message: 'ok', data: {} } }, calls))
    await u.changePassword('old-pw', 'new-pw')
    expect(calls[0].url).toBe('/users/current/password')
    expect(calls[0].body).toEqual({ old_password: 'old-pw', password: 'new-pw' })
  })

  it('saveAvatar 把 dataURL 放进 { file } PUT 到 /users/avatar', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/avatar': { success: 200, message: 'ok', data: {} } }, calls))
    await u.saveAvatar('data:image/png;base64,AAAA')
    expect(calls[0].url).toBe('/users/avatar')
    expect(calls[0].body).toEqual({ file: 'data:image/png;base64,AAAA' })
  })

  it('avatarPath 带 token 与 v 版本号(缓存击穿)', () => {
    const u = createUsers(httpAll({}))
    expect(u.avatarPath(3, 'tok en')).toBe('/v1/users/avatar?token=tok%20en&v=3')
  })

  it('avatarPath 无 token 时不带 token 参数', () => {
    const u = createUsers(httpAll({}))
    expect(u.avatarPath(1, null)).toBe('/v1/users/avatar?v=1')
  })

  it('createMember POST username/password 并剥信封', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const created = { id: 5, username: 'bob', role: 'user', folder_count: 0, created_at: 'x' }
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: created } }, calls))
    expect(await u.createMember('bob', 'pw1234')).toEqual(created)
    expect(calls[0].body).toEqual({ username: 'bob', password: 'pw1234' })
  })

  it('deleteUser DELETE /users/<id>', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/9': { success: 200, message: 'ok' } }, calls))
    await u.deleteUser(9)
    expect(calls[0].url).toBe('/users/9')
  })

  it('grantMemberFolder 默认 read,body 是 { path, permission }', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const perm = { id: 1, user_id: 3, path: '/DATA/Downloads', permission: 'read', created_at: 'x' }
    const u = createUsers(httpAll({ '/users/members/3/folders': { success: 200, message: 'ok', data: perm } }, calls))
    expect(await u.grantMemberFolder(3, '/DATA/Downloads')).toEqual(perm)
    expect(calls[0].body).toEqual({ path: '/DATA/Downloads', permission: 'read' })
  })

  it('grantMemberFolder 显式 write 会透传', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/members/3/folders': { success: 200, message: 'ok', data: {} } }, calls))
    await u.grantMemberFolder(3, '/DATA/Docs', 'write')
    expect(calls[0].body).toEqual({ path: '/DATA/Docs', permission: 'write' })
  })

  it('revokeMemberFolder 把 perm_id 放进 query string(后端读 QueryParam,不是 body)', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/members/3/folders?perm_id=11': { success: 200, message: 'ok' } }, calls))
    await u.revokeMemberFolder(3, 11)
    expect(calls[0].url).toBe('/users/members/3/folders?perm_id=11')
  })

  it('setUserInfo PUT /users/current 并剥信封(本期无消费方,见 plan C10)', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/current': { success: 200, message: 'ok', data: { username: 'x' } } }, calls))
    expect(await u.setUserInfo({ username: 'x' })).toEqual({ username: 'x' })
    expect(calls[0].url).toBe('/users/current')
  })
})

describe('user image (SP11 wallpaper)', () => {
  it('uploadImage posts multipart with the file under `file`', async () => {
    const calls: { url: string; body: unknown }[] = []
    const http = {
      post: async (url: string, body: unknown) => {
        calls.push({ url, body })
        return { data: { success: 200, message: 'ok', data: { path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: '/v1/users/image?path=/d/1/wallpaper.jpg' } } }
      },
    }
    const users = createUsers(http as never)
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const res = await users.uploadImage('wallpaper', file)

    expect(calls[0].url).toBe('/users/current/image/wallpaper')
    expect(calls[0].body).toBeInstanceOf(FormData)
    expect((calls[0].body as FormData).get('file')).toBe(file)
    expect(res.online_path).toContain('/v1/users/image?path=')
  })

  it('setImageFromPath puts the nas path as json', async () => {
    const calls: { url: string; body: unknown }[] = []
    const http = {
      put: async (url: string, body: unknown) => {
        calls.push({ url, body })
        return { data: { success: 200, message: 'ok', data: { path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: '/v1/users/image?path=/d/1/wallpaper.png' } } }
      },
    }
    const users = createUsers(http as never)
    await users.setImageFromPath('wallpaper', '/DATA/Gallery/a.png')

    expect(calls[0].url).toBe('/users/current/image/wallpaper')
    expect(calls[0].body).toEqual({ path: '/DATA/Gallery/a.png' })
  })

  it.each([
    [60001, 'File does not exist'],
    [10009, 'Not an image'],
    [10010, 'Image too large'],
  ])('setImageFromPath rejects on success=%i even though the status is 200', async (code, msg) => {
    // PutUserImage returns http.StatusOK for every failure (user.go:880-916), so a
    // caller reading res.data directly would treat "image too large" as success.
    const http = { put: async () => ({ data: { success: code, message: msg, data: null } }) }
    const users = createUsers(http as never)
    await expect(users.setImageFromPath('wallpaper', '/DATA/huge.jpg')).rejects.toThrow(msg)
  })
})
