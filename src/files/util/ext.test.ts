import { describe, it, expect } from 'vitest'
import { fileExt } from './ext'

describe('fileExt', () => {
  it('extracts the lowercase extension after the last dot', () => {
    expect(fileExt('a.PNG')).toBe('png')
    expect(fileExt('archive.tar.gz')).toBe('gz')
    expect(fileExt('readme.md')).toBe('md')
  })
  it('matches Vue2 getFileExt for extensionless names and dotfiles', () => {
    expect(fileExt('Dockerfile')).toBe('dockerfile')
    expect(fileExt('Makefile')).toBe('makefile')
    expect(fileExt('.gitignore')).toBe('gitignore')
    expect(fileExt('.env')).toBe('env')
  })
})
