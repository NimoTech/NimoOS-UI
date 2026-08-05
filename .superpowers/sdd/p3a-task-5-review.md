# SP8-P3a Task 5 —— SkillDetail.vue 独立评审

评审者:独立 sonnet agent(非实现者),评审纪律遵循 `p3a-common-constraints.md` §11。
不采信实现者报告;逐项回 Vue2 蓝本 `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillDetail.vue`
(271 行)复核,自己 grep,自己跑测试,自己做 RED 探针。

## 判定

- **规格符合**:✅ 符合(§5.1 无遗漏,§5.2 无多出)
- **代码质量**:通过

## 逐项核验

### 1. §5.1「取」

- 空态两行文案:`.sk-detail-empty` / `.orb` / `.empty-title`(`aiSkPickLeft`)/
  `.empty-sub`(`aiSkPickLeftSub`)—— 与 Vue2 `:3-13` 结构、class、文案一致。
- `.sk-detail-bar`:`SkillTile :size="28" :radius="8"` 与 Vue2 `:16` 一致;
  `.sk-name` 内 `<span>{{skill.title}}</span><code>{{skill.name}}</code>` 与
  Vue2 `:17-20` 顺序/标签一致;`.sk-pill-try` 含 `AgentIcon sparkle size 13` +
  `aiSkTryInChat` 文案,点击 `tryInChat()`,与 Vue2 `:29-32` 一致(偏离 2:
  `SkillIcon`→`AgentIcon`,属预授权项)。
- `.sk-meta-grid` 四格,顺序与 Vue2 `:61-94` 一致:
  - 状态格:`.val[data-disabled]` + `.dot` 零内联样式,颜色规则完全交给
    `skills-styles.scss:280-316` 的 `.sk-meta-cell .val .dot` /
    `.val[data-disabled="true"] .dot` 静态选择器 —— **自己读 SCSS 确认选择器层级
    与组件输出的 DOM(`div.val[data-disabled] > span.dot`)精确匹配**,无静默失效风险。
  - 触发方式:`triggerLabel(trigger, name)` 精确对齐后端
    `NimoOS-AI/service/skills.go:191-199` 的映射(`auto→Automatic` /
    `slash→"/"+name` / `manual→Manual`,未知值原样回填 `m.Trigger`)—— 三态 + 未知态
    行为与后端语义完全一致,只是把服务端算好的英文串改成前端按枚举再映射本地化。
  - 来源:`authorLabel` 只对后端硬编码字面量 `"You"`(skills.go:188)本地化,其余
    原样,brief §5.1 明文要求此行为,非越权发挥。
  - 上次运行:`skill.last_used || '—'` 照 Vue2 `:88` 原样;`aiSkNTotal` 参数化
    `Number(calls||0).toLocaleString()` 对齐 Vue2 `:90`。
  - 描述 / SKILL.md / 附带文件三段结构、顺序、`(skill.files||[])` 与
    `!skill.files || skill.files.length===0` 两处 nil-slice 防御均与 Vue2
    `:96-151` 一致;`fileSizeLabel` 精确匹配后端 `"(N files)"` 格式
    (`skills.go` humanSize 产出),字节单位透传。
- i18n 值逐字核对生产语言包 `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`:
  `zh_CN.json` 里 `Pick a skill on the left`/`Trigger`/`Added by`/`Last run`/
  `{count} total`/`Bundled files`/`{n} files`/`No bundled files`/`Automatic`/
  `You`/`Manual` 等键的中文翻译与 New-UI `zh_cn.ts` 的 `aiSk*` 值逐字符相同。
  `en_US.json` 对应键大多缺失 —— 属该仓惯例(源字符串即英文 key,未翻译时
  vue-i18n 回退显示 key 本身),New-UI `en_us.ts` 的英文值等于这些 key 字面量,
  一致,非缺陷。

### 2. §5.2「不取」

grep 全文件(`.vue`/`.test.ts`)确认 `.sw`、`.sk-pill-more`、`.sk-menu`、
`confirm`/`.sk-modal`、`TestPanel`、`copyMarkdown`、`exportSkill`、`runTest`、
`doDelete`、`closeAnd`、`menuOpen`、`document.addEventListener('mousedown'...)`、
`busy` prop —— **一个都不出现在实际代码里**(仅头注释按 §2 三件套要求提及)。
`TestPanel` 占位注释精确落在「描述」`.sk-section` 与「SKILL.md」`.sk-section` 之间,
与 Vue2 `:108-112` 的位置吻合。

### 3. 偏离 4(trigger_human 禁读)

`triggerText` computed 只读 `s.trigger`/`s.name`,全文件 grep `trigger_human`
仅出现在类型定义注释与头注释里,生产逻辑零引用。测试 fixture 专门构造
`trigger:'auto'` + `trigger_human:'WRONG'` 断言显示「自动触发」且
`w.text()` 不含 `WRONG`。

**独立 RED 探针(#1)**:把 `triggerText` 改成
`(s as any).trigger_human || (ref ? t(...) : s.trigger)`,复跑
`SkillDetail.test.ts`:
```
Test Files  1 failed (1)
     Tests  3 failed | 16 passed (19)
```
与报告声称的 3 条精确一致。已还原,`git status` 干净,复跑 19/19 绿。

### 4. 状态圆点

零内联颜色/样式(`.dot` 元素 `attributes('style')` 为 `undefined`,测试已断言);
`data-disabled` 输出在 `.sk-meta-cell .val` 这个 div 上,与 Task 1 写在
`skills-styles.scss:280-316` 的 `.sk-meta-cell .val .dot` 基础规则 +
`.val[data-disabled="true"] .dot` 覆写规则的选择器结构逐层匹配,无 DOM/CSS 错位。

### 5. 格式化函数

`triggerLabel` slash 分支渲染出 `/{name}`(测试用 `weekly-report` 断言
`/weekly-report`,通过);`authorLabel` 未命中原样显示(`Bob Chen` 用例通过);
`fileSizeLabel` 对目录 `"(3 files)"` 本地化成「3 个文件」、字节单位 `"12 B"`
透传,均通过。

### 6. last_used / files 兜底

`skill.last_used || '—'` 逐字照搬,组件头注释已登记「若后端未来写英文相对时间串
需要补本地化」的说明;`(skill.files || [])` 与空数组/`null` 两种兜底路径均有
测试覆盖(含后端 nil slice 序列化坑的显式用例)。

### 7. 路由

`tryInChat()` 精确 `router.push({ path: '/ai/agent', query: { skill: skill.id } })`,
与 Vue2 `:240-242` 逐字一致;测试用 `vi.hoisted` mock `useRouter` 验证调用参数。

### 8. 零 `<style>` 块 + class 存在性

组件文件全程无 `<style>` 块。逐个 grep 确认以下 class 均存在于
`skills-styles.scss`:`sk-detail`/`sk-detail-empty`/`orb`/`empty-title`/
`empty-sub`/`sk-detail-bar`/`sk-name`/`sk-pill-try`/`sk-detail-body`/
`sk-detail-inner`/`sk-meta-grid`/`sk-meta-cell`/`sk-section*`/`sk-description`/
`sk-md`/`sk-file-row`。无凭空造的类。

### 9. 测试判别力

**独立 RED 探针(#2,针对 v-html 断言的判别力)**:把
`<div class="sk-md" v-html="mdHTML" />` 改成 `<div class="sk-md">{{ skill.md }}</div>`
(即让 markdown 完全不渲染,原样输出源文本),复跑测试:
```
Test Files  1 failed (1)
     Tests  1 failed | 18 passed (19)
```
精确只有「SKILL.md 段:markdown 渲染出真实 HTML」这一条报红 —— 证明该断言
确实验证渲染结果(`<strong>bold</strong>` 存在于 HTML、`# Title` 不存在),
而非空转或只验证函数被调用。已还原,`git status` 干净,复跑 19/19 绿。

未发现空转用例;19 条用例逐条都在测某个可被破坏的具体行为,`TestPanel` 占位那条
虽是"验证不存在"型断言但目的明确(防止误引入写操作组件),不算空转。

### 10. 提交纯净性

`git show --stat HEAD`:仅 2 个文件
(`SkillDetail.test.ts` 212 行 + `SkillDetail.vue` 200 行),`412 insertions(+)`,
无其它改动。

## 测试实测数字(评审者自己跑)

- `pnpm test`(全量):`Test Files 1 failed | 289 passed (290)` /
  `Tests 1 failed | 2394 passed (2395)`,唯一红项为
  `src/files/upload/persist.test.ts:55`(既有 IndexedDB flaky,公共约束 §8 已知噪声)。
  单独复跑该文件:`Test Files 1 passed (1)` / `Tests 14 passed (14)` —— 确认是
  flaky,非本任务引入。
- `SkillDetail.test.ts` 单独跑:`Test Files 1 passed (1)` / `Tests 19 passed (19)`。
- 两次 RED 探针见上,均已精确还原,探针后 `git status` 干净。

## 结论

无 Critical / Important 发现。任务实现与 brief §5.1/§5.2 精确对齐,偏离 4 落实
到位且有判别力测试兜底,状态圆点颜色改造与 Task 1 的 SCSS 选择器结构匹配,
测试无空转、无削弱既有断言,提交纯净。
