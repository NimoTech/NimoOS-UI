// 移植 Vue2 downloadFile 的隐藏 iframe:全应用复用一个,只换 src 触发下载。
let iframe: HTMLIFrameElement | null = null

export function triggerIframeDownload(url: string): void {
  if (!iframe || !document.body.contains(iframe)) {
    iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
  }
  iframe.src = url
}
