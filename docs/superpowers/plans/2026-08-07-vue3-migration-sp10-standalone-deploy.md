# SP10 — New-UI 独立部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让一台**只装 New-UI、没有 Vue2** 的机器输入 `/` 也能落到应用上,同时不破坏本机「Vue2 + New-UI 共存」的现状。

**Architecture:** 绞杀表(`/` → `/app/#/`)住在 **Vue2** 的 `src/router/strangler.js` 里 —— 没有 Vue2 的机器根本没有这一跳。补法是在 `www/` 根目录放一个几行的静态重定向页,由 New-UI 的部署脚本写出。同时装了 Vue2 的机器上,根目录的 `index.html` 是 Vue2 的首页,**绝不能覆盖**,因此写入带一道标记守卫。New-UI 保持挂在 `/app/`,产品代码零改动、测试断言零改动、Gateway 零改动。

**Tech Stack:** bash(部署脚本)· vitest(两仓都用它;New-UI `pnpm test` = `vitest run`,Vue2 `pnpm test` = `vitest` 监听模式,跑单次要显式 `pnpm exec vitest run`)· Vue 2 SFC(仅删死链)

## Global Constraints

- **不删任何 Vue2 代码、不动绞杀机制、不改任何 `/app/` 路径。** SP10 已于 2026-08-07 重新定义为「独立部署」,原「退役 Vue2」作废;删 Vue2 最早等 SP12 之后再议。
- **New-UI 产品代码(`src/**`)本期零改动。** 本期只碰 `scripts/**` 与文档;Vue2 侧只碰 `src/views/Home.vue` 的死链。
- **New-UI 主题硬约束仍然生效**(见 `CLAUDE.md`):任何可见颜色必须来自 `theme.css` 的 token。本期不新增任何组件样式,该约束自动满足。
- **部署脚本是部署的唯一入口**(用户长期约定):不要绕过 `./scripts/deploy.sh` 手写 rsync/cp 到 `/var/lib`。
- **`www/` 根目录权限已确认**:`drwxrwxr-x nimo:nimo` —— 写入**不需要 sudo**。
- **不要在 shell 里写 `head … | grep -q …`**:本仓库历史上栽过 `set -o pipefail` + `grep -q` 提前退出导致上游 SIGPIPE、整条流水线被判失败的坑(roadmap SP6 台账 raidlab 段)。判定一律用变量 + `case` 匹配。
- **测试文件里取路径用 `import.meta.url`,不要用 `__dirname`**(两仓的 vitest 都跑 ESM)。
- **🔴 本期新增的 New-UI 文件会原样进公开仓,注释里不得出现私有上下文。** `scripts/write-root-redirect.sh`、`scripts/writeRootRedirect.test.ts`、`scripts/deploy.sh` 都是 git 跟踪文件,`oss/export.mjs` 走 `git archive HEAD` 把它们带进公开产物树(`oss/tree.test.mjs` 已断言 `scripts/deploy.sh` 属"保留面")。**禁止在这三个文件里写 `Vue2` / `strangler.js` / `台账` / `SP<数字>` / 内部 `.superpowers/` 路径** —— `oss/manifest.mjs` 的 M1/M2/I7a 三条补丁存在的全部理由就是擦掉这类痕迹(私有仓名、内部 SDD 台账路径与债务编号)。**注意 `oss/forbidden.mjs` 的硬禁词表里没有这些词 ⇒ 五道门全绿也不代表没泄漏**,只能靠写的时候就用中立措辞(别指望事后打 PATCH:锚点会漂,失配还会让导出报错)。中立写法:讲"本应用挂在 `/app/`,根目录可能住着别的应用的首页",不点名是谁。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `NimoOS-New-UI/scripts/write-root-redirect.sh` | 创建 | 唯一职责:往给定的 www 根写重定向页,带覆盖守卫。可独立调用、可独立测试,不知道 deploy 流程的存在 |
| `NimoOS-New-UI/scripts/writeRootRedirect.test.ts` | 创建 | 上面那个脚本的行为测试(在临时目录里跑,不碰真实 `/var/lib`)+ deploy.sh 接线断言 |
| `NimoOS-New-UI/scripts/deploy.sh` | 修改 | 在 rsync 之后调一次上面的脚本 |
| `NimoOS-UI/src/views/Home.vue` | 修改 | 删掉 `/next/` 死链(模板 1 处 + SCSS 2 处) |
| `NimoOS-UI/src/views/__tests__/Home.nextLink.spec.js` | 创建 | 源文本守卫,防止死链被重新引入 |
| `NimoOS-UI/docs/vue3-migration-roadmap.md` | 修改 | Task 5:勾掉 §4 SP10 的 T1/T2/T4 + 记录 T3 决策 + 记两条实现修正/债务 |

拆成「独立脚本 + deploy.sh 调用」而不是把逻辑内联进 deploy.sh,理由是**可测性**:deploy.sh 会真的 `pnpm build` 并写 `/var/lib`,测试里没法跑;拆出来的脚本接受 www 根作参数,能在临时目录里完整验证覆盖守卫的三条分支。

---

### Task 1: 根目录重定向脚本 + 覆盖守卫

**Files:**
- Create: `NimoOS-New-UI/scripts/write-root-redirect.sh`
- Test: `NimoOS-New-UI/scripts/writeRootRedirect.test.ts`

**Interfaces:**
- Consumes: 无(本期第一个任务)
- Produces: 可执行脚本 `scripts/write-root-redirect.sh`,签名 `write-root-redirect.sh <www-root>`。行为契约:
  - `<www-root>/index.html` **不存在** → 写出重定向页,stdout 输出以 `wrote: ` 开头,退出码 0
  - 该文件存在且**前 5 行含** `nimoos-new-ui-redirect` → 覆盖重写,stdout `wrote: `,退出码 0
  - 该文件存在且**前 5 行不含**该标记 → **一字不动**,stdout 以 `skip: ` 开头,退出码 0
  - 未传参 → **退出码 1**(不是"任意非 0"),stderr 含 `usage`
  - 写入是**原子的**:先写 `<www-root>/index.html.tmp` 再 `mv` 就位 —— 网关正在服务这个目录,`cat > 目标` 会有"文件已截断、内容还没写完"的窗口
  - 文件模式 **100755**(deploy.sh 直接 `./scripts/…` 执行它,不带 `bash` 前缀 ⇒ 可执行位必须跟着提交进 git)
  - 常量:标记串 `nimoos-new-ui-redirect`;跳转目标 `'/app/' + location.search + location.hash`
- Task 2 依赖:脚本路径 `scripts/write-root-redirect.sh`(相对仓库根),接受一个位置参数

- [ ] **Step 1: 写失败测试**

创建 `NimoOS-New-UI/scripts/writeRootRedirect.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('./write-root-redirect.sh', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nimoos-www-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function run(...args: string[]): string {
  return execFileSync('bash', [SCRIPT, ...args], { encoding: 'utf8' })
}

describe('write-root-redirect.sh', () => {
  it('根目录没有 index.html 时写出重定向页', () => {
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('nimoos-new-ui-redirect')
    expect(html).toContain("location.replace('/app/' + location.search + location.hash)")
  })

  it('已存在的是本脚本上次写的(前 5 行含标记)→ 覆盖重写', () => {
    writeFileSync(join(root, 'index.html'), '<!doctype html>\n<!-- nimoos-new-ui-redirect -->\n<!-- 旧版本 -->\n')
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).not.toContain('旧版本')
    expect(html).toContain("location.replace('/app/'")
  })

  it('🔴 已存在的是别的应用的首页(无标记)→ 一字不动,只报 skip', () => {
    const foreign = '<!DOCTYPE html><html><head><title>NimoOS</title></head><body><div id="app"></div></body></html>'
    writeFileSync(join(root, 'index.html'), foreign)
    const out = run(root)
    expect(out).toMatch(/^skip: /)
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(foreign)
  })

  it('标记出现在第 6 行及以后不算数(防止误判一份很长的别家首页)', () => {
    const decoy = '\n'.repeat(8) + '<!-- nimoos-new-ui-redirect -->'
    writeFileSync(join(root, 'index.html'), decoy)
    const out = run(root)
    expect(out).toMatch(/^skip: /)
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(decoy)
  })

  // ⚠️ 这条不能只写 expect(...).toThrow() —— 脚本文件还不存在时 bash 退 127 也会 throw,
  // 那样这条用例在"实现之前"就是绿的,永远抓不到"忘了写参数校验"。断言到具体退出码 + stderr。
  it('不传参数时以退出码 1 失败并打印 usage', () => {
    let err: any
    try {
      execFileSync('bash', [SCRIPT], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) {
      err = e
    }
    expect(err, '缺参数时必须失败').toBeDefined()
    expect(err.status).toBe(1) // 127 = 脚本本身没找到,不算通过
    expect(String(err.stderr)).toMatch(/usage/)
  })

  // deploy.sh 是 `./scripts/write-root-redirect.sh …` 直接执行的(不带 bash 前缀),
  // 而本测试全程用 `bash SCRIPT` 调 —— 少了这条,可执行位丢了测试照绿、真机部署 Permission denied。
  // 断言 git 索引里的模式而不只是本地文件权限:模式要跟着提交走才对下一个 clone 有效。
  it('🔴 脚本可执行,且 git 索引里记的是 100755', () => {
    expect(statSync(SCRIPT).mode & 0o111).toBeTruthy()
    const entry = execFileSync('git', ['ls-files', '-s', 'scripts/write-root-redirect.sh'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(entry, '文件要先 git add 进索引才量得到模式').toMatch(/^100755 /)
  })

  it('写出的页面在无 JS 时也能跳(noscript meta refresh 兜底)', () => {
    run(root)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="0;url=/app/"></noscript>')
  })

  // 顺带盯住原子写:临时文件必须已经 mv 掉,不能留在目录里(网关会把它也当静态文件服务)。
  it('只写 index.html,不在根目录留下任何别的文件(含 .tmp)', () => {
    run(root)
    expect(existsSync(join(root, 'index.html'))).toBe(true)
    expect(readdirSync(root)).toEqual(['index.html'])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

预期:**8 条全部失败**。前 7 条报错形如 `ENOENT ... write-root-redirect.sh` / bash 退 127(脚本还不存在);第 8 条(模式)因为 `git ls-files -s` 返回空串而失败。**如果有任何一条是绿的,先搞清为什么再往下走** —— 这一步的意义就是确认每条断言都真的在测东西。

- [ ] **Step 3: 写脚本**

创建 `NimoOS-New-UI/scripts/write-root-redirect.sh`:

```bash
#!/usr/bin/env bash
# 往 www 根目录写一个「/ → /app/」的静态重定向页。
#
# 为什么需要它:本应用挂在 /app/ 下(hash 路由),www 根目录不属于它。只部署了本应用
# 的机器上,用户输入 / 会落到一个没有 index.html 的目录。这个页面补上那一跳,并把
# 查询串与 hash 原样带过去,所以 /?a=1#/files 这样的旧书签也能落对。
#
# 🔴 覆盖守卫:www 根目录可能已经住着**另一个应用的首页**,覆盖它就把那个应用打死了。
#    所以只在两种情况下写:① 文件不存在;② 文件是本脚本上次写的(前 5 行含 MARKER)。
#    标记写在第 2 行(第 1 行是 doctype),所以判据是"前 5 行",不是"第一行"。
#
# 注:判定刻意不写成 `head -n 5 … | grep -q …` —— `set -o pipefail` 下 `grep -q`
#    命中即退会给上游 head 发 SIGPIPE,整条流水线被判失败(本仓库栽过这个坑)。
#    这里用变量 + case 匹配,全程不起管道。
set -euo pipefail

WWW_ROOT="${1:?usage: write-root-redirect.sh <www-root>}"
MARKER='nimoos-new-ui-redirect'
TARGET="$WWW_ROOT/index.html"

if [ -e "$TARGET" ]; then
	head5="$(head -n 5 "$TARGET")"
	case "$head5" in
		*"$MARKER"*) : ;;  # 本脚本上次写的,可以覆盖
		*)
			echo "skip: $TARGET 已存在且非本脚本所写(根目录另有首页),不覆盖"
			exit 0
			;;
	esac
fi

# 原子写:网关正在服务这个目录,`cat > 目标` 会有"已截断、内容还没写完"的窗口。
# 先写临时文件再 mv 就位(同目录 ⇒ 同文件系统 ⇒ mv 是原子的 rename)。
cat > "$TARGET.tmp" <<EOF
<!doctype html>
<!-- $MARKER -->
<meta charset="utf-8">
<title>NimoOS</title>
<script>location.replace('/app/' + location.search + location.hash)</script>
<noscript><meta http-equiv="refresh" content="0;url=/app/"></noscript>
EOF
mv -f "$TARGET.tmp" "$TARGET"

echo "wrote: $TARGET"
```

然后加可执行位**并入索引** —— 第 8 条用例量的是 `git ls-files -s` 里的模式,文件不进索引量不到:

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
chmod +x scripts/write-root-redirect.sh
git add scripts/write-root-redirect.sh          # Step 4 的模式断言依赖这一步
git ls-files -s scripts/write-root-redirect.sh  # 自查:应输出 100755 开头
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

预期:8 passed。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add scripts/write-root-redirect.sh scripts/writeRootRedirect.test.ts
git commit -m "feat(sp10): 根目录 / → /app/ 重定向页脚本(带 Vue2 首页覆盖守卫)"
```

---

### Task 2: 把重定向脚本接进 deploy.sh

**Files:**
- Modify: `NimoOS-New-UI/scripts/deploy.sh`
- Test: `NimoOS-New-UI/scripts/writeRootRedirect.test.ts`(追加一个 describe 块)

**Interfaces:**
- Consumes: Task 1 的 `scripts/write-root-redirect.sh <www-root>`
- Produces: `deploy.sh` 在 rsync 之后调用 `./scripts/write-root-redirect.sh /var/lib/nimoos/www`。后续任务不依赖新符号。

- [ ] **Step 1: 写失败测试**

在 `NimoOS-New-UI/scripts/writeRootRedirect.test.ts` **末尾追加**:

```ts
describe('deploy.sh 接线', () => {
  // 用文件顶部已有的 HERE 常量拼路径。⚠️ 不要写 `new URL('./deploy.sh', import.meta.url)`:
  // 这个两参数字面量形态会被 Vite 当资源 URL 静态转换,vitest(jsdom)下解析成 http: 而非
  // file:,fileURLToPath 直接抛 TypeError 且整个测试文件 0 collected(Task 1 已实测踩过)。
  const deploySrc = readFileSync(join(HERE, 'deploy.sh'), 'utf8')

  it('调用了重定向脚本,并且传的是 www 根而不是 app 子目录', () => {
    expect(deploySrc).toContain('./scripts/write-root-redirect.sh /var/lib/nimoos/www')
    expect(deploySrc).not.toContain('write-root-redirect.sh /var/lib/nimoos/www/app')
  })

  it('调用点在 rsync 之后(先把应用铺好,再补根目录那一跳)', () => {
    const rsyncAt = deploySrc.indexOf('rsync -a --delete')
    const callAt = deploySrc.indexOf('./scripts/write-root-redirect.sh')
    expect(rsyncAt).toBeGreaterThan(-1)
    expect(callAt).toBeGreaterThan(rsyncAt)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

预期:新增的 2 条失败(`expected '…' to contain './scripts/write-root-redirect.sh …'`),原有 8 条仍通过。

- [ ] **Step 3: 改 deploy.sh**

`NimoOS-New-UI/scripts/deploy.sh` 里,把这一行:

```bash
find /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
```

改成:

```bash
find /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
# 本应用挂在 /app/ 下,根目录不属于它 —— 补一个 / → /app/ 的重定向页,
# 让只部署了本应用的机器上,输入 / 也能落到应用里。
# 脚本自带覆盖守卫:根目录已有别的首页时一字不动(详见脚本头部注释)。
# 本脚本开头已 `cd "$(dirname "$0")/.."`,所以这里的相对路径就是仓库根。
./scripts/write-root-redirect.sh /var/lib/nimoos/www
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

预期:10 passed。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add scripts/deploy.sh scripts/writeRootRedirect.test.ts
git commit -m "feat(sp10): deploy.sh 部署后补写根目录重定向页"
```

---

### Task 3: 删掉 Vue2 的 `/next/` 死链

**Files:**
- Modify: `NimoOS-UI/src/views/Home.vue`(模板 299-304、SCSS 360-401、SCSS 402-412)
- Test: `NimoOS-UI/src/views/__tests__/Home.nextLink.spec.js`

**Interfaces:**
- Consumes: 无
- Produces: 无(纯删除 + 守卫)

**背景(实现者必读):** `/next/` 是七月的新主页原型,**原型目录本身早就没了** —— `NimoOS-UI/public/next/` 现在 0 个文件,设备 `/var/lib/nimoos/www/` 下也没有 `next` 目录。**所以桌面右上角那颗「New homepage」按钮现在点下去就是 404。** 本任务只是把这颗死按钮和它的样式清掉。

两个 i18n 键 `New homepage` / `Try the new homepage` **不在任何语言包里**(`src/assets/lang/*.json` 全部零命中),vue-i18n 回落到键名本身直接显示英文 —— 所以**不需要改任何语言文件**。

- [ ] **Step 1: 写失败测试**

创建 `NimoOS-UI/src/views/__tests__/Home.nextLink.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 读源文本而不是挂载组件:这颗按钮是死链(/next/ 原型目录已不存在),
// 我们要防的是"有人把它加回来",源文本断言比渲染断言更直接、也不用给 Home.vue
// 那一大堆依赖打桩。
const SRC = readFileSync(fileURLToPath(new URL('../Home.vue', import.meta.url)), 'utf8')

describe('/next/ 原型入口已移除(SP10-T3)', () => {
  it('模板里没有指向 /next/ 的链接', () => {
    expect(SRC).not.toContain('/next/')
  })

  it('enter-next 的类名与样式一并清干净(含 __spark/__arrow/__text 与那条 480px media query)', () => {
    expect(SRC).not.toContain('enter-next')
  })

  it('两个只服务于该按钮的 i18n 键也不再引用', () => {
    expect(SRC).not.toContain('New homepage')
    expect(SRC).not.toContain('Try the new homepage')
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
```

预期:3 条全失败。

- [ ] **Step 3: 删掉三处**

**3a — 模板(`src/views/Home.vue` 第 299-304 行)**,删掉这 6 行:

```html
    <!-- 进入新主页（/next/，hash 路由之外，整页跳转） -->
    <a class="enter-next" href="/next/" :title="$t('Try the new homepage')">
      <span class="enter-next__spark">✦</span>
      <span class="enter-next__text">{{ $t('New homepage') }}</span>
      <span class="enter-next__arrow">→</span>
    </a>
```

删完后 `<div v-if="!isLoading" class="out-container">` 的下一行应当直接是 `<!-- Content Start -->`。

**3b — SCSS 主块(第 360-400 行 + 其后的空行)**,删掉整个 `.enter-next { … }`:

```scss
.enter-next {
    position: absolute;
    top: 1.4rem;
    right: 1.6rem;
    z-index: 30;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 38px;
    padding: 0 1rem;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(14px) saturate(140%);
    box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;

    &:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.24);
        box-shadow: 0 14px 30px -8px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.5);
    }

    &__spark {
        font-size: 0.95rem;
        line-height: 1;
        opacity: 0.9;
    }

    &__arrow {
        transition: transform 0.18s ease;
    }

    &:hover &__arrow {
        transform: translateX(3px);
    }
}
```

**3c — SCSS media query(第 402-412 行)**,删掉整个块。⚠️ **先确认这个 `@media` 里只有 enter-next 两条规则再删,别把别的响应式规则一起带走**:

```scss
@media screen and (max-width: 480px) {
    .enter-next {
        top: auto;
        bottom: 1rem;
        right: 1rem;
    }

    .enter-next__text {
        display: none;
    }
}
```

删完后 `.out-container { … }` 那个块的下一个块应当直接是 `.contents { flex: 1; overflow-y: hidden;`。

- [ ] **Step 4: 跑测试确认通过 + 确认没删多**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
# 反向检查:确认只删了预期的 3 段、没有波及别的规则
git diff --stat src/views/Home.vue          # 预期 55–62 行删除、0 新增(模板 6 + SCSS 主块 41 + 空行 + media 11)
git diff src/views/Home.vue | grep '^+' | grep -v '^+++'   # 预期无输出(纯删除)
# Home.vue 的既有测试不能被带红
pnpm exec vitest run src/views/__tests__/
```

预期:新 spec 3 passed;`git diff` 只有删除行、没有新增行;`__tests__/` 目录下既有 spec 与改动前一致(Vue2 全量有 8 个既有失败,以**不新增**为准,别要求全绿)。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/views/Home.vue src/views/__tests__/Home.nextLink.spec.js
git commit -m "chore(sp10): 删掉桌面右上角 /next/ 死链(原型目录早已不存在,点了是 404)"
```

---

### Task 4: 两形态回归验证

**Files:**
- 无代码改动。本任务产出的是**证据**,写进 `NimoOS-New-UI/.superpowers/sdd/sp10/progress.md`。

**Interfaces:**
- Consumes: Task 1-3 的全部产物
- Produces: 验证记录

- [ ] **Step 1: 两仓完整测试门 + 开源公开面自查**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
cd /home/nimo/NimoTech/NimoOS-UI && pnpm exec vitest run
```

预期:New-UI 全绿(含 `oss/*.test.mjs` 那批导出门)+ tsc 0 错 + build 通过;Vue2 **失败数不超过改动前的既有基线**(改动前先跑一次记下数字再对比,别直接要求 0 失败)。

⚠️ **`vue-tsc --noEmit` 覆盖不到本期的新文件** —— `tsconfig.json` 的 `include` 只有 `["src", "src/**/*.vue"]`,`scripts/` 不在里面(所以 `writeRootRedirect.test.ts` 里用 node 内置模块也不会因为缺 `@types/node` 报错)。**这份测试的类型没有门在管**,写的时候自己看住。

然后做开源公开面自查(见 Global Constraints 那条:硬禁词表里没有这些词,门是绿的也不代表没泄漏):

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
grep -nE 'Vue ?2|strangler|台账|SP[0-9]|\.superpowers' \
  scripts/write-root-redirect.sh scripts/writeRootRedirect.test.ts scripts/deploy.sh
```

预期:**无输出**(grep 退 1)。有命中就改成中立措辞再跑。

- [ ] **Step 2: 形态 A —— 本机(Vue2 + New-UI 共存),验证不覆盖**

⚠️ **这一步会真的部署,`deploy.sh` 是 `rsync --delete` 到 `/var/lib/nimoos/www/app/`,那个目录被多条并行工作线共用 —— 谁部署谁覆盖别人。** 跑之前先记下自己要装上去的是哪一份,并跟机主确认这就是他想留在设备上的那份:

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git log -1 --oneline && git status --short
ls -la /var/lib/nimoos/www/app/index.html   # 现在设备上那份的时间戳,记进台账
```

```bash
# 先记下 Vue2 首页的指纹
md5sum /var/lib/nimoos/www/index.html
head -n 1 /var/lib/nimoos/www/index.html
# 真部署
cd /home/nimo/NimoTech/NimoOS-New-UI && ./scripts/deploy.sh
# 再比一次
md5sum /var/lib/nimoos/www/index.html
```

判据(**主判据是 `skip:`,md5 只是辅证**):

1. **🔴 主判据:部署输出里必须出现 `skip: /var/lib/nimoos/www/index.html 已存在且非本脚本所写`。** 为什么它才是主判据:「两次 md5 一致」在**守卫压根没生效**的情况下也可能为真 —— 守卫要是写坏成"什么都不做直接 exit 0",md5 同样一致、这条照绿。只有 `skip:` 能证明脚本**走到了守卫分支并做了正确判断**。
2. 辅证:两次 md5 完全一致。
3. 辅证:`ls /var/lib/nimoos/www/index.html.tmp` 或 `ls -a /var/lib/nimoos/www/.index.html.*` **不存在**(原子写没留残渣 —— 网关会把残渣也当静态文件服务出去)。
4. 浏览器打开 `http://192.168.1.143/` 仍由 Vue2 接手并跳到 `/app/#/`(行为与改动前无差别)。

- [ ] **Step 3: 形态 B —— 模拟只装 New-UI(可选,会有约 5 秒 Vue2 首页不可达的窗口)**

⚠️ **这一步会临时动设备上的活文件。跑之前先跟机主确认。** 两条命令都是 `mv`,完全可逆:

```bash
# 挪开 Vue2 首页
mv /var/lib/nimoos/www/index.html /var/lib/nimoos/www/index.html.vue2bak
# 让脚本接管
/home/nimo/NimoTech/NimoOS-New-UI/scripts/write-root-redirect.sh /var/lib/nimoos/www
# 取证
curl -s http://127.0.0.1/ | head -n 3
# 立刻还原
mv /var/lib/nimoos/www/index.html.vue2bak /var/lib/nimoos/www/index.html
md5sum /var/lib/nimoos/www/index.html    # 与 Step 2 记的第一个 md5 对上
```

预期:`curl` 输出第 1-2 行是 `<!doctype html>` 和 `<!-- nimoos-new-ui-redirect -->`;还原后 md5 与 Step 2 一致。

**如果机主不同意动设备**:跳过本步并在台账里注明「形态 B 仅由 Task 1 的单元测试覆盖(临时目录),未在真机取证」—— **不要假装验过**。真正的独立部署验证需要一台没有 Vue2 的机器,本工作区没有。

- [ ] **Step 4: 记录并提交台账**

把 Step 1-3 的实际输出(md5、curl 前三行、测试数字)写进 `NimoOS-New-UI/.superpowers/sdd/sp10/progress.md`,然后:

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add .superpowers/sdd/sp10/progress.md
git commit -m "docs(sp10): 两形态回归验证记录"
```

---

### Task 5: 共享包归宿决策(需要机主拍板)+ roadmap 收口

**Files:**
- Modify: `NimoOS-UI/docs/vue3-migration-roadmap.md`(§4 SP10:T3 条目 + T1/T2/T4 勾选 + 两条记账)

**Interfaces:**
- Consumes: Task 1-4 的产物(勾 T1/T2/T4 之前它们必须已经关账)
- Produces: 一条写进 roadmap 的决策记录 + SP10 四条待办的真实状态

**这不是编码任务 —— 它需要机主做一个选择。实现者要做的是:把下面的分析原样呈给机主,拿到答复后把答复写进 roadmap,不要替他选。**

- [ ] **Step 1: 把决策摆给机主**

原文照给:

> **共享包 `@nimotech/nimoos-service` 的归宿:**
>
> - **A 保留独立仓** —— 以后 CLI 等还能复用;代价是多维护一个仓、每次改完要 `pnpm build` 再回消费仓 `pnpm install`(这条链路已经坑过几次,见记忆里的「nimoos-service pnpm 漂移」)。
> - **B 内联进 New-UI** —— 少维护一个仓,改动一步到位。
>
> **⚠️ 前提已经变了。** roadmap 原文写「目前看无第二消费者,倾向 B」—— 那是建立在「SP10 会删掉 Vue2」的假设上。现在 Vue2 不删了,而 **Vue2 从 SP3 起 service 层就切了共享包**,它就是那个第二消费者。所以原来倾向 B 的理由**不再成立**,现在倾向 **A**。

- [ ] **Step 2: 把答复写进 roadmap**

先取当天日期(不要留 `2026-08-XX` 这种占位符):

```bash
date +%F
```

在 `NimoOS-UI/docs/vue3-migration-roadmap.md` 的 §4 SP10(约 1043 行起)里找到这一行:

```
- [ ] **T3 共享包归宿决策(唯一待拍板)** ——
```

把 `- [ ]` 改成 `- [x]`,并在该条目末尾追加一句(把 `<日期>`/`<A 或 B>`/`<机主的理由>` 换成实际值):

```
**<日期> 机主拍板:选 <A 或 B> —— <机主的理由>。**
```

- [ ] **Step 3: 同一节里把 T1/T2/T4 也收口**

同一节的另外三条待办本期已经做完,一并勾掉并补两条实现修正/记账(否则 roadmap 与现实脱节):

1. **T1** `- [ ]` → `- [x]`,末尾追加:
   ```
   **<日期> 完成**(`scripts/write-root-redirect.sh` + deploy.sh 接线,10 条用例)。**实现修正:守卫判据是「前 5 行含标记」不是「第一行」** —— 标记写在第 2 行(第 1 行是 doctype),照"第一行"实现会认不出自己上次写的页面、第二次部署起永远 skip。另:写入走临时文件 + `mv` 原子就位(网关正在服务该目录)。
   ```
2. **T2** `- [ ]` → `- [x]`,末尾追加:
   ```
   **<日期> 完成**(实删 **60 行 / 0 新增**:模板 6 + SCSS 主块 41 + 空行 + 480px media 11,不是"纯删 2 行" —— 那两行只是 `<a>` 本体,类名与样式还有三处;另加一条源文本守卫 spec 防复引入)。
   ```
3. **T4** `- [ ]` → `- [x]`,末尾追加(形态 B 是否真机验过按 Task 4 Step 3 的实际结果写,**没验就照实说没验**):
   ```
   **<日期> 完成**:形态 A 真机验过(Vue2 首页 md5 前后一致、部署输出 skip);形态 B <真机验过 / 仅单元测试覆盖,真正的独立部署验证需要一台没有 Vue2 的机器,本工作区没有>。
   ```
4. 在 SP10 那节末尾追加一条债务(本期无法在此解决,必须留痕):
   ```
   - **🔴 SP10 债务 ①:重定向页只由 `deploy.sh` 写,发布包里没有。** New-UI 至今**没有任何打包配置**(无 goreleaser/nfpm/`build/sysroot`),而 Vue2 的根 `index.html` 是靠 `NimoOS-UI/build/sysroot/var/lib/nimoos/www/` 进 deb 的。所以本期覆盖的"独立部署"= **clone 仓库 + 跑 deploy.sh** 这一种形态;由 ISO/deb 装出来的机器根目录仍然是空的。将来 New-UI 有了 sysroot/postinst,这套「写 + 覆盖守卫」要同步进包。
   - **🔴 SP10 债务 ②:根目录被别的应用首页占过之后,本脚本不会自动收回。** 覆盖守卫只认自己的标记,所以「**曾经装过 Vue2、后来把它退役/删掉**」的机器上,根 `index.html` 是 Vue2 留下的(而它的 chunk 已经不在)⇒ `/` 打开是白屏,而 New-UI 每次部署都只会 `skip:`、永远修不回来,脚本也没有 `--force`。这与债务 ① 是两条不同的失效路径。当前处置:靠 `skip:` 那句提示让操作者手工 `rm` 掉根 index.html 再部署一次;要收就给脚本加 `--force`。
   ```

- [ ] **Step 4: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md
git commit -m "docs(sp10): 记录共享包归宿决策 + T1/T2/T4 收口与发布包债务"
```

---

## 本期明确不做(已核实无需做,写在这里防止实现者"顺手补上")

| 项 | 为什么不做 |
|---|---|
| Gateway 改根路由 | 它只有一句 `e.StaticFS("/", NewCustomFS(wwwPath))`(`NimoOS-Gateway/route/static_route.go`),谁在根纯看文件放哪,**零改动** |
| service 收口 | **已完成**:New-UI 裸 `fetch('/v1…')` **0 处**、直接用 axios **0 处**(31 个 `axios` 命中全是注释里在解释共享包已剥过一层),网络层 100% 走共享包 |
| 修 `src/ai/services/openInApp.ts:38` 的 `photosAssetUrl` | 它返回 `/#/photos`(Vue2 路径),与紧邻的 `filesPathUrl`(`/app/#/files`)不一致,靠绞杀弹回来才活。**但 Vue2 不删 ⇒ 绞杀常在 ⇒ 不构成缺陷**。降级为记账项:**若将来真删 Vue2,这条必修** |
| 回退路径收口(`useOpenAction.ts` 的 `/#/legacy` 等) | 只在 `cutoverDisabled()` 为真(有人主动置回退 flag)时才走到,独立机器上够不着 |
| 把 New-UI 挪到根目录、Vue2 挪 `/legacy/` | 方案 B,已评估否决:两仓 19 行产品代码 + **几十处测试断言**(New-UI 里 `/app/` 出现 55 处、42 处在测试;Vue2 `strangler.spec.js` 258 行几乎每条都断言 `/app/#/…`)+ 现有书签全废 |
| 删 Vue2 仓 | SP10 已重新定义,删 Vue2 最早等 SP12(7-15 之后的增量补迁)之后再议 |
| 把重定向页做进**发布包** | New-UI 没有任何打包配置(无 goreleaser/nfpm/`build/sysroot`),给它加一套打包是独立项目级的工作,不在 S 号本期内。**本期覆盖的独立部署 = clone 仓库 + 跑 `deploy.sh`**;ISO/deb 装机形态挂账到 roadmap(Task 5 Step 3 第 4 条) |
