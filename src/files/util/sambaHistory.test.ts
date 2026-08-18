import { describe, it, expect, beforeEach } from 'vitest'
import { parseAddress, readHosts, addHost, writeHosts } from './sambaHistory'

beforeEach(() => localStorage.clear())

describe('parseAddress', () => {
  it('Parse smb:// and extract host before /', () => {
    expect(parseAddress('smb://192.168.1.10/share')).toEqual({ protocol: 'smb', host: '192.168.1.10' })
  })
  it('Parse nfs://', () => {
    expect(parseAddress('nfs://10.0.0.2')).toEqual({ protocol: 'nfs', host: '10.0.0.2' })
  })
  it('No valid prefix → protocol null', () => {
    expect(parseAddress('192.168.1.1')).toEqual({ protocol: null, host: '' })
  })
})

describe('samba host history', () => {
  it('addHost deduplicates (host+guest) and excludes password field', () => {
    let list = addHost([], { host: 'h', guest: true, username: '' })
    list = addHost(list, { host: 'h', guest: true, username: '' }) // duplicate
    expect(list).toEqual([{ host: 'h', guest: true, username: '' }])
    expect(Object.keys(list[0])).not.toContain('password')
  })
  it('write → read round-trip', () => {
    writeHosts([{ host: 'h', guest: false, username: 'u' }])
    expect(readHosts()).toEqual([{ host: 'h', guest: false, username: 'u' }])
  })
  it('readHosts returns [] when localStorage is corrupted', () => {
    localStorage.setItem('nimoos:samba-hosts', '{bad json')
    expect(readHosts()).toEqual([])
  })
})
