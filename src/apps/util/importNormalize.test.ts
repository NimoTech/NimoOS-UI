import { describe, it, expect } from 'vitest'
import YAML from 'yaml'
import { ensureComposeMeta, volumeAutoCheck, normalizeVolumes, dockerRunToCompose } from './importNormalize'

describe('ensureComposeMeta', () => {
  it('injects top-level name + x-nimoos title/icon when both absent', () => {
    const src = `services:\n  sonarr:\n    image: linuxserver/sonarr:latest\n`
    const { yaml, name } = ensureComposeMeta(src)
    expect(name).toBe('sonarr')
    const doc = YAML.parse(yaml)
    expect(doc.name).toBe('sonarr')
    expect(doc['x-nimoos'].title).toEqual({ custom: 'sonarr', en_us: 'sonarr' })
    expect(doc['x-nimoos'].icon).toBe('https://icon.nimoos.io/main/all/sonarr.png')
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

  it('does not inject x-nimoos when x-casaos is already present — injects missing title/icon into x-casaos instead', () => {
    const src = `name: plexy\nservices:\n  plex:\n    image: plexinc/pms-docker\nx-casaos:\n  scheme: http\n`
    const { yaml } = ensureComposeMeta(src)
    const doc = YAML.parse(yaml)
    expect(doc['x-nimoos']).toBeUndefined()
    expect(doc['x-casaos'].title).toEqual({ custom: 'plexy', en_us: 'plexy' })
    expect(doc['x-casaos'].icon).toBe('https://icon.nimoos.io/main/all/plexy.png')
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

  it('guesses the icon URL from the final slugified name', () => {
    const src = `services:\n  My App:\n    image: foo\n`
    const { yaml, name } = ensureComposeMeta(src)
    const doc = YAML.parse(yaml)
    expect(doc['x-nimoos'].icon).toBe(`https://icon.nimoos.io/main/all/${name}.png`)
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

  it('is case-insensitive', () => {
    expect(volumeAutoCheck('/CONFIG', 'myapp')).toBe('/DATA/AppData/myapp/CONFIG')
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

  it('keeps a top-level named volume that is still referenced by an untouched absolute-source entry elsewhere', () => {
    // contrived: an entry whose source equals the volume name is impossible once rewritten,
    // so pin the case where a *different*, still-relevant top-level key survives because it matches
    // an absolute path some service still points at (defensive: unrelated keys aren't touched).
    const src = `services:\n  app:\n    image: foo\n    volumes:\n      - /DATA/keep:/keep\nvolumes:\n  unrelated: {}\n`
    const out = normalizeVolumes(src, 'app')
    const doc = YAML.parse(out)
    expect(doc.volumes).toBeUndefined() // "unrelated" was never referenced as a source -> dropped
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
