import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppPathDialog from './AppPathDialog.vue'
import { i18n } from '../../../i18n'
import type { StorageVolume } from '../../../storage/util/storageMap'
import type { FolderEntry } from '@nimotech/nimoos-service'

const migrateAppPath = vi.fn()
const getMigrateStatus = vi.fn()
const folderGetList = vi.fn()
const folderCreate = vi.fn()
const folderRename = vi.fn()
const batchDelete = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      migrateAppPath: (...a: unknown[]) => migrateAppPath(...a),
      getMigrateStatus: (...a: unknown[]) => getMigrateStatus(...a),
    },
    folder: {
      getList: (...a: unknown[]) => folderGetList(...a),
      create: (...a: unknown[]) => folderCreate(...a),
      rename: (...a: unknown[]) => folderRename(...a),
    },
    batch: { delete: (...a: unknown[]) => batchDelete(...a) },
  },
}))

const SYS: StorageVolume = {
  uuid: 'da0e4da3', name: 'NimoOS-HD', isSystem: true, fsType: 'ext4',
  size: 512110190592, availSize: 333092294144, usedSize: 179017896448, usePercent: 35,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}
const EXT: StorageVolume = { ...SYS, uuid: 'ext-1', name: 'Backup', isSystem: false, mountPoint: '/media/Backup' }

// reka-ui 真实 ContextMenuItem 要 inject 由真实 ContextMenuRoot 提供的 MenuRootContext;
// 我们的 ContextMenu.vue 把 ContextMenuContent 传送进 Portal,靠一次真实右键 + 等待动画帧
// 在 jsdom 里很脆弱。同款先例 FileContextMenu.test.ts:stub 掉 ContextMenu(直接渲染
// default + #menu 两个 slot,不再门控在"是否右键打开"上)和 ContextMenuItem(按 class
// 透传 + 点击发 select,disabled 时不发),只验证"菜单渲染了什么 + 点了发生什么"这层
// 纯逻辑;真实的右键定位/动画留 T10 真机验证范畴。
const ContextMenuStub = { template: '<div><slot /><slot name="menu" /></div>' }
const ContextMenuItemStub = {
  props: ['disabled'],
  emits: ['select'],
  template: '<div :disabled="disabled ? \'\' : null" @click="!disabled && $emit(\'select\')"><slot /></div>',
}

// 加了写路径这批测试后,mount() 次数变多——之前 11 例从没显式 unmount(靠 afterEach 只
// 清 document.body.innerHTML),之前侥幸没事;新测试里 AlertDialog 的 Portal + reka 内部
// watch 在下一个测试的 flushPromises() 里才触发,这时上一个测试的 app 实例还"活着"却发现
// 挂载点已经被直接挖空,patch 时 Cannot read properties of null(unhandled rejection)。
// 改为跟踪每次 mountDlg() 产生的 wrapper,afterEach 统一 unmount 干净(个别测试自己已经
// unmount 过的,重复 unmount 用 try/catch 吞掉)。
let mountedWrappers: Array<{ unmount: () => void }> = []
const mountDlg = (volumes: StorageVolume[] = [SYS, EXT], opts: { withCtxStubs?: boolean } = {}) => {
  const w = mount(AppPathDialog, {
    props: { open: true, type: 'app_data' as const, currentPath: '/DATA/AppData', requiredSpace: 6037987, volumes, displayNames: { '/DATA': 'NimoOS-HD', '/media/Backup': 'Backup' } },
    global: {
      plugins: [i18n],
      stubs: opts.withCtxStubs ? { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub } : {},
    },
    attachTo: document.body,   // reka DialogPortal teleport 到 body
  })
  mountedWrappers.push(w)
  return w
}

/** 选中 EXT 分区 → 进浏览步骤(root 目录列表已到)。给写路径(新建/重命名/删除)测试复用。 */
async function enterBrowse() {
  await (document.querySelector('.set-mig-item') as HTMLElement).click()
  await (document.querySelector('.set-mig-next') as HTMLElement).click()
  await flushPromises()
}

describe('AppPathDialog', () => {
  beforeEach(() => {
    migrateAppPath.mockReset(); getMigrateStatus.mockReset(); folderGetList.mockReset()
    folderCreate.mockReset(); folderRename.mockReset(); batchDelete.mockReset()
    folderGetList.mockResolvedValue({ content: [
      { name: 'Backup', path: '/media/Backup/Backup', is_dir: true, is_symlink: false },
    ] })
  })
  afterEach(() => {
    for (const w of mountedWrappers) { try { w.unmount() } catch { /* 测试自己已经 unmount 过 */ } }
    mountedWrappers = []
    document.body.innerHTML = ''
  })

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
    // 评审 Important #1:头部 × 按钮与页脚"关闭"主按钮曾共用 .set-mig-close,拆开后
    // 分别用 .set-mig-x(头部)与 .set-mig-close(页脚)两个类名,这里显式查两处,
    // 不再靠共用类名"顺便"覆盖两个位置。
    expect(document.querySelector('.set-mig-x')).toBeNull()
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

  // 评审 Important #2:Vue2 pollStatus 的 done 和 error 两支都会 $emit('finish', job),
  // 这里之前只有 done 支 emit——补一条测试钉住 error 支也要发,父组件靠它重取一次路径。
  it('status=error 时也发 finish 事件(1:1 Vue2,失败后锚点可能已经换了一半)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'error', phase: 'copying', stopping_apps: 0, progress: 0, processed_size: 0, total_size: 0, error: 'rollback rename failed' })
    const w = mountDlg()
    await flushPromises()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    expect(w.emitted('finish')).toBeTruthy()
    expect(w.emitted('finish')?.length).toBe(1)
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

  // ── 评审 Important #2:新建/重命名/删除是本任务开头 ⛔ 破坏性说明点名的三条写路径,
  // 之前一条测试都没有——mock 声明了却从没被断言调用过,等于摆设。这里补上,每条至少
  // 成功 + 失败两例,并单独钉住 isProtectedFolder 真的接到了右键菜单的 disabled 上。
  describe('新建文件夹', () => {
    it('成功:提交拼好的完整路径(裁剪空白 + 剥离斜杠)→ 成功后关闭输入框并重新列目录', async () => {
      folderCreate.mockResolvedValue(undefined)
      mountDlg()
      await flushPromises()
      await enterBrowse()
      const listCallsBefore = folderGetList.mock.calls.length

      await (document.querySelector('.set-mig-newfolder-btn') as HTMLElement).click()
      await flushPromises()
      const input = document.querySelector('.set-mig-newfolder-row input') as HTMLInputElement
      expect(input).not.toBeNull()
      input.value = '  My/Folder  ' // 名字里混了要剥掉的 '/' 和首尾空白
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      // browsePath 是 '/media/Backup'(EXT 的挂载点即 browseRoot),拼出来必须是裁剪 + 剥离后的名字
      expect(folderCreate).toHaveBeenCalledWith('/media/Backup/MyFolder')
      expect(folderGetList.mock.calls.length).toBe(listCallsBefore + 1) // 成功后重新列了一次目录
      expect(document.querySelector('.set-mig-newfolder-row')).toBeNull() // 行内输入框已关闭
      expect(document.querySelector('.set-danger')).toBeNull()
    })

    it('失败:弹窗内联 .set-danger 显示后端 message(不是 toast),输入框不关闭', async () => {
      folderCreate.mockRejectedValue(new Error('permission denied'))
      mountDlg()
      await flushPromises()
      await enterBrowse()

      await (document.querySelector('.set-mig-newfolder-btn') as HTMLElement).click()
      await flushPromises()
      const input = document.querySelector('.set-mig-newfolder-row input') as HTMLInputElement
      input.value = 'X'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(document.querySelector('.set-danger')?.textContent).toBe('permission denied')
      expect(document.querySelector('.set-mig-newfolder-row')).not.toBeNull() // 还在编辑态,没关闭
    })
  })

  describe('重命名 / 删除(右键菜单,ContextMenu + ContextMenuItem 打了 stub,见 mountDlg 上方注释)', () => {
    it('重命名成功:folder.rename 收到(旧路径,同一父目录下的新路径),成功后重新列目录', async () => {
      folderRename.mockResolvedValue(undefined)
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse() // 默认 folderGetList mock:一个文件夹 'Backup' @ /media/Backup/Backup
      const listCallsBefore = folderGetList.mock.calls.length

      const renameItem = document.querySelector('.ui-ctx-item:not(.danger)') as HTMLElement
      expect(renameItem).not.toBeNull()
      await renameItem.click()
      await flushPromises()

      const input = document.querySelector('.set-mig-folder .set-mig-input') as HTMLInputElement
      expect(input).not.toBeNull()
      // #7:startRename 的 nextTick(() => renameInputEl.value?.focus()) 必须真的聚焦到这个
      // input——本期实测过 v-for 里的字符串 ref 会被 Vue 收集成数组,.value 变成 [el] 而不是
      // el 本身,导致 .focus() 在数组上找不到方法直接被吞掉(unhandled rejection,不是断言,
      // 只看 "N passed" 会漏)。已改函数式 ref(setRenameInputEl)修正,这里补断言钉住它。
      expect(document.activeElement).toBe(input)
      input.value = 'Renamed'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(folderRename).toHaveBeenCalledWith('/media/Backup/Backup', '/media/Backup/Renamed')
      expect(folderGetList.mock.calls.length).toBe(listCallsBefore + 1)
      expect(document.querySelector('.set-mig-folder .set-mig-input')).toBeNull() // 编辑态已关闭
    })

    it('重命名失败:弹窗内联 .set-danger 显示后端 message,退出编辑态', async () => {
      folderRename.mockRejectedValue(new Error('name already exists'))
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()

      const renameItem = document.querySelector('.ui-ctx-item:not(.danger)') as HTMLElement
      await renameItem.click()
      await flushPromises()
      const input = document.querySelector('.set-mig-folder .set-mig-input') as HTMLInputElement
      input.value = 'Renamed'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(document.querySelector('.set-danger')?.textContent).toBe('name already exists')
      expect(document.querySelector('.set-mig-folder .set-mig-input')).toBeNull()
    })

    it('受保护目录(如 AppData):右键菜单重命名/删除两项都 disabled(钉住 isProtectedFolder 接上了)', async () => {
      // AppData 在 PROTECTED_FOLDER_NAMES 里,但 type='app_data' 时 filterBrowseFolders 不会
      // 把 'AppData' 过滤掉(那个禁用名单是给别的迁移类型用的)—— 所以它能正常出现在列表里,
      // 但两项菜单必须是 disabled。故意换一个跟 currentPath 前缀不冲突的路径,确保它会被渲染。
      folderGetList.mockResolvedValue({ content: [
        { name: 'AppData', path: '/media/Backup/AppData', is_dir: true, is_symlink: false },
      ] })
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()

      const items = document.querySelectorAll('.ui-ctx-item')
      expect(items).toHaveLength(2) // 重命名 + 删除
      expect(items[0].hasAttribute('disabled')).toBe(true)
      expect(items[1].hasAttribute('disabled')).toBe(true)

      // vue-test-utils 不给 disabled 元素派发事件,这里改断言 disabled 属性本身,不去点击验证"点了没反应"
    })

    it('删除:先出二次确认框(此时尚未调用 delete),确认后才调用且参数是 [路径]', async () => {
      batchDelete.mockResolvedValue(undefined)
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()
      const listCallsBefore = folderGetList.mock.calls.length

      const deleteItem = document.querySelector('.ui-ctx-item.danger') as HTMLElement
      expect(deleteItem).not.toBeNull()
      await deleteItem.click()
      await flushPromises()

      // 二次确认框已弹出,但真正的 delete 请求还没发出去
      expect(batchDelete).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('删除')

      const confirmBtn = document.querySelector('.ui-btn.danger') as HTMLElement
      expect(confirmBtn).not.toBeNull()
      await confirmBtn.click()
      await flushPromises()

      expect(batchDelete).toHaveBeenCalledWith(['/media/Backup/Backup'])
      expect(folderGetList.mock.calls.length).toBe(listCallsBefore + 1) // 成功后重新列了一次目录
    })

    it('删除失败:弹窗内联 .set-danger 显示后端 message', async () => {
      batchDelete.mockRejectedValue(new Error('directory not empty'))
      mountDlg([SYS, EXT], { withCtxStubs: true })
      await flushPromises()
      await enterBrowse()

      const deleteItem = document.querySelector('.ui-ctx-item.danger') as HTMLElement
      await deleteItem.click()
      await flushPromises()
      const confirmBtn = document.querySelector('.ui-btn.danger') as HTMLElement
      await confirmBtn.click()
      await flushPromises()

      expect(document.querySelector('.set-danger')?.textContent).toBe('directory not empty')
    })
  })
})
