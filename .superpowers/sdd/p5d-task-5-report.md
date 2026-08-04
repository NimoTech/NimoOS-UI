# P5d · T5 报告 —— `openInApp.ts` 补两函数(§16)+ 票 3 守卫债(§15.3)

起点 HEAD `cb73071`(T0–T4 五刀关账、评审 clean)。改动仅 3 个已改文件,**零新建文件**
(文件数仍 329,`.vue` 仍 180)。

## 计划书 §T5 逐条对照

1. **`openDirInNewTab(dirPath)`** —— 逐字照抄蓝本 `openInApp.js:52-55`
   (`if (!dirPath) return; window.open(filesPathUrl(dirPath, ''), '_blank')`),
   `filesPathUrl` 用本仓既有的那个(`:41-43`,`/app/#/files?path=…&highlight=…`)。
   落在 `openFileInNewTab` 之后、`PHOTOSET_PREFIX` 之前(`openInApp.ts:56-62`)。
2. **`agentSessionUrl(sessionId)` + `openAgentSessionInNewTab(sessionId)`** —— 按裁定 A-8
   逐字照抄蓝本 `openInApp.js:117-124`,指向旧 Vue2 应用 `/#/ai/agent?session=…`
   (**无** `/app` 前缀)。落在文件末尾(`:111-128`),申报注释同款
   `photosAssetUrl`(`:37-39` + 文件头 `:5-9`)的写法,写明「New-UI 的 `/ai/agent`
   尚未实现 `?session=` 深链(AgentPage.vue / agentStore 零读取),故借道旧应用;
   实现后应换成 `/app/#/ai/agent?session=…`」。
3. **早退两侧用例**:`openDirInNewTab('')` / `(null)` / `(undefined)` 与
   `openAgentSessionInNewTab('')` / `(null)` / `(undefined)` 各自断言 `window.open`
   **不被调用**(`openInApp.test.ts` 新增 describe 块,均已跑绿)。
4. **`openNoteInNewTab` 确认未补**:`grep -rn "openNoteInNewTab" src/` 全仓零命中。
   登记进 P5e/P5f 交接项(见下)。
5. **开票(A-8)**:**「New-UI Agent 页补 `?session=` 深链」** —— `AgentPage.vue` /
   `agentStore` 目前零 `?route.query.session` 读取,`openAgentSessionInNewTab` 暂借道
   旧 Vue2 应用;待 New-UI 侧补上该深链支持后,`agentSessionUrl` 应改回
   `/app/#/ai/agent?session=…`。
6. **具名色扫描**(票 3a)——`knowledgeStyles.test.ts` 新增
   `namedColorOffensesInValues()`:只在 `background-color` / `border-color` /
   `background` / `border` / `box-shadow` / `color` / `fill` / `stroke` 的**值**部分
   找 8 个整词具名色(与既有 `:510-517` 同一份清单)。**RED + 反向探针两头验**(见 §RED 探针)。
7. **覆盖范围扩到 `src/ai/components/**`**:新增 `COMPONENTS_VUE_FILES`(70 个文件,
   `find src/ai/components -name "*.vue" | wc -l` 实测 70)+ 集合相等防漂移断言 + 抽取/
   覆盖度自检 + hex/rgb/hsl + 具名色,四类断言全套铺开。**扩范围前先用独立脚本
   `/tmp/scan_components.mjs`(逻辑与生产测试代码同构)对 70 个文件做过一次性
   dry-run:`anyIssue: false`(零 hex/rgb/hsl/具名色命中,且 70 个文件全部抽取成功、
   无 `NO TEMPLATE EXTRACTED`)。真实测试跑绿印证同一结论,不触发 NEEDS_CONTEXT。**
8. **`src/` 下非测试文件除 `openInApp.ts` 外零改动**:`git diff --name-only` 只有
   `src/ai/services/openInApp.ts`(改)· `src/ai/services/openInApp.test.ts`(测试)·
   `src/ai/styles/knowledgeStyles.test.ts`(测试)。`openInApp.ts` 的 `git diff` 全部是
   `+` 新增行,原有 7 个导出(`fileDirAndName`/`photosAssetUrl`/`filesPathUrl`/
   `openPhotoInNewTab`/`openFileInNewTab`/`photosSetUrl`/`openPhotoSetInNewTab`)
   一字未改。

## 具名色守卫两头探针(票 3a DoD)

**探针①(必须报红)**:在 `QueueView.vue:474`(`white-space: nowrap;`)之后插入
`color: white;`(`cp` 备份 → `sed -i '474a\  color: white;'` 行首锚定注入 → `diff` 先证
落盘)。跑 `-t "具名色"`:
```
FAIL views/QueueView.vue —— 模板内属性值位置…零具名色
AssertionError: … 发现具名色:
color: white: expected [ 'color: white' ] to deeply equal []
```
还原:`cp` 备份覆盖 →
`md5sum` 前后一致(`ff6bd0d…` = `ff6bd0d…`)、`git diff`/`git status` 该文件干净。

**探针②(必须不报红)**:同一个 `QueueView.vue:474` 的真实 `white-space: nowrap;`
——探针①还原后重跑 `-t "具名色"`:`82 passed`,`views/QueueView.vue` 那条在其中,
零红。属性名 `white-space` 根本不在 `COLOR_VALUE_PROPS` 名单里,天然被排除,
不需要额外的连字符特判。

**两头都过** —— 守卫成立。

## `agentSessionUrl` 正向 + 反向断言(带判别力验证)

正向:`expect(agentSessionUrl('sess 1')).toBe('/#/ai/agent?session=sess%201')`。
反向:`expect(agentSessionUrl('sess 1')).not.toBe('/app/#/ai/agent?session=sess%201')`。
**RED 探针**(模拟「顺手统一前缀」回归):`cp` 备份 → 把
`return '/#/ai/agent?session=' + …` 改成 `'/app/#/ai/agent?session=' + …` → 跑
`openInApp.test.ts -t agentSessionUrl`:5 条失败(含正向断言、反向断言、
`toHaveBeenCalledWith` 三种形式),证明该组测试对这个具体回归有判别力。
还原:`cp` 覆盖 → `md5sum` 前后一致(`248a875…` = `248a875…`)、`git status` 干净。
还原后重跑全量 `openInApp.test.ts`:`33 passed`。

## `src/ai/components/**` 扫描结果(票 3b)

零既有违规(见条目 7),**未触发 NEEDS_CONTEXT**。

## 三门(全量)

```
pnpm test                  exit=0   Test Files 329 passed (329)  Tests 3839 passed (3839)
pnpm exec vue-tsc --noEmit exit=0
pnpm build                 exit=0(仅既有 >500KB chunk 警告)
```
算式:起点 `3607` + 本刀新增 `232` = `3839`(实测)。构成:`openInApp.test.ts` +10
(`openDirInNewTab` 3 条 + `agentSessionUrl`/`openAgentSessionInNewTab` 7 条)、
`knowledgeStyles.test.ts` +222(知识库区具名色 it.each 11 条 + components 扩展
describe:文件清单 1 + 抽取/覆盖度 70 + hex/rgb 70 + 具名色 70 = 211;
10+222=232)。文件数仍 **329**(零新建)。

## K/N 申报

无新增 K/N 号偏离 —— `agentSessionUrl`/`openAgentSessionInNewTab` 是**逐字照抄蓝本**
(裁定 A-8 直接授权,非本任务自定偏离);`openDirInNewTab` 沿用既有落点惯例
(`filesPathUrl`,文件头注释里早已申报过,非本刀新增申报)。守卫加强本身不是产品逻辑
偏离,不占 K 号。

## 交接项登记

- **票(A-8)**:New-UI Agent 页补 `?session=` 深链支持(转 P5e/P5f)。
- `openNoteInNewTab` 本期未补,登记进 P5e/P5f(`FileDetailDrawer` 可能要用)。

## 自证

- `git status --short`:仅 3 个已知改动文件,无其它改动。
- `git diff --stat`:`openInApp.ts` +27/-0、`openInApp.test.ts` +72/-0、
  `knowledgeStyles.test.ts` +181/-0 —— 全部纯新增,无删改行。
