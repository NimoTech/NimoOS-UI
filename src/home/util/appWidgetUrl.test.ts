import { describe, it, expect } from 'vitest'
import { appWidgetUrl } from './appWidgetUrl'

const OPTS = { host: 'nas.local', origin: 'http://nas.local', theme: 'dark', lang: 'zh_cn' }

describe('appWidgetUrl', () => {
  it('concatenates scheme/host/port/path + theme/lang/home parameters', () => {
    const u = appWidgetUrl({ scheme: 'http', port: '8080', widget: { path: '/widget' } }, OPTS)
    expect(u).toBe('http://nas.local:8080/widget?theme=dark&lang=zh_cn&home=http%3A%2F%2Fnas.local')
  })
  it('hostname overrides host; path with query continues with &; path without slash gets one added', () => {
    const u = appWidgetUrl({ hostname: '10.0.0.9', port: 81, widget: { path: 'w?x=1' } }, OPTS)
    expect(u).toBe('http://10.0.0.9:81/w?x=1&theme=dark&lang=zh_cn&home=http%3A%2F%2Fnas.local')
  })
  it('returns null if no widget.path or no port', () => {
    expect(appWidgetUrl({ port: '80', widget: undefined }, OPTS)).toBeNull()
    expect(appWidgetUrl({ widget: { path: '/w' } }, OPTS)).toBeNull()
  })
})
