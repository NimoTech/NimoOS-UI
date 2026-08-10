import { ref } from 'vue'
import { service, type TerminalWindow } from '@nimotech/nimoos-service'
import { statusOf } from './terminalHttp'

// tmux window tabs: 3s poll + the four mutations, ported from Vue2 Terminal.vue.
// Any 401 means the ticket died (expiry / service restart / policy change) —
// surfaced through onAuthLost so the owner locks the page. All other errors are
// best-effort silent (1:1 Vue2; closing the last window answers 409 by design).
// Registered deviation (spec §4-1): responses landing after stop() are discarded
// via an epoch counter.
export function useTerminalWindows(onAuthLost: () => void) {
  const windows = ref<TerminalWindow[]>([])
  let timer: ReturnType<typeof setInterval> | undefined
  let epoch = 0

  async function refresh() {
    const myEpoch = epoch
    try {
      const list = await service.terminal.listWindows()
      if (myEpoch !== epoch) return
      windows.value = Array.isArray(list) ? list : []
    } catch (e) {
      if (myEpoch !== epoch) return
      if (statusOf(e) === 401) onAuthLost()
    }
  }

  function start() {
    stop()
    void refresh()
    timer = setInterval(() => { void refresh() }, 3000)
  }

  function stop() {
    epoch++
    if (timer) { clearInterval(timer); timer = undefined }
    windows.value = []
  }

  async function run(op: () => Promise<unknown>) {
    const myEpoch = epoch
    try {
      await op()
      if (myEpoch === epoch) await refresh()
    } catch (e) {
      if (myEpoch !== epoch) return
      if (statusOf(e) === 401) onAuthLost()
      // anything else (incl. 409 on the last window) is silently ignored, 1:1 Vue2
    }
  }

  const select = (i: number) => run(() => service.terminal.selectWindow(i))
  const create = () => run(() => service.terminal.newWindow())
  const close = (i: number) => run(() => service.terminal.closeWindow(i))
  async function rename(i: number, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    await run(() => service.terminal.renameWindow(i, trimmed))
  }

  return { windows, start, stop, select, create, close, rename }
}
