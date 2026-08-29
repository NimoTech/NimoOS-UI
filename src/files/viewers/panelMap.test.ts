import { describe, it, expect } from 'vitest'
import { getPanelType } from './panelMap'

describe('getPanelType', () => {
  it('image extensions → image-viewer', () => {
    for (const n of ['a.png', 'b.JPG', 'c.jpeg', 'd.bmp', 'e.gif', 'f.webp', 'g.svg', 'h.tiff'])
      expect(getPanelType(n)).toBe('image-viewer')
  })
  it('code/text extensions → code-editor', () => {
    for (const n of ['a.js', 'b.ts.txt', 'c.go', 'd.py', 'e.json', 'f.yaml', 'g.html', 'h.css', 'Makefile', 'Dockerfile'])
      expect(getPanelType(n)).toBe('code-editor')
  })
  it('md → markdown (Vue2 commented out, enabled here)', () => {
    expect(getPanelType('readme.md')).toBe('markdown')
  })
  it('playable video whitelist → video-player', () => {
    for (const n of ['a.mp4', 'b.m4v', 'c.webm', 'd.mov', 'e.3gp'])
      expect(getPanelType(n)).toBe('video-player')
  })
  it('non-playable video containers → null (aligns with Vue2, falls through to download)', () => {
    for (const n of ['a.mkv', 'b.avi', 'c.wmv', 'd.flv', 'e.mpeg', 'f.ts'])
      expect(getPanelType(n)).toBeNull()
  })
  it('full audio suite → video-player', () => {
    for (const n of ['a.mp3', 'b.flac', 'c.m4a', 'd.wav', 'e.ogg', 'f.opus', 'g.aac'])
      expect(getPanelType(n)).toBe('video-player')
  })
  it('unknown extensions → null', () => {
    expect(getPanelType('a.zip')).toBeNull()
    expect(getPanelType('a.exe')).toBeNull()
  })
  it('pdf → pdf-viewer', () => {
    expect(getPanelType('report.pdf')).toBe('pdf-viewer')
    expect(getPanelType('REPORT.PDF')).toBe('pdf-viewer')
  })
  it('docx → doc-viewer; legacy doc/wps → pdf-viewer (conversion)', () => {
    expect(getPanelType('a.docx')).toBe('doc-viewer')
    expect(getPanelType('a.doc')).toBe('pdf-viewer')
    expect(getPanelType('a.wps')).toBe('pdf-viewer')
  })
  it('pdf + legacy ppt/pptx/xls → pdf-viewer', () => {
    expect(getPanelType('a.pdf')).toBe('pdf-viewer')
    expect(getPanelType('a.ppt')).toBe('pdf-viewer')
    expect(getPanelType('a.pptx')).toBe('pdf-viewer')
    expect(getPanelType('a.xls')).toBe('pdf-viewer')
  })
  it('new xlsx/csv → excel-viewer (excludes xls)', () => {
    expect(getPanelType('a.xlsx')).toBe('excel-viewer')
    expect(getPanelType('a.csv')).toBe('excel-viewer')
    expect(getPanelType('a.xls')).not.toBe('excel-viewer')
  })
})
