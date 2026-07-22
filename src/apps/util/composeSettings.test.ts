import { describe, it, expect } from 'vitest'
import { parseSettings, buildYaml, parseMemoryToMB, minMemoryMB, rewriteImageTag } from './composeSettings'
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
  it('command 解析:数组逐项映射为 token,commandDirty 初始 false', () => {
    const m = parseSettings(FIXTURE, 'zh_cn')
    expect(m.services[0].commandTokens).toEqual(['--verbose'])
    expect(m.services[0].commandDirty).toBe(false)
  })
  it('command 解析:字符串保守展示为单 token,commandDirty 初始 false', () => {
    const y = 'services:\n  a:\n    image: x\n    command: echo "hello world"\n'
    const m = parseSettings(y, 'zh_cn')
    expect(m.services[0].commandTokens).toEqual(['echo "hello world"'])
    expect(m.services[0].commandDirty).toBe(false)
  })
  it('command 解析:缺省为空 tokens', () => {
    const m = parseSettings('services:\n  a:\n    image: x\n', 'zh_cn')
    expect(m.services[0].commandTokens).toEqual([])
  })
  it('network 解析:network_mode 优先于 networks,networkDirty 初始 false', () => {
    const y = 'services:\n  a:\n    image: x\n    network_mode: host\n    networks: [other]\n'
    const m = parseSettings(y, 'zh_cn')
    expect(m.services[0].network).toBe('host')
    expect(m.services[0].networkDirty).toBe(false)
  })
  it('network 解析:无 network_mode 时取 networks 首个元素/key,都缺省则空串', () => {
    expect(parseSettings('services:\n  a:\n    image: x\n    networks: [mynet, other]\n', 'zh_cn').services[0].network).toBe('mynet')
    expect(parseSettings('services:\n  a:\n    image: x\n    networks:\n      mynet: {}\n      other: {}\n', 'zh_cn').services[0].network).toBe('mynet')
    expect(parseSettings('services:\n  a:\n    image: x\n', 'zh_cn').services[0].network).toBe('')
  })
})

describe('command/network dirty-flag build (D5)', () => {
  it('command 未编辑原样保留(string 形式不被改写)', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n    command: echo "hello world"\n'
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { command: unknown }> }
    expect(out.services.a.command).toBe('echo "hello world"')
  })
  it('command 编辑后写数组形式', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].commandTokens = ['redis-server', '--appendonly', 'yes']
    m.services[0].commandDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { command: unknown }> }
    expect(out.services.a.command).toEqual(['redis-server', '--appendonly', 'yes'])
  })
  it('command 编辑为空 tokens 时删除 command', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n    command: ["--verbose"]\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].commandTokens = []
    m.services[0].commandDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { command?: unknown }> }
    expect(out.services.a.command).toBeUndefined()
  })
  it('network 未编辑不写回(原 network_mode 保留)', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n    network_mode: host\n'
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { network_mode?: string }> }
    expect(out.services.a.network_mode).toBe('host')
  })
  it('network 选 host 写 network_mode', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].network = 'host'; m.services[0].networkDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { network_mode?: string }> }
    expect(out.services.a.network_mode).toBe('host')
  })
  it('network 选自定义网络写 networks 并 merge 顶层', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].network = 'mynet'; m.services[0].networkDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { networks?: string[] }>; networks?: Record<string, unknown> }
    expect(out.services.a.networks).toEqual(['mynet'])
    expect(out.networks).toHaveProperty('mynet')
  })
  it('network 选自定义网络时顶层已有同名定义则保留原样(??= merge 语义)', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\nnetworks:\n  mynet:\n    external: true\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].network = 'mynet'; m.services[0].networkDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { networks?: Record<string, { external?: boolean }> }
    expect(out.networks?.mynet.external).toBe(true)
  })
})

describe('rewriteImageTag', () => {
  it('替换已有 tag', () => {
    expect(rewriteImageTag('linuxserver/syncthing:1.23.0', 'latest')).toBe('linuxserver/syncthing:latest')
  })
  it('无 tag 时追加', () => {
    expect(rewriteImageTag('redis', 'stable')).toBe('redis:stable')
  })
  it('registry 带端口且无 tag 时追加(不误判端口为 tag)', () => {
    expect(rewriteImageTag('myregistry:5000/redis', 'stable')).toBe('myregistry:5000/redis:stable')
  })
  it('registry 带端口且有 tag 时只替换 tag 段', () => {
    expect(rewriteImageTag('myregistry:5000/redis:1.2', 'stable')).toBe('myregistry:5000/redis:stable')
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

describe('ports pass-through (P4 挂账修复)', () => {
  const yml = `name: crafty
services:
  crafty:
    image: registry.gitlab.com/crafty-controller/crafty-4:latest
    ports:
      - "8443:8443"
      - "25500-25600:25500-25600"
      - "3000"
      - target: 19132
        published: 19132-19140
        protocol: udp
`
  it('认不出的条目进 portsExtra,认得出的进 ports', () => {
    const m = parseSettings(yml, 'zh_cn')
    const svc = m.services[0]
    expect(svc.ports).toEqual([{ published: '8443', target: '8443', protocol: 'tcp' }])
    expect(svc.portsExtra).toEqual([
      '25500-25600:25500-25600',
      '3000',
      { target: 19132, published: '19132-19140', protocol: 'udp' },
    ])
  })
  it('buildYaml 原样写回 portsExtra,不塌陷不丢失', () => {
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { ports: unknown[] }> }
    const ports = out.services.crafty.ports
    expect(ports).toContainEqual('25500-25600:25500-25600')
    expect(ports).toContainEqual('3000')
    expect(ports).toContainEqual({ target: 19132, published: '19132-19140', protocol: 'udp' })
    // 可编辑行仍正常序列化
    expect(ports).toContainEqual({ target: 8443, published: '8443', protocol: 'tcp' })
  })
  it('用户编辑可编辑行不影响透传条目', () => {
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].ports[0].published = '9443'
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { ports: unknown[] }> }
    expect(out.services.crafty.ports).toContainEqual({ target: 8443, published: '9443', protocol: 'tcp' })
    expect(out.services.crafty.ports).toContainEqual('25500-25600:25500-25600')
  })

  it('长格式 protocol 非 tcp/udp(如 sctp)→ 原样透传,不被夹成 tcp 可编辑行', () => {
    const y = `name: x
services:
  x:
    image: img
    ports:
      - target: 132
        published: 132
        protocol: sctp
`
    const m = parseSettings(y, 'zh_cn')
    const svc = m.services[0]
    expect(svc.ports).toEqual([])
    expect(svc.portsExtra).toEqual([{ target: 132, published: 132, protocol: 'sctp' }])
    const out = YAML.parse(buildYaml(y, m)) as { services: Record<string, { ports: unknown[] }> }
    expect(out.services.x.ports).toEqual([{ target: 132, published: 132, protocol: 'sctp' }])
  })
})

describe('mode:ingress 容忍(后端 GET yaml 归一化产物,Crafty 验收实锤)', () => {
  const yml = `name: crafty
services:
  crafty:
    image: crafty:latest
    ports:
      - target: 8443
        published: "8111"
        protocol: tcp
        mode: ingress
      - target: 25565
        published: "25565"
        protocol: tcp
        mode: host
`
  it('mode:ingress 的单端口进可编辑行,mode:host 进透传', () => {
    const m = parseSettings(yml, 'zh_cn')
    expect(m.services[0].ports).toEqual([{ published: '8111', target: '8443', protocol: 'tcp' }])
    expect(m.services[0].portsExtra).toEqual([{ target: 25565, published: '25565', protocol: 'tcp', mode: 'host' }])
  })
  it('重建时省略 mode(ingress 即默认,同义),mode:host 原样保留', () => {
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { ports: unknown[] }> }
    expect(out.services.crafty.ports).toContainEqual({ target: 8443, published: '8111', protocol: 'tcp' })
    expect(out.services.crafty.ports).toContainEqual({ target: 25565, published: '25565', protocol: 'tcp', mode: 'host' })
  })
})
