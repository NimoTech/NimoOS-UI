import { describe, it, expect } from 'vitest'
import { parseSettings, buildYaml, parseMemoryToMB, minMemoryMB } from './composeSettings'
import YAML from 'yaml'

const FIXTURE = `name: syncthing
services:
  syncthing:
    image: linuxserver/syncthing:1.23.0
    environment:
      - PUID=$PUID
      - TZ=$TZ
    ports:
      - "8384:8384/tcp"
      - target: 22000
        published: "22000"
        protocol: udp
    volumes:
      - /DATA/AppData/syncthing:/config
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: "536870912"
        reservations:
          memory: 256M
    command: ["--verbose"]
x-nimoos:
  scheme: http
  port_map: "8384"
  index: /
  icon: https://icon.nimoos.io/main/all/syncthing.png
  title:
    custom: 我的同步
  tips:
    before_install:
      en_us: Initial admin setup required.
`

describe('parseSettings', () => {
  it('maps services/env/ports/volumes/restart/memory and webui/tips', () => {
    const m = parseSettings(FIXTURE, 'zh_cn')
    expect(m.services).toHaveLength(1)
    const s = m.services[0]
    expect(s.name).toBe('syncthing')
    expect(s.image).toBe('linuxserver/syncthing:1.23.0')
    expect(s.environment).toEqual([{ a: 'PUID', b: '$PUID' }, { a: 'TZ', b: '$TZ' }])
    expect(s.ports).toEqual([
      { published: '8384', target: '8384', protocol: 'tcp' },
      { published: '22000', target: '22000', protocol: 'udp' },
    ])
    expect(s.volumes).toEqual([{ a: '/DATA/AppData/syncthing', b: '/config' }])
    expect(s.restart).toBe('unless-stopped')
    expect(s.memoryMB).toBe(512)              // 裸字节数 "536870912" → MB
    expect(m.webui.portMap).toBe('8384')
    expect(m.webui.titleCustom).toBe('我的同步')
    expect(m.extKey).toBe('x-nimoos')
    expect(m.tipsCustom).toBe('Initial admin setup required.')  // custom 缺省时回落 before_install
    expect(m.tipsFromFallback).toBe(true)                       // 标记:该值是借回落预填,非用户已确认的 custom
  })
  it('tipsFromFallback is false when tips.custom pre-exists', () => {
    const y = FIXTURE.replace('  tips:\n    before_install:\n      en_us: Initial admin setup required.\n', '  tips:\n    custom: 已有自定义提示\n')
    const m = parseSettings(y, 'zh_cn')
    expect(m.tipsCustom).toBe('已有自定义提示')
    expect(m.tipsFromFallback).toBe(false)
  })
  it('tipsFromFallback is false when both custom and before_install are absent', () => {
    const y = FIXTURE.replace('  tips:\n    before_install:\n      en_us: Initial admin setup required.\n', '')
    const m = parseSettings(y, 'zh_cn')
    expect(m.tipsCustom).toBe('')
    expect(m.tipsFromFallback).toBe(false)
  })
  it('extKey falls back to x-casaos when only x-casaos exists', () => {
    const y = FIXTURE.replace(/x-nimoos:/, 'x-casaos:')
    expect(parseSettings(y, 'zh_cn').extKey).toBe('x-casaos')
  })
  it('normalizes restart no/empty to unless-stopped and env object map to rows', () => {
    const m = parseSettings('services:\n  a:\n    image: x\n    restart: "no"\n    environment:\n      FOO: bar\n', 'zh_cn')
    expect(m.services[0].restart).toBe('unless-stopped')
    expect(m.services[0].environment).toEqual([{ a: 'FOO', b: 'bar' }])
  })
})

describe('buildYaml', () => {
  it('round-trips: untouched model keeps command/extensions; edits land; empty memory removes limit', () => {
    const m = parseSettings(FIXTURE, 'zh_cn')
    m.services[0].ports[0].published = '9384'
    m.services[0].environment.push({ a: 'NEW', b: '1' })
    m.services[0].memoryMB = null
    m.webui.portMap = '9384'
    const out = YAML.parse(buildYaml(FIXTURE, m))
    const svc = out.services.syncthing
    expect(svc.command).toEqual(['--verbose'])                    // 未暴露字段保留
    expect(svc.ports[0]).toMatchObject({ published: '9384', target: 8384, protocol: 'tcp' })
    expect(svc.environment).toContain('NEW=1')
    expect(svc.environment).toContain('TZ=$TZ')                   // 模板变量原样保留
    expect(svc.deploy.resources.limits?.memory).toBeUndefined()   // 留空=删限制
    expect(svc.deploy.resources.reservations.memory).toBe('256M') // reservations 不动
    expect(out['x-nimoos'].port_map).toBe('9384')
    expect(out['x-nimoos'].icon).toBe('https://icon.nimoos.io/main/all/syncthing.png')
  })
  it('writes tips.custom under extKey; clearing removes the key', () => {
    const m = parseSettings(FIXTURE, 'zh_cn')
    m.tipsCustom = '改端口后记得重登'
    let out = YAML.parse(buildYaml(FIXTURE, m))
    expect(out['x-nimoos'].tips.custom).toBe('改端口后记得重登')
    m.tipsCustom = '  '
    out = YAML.parse(buildYaml(FIXTURE, m))
    expect(out['x-nimoos'].tips.custom).toBeUndefined()
    expect(out['x-nimoos'].tips.before_install).toBeDefined()
  })
})

describe('parseMemoryToMB / minMemoryMB', () => {
  it('handles bytes, M, MB, G, g, null', () => {
    expect(parseMemoryToMB('536870912')).toBe(512)
    expect(parseMemoryToMB('512M')).toBe(512)
    expect(parseMemoryToMB('512MB')).toBe(512)
    expect(parseMemoryToMB('1G')).toBe(1024)
    expect(parseMemoryToMB(268435456)).toBe(256)
    expect(parseMemoryToMB(undefined)).toBeNull()
    expect(parseMemoryToMB('abc')).toBeNull()
  })
  it('minMemoryMB reads reservations of services[appId], falls back to first service, null-safe', () => {
    expect(minMemoryMB(FIXTURE, 'syncthing')).toBe(256)
    expect(minMemoryMB(FIXTURE, 'not-there')).toBe(256)
    expect(minMemoryMB('services: {}', 'x')).toBeNull()
    expect(minMemoryMB('not: yaml: [', 'x')).toBeNull()
  })
})
