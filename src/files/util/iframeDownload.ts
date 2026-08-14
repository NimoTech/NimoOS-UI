// Ported from Vue2 downloadFile hidden iframe: the entire application reuses one, only changing src to trigger download.
let iframe: HTMLIFrameElement | null = null

export function triggerIframeDownload(url: string): void {
  if (!iframe || !document.body.contains(iframe)) {
    iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)
  }
  iframe.src = url
}
