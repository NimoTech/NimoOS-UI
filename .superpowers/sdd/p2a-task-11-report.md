# SP8-P2a Task 11 — 实现者报告

PrivacySection + ThinkingDefaultsSection。本期(P2a)最后一个实现任务。

commit: `3760271` — "SP8-P2a Task 11: PrivacySection + ThinkingDefaultsSection"

## 逐块对照

### PrivacySection.vue ↔ Vue2 `sections/PrivacySection.vue`(74 行)

| Vue2 | New-UI | 说明 |
|---|---|---|
| `:8-9` 三态包裹 | `v-if store.policyLoading` / `v-else-if !store.policy` | 逐字 |
| `:11-49` 卡片 + 三行 | `.sk-section` + `.set-rows` 三条 `.set-row` | 逐字 |
| `:22` `!!store.state.policy.allow_remote` | `!!store.policy.allow_remote` | `!!` 归一逐字保留(用例 10) |
| `:31-35` 下拉 local/cloud | `<select>` 两个 `<option>` | 逐字 |
| `:43` `!!store.state.policy.escalation_prompt` | 同上归一 | 逐字 |
| `:64-71 onChange(field,value)` | `onChange<K extends keyof Policy>` | 泛型化是 TS 化,非行为改动 |
| `:67` `duration: 1500` 显式 | `toast.show(t('aiCfgSaved'), 1500)` 显式传 1500 | 逐字保留这个显式值(不是吃 toast store 默认值,即便当前恰好相等) |
| `:69` 失败弹 `is-danger` | `toast.show(..., 1500, 'danger')` | 对应 tier |

无逻辑偏离,store 已在 T5 提供 `updatePolicyField`。

### ThinkingDefaultsSection.vue ↔ Vue2 `sections/ThinkingDefaultsSection.vue`(73 行)

| Vue2 | New-UI | 说明 |
|---|---|---|
| `:51-53` data():`enabled:true,level:'medium',saving:false,savedAt:0` | 四个 `ref` 同初值 | 逐字 |
| `:54-60 mounted()` `const d = await ai.getThinkingDefaults(); this.enabled=d.enabled` **无 `.data`** | `const d = (await service.ai.getThinkingDefaults()) as {...}; enabled.value=d.enabled` | 取数口径对齐 `agentStore.ts:744-748 loadThinkingDefaults`(同一端点、同一写法),未自行发明 |
| `:59 catch {}` 静默吞错 | `catch { /* 注释说明为何故意吞 */ }` | 保留吞错,只补注释(brief 明确指示) |
| `:14 SkillIcon name="sparkle"` | `AgentIcon name="sparkle"` | T1 既定替换 |
| `:21 @change="v => {enabled=v; save()}"` | `onToggle(v){enabled.value=v; void save()}` | 逐字 |
| `:27-33` 下拉四档 + `!enabled` disabled | 同 | 逐字 |
| `:37` `saving ? 'Saving…' : (savedAt ? 'Saved' : '')` | `saving ? t('aiCfgSaving') : savedAt ? t('aiCfgSaved') : ''` | 逐字 |
| `:62-70 save()` **只有 try/finally,无 catch** | **加 catch → danger toast** | 见下方偏离①,已按纪律三件套处理 |

## 测试真实输出(红→绿)

首次跑(实现完成后):
```
$ pnpm vitest run src/ai/components/settings/sections/PrivacySection.test.ts src/ai/components/settings/sections/ThinkingDefaultsSection.test.ts

 Test Files  2 passed (2)
      Tests  22 passed (22)
```
两个组件都是先写测试(对着 brief 用例清单)、再写实现,直接一次跑绿(实现时严格照 ProvidersSection.vue/agentStore.ts 的既定手法写,没有中间红态需要展示——除 Step 6 指定的 RED 验证外)。

## Step 6 RED 验证(brief 强制要求,两段真实输出)

去掉 `ThinkingDefaultsSection.vue` `save()` 的 `catch` 分支(临时改动,验证完立即用备份文件还原):

**RED**(去掉 catch 后跑用例 9):
```
$ pnpm vitest run src/ai/components/settings/sections/ThinkingDefaultsSection.test.ts -t "9\."

 FAIL  ...ThinkingDefaultsSection.test.ts > ThinkingDefaultsSection > 9. 保存失败 → danger 档 toast「保存失败」,且不产生未捕获 rejection
TypeError: Cannot read properties of undefined (reading 'text')
 ❯ ...:136:28
    expect(toast.toasts[0].text).toBe('保存失败')

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: boom
 ❯ ...ThinkingDefaultsSection.test.ts:131:47
This error originated in "...ThinkingDefaultsSection.test.ts" test file...

 Test Files  1 failed (1)
      Tests  1 failed | 11 skipped (12)
     Errors  1 error
```
两个信号都出现:①断言失败(没有 toast 被弹出)②vitest 捕获到一个**未处理的 rejection**——这正是 Vue2 缺陷的字面复现。

**GREEN**(还原 catch 后重跑同一用例):
```
$ pnpm vitest run src/ai/components/settings/sections/ThinkingDefaultsSection.test.ts -t "9\."

 Test Files  1 passed (1)
      Tests  1 passed | 11 skipped (12)
```

## 实际写了多少条用例

- PrivacySection.test.ts:**10 条**(用例 1-10,与 brief Step 1 逐条一一对应,无拆分无合并)。
- ThinkingDefaultsSection.test.ts:**12 条**(brief Step 2 共 11 条;用例 5「`enabled` 为 false/true 两条对照」拆成 `5a`/`5b` 两个 `it()`,其余 1-4、6-11 各一条)。
- 合计 **22 条**,首次全绿;另外 Step 6 的 RED/GREEN 各跑了 1 次(不计入正式用例数)。

## 自拟文案清单

**无。** 本次所需的全部中英文文案(`privacyDesc`/`thinkingDesc`/三行标签与副标题/两个 section 标题/横幅文案/`Data & backend`/`Local (prefer local models)`/`Cloud (use cloud directly)`/`Unable to load policy`)均在 Vue2 生产 `zh_CN.json`/`en_US.json` 里逐字查到(见下方 i18n 小节的查询记录),没有需要自拟的项。

## i18n

### 查询记录(权威脚本输出,逐字复用)

```
'privacyDesc'         zh= 控制数据是否离开本机、以及默认使用哪一类模型后端。默认一切在本地运行。   en= Control whether data leaves the device and which backend is used by default. Everything runs locally by default.
'Data & backend'      zh= 数据与后端   en= Data & backend
'Allow cloud requests'                zh= 允许云端请求   en= Allow cloud requests
'When enabled, conversations may be sent to configured cloud AI providers.'  zh= 开启后允许将对话发送到已配置的云端 AI 提供商
'Default backend'     zh= 默认后端    en= Default backend
'Sets the default selection in the model picker.'   zh= 影响模型选择器中的默认选项
'Local (prefer local models)'  zh= 本地（优先本地模型）
'Cloud (use cloud directly)'   zh= 云端（直接使用云端）
'Confirm on local failure'     zh= 本地失败时弹出确认
'When a local model fails, show a prompt asking whether to fall back to cloud.'  zh= 本地模型失败时，是否弹窗询问是否切到云端
'Unable to load policy'        zh= 无法加载策略
'thinkingDesc'                 zh= 新建会话时的默认思考设置。不支持思考的模型会自动忽略这些设置。
'Thinking intensity defaults'  zh= 思考强度默认值
'These settings are used as the initial values for new sessions. Models that do not support thinking will ignore them.'  zh= 新建会话时使用以下设置作为初始值。不支持思考的模型会自动忽略。
'Enable thinking by default'   zh= 默认开启思考
'Default intensity:'           zh= 默认强度:
```
(`Low`/`Medium`/`High`/`Very high` 也逐字核对过,值 = 低/中/高/极高,与既有 `aiThinkingLow/Medium/High/Max` 一致,见下方复用说明。)

### 新增键(16 个,zh_cn.ts / en_us.ts 各 +1 block,双 locale 均已加)

`aiCfgPrivacyDesc` · `aiCfgDataBackend` · `aiCfgAllowCloudRequests` · `aiCfgAllowCloudRequestsSub` · `aiCfgDefaultBackend` · `aiCfgDefaultBackendSub` · `aiCfgBackendLocal` · `aiCfgBackendCloud` · `aiCfgConfirmLocalFailure` · `aiCfgConfirmLocalFailureSub` · `aiCfgUnableLoadPolicy` · `aiCfgThinkingDesc` · `aiCfgThinkingDefaultsTitle` · `aiCfgThinkingBanner` · `aiCfgEnableThinkingDefault` · `aiCfgDefaultIntensity`

提交前逐一 grep 确认 zh/en 各恰好出现 1 次,无重复键(见下方任务门判定过程)。

### 复用的既有键(未新增,避免重复)

- `aiCfgPrivacyCloud`(已存在,= "隐私与云端")、`aiCfgThinkingIntensity`(已存在,= "思考强度")—— 两个分区的 `<h1>` 标题,恰好与 `sections.ts` 导航 `labelKey` 用的是同一对键,语义完全相同(都是这两个分区的显示名),直接复用。
- `aiCfgLoadingEllipsis`("加载中…")、`aiCfgSaved`("已保存")、`aiCfgSaveFailed`("保存失败")、`aiCfgSaving`("保存中…")—— 均已存在且值与本次所需逐字相同,复用。
- **`aiThinkingLow`/`aiThinkingMedium`/`aiThinkingHigh`/`aiThinkingMax`**(P1 期 `ThinkingBar.vue` 已建,前缀是 `aiThinking` 不是 `aiCfg`)—— 核对后值分别是「低/中/高/极高」,与本分区下拉四个选项字面完全相同、语义也完全相同(都是「思考强度档位」这同一个产品概念的展示文案),故直接复用,没有新建 `aiCfgThinkingLevelLow` 之类的重复键。这不违反 brief「本期新键统一 aiCfg 前缀」的约束——该约束管的是**新增**键,不要求把语义相同的既有跨前缀键重复造一遍。

## 偏离 Vue2 的地方(逐条申报)

**① `ThinkingDefaultsSection.vue` `save()` 加 catch(纪律修复,已在组件内注释 + 本报告申报)**
- Vue2 行号:`sections/ThinkingDefaultsSection.vue:62-70`
- Vue2 原文:
  ```js
  async save() {
    this.saving = true
    try {
      await ai.putThinkingDefaults({ enabled: this.enabled, level: this.level })
      this.savedAt = Date.now()
    } finally {
      this.saving = false
    }
  }
  ```
  只有 `try/finally`,没有 `catch`。
- 改成:加 `catch { toast.show(t('aiCfgSaveFailed'), 1500, 'danger') }`。
- 为什么:保存失败时 Vue2 原文会产生一个**未处理的 promise rejection**,且用户界面毫无提示——开关已经拨过去、后端没存上、什么都不会告诉用户。这是可复现的错误行为(RED 验证已证实:去掉 catch 后 vitest 直接报出 `Unhandled Rejection`),不是设计选择,按移植纪律「可复现的错误行为 → 改并登记」处理。

**② `mounted` 的 `catch {}` 保留,只补注释(非行为改动,只是把纪律要求的"说明为什么故意吞"落到位)**
- Vue2 行号:`:54-60`
- 保留原行为(接口失败时静默用硬编码默认值 `{enabled:true, level:'medium'}` 兜底),只是把空 `catch {}` 改成带解释性注释的 `catch { /* ... */ }`,不改变任何可观察行为。

**③ 观察项登记(不改,只登记,brief 明确要求)**
- 本分区(设置页)与 `agentStore.ts:161-167` 的 `thinking.defaults` 各自持有一份独立状态。设置页改了默认值,已挂载的 Agent 页 store 不会自动刷新。Vue2 同样如此(组件级 store 每次挂载新建,靠切页重建掩盖)。已在 `ThinkingDefaultsSection.vue` 文件头注释登记。

无其他偏离。i18n 键新增全部遵循既定规则(双 locale、无 `@` 字面量问题——本次文案里没有 `@` 字符)。

## 任务门判定过程

1. `pnpm vitest run` 只跑本任务两个文件:**2 files / 22 tests,全绿**(见上方"测试真实输出")。
2. `pnpm exec vue-tsc --noEmit`:**无输出,exit 0**——干净。
3. `pnpm build`:**成功,exit 0**,只有既有的 500KB chunk 警告(允许项),无新警告。
4. `pnpm test`(全量)跑了 **3 次**观察浮动:
   - 第 1 次:**278 files / 2172 tests 全绿**。
   - 第 2 次:1 个文件 1 条用例失败——`src/ai/components/settings/sections/MemorySection.test.ts:145`(断言 `data-on` 应为 `'false'` 却读到 `'true'`)。核实:①`git status` 确认该文件不在我本次改动清单里,也不是我碰过的文件;②单独重跑该文件 `pnpm vitest run .../MemorySection.test.ts` → **20/20 全绿**,证明是全量并发跑时的计时类瞬时抖动(该文件是 P2b Task 6 刚提交的 `MemorySection.vue`,归另一个并行会话所有),不是本任务改动引入的问题。
   - 第 3 次:**278 files / 2172 tests 再次全绿**。
   - 结论:剩余失败项(如有)落在对方文件(`MemorySection.test.ts`),与本任务改动(`PrivacySection`/`ThinkingDefaultsSection`/`SettingsPage.vue`/两个 i18n 文件)无关,符合任务门判据(自己的测试文件全绿 + `vue-tsc` 干净 + 全量剩余失败经确认落在对方文件里)。
5. i18n 自核:16 个新键在 `zh_cn.ts`/`en_us.ts` 里各出现且仅出现 1 次(脚本核验,见上方"新增键"小节),`parity.test.ts`/`messageSyntax.test.ts`/`color-guard.test.ts` 单独跑 **164/164 全绿**。
6. `git show --stat HEAD` 只含本任务清单内的 7 个文件;`git status` 干净。

## `git show --stat HEAD`

```
commit 37602715d4649b2f05eb94cfd0cff29b169fcd46
    SP8-P2a Task 11: PrivacySection + ThinkingDefaultsSection

 .../settings/sections/PrivacySection.test.ts       | 149 +++++++++++++++++++
 .../settings/sections/PrivacySection.vue           |  96 +++++++++++++
 .../sections/ThinkingDefaultsSection.test.ts       | 157 +++++++++++++++++++++
 .../settings/sections/ThinkingDefaultsSection.vue  | 137 ++++++++++++++++++
 src/ai/views/SettingsPage.vue                      |   6 +-
 src/i18n/en_us.ts                                  |  20 +++
 src/i18n/zh_cn.ts                                  |  19 +++
 7 files changed, 582 insertions(+), 2 deletions(-)
```
