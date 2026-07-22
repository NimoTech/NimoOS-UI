// 旧标签页 × 重新部署:懒加载 chunk(预览器/懒路由)带哈希文件名,deploy.sh 的
// rsync --delete 会删掉旧哈希文件。部署前就打开的标签页第一次点开这些功能时,
// 动态 import 404 → 界面毫无反应,且失败的 module fetch 被浏览器缓存,重试同
// URL 也无法自愈,只有整页刷新拿到新 index.html 才能恢复(真机复现:粘贴截图后
// 左键打不开,必须手动刷新)。Vite 在 preload 失败时对 window 派发
// vite:preloadError —— 收到即自动整页刷新,替用户完成那次"必须的刷新"。
// sessionStorage 记录上次自动刷新时间,10s 内不重复刷:若刷新后仍失败(如服务器
// 真挂了),不能陷入无限刷新环。

const KEY = 'nimoos-chunk-reload-at'
const MIN_INTERVAL_MS = 10_000

export function shouldReload(now: number, storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  const last = Number(storage.getItem(KEY) || 0)
  if (now - last < MIN_INTERVAL_MS) return false
  storage.setItem(KEY, String(now))
  return true
}

export function installChunkReloadGuard(
  target: Pick<Window, 'addEventListener'> = window,
  reload: () => void = () => window.location.reload(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
): void {
  target.addEventListener('vite:preloadError', (e: Event) => {
    if (!shouldReload(Date.now(), storage)) return // 节流拒绝:让错误正常冒泡,控制台可见
    e.preventDefault() // 即将整页刷新,吞掉这次未处理异常
    reload()
  })
}
