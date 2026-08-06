## Task 12: `ChannelsSection`（聊天渠道）

**Files:**
- Create: `src/ai/components/settings/sections/ChannelsSection.vue`
- Create: `src/ai/components/settings/sections/ChannelsSection.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`（映射表 `channels` 项 + import）
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Consumes: Task 11 三个纯函数；Task 3 的 `SkModal`；`AlertDialog`；Task 2 的 `useSessionStore().isAdmin`；`ModelPicker`（`src/ai/components/shell/ModelPicker.vue`，P1c2 建的）；`buildCloudModelList`（`src/ai/stores/agentStore.ts:69` 导出的纯函数）；`service.ai` 的 `listPairableChannelInstances` / `listChannelBindings` / `listModels` / `listProviders` / `listChannelInstances` / `createChannelInstance` / `setChannelInstanceEnabled` / `deleteChannelInstance` / `createChannelPairingCode` / `setChannelBindingModel` / `setChannelBindingDownloadDir` / `deleteChannelBinding`；`copyText`
- Produces: 组件 `ChannelsSection`

**Vue2 蓝本：** `sections/ChannelsSection.vue`（410 行，本期最大件）+ **既有测试 `__tests__/ChannelsSection.spec.js`（7 例）**

**注意蓝本测试的路径不同**：它在 `src/views/AI/Settings/__tests__/`（上一级），不在 `sections/__tests__/`。

### i18n（本任务新增 31 键）

| 新键名 | Vue2 key | zh_cn 值（逐字） | en_us 值（逐字） |
|---|---|---|---|
| `aiCfgChannels` **复用** | `channelsTitle` | 聊天渠道 | Channels |
| `aiCfgChannelsDesc` | `channelsDesc` | 通过 Telegram 与你的 NimoOS 智能体对话。先配对你的账号，然后直接给机器人发消息。 | Chat with your NimoOS agent from Telegram. Pair your account, then message the bot directly. |
| `aiCfgChannelsAdminTitle` | `channelsAdminTitle` | 机器人配置 | Bot configuration |
| `aiCfgChannelsAdminHint` | `channelsAdminHint` | 仅管理员可见。机器人为所有 NimoOS 用户服务，每人各自配对自己的账号。 | Administrator only. The bot serves every NimoOS user; each pairs their own account. |
| `aiCfgChannelsAddBot` | `channelsAddBot` | 添加机器人 | Add bot |
| `aiCfgChannelsAddBotFailed` | `channelsAddBotFailed` | 添加失败，请检查 Token。 | Could not add bot — check the token. |
| `aiCfgChannelsBotType` | `channelsBotType` | 平台 | Platform |
| `aiCfgChannelsTypeTelegram` | `channelsTypeTelegram` | Telegram | Telegram |
| `aiCfgChannelsTypeDiscord` | `channelsTypeDiscord` | Discord | Discord |
| `aiCfgChannelsBotName` | `channelsBotName` | 名称（如“家庭机器人”） | Name (e.g. "Family bot") |
| `aiCfgChannelsBotToken` | `channelsBotToken` | 机器人 Token | Bot token |
| `aiCfgChannelsBotTokenTelegramHint` | `channelsBotTokenTelegramHint` | Token 来自 Telegram 的 {'@'}BotFather。 | Token from {'@'}BotFather on Telegram. |
| `aiCfgChannelsBotTokenDiscordHint` | `channelsBotTokenDiscordHint` | Bot token 来自 Discord 开发者后台。还须在后台为该 bot 打开 Message Content Intent 开关。 | Bot token from the Discord Developer Portal. You must also enable the Message Content Intent for the bot there. |
| `aiCfgChannelsDiscordPairNote` | `channelsDiscordPairNote` | Discord 机器人只能私信与它同处一个服务器的用户。请先用邀请链接把机器人加入某个服务器、让用户加入该服务器，再从那里配对。 | Discord bots can only DM users who share a server with them. Invite the bot to a server, have the user join it, then pair from there. |
| `aiCfgChannelsBotTokenTail` | `channelsBotTokenTail` | token ···{tail} | token ···{tail} |
| `aiCfgChannelsDiscordInvite` | `channelsDiscordInvite` | 邀请机器人进服务器 | Invite the bot to a server |
| `aiCfgChannelsEnabled` | `channelsEnabled` | 已启用 | Enabled |
| `aiCfgChannelsPairTitle` | `channelsPairTitle` | 配对聊天账号 | Pair a chat account |
| `aiCfgChannelsNoBots` | `channelsNoBots` | 尚未配置聊天机器人，请联系管理员添加。 | No chat bot is configured yet. Ask an administrator to add one. |
| `aiCfgChannelsGenerateCode` | `channelsGenerateCode` | 生成配对码 | Generate pairing code |
| `aiCfgChannelsBindingsTitle` | `channelsBindingsTitle` | 我已绑定的账号 | My linked accounts |
| `aiCfgChannelsNoBindings` | `channelsNoBindings` | 还没有绑定账号。在上方生成配对码并发送给机器人即可。 | No linked accounts yet. Generate a pairing code above and send it to the bot. |
| `aiCfgChannelsBindingDefaultModel` | `channelsBindingDefaultModel` | 默认模型 | Default model |
| `aiCfgChannelsBindingDownloadDir` | `channelsBindingDownloadDir` | 下载目录 | Download folder |
| `aiCfgChannelsUnbind` | `channelsUnbind` | 解绑 | Unlink |
| `aiCfgChannelsUnbindConfirm` | `channelsUnbindConfirm` | 确定解绑该账号？解绑后它将无法再与智能体对话。 | Unlink this account? It will no longer be able to message the agent. |
| `aiCfgChannelsDeleteBotConfirm` | `channelsDeleteBotConfirm` | 删除该机器人？其所有配对将失效。 | Delete this bot? All pairings for it will stop working. |
| `aiCfgChannelsCodeTitle` | `channelsCodeTitle` | 配对码 | Pairing code |
| `aiCfgChannelsCodeWarn` | `channelsCodeWarn` | 此配对码 10 分钟内有效，且仅可使用一次。 | This code is valid for 10 minutes and can be used once. |
| `aiCfgChannelsCreateCodeFailed` | `channelsCreateCodeFailed` | 生成配对码失败。 | Could not generate a pairing code. |
| `aiCfgChannelsPairInstructions` | `channelsPairInstructions` | 打开 Telegram，给 {'@'}{bot} 发送：/pair {code} | Open Telegram, message {'@'}{bot}, and send: /pair {code} |

⚠️ **三处 `@` 的处理**（`messageSyntax.test.ts` 会拦）：`aiCfgChannelsBotTokenTelegramHint` 与 `aiCfgChannelsPairInstructions` 两个 **i18n 值里**的 `@` 必须写成 `{'@'}`（上表已写好，照抄）；而模板里 `@{{ inst.bot_username }}` 那个 `@` 是 HTML 文本、不经 i18n，**不要**转义。

复用键：`aiCancel` · `aiCopy` · `aiCopied` · `aiCfgCopyFailed` · `aiDone` · `aiCfgDelete` · `aiCfgLoadingDots` · `aiCfgLoadFailed` · `aiCfgNoLabel` · `aiCfgSaved` · `aiCfgSaveFailed` · `aiCfgDeleteFailed`。

- [ ] **Step 1: 写测试（承接 Vue2 7 条 + 新增 15 条）**

Vue2 那 7 条用 `mocks: { $store: { state: { user: { role } } } }` 注入角色，本仓改成往 `localStorage['user']` 写角色（Task 2 的读口就是从那儿读的）：

```ts
function asAdmin() { localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' })) }
function asUser() { localStorage.setItem('user', JSON.stringify({ username: 'guest', role: 'user' })) }
```

| # | Vue2 用例 | 移植后怎么驱动 | 断言（不变） |
|---|---|---|---|
| 1 | `loads pairable instances and bindings on create (non-admin)` | `asUser()` + 挂载 | `listPairableChannelInstances` / `listChannelBindings` 各被调一次、**`listChannelInstances` 未被调**（否定断言，管理员段不该加载） |
| 2 | `admin also loads channel instances` | `asAdmin()` + 挂载 | 三个 list 都被调 |
| 3 | `genCode stores the revealed code and opens the modal` | 点某个可配对项的「生成配对码」 | `createChannelPairingCode(instId)` 被调、配对码弹窗出现且显示返回的 code |
| 4 | `setModel persists the chosen model key and updates the binding` | 从 ModelPicker 触发 select | `setChannelBindingModel(bindingId, key)` 被调、该行显示新模型 |
| 5 | `saveDownloadDir persists the folder` | 改下载目录输入框并触发 change | `setChannelBindingDownloadDir(bindingId, '/DATA/x')` 被调 |
| 6 | `doUnbind removes the binding from the list` | 点「解绑」→ 确认 | `deleteChannelBinding(id)` 被调、该行消失 |
| 7 | `addBot uses the selected channel type in the create payload` | 打开加机器人弹窗 → 选 Discord → 填 token → 提交 | `createChannelInstance({channel_type:'discord', name, config:{bot_token}})` |

新增 15 条：

8. 非管理员**不渲染**「机器人配置」段（DOM 断言 `.sk-section` 里没有该标题）；管理员渲染（对照组）。
9. `isAdmin` 从 false 变 true 时补拉一次 `listChannelInstances`（Vue2 有个 `watch: isAdmin`；本仓 `isAdmin` 是 computed 读 localStorage、**同一生命周期内不会变**（Task 2 已说明），所以这条**改为申报「Vue2 的 watch 在本仓不可能触发，未移植」并写一条注释**，不写测试。**这是明确的未移植项，报告里申报。**
10. 三个 list 各自 reject → 分别落到「加载失败。」/ 空列表 / 空可配对列表，互不影响（Vue2 三个 catch 各自独立）。
11. 可配对列表为空 → 渲染「尚未配置聊天机器人，请联系管理员添加。」
12. 绑定列表为空 → 渲染「还没有绑定账号。…」
13. 机器人行显示 `@bot_username`（有值时）与 token 尾号（`fillTokenTail`）；`invite_url` 存在时渲染邀请链接且 `target="_blank" rel="noopener"`，不存在时不渲染（对照组）。
14. 切换机器人启用开关 → `setChannelInstanceEnabled(id, true/false)` 被调、成功后补拉 `listPairableChannelInstances`（Vue2 :246）。
15. 启用开关失败 → danger toast，且开关**不留在错误状态**（Vue2 是 `inst.enabled = enabled` 写在 await 之后，失败时不改，行为对；断言开关回到原值）。
16. 删除机器人 → 确认框 → `deleteChannelInstance(id)`、该行消失、补拉可配对列表；点取消则不发请求（两条断言一个用例）。
17. `addBot` 的 token 为空/纯空格 → 提交按钮 disabled 且不发请求。
18. `addBot` 成功后：弹窗关闭、三个表单字段复位（name/token 清空、type 回 `telegram`）、`listChannelInstances` 与 `listPairableChannelInstances` 各补拉一次。
19. `addBot` 失败 → danger toast 用后端 message，兜底「添加失败，请检查 Token。」，且**弹窗不关**（Vue2 :251-256 是失败时 `showAdd` 保持 true）。
20. 配对码弹窗里的配对指引文案由 `fillPairInstructions` 填出（含 bot 用户名与 code）；点复制 → `copyText(code)` + 「已复制」toast。
21. 配对码弹窗关闭 → code 清空、补拉 `listChannelBindings`（Vue2 :309-313 同序）。
22. `setModel` / `saveDownloadDir` 失败 → 各弹 danger toast 兜底「保存失败」（两条断言一个用例）。
23. `saveDownloadDir` 输入未变化或为空白 → 不发请求（Vue2 :293 `if (!v || v === b.download_dir) return`）。
24. 模型列表加载：`listModels` 给本地模型 → 前缀 `local:`；`listProviders` 过 `buildCloudModelList`；两个接口各自 reject 时另一个仍生效（Vue2 两个独立 try/catch，**两条用例**）。

- [ ] **Step 2: 跑测试确认失败** → FAIL（组件不存在）

- [ ] **Step 3: 加 i18n 键 + 实现组件**

状态：

```ts
const pairable = ref<ChannelInstance[]>([])
const pairLoading = ref(false)
const bindings = ref<ChannelBinding[]>([])
const loading = ref(false)
const error = ref(false)
const availableModels = ref<AgentModel[]>([])
const showCode = ref(false)
const revealedCode = ref('')
const codeInstance = ref<ChannelInstance | null>(null)
const instances = ref<ChannelInstance[]>([])
const instLoading = ref(false)
const showAdd = ref(false)
const newName = ref('')
const newToken = ref('')
const newType = ref<'telegram' | 'discord'>('telegram')
const adding = ref(false)
const confirmDeleteBotOpen = ref(false)
const confirmUnbindOpen = ref(false)
const pendingBotId = ref<string | number | null>(null)
const pendingBindingId = ref<string | number | null>(null)

interface ChannelInstance {
  id: string | number; name?: string; channel_type?: string; bot_username?: string
  token_tail?: string; invite_url?: string; enabled?: boolean
}

const session = useSessionStore()
const isAdmin = computed(() => session.isAdmin)

const pairInstructions = computed(() =>
  fillPairInstructions(t('aiCfgChannelsPairInstructions'), codeInstance.value?.bot_username || '', revealedCode.value),
)

onMounted(() => {
  void loadPairable()
  void loadBindings()
  void loadModels()
  if (isAdmin.value) void loadInstances()
})
```

四个加载函数逐字照搬 Vue2 `:194-241`（各自独立 try/catch、失败落空数组或 `error=true`），信封取值 `res?.data?.instances || []` / `res?.data?.bindings || []` 照搬三重兜底。

`loadModels()` 照 Vue2 `:216-233`：先 `listModels()` 取本地（`key: 'local:' + m.name`、`source: 'local'`、`displayName: m.name`、`size: m.size`，跳过无 `name` 的项），再 `listProviders()` 过 `buildCloudModelList((provs?.data) || [])` 追加；**两个 try/catch 各自独立**（任一失败另一个仍生效）。

写操作照搬 Vue2 `:242-330`，把四处 `$buefy.dialog.confirm` / `$buefy.toast.open` 换成 `AlertDialog` / `toast.show(..., 3000, 'danger')`，并沿用 Task 8 那套「取消要复原」的 `watch(open)` + `confirmed` 标志写法（这里删机器人 / 解绑两处都是**纯确认后动作**、取消无需复原状态，所以只需 `@confirm` 走动作即可，不用标志位 —— 与 Task 8 的开关场景不同，别照抄多余逻辑）。

模板：三个 `.sk-section`（管理员机器人配置 `v-if="isAdmin"` / 配对聊天账号 / 我已绑定的账号）+ 两个 `SkModal`（加机器人表单、配对码）+ 两个 `AlertDialog`。**Vue2 的 `<style scoped>` 里 9 条 `.chan-*` 规则要一并搬进本组件的 `<style scoped>`**，但 `.chan-x`（关闭按钮）**不要搬** —— 它已收进 `SkModal` 的 `.sk-x`。搬的时候把颜色字面量核一遍：Vue2 那 9 条本来就全是 `var(--…)`，直接照抄即合规（`.chan-type-opt[data-active]` 用 `--accent` / `--accent-softer`，都在 tokens 里）。

⚠️ **机器人启用开关是原生 `<input type="checkbox">` 包在 `<label class="chan-switch">` 里，不是 `SetSwitch`** —— Vue2 就是这么写的（`:44-47`），照搬，不要"顺手统一"成 SetSwitch（那是界面改动）。

- [ ] **Step 4: 跑测试确认通过（22 例）+ 接映射表 + 全量测试门 + 提交**

```bash
pnpm test src/ai/components/settings/sections/ChannelsSection.test.ts
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/ChannelsSection.vue \
        src/ai/components/settings/sections/ChannelsSection.test.ts \
        src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts \
        src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2b Task 12: ChannelsSection(聊天渠道,承接 Vue2 7 例)"
git show --stat HEAD && git status
```

---

