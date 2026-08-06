## Task 0: 对账（不写生产代码）

**Files:**
- Modify: `.superpowers/sdd/progress.md`（追加对账结论）

**Interfaces:**
- Produces: 一份写进台账的对账结论，后续所有任务据此落笔。Task 3/4/5/6/7/8/10/12 都要读它。

**背景：** 本 plan 写于 P2a 执行中（T7 SettingsRail 刚提交、T8–T13 未落地），所以「7 个分区怎么接进壳」「分区组件的既定范式」两处只能留待对账。这个任务把它们钉实。

- [ ] **Step 1: 记录基线**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
git log --oneline -5
pnpm test 2>&1 | tail -5
```

把 sha 与「N files / M tests」记下来，回填本 plan 的 Global Constraints「基线」一行。

- [ ] **Step 2: 读 `SettingsPage.vue`，抄下三件事**

```bash
sed -n '1,80p' src/ai/views/SettingsPage.vue
grep -n "SECTION_COMPONENTS" -A 20 src/ai/views/SettingsPage.vue
grep -n "class=\"agent-app" -A 4 src/ai/views/SettingsPage.vue
```

记录：① `SECTION_COMPONENTS` 的确切类型与写法（是 `Record<SectionId, Component>` 吗？import 是静态还是异步？7 个 P2b 分区当前指向什么）② 根元素最终类名（plan 假定 `agent-app set-app`）③ 分区组件是否收 props。

- [ ] **Step 3: 读一个 P2a 分区当范式样板**

```bash
cat src/ai/components/settings/sections/ModelsSection.vue
cat src/ai/components/settings/sections/PrivacySection.vue
```

记录：`<script setup>` 里 store / toast / i18n / 图标的 import 路径写法（相对路径还是别名）、`sk-section` 结构、错误提示用 `toast.show(msg, 3000, 'danger')` 的确切参数、注释头格式。**本期 7 个分区照这个范式写。**

- [ ] **Step 4: 确认 `sk-modal` / `sk-field` 仍然缺失**

```bash
grep -rn "sk-modal\|sk-field" src/ai/styles/ src/styles/ | head
```

预期：零命中（P2a Task 2 只移植了 6 条 `sk-*` 通用类）。若已有，Task 1 相应缩减。

- [ ] **Step 5: 确认 `settingsStore` 的 blacklist 三件套签名**

```bash
grep -n "blacklist\|Blacklist" src/ai/stores/settingsStore.ts
```

预期：`blacklist: Ref<BlacklistEntry[]>`、`blacklistLoading`、`loadBlacklist()`、`addBlacklist(pattern: string)`、`removeBlacklist(id: string | number)`，且 `BlacklistEntry` 已导出。记下实际名字与类型。

- [ ] **Step 6: 台账追加对账结论并提交**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs(SP8-P2b): Task 0 对账 —— 钉实 SettingsPage 映射表/根元素/分区范式三处接缝"
```

---

