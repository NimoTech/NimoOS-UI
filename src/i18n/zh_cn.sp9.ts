// SP9 (final-stretch views: System Settings / KVM / Search) copy slice.
// Developed in parallel with sp7/sp8 — slicing keeps the three lines from colliding in i18n (spec §4.2 / §9.3).
// Convention: flat keys, values must be strings (parity.test.ts asserts typeof v === 'string').
export default {
  settingsTitle: '设置',
  settingsTabGeneral: '通用',
  settingsTabStorage: '存储',
  settingsTabNetwork: '网络',
  settingsTabApps: '应用',
  settingsTabTerminal: '终端与日志',
  settingsTabSystemStatus: '系统状态',
  settingsTabLanDevices: '局域网设备',
  settingsTabFolderPermissions: '文件夹权限',
  settingsTabAccount: '账户',
  settingsTabDeveloper: '开发者模式',
  settingsSkeletonHint: '本页内容将在后续阶段接入。',
  // ── P1 general ──
  settingsDeviceInfoBtn: '设备信息',
  settingsDeviceInfoTitle: '设备信息',
  settingsDeviceNoGpu: '未检测到独立显卡',
  settingsDeviceDetecting: '检测中…',
  settingsWallpaper: '壁纸',
  settingsWallpaperChange: '更改',
  settingsLanguage: '语言',
  settingsLanguageNa: '新版界面目前只有简体中文与英文',
  settingsTimezone: '时区',
  settingsDiskStandby: '硬盘待机',
  settingsStandbyNever: '从不',
  settingsStandby10m: '10 分钟',
  settingsStandby20m: '20 分钟',
  settingsStandby30m: '30 分钟',
  settingsStandby1h: '1 小时',
  settingsStandby2h: '2 小时',
  settingsStandby3h: '3 小时',
  settingsStandby4h: '4 小时',
  settingsStandby5h: '5 小时',
  settingsWebuiPort: 'WebUI 端口',
  settingsPortPlaceholder: '端口',
  settingsPortRange: '端口范围为 80-65535',
  settingsPortSwitching: '正在切换到新端口…',
  settingsPortTimeout: '新端口没有响应,请手动访问。',
  settingsUsbAutoMount: '自动挂载USB磁盘',
  settingsUsbRpiWarn: '启用此功能可能会导致启动从 USB 存储设备的 Raspberry Pi 设备时出现启动失败',
  settingsRecommendApps: '显示推荐应用',
  settingsNewsFeed: '新闻流',
  settingsNewsFeedTitle: '新闻流',
  settingsNewsFeedConfirm: '开启后，仪表板会通过互联网获取 NimoOS 资讯。请求由你的浏览器直接发出，新闻来源能看到你的 IP 地址。是否接受？',
  settingsAccept: '接受',
  settingsCancel: '取消',
  settingsConfirm: '确认',
  settingsSave: '保存',
  settingsSaveSuccess: '保存成功',
  settingsSaveFailed: '保存配置失败',
  settingsError: '发生错误',
  settingsFirmwareUpdate: '固件更新',
  settingsSystemUpdate: '系统更新',
  settingsLatestVersion: '当前已经是最新版',
  settingsDownloaded: '已下载',
  settingsDownloading: '下载中',
  settingsCheckUpdate: '检查更新',
  settingsUpdateNow: '立即升级',
  settingsUpdateAvailable: '可用更新',
  settingsUpdateTitle: '更新',
  settingsDownloadNow: '立即下载',
  settingsUpgradeNow: '立即更新',
  settingsDownloadingSystem: '正在下载系统更新',
  settingsDownloadCancelled: '下载已取消',
  settingsDownloadCancelFailed: '取消下载失败',
  settingsUpgradeFailed: '升级过程中似乎出现了问题，请重试。',
  // ── P1 power flow ──
  settingsShutdown: '关机',
  settingsRestart: '重启',
  settingsShutdownConfirmTitle: '确认关机?',
  settingsShutdownConfirmMsg: '系统将会关闭,期间无法访问。',
  settingsRestartConfirmTitle: '确认重启?',
  settingsRestartConfirmMsg: '系统将会重启,期间短暂无法访问。',
  settingsPowerShutting: '正在关机',
  settingsPowerShuttingMsg: '请等待约 30 秒后再断开电源。',
  settingsPowerOffline: '设备已关机',
  settingsPowerOfflineMsg: '现在可以安全断电。',
  settingsPowerRestarting: '正在重启',
  settingsPowerRestartingMsg: '正在发送重启指令...',
  settingsPowerReconnecting: '正在重新连接',
  settingsPowerReconnectingMsg: '系统正在重启，将自动重新连接...',
  settingsPowerBack: '系统已恢复在线',
  settingsPowerBackMsg: '正在跳转...',
  settingsPowerAppUpdating: '系统正在更新',
  settingsPowerAppUpdatingMsg: '请等待系统更新并重启...',
  settingsPowerFallback: '重启时间较长',
  settingsPowerFallbackMsg: '请手动刷新页面。',
  settingsRefresh: '刷新',
  // ── P1 developer ──
  settingsHttps: 'HTTPS',
  settingsHttpsConfig: '网页 HTTPS 配置',
  settingsHttpsTitle: '网页 HTTPS',
  settingsHttpsDomain: '主域名',
  settingsHttpsEffective: '生效时间',
  settingsHttpsExpiration: '过期时间',
  settingsHttpsPort: '端口',
  settingsHttpsCert: 'SSL 证书',
  settingsHttpsCertAuto: '自动 (自签名证书)',
  settingsHttpsCertCustom: '上传证书',
  settingsHttpsTrust: '信任证书',
  settingsHttpsDownloadCa: '下载 CA 证书',
  settingsHttpsCertFiles: '证书文件',
  settingsHttpsBothFiles: '请同时上传 PEM 和 CRT 文件。',
  settingsHttpsUploadFailed: '上传证书失败',
  // ── P2 network ── (Chinese text taken verbatim from the Vue2 zh_CN.json translation; the 9 lines
  // tagged 🆕补译/newly-translated were missing from all 31 Vue2 language files — the Chinese UI showed the
  // raw English fallback — and were translated per the decision confirmed with the user on 2026-07-31 → declared deviation #8)
  settingsNetConnection: '连接',                     // 🆕补译
  settingsNetEmpty: '未找到网络接口',                 // 🆕补译
  settingsNetLoading: '加载中...',                    // 🆕新增(Vue2 是 b-loading 转圈无文字)
  settingsNetTypeEthernet: '以太网',                  // 🆕补译
  settingsNetTypeWifi: 'Wi-Fi',                      // 🆕补译(保留原文,品牌词)
  settingsNetTypeHotspot: '热点',                     // 🆕补译(旁证:zh_CN.json 里 AP→热点)
  settingsNetTypeWifiHotspot: 'Wi-Fi + 热点',         // 🆕补译(Vue2 是两个 key 拼的)
  settingsNetTypeThunderbolt: 'Thunderbolt',
  settingsNetTypeVirtual: '虚拟网络',                 // 🆕补译
  settingsNetMenu: '接口操作',                        // 🆕新增(菜单按钮 aria-label)
  settingsNetEdit: '编辑',
  settingsNetSwitchClient: '切换到 Wi-Fi',
  settingsNetSwitchAp: '切换到热点',
  settingsNetSwitchHybrid: '切换到混合模式',
  settingsNetSwitchTitle: '切换模式',
  settingsNetSwitchMsg: '切换到 {mode}？这将改变 {iface} 的工作模式。',
  settingsNetSwitchFailed: '切换模式失败',             // 🆕新增(移植纪律 #3)
  settingsNetTargetAp: '热点',
  settingsNetTargetClient: '连接 WiFi',
  settingsNetTargetHybrid: 'Wi-Fi + 热点',
  settingsNetModeClient: 'Wi-Fi',
  settingsNetModeAp: '热点',
  settingsNetModeHybrid: 'Wi-Fi + 热点',
  settingsNetZone: '网络区域',
  settingsNetZoneNone: '无',
  settingsNetZoneLan: 'LAN',
  settingsNetZoneWan: 'WAN',
  settingsNetTbStatic: 'Thunderbolt 静态 IP 配置',
  settingsNetIpAddress: 'IP 地址',
  settingsNetNetmask: '子网掩码',
  settingsNetGateway: '网关',
  settingsNetDns: 'DNS 服务器',
  settingsNetIpv4Method: 'IPv4 分配',
  settingsNetIpv4Dhcp: '自动 (DHCP)',
  settingsNetIpv4Static: '手动 (静态 IP)',
  settingsNetSaveApply: '保存并应用',
  settingsNetUnconfigured: '此 Wi-Fi 接口尚未配置',
  settingsNetConnectWifi: '连接 WiFi',
  settingsNetCreateHotspot: '创建热点',
  settingsNetAvailable: '可用网络',
  settingsNetScan: '扫描',
  settingsNetScanning: '扫描中...',
  settingsNetScanHint: '点击扫描查看可用网络',
  settingsNetScanFailed: '扫描 Wi-Fi 失败',
  settingsNetConnected: '已连接',
  settingsNetSecure: '加密',                          // 🆕新增(锁标记 aria-label)
  settingsNetDisconnect: '断开连接',
  settingsNetDisconnected: '已断开连接',               // 🆕补译
  settingsNetDisconnectFailed: '断开连接失败',         // 🆕补译
  settingsNetPassword: '密码',
  settingsNetAdvanced: '高级设置',
  settingsNetApSsid: '热点名称 (SSID)',
  settingsNetBand: '频段',
  settingsNetBandAuto: '自动',
  settingsNetApplied: '设置已应用',
  settingsNetApplyFailed: '应用设置失败',
  settingsNetNothingToSave: '没有可保存的配置',        // 🆕补译
  // ── P3 apps tab ────────────────────────────────────────────────────────
  settingsAppsPathTitle: 'App 数据存储位置',
  settingsAppsAppData: 'App 数据',
  settingsAppsImages: 'App 镜像集',
  settingsAppsDatabase: '用户数据库',
  settingsAppsPhotosData: '相册缓存',
  settingsAppsChangeLocation: '更改存储位置',
  settingsAppsDockerCleanTitle: 'Docker 缓存清理',
  settingsAppsDockerCleanSub: '您的 Docker 环境已优化。',
  settingsAppsDockerCleaning: '正在优化...',
  settingsAppsDockerCleanConfirmTitle: '清理 Docker 缓存',                          // 🆕补译
  settingsAppsDockerCleanConfirmMsg: '这将删除所有未使用的容器、网络和镜像。确定要继续吗？', // 🆕补译
  settingsAppsDockerCleanConfirmOk: '清理',                                        // 🆕补译
  settingsAppsDockerCleanDone: 'Docker 环境已优化。',                               // 🆕补译
  settingsAppsDockerCleanFailed: '清理 Docker 缓存失败。',                          // 🆕补译
  settingsAppsPendingTitle: '清除本地未完成的上传',
  settingsAppsPendingNone: '本地无未完成任务',
  settingsAppsPendingClear: '清除',
  settingsAppsPendingDisabledHint: '待相册区迁移完成后启用',                          // 🆕(本期新增标注,做样子)
  // ── P3 migration dialog ────────────────────────────────────────────────────────
  settingsMigTitle: '存储位置',
  settingsMigCurrentLocation: '当前位置',
  settingsMigRequiredSpace: '所需空间',
  settingsMigSelectNew: '选择新位置',
  settingsMigNoOther: '没有其他可用的存储',
  settingsMigNext: '下一步',
  settingsMigBack: '返回',
  settingsMigStart: '开始迁移',
  settingsMigClose: '关闭',
  settingsMigNewFolder: '新建文件夹',
  settingsMigNoSubfolders: '没有子文件夹',                                          // 🆕补译
  settingsMigLoadFolderFailed: '加载文件夹失败',                                     // 🆕补译
  settingsMigCreateFolderFailed: '新建文件夹失败',                                   // 🆕补译
  settingsMigRename: '重命名',
  settingsMigRenameFailed: '重命名失败',
  settingsMigDelete: '删除',
  settingsMigDeleted: '已删除',
  settingsMigDeleteFailed: '删除失败',
  settingsMigCancel: '取消',
  settingsMigWillBeMoved: '将被移动',
  settingsMigNote: '提示',
  settingsMigNoteBody: '这将把所有数据移动到新位置。操作可能需要几分钟，具体取决于数据大小。',
  settingsMigNoteDocker: '在此过程中，Docker 将暂时停止。',
  settingsMigStopping: '正在停止服务...',
  settingsMigStoppingApps: '正在等待 {n} 个应用保存数据并退出...',
  settingsMigCopying: '正在迁移数据...',
  settingsMigStarting: '正在启动服务...',
  settingsMigKeepOpen: '在迁移完成前，请保持此窗口打开。',
  settingsMigDone: '迁移完成！',
  settingsMigFailed: '迁移失败',
  settingsMigCleanupTitle: '已自动清理',                                            // 🆕补译
  settingsMigCleanupBody: '目标磁盘上已传输的部分数据已被移除，你的原始数据完好无损。',   // 🆕补译
  // ── P3 system-status tab ───────────────────────────────────────────────
  settingsStatusTitle: '系统状态',
  settingsStatusRefresh: '刷新',
  settingsStatusGroupService: '核心服务',
  settingsStatusGroupUi: '前端界面',
  settingsStatusGroupExternal: '外部依赖',
  settingsStatusOnline: '在线',
  settingsStatusOffline: '离线',
  settingsStatusNoData: '暂无数据',
  // ── SP17 lan-devices tab (Vue2 #93) ────────────────────────────────────
  settingsLanTitle: '局域网设备',
  settingsLanRescan: '重新扫描',
  settingsLanSubtitle: '在局域网内发现的 NimoOS 设备',
  settingsLanScanning: '正在扫描局域网…',
  settingsLanDeviceFallback: 'NimoOS 设备',
  settingsLanThisDevice: '当前设备',
  settingsLanUnknownVersion: '未知版本',
  settingsLanTruncated: '扫描范围被截断,可能有设备未显示。',
  settingsLanEmpty: '未发现其他 NimoOS 设备。请确认对方设备已开机且在同一网段。',
  settingsLanFailed: '扫描失败,请稍后重试。', // new in SP17: Vue2 shows the empty state on failure
  // ── P3 terminal tab ────────────────────────────────────────────────────
  settingsTermTerminal: '终端',
  settingsTermLogs: '日志',
  settingsTermDownloadLogs: '下载日志',
  settingsTermLoadingLogs: '正在拉取系统日志...', // Vue2 LogsCard.vue:11 内联文案
  settingsTermUnavailable: '终端服务暂不可用',
  settingsTermUnavailableHint: '系统终端的后端接口（/v1/sys/wsssh）已被停用，终端与终端安全策略暂不可用。', // 🆕(本期空态说明)
  settingsTermFullscreen: '全屏',
  settingsTermExitFullscreen: '退出全屏',        // 🆕(Vue2 全屏按钮只有图标,无文字)
  // 🆕 Log pagination (no Vue2 equivalent — it renders the whole log in one block; this interaction was added in this pass to fix the "page unresponsive" issue)
  settingsTermLogsOlder: '‹ 更早',
  settingsTermLogsNewer: '更新 ›',
  settingsTermLogsPage: '第 {page} / {total} 页',
  settingsTermLogsLive: '实时刷新中',
  settingsTermLogsPaused: '已暂停实时刷新 · 回第 1 页恢复',
  // ── P3 storage tab (entry card, declared deviation #3) ────────────────────────────────
  settingsStoreEntryTitle: '打开存储区',          // 🆕(本期新增入口卡,授权偏离 #3)
  settingsStoreEntrySub: '磁盘、存储空间、RAID 与快照都在存储区管理。',                 // 🆕(本期新增)
  settingsStoreTotal: '总存储',
  settingsStoreAvailable: '可用',
  settingsStoreSystem: '系统',
  settingsStoreFiles: '文件',
  settingsStoreNoStorage: '未找到存储',                                             // 🆕补译

  // ── folder-permissions (four sections) ─────────────────────────────────
  settingsFpIntro: '在下方各分区分别管理每个智能功能的文件夹。',
  settingsFpDataPending: '数据源待相册区(SP7)与 AI 区(SP8)合并后接入。',  // 🆕本期新增
  settingsFpFilenameIndex: '文件名索引',
  settingsFpServiceOffline: '服务离线',
  settingsFpFilenameDesc: '纳入文件名搜索索引的文件夹。',
  settingsFpNoFolders: '暂无文件夹。',
  settingsFpKnowledge: '知识库',
  settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',
  settingsFpIndexedFolders: '索引目录',
  settingsFpExcludedSubfolders: '排除的子目录',
  settingsFpAddExclusion: '添加排除',
  settingsFpNoExclusions: '暂无排除。',
  settingsFpAiHidden: '禁止 AI 访问的文件夹',
  settingsFpCurrentUserOnly: '仅当前用户',
  settingsFpAiDesc: 'AI agent 永远无法看到这些文件夹。',
  settingsFpNoAiBlocked: '未禁止任何文件夹——除内置系统黑名单外,AI 可访问全部。',
  settingsFpPhotos: '照片',
  settingsFpUpdateRequired: '需要更新',
  settingsFpPhotosDesc: '照片库监视的文件夹。',
  settingsFpPhotosAuto: '自动模式:Photos 当前监视以下文件夹(动态跟随挂载卷)。',
  settingsFpSwitchManual: '转为手动管理',
  settingsFpPhotosStale: 'Photos 服务需要更新后才能在此管理其目录。',
  settingsFpCoveredBy: '已被 {p} 覆盖',
  settingsFpGlobRules: '另有 {n} 条模式规则(如 *.key)在 AI 设置中管理。',
  settingsFpAddFolder: '添加文件夹',

  // ── account ────────────────────────────────────────────────────
  settingsAccOwnerLabel: '本机所有者账户',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccChangePassword: '更改密码',
  settingsAccChangeAvatar: '更改头像',
  settingsAccUploadFromDevice: '从本机上传',
  settingsAccChooseFromNas: '从NAS选择',
  settingsAccLogout: '退出账户',
  settingsAccMembers: '成员',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccAdd: '添加',
  settingsAccUsername: '用户名',
  settingsAccPassword: '密码',
  settingsAccConfirmPassword: '确认密码',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccFoldersUnit: '个文件夹',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccCreatedAt: '创建于',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccNoMembers: '暂无成员',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccMembersLoadFailed: '加载成员列表失败',  // 🆕本期新增
  settingsAccPickImageOnly: '请选择图片文件（JPG、PNG、GIF、WEBP、BMP）',
  settingsAccFillAllFields: '请填写所有字段',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccPwdMin6: '密码至少需要 6 个字符',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccPwdMismatch: '两次输入的密码不一致',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccMemberAdded: '成员添加成功',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccMemberAddFailed: '添加成员失败',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccDelete: '删除',
  settingsAccDeleted: '已删除',
  settingsAccDeleteFailed: '删除失败',
  settingsAccLoadFolderFailed: '加载文件夹失败',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccLoadImageFailed: '加载图片失败',
  settingsAccNoImagesHere: '此处没有图片文件',
  settingsAccOriPassword: '原密码',
  settingsAccNewPassword: '新密码',
  settingsAccConfirmNewPassword: '确认新密码',
  settingsAccBack: '返回',
  settingsAccSubmit: '提交',
  settingsAccUpdateOk: '更新成功',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccUpdateFailed: '更新失败',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccPreview: '预览',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccFoldersAccessiblePrefix: '以下文件夹可被 ',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccSystemDiskBlocked: ' 访问。系统盘默认不可访问。',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccFolderPath: '文件夹路径',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccPermission: '权限',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccReadOnly: '只读',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccReadWrite: '读写',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccGrant: '授权',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccAddFolder: '添加文件夹',
  settingsAccEnterFolderPath: '请输入文件夹路径',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccFolderGranted: '已授权文件夹',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccGrantFailed: '授权文件夹失败',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccRevokePrefix: '撤销访问权限:',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccRevoke: '撤销',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccAccessRevoked: '已撤销访问权限',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccRevokeFailed: '撤销失败',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccNoFoldersGranted: '未授权任何文件夹——仅数据盘(/DATA、/mnt、/media)可访问。',  // 🟡全语言缺译→补中文(用户 2026-08-01 拍板)
  settingsAccFoldersLoadFailed: '加载文件夹授权失败',  // 🆕本期新增

  // ── P5 KVM ── Chinese text follows Vue2 src/assets/lang/zh_CN.json as the source of truth (checked
  // line by line; wherever the draft differed, it was corrected to match zh_CN.json).
  kvmTitle: 'NIMO 虚拟机',
  kvmRunningSuffix: '运行中',
  kvmNoVms: '暂无虚拟机',
  kvmAddVm: '添加虚拟机',
  // zh_CN.json "Select a Virtual Machine" = "选择虚拟机" (not the brief draft's "选择一台虚拟机").
  kvmSelectVmTitle: '选择虚拟机',
  // zh_CN.json "Choose a VM from the list to view its console and manage it"
  // = "从列表中选择虚拟机查看控制台并进行管理" (the brief draft added extra characters "一台"/"以").
  kvmSelectVmHint: '从列表中选择虚拟机查看控制台并进行管理',
  kvmStateRunning: '运行中',
  kvmStateStopped: '已停止',
  kvmStatePaused: '已暂停',
  kvmStateSuspended: '已挂起',
  kvmStateError: '错误',
  // zh_CN.json line 90, $t(canEditSettings ? 'Settings' : ...), uses the same global "Settings" key
  // = "系统设置" (shared with the global settings dialog's i18n key; that's how Vue2 has it — copied as-is rather than rewritten to be a better fit).
  kvmSettings: '系统设置',
  // Final cleanup pass (dead-key removal): a `kvmSettingsDisabledHint` key had been pre-staged here
  // (a P5-stage placeholder with the exact same text as `kvmStopToModifySettings` below); when the
  // ConsoleHeader gear tooltip was actually implemented in P6 (:91), it was given the different name
  // `kvmStopToModifySettings` instead, and the pre-staged key was never consumed — the two keys had
  // duplicate text but only one was ever used, making it a genuine dead key. It has been removed
  // (this is not the "kept to document a reason" exception — it truly had no consumer; the brief's
  // Step 3 dead-key sweep says to delete it).
  // zh_CN.json "More" = "浏览更多" (in Vue2 this key is reused for the tooltip on the "more actions"
  // three-dot menu; the translation doesn't quite fit the context, but it's what Vue2 actually shows, copied as-is).
  kvmMore: '浏览更多',
  // Removed as a dead key in the full-branch review (C4, confirmed zero consumers via grep):
  // `kvmComingSoon` was originally the placeholder text for the P5-stage "gear permanently disabled +
  // coming soon" state; when the gear was re-enabled in P6 Task 9, its last consumer (ConsoleHeader.vue)
  // was removed, but the key itself was left behind.
  kvmPowerOn: '开机',
  kvmForceShutDown: '强制关机',
  kvmForceRestart: '强制重启',
  kvmPause: '暂停',
  // zh_CN.json "Resume" = "恢复" (not the brief draft's "继续").
  kvmResume: '恢复',
  kvmWakeUp: '唤醒',
  // zh_CN.json "Auto Start" = "自动启动" (not the brief draft's "开机自启").
  kvmAutoStart: '自动启动',
  kvmDelete: '删除',
  // zh_CN.json "Are you sure?" = "你确定吗？" (not the brief draft's "确定吗?"; note the full-width question mark).
  kvmAreYouSure: '你确定吗？',
  // zh_CN.json "Stopping VM" = "正在停止虚拟机" (not the brief draft's "正在停止").
  kvmStopping: '正在停止虚拟机',
  // zh_CN.json "Restarting VM" = "正在重启虚拟机" (not the brief draft's "正在重启").
  kvmRestarting: '正在重启虚拟机',
  // zh_CN.json "Deleting VM" = "正在删除虚拟机" (not the brief draft's "正在删除").
  kvmDeleting: '正在删除虚拟机',
  // zh_CN.json "VNC port not available, try restarting" = "VNC 端口不可用，请尝试重启"
  // (the brief draft tacked on the extra word "虚拟机" [VM] at the end; the source text has no such word).
  kvmVncPortUnavailable: 'VNC 端口不可用，请尝试重启',
  kvmVncFetchFailed: '获取 VNC 信息失败',
  // zh_CN.json "Installing from ISO. Click when finished:" = "正在从光盘安装。完成后请点击："
  // (the source text says "光盘" [optical disc], not "ISO", and doesn't repeat the word "安装" [installing]).
  kvmInstallingFromIso: '正在从光盘安装。完成后请点击：',
  // zh_CN.json "I Finished Installing" = "我已完成安装" (not the brief draft's "我已安装完成").
  kvmFinishedInstalling: '我已完成安装',
  // kvmEjectSuccess (the eject-success toast text) is defined below near the kvmToastXxx group — it
  // was previously deleted as a dead key during an earlier review, then added back when the
  // full-branch final review required a success toast; see the comment there for details.
  // 🆕 Newly translated: in Vue2 this one goes through getErrMsg(err, 'Failed to eject installation media')
  // and then $t() — zh_CN.json has no key for it, so the Vue2 Chinese UI actually falls back to
  // showing raw English (a leftover missing translation, same pattern seen in P1/P2).
  // New-UI supplies the Chinese text here rather than reproducing that missing translation.
  kvmEjectFailed: '弹出安装介质失败',
  kvmSpiceHint: '为获得更好体验，请使用 virt-viewer 客户端连接：',
  // zh_CN.json "Install virtio-win drivers..." = "在虚拟机中安装 virtio-win 驱动以启用剪贴板、
  // 音频和 USB 功能" (not the brief draft's "内"/"与").
  kvmSpiceAgentWin: '在虚拟机中安装 virtio-win 驱动以启用剪贴板、音频和 USB 功能',
  // zh_CN.json "Install spice-vdagent..." = "在虚拟机中安装 spice-vdagent 以启用剪贴板、音频
  // 和 USB 功能" (same as above — "内"/"与" changed to "中"/"和").
  kvmSpiceAgentLinux: '在虚拟机中安装 spice-vdagent 以启用剪贴板、音频和 USB 功能',
  // zh_CN.json "Toggle Ctrl/Alt/Shift" = "切换 Ctrl/Alt/Shift" (not the brief draft's "按住 …" [hold down …]).
  kvmToggleCtrl: '切换 Ctrl',
  kvmToggleAlt: '切换 Alt',
  kvmToggleShift: '切换 Shift',
  // zh_CN.json "Toggle Windows" = "切换 Windows" (not the brief draft's "按住 Windows 键" [hold down the Windows key]).
  kvmToggleWin: '切换 Windows',
  // zh_CN.json "Press Tab/Esc/Ctrl+Alt+Del" = "按下 …" (not the brief draft's "按 …", which drops the character "下").
  kvmPressTab: '按下 Tab',
  kvmPressEsc: '按下 Esc',
  kvmPressCtrlAltDel: '按下 Ctrl+Alt+Del',
  kvmFullscreen: '全屏',
  // 🆕 New: in Vue2 the fullscreen button's title is always $t('Fullscreen') (it never switches text
  // even once fullscreen is active — a legacy copy bug), and its alt attribute is hardcoded to the
  // English "Exit Fullscreen" and never goes through i18n. Per the porting discipline (match the UI
  // 1:1, but don't reproduce logic bugs), New-UI makes the aria-label correctly follow fullscreen
  // state, hence this extra key that zh_CN.json doesn't have.
  kvmExitFullscreen: '退出全屏',
  kvmClose: '关闭',
  // ⚠️ Removed in the full-branch final review (cleanup item 3): the original 7 keys
  // kvmFailedStart/Stop/Restart/Pause/Resume/Delete/Autostart had values word-for-word identical
  // to the kvmFailedToXxx family below (kvmFailedAutostart's very name didn't even match its
  // counterpart kvmFailedToSaveSettings — a mismatch that should have been caught on the spot),
  // while useVmList.ts's errText() fallback actually only references the kvmFailedToXxx set —
  // kvmFailedXxx had been dead all along; neither the compiler nor the tests would flag it, only a
  // manual comparison would catch it. Kept the set that's actually in use and removed these 7 keys,
  // which were never consumed.
  // 🆕 Added per review: the 8 fallback strings in useVmList.ts's errText() use the
  // "kvmFailedToXxx" key naming. Values are taken from the Vue2 zh_CN.json "Failed to xxx" series.
  kvmFailedToStart: '启动虚拟机失败',
  kvmFailedToStop: '停止虚拟机失败',
  kvmFailedToRestart: '重启失败',
  kvmFailedToPause: '暂停失败',
  kvmFailedToResume: '恢复失败',
  kvmFailedToSaveSettings: '保存设置失败',
  kvmFailedToDelete: '删除虚拟机失败',
  // ⚠️ Removed per review: kvmFailedToEjectMedia (original value "弹出安装介质失败", identical
  // to kvmEjectFailed above) was a duplicate key — useVmList.ejectInstallMedia's fallback was
  // changed to consume kvmEjectFailed directly (see the comment near :325 in that file), which
  // made this key dead, so it was removed.
  // Required fix ① (full-branch final review): in Vue2, the six power actions plus toggleAutoStart,
  // deleteVM, and handleInstallationFinished all pop a success toast (this.$buefy.toast.open({type:
  // 'is-success'})); New-UI previously had none of these — an undeclared deviation, now fixed in
  // KvmPage.vue's onAction/onEjectFinish. The keys below are the "past-tense verb" suffixes used in
  // the toast text, following the exact same pattern as Vue2's `${vm.name} ${$t('started')}`, with
  // values taken from the corresponding generic keys in zh_CN.json (see the comment on each line).
  // zh_CN.json "started" = "已启动" (:872).
  kvmToastStarted: '已启动',
  // zh_CN.json "stopped" = "已停止" (:873).
  kvmToastStopped: '已停止',
  // zh_CN.json "restarted" = "已重启" (:866).
  kvmToastRestarted: '已重启',
  // zh_CN.json "paused" = "已暂停" (:228).
  kvmToastPaused: '已暂停',
  // zh_CN.json "resumed" = "已恢复" (:870). In Vue2, the resume and wakeup actions use **the same**
  // word on success ("resumed") — wakeupVM (:1603) is also `${vm.name} ${$t('resumed')}`, not a
  // separate string like "已唤醒" [woken up]. Verified against the Vue2 source; this is not a typo
  // being copied over.
  kvmToastResumed: '已恢复',
  // zh_CN.json "deleted" = "已删除" (:862).
  kvmToastDeleted: '已删除',
  // zh_CN.json "On" = "开" (:818), "Off" = "已关闭" (:817). Vue2's toggleAutoStart (:1523) is composed
  // as `${vm.name} ${$t('Auto Start')} ${$t('On'|'Off')}`, combined with the existing kvmAutoStart
  // ("自动启动") above — no need for a separate whole-sentence "auto-start on/off" key.
  kvmAutoStartOn: '开',
  kvmAutoStartOff: '已关闭',
  // Required fix ①: eject success also needs a toast (Vue2 handleInstallationFinished :867-870).
  // This key had previously been judged a dead key and removed during an earlier review (New-UI at
  // the time used only the banner disappearing as the success feedback, with no toast) — now the
  // full-branch final review requires the toast to be added back, so the key needs to be restored.
  // Value taken from Vue2 zh_CN.json's "Installation media ejected. VM will boot from hard disk on
  // next restart." = "光盘已弹出，虚拟机将在下次重启时从硬盘引导。" (:1815), word-for-word identical
  // to the value that was removed back then.
  kvmEjectSuccess: '光盘已弹出，虚拟机将在下次重启时从硬盘引导。',
  // 🆕 SP16: notice shown when the console fails to auto-recover after a restart for a long time
  // (MessageBus drops the connection ⇒ kvm:vm_started never arrives). Vue2 has no equivalent copy —
  // over there it reconnects immediately (which is bound to fail) and pins vncError on screen; this
  // repo switches to an event handoff instead, which needs a fallback explanation sentence.
  kvmConsoleReconnectStalled: '控制台未能自动恢复，请重新选择该虚拟机',
  // 🆕 Added per review: the "verb, progressive tense" phrases missing from the progress-overlay
  // body text (Vue2 zh_CN.json :874/867/863, corresponding to "stopping"/"restarting"/"deleting").
  // These are not the same group of keys as kvmStopping etc. above — those are progressTitle (a
  // whole sentence), while these are the verb fragments spliced into progressMessage
  // (`${vm.name} ${$t('stopping')}...`).
  kvmStoppingShort: '停止中',
  kvmRestartingShort: '重启中',
  kvmDeletingShort: '删除中',
  // This button has no title in Vue2; an aria-label is added here for a11y.
  // zh_CN.json "Toggle sidebar" = "切换侧边栏" (review flagged that a previous version incorrectly
  // judged this to have "no matching key" and made up its own "折叠/展开侧边栏" [collapse/expand
  // sidebar] — violating the hard rule that Chinese text must follow zh_CN.json and never be
  // self-translated; this has been corrected).
  kvmToggleSidebar: '切换侧边栏',

  // ── KVM create dialog / snapshots / global settings / OSSelector ──
  // All Chinese text taken verbatim from Vue2 src/assets/lang/zh_CN.json (same convention as P5), not self-translated.
  // Reuses existing P5 keys (not redeclared here): kvmSettings / kvmAutoStart / kvmDeletingShort /
  // kvmFailedToSaveSettings / kvmClose / kvmAreYouSure / kvmDelete。
  // Create dialog
  kvmCreateTitle: '创建新虚拟机',
  kvmVmName: '虚拟机名称',
  kvmVmNamePlaceholder: '例如 debian-13',
  kvmIsoImage: 'ISO 镜像',
  kvmSelectIsoPlaceholder: '选择 ISO 镜像',
  kvmDiskSize: '磁盘大小',
  kvmMax: '最大',
  kvmCpuCores: 'CPU 核心',
  kvmMemory: '内存',
  kvmNetwork: '网络',
  kvmBridgeTo: '桥接到',
  kvmFirmware: '固件',
  kvmOsVersion: '系统版本',
  kvmGenericLinux: '通用 Linux',
  kvmGenericWindows: '通用 Windows',
  kvmCreate: '创建',
  // Creation validation & results
  kvmErrNoName: '请输入虚拟机名称',
  kvmErrNoOs: '请选择一个操作系统',
  kvmErrDiskMin: '磁盘大小必须至少为',
  kvmErrMemoryMin: '内存必须至少为',
  kvmErrDiskMax: '磁盘大小超出可用空间',
  kvmErrMemoryMax: '内存超出可用空间',
  kvmErrVcpuMax: 'vCPU 超出可用核心',
  kvmToastVmCreated: '虚拟机创建成功',
  kvmFailedToCreate: '创建虚拟机失败',
  // VM settings
  kvmVmSettingsTitle: '虚拟机设置',
  kvmTabGeneral: '通用',
  kvmTabSnapshots: '快照',
  kvmUsed: '已使用',
  kvmNoIsoMounted: '未挂载 ISO',
  kvmSave: '保存',
  kvmToastSettingsSaved: '设置已保存',
  kvmStopToModifySettings: '停止虚拟机以修改设置',
  // Snapshots
  kvmCreateSnapshot: '创建快照',
  kvmName: '名称',
  kvmSnapshotNamePlaceholder: '输入快照名称',
  kvmDescription: '描述',
  kvmSnapshotDescPlaceholder: '输入描述（可选）',
  kvmNoSnapshots: '暂无快照',
  kvmCreatedAt: '创建于',
  kvmRestore: '恢复',
  kvmErrNoSnapshotName: '请输入快照名称',
  kvmToastSnapshotCreated: '快照创建成功',
  kvmFailedToCreateSnapshot: '创建快照失败',
  kvmRestoringSnapshot: '正在恢复快照',
  kvmRestoringShort: '恢复中',
  // ⚠️ Has the same Chinese text as the existing P5 kvmToastResumed ("已恢复") but a different
  // meaning (restoring a snapshot vs. resuming a running VM). Vue2 also treats these as two separate
  // keys, so they're kept separate here rather than reusing one for convenience.
  kvmRestoredShort: '已恢复',
  kvmFailedToRestoreSnapshot: '恢复快照失败',
  kvmDeletingSnapshot: '正在删除快照',
  kvmFailedToDeleteSnapshot: '删除快照失败',
  // Global settings
  kvmStoragePath: '存储路径',
  kvmDefaultVcpu: '默认 vCPU',
  kvmCoresUnit: '核心',
  kvmDefaultMemory: '默认内存',
  // OSSelector
  kvmSelectOsTitle: '选择操作系统',
  kvmCatAll: '全部',
  kvmCatWindows: 'Windows',
  kvmCatLinux: 'Linux',
  // kvmCatBsd is the only key in this group not found in zh_CN.json (a proper noun) — both locales use 'BSD'.
  kvmCatBsd: 'BSD',
  kvmCustom: '自定义',
  kvmFolderEmpty: '此目录为空',
  kvmSelect: '选择',
  kvmDownload: '下载',
  kvmToastDownloaded: '已下载',
  kvmDownloadFailed: '下载失败',
  kvmWaitForDownload: '请等待下载完成',
  // aria-label keys added by New-UI (the one place with self-authored Chinese text): in Vue2 these
  // buttons have only icons and no text at all; this pass adds aria-labels for a11y — they are not
  // copied from zh_CN.json.
  kvmEjectIso: '弹出 ISO',
  kvmMountIso: '挂载 ISO',
  kvmParentDir: '上一级',
  kvmToggleCustom: '展开/收起自定义',

  // ── Search ── (SearchDialog wired to the real backend; spec §7.5/§7.6/§7.8)
  // Ranking-reason labels (reasons.ts produces the key, the text is provided here). The demo-era
  // English labels with counts (Body match ×9 / Transcript match ×3) were never actually returned by
  // the backend — they were made up — so the new labels carry no numbers.
  searchReasonFilename: '文件名命中',
  searchReasonFilenameFuzzy: '文件名相关',
  searchReasonBody: '正文命中',
  searchReasonTranscript: '转写命中',
  searchReasonOcr: '图片文字命中',
  searchReasonCaption: '图片内容命中',
  searchReasonSemantic: '语义相关',
  // Source badges (replacing the demo's "98%" accuracy figure — the four sources' scores aren't
  // comparable to each other, and the percentage was made up). Chinese text for "Semantic" /
  // "Filenames" taken from Vue2 zh_CN.json; OCR is left untranslated as-is.
  searchBadgeSemantic: '语义',
  searchBadgeFilename: '文件名',
  searchBadgeOcr: 'OCR',
  // Degraded-search notice bar: which sources didn't participate this time. All three source strings taken verbatim from Vue2 zh_CN.json.
  searchSourceSemantic: '语义搜索不可用',
  searchSourceImages: '图片搜索不可用',
  searchSourceFilenames: '文件名搜索不可用',
  searchNoticePrefix: '本次未参与搜索：',
  // Three empty states (spec §7.8): "no matches" and "backend not ready" must be kept distinct.
  searchEmptyNoMatch: '没有匹配的文件',   // Vue2 zh_CN.json 逐字
  searchEmptyNoRoots: '没有可搜索的目录',
  searchEmptyNotReady: '搜索后端未就绪',
  // Error state (request failed). Title taken verbatim from Vue2 zh_CN.json.
  searchErrorTitle: '搜索失败',
  searchErrorHint: '搜索服务当前不可用,请稍后重试',
  searchRetry: '重试',

  // -- SP18 terminal area (Vue2 terminal.* copied verbatim; termLockedResume and
  //    termConfirm/termCancel are New-UI additions registered in spec §5) --
  appTerminal: '终端',
  termLoading: '正在连接终端…',
  termAdminOnly: '终端仅管理员可用',
  termUnavailable: '终端服务暂不可用',
  termRetry: '重试',
  termLockedTitle: '请输入密码以打开终端',
  termLockedResume: '会话仍在运行,解锁后将原样恢复。',
  termPwPlaceholder: '账户密码',
  termPwWrong: '密码错误',
  termUnlock: '解锁',
  termFrozen: '尝试次数过多,请 {s} 秒后再试。',
  termIdleWarn: '终端即将锁定 — 按任意键保持连接',
  termSecTitle: '终端锁定策略',
  termModeOff: '从不锁定',
  termModeOnOpen: '打开时询问一次',
  termModeIdle: '询问 + 空闲后自动锁定',
  termIdleMinutes: '空闲超时(分钟)',
  termSave: '保存',
  termSaved: '已保存',
  termConfirmPwHint: '输入账号密码以更改终端锁定策略',
  termSaveFailed: '保存失败',
  termNewWin: '新建窗口',
  termCloseWin: '关闭窗口',
  termConfirm: '确认',
  termCancel: '取消',
  termCopied: '已复制：{text}',
}
