import { describe, it, expect, beforeEach } from 'vitest'
import { parseAddress, readHosts, addHost, writeHosts } from './sambaHistory'

beforeEach(() => localStorage.clear())

describe('parseAddress', () => {
  it('解析 smb:// 并取 / 前主机', () => {
    expect(parseAddress('smb://192.168.1.10/share')).toEqual({ protocol: 'smb', host: '192.168.1.10' })
  })
  it('解析 nfs://', () => {
    expect(parseAddress('nfs://10.0.0.2')).toEqual({ protocol: 'nfs', host: '10.0.0.2' })
  })
  it('无合法前缀 → protocol null', () => {
    expect(parseAddress('192.168.1.1')).toEqual({ protocol: null, host: '' })
  })
})

describe('samba host history', () => {
  it('addHost 去重(host+guest)且不含密码字段', () => {
    let list = addHost([], { host: 'h', guest: true, username: '' })
    list = addHost(list, { host: 'h', guest: true, username: '' }) // 重复
    expect(list).toEqual([{ host: 'h', guest: true, username: '' }])
    expect(Object.keys(list[0])).not.toContain('password')
  })
  it('write→read 往返', () => {
    writeHosts([{ host: 'h', guest: false, username: 'u' }])
    expect(readHosts()).toEqual([{ host: 'h', guest: false, username: 'u' }])
  })
  it('localStorage 损坏时 readHosts 返回 []', () => {
    localStorage.setItem('nimoos:samba-hosts', '{bad json')
    expect(readHosts()).toEqual([])
  })
})
