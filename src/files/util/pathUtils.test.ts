import { describe, it, expect } from 'vitest'
import { toVirtualPath, toRealPath, virtualPathToRouteParam, routeParamToVirtualPath } from './pathUtils'

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
