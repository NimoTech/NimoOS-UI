import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createDriver } from './driver'

describe('createDriver', () => {
  it('listDrivers 标准信封 → 映射 auth_url→authUrl', async () => {
    const http = { get: async () => ({ data: { success: 200, data: [
      { name: 'Dropbox', icon: './img/driver/Dropbox.svg', auth_url: 'https://x?state=${HOST}%2Fv1%2Frecover%2FDropbox' },
    ] } }) } as unknown as AxiosInstance
    expect(await createDriver(http).listDrivers()).toEqual([
      { name: 'Dropbox', icon: './img/driver/Dropbox.svg', authUrl: 'https://x?state=${HOST}%2Fv1%2Frecover%2FDropbox' },
    ])
  })
  it('listDrivers 裸数组容错', async () => {
    const http = { get: async () => ({ data: [{ name: 'n', icon: 'i', auth_url: 'u' }] }) } as unknown as AxiosInstance
    expect(await createDriver(http).listDrivers()).toEqual([{ name: 'n', icon: 'i', authUrl: 'u' }])
  })

  it('googleDriveCustomAuth 发 POST /driver/google_drive/auth 并解出 auth_url', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const authUrl = 'https://accounts.google.com/o/oauth2/auth?client_id=x&state=${HOST}%2Fv1%2Frecover%2FGoogleDrive%3Fsid%3Dabc'
    const http = {
      post: async (url: string, body: unknown) => {
        calls.push({ url, body })
        return { data: { success: 200, message: 'ok', data: { auth_url: authUrl } } }
      },
    } as unknown as AxiosInstance
    expect(await createDriver(http).googleDriveCustomAuth('my-id', 'my-secret')).toBe(authUrl)
    expect(calls).toEqual([{
      url: '/driver/google_drive/auth',
      body: { client_id: 'my-id', client_secret: 'my-secret' },
    }])
  })

  it('googleDriveCustomAuth 空 body(后端 4000 畸形路径)→ 抛错', async () => {
    const http = { post: async () => ({ data: '' }) } as unknown as AxiosInstance
    await expect(createDriver(http).googleDriveCustomAuth('a', 'b')).rejects.toThrow()
  })

  it('googleDriveCustomAuth 信封缺 auth_url → 抛错', async () => {
    const http = { post: async () => ({ data: { success: 200, message: 'ok', data: {} } }) } as unknown as AxiosInstance
    await expect(createDriver(http).googleDriveCustomAuth('a', 'b')).rejects.toThrow()
  })
})
