# P4 Task 4 review package — ae161ca..HEAD

## commits
2232857 feat(ai): SP8-P4 T4 MCP 分区 i18n 双档(76 新键,8 键复用)

## stat
 src/i18n/en_us.ts | 83 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 src/i18n/zh_cn.ts | 82 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 165 insertions(+)

## diff -U10
diff --git a/src/i18n/en_us.ts b/src/i18n/en_us.ts
index 697d4fb..1711e00 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1308,11 +1308,94 @@ export default {
   aiSkTestClosed: 'Sandbox closed. No files were modified.',
   aiSkTestFailed: 'Run failed',
   aiSkTestPlaceholderEx: 'Try: "{ex}"',
   aiSkTestPlaceholder: 'Run the skill on a sample folder',
   aiSkTestHttpFailed: 'Sandbox run failed (HTTP {status})',
   aiSkTryDisabledTitle: 'This skill is paused',
   aiSkTryDisabledBody:
     'A paused skill is not loaded, so trying it in chat will have no effect. Enable it first?',
   aiSkTryEnableAndTry: 'Enable and try',
   // <<< SP8-P3b Task 2
+  // >>> SP8-P4 Task 4 —— MCP section (McpSection/Group/Detail/Modal). §4.2 values
+  // are Vue2's key literal (production en_US.json string, or the key itself where
+  // en_US.json has no matching entry — 4 such cases per brief); §4.3 (14 keys) is
+  // this period's new copy (D5/D8), no Vue2 counterpart.
+  aiMcpSrvAdd: 'Add MCP server',
+  aiMcpSrvSearchPlaceholder: 'Search servers…',
+  aiMcpSrvGroupEnabled: 'Enabled servers',
+  aiMcpSrvGroupDisabled: 'Disabled servers',
+  aiMcpSrvNoMatch: 'No servers match',
+  aiMcpSrvEmpty: 'No MCP servers yet. Click the + to add one.',
+  aiMcpSrvLoadFailed: 'Could not load MCP servers',
+  aiMcpSrvEnabledToast: 'Server enabled',
+  aiMcpSrvDisabledToast: 'Server disabled',
+  aiMcpSrvUpdateFailed: 'Update failed',
+  aiMcpSrvRemovedName: 'Removed {name}',
+  aiMcpSrvAddedName: 'Added {name}',
+  aiMcpSrvPickHint: 'Pick an MCP server on the left',
+  aiMcpSrvPickSub: 'Or add one to give Nimo new tools over the Model Context Protocol.',
+  aiMcpSrvEditConfig: 'Edit configuration',
+  aiMcpSrvRemove: 'Remove server',
+  aiMcpSrvStatus: 'Status',
+  aiMcpSrvDisabled: 'Disabled',
+  aiMcpSrvTransport: 'Transport',
+  aiMcpSrvHeaders: 'Headers',
+  aiMcpSrvConfigured: 'Configured',
+  aiMcpSrvNone: 'None',
+  aiMcpSrvEnv: 'Env',
+  aiMcpSrvConfiguration: 'Configuration',
+  aiMcpSrvConfigHint: 'How Nimo connects to this server',
+  aiMcpSrvTest: 'Test connection',
+  aiMcpSrvTesting: 'Testing…',
+  aiMcpSrvCommand: 'Command',
+  aiMcpSrvArgs: 'Arguments',
+  aiMcpSrvEnvVars: 'Environment variables',
+  aiMcpSrvConfiguredHidden: 'Configured (hidden)',
+  aiMcpSrvUrl: 'Endpoint URL',
+  aiMcpSrvReqHeaders: 'Request headers',
+  aiMcpSrvTestStdioHint: 'This can take up to 90s for stdio (first run downloads the server).',
+  aiMcpSrvTestOk: 'Connected · {n} tools',
+  aiMcpSrvTestFailed: 'Connection failed',
+  aiMcpSrvToolsNote: 'Tools are declared by this server during handshake. The first call in a conversation will ask for your permission.',
+  aiMcpSrvRemoveTitle: 'Remove this MCP server?',
+  aiMcpSrvRemoveBody: 'Nimo will disconnect from {name}; its tools will no longer be available to the agent. You can add it again later.',
+  aiMcpSrvRemoveConfirm: 'Remove',
+  aiMcpSrvEditTitle: 'Edit MCP server',
+  aiMcpSrvQuickAdd: 'Quick add',
+  aiMcpSrvQuickAddHint: 'paste a command or URL',
+  aiMcpSrvParsing: 'Parsing…',
+  aiMcpSrvFillForm: 'Fill form',
+  aiMcpSrvName: 'Name',
+  aiMcpSrvNamePlaceholder: 'e.g. brave / notion / my-tools',
+  aiMcpSrvTransportType: 'Transport type',
+  aiMcpSrvTransportHttp: 'Remote · streamable HTTP',
+  aiMcpSrvTransportSse: 'Remote · server-sent events',
+  aiMcpSrvTransportStdio: 'Local · runs a command',
+  aiMcpSrvOptional: 'optional',
+  aiMcpSrvKvKey: 'Key',
+  aiMcpSrvKvValue: 'Value',
+  aiMcpSrvAddHeader: 'Add header',
+  aiMcpSrvKvHint: 'Leave blank to keep current; filling in replaces all.',
+  aiMcpSrvCommandPlaceholder: 'e.g. npx / uvx / python',
+  aiMcpSrvOnePerLine: 'One per line',
+  aiMcpSrvAddVariable: 'Add variable',
+  aiMcpSrvSavedLocally: 'Saved locally on this NAS',
+  aiMcpSrvAddServer: 'Add server',
+  aiMcpSrvParseFailed: "Couldn't parse that command",
+  // This period's new copy (no Vue2 counterpart, D5/D8 product, checked against the
+  // design doc, not the zh_CN.json codepoint script).
+  aiMcpSrvTestErrTimeout: 'Probe timed out',
+  aiMcpSrvTestErrConnect: 'Could not connect to this server',
+  aiMcpSrvTestErrListTimeout: 'Timed out listing tools',
+  aiMcpSrvTestErrListFailed: 'Connected, but could not list tools',
+  aiMcpSrvTestErrAgentDown: 'The AI agent service is not running, so the probe could not start',
+  aiMcpSrvTestDetail: 'Technical details',
+  aiMcpSrvErrUrlRequired: 'Endpoint URL is required for HTTP / SSE',
+  aiMcpSrvErrCommandRequired: 'Command is required for STDIO',
+  aiMcpSrvErrBadTransport: 'Transport must be HTTP, SSE or STDIO',
+  aiMcpSrvErrNotFound: 'This server no longer exists — refresh the list',
+  aiMcpSrvParseErrEmpty: 'Paste a command or URL first',
+  aiMcpSrvParseErrNoCommand: 'No runnable command found',
+  aiMcpSrvParseErrOnlyEnv: 'Only environment variables — a command is missing',
+  aiMcpSrvParseErrQuotes: 'Unbalanced quotes',
+  // <<< SP8-P4 Task 4
 }
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index d319e70..11fe095 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1319,11 +1319,93 @@ export default {
   aiSkTestPlaceholder: '在示例文件夹上运行该技能',
   // 新文案:沙箱运行失败的 HTTP 状态码提示(设计要求本地化文案 + 状态码,不回显后端 body)。
   aiSkTestHttpFailed: '沙箱运行失败(HTTP {status})',
   // 新文案(D4 拍板,收 P3a 挂账③):停用技能点「在对话中试用」先提示,而不是
   // X-Skill-Id 照发但 agent 找不到 SKILL.md 造成的零反馈(skills_runtime.go:57)。
   aiSkTryDisabledTitle: '该技能已停用',
   aiSkTryDisabledBody:
     '停用的技能不会被加载,现在去对话里试用不会有任何效果。要先启用它吗?',
   aiSkTryEnableAndTry: '启用并试用',
   // <<< SP8-P3b Task 2
+  // >>> SP8-P4 Task 4 —— MCP 分区(McpSection/Group/Detail/Modal)。
+  // §4.2(62 条,不是任务书正文写的「63」——已在报告里申报此计数偏差)中文值逐字取自
+  // Vue2 生产语言包 zh_CN.json(程序化比对见任务报告 Step 4);§4.3(14 条)是本期
+  // 新文案(D5/D8 产物),Vue2 无对应物,按设计文档核对。
+  aiMcpSrvAdd: '新增 MCP 服务',
+  aiMcpSrvSearchPlaceholder: '搜索服务…',
+  aiMcpSrvGroupEnabled: '已启用服务',
+  aiMcpSrvGroupDisabled: '已停用服务',
+  aiMcpSrvNoMatch: '没有匹配的服务',
+  aiMcpSrvEmpty: '还没有 MCP 服务,点击 + 添加一个。',
+  aiMcpSrvLoadFailed: '无法加载 MCP 服务',
+  aiMcpSrvEnabledToast: '服务已启用',
+  aiMcpSrvDisabledToast: '服务已停用',
+  aiMcpSrvUpdateFailed: '更新失败',
+  aiMcpSrvRemovedName: '已移除 {name}',
+  aiMcpSrvAddedName: '已添加 {name}',
+  aiMcpSrvPickHint: '在左侧选择一个 MCP 服务',
+  aiMcpSrvPickSub: '或新增一个,通过 Model Context Protocol 给 Nimo 接入新工具。',
+  aiMcpSrvEditConfig: '编辑配置',
+  aiMcpSrvRemove: '移除服务',
+  aiMcpSrvStatus: '状态',
+  aiMcpSrvDisabled: '未启用',
+  aiMcpSrvTransport: '传输',
+  aiMcpSrvHeaders: '请求头',
+  aiMcpSrvConfigured: '已配置',
+  aiMcpSrvNone: '无',
+  aiMcpSrvEnv: '环境变量',
+  aiMcpSrvConfiguration: '配置',
+  aiMcpSrvConfigHint: 'Nimo 如何连接该服务',
+  aiMcpSrvTest: '测试连接',
+  aiMcpSrvTesting: '测试中…',
+  aiMcpSrvCommand: '命令',
+  aiMcpSrvArgs: '参数',
+  aiMcpSrvEnvVars: '环境变量',
+  aiMcpSrvConfiguredHidden: '已配置(已隐藏)',
+  aiMcpSrvUrl: '端点 URL',
+  aiMcpSrvReqHeaders: '请求头',
+  aiMcpSrvTestStdioHint: 'stdio 首次可能需要约 90 秒(会现场下载 server)。',
+  aiMcpSrvTestOk: '已连接 · {n} 个工具',
+  aiMcpSrvTestFailed: '连接失败',
+  aiMcpSrvToolsNote: '工具由该服务在握手时声明。对话中首次调用会请求你的许可。',
+  aiMcpSrvRemoveTitle: '移除该 MCP 服务?',
+  aiMcpSrvRemoveBody: 'Nimo 将断开与 {name} 的连接,其工具不再对 Agent 可用。你可以稍后重新添加。',
+  aiMcpSrvRemoveConfirm: '移除',
+  aiMcpSrvEditTitle: '编辑 MCP 服务',
+  aiMcpSrvQuickAdd: '快速添加',
+  aiMcpSrvQuickAddHint: '粘贴一行命令或 URL',
+  aiMcpSrvParsing: '解析中…',
+  aiMcpSrvFillForm: '填充表单',
+  aiMcpSrvName: '名称',
+  aiMcpSrvNamePlaceholder: '例如:brave / notion / my-tools',
+  aiMcpSrvTransportType: '传输方式',
+  aiMcpSrvTransportHttp: '远程 · 可流式 HTTP',
+  aiMcpSrvTransportSse: '远程 · 服务器推送事件',
+  aiMcpSrvTransportStdio: '本地 · 运行一个命令',
+  aiMcpSrvOptional: '可选',
+  aiMcpSrvKvKey: '键',
+  aiMcpSrvKvValue: '值',
+  aiMcpSrvAddHeader: '添加请求头',
+  aiMcpSrvKvHint: '留空保持不变;填写则覆盖全部。',
+  aiMcpSrvCommandPlaceholder: '例如 npx / uvx / python',
+  aiMcpSrvOnePerLine: '每行一个',
+  aiMcpSrvAddVariable: '添加变量',
+  aiMcpSrvSavedLocally: '保存在这台 NAS 本地',
+  aiMcpSrvAddServer: '添加服务',
+  aiMcpSrvParseFailed: '无法解析该命令',
+  // 本期新文案(Vue2 无对应物,D5/D8 产物,按设计文档核对,不进 zh_CN.json 逐码点比对脚本)
+  aiMcpSrvTestErrTimeout: '探测超时',
+  aiMcpSrvTestErrConnect: '连不上这个服务器',
+  aiMcpSrvTestErrListTimeout: '读取工具列表超时',
+  aiMcpSrvTestErrListFailed: '连上了,但读不到工具列表',
+  aiMcpSrvTestErrAgentDown: 'AI 助手服务没在运行,无法发起探测',
+  aiMcpSrvTestDetail: '技术详情',
+  aiMcpSrvErrUrlRequired: 'HTTP / SSE 传输必须填端点 URL',
+  aiMcpSrvErrCommandRequired: 'STDIO 传输必须填命令',
+  aiMcpSrvErrBadTransport: '传输方式只能是 HTTP、SSE 或 STDIO',
+  aiMcpSrvErrNotFound: '这个服务已经不存在了,请刷新列表',
+  aiMcpSrvParseErrEmpty: '请先粘贴一行命令或 URL',
+  aiMcpSrvParseErrNoCommand: '没解析出可执行的命令',
+  aiMcpSrvParseErrOnlyEnv: '只有环境变量,后面缺一条命令',
+  aiMcpSrvParseErrQuotes: '引号没有配对',
+  // <<< SP8-P4 Task 4
 }
