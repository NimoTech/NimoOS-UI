# SP5-P5 自定义安装/导入 — SDD 台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-21-vue3-migration-sp5-p5-custom-install.md (docs 分支 35109a86)
基线: New-UI master@314741c / Service sp3-shared-http@e72afa4
决策: D1-D7 全部按计划执行(用户 2026-07-21 拍板 D2/D4/D5/D6 照建议)

## 任务进度
(未开始)

## Minor findings 累积(留终审 triage)
Task 1: complete (commits 314741c..4a57217, review clean/Approved)
  Minor→终审: ①buildYaml 端口顺序不保序(可编辑行在前 extras 追加在后,compose 语义无关紧要) ②缺 mode:host 异形对象专项测试(逻辑已覆盖)
Task 2: complete (commits 4a57217..355574a, review clean/Approved)
  Minor→终审: ①extraLabel 部分对象(缺 published/host_ip)摘要形态无测试 ②extras 用 index 作 key(静态只读无害)
Task 3: complete (Service commits e72afa4..0719511, review clean/Approved)
  Minor→终审: ①getNetworks 缺 success!==200 抛错路径测试 ②DockerNetwork 类型缺来源端点 doc 注释
Task 4: complete (commits 355574a..1267a80, review Approved)
  ⚠️ Important(plan-mandated,待用户决策): 多网络服务编辑网络下拉→networks 整段替换为单网络,附加网络(如共享代理网)丢失。Vue2 patchNetworkValue 同行为(=parity 非回归),D7 保未编辑路径。选项:照旧(Vue2 对齐)/多网络时下拉改只读。
  Minor→终审: ①string command 一经编辑转 exec 数组形式(brief 既定设计) ②网络下拉在 getNetworks 未返回/失败时当前值可能显示空白 ③NETWORK_MODE_VALUES 两处小重复
Task 5: complete (commits 1267a80..996c34c 共2提交, 首审 Needs fixes→修复→复审 Approved)
  修复: tmpfs 长语法卷透传保护(type∈{undefined,bind,volume} 才重写)+volumeAutoCheck 恢复 Vue2 逐字大小写语义
  Minor→终审: ①YAML 锚点/别名无测试 ②rewriteLongVolume 非字符串 type 视作可重写(畸形输入)
  Deferral: composerize 打包验证延到 T6(页面真正 import 后 build gate 覆盖)
Task 6: complete (commits 996c34c..cf8fa33 共2提交, 首审 Needs fixes→D4 深链空 store 绕过修复→复审 Approved)
  实现者中断插曲: T6 implementer 被打断在提交前,controller 跑全门(1064 测试/tsc/build+composerize 进 bundle)后代提交 be7a6c8;修复 cf8fa33
  T5 deferral 已关: composerize 确认打进 dist bundle
  Minor→终审: onInstall/onValidate 不 await router.push 即翻 busy 标志(页面已跳走,纯 cosmetic)
Task 7: complete (commits cf8fa33..b16c87d, review clean/Approved)
  Minor→终审: ①saveLinkApp 不自带 name/hostname 校验(唯一调用方已验,读回自愈) ②双 UI 并发读改写 lost-update(Vue2 同语义继承) ③cancel-edit 无专项测试
Task 8: complete — 整支终审(fable)首轮 With fixes → 单修复者 ad8bf08(D4 无条件刷新/sctp 透传/删除错误提示/deep-link 断言) → 终审验证 Ready to merge
最终坐标: New-UI master@ad8bf08(314741c..ad8bf08 共9提交) / Service sp3-shared-http@0719511 / 全量 1097+112 测试绿, tsc 双清, 主题扫描零字面量
已部署 /var/lib/nimoos/www/app/ (deploy.sh, HTTP 200)

## 待用户决策(终审升级,两项同类:高级域编辑静默降级配置)
1. string 形式 command 一经编辑写成单元素 exec 数组(含空格引号会启动失败)。选项: A=单 token 且原为 string 时写回 string(推荐) / B=UI 加提示文案 / C=照旧
2. 多网络服务编辑网络下拉→networks 塌成单网络(Vue2 同行为,D7 保未编辑)。选项: A=多网络时下拉只读+说明(终审推荐) / B=照旧 Vue2 对齐

## 终审 defer 的 Minor(下次碰该文件时顺手): target-only 长语法端口获得 published 值(建议进 extras)/网络切走后顶层孤儿 networks 键累积/legacy LinkApp hostname 无 scheme 夹紧/tag 下拉遇 pinned tag 显示空白/失败删除错误未本地化

## 真机验收清单(用户执行)
1. /apps/custom tab1 粘商店 YAML(改 name)安装→进度卡→上桌→打开
2. tab1 粘无 name 无 x-nimoos 裸 compose→自动得名安装→设置页能打开(watchdog 不 500)
3. tab2 粘 docker run -d -p 8080:80 -v ./cfg:/config --name mynginx nginx→转换回填→安装
4. 同名已装应用重装被硬挡(提示改名)
5. tab3 添加外部链接→桌面出现→点击新窗口打开→编辑图标→删除;老界面 /#/legacy 能看到同一条链接(key 互通)
6. Crafty 设置保存端口段不塌(保存后设置页里 25500-25600 仍在"原样保留"区)
7. 设置页: command 编辑/网络下拉 bridge↔host/商店应用 image tag 下拉 stable·latest
验收补丁①@ecc0f71: 命令编辑器加号按钮补 align-self(纵向 flex 被拉整行宽)
验收补丁②@ae642ab: ①ensureComposeMeta 注入 port_map(首个可解析发布端口;桌面 appUrl 无 port 无 index 静默不动=图标点不开根因) ②不再注入 icon.nimoos.io 死链(域名不存在,Vue2 遗留;缺 icon 走默认 glyph) ③AppTile img @error 回落 glyph(任何坏 icon URL 自愈)。1101/1101+tsc 净,已部署。
⚠️ 已装的 test-nginx 等旧自定义应用不会自动获得 port_map——需卸载重装(或设置页 WebUI 区手填端口)
验收补丁③@4e1ae5d: 卸载后桌面磁贴不消失(手动固定豁免清理的设计盲区)。修:①订阅 app:uninstall-end(明确"应用已不存在"信号,更新/重建不发)→ layout.evict(key,{force:true}) 连手动固定一并立即清位;②layout.sweepGone(liveKeys) 统一清扫兜底——凡桌面 app/appwidget 磁贴 key 不在成功加载的应用列表里(含 LinkApp 被删/老界面卸载),沿用 45s 缺席宽限后移除(防 docker 抖动误删布局的原设计保留)。1106/1106+tsc 净,已部署。
验收补丁④@6fca443: docker run 导入出现双卡(一张 0% 幽灵)+ 应用名变 your-project-name。根因=composerize 顶部固定输出占位名 `name: <your project name>`,ensureComposeMeta"不覆盖既有名"将其放行,后端另行归一后与前端 track key 对不上→进度事件全丢。修:①dockerRunToCompose 剥 `<...>` 占位名 ②deriveRawName 级联加 container_name(--name)优先于 service key ③顶层 name 不合法(compose-go 规则 ^[a-z0-9][a-z0-9_-]*$)时 slug 合法化写回,ensureComposeMeta 返回 name 与 YAML 顶层 name 恒等(跟踪键一致性不变量)。1110/1110+tsc 净,已部署。403 打开页面=测试命令 -v 挂空目录的预期现象(非 bug)。
验收补丁⑤(两仓): Service master@df4ba49=compose.get 404 返 undefined(幽灵卡不死根因:404 被当网络错无限重探,永不判死;修后看门狗 5 轮≈5-6 分钟转 error 卡可 dismiss);New-UI@d4bd873=端口分类器容忍 mode:ingress(compose-go 归一化 GET yaml 每个端口必带,曾把商店应用全部端口误判成只读透传——Crafty 截图实锤;重建省略 mode=同义,mode:host 仍透传)。Crafty 端口段被后端展开成 101 条单端口属后端归一化行为,数据往返无损,修后恢复可编辑。
⚠️ Service 分支模型已变: sp3-shared-http 已经 PR 合入 GitHub master(#3),本地=master ahead 1(df4ba49),旧 sp3-shared-http 分支已不存在。
验收补丁⑥@403aa6b: 安装中卡片加「停止并删除」✕ 按钮(用户诉求)——AlertDialog 确认(delDlg 解耦模式)→ progress.dismiss + 尽力 compose.uninstall(deleteConfigFolder:true,404 静默)+ refresh。后端无中止安装 API,拉取中的镜像层由 daemon 自行收尾,文案如实说明。幽灵卡从此即点即清,不依赖看门狗 5 分钟收敛。1114/1114+tsc 净,已部署。
验收进展: 补丁⑤截图实锤生效(Crafty 101 端口恢复可编辑行)。

## ⭐ 关账(2026-07-21 用户验收通过)
全部验收项+补丁①-⑥用户确认通过。最终坐标: New-UI master@403aa6b(314741c..403aa6b 共16提交)/ Service master@df4ba49(领先 origin 1)/ docs 见 roadmap 提交。
遗留决策(带入下期): string command 编辑格式 / 多网络下拉防护。
后端票备忘: JSON GET 500 + 建议取消安装接口(DELETE /compose/{id}/install)。
