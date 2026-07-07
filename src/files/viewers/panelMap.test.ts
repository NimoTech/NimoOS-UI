import { describe, it, expect } from 'vitest'
import { getPanelType } from './panelMap'

describe('getPanelType', () => {
  it('图片扩展名 → image-viewer', () => {
    for (const n of ['a.png', 'b.JPG', 'c.jpeg', 'd.bmp', 'e.gif', 'f.webp', 'g.svg', 'h.tiff'])
      expect(getPanelType(n)).toBe('image-viewer')
  })
  it('代码/文本扩展名 → code-editor', () => {
    for (const n of ['a.js', 'b.ts.txt', 'c.go', 'd.py', 'e.json', 'f.yaml', 'g.html', 'h.css', 'Makefile', 'Dockerfile'])
      expect(getPanelType(n)).toBe('code-editor')
  })
  it('md → markdown(Vue2 注释掉了,这里启用)', () => {
    expect(getPanelType('readme.md')).toBe('markdown')
  })
  it('可播放视频白名单 → video-player', () => {
    for (const n of ['a.mp4', 'b.m4v', 'c.webm', 'd.mov', 'e.3gp'])
      expect(getPanelType(n)).toBe('video-player')
  })
  it('不可播放视频容器 → null(对齐 Vue2,落下载)', () => {
    for (const n of ['a.mkv', 'b.avi', 'c.wmv', 'd.flv', 'e.mpeg', 'f.ts'])
      expect(getPanelType(n)).toBeNull()
  })
  it('音频全套 → video-player', () => {
    for (const n of ['a.mp3', 'b.flac', 'c.m4a', 'd.wav', 'e.ogg', 'f.opus', 'g.aac'])
      expect(getPanelType(n)).toBe('video-player')
  })
  it('未知扩展名 → null', () => {
    expect(getPanelType('a.zip')).toBeNull()
    expect(getPanelType('a.exe')).toBeNull()
  })
  it('pdf → pdf-viewer', () => {
    expect(getPanelType('report.pdf')).toBe('pdf-viewer')
    expect(getPanelType('REPORT.PDF')).toBe('pdf-viewer')
  })
  it('docx → doc-viewer; 旧版 doc/wps → pdf-viewer(转换)', () => {
    expect(getPanelType('a.docx')).toBe('doc-viewer')
    expect(getPanelType('a.doc')).toBe('pdf-viewer')
    expect(getPanelType('a.wps')).toBe('pdf-viewer')
  })
  it('pdf + 旧版 ppt/pptx/xls → pdf-viewer', () => {
    expect(getPanelType('a.pdf')).toBe('pdf-viewer')
    expect(getPanelType('a.ppt')).toBe('pdf-viewer')
    expect(getPanelType('a.pptx')).toBe('pdf-viewer')
    expect(getPanelType('a.xls')).toBe('pdf-viewer')
  })
  it('新版 xlsx/csv → excel-viewer(不含 xls)', () => {
    expect(getPanelType('a.xlsx')).toBe('excel-viewer')
    expect(getPanelType('a.csv')).toBe('excel-viewer')
    expect(getPanelType('a.xls')).not.toBe('excel-viewer')
  })
})
