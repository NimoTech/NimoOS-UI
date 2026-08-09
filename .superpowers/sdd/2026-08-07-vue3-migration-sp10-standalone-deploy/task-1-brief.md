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

