import { describe, it, expect } from 'vitest'
import { buildAuthUrl, driverIconUrl } from './cloudAuth'

describe('buildAuthUrl', () => {
  it('replace ${HOST} with device origin (encodeURI, preserve :// )', () => {
    const out = buildAuthUrl('https://p?state=${HOST}%2Fv1%2Frecover%2FDropbox', 'http://192.168.1.10')
    expect(out).toBe('https://p?state=http://192.168.1.10%2Fv1%2Frecover%2FDropbox')
  })
  it('preserve Vue2\'s redirect_uri http%→https% rewriting', () => {
    expect(buildAuthUrl('x?redirect_uri=http%3A%2F%2Fh', 'http://h')).toBe('x?redirect_uri=https%3A%2F%2Fh')
  })
})

describe('driverIconUrl', () => {
  const base = import.meta.env.BASE_URL // build/test use the same vite config ⇒ '/app/'

  it('repoint backend\'s site-root path to this app\'s base (no longer depends on img/ left in site root by Vue2)', () => {
    expect(driverIconUrl('./img/driver/Dropbox.svg', 'http://h')).toBe(`http://h${base}img/driver/Dropbox.svg`)
  })
  it('remove trailing slash from origin, no leading dot also works', () => {
    expect(driverIconUrl('img/driver/X.svg', 'http://h/')).toBe(`http://h${base}img/driver/X.svg`)
  })
  it('take only the filename — backend can change directory levels and it still lands in this app\'s img/driver/', () => {
    expect(driverIconUrl('/static/icons/OneDrive.svg', 'http://h')).toBe(`http://h${base}img/driver/OneDrive.svg`)
  })
})
