// ${HOST} → 设备源(如 http://192.168.1.10)。用 encodeURI(保留 :// )对齐 Vue2 MountActionButton;
// 并保留 Vue2 的 redirect_uri http%→https% 改写(对当前 auth_url 多为 no-op,存 parity)。
export function buildAuthUrl(authUrl: string, origin: string): string {
  return authUrl.replace('${HOST}', encodeURI(origin)).replace('redirect_uri=http%', 'redirect_uri=https%')
}

// 驱动图标现在由本应用自己伺服(public/img/driver/**,随构建落到 /app/img/driver/**)。
// 后端返回的是**站点根**相对路径(`./img/driver/GoogleDrive.svg`,见 NimoOS `drivers/*/meta.go`
// 的 ICONURL),那份文件原本来自 Vue2 的构建产物;Vue2 从设备下线后站点根不再有 img/,
// 故这里只取后端路径的**文件名**,重新挂到本应用的 base 下(与 PdfViewer 引用 cmaps/ 同款)。
// 后端将来新增驱动时,把对应 svg 一并放进 public/img/driver/ 即可。
export function driverIconUrl(icon: string, origin: string): string {
  const file = icon.replace(/^.*\//, '')
  return origin.replace(/\/$/, '') + import.meta.env.BASE_URL + 'img/driver/' + file
}
