import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppPathDialog from './AppPathDialog.vue'
import { i18n } from '../../../i18n'
import type { StorageVolume } from '../../../storage/util/storageMap'
import type { FolderEntry } from '@nimotech/nimoos-service'

const migrateAppPath = vi.fn()
const getMigrateStatus = vi.fn()
const folderGetList = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      migrateAppPath: (...a: unknown[]) => migrateAppPath(...a),
      getMigrateStatus: (...a: unknown[]) => getMigrateStatus(...a),
    },
    folder: { getList: (...a: unknown[]) => folderGetList(...a), create: vi.fn(), rename: vi.fn() },
    batch: { delete: vi.fn() },
  },
}))

const SYS: StorageVolume = {
  uuid: 'da0e4da3', name: 'NimoOS-HD', isSystem: true, fsType: 'ext4',
  size: 512110190592, availSize: 333092294144, usedSize: 179017896448, usePercent: 35,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}
const EXT: StorageVolume = { ...SYS, uuid: 'ext-1', name: 'Backup', isSystem: false, mountPoint: '/media/Backup' }

const mountDlg = (volumes: StorageVolume[] = [SYS, EXT]) =>
  mount(AppPathDialog, {
    props: { open: true, type: 'app_data' as const, currentPath: '/DATA/AppData', requiredSpace: 6037987, volumes, displayNames: { '/DATA': 'NimoOS-HD', '/media/Backup': 'Backup' } },
    global: { plugins: [i18n] },
    attachTo: document.body,   // reka DialogPortal teleport 到 body
  })

describe('AppPathDialog', () => {
  beforeEach(() => {
    migrateAppPath.mockReset(); getMigrateStatus.mockReset(); folderGetList.mockReset()
    folderGetList.mockResolvedValue({ content: [
      { name: 'Backup', path: '/media/Backup/Backup', is_dir: true, is_symlink: false },
    ] })
  })
  afterEach(() => { document.body.innerHTML = '' })

  // brief 原文这两条是同步断言(mountDlg() 后不 await 就查 DOM)。实测 reka 的
  // DialogPortal/DialogContent 要等一个 tick 才把内容传送进 document.body(同款先例见
  // DeviceInfoDialog.test.ts / NetworkIfaceConfigDialog.test.ts,两处 mount 后都
  // await flushPromises() 才查 DOM)——这里补上,否则查询恒空,不是产品代码的问题。
  it('第一步列出可选分区,当前所在分区被剔除', async () => {
    mountDlg()
    await flushPromises()
    const items = document.querySelectorAll('.set-mig-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('Backup')
  })

  it('本机只有一个分区时显示"没有其他可用的存储",下一步按钮禁用', async () => {
    mountDlg([SYS])
    await flushPromises()
    expect(document.body.textContent).toContain('没有其他可用的存储')
    expect(document.querySelector('.set-mig-next')?.hasAttribute('disabled')).toBe(true)
  })

  it('选中分区后进浏览步骤,根路径按挂载点派生并拉一次目录', async () => {
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    expect(folderGetList).toHaveBeenCalledWith('/media/Backup')
    expect(document.body.textContent).toContain('/media/Backup/AppData')
  })

  it('确认步骤展示目标路径与 Docker 会停的警告', async () => {
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    // brief 原文标点是半角逗号+叹号的手误;源头 Vue2 zh_CN.json:605 是全角"，"——
    // 中文文案必须以 Vue2 为准(含标点,见 CLAUDE.md/记忆 newui-zh-copy-source-of-truth),
    // 这里按 zh_cn.sp9.ts 的 settingsMigNoteDocker 逐字核对后改回全角。
    expect(document.body.textContent).toContain('在此过程中，Docker 将暂时停止。')
  })

  it('开始迁移后按 200ms 轮询,done 时进完成步骤', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus
      .mockResolvedValueOnce({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 42, processed_size: 10, total_size: 100 })
      .mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'done', phase: 'starting_services', stopping_apps: 0, progress: 100, processed_size: 100, total_size: 100, new_path: '/DATA/AppData' })
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click()
    await flushPromises()
    expect(migrateAppPath).toHaveBeenCalledWith('app_data', '/media/Backup')
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.body.textContent).toContain('42')
    vi.advanceTimersByTime(200); await flushPromises()
    // 同上:brief 原文"迁移完成!"是半角叹号手误,源头 zh_CN.json:608 是全角"！"。
    expect(document.body.textContent).toContain('迁移完成！')
    vi.useRealTimers()
  })

  it('迁移中不给关闭按钮(防用户中途关窗)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 5, processed_size: 1, total_size: 100 })
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.querySelector('.set-mig-close')).toBeNull()
    vi.useRealTimers()
  })

  it('status=error 时进错误步骤并显示后端 error 原文 + 已自动清理说明', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'error', phase: 'copying', stopping_apps: 0, progress: 0, processed_size: 0, total_size: 0, error: 'insufficient space on target /media/Backup' })
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.body.textContent).toContain('insufficient space on target /media/Backup')
    expect(document.body.textContent).toContain('已自动清理')
    vi.useRealTimers()
  })

  it('轮询连续失败 5 次后停表并报错(移植纪律:Vue2 只 console.error,会无限轮询)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockRejectedValue(Object.assign(new Error('job not found'), { code: 4000 }))
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    for (let i = 0; i < 6; i++) { vi.advanceTimersByTime(200); await flushPromises() }
    expect(document.body.textContent).toContain('job not found')
    const calls = getMigrateStatus.mock.calls.length
    vi.advanceTimersByTime(2000); await flushPromises()
    expect(getMigrateStatus.mock.calls.length).toBe(calls)   // 已停表
    vi.useRealTimers()
  })

  it('启动迁移的请求本身失败时直接进错误步骤', async () => {
    migrateAppPath.mockRejectedValue(new Error('boom'))
    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    expect(document.body.textContent).toContain('boom')
  })

  it('卸载时停表,不留下定时器', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 5, processed_size: 1, total_size: 100 })
    const w = mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    const calls = getMigrateStatus.mock.calls.length
    w.unmount()
    vi.advanceTimersByTime(2000); await flushPromises()
    expect(getMigrateStatus.mock.calls.length).toBe(calls)
    vi.useRealTimers()
  })

  // ── 过期守卫(约束 #5):浏览步骤快速切换目录,前一次 folder.getList 的迟到结果不能覆盖
  // 后一次的。真实路径:root → 点进子目录 A(请求挂起)→ 中途点面包屑回到 root(新请求先落定)
  // → A 的请求才姗姗来迟,此时列表必须仍是 root 的,不能被 A 的迟到结果覆盖回去。
  it('⚠️ 过期守卫:浏览步骤快速切换目录时,前一次列目录的迟到结果不能盖掉后一次的', async () => {
    type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void }
    function deferred<T>(): Deferred<T> {
      let resolve!: (v: T) => void
      const promise = new Promise<T>((res) => { resolve = res })
      return { promise, resolve }
    }
    const rootListing = { content: [{ name: 'A', path: '/media/Backup/A', is_dir: true, is_symlink: false } as FolderEntry] }
    const staleAListing = { content: [{ name: 'StaleOnly', path: '/media/Backup/A/StaleOnly', is_dir: true, is_symlink: false } as FolderEntry] }
    const freshRootListing = { content: [{ name: 'FreshRoot', path: '/media/Backup/FreshRoot', is_dir: true, is_symlink: false } as FolderEntry] }

    const pendingA = deferred<typeof staleAListing>()
    let call = 0
    folderGetList.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve(rootListing)       // 进入浏览步骤:列 root
      if (call === 2) return pendingA.promise                    // 点进 A:挂起
      if (call === 3) return Promise.resolve(freshRootListing)   // 中途点回 root:立刻落定
      return Promise.resolve({ content: [] })
    })

    mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    expect(document.body.textContent).toContain('A') // root 列表已到

    // 点进 A(call 2,挂起,列表变空 —— loading 态替换掉了原列表)
    await (document.querySelector('.set-mig-folder') as HTMLElement).click()
    await flushPromises()
    expect(folderGetList).toHaveBeenCalledTimes(2)

    // 还没等 A 落定,就点面包屑回到 root(call 3,立刻落定)
    const rootCrumb = document.querySelectorAll('.set-mig-crumb')[0] as HTMLElement
    await rootCrumb.click()
    await flushPromises()
    expect(folderGetList).toHaveBeenCalledTimes(3)
    expect(document.body.textContent).toContain('FreshRoot')
    expect(document.body.textContent).not.toContain('StaleOnly')

    // A 那次的请求现在才姗姗来迟 —— 不许把 FreshRoot 冲掉
    pendingA.resolve(staleAListing)
    await flushPromises()
    expect(document.body.textContent).toContain('FreshRoot')
    expect(document.body.textContent).not.toContain('StaleOnly')
  })
})
