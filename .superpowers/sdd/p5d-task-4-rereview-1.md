# P5d · T4 修复轮 1 —— 范围收窄复审

复审范围:修复 diff `8897d5e..cb73071`(仅 `p5d-task-4-report.md` 与
`NotesMarkdownEditor.test.ts` 两个改动文件)。全程只读核查,`git status` 始终干净,
未 kill/重起任何 dev server(`:5288` pid 未碰)。所有断言由我自己复跑取得,不采信
实现者报告的任何数字/结论。

## 待判定 finding

**「spy `setContent` 走不通」结论下得太宽 —— 实例级 `Object.defineProperty` 遮蔽 getter 可行**

**判定:ADDRESSED。**

取证:
- 新用例 `用户敲字后父组件把同一个值经 v-model 写回,setContent 调用 0 次;写入真正不同的值时调用 1 次`
  已加入 `§5.3 防回环` describe 块(`NotesMarkdownEditor.test.ts:194-216`),用
  `spySetContentCalls()`(实例级 `Object.defineProperty(ed,'commands',{get:...})` 遮蔽原型
  getter,内部 `Proxy` 只拦截 `setContent`)同时断言**两侧**:同值写回 → `0`,异值写回 → `1`。
- 原 `editor.state.doc` 引用同一性用例(`:156-183`)**逐字未删未改**(仅其上方注释①措辞订正)。
- 注释①已订正为精确表述:`vi.spyOn(ed.commands,'setContent')` 因 `commands` 每次访问重建
  绑定对象而失效,但实例级遮蔽写法可行,不再隐含"spy 路线整体不可行"。
- `onTransaction` ~1/5 flaky 那条注释(②)逐字保留未动。

## 我自己跑的三组验证

**① 拿掉 `NotesMarkdownEditor.vue:69` 比对(`v !== ed.storage.markdown.getMarkdown()` → `true`)**
——cp 备份 → sed 行首锚定注入(`sed -n` 确认真落盘)→ 跑测试 → cp 覆盖还原 → md5 逐字节比对一致。
**两条用例都报红**:
- 旧 `doc` 引用用例:`expect(ed.state.doc).toBe(docBeforeEcho)` 报红(内容差 `"morestart"` vs `" morestart"`)。
- 新调用次数用例:`expected 1 to be +0`(在 `spy.count()).toBe(0)` 那一侧报红,即 mutation
  下同值写回也调用了一次 `setContent`)。
与报告描述一致(7 passed / 2 failed)。

**② 把 `editor.value.commands.setContent(v)` 整句删掉(模拟"从不调用 setContent 的坏实现")**
——同样 cp 备份 → sed 注入 → md5 还原。**「异值 → 1 次」那一侧精确报红**:
`expect(spy.count()).toBe(1)` → `AssertionError: expected +0 to be 1`(`doc` 引用用例也在其
`.not.toBe` 断言处报红,因为文档确实没变)。两侧都有判别力成立,不是只守住"0 次"单侧。

**③「写回挂载时原值 = 零判别力(Vue watch 去重)」——成立。**
临时在测试文件末尾追加一个探针用例(未改动原 9 例,跑完即弃,已用 md5 还原確认):
`mountEditor('same-value-probe')` 后**不敲字**、直接 `setProps({modelValue:'same-value-probe'})`
(与挂载值逐字相同)。在①的 mutation(拿掉 `:69` 比对)下重跑整文件:**10 例里只有原来那 2 条
报红,探针用例仍然绿**(`spy.count()` 恒 0)。证实"直接写回挂载原值"这种写法即使生产代码的
比对逻辑被整个拿掉也测不出来,是真的零判别力,与生产代码有没有比对无关 —— 报告里这条"第二个
死路"如实。**记给 T6/T7/T8**:任何要测"防回环/去重" watcher 的用例,写回值必须与**挂载时的初始
值不同**(先真实变更一次内容),否则 Vue 的 `watch` 源前置去重(`Object.is`)会让回调根本不执行,
断言恒为初始态、看似"通过"实为未触发。

## 连跑与其余核实

- 该测试文件连跑 **6 次**(超过要求的 5 次),每次 `9 passed (9)`,零 flaky。
- 产品代码零改动:`git diff 8897d5e..cb73071 -- src/ai/knowledge/components/NotesMarkdownEditor.vue`
  输出为空,逐行核实无差异。
- 零 `any`:`grep -n '\bany\b'` 对 `.vue` + `.test.ts` 两文件均无命中。
- 全量三门本轮复跑(非采信):`pnpm test` → `Test Files 329 passed / Tests 3607 passed`,
  `exit=0`;`vue-tsc --noEmit` → `exit=0`。算式 3606+1=3607 ✅,文件数 329 不变 ✅。
- 收尾 `git status --short` 为空,`HEAD` 仍 `cb73071d892da6a799b7f496a6780e4129ca121f`。

## 修复 diff 内新引入的破坏

无。

## 范围外观察(不延长本轮)

- `spySetContentCalls` 用 `Object.getOwnPropertyDescriptor` 沿原型链手动查找 getter,若未来
  `@tiptap/vue-3`/`@tiptap/core` 升级把 `commands` 挪到别处或改成非 getter 实现,该辅助函数会
  在 `throw new Error('commands getter not found...')` 处硬失败而非静默假阴性 —— 属于良性 fail-fast,
  不需本轮处理。
