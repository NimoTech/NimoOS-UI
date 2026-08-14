import { describe, it, expect } from 'vitest'
import YAML from 'yaml'
import { ensureComposeMeta, volumeAutoCheck, normalizeVolumes, dockerRunToCompose } from './importNormalize'

describe('ensureComposeMeta', () => {
  it('injects top-level name + x-nimoos title when both absent; never injects icon (dead domain)', () => {
    const src = `services:\n  sonarr:\n    image: linuxserver/sonarr:latest\n`
    const { yaml, name } = ensureComposeMeta(src)
    expect(name).toBe('sonarr')
    const doc = YAML.parse(yaml)
    expect(doc.name).toBe('sonarr')
    expect(doc['x-nimoos'].title).toEqual({ custom: 'sonarr', en_us: 'sonarr' })
    expect(doc['x-nimoos'].icon).toBeUndefined()
  })

  it('injects port_map from the first published host port (short syntax)', () => {
    const src = `services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "18080:80"\n`
    const { yaml } = ensureComposeMeta(src)
    expect(YAML.parse(yaml)['x-nimoos'].port_map).toBe('18080')
  })

  it('injects port_map from long syntax and skips range/bare entries', () => {
    const src = `services:\n  web:\n    image: foo\n    ports:\n      - "25500-25600:25500-25600"\n      - "3000"\n      - target: 80\n        published: 8081\n`
    const { yaml } = ensureComposeMeta(src)
    expect(YAML.parse(yaml)['x-nimoos'].port_map).toBe('8081')
  })

  it('does not overwrite an existing port_map and omits the key when no port is derivable', () => {
    const kept = ensureComposeMeta(`services:\n  web:\n    image: foo\n    ports: ["18080:80"]\nx-nimoos:\n  port_map: "9999"\n`)
    expect(YAML.parse(kept.yaml)['x-nimoos'].port_map).toBe('9999')
    const none = ensureComposeMeta(`services:\n  worker:\n    image: foo\n`)
    expect(YAML.parse(none.yaml)['x-nimoos'].port_map).toBeUndefined()
  })

  it('does not overwrite an existing top-level name', () => {
    const src = `name: myapp\nservices:\n  sonarr:\n    image: linuxserver/sonarr:latest\n`
    const { yaml, name } = ensureComposeMeta(src)
    expect(name).toBe('myapp')
    const doc = YAML.parse(yaml)
    expect(doc.name).toBe('myapp')
  })

  it('slugifies a service key used as the derived name', () => {
    const src = `services:\n  My_Service:\n    image: foo/bar:1.2\n`
    const { name } = ensureComposeMeta(src)
    expect(name).toBe('my-service')
  })

  it('falls back to slugified image short-name when the only service key is unusable', () => {
    const src = `services:\n  "":\n    image: registry.example.com:5000/some/repo/foo-bar:1.2\n`
    const { name } = ensureComposeMeta(src)
    expect(name).toBe('foo-bar')
  })

  it('does not inject x-nimoos when x-casaos is already present — injects missing title into x-casaos instead', () => {
    const src = `name: plexy\nservices:\n  plex:\n    image: plexinc/pms-docker\nx-casaos:\n  scheme: http\n`
    const { yaml } = ensureComposeMeta(src)
    const doc = YAML.parse(yaml)
    expect(doc['x-nimoos']).toBeUndefined()
    expect(doc['x-casaos'].title).toEqual({ custom: 'plexy', en_us: 'plexy' })
    expect(doc['x-casaos'].icon).toBeUndefined()
    expect(doc['x-casaos'].scheme).toBe('http') // untouched existing field
  })

  it('never overwrites an existing title/icon inside x-nimoos', () => {
    const src = `name: keepme\nservices:\n  svc:\n    image: foo\nx-nimoos:\n  icon: https://example.com/custom.png\n  title:\n    custom: Kept Title\n`
    const { yaml } = ensureComposeMeta(src)
    const doc = YAML.parse(yaml)
    expect(doc['x-nimoos'].icon).toBe('https://example.com/custom.png')
    expect(doc['x-nimoos'].title.custom).toBe('Kept Title')
    // missing en_us sub-field still gets filled in without touching custom
    expect(doc['x-nimoos'].title.en_us).toBe('keepme')
  })

  it('keeps icon absent for a derived name (dead icon domain is never guessed)', () => {
    const src = `services:\n  My App:\n    image: foo\n`
    const { yaml, name } = ensureComposeMeta(src)
    expect(name).toBe('my-app')
    const doc = YAML.parse(yaml)
    expect(doc['x-nimoos'].icon).toBeUndefined()
  })

  it('falls back to the "app" name when the YAML has no name and no services at all', () => {
    const { yaml, name } = ensureComposeMeta('{}')
    expect(name).toBe('app')
    const doc = YAML.parse(yaml)
    expect(doc.name).toBe('app')
    expect(doc['x-nimoos'].title).toEqual({ custom: 'app', en_us: 'app' })
  })
})

describe('volumeAutoCheck', () => {
  it.each([
    ['/config', 'myapp', '/DATA/AppData/myapp/config'],
    ['/data/tvshows', 'myapp', '/DATA/Media/TV Shows'],
    ['/tv', 'myapp', '/DATA/Media/TV Shows'],
    ['/movies', 'myapp', '/DATA/Media/Movies'],
    ['/music', 'myapp', '/DATA/Media/Music'],
    ['/downloads', 'myapp', '/DATA/Downloads'],
    ['/pictures', 'myapp', '/DATA/Gallery'],
    ['/photo', 'myapp', '/DATA/Gallery'],
    ['/media', 'myapp', '/DATA/Media'],
    ['/srv/random', 'myapp', '/DATA/AppData/myapp/srv/random'],
  ])('maps %s -> %s', (containerPath, appName, expected) => {
    expect(volumeAutoCheck(containerPath, appName)).toBe(expected)
  })

  it('pins Vue2 per-keyword case-sensitivity: config/download/pictures/photo/media are lowercase-literal only', () => {
    // 'config' has no case variant in the Vue2 checkArray — but its mapped value is the *same formula*
    // as the default fallback, so this only proves the default path, not a genuine config match.
    expect(volumeAutoCheck('/CONFIG', 'myapp')).toBe('/DATA/AppData/myapp/CONFIG')
    // 'download' is lowercase-only in Vue2 — capitalized "Downloads" must NOT match, falls to default.
    expect(volumeAutoCheck('/Downloads', 'myapp')).toBe('/DATA/AppData/myapp/Downloads')
    // 'photo'/'pictures' are lowercase-only in Vue2 — capitalized "Photo" must NOT match, falls to default.
    expect(volumeAutoCheck('/Photo', 'myapp')).toBe('/DATA/AppData/myapp/Photo')
  })

  it('pins Vue2 dual-case keyword variants: tv/movie/music each list a handful of explicit cases', () => {
    expect(volumeAutoCheck('/TV', 'myapp')).toBe('/DATA/Media/TV Shows')
    expect(volumeAutoCheck('/Movie', 'myapp')).toBe('/DATA/Media/Movies')
    expect(volumeAutoCheck('/Music', 'myapp')).toBe('/DATA/Media/Music')
  })

  it('pins the Vue2 forEach-overwrite order: later keyword in the check order wins on overlap', () => {
    // "media" (last in the check order) overwrites the earlier "config" match — verbatim Vue2 quirk.
    expect(volumeAutoCheck('/media/config', 'myapp')).toBe('/DATA/Media')
  })
})

describe('normalizeVolumes', () => {
  it('rewrites relative and named-volume sources, leaves absolute sources untouched (short syntax)', () => {
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - ./cfg:/config\n      - dbdata:/var/lib/data\n      - /DATA/AppData/app/keep:/keep\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    const vols: string[] = doc.services.app.volumes
    expect(vols).toContain('/DATA/AppData/app/config:/config')
    expect(vols).toContain('/DATA/AppData/app/var/lib/data:/var/lib/data')
    expect(vols).toContain('/DATA/AppData/app/keep:/keep')
  })

  it('rewrites a bare target-only (anonymous volume) entry into a full source:target bind', () => {
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - /var/lib/data\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    expect(doc.services.app.volumes).toContain('/DATA/AppData/app/var/lib/data:/var/lib/data')
  })

  it('preserves a trailing :ro mode flag while rewriting the source', () => {
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - dbdata:/var/lib/data:ro\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    expect(doc.services.app.volumes).toContain('/DATA/AppData/app/var/lib/data:/var/lib/data:ro')
  })

  it('rewrites long-syntax object volumes with missing/relative source, leaves absolute source untouched', () => {
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - type: volume\n        source: dbdata\n        target: /var/lib/data\n      - type: bind\n        source: /DATA/AppData/app/keep\n        target: /keep\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    const vols = doc.services.app.volumes
    expect(vols).toContainEqual({ type: 'bind', source: '/DATA/AppData/app/var/lib/data', target: '/var/lib/data' })
    expect(vols).toContainEqual({ type: 'bind', source: '/DATA/AppData/app/keep', target: '/keep' })
  })

  it('drops top-level named-volume declarations that are no longer referenced after rewriting', () => {
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - dbdata:/var/lib/data\nvolumes:\n  dbdata: {}\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    expect(doc.volumes).toBeUndefined()
  })

  it('drops a top-level named-volume declaration that was never referenced by any service in the first place', () => {
    // "unrelated" never appears as any service's volume source (rewritten or not) — the cleanup rule
    // removes any top-level key not found among current sources, referenced-or-never-referenced alike.
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - /DATA/keep:/keep\nvolumes:\n  unrelated: {}\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    expect(doc.volumes).toBeUndefined()
  })

  it('leaves a non-bind/volume long-syntax entry (tmpfs) byte-identical — no source injected, type untouched', () => {
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - type: tmpfs\n        target: /app/cache\n        tmpfs:\n          size: 100000000\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    expect(doc.services.app.volumes).toEqual([
      { type: 'tmpfs', target: '/app/cache', tmpfs: { size: 100000000 } },
    ])
  })
})

describe('dockerRunToCompose', () => {
  it('converts a real docker run command into YAML containing ports and volumes', () => {
    const out = dockerRunToCompose('docker run -d -p 8080:80 -v ./cfg:/config nginx')
    expect(out).toContain('image: nginx')
    expect(out).toContain('8080:80')
    expect(out).toContain('./cfg:/config')
  })

  it('strips shell-style and backtick comments before conversion (Vue2-parity cleaning)', () => {
    const out = dockerRunToCompose('docker run -d -p 8080:80 nginx # trailing comment\n`# a backtick comment`')
    expect(out).toContain('image: nginx')
  })

  it('throws on garbage input', () => {
    expect(() => dockerRunToCompose('this is not a docker command at all')).toThrow()
  })

  it('throws on empty input', () => {
    expect(() => dockerRunToCompose('')).toThrow()
  })
})

describe('docker run 导入命名(验收实锤:composerize 占位名 + --name 被无视)', () => {
  it('dockerRunToCompose 剥掉 composerize 的 <your project name> 占位名', () => {
    const out = dockerRunToCompose('docker run -d -p 18082:80 --name import-test nginx:alpine')
    const doc = YAML.parse(out)
    expect(doc.name).toBeUndefined()
    expect(doc.services.nginx.container_name).toBe('import-test')
  })

  it('导入链路端到端:应用名取 --name(container_name 优先于 service key)', () => {
    const converted = dockerRunToCompose('docker run -d -p 18082:80 --name import-test nginx:alpine')
    const { yaml, name } = ensureComposeMeta(converted)
    expect(name).toBe('import-test')
    expect(YAML.parse(yaml).name).toBe('import-test')
  })

  it('顶层 name 不合法时合法化写回,返回值与 YAML 严格一致(幽灵进度卡根因)', () => {
    const { yaml, name } = ensureComposeMeta('name: "My App"\nservices:\n  nginx:\n    image: nginx\n')
    expect(YAML.parse(yaml).name).toBe(name)
    expect(name).toBe('my-app') // invalid existing name → slugify to preserve user intent instead of discarding it
  })

  it('合法但含下划线的既有 name 原样保留且返回一致', () => {
    const { yaml, name } = ensureComposeMeta('name: my_app\nservices:\n  a:\n    image: x\n')
    expect(name).toBe('my_app')
    expect(YAML.parse(yaml).name).toBe('my_app')
  })
})
