### Task 8: P3 债务收口(i18n 双源统一 + InstallingAppCard 死绑定)

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`、`src/i18n/index.ts`、`src/i18n/parity.test.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/apps/components/InstallingAppCard.vue`

**统一目标(D8)**:每个 locale 文件只剩**一个 `export default` 拍平对象**(删除具名 `export const messages` 嵌套形状);嵌套由 `index.ts` 组装。消费方现状:index.ts 用具名(改),3 个测试文件 + Task 4-6 新测试用 default(不动),parity.test.ts 看它用哪种(改成 default)。

- [ ] **Step 1: 全仓 grep 消费点,确认无第三种用法**

```bash
grep -rn "from '.*i18n/zh_cn'\|from '.*i18n/en_us'\|from './zh_cn'\|from './en_us'" src/ | grep -v node_modules
```

Expected:只有 `src/i18n/index.ts`、`src/i18n/parity.test.ts` 和若干测试文件。若冒出其它消费点,逐个看形状再改。

- [ ] **Step 2: 改造**

`zh_cn.ts`/`en_us.ts`:把 `export const messages = { zh_cn: { …全部键… } }` + 末尾 `export default messages.zh_cn` 改为直接 `export default { …全部键… }`(内容零变化,只脱一层壳;en_us 同理)。

`index.ts`:

```ts
import zh from './zh_cn'
import en from './en_us'
// (其余 createI18n 配置保持原样,messages 改为:)
messages: { zh_cn: zh, en_us: en },
```

`parity.test.ts`:import 改 default,比较 `Object.keys(zh)` 与 `Object.keys(en)`(断言逻辑不变)。

InstallingAppCard.vue 第 11 行 `:class="{ err: task.state === 'error' }"` 整段删掉(样式从未定义 `.err`,错误态视觉由 `.iac-err-text`/`.iac-dismiss` 承担)。

- [ ] **Step 3: 全量回归**

Run: `pnpm test && pnpm exec vue-tsc --noEmit`
Expected: 全绿、tsc 0(i18n 是全局依赖,必须全量跑,不能只跑 i18n 目录)。

- [ ] **Step 4: 提交**

```bash
git add src/i18n/ src/apps/components/InstallingAppCard.vue
git commit -m "refactor(i18n): locale 文件统一为 default 拍平单源;删 InstallingAppCard 死绑定(P3 挂账)"
```

---

## 收官(计划执行完后,主会话做,非 SDD 任务)

- [ ] `pnpm test` 全量 + `pnpm exec vue-tsc --noEmit` + Service `pnpm test`。
- [ ] 主题自查:`git diff master@{start}` 无新增色值字面量。
- [ ] `./scripts/deploy.sh` 部署 `/app/`。
- [ ] 真机验收清单(用户做):
  1. /apps 卡片 ⋮ → 设置 → 表单载入(对照一个真实应用的 compose 字段)。
  2. 改一个端口保存 → toast → 卡片「处理中」→ 容器重建后新端口可访问、「打开」用新端口。
  3. 把端口改成已占用端口(如 80)保存 → 顶部 banner + 冲突行标红,不发起真 PUT。
  4. 使用提示 section 编辑 + 预览 → 保存 → 重进设置页文案还在(x-nimoos.tips.custom 落盘)。
  5. 内存上限留空保存 → YAML 里 limits.memory 消失(curl 复核);填 512 → `512M`。
  6. 多服务应用(如有)tab 切换;WebUI 区只在第一个服务 tab。
  7. 商店详情页(选带 reservations 的应用,如 Jellyfin 类)显示「内存需求」。
  8. 刷新/换语言回归:i18n 统一后中英文均正常、无缺键 console warn。
- [ ] roadmap `docs/vue3-migration-roadmap.md` SP5-P4 行勾选 + 记忆更新(vue3-migration-plan SP5 段)。
- [ ] 台账 `NimoOS-New-UI/.superpowers/sdd/progress-sp5-p4.md` 收尾。

## Self-Review 记录

- spec 覆盖:P4 行四项(表单/applySettings+dry_run/tips 编辑/REQUIRE MEMORY)→ T2-T6/T5-D6/T7;「端口冲突改端口补救」→ D3+T4/T6;P3 挂账三债 → T8 + D8(pinia 项已完成,无操作)。
- 占位符扫描:CAP_OPTIONS 与 InstalledAppCard 菜单测试两处指向 Vue2/既有文件"逐字拷贝/照抄同文件写法",均给了确切文件与行号,属引用非 TBD。
- 类型一致性:`SettingsModel/ServiceModel/PortRow/PairRow` 在 T2 定义,T4/T5/T6 消费处签名一致;`markApplying` T3 定义 T6 消费;`getYaml` T1 定义 T6 消费;conflicts 格式 `"80/tcp"` 由 parseInstallError(既有)产出、PortsEditor(T4)消费,两端格式对齐。
