# SP4-P7 P2P 互传 Drop — SDD 台账

- Plan: NimoOS-UI/docs/superpowers/plans/2026-07-18-vue3-migration-sp4-p7-drop.md
- Spec: NimoOS-UI/docs/superpowers/specs/2026-07-18-vue3-migration-sp4-p7-drop-design.md
- 仓库: NimoOS-New-UI master;起点 BASE = 540270c
- 开始: 2026-07-18

## 任务进度

(待开始)

## Minor findings 汇总(final review 输入)

(无)
- Task 1: complete (commits 540270c..b21ab45, review Approved)
  - Minor(defer, 计划自带): protocol.test 未测 PROGRESS_NOTIFY_STEP/isRtcSupported; isRtcSupported 不查 moz/webkit 前缀(现代浏览器死路径)
- Task 2: complete (commits b21ab45..14f9eac, review Approved)
  - Minor(defer): digester mime 兜底每次 unchunk 重算(行为等价); bytesReceived 不带 Vue2 的 ||chunk.size Blob 兜底(T4 channel binaryType=arraybuffer,双端恒 ArrayBuffer,已裁定 inert)
  - ⚠️ 已裁定: Task4 只会传 ArrayBuffer(binaryType='arraybuffer' 与 Vue2 同),Blob 兜底删除无影响
- Task 3: complete (commits 14f9eac..3c47d92 含竞态修复, review Approved + 复审 Approved)
  - 评审抓出并已修: connect() await refresh 窗口重入(同步 connecting 守卫 + 回归测试, 3c47d92)
  - 实现者必要偏离(评审证实正确): handleDisconnect 清 socket(brief 参考代码对自身 fake 测试跑不过)
  - Minor(defer): task-3-report 测试计数笔误(8→实为7),无代码影响
- Task 4: complete (commits 3c47d92..51eee32, review Approved)
  - Minor(defer, brief 自带测试缺口): 多分区续传路径(>1MB + partition-received 往返)无断言; 进度 <1% 抑制负例无断言 —— 终审可裁定是否补
  - 非 wire 偏离(评审确认无害): setRemoteDescription/addIceCandidate 传 plain dict(现代 API 兼容); 不移植 Vue2 vestigial _reader=null / oniceconnectionstatechange 日志
- Task 5: complete (commits 51eee32..d679d2e, review Approved)
  - 修掉 Vue2 潜伏 bug: Vue2 peer-left 调不存在的 peer._peer.close()(死代码,连接从未真关);端口改 peer.close() 真关(符合 brief 意图,评审确认)
  - Minor(defer): sendFiles 计数先于文件的时序无结构性断言(两独立 mock)
- Task 6: complete (commits d679d2e..9151758 含修复, review Needs fixes → 已修 → 核对通过)
  - 评审抓出并已修: 实现者越权加全局 assetsInlineLimit:0(全仓构建行为变更)→ 撤销,改 ?url&no-inline 限定 drop 图标 glob(评审实验预验证过该修法; 9151758)
  - 资产 8 SVG sha256 与 Vue2 逐字节一致; i18n 17 键双语 parity 过
- Task 7: complete (commits 9151758..fef33cb 含修复, review Approved + 修复)
  - 评审 Medium 已修: 重连 peers 全量替换瞬时抹掉 self 显示名 → selfName ref 缓存兜底(fef33cb, +回归测试)
  - 评审 Low 已修: destroy 补清 selfId/selfName
  - Minor(defer): pmHandle 转发断言只测一次调用不分消息类型(brief 自带); revokeObjectURL 同步时序属标准模式仅真机可证
- Task 8: complete (commits fef33cb..78a9d71, review Approved)
  - Minor(defer): positionFor 测试未 pin 'px' 后缀(parseFloat 宽容); contentsBox else 分支零覆盖; 三角公式期望值同构自实现非独立 oracle(brief 自带)
- Task 9: complete (commits 78a9d71..5d4bdfd, review Approved)
  - Minor(defer): DropItem/ReceivePrompt scoped 局部 @keyframes pop/itemIn 与 theme.css 全局同名但动画曲线不同(评审实验证实 scoped 重命名无冲突,但属重复+全 app 动效不一致;可删局部块直接用全局)——终审裁定
- Task 10: complete (commits 5d4bdfd..c75d89b 含修复, review Needs fixes → 已修 → 核对通过)
  - 评审 Medium 已修: DropPage 侧栏未接 @navigate(点盘符死)→ 复制 SharesPage goVirtual 接线 + 回归测试(c75d89b)
  - Minor(defer): DropAddButton 弹窗无点外关闭(brief 未要求,真机验收看手感)
- Task 11: complete (commits c75d89b..4771ecf, review Approved)
  - Minor(defer): FilesSidebar.test i18n fixture 缺 filesDropNav(静默 fallback); router.test 无 /files/drop 不被 catch-all 遮蔽的用例

## 终审修复

- Finding 1(Medium, spec §5): 硬关标签/刷新无 pagehide/beforeunload 断连
  - 改动: `src/files/drop/serverConnection.ts` 新增 `suspend()`——发 `{type:'disconnect'}`、清重连计时器、摘 `socket.onclose`、关闭并置空 socket,**不置 `destroyed`**(与 `destroy()` 的唯一差别),避免 bfcache 恢复后页面连不回来。`src/files/drop/stores/drop.ts` `init()` 内新增 store-file-scope 函数 `onPageHide()`(镜像既有 `onVisibility` 写法)并 `window.addEventListener('pagehide', onPageHide)`;`destroy()` 内对称 `removeEventListener`。
  - 覆盖测试: `serverConnection.test.ts` 新增「suspend() 发 disconnect 并关闭,但不设 destroyed:不排重连,之后手动 connect() 仍可用」——open 后 suspend(),断言 disconnect 已发送、socket 已关、advance 10s 无新实例(不自动重连)、随后手动 `connect()` 仍能新建 socket。`stores/drop.test.ts` 新增「pagehide 触发非永久断开:调 server.suspend 而非 destroy」——mock 类扩展 `suspend = h.suspend`,init 后 `window.dispatchEvent(new Event('pagehide'))`,断言 `h.suspend` 恰调一次且 `h.destroy` 未调用。顺带修了一个跨用例监听器累积的测试卫生问题:加了全局 `afterEach(() => useDropStore().destroy())` 摘除 window 监听,否则后续用例的 `pagehide` dispatch 会打到历史用例的残留监听器上(首次跑出 7 次调用而非 1 次,已定位并修复)。
  - 命令: `pnpm test`
  - 输出: `Test Files  165 passed (165)` / `Tests  777 passed (777)`

- Finding 2(Minor, spec §7): store `connected`导出但无人消费,重连窗口内气泡本应禁互动
  - 改动: `src/files/drop/components/DropItem.vue` 新增可选 prop `suspended?: boolean`,并入 `disabled` 计算(`props.isSelf || !!props.device.offline || !!props.suspended`)——既有 `v-if="!disabled"` 分流自动让挂起中的对端失去菜单/选择器/拖放。`src/files/drop/components/DropPage.vue` 给每个 `DropItem` 传 `:suspended="!drop.connected"`。
  - 覆盖测试: `DropItem.test.ts` 新增「suspended 时(重连窗口内)在线设备也禁互动」——`suspended: true` 挂载后断言 file input 与 `.drop-bubble` 均带 `disabled` 属性。`DropPage.test.ts` 现有用例未断言气泡可交互性(只查 peers 计数/文案/侧栏跳转),`drop.connected` 默认 false 不影响既有断言,故未改动该测试文件。
  - 命令: `pnpm test`
  - 输出: `Test Files  165 passed (165)` / `Tests  777 passed (777)`

- Gate 收尾: `pnpm test`(165 files / 777 tests all passed)+ `pnpm exec vue-tsc --noEmit`(无输出,类型检查通过)+ `pnpm build`(`✓ built in 8.59s`,仅既有的第三方 chunk-size/eval 警告,无新增错误)—— 三项全绿。

## 终审(opus)结论 = Ready to merge(2026-07-18)
- wire 对拍 PASS(收发全链逐字兼容 Vue2);单一刷新路径 CONFIRMED;泄漏/隐私/主题/i18n 全 PASS
- 终审 2 项 spec 缺口已修(07a340d,777/777+tsc0+build):§5 pagehide 非永久 suspend()断开(bfcache 安全,visibilitychange 复活);§7 重连窗口 suspended 禁用气泡交互
- 台账全部 defer Minor 经终审逐条裁定 Stay deferred(见上,无 pre-merge 必修项)
- 已知对等差异(终审记录,cosmetic): 多文件接收 tooltip 计数不随完成递减(Vue2 递减);wire 无差异
- 最终区间: 540270c..07a340d(16 commits)

## 真机验收修复轮(2026-07-18)
- 🐛 修复1(cd29257): 气泡全不可见——.files-layout align-items:flex-start 下 drop-main 全子元素绝对定位不撑高 → 容器塌缩标题高 → contentsBox 负几何 → 气泡全裁。修: .files-layout height:100% + .drop-main align-self:stretch(SharesPage 无此问题因内容在流内)。教训: 凡"绝对定位内容+量容器尺寸"的页面,容器高度链必须显式给足,jsdom 测不出,归真机眼验类。
- 🐛 修复2(同 commit): DropPage 漏 SharesPage 的 files.loadRoots() → 侧栏 DISKS 恒空。补齐。
- 777/777 + tsc0,已重部署 /app/。
- 🎨 图标替换(b8331fb,用户要求): 8 个 Vue2 拷来的第三方 SVG 全部换成原创绘制(线性/在线蓝 #5b7cfa/离线灰 #9aa1ad/self 渐变蓝圆白人形/drop_icon 雷达波纹),并补齐 Vue2 缺失的 mobile_offline(兜底仅剩未知 model);dropIcons 测试相应更新。777/777+tsc0,已部署。

## ✅ P7 关账(2026-07-18 用户验收通过)
- 最终坐标: New-UI master@b8331fb(540270c..b8331fb 18 commits);docs 分支 roadmap 已勾验收
- 验收轮 3 修: 布局塌陷(cd29257)/ 侧栏 loadRoots(同)/ 图标换原创(b8331fb)
