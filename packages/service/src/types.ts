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
  // 真实响应里有(2026-08-01 实测 GET /v1/folder?path=/DATA),迁移弹窗的浏览步骤
  // 靠它把符号链接排除在目标目录之外。可选是为了不打破既有构造点。
  is_symlink?: boolean
  // 真实响应里有(2026-08-03 实测 GET /v1/folder?path=/DATA,每个条目都带;后端
  // NimoOS/model/zima.go:15-26 的 Path.Size int64)。SP9-P6 的 OSSelector 自定义区
  // 用它显示 .iso 文件大小。可选是为了不打破既有构造点。
  size?: number
}

export interface FolderListing {
  content: FolderEntry[]
}

export interface AppGridWidget {
  path: string; w?: number; h?: number
  // nimoos.widget.minw/... 自定义可调整范围(缺省 = 全局 2×1..4×4)
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
  /** DB 里存的是**服务端绝对路径**(如 /var/lib/nimoos/1/avatar.png),不是 URL。
   *  本机实测为空串 —— 界面要用 users.avatarPath() 拼 URL,不要直接用这个字段。 */
  avatar?: string
  description?: string
  created_at?: string
  updated_at?: string
  [k: string]: unknown
}

/** GET /v1/users/members 的一行。后端是 handler 内联匿名 struct
 *  (NimoOS-UserService/route/v1/user.go:685-691)。
 *  ⚠️ GetAllMembers 只隐藏调用者本人、**不隐藏其它管理员**(user.go:694-697 注释明确),
 *  所以这个列表里可能出现 role==='admin' 的行 —— 消费方不要按 role 过滤。 */
export interface MemberInfo {
  id: number
  username: string
  role: string
  /** 该成员数据目录下的子目录个数(os.ReadDir 数出来的),不是被授权的文件夹数。 */
  folder_count: number
  created_at: string
}

/** user_folder_permissions 表的一行。
 *  Go: NimoOS-UserService/service/model/o_user.go:33-40。
 *  ⚠️ NimoOS core 启动时**只读打开**这张表做文件区权限判定 —— 字段名不要改。 */
export interface UserFolderPermission {
  id: number
  user_id: number
  path: string
  /** 'read' = r-x,'write' = rwx。后端对非法值静默回落成 'read'(user.go:762-764)。 */
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

/** GET /v1/sys/hardware(核心服务,标准信封)
 * curl 实证 2026-07-31:hardware_name / drive_model 在本机是空串 —— 消费方必须有回退,不能假设非空。
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

/** POST /v1/container/prune 的 data。字段名是 Docker SDK 结构体的大写驼峰
 *  (NimoOS-AppManagement/service/container.go:902 直接把 types.ContainersPruneReport /
 *   types.ImagesPruneReport 塞进信封,没有 json tag 改写)。 */
export interface PruneReport {
  containers: { ContainersDeleted: string[] | null; SpaceReclaimed: number } | null
  images: { ImagesDeleted: unknown[] | null; SpaceReclaimed: number } | null
}

// ---- SP5: AppStore / Compose(v2 app_management,字段保留后端 snake_case)----
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
  /** 安装前须知:多语言 markdown map(curl 实证形如 {before_install:{en_US:"…",zh_CN:"…"}} 或 null) */
  tips?: { before_install?: Record<string, string> | null } | null
  [k: string]: unknown
}

/** GET /apps 的 data:installed 是已装 store_app_id 列表,list 是 id→info 映射 */
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

// ---- SP9-P1: sys 域(系统信息/迁移/网关/USB)----
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

// ── network 域(NimoOS core /v2/nimoos/network/*)───────────────────────────
// 逐字对位 NimoOS-Common/model/network.go。⚠️ 蛇形(is_virtual)与驼峰(hybridCapable)
// 混用是后端的既成事实,不要"顺手统一"。
// ⚠️ mac / state / speed / ports 这几个字段后端 GET 时**永远不填**
//   (GetAllInterfaceConfigs 只从 network-config.json 构造 name/type/is_virtual/ipv4/
//    zone/wireless/hybridCapable)—— 保留在类型里是因为 Go struct 里有(无 omitempty
//    一定序列化),但消费方要从 /v1/sys/utilization 取运行时 state/speed/addr。
export interface NetworkIPv4Config {
  method: string            // "static" | "dhcp" | "manual"
  address?: string
  netmask?: string
  gateway?: string
  dns?: string[]
}

export interface NetworkWirelessConfig {
  mode: string              // "client" | "ap" | "concurrent"(config 里还可能是 "manual")
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
  is_virtual: boolean       // 蛇形
  mac: string               // 实测恒空串
  speed?: string            // Go 是 string(如 "1000");实测不返回
  state: string             // 实测恒空串
  ipv4?: NetworkIPv4Config
  wireless?: NetworkWirelessConfig
  zone?: string             // "lan" | "wan" | ""
  ports?: string[]
  hybridCapable?: boolean   // 驼峰;只对 type=="wifi" && !is_virtual 且 config 里已有的接口算
}

/** PUT 的请求体 —— 只下发这 4 个字段(对位 Vue2 NetworkIfaceConfigModal.save() 的形状)。 */
export interface NetworkInterfaceUpdate {
  name: string
  zone?: string
  ipv4?: NetworkIPv4Config
  wireless?: NetworkWirelessConfig
}

/** GET /v2/nimoos/network/wifi/scan 的一条。对位 NimoOS-Common/pkg/network/wifi.go WifiNetwork。 */
export interface WifiScanResult {
  ssid: string
  bssid: string
  signal: number            // dBm,负数(如 -45)
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
