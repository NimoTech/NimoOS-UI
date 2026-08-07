import { describe, it, expect } from 'vitest'
import { initService, service } from './index'

describe('service wiring (SP4-P0)', () => {
  it('file/batch/folder/storage domains resolve after initService', () => {
    initService({
      getToken: () => 'TKN',
      getRefresh: () => 'RT',
      setTokens: () => {},
      onAuthFail: () => {},
      getLang: () => 'zh_cn',
    })
    expect(typeof service.file.getContent).toBe('function')
    expect(typeof service.file.fileUrl).toBe('function')
    expect(service.file.fileUrl('/DATA/a.png')).toContain('/v3/file?token=TKN')
    expect(typeof service.batch.batchUrl).toBe('function')
    expect(typeof service.folder.getFolderSize).toBe('function')
    expect(typeof service.storage.list).toBe('function')
  })
})
