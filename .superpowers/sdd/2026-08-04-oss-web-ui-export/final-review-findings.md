# 评审终稿 · 修复清单(合并第一稿 + 修订稿,已去重)

评审范围:`cd382d5..6cec8d0`(28 commits)· 评审全程只读,两个源仓 `git status`/`HEAD` 未变
(负向测试走 `/tmp` 下的一次性 `git clone`,临时目录已清理)。

---

## 0. 先回答控制者的问题

> **「发布前必修」做完之后,当前这份产出物能不能交给机主发布?还是 I0 那个结构性缺口也必须先补?**

### **可以发布。I0 维持「不阻塞本次发布」,但有一个硬条件。**

**理由(三条,都基于实测而非推断):**

1. **当前产物的正确性是我直接测出来的,不是从测试覆盖率推断出来的。** 我独立跑完了五道门:
   产出树 `pnpm test` **366 文件 / 3157 例 EXIT=0** · `pnpm build`(含 `vue-tsc --noEmit`)EXIT=0 ·
   `scan-dist` 零命中 · 品牌 grep 零命中 · `oss/` 130 例绿。
   I0 说的是「这些门没被写成自动测试」,不是「这些门没过」。**对这一次发布,人工跑一遍等价于自动跑。**

2. **I0 的风险在「下一次改 manifest 而没人手工跑门」时才兑现。** 台账已预告 sp7/sp8 合流要为
   `src/photos/**`、`src/ai/**` 两个完整功能区大幅扩张清单 —— 那次才是 I0 真正咬人的时候。
   所以它归「合流前必修」。

3. **但修复波本身就是一次 manifest 改动**(新增约 20 条 PATCH + 改 2 个执行器 + 改 2 条已有
   replace payload)。所以 ——

### ⚠️ 硬条件(修复波的验收标准,不可省):

修复波做完后**必须由人工重跑全部五道门 + `--frozen-lockfile`**,且 **`vue-tsc --noEmit` 必须实际执行**。
原因:`vue-tsc` 是唯一能抓到「IDX 7 那一类」错误(PATCH 漏掉导致类型不匹配)的门,而它**不在任何
自动测试里**。命令见 §5。**五门任一不绿,不得交付机主。**

只要这个条件满足,`I0` / `I0-a` / `I0-b` / `I0-c` / `I1` / `I2` / `I8` 全部可以留到合流前。

---

## 1. 发布前必修

### 修理工须知(先读这三条)

- **不能改 `src/**`。** 私有主干是唯一主干。所有对产出树的改动只有三条路:
  1. 往 `oss/manifest.mjs` 的 `PATCH` / `SERVICE_PATCH` 加条目;
  2. 改 `oss/files/` 下 4 个冻结分身之一(`defaultLayout.ts` / `MediaViewer.vue` / `AddPanel.vue` / `README.md`);
  3. 改 `oss/*.mjs` 的执行/编排/守卫逻辑。
- **改 `oss/files/*` 不需要动 `privateSha256`。** 已核实 `oss/apply.mjs:55` 的 `sha256(fs.readFileSync(abs))`
  哈希的是**私有源文件**(`abs`,archive 树里那份),不是 `oss/files/` 里的分身。改分身不触发哈希钉。
- **所有新增 `PATCH` 锚点我已逐条 `grep -c -F` 验过恰好 1 次**,可直接照抄。追加到 `PATCH` 数组
  **末尾**即可(顺序无关:我已确认这些锚点与现有 150 条无区域重叠)。

---

### ① C1 · Critical · 发布仓 lockfile 与 package.json 不一致,外部 CI `pnpm install` 直接失败

**文件:行**
- `oss/export.mjs:85`(要改的那一行)
- `oss/tree.test.mjs:70`(把错值钉住的断言,**必须同步改**)
- `oss/files/README.md:25`(门面文档里的同一串,**必须同步改**)

**现状原文**

`oss/export.mjs:85`:
```js
  const TO = '"@nimotech/nimoos-service": "file:./packages/service"'
```
而 `oss/export.mjs:93` 写 lockfile 时用的是**不带 `./`** 的形式:
```js
    lock.replaceAll('file:../NimoOS-Service', 'file:packages/service')
```
⇒ 产出的 `package.json` 是 `file:./packages/service`,`pnpm-lock.yaml` 的 `specifier:` 是 `file:packages/service`。

**实测后果**
```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with package.json
Note that in CI environments this setting is true by default.
```
- 任何 CI(`CI=true` 时 pnpm 默认开 `--frozen-lockfile`)⇒ 公开仓第一条 workflow 必红。
- 本地裸 `pnpm install` 不报错,但会**静默改写 lockfile** ⇒ 刚 clone 的干净仓库立刻变脏。

**期望改成**

`oss/export.mjs:85` 去掉 `./`:
```js
  const TO = '"@nimotech/nimoos-service": "file:packages/service"'
```

`oss/tree.test.mjs:70`(**同步改,否则测试会红**):
```js
    expect(pkg.dependencies['@nimotech/nimoos-service']).toBe('file:packages/service')
```

`oss/files/README.md:25`(**同步改**):
```
共享包通过 `package.json` 的 `file:packages/service` 链接 —— clone 一个仓库即可开发,
```

**改哪张表 / 哪个文件:** `oss/export.mjs`(1 行)+ `oss/tree.test.mjs`(1 行断言)+ `oss/files/README.md`(1 行)。不动 manifest。

**我跑过的自验命令(修理工可复用)**
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
node oss/export.mjs --out /tmp/lockcheck --no-commit --allow-dirty-oss --skip-guard
cd /tmp/lockcheck && rm -rf node_modules && pnpm install --frozen-lockfile; echo "EXIT=$?"
# 期望 EXIT=0,且:
git -C /tmp/lockcheck status --porcelain 2>/dev/null || diff <(git show :pnpm-lock.yaml 2>/dev/null) pnpm-lock.yaml
# 更直接:装完再比一次 lock,应逐字节不变
```
我实测的修前/修后对照:修前 `ERR_PNPM_OUTDATED_LOCKFILE`;把 `package.json` 改成不带 `./` 后
`pnpm install --frozen-lockfile` EXIT=0 **且装完 lockfile 一字未改**。

---

### ② I3 · Important · `theme.css` 有 5 个 token 的唯一消费方已被删除,孤儿仍随公开仓发布

**背景/为什么要紧**

我用「私有仓孤儿 token 集 vs 产出树孤儿 token 集」求差,得到**恰好 5 个**因剥离而新变孤儿的 token:

| token | 私有仓唯一消费方 | 被谁删掉 |
|---|---|---|
| `--hit-bg` / `--hit-fg` | `src/home/components/SearchDialog.vue:584` `.hit { background: var(--hit-bg); color: var(--hit-fg) }` | DELETE |
| `--brand-shadow` | `src/home/components/SearchDialog.vue`(2 处) | DELETE |
| `--hl-star` | `src/files/viewers/MediaViewer.vue:762` `.ap-hl-star { fill: var(--hl-star) }`(转录高光星标) | T10 REPLACE |
| `--inner-bg-hi` | `src/home/components/widgets/AiWidget.vue` | DELETE |

`--hit-bg: rgba(255,224,138,0.3); --hit-fg: #ffe08a`(黄色高亮对)与 `--hl-star`(金星)在公开仓里
是**搜索结果高亮**与**高光标记**的现成推断材料。而且 `theme.css` 正是 README 花 10 行强调的门面文件。
**词表守卫结构上抓不到它**(token 名不含任何禁词),所以只能靠清单。

**现状原文(共 8 行,每行我已验 `grep -c -F` = 1,整行删除安全)**

`src/styles/theme.css` 的 `:root`(深色)块:
```
  --hit-bg: rgba(255, 224, 138, 0.3); --hit-fg: #ffe08a;
```
```
  --hl-star: #e8c06a;
```
```
  --brand-shadow: 0 12px 30px rgba(120, 150, 255, 0.45);
```
```
  --inner-bg-hi: rgba(255, 255, 255, 0.22);
```
`src/styles/theme.css` 的 `:root[data-theme="light"]`(浅色)块:
```
  --brand-shadow: 0 12px 30px rgba(59, 91, 219, 0.3);
```
```
  --inner-bg-hi: #f0eee8;
```
```
  --hit-bg: #fce8a6; --hit-fg: #5a4a12;
```
```
  --hl-star: #c9992f;
```

**期望改成:** 8 行全部删除(`replace: ''`)。

**注意两点(我已核实)**
- `--hit-bg` 与 `--hit-fg` 在同一行、**两个都是孤儿**,所以整行删是对的,不会牵连保留 token。
- 8 行**都不落在现有 21 条 `theme.css` PATCH(IDX 82-98、134-137)的锚点内**,可独立新增,不撞车。
  尤其:`--hl-star: #e8c06a;` 紧邻的下一行是 IDX 83 锚点的起始行(说话人配色注释),两者不重叠。

**改哪张表:** `oss/manifest.mjs` 的 `PATCH`,新增 **8 条**,形如:
```js
  { path: 'src/styles/theme.css',
    find: '  --hit-bg: rgba(255, 224, 138, 0.3); --hit-fg: #ffe08a;\n', replace: '' },
```
(锚点末尾带 `\n`,才能把整行连换行一起删掉、不留空行。)

**自验命令**
```bash
# 修前:产出树里这 5 个 token 应各有定义、零 var() 消费
cd /tmp/final-rev
for t in hit-bg hit-fg hl-star brand-shadow inner-bg-hi; do
  echo -n "--$t 定义 $(grep -c -- "--$t:" src/styles/theme.css) 处 / var() 消费 "
  grep -rc "var(--$t)" src/ --include='*.vue' --include='*.css' --include='*.ts' | grep -v ':0$' | wc -l
done
# 修后:定义应为 0
```

---

### ③ I4 · Important · 产出树带着一条**恒真测试**,并残留 13 处 strangler / cutover 痕迹

**背景/为什么要紧**

产出树 `src/home/composables/useOpenAction.ts:13` 经 PATCH 后是:
```ts
function cutoverDisabled(): boolean { return false }
```
**没有任何代码读 localStorage**。而产出树 `src/home/composables/useOpenAction.test.ts:44` 仍有:
```js
  it('storage 与 apps 两把 flag 互不干扰', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    ...
```
⇒ 这条用例**永远绿、不可能红**,测的机制已经不存在。两重问题:(a) 公开仓里有一条永真测试,
外部贡献者会照抄这个模式;(b) 它明确命名了「新旧页面并存的可逆 cutover 回退开关」,读者能直接
推断存在一个被绞杀的旧应用。

产出树 `strangler|cutover|绞杀` **共 13 处 / 5 个文件**(我已逐条定位,全部可由 PATCH 覆盖,
没有一处落在 REPLACE 文件里):

| # | 产出树位置 |
|---|---|
| 1 | `src/home/components/HomeDock.test.ts:8` |
| 2 | `src/home/components/GridItem.click.test.ts:7` |
| 3 | `src/home/composables/useOpenAction.test.ts:8` |
| 4-5 | `useOpenAction.test.ts:18-19`(`beforeEach` 的两行 `removeItem`) |
| 6 | `useOpenAction.test.ts:32` `it(... /apps/store(SP5-P8 cutover)'` |
| 7 | `useOpenAction.test.ts:38` `it(... /storage(SP6-P6 cutover)'` |
| 8-9 | `useOpenAction.test.ts:45,50`(恒真用例内部) |
| 10-12 | `useOpenAction.ts:13,24,25`(`cutoverDisabled` 函数名 + 2 个调用点) |
| 13 | `src/files/drop/protocol.ts:2` |

#### ③-A 改 2 条**已有** PATCH 的 `replace` payload(同时解决 #10/#11/#12 与 I5b 的「本版」)

**`oss/manifest.mjs:142-143`(IDX 6)** 现状:
```js
    replace: `// 本版没有需要回退的旧入口,恒 false(保留函数形状以免调用处发散)。
function cutoverDisabled(): boolean { return false }` },
```
**期望改成**(整块删掉,函数在开源版里是死代码):
```js
    replace: '' },
```

**`oss/manifest.mjs:149-150`(IDX 7)** 现状:
```js
    replace: `      if (key === 'appstore' && !cutoverDisabled()) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled()) { router.push('/storage'); return }
      router.push(SYS_ROUTE[key] || '/')
      return`,
```
**期望改成**(去掉恒 false 的守卫):
```js
    replace: `      if (key === 'appstore') { router.push('/apps/store'); return }
      if (key === 'storage') { router.push('/storage'); return }
      router.push(SYS_ROUTE[key] || '/')
      return`,
```

> 这两条 IDX 6 / IDX 7 的 `find` **一个字都不要动**(它们钉的是私有主干原文)。只改 `replace`。

#### ③-B 新增 8 条 PATCH(锚点已逐条验过 = 1 次)

**B1 · 删掉整条恒真用例**(解决 #8/#9;整块出现次数实测 = 1)
```js
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('storage 与 apps 两把 flag 互不干扰', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
`, replace: '' },
```

**B2 · 删掉 `beforeEach` 的两行**(解决 #4/#5)
> ⚠️ **注意:那两行单独取出来在文件里出现 5 次,不唯一。** 必须带上前一行
> `  hrefs = []; opens = []` 才唯一(我实测加长后 = 1 次)。
```js
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  hrefs = []; opens = []
  localStorage.removeItem('strangler:disabled:/apps')
  localStorage.removeItem('strangler:disabled:/storage')
`, replace: `  hrefs = []; opens = []
` },
```

**B3-B5 · 三条 `// P8 cutover:` 注释洗白**(解决 #1/#2/#3)
```js
  { path: 'src/home/components/HomeDock.test.ts',
    find: '// P8 cutover:dock 的 files 图标改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// dock 的 files 图标走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },

  { path: 'src/home/components/GridItem.click.test.ts',
    find: '// P8 cutover:文件夹瓦片改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// 文件夹瓦片走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },

  { path: 'src/home/composables/useOpenAction.test.ts',
    find: '// P8 cutover:文件入口改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// 文件入口走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },
```

**B6-B7 · 两条 `it(` 标题洗白**(解决 #6/#7)
```js
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('appstore 磁贴应用内 router.push /apps/store(SP5-P8 cutover)', () => {",
    replace: "  it('appstore 磁贴应用内 router.push /apps/store', () => {" },

  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('storage 磁贴应用内 router.push /storage(SP6-P6 cutover)', () => {",
    replace: "  it('storage 磁贴应用内 router.push /storage', () => {" },
```

**B8 · `protocol.ts` 注释洗白**(解决 #13)
```js
  { path: 'src/files/drop/protocol.ts',
    find: '// 硬约束:P8 翻 strangler 前新旧页面并存互传,任何形状/数值改动都会破坏兼容。',
    replace: '// 硬约束:该协议用于页面间互传,任何形状/数值改动都会破坏兼容。' },
```

**自验命令**
```bash
node oss/export.mjs --out /tmp/fixcheck --no-commit --allow-dirty-oss
grep -rn "strangler\|cutover\|绞杀" /tmp/fixcheck/src/   # 期望零输出
grep -n "cutoverDisabled" /tmp/fixcheck/src/home/composables/useOpenAction.ts  # 期望零输出
cd /tmp/fixcheck && pnpm install && pnpm test            # 那条用例应已消失,总数 -1
```

---

### ④ I5a · Important · 冻结分身里写着「开源版」—— 等价于宣告「还有一个非开源版」

**文件:行** `oss/files/defaultLayout.ts:3`

**现状原文**
```
// 开源版默认桌面:12 列 × 8 行 = 96 格,占 69 格,上面 6 行填满,最后两行故意留空
```

**期望改成**(去掉版本区分措辞,保留全部信息价值)
```
// 默认桌面:12 列 × 8 行 = 96 格,占 69 格,上面 6 行填满,最后两行故意留空
```

**改哪个文件:** 直接改 `oss/files/defaultLayout.ts`(冻结分身)。**不需要动 `privateSha256`**(理由见「修理工须知」第 2 条)。

**为什么守卫没抓到:** `oss/tree.test.mjs:422` 的固定清单是
`[/Task \d/, /\bSP\d/i, /\bsp[789]\b/i, /spec §/, /本期/, /做样子/, /Vue2/, /NimoOS-UI/]`
—— 「开源版」「本版」都不在里面。而 `defaultLayout.ts` **正是这条断言覆盖的 4 个 REPLACE 文件之一**,
断言跑绿了,却漏掉了整份文件里最直接的那句话。**见下方 ⑤ 一并修守卫。**

> I5b(`本版`)已并入 ③-A 的 IDX 6 修改(整块删除后该措辞自然消失)。

---

### ⑤ I5-guard · Important · 固定禁词清单必须扩容,否则 ④ 这类残留会复发

**文件:行** `oss/tree.test.mjs:422` 与 `:424-430`

**现状原文**
```js
  const FORBIDDEN = [/Task \d/, /\bSP\d/i, /\bsp[789]\b/i, /spec §/, /本期/, /做样子/, /Vue2/, /NimoOS-UI/]

  it('REPLACE 表里每一个冻结分身都不含固定清单里的词', () => {
    for (const { path: rel } of REPLACE) {
      const s = read(rel)
      for (const bad of FORBIDDEN) expect(s, `${rel} :: ${bad}`).not.toMatch(bad)
    }
  })
```

**期望改成两处**

(a) 词表补三条,并把 `NimoOS-UI` 放宽到能抓私有仓名(`NimoOS-New-UI` **不含** `NimoOS-UI` 子串,现在抓不到):
```js
  const FORBIDDEN = [/Task \d/, /\bSP\d/i, /\bsp[789]\b/i, /spec §/, /本期/, /做样子/, /Vue2/,
                     /NimoOS-(New-)?UI/, /开源版?/, /本版/, /社区版/, /strangler/i, /cutover/i]
```

(b) **把断言作用域从「4 个 REPLACE 文件」扩到「全部 PATCH 的 `replace` payload」** —— 现在
PATCH 写进产出树的内容完全不受这条守卫约束(I5b 的「本版」就是这么漏出去的):
```js
  it('PATCH 的 replace 内容也不含固定清单里的词', () => {
    for (const [i, p] of PATCH.entries()) {
      for (const bad of FORBIDDEN) {
        expect(String(p.replace), `PATCH[${i}] ${p.path} :: ${bad}`).not.toMatch(bad)
      }
    }
  })
```
(需要在 `oss/tree.test.mjs:6` 的 import 里加上 `PATCH`。)

> **注意执行顺序:** 加了 `/开源版?/` 与 `/strangler|cutover/i` 之后,④ 与 ③ 必须先改完,否则这两条断言会红 —— 这是有意的,它们就是 ④/③ 的回归保护。

---

### ⑥ I6 · Important · `vite.config.ts` 直接点名 Claude Code,与计划删 `CLAUDE.md` 的理由自相矛盾

**文件:行** `vite.config.ts:63`(私有仓)

**现状原文**(`grep -c -F` = 1)
```
    // Claude Code 的隔离 worktree 会出现在 .claude/worktrees/ 下(含整个仓库副本 + NimoOS-Service 软链),
```
下一行(`:64`)是 `    // 不排除的话 vitest 会递归进去跑别的会话的测试并大片报错。`,
`:65` 是 `    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],`

**为什么要紧:** 计划 E7 删 `CLAUDE.md` 的理由原文是「**它是全仓最直白的『AI 辅助开发』标记**」。
删掉了那个文件,却没搜一遍其他 `.claude`/`Claude` 引用。

**期望改成**(保留 exclude 的功能与理由,去掉工具名)
```
    // 本机可能存在 .claude/ 等工具目录(含整个仓库副本),
```
`:65` 的 `exclude` 数组**保留原样**(`.claude/**` 作为一个被排除的目录名本身无害,删掉反而会让本地开发踩坑)。

**改哪张表:** `oss/manifest.mjs` 的 `PATCH` 新增 1 条:
```js
  { path: 'vite.config.ts',
    find: '    // Claude Code 的隔离 worktree 会出现在 .claude/worktrees/ 下(含整个仓库副本 + NimoOS-Service 软链),',
    replace: '    // 本机可能存在 .claude/ 等工具目录(含整个仓库副本),' },
```

**顺带(同一文件,可选但建议同批):** `vite.config.ts:38` 还留着 `file:../NimoOS-Service` 的注释,
与实际发布的 `file:packages/service` 结构矛盾,会让外部开发者困惑。修理工可 `sed -n '36,40p' vite.config.ts`
取原文后加一条 PATCH。

---

### ⑦ I7a · Important · 注释里泄露内部 SDD 台账路径与债务编号

**文件:行** `src/settings/util/ifaceForm.ts:7`(私有仓)

**现状原文**(`grep -c -F` = 1)
```
// → 写路径的正确性只能靠这里的单测(见台账 .superpowers/sdd/sp9/03-p2.md 债务 D18)。
```

**为什么要紧:** 直接给出内部 SDD 工作流的目录结构 + 债务编号,是最具体的一类内部痕迹。

**期望改成**
```
// → 写路径的正确性只能靠这里的单测(该接口没有安全的真机验证途径)。
```

**改哪张表:** `oss/manifest.mjs` 的 `PATCH` 新增 1 条。

> **本条只修这一处。** 另外 17 处悬空文档引用(`docs/THEMING.md` ×4、`CLAUDE.md` ×2、
> `vue3-migration-roadmap.md`、`task-N-report.md` 等)归 §3 Minor —— 它们是「指向不存在文件」的
> 坏文档,不泄露内部结构。

---

### ⑧ M1 · Important(定性 Minor,但位置最显眼) · `package.json` 的 `name` 是私有仓名

**文件:行** `package.json:2`(私有仓)

**现状原文**(`grep -c -F` = 1)
```
  "name": "nimoos-new-ui",
```

**为什么要紧:** 发布仓叫 **NimoOS-Web**,而 `package.json` 的 `name` 是公开仓最显眼的身份字段。
`new-ui` 三个字暗示存在一个 old UI。

**期望改成**
```
  "name": "nimoos-web",
```

**改哪张表:** `oss/manifest.mjs` 的 `PATCH` 新增 1 条:
```js
  { path: 'package.json',
    find: '  "name": "nimoos-new-ui",', replace: '  "name": "nimoos-web",' },
```

> ⚠️ **不要用 PATCH 去动 `package.json` 里 `@nimotech/nimoos-service` 那一行** —— 那一行由
> `oss/export.mjs:84-87` 的 Step 4 独占(PATCH 在 Step 4 之前跑,抢了会让 Step 4 的锚点检查报「未唯一命中」)。
> 改 `name` 与那一行无关,安全。

---

### ⑨ M2 · Important(同上) · `scripts/deploy.sh` 注释里写着私有仓名

**文件:行** `scripts/deploy.sh:2`(私有仓)

**现状原文**(`grep -c -F` = 1)
```
# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。
```

**期望改成**
```
# 构建本项目并部署到 Gateway 的 /app/ 静态目录。
```

**改哪张表:** `oss/manifest.mjs` 的 `PATCH` 新增 1 条。

---

### ⑩ I9 · Important · `oss/` 没有 runbook,唯一的决策记录被 gitignore

**现状**
- `oss/` 下 8 个 `.mjs`,**零 `.md`**。
- 计划与 spec 在 `docs/superpowers/` 下,**已被 git 跟踪**(我实测 `git ls-files` 命中),幸存 ——
  但那是 2334 行的逐任务实施计划,不是运维手册。
- **本台账 `progress.md` 被 `.gitignore:6` 的 `.superpowers/` 排除,不进 git。**
  我实测 `git check-ignore -v` 确认。所有裁定、挂账、勘误理由随工作树消失。
  记忆里已有 SP7 那次 `.superpowers` 整目录蒸发、git 救不回来的先例。

**期望:新建 `oss/README.md`,至少含 6 节**
1. 六步流程 + **五道门的确切命令**(含 `pnpm install --frozen-lockfile`,见 §5)
2. 四个 flag(`--out` / `--skip-guard` / `--no-commit` / `--keep-temp` / `--allow-dirty-oss`)各自用途,
   以及**正式出包一律不带 `--skip-guard` 与 `--allow-dirty-oss`**
3. 三条决策树:锚点漂了怎么办 / 哈希钉响了怎么办 / 守卫误报怎么办
4. 两条铁律:**禁止放宽词表**(误报只能加精确白名单)· **禁止删哈希钉**
5. **发布路径必须写明:走 `git push`,不是打包目录**
   —— 理由见 §3 的 M7(`.export-report.txt` 与空 `public/demo/` 只在打包发布时才会漏出)
6. E10 预告:sp7/sp8 合流后清单必须为 `src/photos/**`、`src/ai/**` 扩张,那是一次独立工作

**顺带强烈建议:** 把本台账目录从 `.gitignore` 里破例放行(或复制一份到 `docs/superpowers/`),
否则这套要活过 sp7/sp8 合流的机制,其全部设计理由都是一次 `rm -rf` 的距离。

---

### 发布前必修合计:**10 条**

| 条目 | 严重度 | 改动落点 | 新增 PATCH 条数 |
|---|---|---|---|
| ① C1 lockfile | **Critical** | `export.mjs` 1 行 + `tree.test.mjs` 1 断言 + `files/README.md` 1 行 | 0 |
| ② I3 孤儿 token | Important | `manifest.mjs` | **8** |
| ③ I4 strangler / 恒真用例 | Important | `manifest.mjs`(改 2 条已有 `replace` + 新增 8 条) | **8** |
| ④ I5a 开源版 | Important | `oss/files/defaultLayout.ts` 1 行 | 0 |
| ⑤ I5-guard 守卫清单扩容 | Important | `tree.test.mjs`(词表 + 新增 1 条断言) | 0 |
| ⑥ I6 Claude Code | Important | `manifest.mjs` | **1**(+1 可选) |
| ⑦ I7a `.superpowers/` 路径 | Important | `manifest.mjs` | **1** |
| ⑧ M1 package.json name | Important | `manifest.mjs` | **1** |
| ⑨ M2 deploy.sh | Important | `manifest.mjs` | **1** |
| ⑩ I9 runbook | Important | 新建 `oss/README.md` | 0 |

**PATCH 总数预期:150 → 170。** 修完记得 `oss/export.mjs` 的第 3 步横幅会显示 `PATCH 170`。

---

## 2. 合流前必修(本次**不阻塞发布**)

> 这一批的共同点:它们防的是**未来某次改动的静默失效**,而本次发布的正确性已由人工五道门直接测出。
> 全部建议在 **sp7/sp8 合流开工前**做完 —— 那次要为两个完整功能区扩张清单,是这套机制最危险的一刻。

### ⑪ I0 · Important · 产出树的类型检查/测试/装依赖从不自动跑 —— 150 条 PATCH 里 5 条可摘掉而 130 例全绿

**实测证据**
```bash
grep -c "vue-tsc\|vitest run\|pnpm install\|pnpm exec" oss/*.test.mjs   # 6 个文件全部 0
```
150 条 PATCH 逐条摘除变异的结果,5 条 NOT-DETECTED:

| 摘掉的 PATCH | 产出树会变成什么 | 130 例 |
|---|---|---|
| **IDX 7 `useOpenAction.ts`** | `cutoverDisabled(): boolean`(0 参)与 `cutoverDisabled('/apps')`(1 参)并存 ⇒ **`vue-tsc` 必红**;且 `window.location.href = SYS_ROUTE[key] \|\| '/#/legacy'` ⇒ 把用户送去开源版**不存在**的旧应用 | **全绿** |
| IDX 99/100/101 `useOpenAction.test.ts` | 三条陈旧用例留在产物里,与已改成 `router.push` 的实现矛盾 ⇒ **外部用户一跑 `pnpm test` 必红** | **全绿** |
| IDX 110 `tabs.test.ts` | 残留未使用的 `railTabsFor` import(`tree.test.mjs:497` 查的是 `/railTabsFor\(/`,带括号,漏掉裸 import 行) | 全绿 |

另有 **20 条 PATCH 的唯一守门人是「泄漏守卫」那一条弱断言**(`theme.css` 5 条 + `systemApps.ts` 2 条
+ `StartAppDialog.vue` / `GridItem.vue` / `MobileHome.vue` / `dropEntries.ts` / `Files.vue` + 7 个 `*.test.ts`)。

**期望改成:** 在 `oss/tree.test.mjs` 加一条 `it('产出树自身类型检查通过', ...)`,对临时导出树跑
`pnpm exec vue-tsc --noEmit`(可复用宿主 `node_modules`,或缓存一份 install)。这一条同时关掉
IDX 7/99/100/101 四个盲区,是本清单**单项杠杆最高**的改动。

**改哪个文件:** `oss/tree.test.mjs`。

### ⑫ I0-a · Important · 泄漏守卫的 fatal 路径**零测试** —— 项目最核心的那个 `throw` 没有负例

**文件:行** `oss/tree.test.mjs:535-547`

**现状原文**
```js
      const out = execFileSync('node', [path.join(OSS, 'export.mjs'), '--out', guardOut,
        '--no-commit', '--allow-dirty-oss'],
        { encoding: 'utf8', stdio: 'pipe' })
      expect(out).toContain('零真实泄漏命中')
```
只断言**成功横幅**。把 `oss/export.mjs:140` 的 `if (leaks.length) {` 改成 `if (false) {` → 130/130 全绿;
`oss/export.mjs:132` 的「预期外跳过 fatal」同理。它现在能抓到 REPLACE/PATCH 回退,靠的是
「导出 abort 让 `execFileSync` 抛异常」这个副作用,**不是断言在验判定结果**。

**期望改成:** 补一条负例 —— 我这次评审跑的端到端测试就是缺的那条:
```bash
# 我实测过的做法(A/B 对照,证明它有判别力):
rm -rf /tmp/negtest && mkdir -p /tmp/negtest
git clone -q --no-hardlinks /home/nimo/NimoTech/NimoOS-New-UI /tmp/negtest/NimoOS-New-UI
ln -s /home/nimo/NimoTech/NimoOS-Service /tmp/negtest/NimoOS-Service
cd /tmp/negtest/NimoOS-New-UI
# 往一个保留文件的注释里注入一句禁词并提交
python3 -c "p='src/files/util/protect.ts';s=open(p).read();open(p,'w').write('// TODO: 以后要把这里接回相册磁贴的保护路径\n'+s)"
git add -A && git -c user.email=r@r -c user.name=r commit -q -m inject
node oss/export.mjs --out /tmp/negtest/out --no-commit
# 实测:EXIT=1,stderr 含 "✗ src/files/util/protect.ts:1 [相册]",且 /tmp/negtest/out 未被创建
```
**同时给 `oss/scan-dist.mjs` 补 exit 0/1/2 三条** —— 该文件目前**整体零测试**,且它与
`oss/export.mjs:118-145` 是同一段分流逻辑的第二份手抄,两份都没有负例。

### ⑬ I0-b · Important · 两条「回归测试」断在自己抄的副本上,不是生效载体

**(a) `oss/tree.test.mjs:422` vs `:434`**
```js
  const FORBIDDEN = [/Task \d/, /\bSP\d/i, ...]      // :422 真正被使用的
  ...
  it('/\bSP\d/i 词边界:wasp7/grasp789 不误伤,真实 SP9/sp7 仍然命中', () => {
    const SP_DIGIT = /\bSP\d/i                        // :434 测试体内另抄一份
```
把 `:422` 整个换成 `[/ZZZNEVERMATCH/]` → 58/58 全绿。**T14-B4 修的正是 `\b` 缺失,而它的「回归测试」
测不出 `\b` 被删掉。** 与本项目栽过的 noVNC `scaleViewport` 同一类。
**期望:** `:434` 改成 `const SP_DIGIT = FORBIDDEN[1]`(或按名字查找),不再重抄。

**(b) `oss/forbidden.test.mjs:289`**
```js
    expect(rows.length, '13 条白名单,一条不能漏自查').toBe(13)
```
`rows` 是测试文件里**手写**的表,不是从 `SOFT` 推导的。给 `forbidden.mjs` 的 `转录` 词条追加第 4 条
白名单(哪怕是整文件开洞的宽白名单)→ 130/130 全绿。这条自称「一条不能漏自查」的断言,
**在新增白名单时不会红**。
**期望:** 改成从 `SOFT` 推导,例如
`expect(rows.length).toBe(SOFT.filter(s => ['转录','照片','搜索'].includes(s.word)).flatMap(s => s.allow).length)`,
并断言 `rows` 覆盖到每一条 allow。

> 相关数据(供合流前排期参考):`SOFT` 共 121 条白名单,只有中文三词那 13 条 + T14 抽查约 10 条
> 有「合法原文放行 / 同行加泄漏必命中」双向自查,**剩余约 98 条(photo 52 / gallery 24 / search 24)零自查**。
> 逐条补成本过高,建议靠上面这条「从 SOFT 推导」的机制约束强制新增即自查。

### ⑭ I0-c · Important · 提交块(含**零历史自检**)从没跑过

**文件:行** `oss/export.mjs:182-202`

**实测:** 4 个导出调用点(`tree.test.mjs` ×2、`media-wave.test.mjs` ×1、`export-rsync.test.mjs` ×1)
**全部带 `--no-commit`**。所以 `.gitignore` 检查、`git init`、`--amend`、以及
`rev-list --count HEAD !== 1` 这条「零历史被破坏」自检,整块零覆盖。
它恰好是 Global Constraints 里唯一的硬不变式(`rev-list` 恒等于 1)。

**期望:** 补一条**不带** `--no-commit` 的用例(导到临时目录,断言 `rev-list --count HEAD === '1'`、
`git remote -v` 为空、`.export-report.txt` 未被跟踪),并补一条负例(临时把产出树 `.gitignore` 里
`.export-report.txt` 那行摘掉 → 期望 exit 1)。

### ⑮ I1 · Important · 泄漏守卫按行扫描 → 手工折行的中文禁词**整条流水线静默放过**

**文件:行** `oss/forbidden.mjs:439-454`(`scanText` 先 `text.split('\n')` 再逐行 `re.test`;`:441` 是那一行)

**端到端实测(A/B,同一句话)**

| 注入到 `src/files/util/protect.ts` 的注释 | 导出结果 |
|---|---|
| `// TODO: 以后要把这里接回相`<br>`// 册磁贴的保护路径` | **EXIT=0,零命中,字节已落盘** |
| `// TODO: 以后要把这里接回相册磁贴的保护路径` | EXIT=1,`[相册]` 被抓 |

`说话人`、`转录` 折行同样静默放过。

**为什么要紧:** 本库注释**全中文且手工折行**,折行点在任意列。这不是理论风险 —— 产出树里就有现成的
中途折断:`src/apps/util/systemApp.ts` 的 `幕后组件(供其他应用使用的\n *  内部服务容器)`。
计划自己写着「注释是本次最大的泄漏面」(计划第 222 行),但它规定的实现是逐行正则,**这两句在设计上矛盾**。

**期望改成:** 在 `scanText` 里加一次「折行归一」二次扫描 —— 把 `\n\s*(//|\*|#)?\s*` 折叠成空串后
再跑一遍词表,命中时报折行起始行号。约 8 行。**不动词表、不动白名单**(`exactLine` 白名单只作用于
原始行;归一行的命中一律报,方向安全)。复现命令见 ⑫。

### ⑯ I2 · Important · `applyPatch` 不校验 `replace` 字段 → 字段名拼错会把字面量 `"undefined"` 静默写进产品源码

**文件:行** `oss/apply.mjs:74`(解构处)· `oss/apply.mjs:80-83`(已有的 `find` 校验)· `oss/apply.mjs:103`(写入处)

**现状:** T14/B3 给 `find` 补了设计过的诊断(`:80-83`),但它的孪生字段 `replace` 没有。**实测:**
```
path 拼错        ✅ 抛错(原生 TypeError,响但文案粗糙)
replace 拼错     ✗ 无异常 → 文件内容: "undefined\n"
replace 为 null   ✗ 无异常 → 文件内容: "null\n"
replace 为数字 0   ✗ 无异常 → 文件内容: "0\n"
```

**为什么要紧:** `PATCH` 里 **48 条**是 `replace: ''`(纯删除)—— 正是最容易把字段名敲错的形状。
而 **35 条锚点落在注释里**:注入到注释中的 `undefined` 既不被词表抓到(不是禁词),也不被
`vue-tsc`/`vite build` 拦住,**五道门全绿,悄悄发出去**。这与 T4 修掉的「空 `find` 巧合合法」是同一
形态的哑火,只是换了个字段。

**期望改成**(紧接现有 `find` 校验之后):
```js
    if (typeof replace !== 'string') {
      throw new Error(`PATCH ${rel} 的 replace 不是字符串(replace=${JSON.stringify(replace)})—— ` +
        `manifest 里这条数据有问题:字段名可能拼错;纯删除请显式写 replace: ''`)
    }
```

**自验命令**
```bash
cd $(mktemp -d) && printf '// 这是一段注释 keepme\n' > f.ts && node -e "
import('/home/nimo/NimoTech/NimoOS-New-UI/oss/apply.mjs').then(m=>{
  try { m.applyPatch(process.cwd(), [{ path:'f.ts', find:'keepme', replase:'' }])
        console.log('✗ 未抛错,文件变成:', require('fs').readFileSync('f.ts','utf8')) }
  catch(e){ console.log('✅ 抛错:', e.message.split('\n')[0]) } })"
```

### ⑰ I8 · Important · `scanDist` 的 `DIST_ALLOW` 挖空法存在**重叠绕过**

**文件:行** `oss/forbidden.mjs:670`(挖空那一行)· `oss/forbidden.mjs:581-584`(`DIST_ALLOW` 定义)

**现状原文**
```js
        for (const allow of DIST_ALLOW) {
          if (scanLine.includes(allow)) scanLine = scanLine.split(allow).join(' '.repeat(allow.length))
        }
```
「挖空」会把与 allow 字面量**共享字符**的真禁词一起吃掉。**实测:**

| 构造内容 | 结果 |
|---|---|
| `x="语义搜索应用…"` | **✗ 放过** ——`搜索应用…` 被挖空,`语义搜索` 哨兵随之消失 |
| `x="上传照片库、个人 NAS、启动卷"` | ✗ 放过 |
| `x="搜索应用…打开相册"`(纯拼接) | ✅ 抓到 `相册` |

`oss/dist-scan.test.mjs:70` 那条「★ 关键用例」测的是**拼接**,**没测重叠** —— 所以这个洞在测试覆盖之外。

**期望改成:** 不改写字符串,改成**按匹配区间的包含关系抑制** —— 先在原始行上收集所有词表命中
(带 index),只有当某次命中的 `[start, end)` **完整落在**某个 allow 字面量出现区间之内时才抑制它。

**我实测过的修法验证结果**(两条合法内容照样放行,重叠泄漏正确抓到):
```
合法 RAID 用途说明   → 放行 ✅
合法 商店占位符      → 放行 ✅
语义搜索应用…        → 命中 语义搜索 ✅（修前放过）
搜索应用…打开相册     → 命中 相册 ✅
同行 合法+真泄漏      → 命中 转录 ✅
```
**并请同时给 `oss/dist-scan.test.mjs` 补一条「重叠」用例**(现在只有「拼接」)。

### ⑱ M12 · Minor→建议顺手修 · `assertSafeRelPath` 放行 `abs === base`,`'.'` 会静默删空整棵目标树

**文件:行** `oss/apply.mjs:31`

**现状原文**
```js
  if (abs !== base && !abs.startsWith(base + path.sep)) {
```

**实测:** `applyDelete(root, '.')`、`applyDelete(root, 'src/..')`、`applyDelete(root, '')`
**三种写法都不抛错、把整棵目标树删光**(`fs.existsSync(root)` 变 `false`)。

**为什么值得修:** 爆炸半径限于 `git archive` 的临时树(后续 REPLACE 会因「目标不存在」而响),
所以不是 Critical;但 T4 那轮专门花了 5 行做穿越防护、结论是「属破坏性风险,值得现在修」,
留着这个口子与那个结论不一致。**manifest 里没有任何条目该指向根。**

**期望改成**(去掉 `abs !== base &&`)
```js
  if (!abs.startsWith(base + path.sep)) {
```
并把错误文案补一句「不允许指向目标树根本身」。**同时补 3 条测试**(`'.'` / `''` / `'src/..'` 都应抛)。

### ⑲ M13/M14/M15 · Minor→建议同批 · 若干 `throw` 与分支零测试

- **`oss/apply.mjs:54`(`REPLACE 目标不存在`)与 `:85`(`PATCH 目标不存在`)两条 `throw` 无测试** ——
  删掉后 21/21 全绿(退化成原生 ENOENT)。补 2 条用例。
- **`oss/forbidden.mjs` 的 `scanTree` 有 4 条分支零测试:** `dist` 目录排除(`:500`)、
  `statSync` 失败(`:507`)、`size > MAX_BYTES`(`:512`,改成 `Infinity` 后测试仍绿)、
  `readFileSync` 失败(`:519`,只测了不可读**目录**、没测不可读**文件**)。
  `scanDist` 的 symlink 分支(`:629`)同样零测试,而 `oss/dist-scan.test.mjs:117` 的 describe 标题
  却写着「二进制/**符号链接**仍然留痕跳过」—— **标题超卖**。
- **`oss/forbidden.test.mjs:475` / `:436` 只断言「有 `__skipped__`」,不断言分类文案。**
  T14-B2 的设计意图是「`scanTree` 写的文案 == `isExpectedSkip` 认的文案」(注释自称「双重锁定」),
  但把 `SKIP_REASON_SYMLINK` 换成顿号变逗号的内联字面量 → 全绿(两仓 tracked symlink 数为 0,
  真机跑不到该分支)。**修法:** 加 `expect(isExpectedSkip(f.excerpt)).toBe(true)`。

### ⑳ 差集断言模式(强烈建议) · 一条机制同时防住计划的 P4/P5/P6 三类缺陷

在 `oss/tree.test.mjs` 加一组断言:**「产出树的孤儿集必须 ⊆ 私有仓的孤儿集」**,覆盖四个维度:
孤儿 theme token · 孤儿导出符号 · 悬空文件引用 · 无生产消费方的测试。

这样未来所有新增删除**自动受守**,不再依赖人工清单完备性 —— ②(I3,漏 5 个 token)与
③(I4,漏一条测试)本质上都是「该用机械扫描的地方用了手工清单」。

**我实测用的 token 版检测器**(可直接改造成断言):
```bash
node -e "
const fs=require('fs'),cp=require('child_process')
function orphans(root){
  const defs=new Set()
  for(const f of ['src/styles/theme.css','src/styles/theme.sp9.css']){
    const p=root+'/'+f; if(!fs.existsSync(p))continue
    for(const m of fs.readFileSync(p,'utf8').matchAll(/^\s*(--[\w-]+)\s*:/gm)) defs.add(m[1])
  }
  const all=cp.execSync('grep -rho \"var(--[a-zA-Z0-9-]*\" src --include=*.vue --include=*.css --include=*.ts || true',{encoding:'utf8',cwd:root})
  const used=new Set([...all.matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]))
  return new Set([...defs].filter(d=>!used.has(d)))
}
const priv=orphans('/home/nimo/NimoTech/NimoOS-New-UI'), oss=orphans('/tmp/final-rev')
console.log('导出后新变孤儿:', [...oss].filter(t=>!priv.has(t)).join(' ') || '(无)')
"
# 修 ② 之前实测输出:--hit-bg --hl-star --brand-shadow --inner-bg-hi
# 修 ② 之后应为:(无)
```

---

## 3. 可留的 Minor(不必本次动,已核实性质)

| # | 位置 | 问题 | 备注 |
|---|---|---|---|
| M3 | `oss/forbidden.mjs:19` | HARD 只钉 `192.168.1.115`,而产出树另一个真机 IP **`192.168.1.143` 出现 19 次**(`src/settings/panels/network/NetworkPanel.integration.test.ts` 等)。按项目自己的标准不一致 | 网络面板 fixture 用示例 IP 本身合理;建议改文档用段 `203.0.113.x` 或显式登记。**不要**把词表放宽成 `/192\.168\./`,会误伤网络面板正常代码 |
| M4 | `src/apps/stores/installedApps.test.ts:57` | 唯一非 AppStore 的容器 fixture 名是 `nimoos-agent`,而它所在测试正是「隐藏内部服务容器」 | 改个名即可 |
| M5 | `src/styles/theme.css:75` | `  --wave-none: var(--fg-subtle);   /* 波形:静场/无人声竖条 */` —— 「无人声」只在按人声着色的波形里才有意义,且与唯一消费方 `MediaViewer.vue:352` 的「未播=静场淡色」矛盾 | 锚点已验 `grep -c -F` = 1,**不在现有 theme.css 锚点内**(IDX 83 的锚点到 `--spk-5` 行就结束)。既然 ② 已经要动 theme.css,可顺手加一条 PATCH 把注释改成 `/* 波形:静场竖条 */` |
| M6 | `src/settings/util/tabs.ts:5` | `spec §4.1 写「rail 9 项」…与源码不符` —— 引用内部 spec 且给出可做减法的数字(实发 6 项) | `spec §` 在固定清单里,但该清单不覆盖 PATCH 文件 —— 修了 ⑤(b) 之后这条会自动亮 |
| M7 | 交付仓工作树 | `public/demo/`(空目录)+ `.export-report.txt`(含两个私有 commit hash) | **按计划的 `git push` 路径,两者都不会寄出** —— 我实测 `git ls-files \| grep export-report` = 0、`git check-ignore` 命中 `.gitignore:20`、`public/` 只提交了 `widget-kit.css`(git 不跟踪空目录)。**只在改成打包目录发布时才漏**,所以写进 ⑩ 的 runbook 即可,不必改代码 |
| M8 | `oss/apply.mjs:25-38` | `path` 字段拼错时抛原生 `The "path" argument must be of type string`,不是设计过的诊断 | 会响,只是文案与项目风格不一致 |
| M9 | `oss/forbidden.mjs:500` | 目录级排除(`.git`/`node_modules`/`dist`)不留 `__skipped__` 痕迹 | 前两个无妨;`dist` 是按名字排除,源码树真出现叫 `dist` 的目录会静默跳过 |
| M10 | `oss/media-wave.test.mjs:33` | 临时目录 `oss/.tmp-media-wave-test` 未进 `.gitignore` | 1 行。残留时正式出包会在 1/6 前置检查中止(**报得响,不是假绿**,只是白撞一次) |
| M11 | 产出树文件名 | `theme.sp9.css` / `theme.sp9.test.ts` / `zh_cn.sp9.ts` / `en_us.sp9.ts` / `Home.p4b.test.ts` —— 内部期号进了**文件名**,比注释可见得多 | 属已裁定的范围外大类;若以后独立开一期洗期号,建议**优先处理文件名** |
| M16 | `oss/tree.test.mjs:367` / `:395` | 行数断言余量失衡:AddPanel 断 `≤ 490`,**实测 489,余量 1 行**(往冻结分身加一行注释就假红);MediaViewer 断 `< 600`,**实测 361,余量 239 行**(把整个 Ask 面板搬回来还是绿) | 两条在真正的内容断言(`:373`/`:385`)之外无增量价值,建议删或给余量 |
| M17 | `oss/tree.test.mjs:82` | `toHaveLength(5)` 数的是 `{ key: '` 这个**排版形状**,私有侧换行或多一个空格就假红 | |
| M18 | `oss/tree.test.mjs:94` / `:486-490` | 两处黑名单缺 `strangler` 与 `#/legacy` —— 这正是 IDX 7/99/100/101 四条盲区的直接原因 | 修 ⑤ 的词表时一并补 |
| I7b | 17 处悬空文档引用 | `docs/THEMING.md`(`src/styles/theme.css:51,178,304`、`color-guard.test.ts:1`)· `CLAUDE.md`(`src/settings/styles/settings.css:4,241`)· `vue3-migration-roadmap.md`(`src/storage/util/storageMap.ts:147`)· `task-N-report.md`(`src/kvm/**`) | 「指向不存在文件」的**坏文档**,不泄露内部结构。但 `theme.css` 指向不存在的 `docs/THEMING.md` 对外部贡献者有实质损害(README 花 10 行强调那条硬约束、却把权威参考指向空气),建议下一轮修 |

**已完成、无需再动的挂账**(我逐条核实过):README Node `≥ 20.19`(`oss/files/README.md:30` 已写并附
vite 7 engines 原文)· `\bSP\d` 词边界(`oss/tree.test.mjs:422` 已是 `/\bSP\d/i`)·
`settingsFpIntro` 英文 `smart` 盲区(该键随 `en_us.sp9.ts` 的 SP9-P4 整块删除自然消解;产出树
`\bsmart\b` 10 处**全部**是硬盘 S.M.A.R.T.)· `album` 产出树 0 命中 · `artplayer theme` 注释已补 ·
`assertSafeRelPath` 不解析符号链接(两仓 tracked symlink 数 = 0,`git archive | tar -x` 不产生符号链接,裁定成立)。

**三条真机项维持可留:** 波形竖条像素级颜色(已有 `oss/media-wave.test.mjs` 三层链路断言 + 变异
证明有判别力,`--wave-none` 两套主题都有值)· 账号 tab 成员文件夹授权入口(需真实多用户数据)·
KVM 向导弹层双主题(非本项目引入)。

---

## 4. 计划本身的问题(P1-P11)—— 供写回计划与 spec

计划:`docs/superpowers/plans/2026-08-04-oss-web-ui-export.md`
spec:`docs/superpowers/specs/2026-08-03-oss-web-ui-export-design.md`

| # | 计划/spec 位置 | 问题 | 实现是否忠实执行了错的计划 | 对应发现 |
|---|---|---|---|---|
| **P1** | **计划第 860 行** `const TO = '"@nimotech/nimoos-service": "file:./packages/service"'` **vs 第 868 行** `replaceAll('file:../NimoOS-Service', 'file:packages/service')` | **两行自相矛盾**(一个带 `./`、一个不带)。更糟:**第 716 行**把测试断言写成 `expect(pkg.dependencies[...]).toBe('file:./packages/service')` —— **一条测试把 bug 钉住了**,于是「测试全绿」成了错值的证据 | ✅ 逐字照抄 | **C1** |
| **P2** | **计划第 2190 行**(T15 Step 2)用裸 `pnpm install` | 计划自己的**风险表**里写着「lockfile 路径改写不被 pnpm 接受 → 表现:T15 Step 2 的 `pnpm install` 失败」。**风险识别对了,检测信号选错了** —— 非 frozen 模式下 pnpm 不失败,而是**静默修好 lock**,门因此永绿。第五道门也帮不上(它扫 `dist`,不装依赖) | ✅ 无人跑 `--frozen-lockfile` | **C1** |
| **P3** | **计划第 222 行**「扫描范围是产出树**全部**文本文件…**以及注释**(注释是本次最大的泄漏面)」+ T3 规定的逐行正则实现 | 本库注释**全中文、手工折行** —— 这两句**在设计上互相矛盾**,计划从未讨论过折行 | ✅ | **I1** |
| **P4** | **计划 E11**(第 51 行 / T8 第 1348、1435 行) | theme.css 的待删 token 清单是**手工枚举**的(`--spk-1..5` / `--wave-dim` / `--orb-core` / `--orb-glow` / `@keyframes pulse`),从来没有「哪些 token 失去最后一个消费方」的机械步骤 | ✅ | **I3**(漏 5 个) |
| **P5** | **计划 T13**(第 1944 行「删 9 个 + 抠约 15 个里的用例」) | 删测清单是**手工列**的,没有「凡被 PATCH 掏空的函数,其测试必须一并处理」这条规则 | ✅ | **I4**(漏 `useOpenAction` 的 cutover 用例) |
| **P6** | **计划 T5 的 DELETE 表**(第 751 行起,含 `docs`、`CLAUDE.md`) | **DELETE 一个文件从来没有配套的「删掉指向它的引用」步骤** | ✅ | **I7a + I7b**(18 处悬空) |
| **P7** | **计划 E7**(第 47 行) | 删 `CLAUDE.md` 的理由是「全仓最直白的 AI 辅助开发标记」,但**没搜其他 `.claude`/`Claude` 引用** | ✅ | **I6** |
| **P8** | **计划 T11 的固定禁词清单**(对应 `oss/tree.test.mjs:422`) | (a) 只作用于 4 个 REPLACE 文件,**不覆盖 PATCH 的 `replace` payload`**;(b) 词表缺「开源版 / 本版」;(c) `/NimoOS-UI/` 抓不到私有仓名 `NimoOS-New-UI`(不含该子串) | ✅ | **I5a / I5b / M1 / M2 / M6** |
| **P9** | **计划 T13** 的产出树测试数估算「约 327」 | 实际 **366** —— 计划把 352 当整棵产出树的基线,**漏算内嵌 Service 包自己的 26 个测试**(341 + 25 = 366) | — | (已知) |
| **P10** | **计划 T15 整节**(第 2164-2282 行) | **把「四/五道门」定位成 T15 的手工检查清单,而不是 T5 该写的测试。** 于是 `oss/export.mjs` 的 9 条护栏里 **7 条从未被测**,产出树的可用性从未被自动验证。**这是 C1、I0、I0-a、I0-c 的共同上游** —— 也是为什么一个「测试驱动、每任务先红后绿」的项目最终交付了一个装不上的 lockfile | ✅ | **I0 / I0-a / I0-c / C1** |
| **P11** | **计划 T3/T4 给的 `assertSafeRelPath` 示例代码**(T4 在第 439 行起) | 只考虑「往外穿越」,**没考虑「指向根本身」**。`abs === base` 的放行在示例代码里就有,T4 那轮复审也只验了穿越方向 | ✅ | **M12** |

### 写回建议的措辞要点

- **P1/P2/P10 是同一根问题的三个切面**,建议在计划里合并成一条勘误:
  「**凡『产出物必须能被消费』的属性(装得上、编得过、测得过),必须写成 `oss/` 里的自动测试,
  不能留在 T15 的手工清单里。** 手工清单只能跑一次,而清单会在下一次改动时失效。」
- **P4/P5/P6 是同一类错误**(该用机械扫描处用了手工清单),建议合并成一条:
  「**凡『删掉 X 之后 Y 就成了孤儿』的推理,不许写成清单,必须写成差集断言**
  (产出树孤儿集 ⊆ 私有仓孤儿集)。」对应 §2 的 ⑳。
- **spec 侧**:§13 勘误节建议补一条 **E15**,记 P1(lockfile 路径不一致)与 P10(五道门未自动化),
  并订正 §7.5「四道门」的措辞为「五道门,且必须是自动测试」。

---

## 5. 五道门 + `--frozen-lockfile` 的完整命令(修复波验收用)

```bash
# ── 门 0:oss/ 自身 ────────────────────────────────────────────────
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run oss/                      # 期望 130+ 例全绿(修完会更多)

# ── 出包(正式出包不带 --skip-guard;开发迭代才带 --allow-dirty-oss)──
node oss/export.mjs --out /tmp/final-rev --no-commit --allow-dirty-oss
# 期望末行 [oss] 完成 → /tmp/final-rev,且 5/6 报「零真实泄漏命中」
# 期望 3/6 显示 DELETE 30 · REPLACE 4 · PATCH 170

# ── 门 1:装依赖(★ 这一步是新增的,C1 的回归保护)────────────────
cd /tmp/final-rev && rm -rf node_modules
pnpm install --frozen-lockfile;  echo "INSTALL_EXIT=$?"      # 必须 0
git -C /tmp/final-rev diff --stat 2>/dev/null                 # lockfile 必须未被改写

# ── 门 2:测试 ─────────────────────────────────────────────────────
pnpm test 2>&1 | tail -8;        echo "TEST_EXIT=${PIPESTATUS[0]}"   # 必须 0

# ── 门 3:类型检查(★ 唯一能抓 IDX-7 那类错误的门,不可省)────────
pnpm exec vue-tsc --noEmit;      echo "TSC_EXIT=$?"                  # 必须 0

# ── 门 4:构建 ─────────────────────────────────────────────────────
pnpm build;                      echo "BUILD_EXIT=$?"                # 必须 0

# ── 门 5:构建产物扫描 + 品牌 grep ─────────────────────────────────
cd /home/nimo/NimoTech/NimoOS-New-UI
node oss/scan-dist.mjs /tmp/final-rev/dist;   echo "DIST_EXIT=$?"    # 必须 0,零命中
grep -ric "nimoos-search\|nimoos-parser\|nimoos-photos\|nimoos-ai" /tmp/final-rev/dist \
  | grep -v ':0$'                                                    # 必须无输出

# ── 本次修复的定向复核 ────────────────────────────────────────────
grep -rn "strangler\|cutover\|绞杀"  /tmp/final-rev/src/   # 期望零输出(③)
grep -rn "开源版\|本版"               /tmp/final-rev/src/   # 期望零输出(④)
grep -rn "Claude"                     /tmp/final-rev/       --exclude-dir=node_modules --exclude-dir=dist  # 期望零输出(⑥)
grep -rn "\.superpowers/"             /tmp/final-rev/src/   # 期望零输出(⑦)
grep -n  '"name"'                     /tmp/final-rev/package.json    # 期望 nimoos-web(⑧)
grep -n  "NimoOS-New-UI"              /tmp/final-rev/scripts/deploy.sh  # 期望零输出(⑨)
for t in hit-bg hit-fg hl-star brand-shadow inner-bg-hi; do
  echo -n "--$t 定义: "; grep -c -- "--$t:" /tmp/final-rev/src/styles/theme.css; done  # 期望全 0(②)
```

**我这次评审跑出的基线(修复前),供对照:**
`oss/` 130 例绿 · 导出 EXIT=0(DELETE 30 / REPLACE 4 / PATCH 150,1 个预期内跳过 `settings.png`)·
产出树 366 文件 / 3157 例 EXIT=0 · `pnpm build` EXIT=0 · `scan-dist` 零命中(180 预期跳过)·
品牌 grep 零命中 · 交付仓 `rev-list=1` / `remote` 空 / `status` 干净 / 844 文件。
**唯一失败项:`pnpm install --frozen-lockfile` → `ERR_PNPM_OUTDATED_LOCKFILE`(即 C1)。**

---

## 6. 取证边界(诚实说明)

- 我**没有**逐字读完 766 个源文件。内部期号那 350+ 文件的注释是**抽样 + 定向 grep**,不是全读。
  抽查了最密集的几处(`kvm.css` 130 行、`KvmPage.vue` 79 行、`zh_cn.sp9.ts` 40 行),
  **没有一处顺带点名被剔除的功能** —— 控制者「这泄的是有个旧 UI,不是有个 AI 版本」的裁定在样本上成立。
- 150 条 PATCH 的**逐条摘除变异**由并行审计执行;我复核了其中 4 条最关键的主张(全部成立)
  并纠正了 2 处细节(测试文件是 6 个不是 5 个;`applyDelete(root,'')` 同样毁树而非报「清单过期」)。
- `SOFT` 表 121 条白名单里约 98 条(ASCII 词)**未逐条做对抗验证** —— 成本过高,改用 ⑬(b) 的机制约束。
- 未在真实 `dist/` 上逐条验证 `scanDist` 的 12 个 fixture(它们形状照 T15 实测,但仍是手写的)。
- 所有我陈述为「实测」的结论都有我自己跑过的命令支撑,命令都写在了对应条目里。
