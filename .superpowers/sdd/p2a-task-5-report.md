# SP8-P2a Task 5 —— settingsStore 整体移植成 Pinia:实现者报告

commit: `22f9628` on branch `sp8-ai`(父提交 `dadfb0e`)

## 1. Action ↔ Vue2 行号对照表

| store 内函数 | Vue2 `settingsStore.js` 行号 |
|---|---|
| `setActiveSection` | 45 |
| `loadModels` | 48-56 |
| `pullModel`(含观察项申报) | 58-68 |
| `deleteModel` | 70-73 |
| `searchHF` | 75-88 |
| `selectHFRepo` | 90-93 |
| `loadHFFiles` | 95-105 |
| `importHF` | 107-111 |
| `startImportJob`(含 D3 申报 + `_timer` 照搬) | 113-153 |
| `dismissImportJob` | 155-159 |
| `cancelImportJob` | 161-166 |
| `loadProviders` | 168-176 |
| `showProviderForm` | 178-194 |
| `hideProviderForm` | 196-199 |
| `applyProviderPreset` | 201-206 |
| `saveProvider` | 208-233 |
| `toggleProvider` | 235-248 |
| `deleteProvider` | 250-253 |
| `loadProviderModels` | 255-264 |
| `refreshProviderModels` | 266-275 |
| `saveProviderModels` | 277-282 |
| `toggleModelFavorite` | 284-290 |
| `addManualModel` | 292-298 |
| `removeManualModel` | 300-307 |
| `loadPolicy` | 309-317 |
| `updatePolicyField` | 319-333 |
| `loadServicesStatus` | 335-351 |
| `loadBlacklist` | 353-361 |
| `addBlacklist` | 362-368 |
| `removeBlacklist` | 369-372 |
| `resetTransientUi`(D2,Vue2 没有,新增) | — |

主题(`theme`/`toggleTheme`,settingsStore.js:9,46)**不在本 store**——已由 Task 4 抽到 `./aiTheme`,遵 brief 要求排除。

## 2. Step 2(RED)真实输出

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI

 ❯ src/ai/stores/settingsStore.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ai/stores/settingsStore.test.ts [ src/ai/stores/settingsStore.test.ts ]
Error: Failed to resolve import "./settingsStore" from "src/ai/stores/settingsStore.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  ...
 Test Files  1 failed (1)
      Tests  no tests
```

(通过临时把 `settingsStore.ts` 移出目录跑测试得到,与 brief 预期的失败信息一致。)

## 3. Step 4(GREEN)真实输出

首次跑通(修复 `vi.hoisted` 与 `Policy` 类型问题后):

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI


 Test Files  1 passed (1)
      Tests  36 passed (36)
   Start at  16:34:55
   Duration  585ms
```

36 条全部 PASS。

## 4. Step 5 —— 三条关键断言的 RED 验证(六段真实输出)

### 4.1 用例 21(编辑态空 api_key 不进 payload)

**改坏**:`if (data.api_key) payload.api_key = data.api_key` → 无条件 `payload.api_key = data.api_key`

RED:
```
 ❯ src/ai/stores/settingsStore.test.ts (36 tests | 1 failed | 35 skipped) 8ms
     × 21. saveProvider 编辑态且 api_key 为空 → payload 里不含 api_key 键 7ms

AssertionError: expected { name: 'OpenAI', …(4) } to not have property "api_key"
- Expected: undefined
+ Received: ""
 Tests  1 failed | 35 skipped (36)
```

GREEN(复原后):
```
 Test Files  1 passed (1)
      Tests  1 passed | 35 skipped (36)
```

### 4.2 用例 25(toggleProvider 失败回滚)

**第一次尝试改坏**(注释掉 `providers.value = snapshot`)后跑测试**仍然是绿的**——
说明我最初写的用例 25 本身没有判别力:生产代码里 `providers.value` 只在
`ai.updateProvider` **成功之后**才被 splice 改动,若一开始就 reject,catch 里
的回滚行只是把 `providers.value` 赋回一个内容本来就没变过的数组,删掉那行
测不出来。于是**先修用例本身**:改成在请求"在途"期间对 `providers` 做一次
外部改动(模拟并发/刷新撞车),再让请求 reject,断言必须回到调用前的快照而
不是停在在途期间的外部改动上——这样才真正锁住回滚行为。

修好用例后,重新对同一处改坏(注释掉回滚行),RED:
```
 FAIL  src/ai/stores/settingsStore.test.ts > settingsStore — Providers > 25. toggleProvider 失败 → providers 回滚到调用前的快照且重新抛出
AssertionError: expected [ { id: 1, name: 'A', …(2) }, …(1) ] to deeply equal [ { id: 1, name: 'A', …(2) }, …(1) ]
- Expected
+ Received
  [
    { "base_url": "u1", - "enabled": false, + "enabled": true, "id": 1, "name": "A" },
    { "base_url": "u2", - "enabled": true,  + "enabled": false, "id": 2, "name": "B" },
  ]
 Tests  1 failed | 35 skipped (36)
```

GREEN(复原 `providers.value = snapshot` 后):
```
 Test Files  1 passed (1)
      Tests  36 passed (36)
```

### 4.3 用例 36(resetTransientUi 不动 hfImportJobs)

**改坏**:在 `resetTransientUi()` 末尾加一行 `hfImportJobs.value = {}`

RED:
```
 ❯ src/ai/stores/settingsStore.test.ts (36 tests | 1 failed | 35 skipped) 12ms
     × 36. resetTransientUi 不动 hfImportJobs / installedModels / providers / policy(对照组) 10ms

AssertionError: expected undefined to be truthy
- Expected: true
+ Received: undefined
 Tests  1 failed | 35 skipped (36)
```

GREEN(复原后):
```
 Test Files  1 passed (1)
      Tests  36 passed (36)
```

## 5. 三条申报项的处理与注释位置

1. **D2 `resetTransientUi()`**(新增,Vue2 没有)——`src/ai/stores/settingsStore.ts`
   函数上方注释(约第 645 行起),原样使用 brief 给的注释模板,说明根因是
   Vue2 `createSettingsStore()` 每次挂载新建、Pinia 是全局单例。精确切分:
   只重置 `activeSection`/`providerForm`/`hfQuery`/`hfResults`/`hfSelectedRepo`/
   `hfFiles`,不动 `hfImportJobs`/`pullingModels`/`installedModels`/`providers`/
   `policy`/`blacklist`/三个服务状态字段。用例 35/36 分别覆盖"该重置的重置了"
   与"不该动的没动"(对照组)。

2. **`_timer` 照搬存在 `hfImportJobs[filename]._timer`**——`ImportJob` 类型定义
   处(文件顶部类型区)与 `startImportJob` 函数上方各有一段注释,明确写明
   "**不得**优化成模块级 Map",并引用 Vue2 `Settings.vue:160`(brief 里的 D3
   小节)解释 `!job._timer` 守卫的作用。实现里 `job._timer = timer` 紧跟在
   `setInterval` 返回之后同步赋值,取值路径与 Vue2 逐字一致。

3. **`pullModel` 观察项**(提示只在请求在途瞬间显示)——`pullModel` 函数上方
   注释,引用 `settingsStore.js:58-68`,原样搬运"照搬不改、待真机观察"的结论。
   测试用例 4 的行内注释也重复点了一句,防止后续读测试的人误以为这是断言
   "提示语义正确"。

## 6. 实际用例数

`grep -c "  it('" src/ai/stores/settingsStore.test.ts` → **36**(与 brief 清单
逐条对应,未增未减;用例 6/9/16/20 内部各自二次断言同一条清单项的两个分支,
不额外计数)。

## 7. 全量门三条命令结果

```bash
$ pnpm test
 Test Files  264 passed (264)
      Tests  1938 passed (1938)
   Duration  53.70s

$ pnpm exec vue-tsc --noEmit
(无输出,类型检查通过)

$ pnpm build
✓ built in 11.45s
(仅有既有的 500KB chunk 警告,无新增警告/错误)
```

基线为 263 文件 / 1902 例(本任务开工前),本任务新增 1 个测试文件 / 36 条
用例 → 264 / 1938,与实测结果吻合。全程未触发 IndexedDB flaky,无需复跑。

## 8. 其它偏离与原因(均非 brief 明确点名的三件套项,单独在此登记)

1. **测试 mock 骨架改用 `vi.hoisted()`**:brief Step 1 给的骨架是
   `const ai = {...}; vi.mock(...)`,原样照抄后实测报错
   `ReferenceError: Cannot access 'ai' before initialization`——因为
   `vi.mock` 调用被提升到文件最顶部,而 ESM 里所有 `import` 语句(含
   `import { useSettingsStore } from './settingsStore'`)本身也先于任何非
   import 语句执行,于是 mock 工厂在 `const ai = {...}` 真正赋值前就被触发,
   踩中 TDZ。本仓 `agentStore.test.ts:4-19` 已经用 `vi.hoisted()` 解决过同一
   问题,这里照搬那个先例,而不是 brief 里那段实测会炸的骨架(已在测试文件
   头注释里写明原因)。

2. **`saveProvider` 的校验错误文案未新增 i18n 键**:brief 正文的 i18n 全局
   约束要求新键同时进 `zh_cn.ts`/`en_us.ts`,但 brief Step 6 的 `git add`
   命令只列了本 store 的两个文件,不含 `src/i18n/*`。判断这是任务边界的
   有意收窄(i18n 化留给 Task 10 ProvidersSection 的消费方处理),因此这里
   直接用与 Vue2 英文源字面量一致的硬编码字符串
   `'Name and Base URL are required'`,未接入 `i18n.global.t`,并在文件头
   与函数注释里写明原因,避免被误读为遗漏。曾一度按常规先加了这两个 i18n
   键(zh_cn.ts/en_us.ts 各三行),发现与 Step 6 文件清单冲突后已用
   `git checkout --` 撤回,未留痕迹(`git status` 已确认工作区干净)。

3. **`Policy` 类型不带索引签名,`updatePolicyField` 调 `service.ai.updatePolicy`
   处加了一次 `as unknown as Record<string, unknown>` 转换**:共享包
   `updatePolicy(data: Record<string, unknown>)` 要求索引签名类型,而
   `Policy` 故意保持三个具名字段(不带 `[key:string]: unknown`)以便
   `updatePolicyField<K extends keyof Policy>` 的泛型收窄不被弱化成
   `string`。两者冲突处用一次显式转换解决,注释写明原因,不是绕过类型
   检查的滥用(vue-tsc 全量跑过,唯一一处双重断言)。

4. **`addBlacklist` 的 id 兜底逻辑**保留 Vue2 `r.data.id ?? r.data`
   的双层兜底(先取 `.id`,取不到就把整个 body 当 id,再兜底 `Date.now()`),
   类型上用一次窄化断言 + 注释说明依据 `settingsStore.js:363-364` 的用法
   推得的契约,未简化掉这层兜底(判定属于逐字移植范围,非 bug)。

## 9. `git show --stat HEAD`

```
commit 22f96288e84375b18ff1c6adf3853cf330cff716
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 16:39:14 2026 +0800

    SP8-P2a Task 5: settingsStore 整体移植成 Pinia(含 D2 瞬态状态复位)

    Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

 src/ai/stores/settingsStore.test.ts | 557 +++++++++++++++++++++++++++
 src/ai/stores/settingsStore.ts      | 735 ++++++++++++++++++++++++++++++++++++
 2 files changed, 1292 insertions(+)
```

`git status` 后置检查:working tree clean,只含这两个文件的新增。

---

## 10. 评审回复修复(commit `99e424f`)

评审结论:Spec ✅、Quality Approved,29 项行号对照表逐项复核准确,零不实陈述。
**1 条 Important**:`saveProvider` 校验错误消息硬编码英文
(`throw new Error('Name and Base URL are required')`),而消费方
`ProvidersSection.vue:175-182` 的 catch 是 `e.message || t('Save failed')`
——**e.message 优先展示**,硬编码英文会原样弹给中文用户,接线即暴露,不是
可以拖到 Task 10 的债。协调者裁定:计划里 Task 5 的 `git add` 清单没含 i18n
文件是写计划时的疏漏,与"所有用户可见文案必须走 i18n"的全局硬约束冲突时以
全局约束为准,当场修——本节记录修复过程。

### 10.1 改了什么

1. **`src/i18n/zh_cn.ts`** / **`src/i18n/en_us.ts`**:各加一行
   `aiCfgProviderNameUrlRequired`(中文 `'名称和 Base URL 为必填项'`、英文
   `'Name and Base URL are required'`,协调者回查 Vue2 生产语言包给出的权威值,
   逐字照用),插在既有 `aiCfg*` 键簇末尾、`aiNoModelsAvailable` 之前,用 Edit
   精确插入,未重写整个文件。

2. **`src/ai/stores/settingsStore.ts`**:
   - 新增 `import { i18n } from '../../i18n'`(与 `agentStore.ts:6` 同一路径)。
   - `saveProvider()` 里 `throw new Error('Name and Base URL are required')`
     → `throw new Error(i18n.global.t('aiCfgProviderNameUrlRequired'))`
     (本仓 vue-i18n 9 composition 模式是 `i18n.global.t(...)`,不是 Vue2 的
     `i18n.t(...)`,对齐 `agentStore.ts:893` 的既有先例)。
   - 文件头【i18n 偏离说明】与 `saveProvider` 上方的函数注释均改写:不再说
     "Step 6 文件清单不含 i18n 所以硬编码",改成如实记录"实现者最初的判断
     错了,评审指出 e.message 会被消费方优先展示,协调者裁定当场修正"。

3. **`src/ai/stores/settingsStore.test.ts`**:用例 20 原本只断言
   `.rejects.toThrow()`(不检查消息内容),现改为断言消息**等于**中文译文
   `'名称和 Base URL 为必填项'`(`rejects.toThrow('名称和 Base URL 为必填项')`,
   测试默认 locale 是 `zh_cn`),两处校验分支(name 空 / base_url 空)都补了
   这条断言,补上此前缺失的"消息内容"测试保护。

### 10.2 RED 验证(两段真实输出)

**改坏**:把 `i18n.global.t('aiCfgProviderNameUrlRequired')` 改回硬编码英文
`'Name and Base URL are required'`。

RED:
```
 ❯ src/ai/stores/settingsStore.test.ts (36 tests | 1 failed | 34 skipped) 29ms
     × 20. saveProvider name 或 base_url 空白 → 抛错且不发请求(两条),消息走 i18n 11ms

AssertionError: expected [Function] to throw error including '名称和 Base URL 为必填项' but got 'Name and Base URL are required'

Expected: "名称和 Base URL 为必填项"
Received: "Name and Base URL are required"

 Tests  1 failed | 1 passed | 34 skipped (36)
```

GREEN(复原 `i18n.global.t(...)` 后):
```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI


 Test Files  1 passed (1)
      Tests  36 passed (36)
```

### 10.3 全量门

```bash
$ pnpm exec vitest run src/ai/stores/settingsStore.test.ts src/i18n/
 Test Files  4 passed (4)
      Tests  45 passed (45)

$ pnpm test
 Test Files  264 passed (264)
      Tests  1938 passed (1938)
   Duration  82.57s

$ pnpm exec vue-tsc --noEmit
(无输出,类型检查通过)

$ pnpm build
✓ built in 11.41s
(仅有既有的 500KB chunk 警告,无新增警告/错误)
```

未触发 IndexedDB flaky,无需复跑。

### 10.4 提交

```
commit 99e424fbf04987a31cdb862394538f681d16aec9
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 16:51:56 2026 +0800

    SP8-P2a Task 5 fix: saveProvider 校验消息走 i18n

 src/ai/stores/settingsStore.test.ts | 10 +++++++---
 src/ai/stores/settingsStore.ts      | 24 ++++++++++++++++--------
 src/i18n/en_us.ts                   |  6 ++++++
 src/i18n/zh_cn.ts                   |  5 +++++
 4 files changed, 34 insertions(+), 11 deletions(-)
```

`git status` 后置检查:working tree clean,只含这 4 个文件的改动,无其它文件
被误卷入。
