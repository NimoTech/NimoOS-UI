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
    expect(s.memoryMB).toBe(512)              // raw byte count "536870912" → MB
    expect(m.webui.portMap).toBe('8384')
    expect(m.webui.titleCustom).toBe('我的同步')
    expect(m.extKey).toBe('x-nimoos')
    expect(m.tipsCustom).toBe('Initial admin setup required.')  // falls back to before_install when custom is absent
    expect(m.tipsFromFallback).toBe(true)                       // flag: value is prefilled from the fallback, not a user-confirmed custom
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
  it('command parsing: array items mapped to tokens, commandDirty initially false', () => {
    const m = parseSettings(FIXTURE, 'zh_cn')
    expect(m.services[0].commandTokens).toEqual(['--verbose'])
    expect(m.services[0].commandDirty).toBe(false)
  })
  it('command parsing: string conservatively displayed as single token, commandDirty initially false', () => {
    const y = 'services:\n  a:\n    image: x\n    command: echo "hello world"\n'
    const m = parseSettings(y, 'zh_cn')
    expect(m.services[0].commandTokens).toEqual(['echo "hello world"'])
    expect(m.services[0].commandDirty).toBe(false)
  })
  it('command parsing: default to empty tokens', () => {
    const m = parseSettings('services:\n  a:\n    image: x\n', 'zh_cn')
    expect(m.services[0].commandTokens).toEqual([])
  })
  it('network parsing: network_mode takes precedence over networks, networkDirty initially false', () => {
    const y = 'services:\n  a:\n    image: x\n    network_mode: host\n    networks: [other]\n'
    const m = parseSettings(y, 'zh_cn')
    expect(m.services[0].network).toBe('host')
    expect(m.services[0].networkDirty).toBe(false)
  })
  it('network parsing: when network_mode is absent, take first element/key of networks, defaults to empty string if both absent', () => {
    expect(parseSettings('services:\n  a:\n    image: x\n    networks: [mynet, other]\n', 'zh_cn').services[0].network).toBe('mynet')
    expect(parseSettings('services:\n  a:\n    image: x\n    networks:\n      mynet: {}\n      other: {}\n', 'zh_cn').services[0].network).toBe('mynet')
    expect(parseSettings('services:\n  a:\n    image: x\n', 'zh_cn').services[0].network).toBe('')
  })
})

describe('command/network dirty-flag build (D5)', () => {
  it('command unedited remains unchanged (string form not rewritten)', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n    command: echo "hello world"\n'
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { command: unknown }> }
    expect(out.services.a.command).toBe('echo "hello world"')
  })
  it('command after editing written as array form', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].commandTokens = ['redis-server', '--appendonly', 'yes']
    m.services[0].commandDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { command: unknown }> }
    expect(out.services.a.command).toEqual(['redis-server', '--appendonly', 'yes'])
  })
  it('command edited to empty tokens, delete command', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n    command: ["--verbose"]\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].commandTokens = []
    m.services[0].commandDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { command?: unknown }> }
    expect(out.services.a.command).toBeUndefined()
  })
  it('network unedited not written back (original network_mode preserved)', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n    network_mode: host\n'
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { network_mode?: string }> }
    expect(out.services.a.network_mode).toBe('host')
  })
  it('network choose host, write network_mode', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].network = 'host'; m.services[0].networkDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { network_mode?: string }> }
    expect(out.services.a.network_mode).toBe('host')
  })
  it('network choose custom network, write networks and merge top-level', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].network = 'mynet'; m.services[0].networkDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { networks?: string[] }>; networks?: Record<string, unknown> }
    expect(out.services.a.networks).toEqual(['mynet'])
    expect(out.networks).toHaveProperty('mynet')
  })
  it('network choose custom network, if top-level has same-name definition then preserve original (??= merge semantics)', () => {
    const yml = 'name: a\nservices:\n  a:\n    image: x\nnetworks:\n  mynet:\n    external: true\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].network = 'mynet'; m.services[0].networkDirty = true
    const out = YAML.parse(buildYaml(yml, m)) as { networks?: Record<string, { external?: boolean }> }
    expect(out.networks?.mynet.external).toBe(true)
  })
})

describe('rewriteImageTag', () => {
  it('replace existing tag', () => {
    expect(rewriteImageTag('linuxserver/syncthing:1.23.0', 'latest')).toBe('linuxserver/syncthing:latest')
  })
  it('append when no tag', () => {
    expect(rewriteImageTag('redis', 'stable')).toBe('redis:stable')
  })
  it('registry with port and no tag, append (not mistaking port for tag)', () => {
    expect(rewriteImageTag('myregistry:5000/redis', 'stable')).toBe('myregistry:5000/redis:stable')
  })
  it('registry with port and existing tag, only replace tag segment', () => {
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
    expect(svc.command).toEqual(['--verbose'])                    // unexposed fields preserved
    expect(svc.ports[0]).toMatchObject({ published: '9384', target: 8384, protocol: 'tcp' })
    expect(svc.environment).toContain('NEW=1')
    expect(svc.environment).toContain('TZ=$TZ')                   // template variables preserved as-is
    expect(svc.deploy.resources.limits?.memory).toBeUndefined()   // empty = remove the limit
    expect(svc.deploy.resources.reservations.memory).toBe('256M') // reservations untouched
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

describe('ports pass-through (P4 outstanding fix)', () => {
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
  it('unrecognized items go to portsExtra, recognized items go to ports', () => {
    const m = parseSettings(yml, 'zh_cn')
    const svc = m.services[0]
    expect(svc.ports).toEqual([{ published: '8443', target: '8443', protocol: 'tcp' }])
    expect(svc.portsExtra).toEqual([
      '25500-25600:25500-25600',
      '3000',
      { target: 19132, published: '19132-19140', protocol: 'udp' },
    ])
  })
  it('buildYaml writes back portsExtra as-is, does not collapse or lose', () => {
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { ports: unknown[] }> }
    const ports = out.services.crafty.ports
    expect(ports).toContainEqual('25500-25600:25500-25600')
    expect(ports).toContainEqual('3000')
    expect(ports).toContainEqual({ target: 19132, published: '19132-19140', protocol: 'udp' })
    // editable rows still serialize normally
    expect(ports).toContainEqual({ target: 8443, published: '8443', protocol: 'tcp' })
  })
  it('user editing editable rows does not affect pass-through items', () => {
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].ports[0].published = '9443'
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { ports: unknown[] }> }
    expect(out.services.crafty.ports).toContainEqual({ target: 8443, published: '9443', protocol: 'tcp' })
    expect(out.services.crafty.ports).toContainEqual('25500-25600:25500-25600')
  })

  it('long-format protocol not tcp/udp (e.g. sctp) → pass-through as-is, not converted to tcp editable row', () => {
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

describe('command conservative write-back (P6 fix: string no longer collapses to single-element exec array)', () => {
  it('string command marked commandWasString during parsing', () => {
    const m = parseSettings('services:\n  app:\n    image: redis\n    command: redis-server --appendonly yes\n', 'zh_cn')
    expect(m.services[0].commandWasString).toBe(true)
    expect(m.services[0].commandTokens).toEqual(['redis-server --appendonly yes'])
  })
  it('array command marked as false', () => {
    const m = parseSettings('services:\n  app:\n    image: redis\n    command: ["redis-server", "--appendonly"]\n', 'zh_cn')
    expect(m.services[0].commandWasString).toBe(false)
  })
  it('original string + still single token after editing → write back as string (not single-element array)', () => {
    const yml = 'services:\n  app:\n    image: redis\n    command: redis-server --appendonly yes\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].commandTokens = ['redis-server --appendonly no']
    m.services[0].commandDirty = true
    const doc = YAML.parse(buildYaml(yml, m))
    expect(doc.services.app.command).toBe('redis-server --appendonly no')
  })
  it('original string + edited to multiple tokens → write array normally', () => {
    const yml = 'services:\n  app:\n    image: redis\n    command: redis-server\n'
    const m = parseSettings(yml, 'zh_cn')
    m.services[0].commandTokens = ['redis-server', '--appendonly', 'yes']
    m.services[0].commandDirty = true
    const doc = YAML.parse(buildYaml(yml, m))
    expect(doc.services.app.command).toEqual(['redis-server', '--appendonly', 'yes'])
  })
})

describe('multiple networks protection (P6 fix: when networksMultiple, buildYaml does not touch networks)', () => {
  const MULTI = 'services:\n  app:\n    image: x\n    networks:\n      - net_a\n      - net_b\n'
  it('multiple networks marked networksMultiple during parsing', () => {
    expect(parseSettings(MULTI, 'zh_cn').services[0].networksMultiple).toBe(true)
  })
  it('single network/network_mode marked as false', () => {
    expect(parseSettings('services:\n  app:\n    image: x\n    networks: [net_a]\n', 'zh_cn').services[0].networksMultiple).toBe(false)
    expect(parseSettings('services:\n  app:\n    image: x\n    network_mode: host\n', 'zh_cn').services[0].networksMultiple).toBe(false)
  })
  it('dict-format multiple networks marked the same', () => {
    expect(parseSettings('services:\n  app:\n    image: x\n    networks:\n      net_a: {}\n      net_b: {}\n', 'zh_cn').services[0].networksMultiple).toBe(true)
  })
  it('even if networkDirty is mistakenly set to true, multi-network service networks remain unchanged (with brake)', () => {
    const m = parseSettings(MULTI, 'zh_cn')
    m.services[0].network = 'bridge'
    m.services[0].networkDirty = true
    const doc = YAML.parse(buildYaml(MULTI, m))
    expect(doc.services.app.networks).toEqual(['net_a', 'net_b'])
    expect(doc.services.app.network_mode).toBeUndefined()
  })
})

describe('mode:ingress tolerance (backend GET yaml normalization result, Crafty acceptance verified)', () => {
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
  it('mode:ingress single port goes to editable rows, mode:host goes to pass-through', () => {
    const m = parseSettings(yml, 'zh_cn')
    expect(m.services[0].ports).toEqual([{ published: '8111', target: '8443', protocol: 'tcp' }])
    expect(m.services[0].portsExtra).toEqual([{ target: 25565, published: '25565', protocol: 'tcp', mode: 'host' }])
  })
  it('omit mode when rebuilding (ingress is default, same meaning), mode:host preserved as-is', () => {
    const m = parseSettings(yml, 'zh_cn')
    const out = YAML.parse(buildYaml(yml, m)) as { services: Record<string, { ports: unknown[] }> }
    expect(out.services.crafty.ports).toContainEqual({ target: 8443, published: '8111', protocol: 'tcp' })
    expect(out.services.crafty.ports).toContainEqual({ target: 25565, published: '25565', protocol: 'tcp', mode: 'host' })
  })
})
