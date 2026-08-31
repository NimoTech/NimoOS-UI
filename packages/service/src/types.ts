export type UtilSection = Record<string, unknown> | null

export interface Utilization {
  cpu: UtilSection
  mem: UtilSection
  disk: UtilSection
  gpu: UtilSection
  net: UtilSection
  usb: UtilSection
}

export interface StdEnvelope<T = unknown> {
  success: number
  message?: string
  data?: T
}

export interface EventModel {
  uuid: string
  name: string
  source_id?: string
  properties: string
  timestamp: number
}

export interface FolderEntry {
  name: string
  path: string
  is_dir: boolean
  // Present in real responses (measured 2026-08-01, GET /v1/folder?path=/DATA); the migration dialog's browse step
  // relies on it to exclude symlinks from target directories. Optional so existing construction sites don't break.
  is_symlink?: boolean
  // Present in real responses (measured 2026-08-03, GET /v1/folder?path=/DATA, on every entry; backend
  // Path.Size int64 in NimoOS/model/zima.go:15-26). The OSSelector custom section
  // uses it to display .iso file sizes. Optional so existing construction sites don't break.
  size?: number
}

export interface FolderListing {
  content: FolderEntry[]
}

export interface AppGridWidget {
  path: string; w?: number; h?: number
  // nimoos.widget.minw/... custom resizable range (default = global 2×1..4×4)
  minw?: number; minh?: number; maxw?: number; maxh?: number
}

export interface AppGridItem {
  name: string
  title?: Record<string, string>
  icon?: string
  app_type?: string
  status?: string
  scheme?: string
  port?: string | number
  index?: string
  hostname?: string
  desktop?: boolean
  widget?: AppGridWidget
}

export interface PhotoAsset { id: string | number; [k: string]: unknown }

export interface FileContent { content: string; [k: string]: unknown }

export interface ServerUploadTask {
  id: string
  filename: string
  relative_path: string
  target_path: string
  size: number
  mime: string
  offset: number
  upload_url: string
  retry_count: number
  created_at: number
  batch_id: string
}

export interface UploadPrecheckResult {
  // size_match / is_dir are optional in the type but always present from the
  // NimoOS core handler (route/v2/precheck_file.go) — optional only so an old
  // or degraded body can't break the type contract.
  results: { relativePath: string; exists: boolean; size_match?: boolean; is_dir?: boolean }[]
}

export interface UserInfo {
  id?: number | string
  username?: string
  role?: string
  email?: string
  nickname?: string
  /** The DB stores a **server-side absolute path** (e.g. /var/lib/nimoos/1/avatar.png), not a URL.
   *  Measured empty on this machine — the UI must build the URL via users.avatarPath(), never use this field directly. */
  avatar?: string
  description?: string
  created_at?: string
  updated_at?: string
  [k: string]: unknown
}

/** One row of GET /v1/users/members. The backend uses an inline anonymous struct in the handler
 *  (NimoOS-UserService/route/v1/user.go:685-691).
 *  ⚠️ GetAllMembers hides only the caller themselves and does **not hide other admins** (explicit in the user.go:694-697 comment),
 *  so rows with role==='admin' can appear in this list — consumers must not filter by role. */
export interface MemberInfo {
  id: number
  username: string
  role: string
  /** Number of subdirectories under this member's data directory (counted via os.ReadDir), not the number of authorized folders. */
  folder_count: number
  created_at: string
}

/** One row of the user_folder_permissions table.
 *  Go: NimoOS-UserService/service/model/o_user.go:33-40.
 *  ⚠️ NimoOS core opens this table **read-only** at startup for file-area permission checks — do not rename fields. */
export interface UserFolderPermission {
  id: number
  user_id: number
  path: string
  /** 'read' = r-x, 'write' = rwx. The backend silently falls back to 'read' for invalid values (user.go:762-764). */
  permission: 'read' | 'write' | string
  created_at: string
}

export interface LoginResult {
  token: { access_token: string; refresh_token: string; expires_at: string }
  user: UserInfo
}

export interface UserStatus {
  initialized: boolean
  key?: string
}

export interface SambaConnection {
  id: number
  host: string
  mountPoint: string
}

export interface CloudMount {
  fs: string
  name: string
  icon: string
  mountPoint: string
}

export interface CloudDriver {
  name: string
  icon: string
  authUrl: string
}

/** GET /v1/sys/hardware (core service, standard envelope)
 * Verified via curl 2026-07-31: hardware_name / drive_model are empty strings on this machine — consumers must have a fallback and cannot assume non-empty.
 */
export interface HardwareInfo {
  arch: string
  cpu_cores?: number
  cpu_freq?: number
  cpu_model?: string
  drive_model?: string
  gpu_list?: string[]
  hardware_id?: string
  hardware_name?: string
  ram_speed?: string
  ram_total?: number
  ram_type?: string
  version?: string
  [k: string]: unknown
}

export interface DockerNetwork {
  name: string
  driver: string
  id: string
}

/** data of POST /v1/container/prune. Field names are the Docker SDK structs' UpperCamelCase
 *  (NimoOS-AppManagement/service/container.go:902 stuffs types.ContainersPruneReport /
 *   types.ImagesPruneReport straight into the envelope, with no json tag rewriting). */
export interface PruneReport {
  containers: { ContainersDeleted: string[] | null; SpaceReclaimed: number } | null
  images: { ImagesDeleted: unknown[] | null; SpaceReclaimed: number } | null
}

// ---- SP5: AppStore / Compose (v2 app_management, fields keep the backend's snake_case) ----
export interface AppCategory {
  id?: number
  name: string
  font?: string
  count?: number
  description?: string
}

export interface StoreAppInfo {
  store_app_id?: string
  title: Record<string, string>
  tagline?: Record<string, string>
  description?: Record<string, string>
  icon?: string
  thumbnail?: string
  screenshot_link?: string[]
  category?: string
  author?: string
  developer?: string
  index?: string
  port_map?: string
  architectures?: string[]
  /** Pre-install notice: multilingual markdown map (verified via curl, shaped like {before_install:{en_US:"…",zh_CN:"…"}} or null) */
  tips?: { before_install?: Record<string, string> | null } | null
  [k: string]: unknown
}

/** data of GET /apps: installed is the list of installed store_app_ids, list is an id→info map */
export interface StoreAppCatalog {
  installed: string[]
  list: Record<string, StoreAppInfo>
}

export interface UpgradableAppInfo {
  store_app_id?: string
  title?: Record<string, string>
  [k: string]: unknown
}

export interface AppStoreSource {
  id: number
  url: string
  store_root?: string
}

export interface ComposeAppWithStoreInfo {
  store_info?: StoreAppInfo
  compose?: unknown
  status?: string
  update_available?: boolean
  is_uncontrolled?: boolean
  [k: string]: unknown
}

// ---- sys domain (system info / migration / gateway / USB) ----
export interface UpdateCheck {
  current_version: string
  latest_version?: string
  need_update: boolean
  is_downloaded?: boolean
  is_downloading?: boolean
  is_paused?: boolean
  download_progress?: number
  version?: { change_log?: string; [k: string]: unknown }
}
export interface SysBaseInfo { device_id: string; model: string; version: string }
export interface SystemPathEntry { path: string; size: number }
export type SystemPaths = Record<string, SystemPathEntry>
export interface SSLConfig {
  enabled: boolean; port: string; domain: string; cert_type: string
  effective_time: string; expiration_time: string
}
export interface SSLConfigInput { enabled: boolean; domain: string; port: string; cert_type: string }
export interface GatewayComponent {
  name: string; category: string; version: string; status: string; error: string; probed_at: string
}
export interface GatewayDeviceInfo { hostname: string; os: string; version: string }
// Gateway LAN discovery (GET /gateway/lan-discovery). Bare JSON, see sys.ts.
export interface LanDevice { ip: string; hostname: string; version: string; self: boolean }
export interface LanDiscovery { devices: LanDevice[]; truncated: boolean }
export interface MigrateStatus {
  id: string; type: string; status: string; phase: string
  stopping_apps: number; progress: number
  processed_size: number; total_size: number
  new_path?: string; error?: string
}

// ── network domain (NimoOS core /v2/nimoos/network/*) ───────────────────────────
// Matches NimoOS-Common/model/network.go verbatim. ⚠️ Mixing snake_case (is_virtual) and camelCase (hybridCapable)
// is an established backend fact — do not "tidy it up in passing".
// ⚠️ The mac / state / speed / ports fields are **never filled** by the backend on GET
//   (GetAllInterfaceConfigs builds only name/type/is_virtual/ipv4/
//    zone/wireless/hybridCapable from network-config.json) — kept in the type because the Go struct has them (no omitempty,
//    always serialized), but consumers must get runtime state/speed/addr from /v1/sys/utilization.
export interface NetworkIPv4Config {
  method: string            // "static" | "dhcp" | "manual"
  address?: string
  netmask?: string
  gateway?: string
  dns?: string[]
}

export interface NetworkWirelessConfig {
  mode: string              // "client" | "ap" | "concurrent" (may also be "manual" in config)
  ssid?: string
  apSsid?: string
  password?: string
  apPassword?: string
  channel?: number
  hybridMode?: boolean
}

export interface NetworkInterfaceConfig {
  name: string
  type: string              // "ethernet" | "bridge" | "wifi" | "thunderbolt"
  is_virtual: boolean       // snake_case
  mac: string               // always empty string in practice
  speed?: string            // Go type is string (e.g. "1000"); not returned in practice
  state: string             // always empty string in practice
  ipv4?: NetworkIPv4Config
  wireless?: NetworkWirelessConfig
  zone?: string             // "lan" | "wan" | ""
  ports?: string[]
  hybridCapable?: boolean   // camelCase; only computed for interfaces with type=="wifi" && !is_virtual that already exist in config
}

/** PUT request body — only these 4 fields are sent (matching the shape of Vue2 NetworkIfaceConfigModal.save()). */
export interface NetworkInterfaceUpdate {
  name: string
  zone?: string
  ipv4?: NetworkIPv4Config
  wireless?: NetworkWirelessConfig
}

/** One entry of GET /v2/nimoos/network/wifi/scan. Matches NimoOS-Common/pkg/network/wifi.go WifiNetwork. */
export interface WifiScanResult {
  ssid: string
  bssid: string
  signal: number            // dBm, negative (e.g. -45)
  channel: number
  secure: boolean
  connected: boolean
}

/** Result of POST/PUT /v1/users/current/image/{key}. */
export interface UserImageResult { path: string; file_name: string; online_path: string }

// Upload-batch reconciliation (SP12). Backend shapes are RAW JSON with no
// standard {success,data} envelope — see service/upload/batch.go in NimoOS.
export interface CreateBatchInput {
  id: string
  targetPath: string
  items: { relativePath: string; size: number }[]
}

export interface UploadBatch {
  id: string
  owner_user_id: string
  target_path: string
  status: string
  total: number
  done: number
  last_progress_at: number
  interrupted_at: number
  created_at: number
  updated_at: number
}

export interface UploadBatchItem {
  batch_id: string
  relative_path: string
  size: number
  done: boolean
}

export interface BatchDetail {
  batch: UploadBatch | null
  missing: UploadBatchItem[]
}
