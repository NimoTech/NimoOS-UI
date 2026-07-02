import { describe, it, expect } from 'vitest'
import { iconNameFor, iconUrl } from './icons'

describe('iconNameFor', () => {
  it('maps file extensions to icon names (case-insensitive)', () => {
    expect(iconNameFor({ name: 'a.PNG', is_dir: false })).toBe('image-x-generic')
    expect(iconNameFor({ name: 'v.mp4', is_dir: false })).toBe('video-x-generic')
    expect(iconNameFor({ name: 'readme.md', is_dir: false })).toBe('text-markdown')
    expect(iconNameFor({ name: 'main.go', is_dir: false })).toBe('text-css')
    expect(iconNameFor({ name: 'doc.docx', is_dir: false })).toBe('application-vnd.ms-word')
    expect(iconNameFor({ name: 'x.unknownext', is_dir: false })).toBe('unknown')
    expect(iconNameFor({ name: 'noext', is_dir: false })).toBe('unknown')
  })

  it('maps folders by type then by well-known name then default', () => {
    expect(iconNameFor({ name: 'x', is_dir: true, type: 'usb' })).toBe('folder-usb')
    expect(iconNameFor({ name: 'x', is_dir: true, type: 'nvme' })).toBe('folder-hdd')
    expect(iconNameFor({ name: 'x', is_dir: true, type: 'home' })).toBe('folder-root')
    expect(iconNameFor({ name: 'AppData', is_dir: true })).toBe('folder-application')
    expect(iconNameFor({ name: 'Media', is_dir: true })).toBe('folder-video')
    expect(iconNameFor({ name: 'Downloads', is_dir: true })).toBe('folder-download')
    expect(iconNameFor({ name: 'Documents', is_dir: true })).toBe('folder-documents')
    expect(iconNameFor({ name: 'Gallery', is_dir: true })).toBe('folder-pictures')
    expect(iconNameFor({ name: 'whatever', is_dir: true })).toBe('folder-default')
  })

  it('iconUrl returns a string URL and falls back to unknown for missing names', () => {
    expect(typeof iconUrl('image-x-generic')).toBe('string')
    expect(iconUrl('image-x-generic').length).toBeGreaterThan(0)
    expect(typeof iconUrl('does-not-exist')).toBe('string')
    expect(iconUrl('does-not-exist')).toBe(iconUrl('unknown'))
  })

  it('Vue2 fidelity: getFileExt edge cases (no dot guard, last-match-wins)', () => {
    // dockerfile: text-x-cmake entry comes first, text-dockerfile entry comes last → last wins
    expect(iconNameFor({ name: 'Dockerfile', is_dir: false })).toBe('text-dockerfile')
    expect(iconNameFor({ name: 'x.dockerfile', is_dir: false })).toBe('text-dockerfile')
    // makefile: only in text-x-cmake
    expect(iconNameFor({ name: 'Makefile', is_dir: false })).toBe('text-x-cmake')
    // dotfiles: no i>0 guard, so ".gitignore" → ext "gitignore" → text-x-generic
    expect(iconNameFor({ name: '.gitignore', is_dir: false })).toBe('text-x-generic')
    expect(iconNameFor({ name: '.env', is_dir: false })).toBe('text-x-generic')
    // iconUrl sanity for newly reachable icon
    expect(typeof iconUrl('text-dockerfile')).toBe('string')
    expect(iconUrl('text-dockerfile').length).toBeGreaterThan(0)
  })
})
