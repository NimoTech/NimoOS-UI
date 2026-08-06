# SP8-P2b Task 12 —— ChannelsSection(聊天渠道)实施报告

## 逐文件改动

- **新建** `src/ai/components/settings/sections/ChannelsSection.vue`(1:1 移植自 Vue2
  `src/views/AI/Settings/sections/ChannelsSection.vue`,410 行):
  - 三个 `.sk-section`:管理员机器人配置(`v-if="isAdmin"`,Vue2 :10-43)/ 配对聊天账号
    (Vue2 :83-104)/ 我已绑定的账号(Vue2 :107-137)。
  - 两个 `SkModal`:加机器人表单(Vue2 :46-80)/ 配对码明文(Vue2 :140-160)。
  - 两个 `AlertDialog`:删除机器人确认(Vue2 :287-293 `$buefy.dialog.confirm`)/ 解绑确认
    (Vue2 :341-347)。两处都是「纯确认后动作,取消无需复原」,不引入
    watch(open)+confirmed 标志(McpTokensSection 的 confirmDeleteOpen/pendingDeleteId
    手法)。
  - 四个加载函数(loadPairable/loadBindings/loadModels/loadInstances)逐字对齐 Vue2
    :204-254,信封取值去掉多剥的一层 `.data`(公共约束 §5;`res.instances`/
    `res.bindings` 而非 `res.data.instances`)。
  - 写操作(addBot/toggle/doDeleteBot/genCode/setModel/saveDownloadDir/doUnbind/
    onCodeClosed/copy)逐字对齐 Vue2 :255-382,`$buefy.toast.open` 换 `toast.show(...,
    3000, 'danger')`,后端错误文案统一走 `apiErrorMessage`。
  - 机器人启用开关是原生 `<input type="checkbox">` 包 `<label class="chan-switch">`
    (Vue2 :34-37 原样),未"顺手统一"成 SetSwitch。
- **新建** `src/ai/components/settings/sections/ChannelsSection.test.ts`(24 例)。
- **改** `src/ai/styles/settings-styles.scss`:追加 Vue2 :387-410 scoped 里的
  `.chan-*` 规则(`.chan-x`/`.chan-x:hover` 已被 SkModal 的 `.sk-x` 收编,不搬),值逐字
  保留(Vue2 原文本来就是 `var(--…)`)。
- **改** `src/ai/styles/settingsStyles.test.ts`:追加一条回归断言,钉住上述 `.chan-*`
  规则选择器 + 一条真实声明(同 Task 10 `.mcp-label`/`.mcp-reveal-warn` 先例)。
- **改** `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`:各追加 `// >>> SP8-P2b Task 12 …
  // <<< SP8-P2b Task 12` 标记块,经 `.superpowers/sdd/p2b-stage-i18n.sh` 定向暂存
  (`git status` 里两个 i18n 文件是 `M`,内容已核对只含本任务标记块)。
- **跳过**(遵公共约束 §2,不打开、不改):`src/ai/views/SettingsPage.vue` 接线。

## 偏离申报(移植纪律 §7)

1. **D1**(brief 已预期,非新增偏离):两处 `.sk-modal-bg` 裸 div → `SkModal`;两处
   `$buefy.dialog.confirm` → `AlertDialog`。
2. **D2**(brief 已预期):状态本地 ref,不进 store。
3. **范围扩张,已申报**:brief Step 3 原话要求把 9 条 `.chan-*` 规则放进「本组件的
   `<style scoped>`」,但 phase-wide 既定范式(constraints §4,已被 BlacklistSection/
   McpTokensSection 两次验证)是分区组件零 `<style>` 块;brief 写在对账之前,constraints
   优先。改遵循后者,规则迁入 `settings-styles.scss`,并扩大改动范围触及
   `settingsStyles.test.ts`(已在两处文件头注释里申报)。
4. **未移植项,已申报**:Vue2 `watch: { isAdmin(v) {...} }`(:192-195)。本仓 `isAdmin`
   是读 localStorage 的 computed(`useSessionStore`),同一组件实例生命周期内角色不会
   变(角色切换走整页重载),该 watch 在本仓不可能被触发,故未移植、未写对应测试(组件头
   注释已写明)。

## 承接 Vue2 spec.js 断言(7 → 7,全部保留,逐条重新表达)

Vue2 断言 `w.vm.*` 内部状态与 mock 调用参数;`<script setup>` 不暴露内部状态,全部改成
「渲染出的 DOM + service mock 调用」两类可观察事实,断言的是**同一件事实**:

| # | Vue2 断言对象 | New-UI 改成断言什么 |
|---|---|---|
| 1 | `w.vm.pairable.length===1`,`w.vm.isAdmin===false` | `.set-row` 渲染数 = 1、内容含 'fam'; 页面文本不含「机器人配置」;`listChannelInstances` 未调 |
| 2 | `w.vm.isAdmin===true` | 页面文本含「机器人配置」;`listChannelInstances` 已调 |
| 3 | `w.vm.revealedCode`/`showCode`/`codeInstance.bot_username` | 明文码落在 `.sk-modal input.set-input.full.mono` 的 `.value`;弹窗文本含 `fam_bot` |
| 4 | `b.default_model` | 真实挂载的 `ModelPicker`(非 stub)`props('selectedKey')` 更新 + `.model-pill-name` 显示新模型名 |
| 5 | `b.download_dir` | 下载目录输入框 `.value` 更新为新值 |
| 6 | `w.vm.bindings.map(id)` | `.tok-row` 数量减少、该行从 DOM 消失 |
| 7 | `createChannelInstance` 调用参数 | 同,mock 调用参数断言不变(唯一一条本来就走 mock 断言的,未改) |

## 新增 17 例(brief 编号 8/10-24;9 号明确不写测试)

8(管理员段渲染对照)/10(三加载独立失败)/11(可配对空态)/12(绑定空态)/13(机器人行
@用户名+token 尾号+邀请链接对照)/14(开关成功补拉)/15(开关失败不改数据源,见下)/
16(删机器人确认+取消)/17(空 token 禁用提交)/18(addBot 成功复位+补拉)/19(addBot 失败
消息+兜底+弹窗不关)/20(配对指引文案+复制)/21(配对码弹窗关闭补拉绑定)/22(setModel/
saveDownloadDir 失败兜底)/23(saveDownloadDir 未变化/空白不发请求)/24a+24b(loadModels
两个独立 try/catch)。

**#15 的技术说明**(值得记录,不是缺陷):`:checked="inst.enabled"`(非 v-model)这类
绑定,Vue 3(与 Vue2 同理)的 patch 只在 `next !== prev` 时才回写 DOM 的 `checked`
属性(`'checked'` 不像 `'value'` 那样有强制回写例外)。失败路径不写 `inst.enabled`
(Vue2 :280 同款,行为正确),但这意味着测试里手动模拟的用户点击留下的原生 DOM
`checked` 状态**不会**被之后任何重渲染纠正回来——这是该绑定模式本身的已知局限,不是本
组件引入的缺陷,不属于「1:1 照 Vue2 要修的可复现错误行为」,故不改绑定方式。测试改用
「失败后重新挂载一份干净实例,验证数据源(mock)确实没被改写」来证明同一件事实。

## RED→GREEN

初次写好 24 例后跑测试,2 例红:
- #8:第二次挂载复用同一个 Pinia 实例,`useSessionStore().user` 是读 localStorage 的
  computed(同实例内会缓存,见 `stores/session.ts` 头注释),导致读到第一次挂载缓存的
  旧角色。修复:`asAdmin()` 后 `setActivePinia(createPinia())` 换新实例再挂载。
- #15:最初想「强制整体重渲染把 checked 纠正回来」,实测该假设不成立(见上方技术说明)。
  改成「失败后干净重挂载,断言数据源未被写坏」。
两处修复后 `pnpm vitest run .../ChannelsSection.test.ts` 24/24 全绿。

## i18n 逐字性与转义自查

- 全部 30 条新值逐字取自 brief 表(用 python 脚本 `repr()` 精确提取 markdown 单元格
  文本再转抄,避免手抄错标点/曲线引号/中点字符)。
- 转义按 channelsFormat.ts 头注释的机制:`aiCfgChannelsBotTokenTail` 的 `{tail}` →
  `{'{'}tail{'}'}`;`aiCfgChannelsPairInstructions` 的 `{bot}`/`{code}` 同样转义,字面
  `@` → `{'@'}`;`aiCfgChannelsBotTokenTelegramHint` 的字面 `@` → `{'@'}`。
- **已验证渲染结果**(不只是测试通过):测试用真实 `createI18n({ legacy:false,
  messages:{ zh_cn: zh } })` 加载真实 `zh_cn.ts`(非 mock 的 `t=>key` stub),用例 #3/
  #13/#20 分别断言 `fillTokenTail`/`fillPairInstructions` 处理过的渲染文本里出现
  `token ···ab12`、`@fam_bot`、真实配对码——证明 `{'{'}tail{'}'}`/`{'@'}{'{'}bot{'}'}`
  等转义在 vue-i18n 真实编译器下确实解析回字面 `{tail}`/`@{bot}`,而不是被当命名插值吃成
  空串。另单独跑 `pnpm vitest run src/i18n/ src/styles/color-guard.test.ts`(170 例
  全绿,含 `messageSyntax.test.ts`/`parity.test.ts`)。
- 复用键(未重复定义):`aiCfgChannels`/`aiCancel`/`aiCopy`/`aiCopied`/
  `aiCfgCopyFailed`/`aiDone`/`aiCfgDelete`/`aiCfgLoadingDots`/`aiCfgLoadFailed`/
  `aiCfgNoLabel`/`aiCfgSaved`/`aiCfgSaveFailed`/`aiCfgDeleteFailed` —— 逐一 grep HEAD
  两档语言包确认存在且值与 brief 表一致,组件里用到的每个键要么在这份复用清单、要么
  在本次新增的标记块里,无依赖对方会话未提交工作区的键。

## 测试门(全量)

```
pnpm test                      # 285 files / 2290 tests 全绿
pnpm exec vue-tsc --noEmit     # 无输出,干净
pnpm build                     # 成功;仅既有第三方包警告(@vueuse PURE 注释/lottie+file-type
                                # eval)与 >500KB chunk 警告,无新增问题
```

## 提交纯净性自查

```
git show --stat HEAD
```
仅含:`ChannelsSection.vue`(新建)/`ChannelsSection.test.ts`(新建)/
`settings-styles.scss`(改,仅 .chan-* 追加)/`settingsStyles.test.ts`(改,仅一条新
断言)/`zh_cn.ts`/`en_us.ts`(改,仅经脚本定向暂存的 Task 12 标记块)。`git status`
提交后干净,无对方会话文件卷入。

提交 sha:`efcd6f34205dc5c529e8358014aa5efb001d3698`
