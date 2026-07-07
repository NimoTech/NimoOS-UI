// ${HOST} → 设备源(如 http://192.168.1.10)。用 encodeURI(保留 :// )对齐 Vue2 MountActionButton;
// 并保留 Vue2 的 redirect_uri http%→https% 改写(对当前 auth_url 多为 no-op,存 parity)。
export function buildAuthUrl(authUrl: string, origin: string): string {
  return authUrl.replace('${HOST}', encodeURI(origin)).replace('redirect_uri=http%', 'redirect_uri=https%')
}

// 驱动图标由设备静态根(Vue2 www 仍伺服在 /)提供,非 /app/;把 ./img/.. 归一为 origin + /img/..
export function driverIconUrl(icon: string, origin: string): string {
  return origin.replace(/\/$/, '') + '/' + icon.replace(/^\.?\//, '')
}
