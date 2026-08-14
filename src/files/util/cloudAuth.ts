// ${HOST} → device origin (e.g. http://192.168.1.10). Use encodeURI (preserve :// ) to align with Vue2 MountActionButton;
// and preserve Vue2's redirect_uri http%→https% rewriting (mostly a no-op for current auth_url, kept for parity).
export function buildAuthUrl(authUrl: string, origin: string): string {
  return authUrl.replace('${HOST}', encodeURI(origin)).replace('redirect_uri=http%', 'redirect_uri=https%')
}

// Driver icons are now served by this app itself (public/img/driver/**, deployed to /app/img/driver/** on build).
// The backend returns **site-root**-relative paths (`./img/driver/GoogleDrive.svg`, see NimoOS `drivers/*/meta.go`
// 's ICONURL); that file originally came from Vue2's build output; after Vue2 was taken offline from the device, img/ is no longer at site root,
// so here we only take the **filename** from the backend path and re-mount it under this app's base (same pattern as PdfViewer references cmaps/).
// When new drivers are added to the backend in the future, just place the corresponding svg in public/img/driver/ as well.
export function driverIconUrl(icon: string, origin: string): string {
  const file = icon.replace(/^.*\//, '')
  return origin.replace(/\/$/, '') + import.meta.env.BASE_URL + 'img/driver/' + file
}
