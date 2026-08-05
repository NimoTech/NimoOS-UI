# SP8-P3b Task 5 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 5 —— `AddSkillModal.vue`

**Files:** 新建 `src/ai/components/settings/skills/AddSkillModal.vue` + `.test.ts`

**Consumes:** `SkModal`(`../SkModal.vue`)· `SKILL_COLOR_IDS`(`./SkillTile.vue` 具名导出)· T2 的 `validateSkillForm` 与 `aiSk*` 键 · T1 的 `.sk-trig-*`/`.sk-color-*` 样式。
**Produces:** props `{ open: boolean; saving: boolean; serverError: string }` · emits `update:open`、`save(payload)`,其中
```ts
payload = { name, title, description, trigger, color, md, examples: [], scripts: { path: string; content: string }[] }
```

**外壳用 `SkModal`**(reka Dialog:Esc + 焦点陷阱 + portal 回 `.set-app`)—— 不照抄 Vue2 的裸 `.sk-modal-bg` + `@click.self`(P2b Task 3 已定的先例,视觉规则不变故用户看不出结构换了)。标题 `aiSkAddTitle`;footer 插槽放「保存在这台 NAS 本地」说明 + 取消/创建两个 `.sk-btn`。
⚠️ 先读 `SkModal.vue` 确认 footer 插槽的 DOM(它自带 `.sk-modal-foot > .right`),别重复套一层。

字段 1:1 对 Vue2 `AddSkillModal.vue:10-95`:名称(`aiSkFieldName` + placeholder + hint,`@keydown.enter.prevent`)· 描述(textarea)· 触发方式(三个 `.sk-trig-option` 按钮,`:data-active`)· 颜色(`.sk-color-row` 里 7 个 `.sk-color-dot`)· SKILL.md(可选,textarea,Vue2 `:75` 那个内联 `style` 是尺寸/字体**不是颜色**,照抄)· 脚本文件(`<input type="file" multiple>` + hint + 已选文件列表)。

打开时聚焦名称输入框(对 Vue2 `:133-135`)—— reka Dialog 有自己的焦点管理,**实测**默认焦点落在哪;若不是名称框再显式 `focus()`,并在报告里说明实测结论。

### 5.1 三处拍板偏离(逐条三件套申报)

1. **颜色圆点不用内联 `:style`**(Vue2 `:61` 是 `:style="{ background: c.bg }"`,本仓禁内联颜色):改 `:data-color="id"`,底色由 T1 埋的 7 条 `[data-color=…]` SCSS 规则供。选中态仍走 `:data-active`。
2. **提交前本地校验**:`submit()` 先 `validateSkillForm(name, description)`,非 `null` 则把该键渲染进**行内错误条**(落在 `.sk-modal-body` 顶部,`.sk-field-err` 或等价类 —— **先 grep 确认类名真实存在**,P2b 的 `.chan-field-err` 是先例;若不存在,在 T1 的 scss 里加过就用,否则报告 `NEEDS_CONTEXT` 停下)。Vue2 `:137-139` 只查非空,填完一屏才被后端一句英文顶回来。
   `valid`(按钮禁用条件)仍照 Vue2 = 两字段非空 —— **不要**把完整校验塞进按钮禁用态(那会让用户不知道为什么点不动)。
3. **>1 MiB 文件不再静默丢弃**:Vue2 `:164-167` 直接 `continue`。改为累计跳过数,行内提示 `aiSkFilesSkippedTooBig`(先例:P1c1 附件管线的 500 MB 门)。

`serverError` prop:`SkillsSection` 把 T2 映射出来的键渲染后的文案传进来,与本地校验错误显示在**同一个**行内错误位(两者互斥:本地校验通不过就不会发请求)。

`.test.ts` 覆盖:两字段非空才启用创建按钮 · 提交 payload 逐字段正确(含 `title === name`、`scripts` 路径前缀 `scripts/`、`examples: []`)· 名称非法 → 行内错误且**不 emit save**(钉住偏离 2)· 描述超 256 → 行内错误 · 7 个颜色点渲染且 `data-color` 正确、点击切 `data-active`(**断言零内联 `style` 里的颜色** —— 钉住偏离 1)· 三个触发选项切换 · `>1 MiB` 文件被跳过且出现提示、`≤1 MiB` 的被读入(钉住偏离 3)· `saving` 时按钮文案变「创建中…」且禁用 · `serverError` 非空时显示。
文件读取用 `new File([...], name)` 构造;`f.text()` 在 jsdom 里可用,若不可用则 mock。

**验收**:三门绿(color-guard **+1**)· 零 `<style>` 块 · 报告申报 3 条偏离 + reka 焦点实测结论。

---

---

# 附:计划的 Global Constraints(本任务隐含包含)

## Global Constraints

从 spec 抄来的硬约束,**每个任务隐含包含本节**:

1. **只动 `.sp8/NimoOS-New-UI` 一个仓**。Service 仓本期零改动。禁碰 `NimoOS-New-UI`(SP6)、`.sp7/`(SP7)、真机 `/var/lib`,不跑 `deploy.sh`。
2. **移植纪律(用户 2026-07-27 拍板)**:界面/视觉/交互严格 1:1 照 Vue2;逻辑/bug 不照抄,但偏离必须**三件套**齐全 —— ① 代码注释注明 Vue2 `file:line` 的问题 ② 实现者报告显式申报 ③ 台账登记。**未申报的偏离本身就是缺陷。** 禁与需求无关的重构/改名/换库。
3. **配色**:一切可见颜色必须 `var(--…)` token。禁 `#hex`/`rgb()`/`rgba()`/具名色(含 `white`/`black`)。**内联 `:style` 里的颜色同样违规。** 禁用 `theme-exception` 逃逸。新 token 必须在浅色与 `[data-theme="dark"]` 两块都有值。⚠️ `color-guard.test.ts` 只 glob `.vue`/`.css` —— **`.scss` 无自动化守卫,本期这批 scss 靠评审逐行人肉扫**。
4. **数据契约**:后端 `NimoOS-AI/route/v2/skills.go` 全是 `c.JSON(code, out)` 裸对象/裸数组,无信封;共享包 `service.ai.*` 已 `return res.data` 剥掉 axios 层 → **消费端单层取数**。测试 mock 一律裸对象/裸数组,写 `{ data: … }` 就是把缺陷编码进断言。
5. **代码范式**:`<script setup lang="ts">` · `useI18n()` from `'vue-i18n'` · 后端走 `import { service } from '@nimotech/nimoos-service'` · **import 一律相对路径**(本仓无 `@/` 别名)· 状态一律组件本地 `ref`,不新建 store · 组件里**零 `<style>` 块**(样式全在 `.scss`)· 用到的每个 CSS 类先 `grep` 确认存在。
6. **toast 真签名**:`show(text, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
7. **i18n**:新键**同时**加 `src/i18n/zh_cn.ts` 与 `en_us.ts`(`parity.test.ts` 断言键集一致)。值逐字照 Task 2 的表,**不许自行翻译、不许改标点**。文案里字面 `@` 写成 `{'@'}`(`messageSyntax.test.ts` 全键守卫会拦)。
8. **测试门(每任务提交前)**:全量三门,**输出完整落盘禁 `| tail`**(P3a 那条偶发红就是靠这条留下名字的):
   ```bash
   cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
   pnpm test                  > /tmp/p3b-test.log  2>&1; echo "exit=$?"
   pnpm exec vue-tsc --noEmit > /tmp/p3b-tsc.log   2>&1; echo "exit=$?"
   pnpm build                 > /tmp/p3b-build.log 2>&1; echo "exit=$?"
   ```
   已知噪声:`src/files/upload/persist.test.ts` 是既有 IndexedDB flaky,只它红就复跑一次并说明。
9. **算术备忘**:`color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量用例数 +1**(本期新增 2 个 `.vue`)。
10. **禁空转用例**;无判别力的断言要做 **RED 验证**(故意弄坏 → 看到红 → 复原 → 看到绿,报告贴两段输出)。mock 骨架用 `vi.hoisted()`。异步断言用 `flushPromises()`,不用单个 `await nextTick()`。**不许削弱或删除既有断言**来让测试变绿。
11. 一个任务 = 一个语义提交。禁 `git add -A`/`git add .`,只许显式列路径;提交后 `git show --stat HEAD` 自查。不 rebase/reset/stash/merge/push。

---

---

# 附:权威源速查

## 权威源速查(所有任务共用)

| 用途 | 路径 |
|---|---|
| Vue2 组件蓝本 | `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/{SkillsSection,SkillDetail,AddSkillModal,TestPanel}.vue` |
| Vue2 样式蓝本 | `…/src/views/AI/Skills/skills-styles.scss`(782 行) |
| Vue2 语言包 | `…/src/assets/lang/{zh_CN,en_US}.json`(en_US **大量缺键** → Vue2 回落显示 key 本身,故英文档取 key 字面量) |
| Vue2 SSE 蓝本 | `…/src/service/ai.js:204-258`(`streamSkillTest`) |
| 后端契约 | `/home/nimo/NimoTech/NimoOS-AI/route/v2/skills.go`、`route/v2/skills_files.go`、`service/skills_store.go` |
| 本仓 SSE 先例 | `src/ai/services/agentTransport.ts`(**照它的形状写 Task 3**) |
| 错误映射先例 | `src/ai/util/channelsFormat.ts:65-76`(`addBotErrorKey`) |
| 已评审通过的样板 | `src/ai/components/settings/sections/{BlacklistSection,ExecutionSection,MemorySection,ChannelsSection}.vue` |

---
