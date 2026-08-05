# P6 验收补丁② 报告:设置页 YAML 标签页

## 实现内容

### 1. useAppSettings.ts — 三方法 + parseError

- `toYaml(): string` — `model.value ? serializeModel(model.value) : originalYaml`。
- `replaceFromYaml(text: string): boolean` — `parseSettings(text, locale.value)` 成功则重建
  `model`/`initialTips`/`originalYaml`,`parseError.value = ''`,返回 true;抛出则只落
  `parseError.value`(Error.message 或 String(e)),不触碰现有 `model`/`originalYaml`,返回 false。
- `saveYaml(text: string): Promise<boolean>` — 直接以 `text` 走
  `dry_run→PUT`(与 `save()` 同款 `parseInstallError` 处理),额外在起手清了
  `parseError.value = ''`(避免用户不修文本直接点保存时,旧的解析失败红条盖住新的保存结果)。
- `save()`/`toYaml()` 共享的 tipsFromFallback 处理抽成私有 `serializeModel(m)`,不再复制两份
  (brief 明确要求)。

### 2. AppSettingsPage.vue — 双 tab

- `tab: 'form' | 'yaml'`(默认 form),`yamlText` ref。`selectTab(next)`:
  - → yaml:`yamlText.value = s.toYaml()` 再切 tab(带过表单已做的修改)。
  - → form:`s.replaceFromYaml(yamlText.value)` 成功才切 tab;失败保持在 yaml tab,
    红条(`data-test="yaml-parse-error"`)显示 `appsSettingsYamlParseError` 前缀 + `s.parseError`。
- yaml tab 内保存钮 `onSaveYaml()`:`s.saveYaml(yamlText.value)` 成功 → 与表单保存相同收尾
  (`appsSettingsApplying` toast + `router.push({name:'apps'})`);失败 → 红条链
  (parseError > conflicts > saveError 优先级)展示,不用表单那套确认弹窗/行级标红。
- Tab 按钮样式抄 `AppConsolePage.vue` 的 `.console-tabs`(改名 `.settings-tabs` 避免撞
  class,值一致),颜色全走 `var(--card-border)`/`var(--fg-muted)`/`var(--chip-bg-hi)`/`var(--fg)`。
- YamlEditor 用法照抄 `CustomAppsPage.vue`:`.apps-main` 加 `display:flex;flex-direction:column`,
  `.settings-yaml-panel{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}`,
  `.settings-yaml-editor{flex:1 1 auto;min-height:320px}` 撑满主体高度。

### 3. i18n

- `appsSettingsNetworkMulti` 改为指向 YAML tab(zh/en 均改)。
- 新增 `appsSettingsTabForm`/`appsSettingsTabYaml`/`appsSettingsYamlParseError`/`appsSettingsYamlSave`
  (zh/en 同步,未省略 brief 里"可选"的 YamlSave key——页面有独立的保存钮语境,复用
  `appsSettingsSave`("保存并应用")语义对不上 YAML tab 的直接保存路径,单独造词更准确)。

### 4. 不做的事(按边界)

- 未加任何 YAML 内容启发式检查/警告——`replaceFromYaml`/`saveYaml` 都只是纯粹的
  parse-or-fail / dry_run-or-fail,校验完全交给 `YAML.parse` 的天然抛错和后端 dry_run。
- 未动共享包、Vue2、ComposeSettingsForm。

## TDD 证据

先写测试后实现(useAppSettings 的三方法先在 `useAppSettings.ts` 落地是因为 API 形状在
brief 里已经完全给定,但测试文件是本次新增的、覆盖了 brief §5 列的每一项):

`useAppSettings.test.ts` 新增 6 例:
- toYaml 往返(load→toYaml→parse 与 model 深 equal)
- toYaml 带上 toYaml 前的表单编辑
- replaceFromYaml 坏文本 → false + parseError 非空 + model 引用不变
- replaceFromYaml 好文本 → 重建 model,且后续 save() 以新文本为 base
- saveYaml 两次调用(dry_run→PUT)且用原文本(非表单 model 序列化)
- saveYaml 端口冲突 → conflicts 落值,不发真 PUT

`AppSettingsPage.test.ts` 新增 5 例:
- 切 yaml tab → 编辑器出现且含表单已改内容(img:2)
- 坏 YAML 切回 form 被阻止 + parse-error 红条(含前缀文案)
- 好 YAML 切回 form 成功,表单字段确实是新值
- yaml tab 保存成功 → 跳转 /apps
- yaml tab 保存端口冲突 → 无弹窗,tab 内红条含端口,不跳转

## 验证结果

```
pnpm test -- --run          # 210 files / 1165 tests — 全绿(含新增 11 例)
pnpm exec vue-tsc --noEmit  # 无输出,干净
```

## 改动文件

- `src/apps/composables/useAppSettings.ts`
- `src/apps/composables/useAppSettings.test.ts`
- `src/apps/views/AppSettingsPage.vue`
- `src/apps/views/AppSettingsPage.test.ts`
- `src/i18n/zh_cn.ts`
- `src/i18n/en_us.ts`

（未涉及任何其它文件；`git diff --stat` 与上述清单完全一致。）

## 自查(按 brief 完整性清单)

- [x] 3 个 composable 方法 + parseError 全部实现且有测试覆盖
- [x] tab 双向切换,含解析失败阻断 + 红条
- [x] yaml 保存路径 + 冲突红条(区别于表单弹窗)
- [x] networkMulti 文案更新(zh/en 同步)
- [x] i18n parity(parity.test.ts 随全量测试跑绿)
- [x] 未加任何启发式内容检查
- [x] 新样式全 token,无字面量颜色(`.settings-tabs`/`.settings-yaml-panel`/`.settings-yaml-editor`
  均只用 `var(--...)`)
- [x] 测试输出干净(无 console.warn/error 泄漏到测试输出——saveYaml/save 失败路径的
  `console.warn` 是既有约定,不是本次引入的噪音)

## 遗留/需注意的点(非阻塞,供后续参考)

- `saveYaml` 失败路径会经过 `parseInstallError`,它假设错误形状是 axios 风格
  `{response:{data:{message,data:{ports_in_use}}}}`——与 `save()` 完全一致,沿用既有约定,
  未新增风险面。
- 单提交,信息以 `feat(apps-settings): 设置页 YAML 标签页(表单表达不了的配置逃生口)` 开头,
  commit hash `3112acb`。
