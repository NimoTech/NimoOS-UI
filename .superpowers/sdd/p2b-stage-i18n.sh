#!/usr/bin/env bash
# SP8-P2b —— i18n 定向暂存器
#
# 为什么需要它:P2b 执行期间,另一个会话(SP8-P2a T8+)正在**同一个 worktree**里
# 往 src/i18n/{zh_cn,en_us}.ts 追加它自己的键,且尚未提交。直接 `git add src/i18n/...`
# 会把别人的在途改动卷进 P2b 的提交(违反全局约束「git add 一律显式列路径、
# 不许卷走他人在途文件」的本意)。
#
# 做法:把工作区里所有 `// >>> SP8-P2b … // <<< SP8-P2b` 标记块**移植到 HEAD 版本**
# 上,只把这个结果写进 index(不动工作区)。于是:
#   * 提交内容 = HEAD + 本期 P2b 键     (不含 P2a 在途键)
#   * 工作区   = 原样不动               (P2a 在途键继续是未暂存修改)
#
# 用法:
#   .superpowers/sdd/p2b-stage-i18n.sh --check   # 只打印将要暂存的 diff
#   .superpowers/sdd/p2b-stage-i18n.sh           # 真正写 index
# 然后 `git commit`(不要再对 i18n 文件跑 git add!)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
mode="${1:---stage}"

for f in src/i18n/zh_cn.ts src/i18n/en_us.ts; do
  head_ver="$(mktemp)"; out="$(mktemp)"
  git show "HEAD:$f" > "$head_ver"
  python3 - "$head_ver" "$f" "$out" <<'PY'
import sys
head_p, work_p, out_p = sys.argv[1:4]
BEG, END = '// >>> SP8-P2b', '// <<< SP8-P2b'

def blocks(s):
    lines, out, i = s.split('\n'), [], 0
    while i < len(lines):
        if BEG in lines[i]:
            j = i
            while j < len(lines) and END not in lines[j]:
                j += 1
            if j >= len(lines):
                sys.exit('ERROR: unterminated SP8-P2b block in ' + work_p)
            out.append('\n'.join(lines[i:j + 1]))
            i = j + 1
        else:
            i += 1
    return out

def strip(s):
    lines, out, i = s.split('\n'), [], 0
    while i < len(lines):
        if BEG in lines[i]:
            while i < len(lines) and END not in lines[i]:
                i += 1
            i += 1
        else:
            out.append(lines[i]); i += 1
    return '\n'.join(out)

work = open(work_p, encoding='utf-8').read()
mine = blocks(work)
if not mine:
    sys.exit('ERROR: no SP8-P2b marker block found in ' + work_p)
base = strip(open(head_p, encoding='utf-8').read()).rstrip('\n')
if not base.endswith('}'):
    sys.exit('ERROR: unexpected tail in HEAD version of ' + work_p)
body = base[:base.rindex('}')].rstrip('\n')
open(out_p, 'w', encoding='utf-8').write(body + '\n' + '\n'.join(mine) + '\n}\n')
PY
  if [ "$mode" = "--check" ]; then
    echo "=== $f: would stage this delta vs HEAD ==="
    diff -u "$head_ver" "$out" || true
  else
    blob="$(git hash-object -w "$out")"
    git update-index --cacheinfo "100644,$blob,$f"
    echo "staged $f -> $blob"
  fi
  rm -f "$head_ver" "$out"
done
