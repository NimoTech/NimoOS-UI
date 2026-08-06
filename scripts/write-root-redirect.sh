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

# 目标机器上常只搭了 app 子目录的权限(装机说明历史上只 chown 了那一层),
# www 根目录本身可能是 root:root。到这里才发现会是一句裸的 `Permission denied`
# 并直接中止整个部署脚本(rsync 早已成功,但操作者只看到"部署失败")。
# 提前判断并给出可执行的修复命令,而不是让 mktemp/cat 自己去踩权限坑。
if [ ! -d "$WWW_ROOT" ] || [ ! -w "$WWW_ROOT" ]; then
	echo "error: $WWW_ROOT 不存在或当前用户不可写,无法写入重定向页。" >&2
	echo "请先执行: sudo mkdir -p $WWW_ROOT && sudo chown $(id -un):$(id -gn) $WWW_ROOT" >&2
	exit 1
fi

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
#
# 临时文件名不能固定(曾是 "$TARGET.tmp"):两次部署并发跑到这里,后者会把前者
# 正在写的同名临时文件截断清零,前者随后 mv 走的就是一个 0 字节的 index.html。
# mktemp 给每次调用分配独立文件名,消掉这个竞态。
# 用 trap 兜底清理:cat 中途失败(如磁盘满)不能在 www 根留下 .tmp 文件——
# 网关会把它当成普通静态文件直接服务出去。mv 成功后临时文件已不在原路径,
# trap 里的 rm -f 是安全的空操作。
tmp="$(mktemp "$WWW_ROOT/.index.html.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
chmod 644 "$tmp"  # mktemp 建出的文件默认 0600,不 chmod 网关读不到

# 下面写的两行降级路径不对称:有 JS 时 script 会把查询串/hash 原样带过去;
# <noscript> 里的 meta refresh 只能落 /app/ 首页,拿不到查询串/hash——meta
# refresh 没有运行时变量可用,这是硬限制不是疏漏。无 JS 时书签式深链接会失效。
cat > "$tmp" <<EOF
<!doctype html>
<!-- $MARKER -->
<meta charset="utf-8">
<title>NimoOS</title>
<script>location.replace('/app/' + location.search + location.hash)</script>
<noscript><meta http-equiv="refresh" content="0;url=/app/"></noscript>
EOF
mv -f "$tmp" "$TARGET"

echo "wrote: $TARGET"
