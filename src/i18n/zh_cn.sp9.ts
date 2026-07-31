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
}
