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
