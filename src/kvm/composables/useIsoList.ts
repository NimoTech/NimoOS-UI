import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { KvmISO } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'

// ISO 模板列表 + 下载进度。**必须由 KvmPage 创建、随页面生命周期存活**,不能挂在
// OsSelector 组件里 —— Vue2 的 OSSelector 是常驻挂载的(`v-if="visible"` 写在它自己的
// 根节点上,组件实例一直活着),所以它的 sockets 一直在收下载进度:关掉弹窗、下载照样
// 推进。New-UI 若照直觉写 `v-if="showOSSelector"` 卸载组件,进度就断了。
// 顺带合掉 Vue2「GET /isos 拉两遍」的浪费(mounted 拉一次喂 osTemplates、开弹窗再拉
// 一次喂 osList)—— 已申报偏离,spec §6.2.5 第 2 条。

export interface IsoRow extends KvmISO {
  _downloading: boolean
  _downloaded: boolean
  _progress: number
  _downloadedBytes: number
}

const EVT_PROGRESS = 'kvm:iso_download_progress'
const EVT_COMPLETE = 'kvm:iso_download_complete'
const EVT_FAILED = 'kvm:iso_download_failed'

function isoIdOf(props: unknown): string | undefined {
  if (props && typeof props === 'object') {
    const v = (props as Record<string, unknown>).iso_id
    if (typeof v === 'string' && v) return v
  }
  return undefined
}

export function useIsoList() {
  const isos: Ref<IsoRow[]> = ref([])
  const isLoading = ref(false)

  // 就地过期守卫(硬约束 2:别抽公共 guard 工具)。两层不同性质的机制,别混为一谈:
  //
  // 1) `fetch()` 里的 `alive` 判断是**承重的**——那里有真实的 `await` 让出点,dispose()
  //    可能在请求在途时发生,响应落定时必须补判一次 `alive` 才能不写已经作废的 state。
  //
  // 2) 三个事件回调(`bus.on(...)` 里)的 `alive` 判断是**纵深防御,当前不可达**——
  //    真正挡住"dispose 之后事件不再写 state"的机制是 `dispose()` 里**同步**的
  //    `unsubs.forEach(off)`:退订之后,MessageBus 根本不会再调用这个回调,回调内部
  //    判不判 `alive` 都一样(已用删测试验证:删掉这三处判断,现有的"dispose 后事件
  //    到达"用例仍然全绿,因为它测的是退订生效,不是这个判断生效)。留着不删,是因为
  //    一旦退订失效(比如将来某个回调改成 async、内部顺手 await 一次 refetch 再写 ref,
  //    或者 dispose() 漏调了某个 off()),这层判断立刻从"摆设"变成"救命"的最后一道
  //    防线——本仓历史上"异步写共享 state 没带过期守卫"这类坑已经被评审逮到过四次。
  //    专门有一条用例把退订这层主机制手动关掉,来验证这层防御真的能独立挡住写入
  //    (见 .test.ts 里"退订未生效"那条 + 对应的变异验证)。
  let alive = true

  function findIso(id: string): IsoRow | undefined {
    return isos.value.find((o) => o.id === id)
  }

  // 单回调槽,同 useVmList 的 onVncShouldConnect 写法——本任务消费方只有 KvmPage 一个。
  let doneCb: ((row: IsoRow) => void) | null = null
  let failedCb: ((row: IsoRow) => void) | null = null
  function onDownloadDone(cb: (row: IsoRow) => void) { doneCb = cb }
  function onDownloadFailed(cb: (row: IsoRow) => void) { failedCb = cb }

  async function fetch(): Promise<void> {
    isLoading.value = true
    try {
      const list = await service.kvm.getISOList()
      if (!alive) return // 过期守卫:dispose 之后到达的响应不再写 state
      // 照 Vue2 fetchOSList 的 status→标志映射(OSSelector.vue:236-241)。
      isos.value = list.map((item) => {
        const row: IsoRow = {
          ...item,
          _downloading: false,
          _downloaded: false,
          _progress: 0,
          _downloadedBytes: 0,
        }
        if (item.status === 'downloaded') {
          row._downloaded = true
        } else if (item.status === 'downloading') {
          row._downloading = true
          row._progress = item.progress || 0
        }
        return row
      })
    } catch {
      // 照 Vue2 fetchOSList 的 catch(:246-248):只 console.error,不清空已有列表、不设 lastError。
      console.error('[useIsoList] Fetch ISO list failed')
    } finally {
      if (alive) isLoading.value = false
    }
  }

  async function download(id: string): Promise<void> {
    // 照 Vue2 downloadOS(:277-285):先乐观置 _downloading/_progress,再发请求。
    const row = findIso(id)
    if (!row) return
    row._downloading = true
    row._progress = 0
    try {
      await service.kvm.downloadISO(id)
    } catch (e) {
      // ⚠️ 有意照抄 Vue2(:282-284),不是疏漏:Vue2 认为下载是后端异步任务,POST 失败
      // 也可能只是响应丢了、任务其实已经起来了,所以不回滚这里的乐观状态,只记日志。
      console.warn('[useIsoList] downloadISO POST failed:', e instanceof Error ? e.message : e)
    }
    // 注意:alive 守卫故意不放在这里短路——即使 dispose 之后到达,这次调用本身没有
    // 后续要写的共享 state 了(乐观状态已经在请求发出前写过),没有额外污染可言。
  }

  // ===================== MessageBus 事件(照 Vue2 sockets:146-175) =====================
  const bus = useMessageBus()
  const unsubs: (() => void)[] = []

  unsubs.push(bus.on(EVT_PROGRESS, (props) => {
    if (!alive) return // 过期守卫:dispose 之后到达的事件不再写 state
    const isoId = isoIdOf(props)
    const p = props as Record<string, unknown>
    const progress = parseFloat(String(p?.progress))
    const downloaded = parseFloat(String(p?.downloaded))
    if (!isoId || Number.isNaN(progress)) return
    const row = findIso(isoId)
    if (!row || !row._downloading) return
    row._progress = progress
    row._downloadedBytes = downloaded
  }))

  unsubs.push(bus.on(EVT_COMPLETE, (props) => {
    if (!alive) return
    const isoId = isoIdOf(props)
    if (!isoId) return
    const row = findIso(isoId)
    if (!row) return
    row._downloading = false
    row._downloaded = true
    row._progress = 100
    doneCb?.(row)
  }))

  unsubs.push(bus.on(EVT_FAILED, (props) => {
    if (!alive) return
    const isoId = isoIdOf(props)
    if (!isoId) return
    const row = findIso(isoId)
    if (!row) return
    row._downloading = false
    failedCb?.(row)
  }))

  function dispose(): void {
    alive = false
    unsubs.forEach((off) => off())
    unsubs.length = 0
  }

  return {
    isos,
    isLoading,
    fetch,
    download,
    onDownloadDone,
    onDownloadFailed,
    dispose,
  }
}
