// SP8-P2b Task 11 —— 1:1 取自 Vue2 src/views/AI/Settings/sections/ChannelsSection.vue
// 的 bindingLabel(:304-307)与 pairInstructions computed(:185-190),以及模板里
// channelsBotTokenTail 的 split/join 填充(:29,`$t('channelsBotTokenTail').split('{tail}').join(inst.token_tail)`)。
//
// 抽成纯函数与 Task 9(mcpConnect.ts)同理:Vue2 既有测试直调 methods/computed 借 this,
// <script setup> 没有 methods 对象可借。**但与 Task 9 不同的是**:NimoOS-UI 的
// ChannelsSection.spec.js(读至 2026-07-28)对 bindingLabel/pairInstructions 没有任何
// 直接断言 —— genCode 测试的注释显式承认「{bot}/{code} substitution is not asserted
// here」。因此本文件的 7 个测试例并非承接自 spec.js 的既有断言,而是 brief 直接依据
// Vue2 源码行为新写的(见 Task 11 report 的「承接断言」一节,如实申报为 0/7)。
//
// 三个函数都不碰 i18n —— 文案模板由调用方 t() 出来再传进来,这样纯函数可脱离
// vue-i18n 测试。Task 12(消费方)决定采用**方案二:自行 split/join + 转义大括号**
// (与 Task 9 的 buildMcpInstruction / Task 10 的 aiCfgMcpInstructionTemplate 同一机制,
// 而非方案一 vue-i18n 命名插值 t(key, {bot, code})):
//   - i18n 值里的 `{bot}`/`{code}`/`{tail}` 必须转义成 `{'{'}bot{'}'}` 等,否则
//     vue-i18n v9 在 t(key) 不传 params 时会把裸 `{bot}` 当命名插值解析、找不到值就吃掉
//     变成空串(Task 10 教训,已在 mcpConnect.ts/McpTokensSection.vue 验证过)。
//   - `channelsPairInstructions` 的字面 `@` 同样要转义成 `{'@'}`(vue-i18n 链接语法),
//     所以完整转义后是 `{'@'}{'{'}bot{'}'}`。
//   - 转义之后 t() 解析出来的字符串,才是这里 fillPairInstructions/fillTokenTail 的
//     template 参数——它必须**逐字包含** `{bot}`/`{code}`/`{tail}` 这几个裸子串,
//     再交给本文件的 split/join 做「组件自己的」二次替换。
// 这一决定的落地(转义 i18n 值)不在本任务范围内——Task 12 消费者负责加键并转义,
// 这里只声明并对齐机制,避免 Task 12 走回 vue-i18n 命名插值那条会被吃空的路。
export interface ChannelBinding {
  id: string | number
  external_username?: string
  external_user_id?: string
  instance_name?: string
  channel_type?: string
  default_model?: string | null
  download_dir?: string
}

/** 对齐 Vue2 ChannelsSection.vue:304 bindingLabel。 */
export function bindingLabel(b: ChannelBinding, noLabelText: string): string {
  if (b.external_username) return `@${b.external_username}`
  return b.external_user_id || noLabelText
}

/** 对齐 Vue2 ChannelsSection.vue:185 pairInstructions computed。 */
export function fillPairInstructions(template: string, bot: string, code: string): string {
  return template.split('{bot}').join(bot).split('{code}').join(code)
}

/** 对齐 Vue2 ChannelsSection.vue:29 模板里 channelsBotTokenTail 的 split/join。 */
export function fillTokenTail(template: string, tail: string): string {
  return template.split('{tail}').join(tail)
}

/**
 * 【SP8-P2b 验收第 3 轮,用户 2026-07-30 拍板】添加机器人失败 → 本地化文案的 i18n **键**。
 *
 * 起因:界面上直接出现了后端原文 `{"detail":"bot token rejected"}`。用户要求换成人看得懂的
 * 话、不许回显 JSON、并且要多语言。
 *
 * 做法与本档其余函数同一分工:**纯函数不碰 vue-i18n**,只把后端错误归一成键,调用方 t() 出
 * 当前语言的文案。后端 `NimoOS-AI/agent/main.py:417-424` 这个接口只有三种 422 detail,逐一
 * 映射;**认不出的一律落通用兜底键,后端原文永不回显**(这正是缺陷成因,不能留后门)。
 *
 * 同时读 `detail`(FastAPI)与 `message`(Go 服务)两种形状 —— 该接口现在走 Python agent,
 * 但同一入口未来可能改由 Go 侧代理,两种都认不增加成本。匹配前统一小写去空白。
 */
export function addBotErrorKey(e: unknown): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  const raw = data && typeof data === 'object'
    ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
    : data
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''

  if (s === 'bot token rejected') return 'aiCfgChannelsErrTokenRejected'
  if (s === 'bot_token required') return 'aiCfgChannelsErrTokenRequired'
  if (s === 'unsupported channel_type') return 'aiCfgChannelsErrUnsupportedType'
  return 'aiCfgChannelsAddBotFailed'
}
