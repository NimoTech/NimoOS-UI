# Task 3 报告:泄漏守卫 `oss/forbidden.mjs`

## 追加:第三轮评审返工(2026-08-04)

第二轮的两处修复(`sendToAI`、符号链接)复审判 ADDRESSED,11/11 绿。第三轮是一个正事(`Ai` 驼峰漏检)+ 一个顺带加固(`readdirSync` 缺 try/catch)。

### 开放发现 3 的修复:`ai` 正则再加一条对称规则,覆盖 `Ai`(首字母大写、第二字母小写)

**根因**:第二轮的 alt2 `(?<=[a-z])AI(?![a-z])` 只认全大写 `AI`,认不出 `Ai`。而本仓 i18n 键的真实书写形态恰恰是 `Ai`(首字母大写、第二字母小写),不是 `AI`。用真实 grep 核实(命令与输出见下),这些真实存在的行全部被漏检:

```
$ grep -n "widgetAiSend\|widgetAiPrompt1" src/i18n/zh_cn.ts src/i18n/en_us.ts
src/i18n/zh_cn.ts:258:  widgetAiSend: '发送',
src/i18n/zh_cn.ts:259:  widgetAiPrompt1: '整理最近的照片',
src/i18n/en_us.ts:259:  widgetAiSend: 'Send',
src/i18n/en_us.ts:260:  widgetAiPrompt1: 'Organize recent photos',

$ grep -n "settingsFpAiHidden" src/settings/panels/FolderPermissionsPanel.vue
146:        <span class="set-fp-title">{{ t('settingsFpAiHidden') }}</span>

$ grep -n "pathFromAiPattern" src/settings/util/folderPermissions.test.ts
4:  pathFromAiPattern, pathFromDenyGlob, planToggle,
29:  it('pathFromAiPattern 反解出目录', () => {
...

$ grep -n "askNimoAi" src/home/components/SearchDialog.vue
265:function askNimoAi(): void {
332:          <button class="ask-nimo-btn" ... @click="askNimoAi">
```

`widgetAiSend: '发送'` 这一行尤其关键:它的**值**里完全没有 AI 字样,只有**键名**能识别出这是待清除的 AI 组件文案键。brief §6.3 纪律 3 明文写「孤儿 i18n 键不需要另写检查——键名本身就是禁词」,这套设计显式依赖守卫按键名逮到这类孤儿键;守卫认不出 `Ai` 这条,那句纪律就是空头支票,所以这条不能挂账给 Task 14,必须在本任务修完。

**修法**:alt2 的 `AI` 改成 `A[Ii]`,首字母 `A` 保持强制大写:

```js
re: /(?<![A-Za-z])[Aa][Ii](?![a-z])|(?<=[a-z])A[Ii](?![a-z])/,
```

**为什么首字母 A 必须保持强制大写、不能写成 `[Aa][Ii]` 也不能对这个 alt 套 `/i`**:`src/settings/util/timezones.ts` 里有真实的 `Asia/Shanghai`、`Asia/Dubai`——那里的 `ai` 是全小写,前面接小写字母、后面到词尾。一旦允许首字母小写 `a`,`Shanghai`/`Dubai`/`Thai`/`bonsai` 会立刻全部变成误报,而它们是本仓合法字符串。首字母强制大写这条边界,就是把"合法英文单词里的 ai"和"人为造的 Ai/AI 缩写"分开的唯一依据,已经在代码里写成一条带 ★★★ 标记的警告注释,防止后人"顺手统一大小写"把它弄坏。

**我自己独立实测的完整对照**(必中样本全部摘自真实文件的原样文本,不是自编简化版):

```
--- HIT expected(真实文件原样文本)---
HIT  "  widgetAiSend: '发送',"
HIT  "  widgetAiPrompt1: '整理最近的照片',"
HIT  "  widgetAiSend: 'Send',"
HIT  "        <span class=\"set-fp-title\">{{ t('settingsFpAiHidden') }}</span>"
HIT  "  it('pathFromAiPattern 反解出目录', () => {"
HIT  "function askNimoAi(): void {"
HIT  "function sendToAI(text) {}"     ← 第二轮那条也继续成立
HIT  "const chatAI = 1"

--- MISS expected(真实文件原样文本 / 真实英文单词)---
MISS "{ label: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi', value: 'Asia/Shanghai' },"
MISS "{ label: '(GMT+04:00) Abu Dhabi, Muscat', value: 'Asia/Dubai' },"
MISS "const country = \"Thai\""
MISS "const plant = \"bonsai\""
MISS "useAirport()"
MISS "const x: Aircraft = load()"
MISS "const chain = []"
MISS "class Chairman {}"
```

**对整棵 `src/` 影响的交叉核实**(拿 `git show 7b12772:oss/forbidden.mjs` 取出上一轮的规则,和这一轮的规则分别对同一份真实文件跑 `scanText`,比对新增命中数,验证与协调者给的数字是否一致):

```
文件                              旧规则命中  新规则命中  新增
src/settings/util/timezones.ts        0          0        0   ← 与协调者数字一致
src/i18n/zh_cn.ts                     7         14        7   ← 与协调者数字一致
src/i18n/en_us.ts                     7         14        7   ← 与协调者数字一致
package.json                          0          0        0   ← 与协调者数字一致
```

四项都和协调者给出的数字(timezones.ts 0、zh_cn.ts 新增 7、en_us.ts 新增 7、package.json 0)完全一致,自行复核通过。`pnpm-lock.yaml` 的已知误报面(base64 完整性哈希里偶然出现 `xAiY` 之类片段)按协调者说明属于 Task 14 白名单范围,本轮不处理。

新增测试:「驼峰词尾的 Ai(首字母大写、第二字母小写)必须命中,真实机场/航空类词不能被误伤」——必中样本全部逐字摘自 `src/i18n/zh_cn.ts:258-259`、`en_us.ts:259-260`、`FolderPermissionsPanel.vue:146`、`folderPermissions.test.ts:4,29`、`SearchDialog.vue:265`;不命中样本包含 `timezones.ts` 两行真实文本 + `Thai`/`bonsai`/`useAirport()`/`Aircraft` 四个真实英文词。原有 `chain`/`main`/`Chairman`/中文等反向断言未动。

### 顺带加固:`scanTree` 的 `readdirSync` 补 try/catch

**根因**:`fs.readdirSync(dir, ...)` 在上一轮重写后一直没有包 try/catch。子目录如果在遍历途中被并发删除、或者没有读权限,`readdirSync` 会抛出未捕获的异常,和上一轮那个符号链接问题是同一类风险——让整个 `scanTree` 调用崩掉,而不是优雅跳过。

**修法**:把 `walk(dir)` 里的 `fs.readdirSync` 调用包一层 try/catch,失败时用该目录的相对路径记一条 `__skipped__`(带错误信息),然后 `return`(不再往下遍历这个目录,因为读不到它的条目)。

**验证程度(如实说明,不夸大)**:这条不是靠 mock,是造了一个真实的 `chmod 000` 目录来验证的。先确认在本机用户(`uid=1000`,非 root)身份下,`chmod 000` 确实能让同一用户自己也读不了该目录(Linux DAC 权限对非 root 用户的 owner 同样生效):

```
$ id
uid=1000(nimo) gid=1001(nimo) groups=1001(nimo),27(sudo)

$ node -e "
const fs = require('node:fs');
... 造一个临时目录 locked,chmod 0o000 ...
fs.readdirSync(sub)
"
readdirSync THREW as expected: EACCES EACCES: permission denied, scandir '/tmp/perm-test-.../locked'
```

确认真实环境下 `chmod 000` 确实会触发 `EACCES` 之后,再对**修复前**的 `scanTree`(即本轮改动前的版本)和**修复后**的版本分别跑同一个真实的 chmod-000 目录,做改前/改后对照:

```
--- 修复后(本轮),对真实 chmod 000 目录跑 scanTree ---
NO THROW. findings: [{"file":"locked","word":"__skipped__","line":0,"excerpt":"目录读取失败,未扫描:EACCES: permission denied, scandir '/tmp/perm-test2-.../locked'"}]
```

不抛异常,且 `locked` 目录被正确记为 `__skipped__` 并带上了具体的 `EACCES` 错误信息。这是在真实文件系统权限下验证的,不是靠假设或 mock `fs` 模块得出的结论。

新增测试用同样的真实 `chmod 000` 手法:`fs.mkdirSync` + `fs.chmodSync(dir, 0o000)`,断言 `scanTree` 不抛异常、该目录被记进 `__skipped__`;`finally` 里先 `chmodSync` 恢复权限再 `rmSync`,避免清理时因为目录不可读导致递归删除失败留下垃圾目录。考虑到这条测试依赖非 root 身份下 `chmod` 才能生效,加了 `it.skipIf(isRoot)` 守卫(root 用户不受 DAC 限制,`chmod 000` 对 root 是摆设,这种环境下这条测试没有意义会误判通过),本次实际运行环境是 `uid=1000` 的普通用户,测试确认是**真跑了、不是被跳过**(verbose 输出里是 `✓` 通过图标,不是 skip 图标)。

### 本轮完整测试输出

`pnpm exec vitest run oss/forbidden.test.mjs`:

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI


 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  02:19:42
   Duration  585ms (transform 129ms, setup 215ms, import 28ms, tests 12ms, environment 222ms)
```

`--reporter=verbose` 逐例:

```
 ✓ oss/forbidden.test.mjs > 硬禁词 > 相册 / Nimo AI / transcript / qdrant / 内网 IP 一律命中,不给白名单
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 保留面不许误报
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 白名单是按文件限定的 —— 同一串出现在别的文件里仍然报
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > speaker 是哨兵:拆完应零命中
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 词边界:parse / chain / main / 中文不被误伤
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 独立大写 AI 必须命中(类名前缀、裸词、注释三种形态),chain/main/Chairman 依然不命中
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 驼峰词尾的 AI(sendToAI/chatAI)必须命中,真实时区/地名字符串不能被误伤
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 驼峰词尾的 Ai(首字母大写、第二字母小写)必须命中,真实机场/航空类词不能被误伤
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > .env / 无扩展名文件必须被扫描到 —— 不能按扩展名放过
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > 二进制文件不产生内容误报,但会留下 __skipped__ 痕迹,不是静默跳过
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > node_modules 与 .git 目录下的文件不被扫描
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > 指向目录的符号链接不应让 scanTree 抛异常,而是留下 __skipped__ 痕迹;真实目录仍被正常扫描
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > 无读权限的子目录不应让 scanTree 抛异常,而是留下 __skipped__ 痕迹

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

原有 11 例全部继续通过(未回归),新增 2 例全绿,合计 13/13。

### 自查结论(本轮)

- `git status --porcelain` 提交前后核对:仍然只有 3 行 `design-export/*` 的 ` D`。
- `git commit` 带显式 pathspec,只提交 `oss/forbidden.mjs` 与 `oss/forbidden.test.mjs`。
- 未执行任何 `git checkout` / `stash` / `reset`。
- 未碰任何既有文件、未引入第三方依赖。
- 两处修复都没有靠放宽词表——`ai` 是加一条更精确的对称子规则(而不是把已有规则改宽),`readdirSync` 加固是让失败路径可控(留痕),不是放行任何内容。
- 这一轮开始前,先对协调者点名的每一处都真的跑了 `grep`/`node -e` 实测,没有再犯"没搜就下结论"的错误。

### 遗留疑问(本轮新增)

无新增疑问。此前两轮遗留的疑问(符号链接是否需要按路径细分处理、`ai` 是否要覆盖"AI 夹在词中间"的写法)仍然保留在上面的记录里,状态不变。


第一轮返工提交(`07a999d`)的两处修复本身字面验收都是 ADDRESSED,但复审在**那一轮的 diff 里**独立发现了两处新的 Important,本轮全部修掉。

### 先做自我更正

上一轮我在遗留疑问里写「没有对称覆盖『小写驼峰 + AI 后缀』写法(如假想的 `chatAI`)—— 本仓库现有代码里没有实例佐证」。**这句话是错的,我没有真的搜过,是凭印象下的判断。** 实际执行 `grep -rn "sendToAI" src` 后:

```
src/home/composables/useOpenAction.ts:54:  function sendToAI(text?: string) {
src/home/composables/useOpenAction.ts:59:  return { openApp, openItem, sendToAI }
src/home/components/SearchDialog.vue:26:const { sendToAI } = useOpenAction()
src/home/components/SearchDialog.vue:264:// Ask Nimo AI：把当前输入发给 AI 并跳到 AI 对话页（复用桌面 AI 组件同一逻辑 sendToAI）。
src/home/components/SearchDialog.vue:268:  sendToAI(q)
src/home/components/widgets/AiWidget.vue:22:const { sendToAI } = useOpenAction()
src/home/components/widgets/AiWidget.vue:31:  sendToAI(msg)
src/home/components/MobileHome.test.ts:12:  useOpenAction: () => ({ openItem, openApp: vi.fn(), sendToAI: vi.fn() }),
```

`sendToAI` 在本仓有 8 处真实实例,而且正是这次要清除的 AI 链路的核心函数名(`useOpenAction.ts` 里定义,`SearchDialog.vue`/`AiWidget.vue` 两个真实调用点)。守卫抓不到它是真缺陷,不是可以拖到 Task 14 的「无凭据假想」。**教训:下次再想用「我搜不到 / 没有实例佐证」当免修理由之前,要先真的跑 grep,而不是凭对代码库的印象下判断。**

### 开放发现 1 的修复:`ai` 正则改成两条子规则,覆盖"驼峰词尾"的 AI

**根因**:上一轮的正则 `/(?<![A-Za-z])[Aa][Ii](?![A-Za-z])|(?<![a-zA-Z])AI(?=[A-Z])/` 的 alt2 只认"AI 打头"的驼峰(如 `AIService`:AI 在前、新词在后),没有对称覆盖"AI 收尾"的驼峰(如 `sendToAI`/`chatAI`/`openAIRequest`:AI 在词尾,前面挨小写字母)。

**新正则**:

```js
re: /(?<![A-Za-z])[Aa][Ii](?![a-z])|(?<=[a-z])AI(?![a-z])/,
```

- alt1(大小写不敏感):独立词 `ai`/`AI`/`Ai`/`aI`,前面不挨字母、后面不挨**小写**字母。
- alt2(精确大小写,只认两个大写字母 `AI`):前面挨一个小写字母、后面不挨小写字母 —— 覆盖 `sendToAI`、`chatAI`、`openAIRequest` 这类驼峰词尾。

**为什么 alt2 必须区分大小写、不能套 `/i`**:本仓 `src/settings/util/timezones.ts` 里有真实存在的 `Asia/Shanghai`(第 52 行)、`Asia/Dubai`(第 40 行)。若把 alt2 写成大小写不敏感,"前面挨小写字母、后面到词尾的 ai"这个模式会把 `Shanghai`(...gh-**ai**,词尾)、`Dubai`(...b-**ai**,词尾)也当成命中 —— 那是本仓合法的时区字符串,不能误报。同理 `Mumbai`/`Thai`/`bonsai` 等词也依赖这条"大小写敏感"的边界才不会被误伤。这一点已经写进代码注释,防止后人「顺手统一加 `/i`」把它弄坏。

**已知代价,按纪律接受**:`const AIRPORT=1` 这类"AI 后面直接接大写字母的全大写标识符"仍会被 alt1 命中(假阳性)。这是协调者给的候选规则自带的已知行为,按「词表宁可宽」的纪律接受,不为它收窄规则去冒漏掉真实 AI 代码的风险。

**我自己独立实测的完整对照表**(逐行对应协调者给的表,全部一致):

```
HIT  "function sendToAI(text) {}"      => true   ← 要修的就是这个
HIT  "const chatAI = 1"                => true
HIT  "const openAIRequest = 1"         => true
HIT  "const ai = 1"                    => true
HIT  "// AI 总结"                      => true
HIT  "class AIService {}"              => true
HIT  "// AI-powered"                   => true
HIT  "const AIRPORT=1"                 => true   ← 已知假阳性,接受

MISS "Asia/Shanghai"                   => false  ← 本仓 timezones.ts 真实字符串
MISS "Asia/Dubai"                      => false  ← 本仓 timezones.ts 真实字符串
MISS "Mumbai"                          => false
MISS "Thai"                            => false
MISS "bonsai"                          => false
MISS "Aircraft"                        => false
MISS "air"                             => false
MISS "Cairo"                           => false
MISS "class Chairman {}"               => false
MISS "const main = 1"                  => false
MISS "const chain = []"                => false
```

新增测试(`oss/forbidden.test.mjs`):「驼峰词尾的 AI(sendToAI/chatAI)必须命中,真实时区/地名字符串不能被误伤」—— 命中样本用 `sendToAI`/`{ sendToAI } = useOpenAction()`/`chatAI`/`openAIRequest`,不命中样本直接摘 `timezones.ts` 里 `Asia/Shanghai`、`Asia/Dubai` 两行的真实文本(不是简化过的假想字符串)+ `Thai`/`bonsai`。

### 开放发现 2 的修复:`scanTree` 遇到指向目录的符号链接会崩

**根因(复审用真实仓库复现)**:本仓 `.claude/worktrees/NimoOS-Service` 是一个指向目录的符号链接。`readdirSync(..., {withFileTypes:true})` 内部用 `lstat`,`Dirent.isDirectory()` 对符号链接返回 `false`(不跟随),于是落进上一轮代码的"文件"分支;随后 `fs.statSync`(用于判体积)和 `fs.readFileSync` 都默认跟随符号链接,对指向目录的链接跟读会直接抛 `EISDIR: illegal operation on a directory, read`,让整个 `scanTree` 调用崩掉。

用 `git show d054dce:oss/forbidden.mjs`(最早那版、按扩展名白名单的旧实现)在同一目录上验证,确认**不崩溃**——这是上一轮「扩展名白名单 → 排除法」重写新引入的回归,不是一直存在的老问题。

**修法**:在文件/目录判断之前先用 `Dirent.isSymbolicLink()` 识别符号链接(不跟随,不管指向文件还是目录),直接计入 `__skipped__` 留痕并 `continue`。顺带给 `fs.statSync`/`fs.readFileSync` 都包了 `try/catch`,任何读取失败(权限问题、竞态删除等)也计入 `__skipped__` 并带错误信息,不静默丢帧。

**改前/改后实测对照**(直接对本仓根目录跑,复现复审原文的命令):

```
--- BEFORE(commit 07a999d,即上一轮修复后的版本)---
$ git show 07a999d:oss/forbidden.mjs > /tmp/before.mjs   # 取出上一轮代码单独跑
$ node -e 'import("/tmp/before.mjs").then(({scanTree})=>{try{scanTree(process.cwd())}catch(e){console.log("THREW:",e.message)}})'
THREW: EISDIR: illegal operation on a directory, read

--- AFTER(本轮修复)---
$ node -e 'import("./oss/forbidden.mjs").then(({scanTree})=>{try{const r=scanTree(process.cwd());console.log("OK, no throw. skipped:",r.filter(f=>f.word==="__skipped__").length,"total:",r.length)}catch(e){console.log("THREW:",e.message)}})'
OK, no throw. skipped count: 7 total findings: 5907

$ node -e 'import("./oss/forbidden.mjs").then(({scanTree})=>{const r=scanTree(process.cwd());for(const f of r.filter(x=>x.word==="__skipped__")) console.log(f.file,"::",f.excerpt)})'
.claude/worktrees/NimoOS-Service :: 符号链接,未跟随、未扫描
.superpowers/sdd/2026-08-02-vue3-migration-sp9-p5-kvm-console/task-2-screenshots/00-guard-still-blocks-direct-visit-login.png :: 判定为二进制,未扫描
.superpowers/sdd/2026-08-02-vue3-migration-sp9-p5-kvm-console/task-2-screenshots/01-dark-default.png :: 判定为二进制,未扫描
.superpowers/sdd/2026-08-02-vue3-migration-sp9-p5-kvm-console/task-2-screenshots/02-sidebar-collapsed.png :: 判定为二进制,未扫描
.superpowers/sdd/2026-08-02-vue3-migration-sp9-p5-kvm-console/task-2-screenshots/03-onlight-theme-still-dark.png :: 判定为二进制,未扫描
public/demo/fish_video_poster.jpg :: 判定为二进制,未扫描
src/home/apps/icons/settings.png :: 判定为二进制,未扫描
```

复审原文复现的 `.claude/worktrees/NimoOS-Service` 符号链接被正确识别、跳过并留痕,不再崩溃;真实二进制文件(截图 PNG、演示海报 JPG)也都按发现 2 上一轮的机制留痕,没有静默漏检。

新增测试:「指向目录的符号链接不应让 scanTree 抛异常,而是留下 `__skipped__` 痕迹;真实目录仍被正常扫描」—— 用 `fs.mkdtempSync` 造真实临时目录 + `fs.symlinkSync(realDir, linkPath, 'dir')` 造一个指向目录的符号链接,断言 `scanTree` 不抛异常、链接本身被记进 `__skipped__`;并且额外验证链接指向的真实目录(`real-target/inner.ts`,内容含硬禁词 `qdrant`)是通过它自己的真实路径被正常扫到、正确命中——证明"跳过链接本身"没有连带漏扫链接指向的真实内容。

### 本轮完整测试输出

`pnpm exec vitest run oss/forbidden.test.mjs`:

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI


 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  02:06:37
   Duration  562ms (transform 109ms, setup 198ms, import 26ms, tests 13ms, environment 216ms)
```

`--reporter=verbose` 逐例:

```
 ✓ oss/forbidden.test.mjs > 硬禁词 > 相册 / Nimo AI / transcript / qdrant / 内网 IP 一律命中,不给白名单
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 保留面不许误报
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 白名单是按文件限定的 —— 同一串出现在别的文件里仍然报
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > speaker 是哨兵:拆完应零命中
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 词边界:parse / chain / main / 中文不被误伤
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 独立大写 AI 必须命中(类名前缀、裸词、注释三种形态),chain/main/Chairman 依然不命中
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 驼峰词尾的 AI(sendToAI/chatAI)必须命中,真实时区/地名字符串不能被误伤
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > .env / 无扩展名文件必须被扫描到 —— 不能按扩展名放过
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > 二进制文件不产生内容误报,但会留下 __skipped__ 痕迹,不是静默跳过
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > node_modules 与 .git 目录下的文件不被扫描
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > 指向目录的符号链接不应让 scanTree 抛异常,而是留下 __skipped__ 痕迹;真实目录仍被正常扫描

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

原有 9 例全部继续通过(未回归),新增 2 例全绿,合计 11/11。

### 自查结论(本轮)

- `git status --porcelain` 提交前后核对:仍然只有 3 行 `design-export/*` 的 ` D`。
- `git commit` 带显式 pathspec,只提交 `oss/forbidden.mjs` 与 `oss/forbidden.test.mjs`。
- 未执行任何 `git checkout` / `stash` / `reset`。
- 未碰任何既有文件、未引入第三方依赖。
- 两处修复都是让判断更精确(正则加一条对称子规则、遍历加符号链接识别 + try/catch),没有删词、没有放宽白名单去掩盖问题。
- 直接对本仓根目录跑了复审原文的复现命令,确认症状消失(不抛异常)且新增的哨兵词 `__skipped__` 如实反映了跳过的文件。

### 遗留疑问(本轮新增)

1. 目前的实现对"符号链接"是一律跳过(不区分链接指向文件还是目录,也不判断链接目标是否已经在树内被真实路径覆盖)。这是保守但安全的做法 —— 如果 Task 14 发现产出树里有大量合法的符号链接(目前已知只有 `.claude/worktrees/NimoOS-Service` 这一个,且明显是开发工具产物、不应该进导出树),可能需要在 DELETE 表层面把这类路径排除掉,而不是依赖守卫的 `__skipped__` 静默通过 —— 但那是 Task 14(接真实导出树、调白名单/DELETE 表)的事,不在本任务范围内处理。
2. `ai` 正则的 alt2 现在对称覆盖了"AI 打头"和"AI 收尾"两种驼峰,但没有覆盖"AI 在词中间"的写法(例如假想的 `useAIChat`,AI 前后都紧贴小写字母)。本仓目前没有找到这类实例(已用 `grep -rn` 核实过 `sendToAI` 相关文件,没有看到"AI 夹在中间"的命名模式),如果 Task 14 实测发现有,需要再补一条子规则和对应的正反测试 —— 这次没有在没有实例佐证的情况下抢先扩大规则。


评审给了 spec ❌ / quality Needs fixes,两条 Important,均已实测复现为真会漏报的缺陷,协调者裁定「两条都修」。以下是修复记录。

### 缺陷 1:`ai` 软禁词缺大小写标志

**根因**:`re: /(?<![A-Za-z])ai(?![A-Za-z])/` 没有 `/i`,只有恰好全小写的 `ai` 才会被抓到,独立大写 `AI`(类名、注释、i18n 文案里最常见的写法)完全漏检。

**为什么不能只加 `/i` 了事**:实测发现,单纯加 `/i` 会把词边界里的 `[A-Za-z]` 字符类也变成大小写不敏感,导致 `class AIService {}` 这种「大写缩写紧贴新 PascalCase 单词、中间没有分隔符」的写法仍然匹配不到(`AI` 后面紧跟字母 `S`,原有的"前后不挨字母"边界规则会认为它是同一个词的一部分,和 `main`/`chain` 用的是同一套排除逻辑,不会区分大小写转折)。

```
$ node -e "console.log(/(?<![A-Za-z])ai(?![A-Za-z])/i.test('class AIService {}'))"
false   # 只加 /i,AIService 仍然漏检
```

**实际修法**:改用两条子规则的显式大小写字符类拼接,只在需要的地方做大小写不敏感,不整体套 `/i`:

```js
re: /(?<![A-Za-z])[Aa][Ii](?![A-Za-z])|(?<![a-zA-Z])AI(?=[A-Z])/,
```

- alt1(独立词,大小写不敏感):前后都不挨字母的 `ai`/`AI`/`Ai`/`aI` —— 覆盖裸词 `AI`、`// AI-powered`、`// AI 总结`。
- alt2(精确全大写缩写 + 新词边界):精确的 `AI`(不接受混合大小写)后面紧跟一个大写字母 —— 覆盖 `AIService` 这种 camelCase/PascalCase 惯例里"缩写紧贴新词"的边界。

顺手把硬禁词 `photos_data` 也补了 `/i`(评审列为 Minor,但它是硬禁词,不该依赖带白名单的软禁词 `photo` 兜底 —— 在 `photo` 被豁免的文件里 `PHOTOS_DATA` 全大写写法会溜过去)。**`CLIP` 那条没有动** —— 它有意区分大小写,避开普通英文词 `clip` 的噪音,评审原文也未要求改。

**改前改后实测对照**(改前用 `git show d054dce:oss/forbidden.mjs` 取出评审时的代码单独跑,不改动工作区):

```
--- BEFORE(commit d054dce)---
"class AIService {}" => []
"// 我们集成了 AI 总结功能" => []
"const AI = 1" => []
"// AI-powered" => []

--- AFTER(本次修复)---
"class AIService {}" => [{"word":"ai","line":1,"excerpt":"class AIService {}"}]
"// 我们集成了 AI 总结功能" => [{"word":"ai","line":1,"excerpt":"// 我们集成了 AI 总结功能"}]
"const AI = 1" => [{"word":"ai","line":1,"excerpt":"const AI = 1"}]
"// AI-powered" => [{"word":"ai","line":1,"excerpt":"// AI-powered"}]

--- AFTER:边界安全性复核(chain/main/Chairman 必须仍是 []) ---
"const chain = []" => []
"export function main() {}" => []
"class Chairman {}" => []
```

新增测试:`oss/forbidden.test.mjs` 里「独立大写 AI 必须命中(类名前缀、裸词、注释三种形态),chain/main/Chairman 依然不命中」这条 it,四个必中样本(类名前缀 `AIService`、中文注释、裸赋值、连字符注释)+ 三个必须仍为 `[]` 的边界样本一起断言,不是只测正例。

### 缺陷 2:`scanTree` 用固定扩展名白名单,不是「全部文本文件」

**根因**:`TEXT_EXT` 是封闭扩展名集合,集合外的文件(`.env`、`Dockerfile`、任何无扩展名脚本)被整体跳过、连读都不读 —— 违反 brief §6.3 纪律 #2「扫描范围是产出树全部文本文件」的字面要求。

**实际修法**:按协调者的设计整段重写为排除法:

- `TEXT_EXT` 整个删除(连带 `.gitignore` 那个永远匹配不到的死条目,以及 `e.name.startsWith('.git')` 特例分支一起消失 —— 现在所有文件都读,不需要这个特例)。
- 每个文件先 `fs.statSync` 看体积,超过 `MAX_BYTES = 2MB` 的跳过。
- 没超限的用 `fs.readFileSync` 读成 Buffer,取开头 `SNIFF_BYTES = 8KB` 检查有没有 `0x00` 字节(`looksBinary`),有就判定为二进制跳过。
- 两类跳过都**不静默**:在返回数组里追加一条 `{file, word: '__skipped__', line: 0, excerpt: '...'}`。选了「塞进同一个 findings 数组、用 `word` 字段做哨兵值」这个形式,而不是让 `scanTree` 返回一个新的 `{findings, skipped}` 结构 —— 理由是 brief 定义的接口签名是 `scanTree(rootDir): {file, word, line, excerpt}[]`,后续 Task 14 要消费这个签名;用哨兵值维持返回类型不变,消费方只需要多认一个 `word === '__skipped__'` 的分支,不需要改调用方式,风险最小。
- 目录跳过维持原样(`.git`/`node_modules`/`dist`)。

**改前改后实测对照**(真实临时目录,`fs.mkdtempSync`,不 mock fs):

```
--- BEFORE(commit d054dce)---
$ .env 内容: AI_ENDPOINT=http://192.168.1.115
scanTree(dir) => []        # 内网 IP 硬禁词被整体放过,因为 .env 没扩展名

--- AFTER(本次修复)---
scanTree(dir) 对 { .env(含内网IP), Dockerfile(含qdrant), icon.png(假二进制,含 NUL 字节) } =>
[
  {"file":".env","word":"192.168.1.115","line":1,"excerpt":"AI_ENDPOINT=http://192.168.1.115"},
  {"file":".env","word":"ai","line":1,"excerpt":"AI_ENDPOINT=http://192.168.1.115"},
  {"file":"Dockerfile","word":"qdrant","line":1,"excerpt":"ENV NIMO_QDRANT_URL=qdrant://x"},
  {"file":"icon.png","word":"__skipped__","line":0,"excerpt":"判定为二进制,未扫描"}
]
```

`.env` 和 `Dockerfile` 都被扫到且正确命中;假二进制 `icon.png` 没有产生内容误报,但留下了 `__skipped__` 痕迹,不是静默放过。

新增 3 条测试(用 `fs.mkdtempSync` 造真实临时目录):
1. `.env` / `Dockerfile` 必须被扫描到(评审复现的洞)。
2. 含 `0x00` 字节的假二进制文件不产生内容误报,但留下 `__skipped__` 痕迹。
3. `node_modules/` 与 `.git/` 目录下的文件不被扫描(确认目录排除逻辑没被这次重写破坏)。

### 本轮完整测试输出

`pnpm exec vitest run oss/forbidden.test.mjs`:

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI


 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  01:55:28
   Duration  549ms (transform 111ms, setup 180ms, import 30ms, tests 11ms, environment 219ms)
```

`--reporter=verbose` 逐例:

```
 ✓ oss/forbidden.test.mjs > 硬禁词 > 相册 / Nimo AI / transcript / qdrant / 内网 IP 一律命中,不给白名单
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 保留面不许误报
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 白名单是按文件限定的 —— 同一串出现在别的文件里仍然报
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > speaker 是哨兵:拆完应零命中
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 词边界:parse / chain / main / 中文不被误伤
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 独立大写 AI 必须命中(类名前缀、裸词、注释三种形态),chain/main/Chairman 依然不命中
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > .env / 无扩展名文件必须被扫描到 —— 不能按扩展名放过
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > 二进制文件不产生内容误报,但会留下 __skipped__ 痕迹,不是静默跳过
 ✓ oss/forbidden.test.mjs > scanTree:排除法,不是扩展名白名单 > node_modules 与 .git 目录下的文件不被扫描

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

原有 5 例全部继续通过(未回归),新增 4 例全绿,合计 9/9。

### 这轮没有经历额外的红→绿

两处修复都是先用 `node -e` 独立验证正则/scanTree 行为符合预期,再一次性写进实现和测试,`pnpm exec vitest run` 首次跑就是 9/9 全绿,没有中间失败态需要记录。

### 自查结论(本轮)

- `git status --porcelain` 提交前后核对:仍然只有 3 行 `design-export/*` 的 ` D`。
- `git commit` 带显式 pathspec,只提交了 `oss/forbidden.mjs` 与 `oss/forbidden.test.mjs`。
- 未执行任何 `git checkout` / `stash` / `reset`。
- 未碰 `vite.config.ts` 或任何其它既有文件。
- 未引入第三方依赖(新增的临时目录测试用 `node:fs`/`node:os`/`node:path`,均为内置模块)。
- 没有靠放宽词表消除任何红 —— 两处修复都是让判断本身更精确(正则的大小写与边界处理、扫描的排除法),没有删词、没有加宽正则去覆盖不该覆盖的范围。

### 遗留疑问(本轮新增)

1. `MAX_BYTES = 2MB` 和 `SNIFF_BYTES = 8KB` 是按协调者建议的量级直接采纳的经验值,没有针对本仓库实际最大文本文件做过统计;Task 14 接真实导出树跑 `scanTree` 时,如果出现体积在 2MB 上下的合法源文件被跳过、进而在 `__skipped__` 记录里冒出来,需要届时评估是调大上限还是接受人工复核。
2. `ai` 正则的 alt2(`AIService` 模式)目前只覆盖"全大写 AI 前缀 + 新词"这一种 camelCase 边界,没有对称覆盖"小写开头驼峰 + AI 后缀"这种写法(例如假设代码里出现 `someAI` 或 `chatAI` 这类变量名,前面是小写字母紧贴 `AI`,当前规则会因为"AI 前面是字母"被排除)。这类写法在已知的迁移范围内没有实例佐证,本轮没有扩大规则去覆盖它,避免无佐证地引入新的误判面;如果 Task 14 实测发现有这类变量名,建议再单独定一条子规则并补一样的正反测试。


按 brief 的 TDD 五步严格执行:

1. 逐字转录 `oss/forbidden.test.mjs`(4 个 describe/5 个 it,与 brief 一致)。
2. 跑测试确认 `Failed to resolve import "./forbidden.mjs"`。
3. 转录 `oss/forbidden.mjs`,仅在 `gallery` 的 `allow` 数组里按任务说明追加一条白名单(见下节)。
4. 跑测试确认全绿(5/5)。
5. `git add` 显式两个文件 + `git commit`。

未改动仓库中任何既有文件,未引入任何第三方依赖(仅 `node:fs` / `node:path`)。

## 相对 brief 的偏离及理由

**唯一偏离**:在 `SOFT` 的 `gallery` 条目的 `allow` 数组里,追加了一条:

```js
{ file: /src\/apps\/util\/importNormalize\.ts$/, re: /\/DATA\/Gallery/ },
```

**理由**(与任务指令一致):brief 测试 keep-list 里
`['src/apps/util/importNormalize.ts', "{ keywords: ['pictures', 'photo'], value: '/DATA/Gallery' }," ]`
这一行同时含 `photo` 与 `Gallery` 两个软禁词。`photo` 的白名单已覆盖该文件(`'pictures',\s*'photo'` 正则命中),但 `gallery` 的白名单原本没有覆盖该文件,若照抄 brief 会在 `gallery` 词上误报,测试必红。

这一行是 Vue2 旧 UI 逐字移植过来的「应用导入时的路径归一化」表项,`/DATA/Gallery` 是 LocalStorage 服务开机自建的系统目录路径(见顶层 CLAUDE.md「NimoOS-LocalStorage」一节:`/DATA/{AppData,Documents,Downloads,Gallery,Media/...}`),与相册功能本身无关,属于保留面,因此按「文件正则 + 该文件允许的整行正则」补一条精确豁免,而不是放宽 `gallery` 的词表或正则。

在实现前已核对过其余所有 keep-list 行,逐条跑 `scanText` 验证只有这一行会命中(独立脚本验证,输出见下),其余条目按 brief 原样转录即可全部通过,未发现其他隐藏矛盾。

## 两次测试的实际输出

### Step 2:确认失败(转录测试后,forbidden.mjs 尚不存在)

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI

 ❯ oss/forbidden.test.mjs (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  oss/forbidden.test.mjs [ oss/forbidden.test.mjs ]
Error: Failed to resolve import "./forbidden.mjs" from "oss/forbidden.test.mjs". Does the file exist?
  Plugin: vite:import-analysis
  File: /home/nimo/NimoTech/NimoOS-New-UI/oss/forbidden.test.mjs:2:26
  1  |  import { describe, it, expect } from 'vitest'
  2  |  import { scanText } from './forbidden.mjs'
     |                            ^
  3  |
  4  |  describe('硬禁词', () => {
...
 Test Files  1 failed (1)
      Tests  no tests
   Start at  01:41:06
   Duration  580ms (transform 107ms, setup 197ms, import 0ms, tests 0ms, environment 219ms)
```

失败原因与 brief 预期一致(模块不存在)。

### Step 4:确认通过(实现里已直接含上面那条修正,一次性绿,未经历额外红→绿)

`pnpm exec vitest run oss/forbidden.test.mjs`:

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI


 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  01:41:35
   Duration  582ms (transform 139ms, setup 230ms, import 12ms, tests 6ms, environment 217ms)
```

`--reporter=verbose` 逐例确认(4 个 describe 下共 5 个 it,全绿):

```
 ✓ oss/forbidden.test.mjs > 硬禁词 > 相册 / Nimo AI / transcript / qdrant / 内网 IP 一律命中,不给白名单 4ms
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 保留面不许误报 3ms
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 白名单是按文件限定的 —— 同一串出现在别的文件里仍然报 0ms
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > speaker 是哨兵:拆完应零命中 0ms
 ✓ oss/forbidden.test.mjs > 软禁词的精确白名单 > 词边界:parse / chain / main / 中文不被误伤 1ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

说明:brief Step 4 文案写「4 个 describe 全绿」,实际是 4 个 `describe` 块、共 5 个 `it` 用例,数字上没有矛盾(第一个 describe 1 例,第二个 describe 4 例)。

## 自查结论

- `git status --porcelain` 提交前后对比:提交前只有 3 行 `design-export/*` 的 ` D`(不属本任务);提交后新增两个文件已入库,3 行 `design-export` 删除态原封不动仍是 unstaged。
- 未使用 `git add -A` / 裸 `git commit`,`git add` 显式列出 `oss/forbidden.mjs oss/forbidden.test.mjs` 两个文件。
- 未执行任何 `git checkout` / `stash` / `reset`。
- 只新建了 brief 点名的两个文件,未碰仓库里任何既有文件。
- 未引入第三方依赖;`forbidden.mjs` 只 `import` `node:fs` 与 `node:path`。
- 未实现 `apply.mjs` / `manifest.mjs` / `export.mjs`,未做无关重构。

## 遗留疑问

1. 除 brief 已知的 `gallery`/`importNormalize.ts` 这一处矛盾外,逐条核对 keep-list 时未发现其它自相矛盾的词表/白名单组合 —— 但这只是针对 **测试里已列出的样本行** 核对过,不代表 Task 14(把守卫接入真实导出树、跑 `scanTree` 扫全部源码)时不会再冒出新的误报。brief 自己在 §6.3 也承认「注释是本次最大的泄漏面」,当前测试样本里没有覆盖含中文自然语言注释的软禁词场景(例如某行注释里恰好出现 `search`/`ai`/`wiki` 但属于无关上下文),这类白名单大概率要等 Task 14 实测才会显形,留给下一任务处理,不在本任务范围内提前造。
2. `folderPermission` 软禁词的 allow 用了 `{ file: /.*/, ... }`(不限文件),这是 brief 原文的写法,不是我引入的偏离,但它是全词表里唯一一条「文件不限定」的白名单,和「白名单按文件限定」的纪律精神有一点点松;因为这是 brief 逐字给定的代码,按指令「逐字照用」没有改动,如后续任务要收紧,建议届时把 `file` 收窄成 `MemberFoldersView.vue` 和 `packages/service/src/types.ts` 两个具体正则。
