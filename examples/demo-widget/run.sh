#!/usr/bin/env bash
# 桌面识别演示:构建并运行带 nimoos.* label 的示例容器(真机验收工具)
set -e
cd "$(dirname "$0")"
docker build -t nimoos-demo-widget .
docker rm -f nimoos-demo-widget 2>/dev/null || true
docker run -d --name nimoos-demo-widget -p 18080:80 \
  --label nimoos.enable=true \
  --label nimoos.title=演示小组件 \
  --label nimoos.icon=/icon.svg \
  --label nimoos.port=18080 \
  --label nimoos.widget.path=/widget/ \
  --label nimoos.widget.w=2 \
  --label nimoos.widget.h=2 \
  nimoos-demo-widget
echo "OK — 30 秒内应出现在 /app/ 桌面"
