# 功能目录

规则与选项以 `Script/mihomoScript.js` 为准；静态 YAML 由同一脚本生成。

## 本仓库重点维护

| 功能 | 实现范围 |
| --- | --- |
| Apple 分流 | Siri / Apple Intelligence、Apple 产品地区服务、其他 Apple 服务分组；连接出口与 DNS policy 按专项规则配置。 |
| DNS 控制 | 生成加密 DNS、按域名和规则集指定解析出口；严格模式不静默回退到明文 DNS。 |
| 机场覆写 | 展开模式只处理节点和节点 hosts 映射，其他机场配置不进入输出。 |
| 纯 IP 入站识别 | 以 HTTP Host、TLS SNI 和受支持的 QUIC 元数据补充域名，不改写目标地址。 |
| 单一构建来源 | 脚本管理行为；静态 YAML 经构建工具生成，扩展开关须重新构建。 |
| 自动选择排除组 | `自动选择ex(大陆&香港)` 根据节点名称过滤大陆、香港候选并保留台湾节点。 |

Apple 组范围与 DNS 特例见 [Apple 路由说明](apple-routing.md)；provider 和规则优先级见[规则来源说明](rule-sources.md)。

## 常规能力

提供地区、倍率和家宽节点分类，常见服务域名与 IP 分流，以及手动、自动测速、负载均衡、IPv4/IPv6、TUN 和链式代理等选项。地区候选由节点名称识别，不能证明真实出口地区。

## 配置模式

| 模式 | 输入 | 节点处理 |
| --- | --- | --- |
| 脚本覆写 | 含 `proxies` 数组的 Mihomo/Clash 配置 | 脚本处理节点并生成完整配置。 |
| 静态 YAML | 配置 `proxy-providers.订阅.url` 后导入内核 | 内核按 provider 读取订阅；构建时看不到节点名称或机场 hosts。 |
| 本地展开 | 选项 YAML 与 `--subscription` 本地文件 | 构建工具将节点交给同一脚本处理，订阅更新后需重新生成。 |

YAML 中的 `x-myClashRules` 是构建输入，Mihomo 不执行这些扩展字段。开发命令和节点处理测试见 [Test/README.md](../Test/README.md)。
