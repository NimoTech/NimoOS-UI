// SP9(收尾视图:系统设置 / KVM / Search)文案分片。
// 与 sp7/sp8 并行开发,分片可让三线几乎不在 i18n 上相撞(spec §4.2 / §9.3)。
// 约定:扁平 key、值必须是字符串(parity.test.ts 断言 typeof v === 'string')。
export default {
  settingsTitle: '设置',
  settingsTabGeneral: '通用',
  settingsTabStorage: '存储',
  settingsTabNetwork: '网络',
  settingsTabApps: '应用',
  settingsTabTerminal: '终端与日志',
  settingsTabSystemStatus: '系统状态',
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
  settingsWallpaperNa: '新版界面暂未提供壁纸功能',
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
  settingsNewsFeedConfirm: 'NimoOS 仪表板将会通过 https://blog.nimoos.io 获取最新的新闻，这可能会将您的访问记录留到网站。您接受吗？',
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
  // ── P1 电源流 ──
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
  // ── P2 network ──(中文取自 Vue2 zh_CN.json 原译;标 🆕补译 的 9 条是 Vue2 全部 31 个
  // 语言文件都缺、中文界面下显示英文原文、用户 2026-07-31 拍板补译的 → 授权偏离 #8)
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
  // ── P3 迁移弹窗 ────────────────────────────────────────────────────────
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
  // ── P3 terminal tab ────────────────────────────────────────────────────
  settingsTermTerminal: '终端',
  settingsTermLogs: '日志',
  settingsTermDownloadLogs: '下载日志',
  settingsTermLoadingLogs: '正在拉取系统日志...', // Vue2 LogsCard.vue:11 内联文案
  settingsTermUnavailable: '终端服务暂不可用',
  settingsTermUnavailableHint: '系统终端的后端接口（/v1/sys/wsssh）已被停用，终端与终端安全策略暂不可用。', // 🆕(本期空态说明)
  settingsTermFullscreen: '全屏',
  settingsTermExitFullscreen: '退出全屏',        // 🆕(Vue2 全屏按钮只有图标,无文字)
  // ── P3 storage tab(入口卡,授权偏离 #3)────────────────────────────────
  settingsStoreEntryTitle: '打开存储区',          // 🆕(本期新增入口卡,授权偏离 #3)
  settingsStoreEntrySub: '磁盘、存储空间、RAID 与快照都在存储区管理。',                 // 🆕(本期新增)
  settingsStoreTotal: '总存储',
  settingsStoreAvailable: '可用',
  settingsStoreSystem: '系统',
  settingsStoreFiles: '文件',
  settingsStoreNoStorage: '未找到存储',                                             // 🆕补译

  // ── SP9-P4 folder-permissions(四分区) ─────────────────────────────────
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

  // ── SP9-P4 account ────────────────────────────────────────────────────
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

  // ── P5 KVM ── 中文以 Vue2 src/assets/lang/zh_CN.json 为准(逐条核对,与 task-2-brief 草稿
  // 有出入处已按 zh_CN.json 改正,详见 task-2-report.md「i18n 核对」表)。
  kvmTitle: 'NIMO 虚拟机',
  kvmRunningSuffix: '运行中',
  kvmNoVms: '暂无虚拟机',
  kvmAddVm: '添加虚拟机',
  // zh_CN.json "Select a Virtual Machine" = "选择虚拟机"(非 brief 草稿的"选择一台虚拟机")。
  kvmSelectVmTitle: '选择虚拟机',
  // zh_CN.json "Choose a VM from the list to view its console and manage it"
  // = "从列表中选择虚拟机查看控制台并进行管理"(brief 草稿多了"一台"/"以")。
  kvmSelectVmHint: '从列表中选择虚拟机查看控制台并进行管理',
  kvmStateRunning: '运行中',
  kvmStateStopped: '已停止',
  kvmStatePaused: '已暂停',
  kvmStateSuspended: '已挂起',
  kvmStateError: '错误',
  // zh_CN.json 第 90 行 $t(canEditSettings ? 'Settings' : ...) 用的就是全局 "Settings" 键
  // = "系统设置"(与全局设置弹窗共用同一 i18n 键,Vue2 原文如此,照抄,不自行改得更贴切)。
  kvmSettings: '系统设置',
  // zh_CN.json "Stop VM to modify settings" = "停止虚拟机以修改设置"(非 brief 草稿的
  // "停止虚拟机后才能修改设置")。
  // P6 预埋键——本期(P5)VM 设置弹窗还没做,Settings 按钮恒 disabled,这个提示文案
  // 目前没有消费方,是特意为 P6 提前占好位的,不是遗漏/死代码(评审扫描已确认无引用,
  // 加这行注释免得每轮复审都要再核实一遍)。
  kvmSettingsDisabledHint: '停止虚拟机以修改设置',
  // zh_CN.json "More" = "浏览更多"(此键在 Vue2 里被复用给"更多操作"三点菜单的 tooltip,
  // 译文与场景不算贴切但是 Vue2 实际展示的文案,照抄)。
  kvmMore: '浏览更多',
  // zh_CN.json "Coming soon" = "即将上线"(非 brief 草稿的"即将支持")。
  kvmComingSoon: '即将上线',
  kvmPowerOn: '开机',
  kvmForceShutDown: '强制关机',
  kvmForceRestart: '强制重启',
  kvmPause: '暂停',
  // zh_CN.json "Resume" = "恢复"(非 brief 草稿的"继续")。
  kvmResume: '恢复',
  kvmWakeUp: '唤醒',
  // zh_CN.json "Auto Start" = "自动启动"(非 brief 草稿的"开机自启")。
  kvmAutoStart: '自动启动',
  kvmDelete: '删除',
  // zh_CN.json "Are you sure?" = "你确定吗？"(非 brief 草稿的"确定吗?";注意全角问号)。
  kvmAreYouSure: '你确定吗？',
  // zh_CN.json "Stopping VM" = "正在停止虚拟机"(非 brief 草稿的"正在停止")。
  kvmStopping: '正在停止虚拟机',
  // zh_CN.json "Restarting VM" = "正在重启虚拟机"(非 brief 草稿的"正在重启")。
  kvmRestarting: '正在重启虚拟机',
  // zh_CN.json "Deleting VM" = "正在删除虚拟机"(非 brief 草稿的"正在删除")。
  kvmDeleting: '正在删除虚拟机',
  // zh_CN.json "VNC port not available, try restarting" = "VNC 端口不可用，请尝试重启"
  // (brief 草稿在末尾多加了"虚拟机" 三个字,原文没有)。
  kvmVncPortUnavailable: 'VNC 端口不可用，请尝试重启',
  kvmVncFetchFailed: '获取 VNC 信息失败',
  // zh_CN.json "Installing from ISO. Click when finished:" = "正在从光盘安装。完成后请点击："
  // (原文是"光盘"不是"ISO",且没有"安装"两个字重复)。
  kvmInstallingFromIso: '正在从光盘安装。完成后请点击：',
  // zh_CN.json "I Finished Installing" = "我已完成安装"(非 brief 草稿的"我已安装完成")。
  kvmFinishedInstalling: '我已完成安装',
  // kvmEjectSuccess(eject 成功 toast 文案)定义在下面 kvmToastXxx 那一批附近——之前
  // Task 8 评审判定这是死键删掉过,全分支终审要求补 toast 后又加回来了,详见那里的注释。
  // 🆕补译:Vue2 里这条走 getErrMsg(err, 'Failed to eject installation media') 再过 $t()，
  // zh_CN.json 没有这个键 → Vue2 中文界面下实际显示英文原文(遗留缺译,同 P1/P2 见过的模式)。
  // New-UI 补上中文,不照抄这个缺译。
  kvmEjectFailed: '弹出安装介质失败',
  kvmSpiceHint: '为获得更好体验，请使用 virt-viewer 客户端连接：',
  // zh_CN.json "Install virtio-win drivers..." = "在虚拟机中安装 virtio-win 驱动以启用剪贴板、
  // 音频和 USB 功能"(非 brief 草稿的"内"/"与")。
  kvmSpiceAgentWin: '在虚拟机中安装 virtio-win 驱动以启用剪贴板、音频和 USB 功能',
  // zh_CN.json "Install spice-vdagent..." = "在虚拟机中安装 spice-vdagent 以启用剪贴板、音频
  // 和 USB 功能"(同上,"内"/"与"改"中"/"和")。
  kvmSpiceAgentLinux: '在虚拟机中安装 spice-vdagent 以启用剪贴板、音频和 USB 功能',
  // zh_CN.json "Toggle Ctrl/Alt/Shift" = "切换 Ctrl/Alt/Shift"(非 brief 草稿的"按住 …")。
  kvmToggleCtrl: '切换 Ctrl',
  kvmToggleAlt: '切换 Alt',
  kvmToggleShift: '切换 Shift',
  // zh_CN.json "Toggle Windows" = "切换 Windows"(非 brief 草稿的"按住 Windows 键")。
  kvmToggleWin: '切换 Windows',
  // zh_CN.json "Press Tab/Esc/Ctrl+Alt+Del" = "按下 …"(非 brief 草稿的"按 …",少了"下"字)。
  kvmPressTab: '按下 Tab',
  kvmPressEsc: '按下 Esc',
  kvmPressCtrlAltDel: '按下 Ctrl+Alt+Del',
  kvmFullscreen: '全屏',
  // 🆕新增:Vue2 全屏按钮的 title 恒为 $t('Fullscreen')(即使已全屏也不切换文案,是遗留
  // 的文案 bug),alt 属性硬编码英文 "Exit Fullscreen" 且从不走 i18n。按移植纪律(界面 1:1、
  // 逻辑 bug 不照抄)New-UI 让 aria-label 正确随全屏状态切换,故补一个 zh_CN.json 没有的键。
  kvmExitFullscreen: '退出全屏',
  kvmClose: '关闭',
  // ⚠️ 全分支终审删(清理项3):原有 kvmFailedStart/Stop/Restart/Pause/Resume/Delete/
  // Autostart 这 7 个键与下面 kvmFailedToXxx 家族逐字同值(kvmFailedAutostart 甚至连
  // 名字都和它对应的 kvmFailedToSaveSettings 不一样,是当场就该发现的错配),而
  // useVmList.ts 的 errText() fallback 实际只引用 kvmFailedToXxx 这一套——kvmFailedXxx
  // 一直是死键,编译和测试都不会报,只能靠人工比对发现。二选一,留使用中的那套,删掉
  // 这 7 个从未被消费过的键。
  // 🆕Task 5 评审补:useVmList.ts 里 errText() 的 8 个 fallback 字符串用的是
  // "kvmFailedToXxx" 这套键名。值取 Vue2 zh_CN.json 对应的 "Failed to xxx" 系列译文。
  kvmFailedToStart: '启动虚拟机失败',
  kvmFailedToStop: '停止虚拟机失败',
  kvmFailedToRestart: '重启失败',
  kvmFailedToPause: '暂停失败',
  kvmFailedToResume: '恢复失败',
  kvmFailedToSaveSettings: '保存设置失败',
  kvmFailedToDelete: '删除虚拟机失败',
  // ⚠️ Task 8 评审删:kvmFailedToEjectMedia(原值"弹出安装介质失败",与上面的
  // kvmEjectFailed 译文完全相同)是重复键——useVmList.ejectInstallMedia 的 fallback
  // 已经改成直接消费 kvmEjectFailed(见该文件 :325 附近注释),这个键因此变成死键,删除。
  // 必修①(全分支终审):Vue2 六个电源动作 + toggleAutoStart + deleteVM +
  // handleInstallationFinished 成功时都会弹一条 toast(this.$buefy.toast.open({type:
  // 'is-success'})),New-UI 之前一条都没有——未申报的偏离,已在 KvmPage.vue 的 onAction/
  // onEjectFinish 里补上。下面这批键是 toast 文案用的"动词过去时"后缀,拼法逐字对 Vue2
  // `${vm.name} ${$t('started')}` 这种模式,值取自 zh_CN.json 对应的通用键(见各行注释)。
  // zh_CN.json "started" = "已启动"(:872)。
  kvmToastStarted: '已启动',
  // zh_CN.json "stopped" = "已停止"(:873)。
  kvmToastStopped: '已停止',
  // zh_CN.json "restarted" = "已重启"(:866)。
  kvmToastRestarted: '已重启',
  // zh_CN.json "paused" = "已暂停"(:228)。
  kvmToastPaused: '已暂停',
  // zh_CN.json "resumed" = "已恢复"(:870)。resume 和 wakeup 两个动作在 Vue2 里
  // 成功时用的是**同一个**词("resumed"),wakeupVM(:1603)也是 `${vm.name} ${$t('resumed')}`,
  // 不是单独的"已唤醒"之类的文案——已核对 Vue2 源码确认,不是笔误照抄。
  kvmToastResumed: '已恢复',
  // zh_CN.json "deleted" = "已删除"(:862)。
  kvmToastDeleted: '已删除',
  // zh_CN.json "On" = "开"(:818)、"Off" = "已关闭"(:817)。Vue2 toggleAutoStart(:1523)
  // 拼法是 `${vm.name} ${$t('Auto Start')} ${$t('On'|'Off')}`,与上面已有的 kvmAutoStart
  // ("自动启动")拼在一起用,不需要再拼一个"自动启动开/关"的整句键。
  kvmAutoStartOn: '开',
  kvmAutoStartOff: '已关闭',
  // 必修①:eject 成功也要弹 toast(Vue2 handleInstallationFinished :867-870)。
  // 这个键此前在 Task 8 评审时被判定为死键删掉过(New-UI 当时只用"横幅消失"当成功反馈,
  // 不弹 toast)——现在全分支终审要求补上 toast,键需要加回来。值取 Vue2 zh_CN.json
  // "Installation media ejected. VM will boot from hard disk on next restart." = "光盘
  // 已弹出，虚拟机将在下次重启时从硬盘引导。"(:1815),与当年被删的值逐字相同。
  kvmEjectSuccess: '光盘已弹出，虚拟机将在下次重启时从硬盘引导。',
  // 🆕Task 5 评审补:进度遮罩正文缺的"动词进行时"短语(Vue2 zh_CN.json:874/867/863,
  // 分别对应 "stopping"/"restarting"/"deleting")。与上面 kvmStopping 等整句标题不是
  // 同一组键——那几个是 progressTitle(整句),这几个是 progressMessage 里拼接的动词
  // 片段(`${vm.name} ${$t('stopping')}...`)。
  kvmStoppingShort: '停止中',
  kvmRestartingShort: '重启中',
  kvmDeletingShort: '删除中',
  // Vue2 该按钮没有 title,这里为 a11y 补 aria-label。
  // zh_CN.json "Toggle sidebar" = "切换侧边栏"(评审指出:上一版此处误判"无对应键"
  // 并自拟了"折叠/展开侧边栏",违反"中文以 zh_CN.json 为准、不许自译"的硬约束,已订正)。
  kvmToggleSidebar: '切换侧边栏',

  // ── P6 KVM 创建弹窗 / 快照 / 全局设置 / OSSelector ──(SP9-P6 地基 Task 0)
  // 中文全部逐字取自 Vue2 src/assets/lang/zh_CN.json(与 P5 同惯例),不自行翻译。
  // 复用 P5 已有键(不在此重复声明):kvmSettings / kvmAutoStart / kvmDeletingShort /
  // kvmFailedToSaveSettings / kvmClose / kvmAreYouSure / kvmDelete。
  // 创建弹窗
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
  // 创建校验与结果
  kvmErrNoName: '请输入虚拟机名称',
  kvmErrNoOs: '请选择一个操作系统',
  kvmErrDiskMin: '磁盘大小必须至少为',
  kvmErrMemoryMin: '内存必须至少为',
  kvmErrDiskMax: '磁盘大小超出可用空间',
  kvmErrMemoryMax: '内存超出可用空间',
  kvmErrVcpuMax: 'vCPU 超出可用核心',
  kvmToastVmCreated: '虚拟机创建成功',
  kvmFailedToCreate: '创建虚拟机失败',
  // VM 设置
  kvmVmSettingsTitle: '虚拟机设置',
  kvmTabGeneral: '通用',
  kvmTabSnapshots: '快照',
  kvmUsed: '已使用',
  kvmNoIsoMounted: '未挂载 ISO',
  kvmSave: '保存',
  kvmToastSettingsSaved: '设置已保存',
  kvmStopToModifySettings: '停止虚拟机以修改设置',
  // 快照
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
  // ⚠️ 与 P5 已有的 kvmToastResumed(「已恢复」)中文同值但语义不同(恢复快照 vs 恢复
  // 运行中的虚拟机)。Vue2 也是两个独立的 key,分开建,不图省事复用。
  kvmRestoredShort: '已恢复',
  kvmFailedToRestoreSnapshot: '恢复快照失败',
  kvmDeletingSnapshot: '正在删除快照',
  kvmFailedToDeleteSnapshot: '删除快照失败',
  // 全局设置
  kvmStoragePath: '存储路径',
  kvmDefaultVcpu: '默认 vCPU',
  kvmCoresUnit: '核心',
  kvmDefaultMemory: '默认内存',
  // OSSelector
  kvmSelectOsTitle: '选择操作系统',
  kvmCatAll: '全部',
  kvmCatWindows: 'Windows',
  kvmCatLinux: 'Linux',
  // kvmCatBsd 是这批键里唯一在 zh_CN.json 查不到的(专有名词),两个 locale 都是 'BSD'。
  kvmCatBsd: 'BSD',
  kvmCustom: '自定义',
  kvmFolderEmpty: '此目录为空',
  kvmSelect: '选择',
  kvmDownload: '下载',
  kvmToastDownloaded: '已下载',
  kvmDownloadFailed: '下载失败',
  kvmWaitForDownload: '请等待下载完成',
  // New-UI 新增的 aria-label 键(唯一自拟中文的地方):Vue2 这几个按钮只有图标、没有任何
  // 文案,本期为 a11y 补 aria-label,不是从 zh_CN.json 抄来的。
  kvmEjectIso: '弹出 ISO',
  kvmMountIso: '挂载 ISO',
  kvmParentDir: '上一级',
  kvmToggleCustom: '展开/收起自定义',
}
