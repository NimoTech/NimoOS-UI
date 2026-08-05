# P6 验收补丁②:设置页加「YAML」标签页

## 背景与用户决策(2026-07-22 验收澄清)

用户之前否决的是「在 YAML 里做单元素带空格的启发式检查」,**不是** YAML 标签页本身——标签页要做。⛔ 仍然不做任何启发式警告/检查(用户明确);后端 dry_run 预检照走(那不是前端检查)。

用途:图形表单表达不了的配置(多网络、奇怪 command、任何冷门字段)的逃生口。多网络下拉旁的提示文案(`appsSettingsNetworkMulti`)本期**顺带改成**指向 YAML 标签页。

## 现状(先读这些文件)

- `src/apps/views/AppSettingsPage.vue` — 设置页(AreaShell 骨架、`useAppSettings(id)`、底部保存钮、端口冲突先弹窗再红条+滚回的既有 UX)。
- `src/apps/composables/useAppSettings.ts` — `save()` 管线:`buildYaml(originalYaml, forBuild)`(注意 tipsFromFallback 清空逻辑,行 38 邻域注释)→ `applySettings(id, yaml, {dryRun:true, checkPortConflict:true})` → 真 PUT → 端口冲突落 `conflicts: string[]`、其余落 `saveError`。
- `src/apps/components/custom/YamlEditor.vue` — P5 自定义安装的 CM6 编辑器组件,直接复用(看它的 props/v-model 约定)。
- `src/apps/views/AppConsolePage.vue` — tab 按钮样式(`console-tabs`)可参考/复用样式写法(颜色全 token)。

## 要做什么

### 1. useAppSettings 扩三个方法(保持现有 API 不动)

```ts
/** 当前 model 序列化为 YAML(含 save() 同款 tipsFromFallback 处理)——进 YAML tab 时取文本,表单已做的修改带过去 */
toYaml(): string
/** 用编辑后的 YAML 重建 model + originalYaml(YAML→表单方向);解析失败返回 false 并落 parseError,不动现有 model */
replaceFromYaml(text: string): boolean
/** 直接以原文走 dry_run→PUT→(与 save 同款错误/冲突处理);成功 true */
saveYaml(text: string): Promise<boolean>
```

- `toYaml` 与 `save` 里的 forBuild/tipsFromFallback 逻辑**抽成共享私有函数**,别复制两份。
- `replaceFromYaml` 成功后所有 dirty 标记自然归零(重 parse),originalYaml 替换为新文本——后续 save() 以新文本为基,语义正确。
- 新增 `parseError: ref<string>`,暴露出去。

### 2. AppSettingsPage 加双 tab

- tab 状态 `'form' | 'yaml'`,默认 form;tab 按钮放标题行(样式参考 AppConsolePage 的 `.console-tabs`,颜色全 token)。
- **form → yaml**:`yamlText = s.toYaml()`。
- **yaml → form**:`s.replaceFromYaml(yamlText)`,失败 → 不切换 + 红条显示 parseError(条内文案含「YAML 解析失败」+ 错误信息)。
- **YAML tab 内保存钮**:`s.saveYaml(yamlText)` → 成功走与表单保存相同的收尾(applying toast + `router.push({name:'apps'})`);端口冲突 → tab 内红条列出冲突端口(不做表单的行级标红/弹窗,直接红条即可);其它错误 → 红条 saveError。
- YamlEditor 占据主体高度(参考 CustomAppsPage 里它的用法)。
- ⛔ 不做任何内容检查/警告。

### 3. 多网络提示文案改指 YAML tab

`appsSettingsNetworkMulti` 改为:zh 「该服务配置了多个网络,请切换到 YAML 标签页修改」/ en 'This service is attached to multiple networks — switch to the YAML tab to edit them.'(两 locale 同步,parity 测试)。

### 4. 新 i18n key(zh/en 同步)

```
appsSettingsTabForm: '表单' / 'Form'
appsSettingsTabYaml: 'YAML' / 'YAML'
appsSettingsYamlParseError: 'YAML 解析失败:' / 'Failed to parse YAML: '
appsSettingsYamlSave: '保存 YAML' / 'Save YAML'
```
(若页面复用现有「保存」key 更顺,可不加 appsSettingsYamlSave,报告里说明。)

### 5. 测试(TDD)

- useAppSettings:toYaml 往返(load 后 toYaml→parse 与 model 等价)、replaceFromYaml 坏文本返回 false + parseError + model 不变、saveYaml 走 dry_run→PUT 两次调用、端口冲突落 conflicts。
- AppSettingsPage:切到 YAML tab 出现编辑器且文本含表单已改内容;坏 YAML 切回被阻止 + 红条;YAML 保存成功跳转。
- mock 约定:vi.hoisted、真 createI18n(仓库惯例);YamlEditor 若在 jsdom 有 CM6 问题,允许 stub(看 CustomAppsPage.test 怎么处理的,照抄)。

### 6. 门

`pnpm test -- --run` 全绿 + `pnpm exec vue-tsc --noEmit` 干净 + 主题零字面量(新样式全 token)。

## 边界

- 不动共享包、不动 Vue2、不动 ComposeSettingsForm(除非纯属需要,不预期)。
- 单提交,message 以 `feat(apps-settings): 设置页 YAML 标签页(表单表达不了的配置逃生口)` 开头。
