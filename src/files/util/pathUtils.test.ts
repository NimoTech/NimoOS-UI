import { describe, it, expect } from 'vitest'
import { toVirtualPath, toRealPath, virtualPathToRouteParam, routeParamToVirtualPath, resolveInputPath } from './pathUtils'

const DN = { '/DATA': 'NimoOS-HD', '/media/usb1': 'MyUSB' }

describe('pathUtils', () => {
  it('toVirtualPath maps mount point (longest-first) and passes through unknown', () => {
    expect(toVirtualPath('/DATA/Documents', DN)).toBe('/NimoOS-HD/Documents')
    expect(toVirtualPath('/DATA', DN)).toBe('/NimoOS-HD')
    expect(toVirtualPath('/media/usb1/a', DN)).toBe('/MyUSB/a')
    expect(toVirtualPath('/etc/hosts', DN)).toBe('/etc/hosts')
  })

  it('toRealPath reverses using display name (longest-first)', () => {
    expect(toRealPath('/NimoOS-HD/Documents', DN)).toBe('/DATA/Documents')
    expect(toRealPath('/NimoOS-HD', DN)).toBe('/DATA')
    expect(toRealPath('/MyUSB/a', DN)).toBe('/media/usb1/a')
    expect(toRealPath('/Nowhere/x', DN)).toBe('/Nowhere/x')
  })

  it('virtualPathToRouteParam percent-encodes each segment; root → empty', () => {
    expect(virtualPathToRouteParam('/NimoOS-HD/My Folder')).toBe('NimoOS-HD/My%20Folder')
    expect(virtualPathToRouteParam('/')).toBe('')
    expect(virtualPathToRouteParam('')).toBe('')
  })

  it('routeParamToVirtualPath rebuilds virtual path from router4 param (array or string)', () => {
    expect(routeParamToVirtualPath(['NimoOS-HD', 'My Folder'])).toBe('/NimoOS-HD/My Folder')
    expect(routeParamToVirtualPath('NimoOS-HD/Docs')).toBe('/NimoOS-HD/Docs')
    expect(routeParamToVirtualPath(undefined)).toBe('/')
    expect(routeParamToVirtualPath([])).toBe('/')
  })
})

describe('resolveInputPath (normalize old deep-link format, same as Vue2)', () => {
  const dn = { '/DATA': 'NimoOS-HD', '/mnt/smb-nas': 'nas' }

  it('real path → normalize to virtual', () => {
    expect(resolveInputPath('/DATA/Documents', dn)).toEqual({ realPath: '/DATA/Documents', virtualPath: '/NimoOS-HD/Documents' })
  })

  it('virtual path input → normalized as-is', () => {
    expect(resolveInputPath('/NimoOS-HD/Documents', dn)).toEqual({ realPath: '/DATA/Documents', virtualPath: '/NimoOS-HD/Documents' })
  })

  it('mount root itself (real = mount point)', () => {
    expect(resolveInputPath('/mnt/smb-nas', dn)).toEqual({ realPath: '/mnt/smb-nas', virtualPath: '/nas' })
  })

  it('unknown prefix (not in displayNames) pass through as-is', () => {
    expect(resolveInputPath('/unknown/x', dn)).toEqual({ realPath: '/unknown/x', virtualPath: '/unknown/x' })
  })

  it('empty input → root', () => {
    expect(resolveInputPath('', dn)).toEqual({ realPath: '/', virtualPath: '/' })
  })
})
