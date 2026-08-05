# SP8-P2b Task 8 评审 —— ObservabilitySection(Agent 监控 / Phoenix)

评审对象:commit `d05aac1`(单提交,770 行,5 个文件)。

## 一、规格符合性(逐项核对)

对照 Vue2 蓝本 `NimoOS-UI/src/views/AI/Settings/sections/ObservabilitySection.vue`(211 行)+
`sections/__tests__/ObservabilitySection.spec.js`(5 例)逐行核对新组件
`src/ai/components/settings/sections/ObservabilitySection.vue`(317 行)与
`ObservabilitySection.test.ts`(402 行,21 例)。

- 模板结构、类名顺序(`set-inner`→`set-page-head`→`sk-section`→`set-rows`→`set-banner`→
  `px-status`→两个 `AlertDialog`)与 Vue2 逐一对应,开关/状态点/「打开 Phoenix」按钮出现条件
  (`v-if="phoenixStatus === 'running'"`)、警告条条件(`phoenixStatus==='running' && !enabled`)
  逐字一致。
- `statusLabel` 三分支、`refreshStatus`(`entry ? entry.status||'exited' : 'absent'`)、
  `onToggle` 三分支、`turnOnFlow`/`turnOn`/`confirmInstall`/`turnOff`/`openPhoenix` 逐字对照
  Vue2 `:65-211`,除申报的 alive 守卫、AlertDialog 替换 `$buefy.dialog.confirm`、
  `onStopCancel` 补拨开关三处偏离外,逻辑与顺序未改动。
- API 映射(`NimoOS-Service/dist/{ai,compose}.d.ts`权威源核对):`service.compose.list()`
  返回已剥好信封的 `Record<string, ComposeAppWithStoreInfo>`,组件按 id 直接取键,**没有**
  重新实现 Vue2 的 `.data.data[APP_ID]` 三层解包 —— 正确。`compose.install(yaml, opts?)`
  的实现(`compose.ts:49-51`)确认已内置 `Content-Type: application/yaml`,组件未再手搭
  header —— 正确,且比 Vue2 `:172` 干净。`compose.setStatus(id, action)` 三值枚举与 Vue2
  `container.updateStateV2` 用法一致。`getTracingSetting`/`putTracingSetting({enabled})`/
  `getObservabilityCompose()` 签名与 Vue2 `ai.js` 逐一对应,payload 形状相同。
- i18n:18 个新键逐字符核对 Vue2 生产语言包 `zh_CN.json`/`en_US.json`(用 Python 脚本按
  Vue2 key 精确取值比对),**18/18 完全一致**(含省略号、括号、逗号)。复用键
  `aiCfgObservability`/`aiCancel` 在 HEAD 两档语言包各只出现一次,无重复定义。en_us.ts 里
  多个键在 Vue2 生产 `en_US.json` 里实际**不存在**(如 `Not installed`/`Phoenix tracing`
  等)—— 这是 Vue2 CasaOS 遗留的常见模式:键本身就是英文原文,缺译时 vue-i18n 用 key 兜底
  显示,故 brief 给的英文值(=key 原文)仍是正确的移植结果,不算问题。
- Vue2 5 例测试的移植:5/5 均找到对应用例(见下「承接统计」),断言语义不变(`confirm`
  被调一次 → 等价断言 `AlertDialog` 渲染;其余四例的 service 调用断言完全对应)。
- D4 API 映射与架构声明经核实成立:组件头注释完整申报理由与代价,`grep`确认组件与测试均
  未 import 应用区 `installProgress` store。

**判定:规格符合(✅)**。

## 二、任务质量

### 承接统计
Vue2 5 例 → 本档 5 例(用例 1-5),逐条对照见测试文件头注释与本评审第一节,**5/5 全部
承接,零丢失、零弱化**。新增 16 例(6a/6b/7-19,不含 5 例本体)覆盖 brief 列出的全部
新增点。

### 测试实测(本人亲自跑)
- `pnpm test src/ai/.../ObservabilitySection.test.ts` → **21 passed (21)**。
- `pnpm test`(全量)→ **280 files / 2222 tests 全绿**,stderr 有一条与 P2a 在途文件无关的
  未处理 rejection 堆栈噪声(同报告描述,不影响 it() 通过,不归属本任务)。
- `pnpm exec vue-tsc --noEmit` → 无输出,通过。
- `pnpm build` → 通过,仅第三方包注释警告 + >500KB chunk 警告(已知噪声)。
无红项需要归属。

### RED 探针(3 个,均已还原,`git status`/`diff` 确认干净)
1. 删掉 `app:install-progress` handler 里的 `app:name !== APP_ID` 过滤 → 用例 14 精确报红
   (`expected '正在安装 Phoenix… 99%' to be '…0%'`),其余 20 例绿。
2. 删掉 `onUnmounted` 里的 `offs.forEach((off) => off())` → 用例 17 精确报红
   (`expected 1 to be +0`),其余 20 例绿。
3. 把 `turnOff` 里的 `compose.setStatus(APP_ID, 'stop')` 改成 `'restart'` → 承接自 Vue2 的
   用例 4 精确报红,证明该承接断言确实锁住行为、非空转。
三次探针均单独复现、精确命中预期用例、其余用例不受影响；已用备份 `cp` 逐字还原,
`git status --porcelain` 与 `diff` 均确认工作区与 HEAD 一致。

### 空转检查(抽查 7/21,含额外一次验证性探针)
用例 1/6a/6b/11a/11b/18/19 逐一读断言与驱动路径:均驱动真实 DOM 交互或真实事件触发,断言
观测组件产出(DOM 文本/属性、service mock 调用参数),非仅观测 mock 本身,判定非空转。
另对**用例 9**做了一次验证性探针(非报告要求的 3 个之列,超额验证):删除 `refreshStatus`
里的 try/catch,`it()` 内的两条 `expect` 仍然通过(因为断言的是默认初值/已提前赴值的
`enabled`,并不真正依赖 catch 是否存在)——`try/catch` 被拿掉的唯一外部可见后果是一条
`Unhandled Rejection`(vitest 判为文件级 error,而非该 it() 的失败)。**用例 9 是弱断言/
接近空转**:它验证的是「状态没有被异常改坏」,但不足以证明「catch 真的挡住了异常传播」；
一次 `expect(...).not.toThrow()` 式包装或断言 `console.error`/无 unhandled rejection 会更
紧。严重度定为 Minor(不影响功能正确性,只是覆盖力度不足,且该弱点不是本任务独有 —— Vue2
`container.getMyAppListV2` catch 同款测试模式在其余分区也是这个粒度)。

### 争议点判定

**scope 扩展(`settings-styles.scss` +9 行)**
- (a) 是否该动这份档:成立。核对确认 Vue2 `ObservabilitySection.vue:208-211`
  (`scoped .status`/`.status.err`)在现有 `settings-styles.scss` 里确实**没有**等价规则
  (grep 全文件无命中),Task 2(P2a)整档移植时确实漏收了这条 scoped 规则 —— 补齐是必要的,
  不是无理由改动既有档。
- (b) 改名是否安全:grep 全仓 `.status` 用法,唯一命中的全局 `.status` 类在
  `src/home/components/HomeTopbar.vue:41`,但该组件是 `<style scoped>`(Vue 编译期加
  `data-v-*` 属性隔离),即使实现者原样用 `.status` 名字也不会与之冲突。也就是说改名成
  `.px-msg` 并非规避一个真实存在的冲突,而是防御性选择 —— 但与文件里已有的 `px-status`/
  `px-open` 前缀风格一致,不是随意起名,可接受。
- (c) 去掉 `var(--danger, #d33)` 裸色 fallback:核实 color-guard 规则(`p2b-common-
  constraints.md §6`)硬性禁止 `<style>` 块出现 `#hex` 字面量,新写规则去掉 fallback 是
  **唯一合规写法**;实测 `pnpm test src/styles/color-guard.test.ts` → 158 passed,通过。
- (d) 其余选择器结构、数值(`font-size: 13px`/`margin: 8px 18px`)与 Vue2 原值逐一比对
  一致,判定「值与结构逐字移植,仅改名」属实。
- (e) 是否声明:报告与提交信息均单独列出这条 scope 扩展并给出理由,符合 §7 三件套要求。
判定:**scope 扩展合理、已申报、无害**。

**fake-timers → flushPromises 替代**
逐句读 `pollStatus`/`turnOnFlow`/`confirmInstall`/`turnOff`:所有测试场景的 `composeList`
mock 均直接返回目标状态,`pollStatus` 循环体在第一轮 `refreshStatus()` 之后 `pred` 即为
真、函数在走到 `await new Promise((r) => setTimeout(r, intervalMs))` 之前就 `return true`
退出循环 —— 逐一核对用例 3/4/16/19 全部符合这个模式。**结论与实现者申报一致:确实没有任何
被测场景真正让 `setTimeout(intervalMs)` 分支参与求值**,`intervalMs` 本身(1500ms 一次/
2000ms 一次/10-40 次循环上限)因此完全未被任何用例验证 —— 例如把 `12` 次改成 `1` 次、把
`1500` 改成 `1`,全部 21 例仍会绿。这是**真实的覆盖空白**,但并非本次替代方案造成的
退化:brief 建议的 `vi.useFakeTimers()` 写法本身也没有承诺覆盖这些数字(brief 原文同样
要求 mock 直接返回目标状态使首轮命中)。因此判定：flushPromises 替代技术选择成立、不算
偏离,但轮询次数/间隔常量本身在本任务测试范围内始终是未验证的(应记入台账,供后续统一
补一条"轮询上限用尽后报错"的测试,而非本任务缺陷)。

## 三、发现清单

- **Minor** — 用例 9(`compose.list() reject → 保持当前状态、不抛出`)的两条 `expect`
  在去掉 `refreshStatus` 的 `try/catch` 后仍然通过,只在 vitest 全局产生一条
  `Unhandled Rejection`(不是该 it() 的失败)。断言强度不足以证明"不抛"这条行为,建议
  后续加一条 `expect(() => …).not.toThrow()` 式或监听 unhandled rejection 计数的写法。
- **Minor** — `pollStatus` 的重试次数/间隔常量(12×1500ms、40×2000ms、10×1500ms)在
  flushPromises 方案下全程未被任何用例真实触达(每个场景都在首轮命中 pred),这是已知、
  已申报的覆盖空白,不算本任务缺陷,但应记入台账供后续追加。
- **Minor** — `.px-msg`/`.px-msg.err` 重命名是防御性选择而非解决真实命名冲突(唯一潜在
  同名 `.status` 在别处是 `scoped`),不影响正确性,仅供协调者知悉。

无 Critical / Important 发现。

**判定:任务质量 = Approved(仅 3 条 Minor,均不影响功能正确性与规格符合性)**。

## 四、人工验收清单(未做,不可由本次评审代劳)

- 开关/状态行/横幅/两个确认框的视觉与 Vue2 逐像素比对(无浏览器环境无法验证)。
- 5 个分区一次挂载的首屏并发请求(7 个请求)是否都正常填充、无相互阻塞。
- scroll-spy 高亮跟随滚动。
- 真实 Phoenix 容器装/停的端到端行为(单测只 mock 到 service 层)。
`SettingsPage.vue` 确认本提交未触碰(`git show d05aac1 --name-only` 不含该文件),映射表
接线按 §2 指令整步跳过,符合协调者安排。
