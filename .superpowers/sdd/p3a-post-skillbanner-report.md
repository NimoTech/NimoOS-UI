# SP8-P3a 验收后追加 —— 「已挂载技能」提示条 · 实现者报告

任务书:`.superpowers/sdd/p3a-post-skillbanner-brief.md`
公共约束:`.superpowers/sdd/p3a-common-constraints.md`
分支:`sp8-ai`(工作区 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`)

## 1. 逐文件改了什么

### `src/ai/components/shell/AgentComposer.vue`
- 顶部 HTML 注释追加一段「SP8-P3a 验收后追加(2026-07-30)」,说明:这是用户当面
  指令新增的、Vue2 没有的 UI;背景问题(URL 变了但界面全程无提示,用户能否确认
  技能生效);不做的两条(不清 URL、不加停用提示);为什么放在 chips 行之前
  (语义一致 + 继承 `.composer` 的 `pointer-events: auto`)。
- 模板:`<div class="composer">` 内、`composer-chips` 行之前,新增
  `<div v-if="store.pendingSkillId" class="pending-skill">` 块:
  - `AgentIcon name="sparkle" :size="12" color="var(--accent)"`(先例
    `SearchFileDrawer.vue:103` 同款 `color="var(--accent)"` 写法)。
  - `<i18n-t keypath="aiSkPendingBanner" tag="span" class="pending-skill-text">`,
    具名插槽 `#name` 里放 `<code>{{ store.pendingSkillId }}</code>`(先例
    `ResourcesTab.vue:165-172`、`MentionPopover.vue:328`)。i18n 值本身不含
    `<code>`,未用 `v-html`。
  - 关闭按钮 `.pending-skill-x`:`:title`/`:aria-label` 用
    `t('aiSkPendingDetach')`,`@click="store.pendingSkillId = null"`。
- 样式(同一 `<style scoped>` 块,插在 `.composer-chips` 规则之前):
  `.pending-skill`(`background: var(--accent-softer)` + `border: 1px solid
  var(--accent-soft)`,圆角/字号/间距与 `.ctx-chip` 同语言)、
  `.pending-skill-text :deep(code)`(`var(--font-mono)` + `color: var(--accent)`)、
  `.pending-skill-x` / `:hover`(逐值复用 `.ctx-chip-x` 的规则:
  `var(--text-tertiary)` → hover `var(--bg-elevated)`/`var(--text-primary)`)。
  **零新 token**,全部复用 `tokens.scss` 里已存在的语义 token。

不改 `pendingSkillId` 的读写方式:直接读写 `useProvidedAgentStore()` 返回的真实
store 字段,未加 prop、未加 emit,未碰 `AgentPage.vue` / `agentStore.ts`。

### `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`
新增两个键(插在 SP8-P3a 技能分区标记块末尾、`// <<< SP8-P3a` 之前,逐字照
brief §2.4,未做任何翻译/标点改动):

| 键 | zh_cn | en_us |
|---|---|---|
| `aiSkPendingBanner` | `已挂载技能 {name},将应用于下一条消息` | `Skill {name} is attached — it will apply to your next message` |
| `aiSkPendingDetach` | `取消挂载` | `Detach skill` |

两档均加了同一段注释,说明这是 P3a 验收后追加、Vue2 无对应 UI、`{name}` 由
`<i18n-t>` 具名插槽填充。无字面 `@`,未触发 `messageSyntax.test.ts` 转义规则。
复用键:无(`aiSkPendingBanner`/`aiSkPendingDetach` 均为新增,未见可复用的既有
`aiSk*`/`aiCfg*` 键覆盖这个语义)。

### `src/ai/components/shell/AgentComposer.test.ts`
文件末尾新增一个 `describe('AgentComposer 已挂载技能提示条(SP8-P3a 验收后追加)')`
块,4 例(逐条对应 brief §3):
1. `pendingSkillId` 有值 → `.pending-skill` 渲染,`code` 文本等于该 slug。
2. `pendingSkillId` 为 `null` → `.pending-skill` 不渲染。
3. 点 `.pending-skill-x` → `store.pendingSkillId` 变 `null` 且提示条消失。
4. `pendingSkillId` 被(外部)清空后,提示条靠 `v-if` 自然消失,组件侧不需要
   任何额外清理代码。

未删除、未削弱既有 56 例(该文件的真实用例数以 `grep -c "  it("` 为准
= 56,不是粗略 `grep -c "it("` 数出的 81,那个数字把注释/字符串里出现的
`it(` 子串也算进去了——报告在此更正,供协调者核对台账时留意)。

## 2. Vue2 对照

**无对照** —— Vue2 `src/views/AI/Agent/shell/AgentComposer.vue` 没有这个元素。
这是本任务唯一目的,已在组件头注释与本报告 §4 申报。

## 3. RED → GREEN 证据

对 4 条新用例做了整体 RED 验证(把 `v-if="store.pendingSkillId"` 临时改成
`v-if="false"`,单独跑本文件):

RED(3 条如预期失败,1 条如预期仍绿——`pendingSkillId=null` 时本就该不渲染,
不受这个破坏影响):
```
 FAIL  ... > pendingSkillId 有值时渲染提示条,文案里含该 slug(在 <code> 里)
 FAIL  ... > 点关闭按钮把 store.pendingSkillId 置 null,提示条消失
 FAIL  ... > pendingSkillId 被清空后(模拟 send() 消费一次的效果),提示条自然消失
 Test Files  1 failed (1)
      Tests  3 failed | 1 passed | 56 skipped (60)
```

还原 `v-if="store.pendingSkillId"` 后,单独跑本文件:
```
 Test Files  1 passed (1)
      Tests  60 passed (60)
```

## 4. 三门完整终值

```
pnpm test                    → exit=0 · Test Files 291 passed (291) · Tests 2416 passed (2416)
pnpm exec vue-tsc --noEmit   → exit=0(空输出)
pnpm build                   → exit=0 · 仅既有 >500KB chunk 警告(ExcelViewer/index-BJgEjpSL 等),无新警告/报错
```
基线是 291 文件 / 2412 例;本次净增 4 例(60-56 in AgentComposer.test.ts),
2412+4=2416,吻合。无红项,无需复跑 flaky 探针
(`src/files/upload/persist.test.ts` 本轮未红)。

## 5. i18n 复用 / 新增键清单

- 复用:无。
- 新增:`aiSkPendingBanner`、`aiSkPendingDetach`(zh_cn + en_us 均加,
  `parity.test.ts` 已在全量门里过)。

## 6. 偏离申报(公共约束 §2 三件套 · ①代码注释 ②本节 ③台账待协调者登记)

**唯一偏离,已获用户 2026-07-30 当面授权**:在 `AgentComposer.vue` 新增 Vue2
没有的 UI 元素——输入框内「已挂载技能」提示条。

- 动机:「在对话中试用」把 skill id 存进 `agentStore.pendingSkillId`,只在
  **下一次** `send()` 时才真正消费(塞进 `X-Skill-Id` 头并清空,
  `agentStore.ts:925-927`),但界面全程无任何提示——用户验收时提出「URL 变了
  但真的会用吗」,证明这是可复现的体验缺口。
- 范围:只读写 `store.pendingSkillId`;不清 URL(方案②未选)、不加技能停用/
  删除提示(方案③未选);未碰 `AgentPage.vue`、`agentStore.ts`、技能分区 7 个
  文件。
- 代码注释落点:`AgentComposer.vue` 文件头注释块(新增段落)+ 模板里紧贴该
  `<div>` 的行内注释。

## 7. 其他说明

- 图标复用 `AgentIcon`(`sparkle`/`x`),未新建 `SkillIcon` 或其他图标组件——
  沿用公共约束 §3.2 已授权的「`SkillIcon.vue` 不移植」精神(虽然那条是讲
  Skills 分区,但本任务同样统一用 `AgentIcon`,未引入新依赖)。
- 颜色:`.pending-skill` 用 `var(--accent-softer)` 底 + `var(--accent-soft)`
  边框(与 `.composer:focus-within` 同一 token,见 `agent-styles.scss:369`);
  `.pending-skill-x` 逐值复用 `.ctx-chip-x` 的规则。未新增任何 token,未触发
  `color-guard.test.ts` 的任何一条规则(全量门已过)。
